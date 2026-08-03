"""LTI 1.3 score push robustness.

``_send_lti1p3_score_updates`` runs on every manual grade now that POST /grade
rolls totals up, so a single malformed update must not cost the rest of the
batch. These pin the three ways it used to go wrong: a student with no LTI
mapping, an assignment worth zero points, and a computed total larger than the
assignment's points (which the LMS rejects with a 422).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rsptx.lti1p3 import core

pytestmark = pytest.mark.asyncio


def _lti_user(rs_user_id=1, lti_user_id="lms-user-1"):
    return SimpleNamespace(rs_user_id=rs_user_id, lti_user_id=lti_user_id)


def _lti_assign(points=10, released=True):
    rs_course = SimpleNamespace(id=1, course_name="course1", timezone="UTC")
    rs_assignment = SimpleNamespace(
        id=7, name="Homework 1", duedate=None, points=points, released=released
    )
    return SimpleNamespace(
        lti_lineitem_id="https://lms.example/lineitems/1",
        rs_assignment=rs_assignment,
        lti1p3_course=SimpleNamespace(
            id=3, rs_course=rs_course, lti_config=SimpleNamespace()
        ),
    )


async def _send(updates, lti_assign=None, show_points="true"):
    """Drive _send_lti1p3_score_updates and report the grades it sent.

    Returns the list of (user_id, score_given, score_maximum) actually handed to
    put_grade, so a skipped update is visibly absent rather than merely unasserted.
    """
    lti_assign = lti_assign or _lti_assign()
    sent = []

    async def fake_put_grade(grade, line_item):
        sent.append(
            (
                grade.get_user_id(),
                grade.get_score_given(),
                grade.get_score_maximum(),
            )
        )
        return {}

    ags = MagicMock()
    ags.update_lineitem = AsyncMock()
    ags.put_grade = AsyncMock(side_effect=fake_put_grade)

    with (
        patch.object(
            core,
            "fetch_all_course_attributes",
            AsyncMock(return_value={"show_points": show_points}),
        ),
        patch.object(core, "aiohttp"),
        patch.object(core, "ToolConfRS"),
        patch.object(core, "ServiceConnector"),
        patch.object(core, "AssignmentsGradesService", return_value=ags),
    ):
        await core._send_lti1p3_score_updates(lti_assign, updates)

    return sent


async def test_a_user_with_no_lti_mapping_is_skipped_not_fatal():
    """fetch_lti1p3_user returns None for a student who never launched through
    the LMS. That used to raise and abandon everyone after them in the batch."""
    sent = await _send([(None, 5), (_lti_user(2, "lms-user-2"), 8)])

    # The mapped user still got their score -- the batch survived.
    assert sent == [("lms-user-2", 8, 10)]


async def test_every_user_after_an_unmapped_one_still_sends():
    updates = [
        (_lti_user(1, "u1"), 1),
        (None, 2),
        (_lti_user(3, "u3"), 3),
        (None, 4),
        (_lti_user(5, "u5"), 5),
    ]
    sent = await _send(updates)

    assert [s[0] for s in sent] == ["u1", "u3", "u5"]


async def test_zero_point_assignment_does_not_divide_by_zero(caplog):
    """With percentage reporting, a 0-point assignment has no percentage to
    express; it must be skipped rather than raising ZeroDivisionError.

    Asserting only that nothing was sent would pass either way -- the outer
    handler swallows the ZeroDivisionError and sends nothing too. What
    distinguishes a clean skip is that the error handler never fires.
    """
    with caplog.at_level("WARNING"):
        sent = await _send(
            [(_lti_user(), 0)], lti_assign=_lti_assign(points=0), show_points="false"
        )

    assert sent == []
    assert "is worth 0 points" in caplog.text
    assert "grade update failed" not in caplog.text


async def test_zero_point_assignment_does_not_stop_the_batch(caplog):
    with caplog.at_level("WARNING"):
        sent = await _send(
            [(_lti_user(1, "u1"), 0), (_lti_user(2, "u2"), 0)],
            lti_assign=_lti_assign(points=0),
            show_points="false",
        )

    assert sent == []
    # Both users were reached: the loop ran to completion rather than dying on
    # the first one and skipping the rest.
    assert caplog.text.count("is worth 0 points") == 2
    assert "grade update failed" not in caplog.text


async def test_score_above_the_maximum_is_clamped():
    """The total is the raw sum of question_grades, which can exceed the
    assignment's points. Sending scoreGiven > scoreMaximum earns a 422."""
    sent = await _send([(_lti_user(), 14)])

    assert sent == [("lms-user-1", 10, 10)]


async def test_a_score_within_the_maximum_is_untouched():
    sent = await _send([(_lti_user(), 7)])

    assert sent == [("lms-user-1", 7, 10)]


async def test_percentage_mode_clamps_at_one_hundred():
    """In percentage mode the maximum is 100, so an over-points total must land
    at 100 rather than something like 140."""
    sent = await _send([(_lti_user(), 14)], show_points="false")

    assert sent == [("lms-user-1", 100, 100)]


async def test_percentage_mode_converts_a_normal_score():
    sent = await _send([(_lti_user(), 5)], show_points="false")

    assert sent == [("lms-user-1", 50.0, 100)]
