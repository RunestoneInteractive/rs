from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from rsptx.grading_helpers import core


def _assignment(enforce_due=True, course=1, duedate=datetime(2026, 6, 1, 23, 59, 0)):
    return SimpleNamespace(enforce_due=enforce_due, course=course, duedate=duedate)


def _patch_crud(assignment, accommodation=None, has_late=False):
    """Patch the three crud calls has_late_submission depends on."""
    return (
        patch.object(core, "fetch_one_assignment", AsyncMock(return_value=assignment)),
        patch.object(
            core, "fetch_deadline_exception", AsyncMock(return_value=accommodation)
        ),
        patch.object(
            core, "has_submissions_after_deadline", AsyncMock(return_value=has_late)
        ),
    )


def test_sample():
    assert core is not None


async def test_returns_false_when_due_date_not_enforced():
    # When the instructor does not enforce the due date nothing counts as late
    # and we should never bother querying useinfo.
    a, d, h = _patch_crud(_assignment(enforce_due=False), has_late=True)
    with a, d, h as has_submissions:
        result = await core.has_late_submission("student1", 42)
    assert result is False
    has_submissions.assert_not_called()


async def test_returns_true_when_student_has_late_work():
    a, d, h = _patch_crud(_assignment(), accommodation=None, has_late=True)
    with a, d, h:
        result = await core.has_late_submission("student1", 42)
    assert result is True


async def test_returns_false_when_no_late_work():
    a, d, h = _patch_crud(_assignment(), accommodation=None, has_late=False)
    with a, d, h:
        result = await core.has_late_submission("student1", 42)
    assert result is False


async def test_deadline_passed_to_query_in_utc():
    # duedate is stored as naive UTC and is used unchanged as the cutoff.
    a, d, h = _patch_crud(_assignment(duedate=datetime(2026, 6, 1, 23, 59, 0)))
    with a, d, h as has_submissions:
        await core.has_late_submission("student1", 42)
    args = has_submissions.call_args.args
    assert args[0] == "student1"
    assert args[1] == 42
    assert args[2] == datetime(2026, 6, 1, 23, 59, 0)


async def test_accommodation_extends_deadline():
    # A 3 day accommodation should push the cutoff three days later.
    accommodation = SimpleNamespace(duedate=3)
    a, d, h = _patch_crud(
        _assignment(duedate=datetime(2026, 6, 1, 23, 59, 0)),
        accommodation=accommodation,
    )
    with a, d, h as has_submissions:
        await core.has_late_submission("student1", 42)
    assert has_submissions.call_args.args[2] == datetime(2026, 6, 4, 23, 59, 0)


async def test_due_date_is_not_shifted_by_any_timezone():
    # duedate is already UTC, so the cutoff must be passed through untouched no
    # matter what the ambient local timezone of the process happens to be. This
    # guards against someone reintroducing a course-local -> UTC conversion.
    duedate = datetime(2026, 6, 1, 23, 59, 0)
    a, d, h = _patch_crud(_assignment(duedate=duedate))
    with a, d, h as has_submissions:
        await core.has_late_submission("student1", 42)
    assert has_submissions.call_args.args[2] == duedate


def _student():
    return SimpleNamespace(
        username="student1", course_name="course1", course_id=1, id=7
    )


def _answer_submission(div_id="q1"):
    return SimpleNamespace(
        div_id=div_id,
        selector_id=None,
        event="mChoice",
        act="answer:1:correct",
        course_name="course1",
        assignment_id=42,
        correct=True,
        percent=1.0,
    )


def _score_spec(**kw):
    from rsptx.validation.schemas import ScoringSpecification

    defaults = dict(
        assigned=True,
        max_score=10,
        score=0,
        assignment_id=42,
        which_to_grade="last_answer",
        how_to_score="pct_correct",
        username="",
        comment="",
        question_id=3,
    )
    defaults.update(kw)
    return ScoringSpecification(**defaults)


def _patch_scoring(existing_grade, score_spec=None):
    """Patch everything grade_submission touches around the question grade."""
    return (
        patch.object(core, "fetch_deadline_exception", AsyncMock(return_value=None)),
        patch.object(
            core, "is_assigned", AsyncMock(return_value=score_spec or _score_spec())
        ),
        patch.object(
            core, "fetch_question_grade", AsyncMock(return_value=existing_grade)
        ),
        patch.object(core, "update_question_grade_entry", AsyncMock()),
        patch.object(core, "create_question_grade_entry", AsyncMock()),
        patch.object(core, "compute_total_score", AsyncMock()),
        patch.object(core, "score_one_answer", AsyncMock(return_value=10)),
    )


async def test_student_submission_leaves_a_hand_entered_grade_alone():
    # Issue #1515: an instructor's grade was overwritten by the autograder the
    # next time the student saved the question.
    grade = SimpleNamespace(id=1, score=3, comment="see me after class")
    dl, assigned, fetch, update, create, total, score_one = _patch_scoring(grade)
    with dl, assigned, fetch, update as upd, create as crt, total as tot, score_one:
        spec = await core.grade_submission(_student(), _answer_submission())

    assert spec.score == 3
    assert spec.comment == "see me after class"
    upd.assert_not_called()
    crt.assert_not_called()
    tot.assert_not_called()


async def test_a_grade_saved_with_no_comment_is_still_protected():
    # The grading page stamps this marker when the instructor types no comment.
    from rsptx.grading_helpers.comments import MANUAL_COMMENT

    grade = SimpleNamespace(id=1, score=3, comment=MANUAL_COMMENT)
    dl, assigned, fetch, update, create, total, score_one = _patch_scoring(grade)
    with dl, assigned, fetch, update as upd, create, total, score_one:
        spec = await core.grade_submission(_student(), _answer_submission())

    assert spec.score == 3
    upd.assert_not_called()


async def test_autograded_rows_are_still_rescored():
    grade = SimpleNamespace(id=1, score=3, comment="autograded")
    dl, assigned, fetch, update, create, total, score_one = _patch_scoring(grade)
    with dl, assigned, fetch, update as upd, create, total as tot, score_one:
        spec = await core.grade_submission(_student(), _answer_submission())

    assert spec.score == 10
    upd.assert_awaited()
    tot.assert_awaited()


async def test_reading_page_score_leaves_a_hand_entered_grade_alone():
    from rsptx.validation.schemas import ReadingAssignmentSpec

    grade = SimpleNamespace(id=1, score=2, comment="graded by hand")
    reading = ReadingAssignmentSpec(
        activities_required=3, question_id=3, assignment_id=42, points=5, name="page1"
    )
    with (
        patch.object(core, "fetch_question_grade", AsyncMock(return_value=grade)),
        patch.object(core, "update_question_grade_entry", AsyncMock()) as update,
    ):
        with patch.object(core, "compute_total_score", AsyncMock()) as total:
            await core.score_reading_page(reading, _student())

    update.assert_not_called()
    total.assert_not_called()
