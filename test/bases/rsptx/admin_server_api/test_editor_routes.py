"""
Functional tests for the editorial page routes on the admin server.

These cover the port of the web2py ``admin/manage_exercises`` endpoint: listing
the questions readers have flagged in the books an editor edits, clearing a
flag, and retiring a question.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (  # noqa: E402
    create_question,
    fetch_question,
    search_exercises,
)
from rsptx.validation import schemas  # noqa: E402
from rsptx.db.models import QuestionValidator  # noqa: E402
from rsptx.response_helpers.core import canonical_utcnow  # noqa: E402

# The editor fixture edits ``overview``; ``fopp`` is a base course they do not.
EDITED_BASE_COURSE = "overview"
OTHER_BASE_COURSE = "fopp"


async def _make_question(name, base_course=EDITED_BASE_COURSE, flagged=True):
    """Create (or return) a question, flagged for review by default."""
    existing = await fetch_question(name, basecourse=base_course)
    if existing:
        return existing
    return await create_question(
        QuestionValidator(
            base_course=base_course,
            name=name,
            chapter="ch1",
            subchapter="sub1",
            author="Test Editor",
            question="Flagged for review?",
            htmlsrc=f"<p>html for {name}</p>",
            timestamp=canonical_utcnow(),
            question_type="shortanswer",
            is_private=False,
            from_source=False,
            review_flag=flagged,
        )
    )


# ---------------------------------------------------------------------------
# GET /editor/manage_exercises
# ---------------------------------------------------------------------------


async def test_manage_exercises_lists_flagged_questions(auth_editor_client):
    """An editor sees the flagged questions from a base course they edit."""
    await _make_question("editor_test_listed")
    await _make_question("editor_test_unflagged", flagged=False)

    resp = await auth_editor_client.get("/editor/manage_exercises")

    assert resp.status_code == 200
    assert "editor_test_listed" in resp.text
    # A question that nobody flagged stays off the page.
    assert "editor_test_unflagged" not in resp.text


async def test_manage_exercises_skips_other_peoples_books(auth_editor_client):
    """Flagged questions from a base course the editor does not edit are hidden."""
    await _make_question("editor_test_other_book", base_course=OTHER_BASE_COURSE)

    resp = await auth_editor_client.get("/editor/manage_exercises")

    assert resp.status_code == 200
    assert "editor_test_other_book" not in resp.text


async def test_manage_exercises_requires_editor(auth_noneditor_client):
    """A logged-in non-editor is refused."""
    resp = await auth_noneditor_client.get("/editor/manage_exercises")

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /editor/clear_flag
# ---------------------------------------------------------------------------


async def test_clear_flag(auth_editor_client):
    """Clearing the flag leaves the question in place, off the review list."""
    await _make_question("editor_test_clear_me")

    resp = await auth_editor_client.post(
        "/editor/clear_flag",
        json={"name": "editor_test_clear_me", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 200
    assert resp.json()["detail"]["status"] == "Success"
    q = await fetch_question("editor_test_clear_me", basecourse=EDITED_BASE_COURSE)
    assert q is not None
    assert q.review_flag is False


async def test_clear_flag_rejects_unedited_base_course(auth_editor_client):
    """An editor cannot touch a question in a book they do not edit."""
    await _make_question("editor_test_other_clear", base_course=OTHER_BASE_COURSE)

    resp = await auth_editor_client.post(
        "/editor/clear_flag",
        json={"name": "editor_test_other_clear", "base_course": OTHER_BASE_COURSE},
    )

    assert resp.status_code == 403
    q = await fetch_question("editor_test_other_clear", basecourse=OTHER_BASE_COURSE)
    assert q.review_flag is True


async def test_clear_flag_requires_editor(auth_noneditor_client):
    """A non-editor cannot clear a flag."""
    resp = await auth_noneditor_client.post(
        "/editor/clear_flag",
        json={"name": "editor_test_listed", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /editor/retire_question
# ---------------------------------------------------------------------------


async def test_retire_question(auth_editor_client):
    """Retiring keeps the row but stamps retired_on and clears the review flag."""
    await _make_question("editor_test_retire_me")

    resp = await auth_editor_client.post(
        "/editor/retire_question",
        json={"name": "editor_test_retire_me", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 200
    assert resp.json()["detail"]["status"] == "Success"

    q = await fetch_question("editor_test_retire_me", basecourse=EDITED_BASE_COURSE)
    # The row survives on purpose -- courses already assigning it keep working.
    assert q is not None
    assert q.retired_on is not None
    assert not q.review_flag


async def test_retired_question_drops_out_of_search(auth_editor_client):
    """The point of retiring: it stops showing up when instructors look for
    exercises to assign, even though the row is still there."""
    await _make_question("editor_test_retire_search")

    criteria = schemas.ExercisesSearchRequest(
        use_base_course=False,
        base_course=EDITED_BASE_COURSE,
        limit=1000,
        filters={"name": {"value": "editor_test_retire_search", "matchMode": "equals"}},
    )
    before = await search_exercises(criteria, owner="test_editor")
    assert [e.name for e in before["exercises"]] == ["editor_test_retire_search"]

    await auth_editor_client.post(
        "/editor/retire_question",
        json={"name": "editor_test_retire_search", "base_course": EDITED_BASE_COURSE},
    )

    after = await search_exercises(criteria, owner="test_editor")
    assert after["exercises"] == []


async def test_retire_unknown_question(auth_editor_client):
    """A question that does not exist is a 404, not a silent success."""
    resp = await auth_editor_client.post(
        "/editor/retire_question",
        json={"name": "editor_test_no_such_q", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 404


async def test_retire_rejects_unedited_base_course(auth_editor_client):
    """An editor cannot retire out of a book they do not edit."""
    await _make_question("editor_test_other_retire", base_course=OTHER_BASE_COURSE)

    resp = await auth_editor_client.post(
        "/editor/retire_question",
        json={"name": "editor_test_other_retire", "base_course": OTHER_BASE_COURSE},
    )

    assert resp.status_code == 403
    q = await fetch_question("editor_test_other_retire", basecourse=OTHER_BASE_COURSE)
    assert q is not None and q.retired_on is None
