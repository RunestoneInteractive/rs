"""Unit tests for the version-aware LTI grade passback dispatcher.

Grading used to call the LTI 1.3 push directly, so a course linked over LTI 1.1
never received a score from a regrade, recompute, or manual override.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

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
