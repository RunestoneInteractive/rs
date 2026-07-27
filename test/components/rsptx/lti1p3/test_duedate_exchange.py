"""LTI 1.3 due date exchange.

``assignments.duedate`` is stored as naive UTC. On the way in, an LMS timestamp
carrying an offset converts straight to UTC while a naive one is read as
course-local wall clock. On the way out the value must carry an explicit
offset, or the LMS is free to read it as its own local time.
"""

import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from rsptx.lti1p3.core import update_line_item_from_assignment
from rsptx.lti1p3.pylti1p3.lineitem import LineItem


def _course(timezone="America/Chicago", id=1):
    return SimpleNamespace(id=id, course_name="course1", timezone=timezone)


def _assignment(duedate=None, id=7):
    return SimpleNamespace(id=id, name="Homework 1", duedate=duedate, points=10)


# Ingest
# ------


async def _ingest(lms_string, course):
    """Run update_rsassignment_from_lti and return the stored duedate."""
    from rsptx.admin_server_api.routers import lti1p3

    assign = _assignment(duedate=datetime.datetime(2000, 1, 1))
    line_item = LineItem()
    line_item.set_end_date_time(lms_string)

    with patch.object(lti1p3, "update_assignment", AsyncMock()) as update:
        await lti1p3.update_rsassignment_from_lti(assign, line_item, {}, course)

    assert update.await_count == 1, "expected the assignment to be updated"
    return assign.duedate


@pytest.mark.parametrize(
    "lms_string,expected",
    [
        # Explicit offset: converts straight to the same instant in UTC.
        ("2026-09-01T23:59:00-05:00", datetime.datetime(2026, 9, 2, 4, 59)),
        # Trailing Z is normalized before parsing.
        ("2026-09-02T04:59:00Z", datetime.datetime(2026, 9, 2, 4, 59)),
        # Naive: read as course-local (Chicago, CDT) then converted.
        ("2026-09-01T23:59:00", datetime.datetime(2026, 9, 2, 4, 59)),
    ],
)
async def test_ingest_stores_naive_utc(lms_string, expected):
    assert await _ingest(lms_string, _course()) == expected


async def test_ingest_of_a_naive_time_without_a_course_timezone_is_utc():
    stored = await _ingest("2026-09-01T23:59:00", _course(timezone=None))
    assert stored == datetime.datetime(2026, 9, 1, 23, 59)


async def test_ingest_result_is_naive():
    # A tz-aware value would blow up later comparisons against naive UTC.
    assert (await _ingest("2026-09-01T23:59:00-05:00", _course())).tzinfo is None


async def test_ingest_is_skipped_when_the_course_ignores_lti_dates():
    from rsptx.admin_server_api.routers import lti1p3

    original = datetime.datetime(2026, 1, 1, 12, 0)
    assign = _assignment(duedate=original)
    line_item = LineItem()
    line_item.set_end_date_time("2026-09-01T23:59:00-05:00")

    with patch.object(lti1p3, "update_assignment", AsyncMock()) as update:
        await lti1p3.update_rsassignment_from_lti(
            assign, line_item, {"ignore_lti_dates": "true"}, _course()
        )

    update.assert_not_awaited()
    assert assign.duedate == original


async def test_ingest_ignores_an_unparseable_date():
    from rsptx.admin_server_api.routers import lti1p3

    original = datetime.datetime(2026, 1, 1, 12, 0)
    assign = _assignment(duedate=original)
    line_item = LineItem()
    line_item.set_end_date_time("not a date")

    with patch.object(lti1p3, "update_assignment", AsyncMock()) as update:
        await lti1p3.update_rsassignment_from_lti(assign, line_item, {}, _course())

    update.assert_not_awaited()
    assert assign.duedate == original


# Push
# ----


def test_push_sends_an_explicit_utc_offset():
    line_item = update_line_item_from_assignment(
        LineItem(),
        _assignment(duedate=datetime.datetime(2026, 9, 2, 4, 59)),
        _course(),
        push_duedate=True,
    )
    assert line_item.get_end_date_time() == "2026-09-02T04:59:00Z"


def test_push_is_skipped_unless_requested():
    line_item = update_line_item_from_assignment(
        LineItem(),
        _assignment(duedate=datetime.datetime(2026, 9, 2, 4, 59)),
        _course(),
        push_duedate=False,
    )
    assert line_item.get_end_date_time() is None


# Round trip
# ----------


async def test_ingest_then_push_preserves_the_instant():
    lms_string = "2026-09-01T23:59:00-05:00"
    stored = await _ingest(lms_string, _course())

    line_item = update_line_item_from_assignment(
        LineItem(), _assignment(duedate=stored), _course(), push_duedate=True
    )
    sent = line_item.get_end_date_time()

    assert datetime.datetime.fromisoformat(
        sent.replace("Z", "+00:00")
    ) == datetime.datetime.fromisoformat(lms_string)
