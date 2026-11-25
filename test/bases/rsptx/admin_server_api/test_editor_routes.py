"""
Functional tests for the editorial page routes on the admin server.

These cover the port of the web2py ``admin/manage_exercises`` endpoint: listing
the questions readers have flagged in the books an editor edits, clearing a
flag, and deleting or retiring a question.
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
    search_exercises,
    unretire_question_by_name,
    update_question,
)
from rsptx.db.models import (  # noqa: E402
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
)
from rsptx.response_helpers.core import canonical_utcnow  # noqa: E402
from rsptx.validation import schemas  # noqa: E402

# The editor fixture edits ``overview``; ``fopp`` is a base course they do not.
EDITED_BASE_COURSE = "overview"
OTHER_BASE_COURSE = "fopp"


async def _make_question(
    name, base_course=EDITED_BASE_COURSE, flagged=True, with_question_json=True
):
    """Create (or return) a question, flagged for review by default."""
    question_json = (
        {"type": "shortanswer", "prompt": "Flagged for review?"}
        if with_question_json
        else None
    )
    existing = await fetch_question(name, basecourse=base_course)
    if existing:
        existing.question_json = question_json
        existing.review_flag = flagged
        await update_question(existing)
        # A row left retired by an earlier run starts this one live again.
        await unretire_question_by_name(name, base_course)
        return await fetch_question(name, basecourse=base_course)
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
            question_json=question_json,
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
    assert "/staticAssets/js/admin/manage_exercises.js" in resp.text
    # A question that nobody flagged stays off the page.
    assert "editor_test_unflagged" not in resp.text


async def test_manage_exercises_disables_edit_for_legacy_question(auth_editor_client):
    question = await _make_question("editor_test_legacy", with_question_json=False)

    resp = await auth_editor_client.get("/editor/manage_exercises")

    assert resp.status_code == 200
    assert 'title="This legacy question cannot be edited"' in resp.text
    assert 'class="disabled-action-tooltip"' in resp.text
    assert 'tabindex="0"' in resp.text
    assert f"/editor/questions/{question.id}/edit" not in resp.text


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
    assert "Question JSON" in resp.text
    assert "HTML is regenerated automatically" in resp.text
    assert "/assignment/react/assets/editorial-html-renderer.js" in resp.text
    assert "/staticAssets/js/admin/manage_exercises.js" in resp.text
    assert 'data-question-type="shortanswer"' in resp.text
    assert "Flagged for review?" in resp.text
    assert "html for editor_test_edit_page" in resp.text


async def test_edit_question(auth_editor_client):
    question = await _make_question("editor_test_edit_me")

    resp = await auth_editor_client.post(
        f"/editor/questions/{question.id}/edit",
        json={
            "question_json": {
                "type": "shortanswer",
                "prompt": "Updated editorial prompt",
            },
            "htmlsrc": "<p>Updated editorial HTML</p>",
        },
    )

    assert resp.status_code == 200
    updated = await fetch_question("editor_test_edit_me", basecourse=EDITED_BASE_COURSE)
    assert updated.question_json == {
        "type": "shortanswer",
        "prompt": "Updated editorial prompt",
    }
    assert updated.question == "Flagged for review?"
    assert updated.htmlsrc == "<p>Updated editorial HTML</p>"
    assert updated.review_flag is True


async def test_edit_question_rejects_legacy_question(auth_editor_client):
    question = await _make_question("editor_test_legacy_edit", with_question_json=False)

    page = await auth_editor_client.get(f"/editor/questions/{question.id}/edit")
    save = await auth_editor_client.post(
        f"/editor/questions/{question.id}/edit",
        json={
            "question_json": {"type": "shortanswer"},
            "htmlsrc": "<p>Updated editorial HTML</p>",
        },
    )

    assert page.status_code == 409
    assert save.status_code == 409


async def test_edit_question_rejects_unedited_base_course(auth_editor_client):
    question = await _make_question(
        "editor_test_other_edit", base_course=OTHER_BASE_COURSE
    )

    resp = await auth_editor_client.post(
        f"/editor/questions/{question.id}/edit",
        json={
            "question_json": {"type": "shortanswer", "prompt": "No"},
            "htmlsrc": "<p>No</p>",
        },
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
    # The page offers Retire in Delete's place for this question.
    assert "retireQuestion('editor_test_assigned_delete'" in page.text
    assert "deleteQuestion('editor_test_assigned_delete'" not in page.text

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


# ---------------------------------------------------------------------------
# POST /editor/retire_question
# ---------------------------------------------------------------------------


async def test_manage_exercises_offers_delete_or_retire(auth_editor_client):
    """An unassigned question can be deleted; an assigned one only retired."""
    await _make_question("editor_test_offer_delete")
    assigned = await _make_question("editor_test_offer_retire")
    await _assign_question(assigned)

    page = await auth_editor_client.get("/editor/manage_exercises")

    assert "deleteQuestion('editor_test_offer_delete'" in page.text
    assert "retireQuestion('editor_test_offer_delete'" not in page.text
    assert "retireQuestion('editor_test_offer_retire'" in page.text
    assert "deleteQuestion('editor_test_offer_retire'" not in page.text


async def test_retire_question(auth_editor_client):
    """Retiring keeps the row -- and the assignment that uses it -- but stamps
    retired_on and clears the review flag."""
    question = await _make_question("editor_test_retire_me")
    await _assign_question(question)

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
    assert q.retired_by is not None
    assert not q.review_flag
    assert q.id in await fetch_assigned_question_ids([q.id])


async def test_retire_reflagged_question(auth_editor_client):
    """A retired question that gets flagged again can be retired again: the
    flag is cleared and the original retirement date stands."""
    question = await _make_question("editor_test_retire_twice")
    await _assign_question(question)
    body = {"name": "editor_test_retire_twice", "base_course": EDITED_BASE_COURSE}

    await auth_editor_client.post("/editor/retire_question", json=body)
    first = await fetch_question(
        "editor_test_retire_twice", basecourse=EDITED_BASE_COURSE
    )
    first.review_flag = True
    await update_question(first)

    resp = await auth_editor_client.post("/editor/retire_question", json=body)

    assert resp.status_code == 200
    second = await fetch_question(
        "editor_test_retire_twice", basecourse=EDITED_BASE_COURSE
    )
    assert not second.review_flag
    assert second.retired_on == first.retired_on


async def test_editing_a_retired_question_keeps_it_retired(auth_editor_client):
    """An instructor can still edit a retired exercise their course assigns.

    That route builds the question from the request, which knows nothing about
    retirement, so the save must not put the exercise back into search.
    """
    question = await _make_question("editor_test_retire_then_edit")
    await _assign_question(question)
    await auth_editor_client.post(
        "/editor/retire_question",
        json={
            "name": "editor_test_retire_then_edit",
            "base_course": EDITED_BASE_COURSE,
        },
    )

    # What an edit sends: the row as it was before anyone retired it.
    question.htmlsrc = "<p>edited after retirement</p>"
    await update_question(question)

    q = await fetch_question(
        "editor_test_retire_then_edit", basecourse=EDITED_BASE_COURSE
    )
    assert q.htmlsrc == "<p>edited after retirement</p>"
    assert q.retired_on is not None
    assert q.retired_by is not None


async def test_retired_question_drops_out_of_search(auth_editor_client):
    """The point of retiring: it stops showing up when instructors look for
    exercises to assign, even though the row is still there."""
    question = await _make_question("editor_test_retire_search")
    await _assign_question(question)

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


async def test_retire_unassigned_question_is_rejected(auth_editor_client):
    """Nothing depends on an unassigned question, so it is deleted, not retired."""
    await _make_question("editor_test_retire_unassigned")

    resp = await auth_editor_client.post(
        "/editor/retire_question",
        json={
            "name": "editor_test_retire_unassigned",
            "base_course": EDITED_BASE_COURSE,
        },
    )

    assert resp.status_code == 409
    q = await fetch_question(
        "editor_test_retire_unassigned", basecourse=EDITED_BASE_COURSE
    )
    assert q.retired_on is None
    assert q.review_flag is True


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
