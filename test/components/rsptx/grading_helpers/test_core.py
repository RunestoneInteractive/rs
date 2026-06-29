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
    # UTC course timezone: the naive duedate is used unchanged as the cutoff.
    a, d, h = _patch_crud(_assignment(duedate=datetime(2026, 6, 1, 23, 59, 0)))
    with a, d, h as has_submissions:
        await core.has_late_submission("student1", 42, timezone="UTC")
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
        await core.has_late_submission("student1", 42, timezone="UTC")
    assert has_submissions.call_args.args[2] == datetime(2026, 6, 4, 23, 59, 0)


async def test_due_date_converted_from_course_timezone_to_utc():
    # 23:59 on 2026-06-01 in New York (EDT, UTC-4) is 03:59 the next day in UTC.
    a, d, h = _patch_crud(_assignment(duedate=datetime(2026, 6, 1, 23, 59, 0)))
    with a, d, h as has_submissions:
        await core.has_late_submission("student1", 42, timezone="America/New_York")
    assert has_submissions.call_args.args[2] == datetime(2026, 6, 2, 3, 59, 0)
