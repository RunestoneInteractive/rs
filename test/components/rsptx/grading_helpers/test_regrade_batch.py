from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from rsptx.grading_helpers import regrade
from rsptx.grading_helpers.regrade import (
    RegradeDiffItem,
    RegradeOptions,
    regrade_batch,
)


def _course():
    return SimpleNamespace(id=1, course_name="testcourse")


def _assignment():
    return SimpleNamespace(id=42, points=10, threshold_pct=None, duedate=None)


def _question():
    # regrade_one is mocked, so only the loop needs a (question, aq) tuple.
    return (SimpleNamespace(id=7, name="q1"), SimpleNamespace())


def _users(*usernames):
    return [SimpleNamespace(id=i, username=u) for i, u in enumerate(usernames, 1)]


def _patch_batch(regrade_one_return):
    """Patch the collaborators regrade_batch drives.

    ``regrade_one`` is replaced with an AsyncMock so we control the per-question
    diff, ``fetch_users_for_course`` supplies the user_map, and
    ``_recompute_total_for_user`` is a spy so tests can assert who got a fresh
    total.
    """
    return (
        patch.object(
            regrade, "regrade_one", AsyncMock(return_value=regrade_one_return)
        ),
        patch.object(
            regrade,
            "fetch_users_for_course",
            AsyncMock(return_value=_users("student1")),
        ),
        patch.object(regrade, "_recompute_total_for_user", AsyncMock()),
    )


async def test_unchanged_student_still_recomputes_total():
    # Regression test for #1309: a student whose per-question scores are already
    # correct (new_score == old_score) must still have their assignment total
    # recomputed. Timed exams are excluded from real-time scoring, so their
    # grades row can be stale at 0 even when question_grades are right; keying the
    # recompute off "changed this run" left those totals stuck.
    unchanged = RegradeDiffItem(
        sid="student1", question_id=7, div_id="q1", old_score=3.0, new_score=3.0
    )
    ro, fu, rc = _patch_batch(unchanged)
    with ro, fu, rc as recompute:
        report = await regrade_batch(
            _course(),
            ["student1"],
            [_question()],
            _assignment(),
            RegradeOptions(),
            dry_run=False,
        )

    assert report.changed == 0
    recompute.assert_awaited_once()
    # The recomputed user is the one we regraded.
    assert recompute.await_args.args[0].username == "student1"


async def test_dry_run_does_not_recompute_totals():
    unchanged = RegradeDiffItem(
        sid="student1", question_id=7, div_id="q1", old_score=3.0, new_score=3.0
    )
    ro, fu, rc = _patch_batch(unchanged)
    with ro, fu, rc as recompute:
        await regrade_batch(
            _course(),
            ["student1"],
            [_question()],
            _assignment(),
            RegradeOptions(),
            dry_run=True,
        )
    recompute.assert_not_called()


async def test_recompute_totals_option_disables_rollup():
    unchanged = RegradeDiffItem(
        sid="student1", question_id=7, div_id="q1", old_score=3.0, new_score=3.0
    )
    ro, fu, rc = _patch_batch(unchanged)
    with ro, fu, rc as recompute:
        await regrade_batch(
            _course(),
            ["student1"],
            [_question()],
            _assignment(),
            RegradeOptions(recompute_totals=False),
            dry_run=False,
        )
    recompute.assert_not_called()
