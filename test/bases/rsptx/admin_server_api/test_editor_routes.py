"""
Functional tests for the editorial page routes on the admin server.

These cover the port of the web2py ``admin/manage_exercises`` endpoint: listing
the questions readers have flagged in the books an editor edits, clearing a
flag, and deleting a question.
"""

import datetime

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (  # noqa: E402
    create_assignment,
    create_assignment_question,
    create_question,
    fetch_assigned_question_ids,
    fetch_assignment_by_name,
    fetch_course,
    fetch_question,
)
from rsptx.db.models import (  # noqa: E402
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
)
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


async def _assign_question(question):
    """Attach a question to a stable test assignment."""
    if question.id in await fetch_assigned_question_ids([question.id]):
        return

    course = await fetch_course(EDITED_BASE_COURSE)
    assignment = await fetch_assignment_by_name("editorial_test_assignment", course.id)
    if assignment is None:
        assignment = await create_assignment(
            AssignmentValidator(
                course=course.id,
                name="editorial_test_assignment",
                points=1,
                released=False,
                description="Assignment used by editorial route tests",
                duedate=datetime.datetime(2099, 1, 1),
                visible=True,
                from_source=False,
                is_peer=False,
                current_index=0,
                peer_async_visible=False,
            )
        )
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment.id,
            question_id=question.id,
            points=1,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="pct_correct",
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
    question = await fetch_question("editor_test_listed", basecourse=EDITED_BASE_COURSE)
    assert f"/editor/questions/{question.id}/edit" in resp.text
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
# GET/POST /editor/questions/{question_id}/edit
# ---------------------------------------------------------------------------


async def test_edit_question_page(auth_editor_client):
    question = await _make_question("editor_test_edit_page")

    resp = await auth_editor_client.get(f"/editor/questions/{question.id}/edit")

    assert resp.status_code == 200
    assert "editor_test_edit_page" in resp.text
    assert "Flagged for review?" in resp.text


async def test_edit_question(auth_editor_client):
    question = await _make_question("editor_test_edit_me")

    resp = await auth_editor_client.post(
        f"/editor/questions/{question.id}/edit",
        json={
            "question": "Updated editorial source",
            "htmlsrc": "<p>Updated editorial HTML</p>",
            "difficulty": 2.5,
        },
    )

    assert resp.status_code == 200
    updated = await fetch_question("editor_test_edit_me", basecourse=EDITED_BASE_COURSE)
    assert updated.question == "Updated editorial source"
    assert updated.htmlsrc == "<p>Updated editorial HTML</p>"
    assert updated.difficulty == 2.5
    assert updated.review_flag is True


async def test_edit_question_rejects_unedited_base_course(auth_editor_client):
    question = await _make_question(
        "editor_test_other_edit", base_course=OTHER_BASE_COURSE
    )

    resp = await auth_editor_client.post(
        f"/editor/questions/{question.id}/edit",
        json={"question": "No", "htmlsrc": "<p>No</p>", "difficulty": 1},
    )

    assert resp.status_code == 403


async def test_edit_question_requires_editor(auth_noneditor_client):
    question = await _make_question("editor_test_noneditor_edit")

    resp = await auth_noneditor_client.get(f"/editor/questions/{question.id}/edit")

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
# POST /editor/delete_question
# ---------------------------------------------------------------------------


async def test_delete_question(auth_editor_client):
    """Deleting removes the question row."""
    await _make_question("editor_test_delete_me")

    resp = await auth_editor_client.post(
        "/editor/delete_question",
        json={"name": "editor_test_delete_me", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 200
    assert resp.json()["detail"]["status"] == "Success"
    assert not await fetch_question(
        "editor_test_delete_me", basecourse=EDITED_BASE_COURSE
    )


async def test_delete_unknown_question(auth_editor_client):
    """A question that does not exist is a 404, not a silent success."""
    resp = await auth_editor_client.post(
        "/editor/delete_question",
        json={"name": "editor_test_no_such_q", "base_course": EDITED_BASE_COURSE},
    )

    assert resp.status_code == 404


async def test_delete_assigned_question_is_rejected(auth_editor_client):
    """An assignment reference protects the question from deletion."""
    question = await _make_question("editor_test_assigned_delete")
    await _assign_question(question)

    page = await auth_editor_client.get("/editor/manage_exercises")
    assert "Assigned questions cannot be deleted" in page.text

    resp = await auth_editor_client.post(
        "/editor/delete_question",
        json={
            "name": "editor_test_assigned_delete",
            "base_course": EDITED_BASE_COURSE,
        },
    )

    assert resp.status_code == 409
    assert await fetch_question(
        "editor_test_assigned_delete", basecourse=EDITED_BASE_COURSE
    )


async def test_delete_rejects_unedited_base_course(auth_editor_client):
    """An editor cannot delete out of a book they do not edit."""
    await _make_question("editor_test_other_delete", base_course=OTHER_BASE_COURSE)

    resp = await auth_editor_client.post(
        "/editor/delete_question",
        json={"name": "editor_test_other_delete", "base_course": OTHER_BASE_COURSE},
    )

    assert resp.status_code == 403
    assert await fetch_question(
        "editor_test_other_delete", basecourse=OTHER_BASE_COURSE
    )
