from datetime import datetime
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
    # course_name is the student's *active* course, which is deliberately not the
    # course being regraded -- the roster comes from user_courses, so it includes
    # students who have since moved on. See test_rollup_uses_the_graded_course.
    return [
        SimpleNamespace(id=i, username=u, course_name="nextterm")
        for i, u in enumerate(usernames, 1)
    ]


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


async def test_batch_rollup_passes_the_graded_course_not_the_active_one():
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
            dry_run=False,
        )
    # The third argument is the course whose question_grades get rolled up. It
    # must be the course being regraded, not user.course_name ("nextterm").
    assert recompute.await_args.args[2] == "testcourse"


async def test_rollup_uses_the_graded_course():
    """Regression test: a student whose active course has moved on still gets a
    correct total.

    ``fetch_users_for_course`` reads the roster from ``user_courses``, so it
    returns students whose ``auth_user.course_name`` points at a different
    course. Rolling the total up against that active course matched no
    ``question_grades`` rows and wrote a 0 over a correct set of question
    scores -- visible on timed exams in particular, since they are excluded from
    real-time scoring and so only ever get a total from this path.
    """
    user = _users("student1")[0]
    assignment = _assignment()
    scores = [SimpleNamespace(score=3.0), SimpleNamespace(score=4.0)]

    with (
        patch.object(regrade, "fetch_grade", AsyncMock(return_value=None)),
        patch.object(
            regrade, "fetch_assignment_scores", AsyncMock(return_value=scores)
        ) as fetch_scores,
        patch.object(regrade, "upsert_grade", AsyncMock()) as upsert,
        patch.object(regrade, "attempt_lti1p3_score_update", AsyncMock()) as lti,
    ):
        await regrade._recompute_total_for_user(user, assignment, "testcourse")

    assert fetch_scores.await_args.args == (assignment.id, "testcourse", "student1")
    assert upsert.await_args.args[0].score == 7.0
    assert lti.await_args.args[2] == 7.0


# _effective_deadline
# -------------------
# duedate is stored as naive UTC, the same frame as the answer timestamps it is
# compared against in regrade_one. This function previously returned a
# course-local duedate that was compared straight against UTC timestamps, so
# batch regrades silently used a cutoff that was off by the course's UTC
# offset. These tests pin the frame.


def _dated_assignment(duedate):
    return SimpleNamespace(id=42, points=10, threshold_pct=None, duedate=duedate)


def test_effective_deadline_returns_the_duedate_unchanged():
    duedate = datetime(2026, 9, 2, 4, 59)
    assert regrade._effective_deadline(_dated_assignment(duedate), None) == duedate


def test_effective_deadline_applies_accommodation_days():
    duedate = datetime(2026, 9, 2, 4, 59)
    accommodation = SimpleNamespace(duedate=3)
    assert regrade._effective_deadline(
        _dated_assignment(duedate), accommodation
    ) == datetime(2026, 9, 5, 4, 59)


def test_effective_deadline_ignores_accommodation_without_extra_days():
    duedate = datetime(2026, 9, 2, 4, 59)
    for accommodation in (None, SimpleNamespace(duedate=None), SimpleNamespace()):
        assert (
            regrade._effective_deadline(_dated_assignment(duedate), accommodation)
            == duedate
        )


def test_effective_deadline_is_none_when_no_duedate():
    assert regrade._effective_deadline(_dated_assignment(None), None) is None


def test_effective_deadline_does_not_apply_a_timezone_shift():
    # Guards against reintroducing a course-local -> UTC conversion here. The
    # cutoff must be usable as-is against naive UTC answer timestamps.
    duedate = datetime(2026, 9, 2, 4, 59)
    result = regrade._effective_deadline(_dated_assignment(duedate), None)
    assert result.tzinfo is None
    assert result == duedate
