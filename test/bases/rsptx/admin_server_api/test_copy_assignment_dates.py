"""Due date arithmetic when copying an assignment between terms.

``_copy_one_assignment`` re-dates an assignment by its offset from the start of
term. ``duedate`` is stored as naive UTC while ``term_start_date`` is a bare
date, so the term start has to be anchored in the course timezone before the
two can be subtracted. Without that, the copy drifts by the course's UTC offset
and can land on the wrong day.
"""

import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from zoneinfo import ZoneInfo

from rsptx.admin_server_api.routers import instructor
from rsptx.admin_server_api.routers.instructor import _term_start_utc

UTC = datetime.timezone.utc
CHICAGO = ZoneInfo("America/Chicago")


def _local_to_stored(year, month, day, hour, minute, tz):
    """The naive UTC value the database holds for a local wall clock time."""
    return (
        datetime.datetime(year, month, day, hour, minute, tzinfo=tz)
        .astimezone(UTC)
        .replace(tzinfo=None)
    )


def _stored_to_local(stored, tz):
    return stored.replace(tzinfo=UTC).astimezone(tz)


def _course(id, term_start_date, timezone):
    return SimpleNamespace(
        id=id,
        course_name=f"course{id}",
        term_start_date=term_start_date,
        timezone=timezone,
    )


def _assignment(duedate):
    return SimpleNamespace(
        id=7,
        name="Homework 1",
        description="",
        duedate=duedate,
        points=10,
        threshold_pct=None,
        is_timed=False,
        is_peer=False,
        time_limit=None,
        from_source=False,
        nofeedback=False,
        nopause=False,
        released=True,
        allow_self_autograde=False,
        enforce_due=True,
        peer_async_visible=False,
        kind="Regular",
    )


async def _copy(source_course, target_course, assignment):
    """Run the copy with its collaborators mocked; return the new duedate."""
    created = AsyncMock(return_value=SimpleNamespace(id=99))
    with (
        patch.object(instructor, "fetch_course", AsyncMock(return_value=source_course)),
        patch.object(
            instructor, "fetch_one_assignment", AsyncMock(return_value=assignment)
        ),
        patch.object(instructor, "create_assignment", created),
        patch.object(
            instructor, "fetch_assignment_questions", AsyncMock(return_value=[])
        ),
        patch.object(instructor, "create_assignment_question", AsyncMock()),
    ):
        result = await instructor._copy_one_assignment(
            source_course.course_name, assignment.id, target_course
        )
    # The function swallows exceptions into a "failed: ..." string, so assert
    # success rather than silently testing an error path.
    assert result == "success", result
    return created.call_args.args[0].duedate


# _term_start_utc
# ---------------


def test_term_start_anchors_midnight_in_the_course_timezone():
    # Midnight on 2026-08-24 in Chicago (CDT, UTC-5) is 05:00 UTC.
    assert _term_start_utc(datetime.date(2026, 8, 24), "America/Chicago") == (
        datetime.datetime(2026, 8, 24, 5, 0)
    )


def test_term_start_uses_the_offset_in_effect_on_that_date():
    # January is CST (UTC-6), August is CDT (UTC-5).
    assert _term_start_utc(datetime.date(2026, 1, 12), "America/Chicago").hour == 6
    assert _term_start_utc(datetime.date(2026, 8, 24), "America/Chicago").hour == 5


@pytest.mark.parametrize("timezone", [None, "", "UTC"])
def test_term_start_without_a_timezone_is_utc_midnight(timezone):
    assert _term_start_utc(datetime.date(2026, 8, 24), timezone) == (
        datetime.datetime(2026, 8, 24, 0, 0)
    )


# _copy_one_assignment
# --------------------


async def test_copy_preserves_local_wall_clock_across_a_dst_boundary():
    # Regression: a spring term start (CST) and a fall term start (CDT) used to
    # produce 2026-09-02 00:59 local instead of 2026-09-01 23:59.
    source = _course(1, datetime.date(2026, 1, 12), "America/Chicago")
    target = _course(2, datetime.date(2026, 8, 24), "America/Chicago")
    stored = _local_to_stored(2026, 1, 20, 23, 59, CHICAGO)

    new_duedate = await _copy(source, target, _assignment(stored))

    local = _stored_to_local(new_duedate, CHICAGO)
    assert local.strftime("%Y-%m-%d %H:%M") == "2026-09-01 23:59"


async def test_copy_preserves_the_offset_from_the_start_of_term():
    source = _course(1, datetime.date(2026, 1, 12), "America/Chicago")
    target = _course(2, datetime.date(2026, 8, 24), "America/Chicago")
    stored = _local_to_stored(2026, 1, 20, 23, 59, CHICAGO)

    new_duedate = await _copy(source, target, _assignment(stored))

    # 8 days and change after the start of term, in both terms.
    assert new_duedate - _term_start_utc(
        target.term_start_date, target.timezone
    ) == stored - _term_start_utc(source.term_start_date, source.timezone)


async def test_copy_with_no_course_timezone_behaves_as_utc():
    source = _course(1, datetime.date(2026, 1, 12), None)
    target = _course(2, datetime.date(2026, 8, 24), None)
    stored = datetime.datetime(2026, 1, 20, 23, 59)

    new_duedate = await _copy(source, target, _assignment(stored))

    assert new_duedate == datetime.datetime(2026, 9, 1, 23, 59)


async def test_copy_keeps_the_duedate_when_a_term_start_is_missing():
    source = _course(1, None, "America/Chicago")
    target = _course(2, datetime.date(2026, 8, 24), "America/Chicago")
    stored = _local_to_stored(2026, 1, 20, 23, 59, CHICAGO)

    assert await _copy(source, target, _assignment(stored)) == stored
