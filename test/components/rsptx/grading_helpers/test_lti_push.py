"""Unit tests for the version-aware LTI grade passback dispatcher.

Grading used to call the LTI 1.3 push directly, so a course linked over LTI 1.1
never received a score from a regrade, recompute, or manual override.
"""

import asyncio
import contextlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from rsptx.grading_helpers import lti_push


def _assignment():
    return SimpleNamespace(id=42, points=10, released=True)


def _patch(version):
    return (
        patch.object(lti_push, "fetch_lti_version", AsyncMock(return_value=version)),
        patch.object(lti_push, "attempt_lti1p1_score_updates", AsyncMock()),
        patch.object(lti_push, "attempt_lti1p3_score_updates_for", AsyncMock()),
    )


async def test_an_lti1p1_course_gets_its_scores_pushed():
    ver, p11, p13 = _patch("1.1")
    with ver, p11 as push11, p13 as push13:
        await lti_push.attempt_lti_score_updates(_assignment(), 5, [(1, 7.0)])

    push11.assert_awaited_once()
    assignment, course_id, updates = push11.await_args.args
    assert (course_id, updates) == (5, [(1, 7.0)])
    push13.assert_not_awaited()


async def test_an_lti1p3_course_still_uses_the_1p3_service():
    ver, p11, p13 = _patch("1.3")
    with ver, p11 as push11, p13 as push13:
        await lti_push.attempt_lti_score_updates(
            _assignment(), 5, [(1, 7.0)], instructor_triggered=True
        )

    push13.assert_awaited_once()
    assert push13.await_args.args == (42, [(1, 7.0)])
    assert push13.await_args.kwargs["instructor_triggered"] is True
    push11.assert_not_awaited()


async def test_a_course_with_no_lti_link_pushes_nothing():
    ver, p11, p13 = _patch(None)
    with ver, p11 as push11, p13 as push13:
        await lti_push.attempt_lti_score_updates(_assignment(), 5, [(1, 7.0)])

    push11.assert_not_awaited()
    push13.assert_not_awaited()


async def test_an_empty_batch_does_not_even_look_up_the_version():
    """fetch_lti_version costs two queries; a no-op recompute should not pay it."""
    ver, p11, p13 = _patch("1.1")
    with ver as version, p11, p13:
        await lti_push.attempt_lti_score_updates(_assignment(), 5, [])

    version.assert_not_awaited()


async def test_the_version_is_resolved_once_for_the_whole_batch():
    ver, p11, p13 = _patch("1.1")
    with ver as version, p11 as push11, p13:
        await lti_push.attempt_lti_score_updates(
            _assignment(), 5, [(1, 7.0), (2, 3.0), (3, 9.0)]
        )

    version.assert_awaited_once()
    push11.assert_awaited_once()
    assert len(push11.await_args.args[2]) == 3


# Real-time LTI 1.1 passback
# ==========================
#
# ``compute_total_score`` pushed to LTI 1.3 only, so a student who answered a
# question or finished a reading page on an LTI 1.1 course saw their total move
# in Runestone but not in the LMS until an instructor ran a recompute.


@pytest.fixture(autouse=True)
def clean_push_state():
    """Each test gets an empty version cache, queue, and task table."""
    lti_push._version_cache.clear()
    lti_push._pending_scores.clear()
    lti_push._flush_tasks.clear()
    yield
    lti_push._version_cache.clear()
    lti_push._pending_scores.clear()
    lti_push._flush_tasks.clear()


@contextlib.contextmanager
def _patch_realtime(version, debounce=0.0):
    """Patch the dispatcher's dependencies and shorten the debounce window."""
    with (
        patch.object(
            lti_push, "fetch_lti_version", AsyncMock(return_value=version)
        ) as version_lookup,
        patch.object(
            lti_push, "fetch_one_assignment", AsyncMock(return_value=_assignment())
        ),
        patch.object(lti_push, "attempt_lti1p1_score_updates", AsyncMock()) as push11,
        patch.object(lti_push, "LTI1P1_DEBOUNCE_SECONDS", debounce),
    ):
        yield version_lookup, push11


async def _drain():
    """Let every scheduled flush task run to completion."""
    tasks = list(lti_push._flush_tasks.values())
    if tasks:
        await asyncio.gather(*tasks)


async def test_a_reading_page_on_an_lti1p1_course_reaches_the_lms():
    with _patch_realtime("1.1") as (_, push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        await _drain()

    push11.assert_awaited_once()
    assignment, course_id, updates = push11.await_args.args
    assert (assignment.id, course_id, updates) == (42, 5, [(7, 3.0)])


async def test_the_student_does_not_wait_for_the_lms():
    """Scheduling returns before the blocking replaceResult POST is made."""
    with _patch_realtime("1.1", debounce=30.0) as (_, push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        push11.assert_not_awaited()
        # The score is queued and something is on the hook to send it.
        assert lti_push._pending_scores[(5, 42, 7)] == 3.0
        assert (5, 42, 7) in lti_push._flush_tasks
        lti_push._flush_tasks[(5, 42, 7)].cancel()


async def test_a_burst_of_answers_produces_one_push_with_the_latest_total():
    """A student working quickly should not generate a POST per answer."""
    with _patch_realtime("1.1") as (_, push11):
        for score in (1.0, 2.0, 3.0, 4.0):
            await lti_push.schedule_lti1p1_score_push(7, 5, 42, score)
        await _drain()

    push11.assert_awaited_once()
    assert push11.await_args.args[2] == [(7, 4.0)]


async def test_different_students_are_pushed_independently():
    with _patch_realtime("1.1") as (_, push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        await lti_push.schedule_lti1p1_score_push(8, 5, 42, 9.0)
        await _drain()

    assert push11.await_count == 2
    assert sorted(c.args[2][0] for c in push11.await_args_list) == [(7, 3.0), (8, 9.0)]


async def test_an_lti1p3_course_is_left_to_the_1p3_push():
    with _patch_realtime("1.3") as (_, push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        await _drain()

    push11.assert_not_awaited()


async def test_a_course_with_no_lms_pushes_nothing():
    with _patch_realtime(None) as (_, push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        await _drain()

    push11.assert_not_awaited()


async def test_the_version_lookup_is_cached_across_events():
    """The two-query lookup must not be paid on every scored answer."""
    with _patch_realtime("1.1") as (version_lookup, _):
        for _i in range(5):
            await lti_push.schedule_lti1p1_score_push(7, 5, 42, 1.0)
        await _drain()

    version_lookup.assert_awaited_once()


async def test_a_stale_version_cache_entry_is_refreshed():
    with _patch_realtime("1.1", debounce=0.0) as (version_lookup, _):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 1.0)
        await _drain()
        # Age the cached answer past its TTL.
        version, cached_at = lti_push._version_cache[5]
        lti_push._version_cache[5] = (
            version,
            cached_at - lti_push.LTI_VERSION_CACHE_SECONDS - 1,
        )
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 2.0)
        await _drain()

    assert version_lookup.await_count == 2


async def test_a_failing_push_is_logged_and_does_not_escape():
    """An LMS outage must not surface as an unhandled background exception."""
    with _patch_realtime("1.1") as (_, push11):
        push11.side_effect = RuntimeError("LMS is down")
        with patch.object(lti_push.rslogger, "error") as log_error:
            await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
            await _drain()

    log_error.assert_called_once()
    assert "LMS is down" in log_error.call_args.args[0]


async def test_the_queue_and_task_table_do_not_leak():
    with _patch_realtime("1.1") as (_, _push11):
        await lti_push.schedule_lti1p1_score_push(7, 5, 42, 3.0)
        await _drain()

    assert lti_push._pending_scores == {}
    assert lti_push._flush_tasks == {}
