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
    assert lti.await_args.kwargs == {"instructor_triggered": False}


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


# ---------------------------------------------------------------------------
# recompute_totals_detail -- reports what moved, and writes nothing on a dry run
#
# The dry-run path backs `rsmanage fixtotals --dry-run`, so it must produce the
# same numbers a real run would while leaving the grades table untouched.
# ---------------------------------------------------------------------------


def _patch_rollup(grade, question_scores):
    """Patch what _recompute_total_for_user reads and writes.

    ``grade`` is the existing grades row (or None), ``question_scores`` the
    per-question scores that should roll up into the total.
    """
    return (
        patch.object(
            regrade,
            "fetch_users_for_course",
            AsyncMock(return_value=_users("student1")),
        ),
        patch.object(regrade, "fetch_grade", AsyncMock(return_value=grade)),
        patch.object(
            regrade,
            "fetch_assignment_scores",
            AsyncMock(return_value=[SimpleNamespace(score=s) for s in question_scores]),
        ),
        patch.object(regrade, "upsert_grade", AsyncMock()),
        patch.object(regrade, "attempt_lti1p3_score_update", AsyncMock()),
    )


async def test_dry_run_reports_the_change_without_writing():
    stale = SimpleNamespace(score=0, manual_total=False)
    fu, fg, fs, up, lti = _patch_rollup(stale, [4, 3])
    with fu, fg, fs, up as upsert, lti as push:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], dry_run=True
        )

    assert len(changes) == 1
    assert changes[0].sid == "student1"
    assert changes[0].old_score == 0
    assert changes[0].new_score == 7
    assert changes[0].changed
    # Nothing persisted, and no score pushed to the LMS.
    upsert.assert_not_awaited()
    push.assert_not_awaited()


async def test_real_run_writes_and_pushes_the_new_total():
    stale = SimpleNamespace(score=0, manual_total=False)
    fu, fg, fs, up, lti = _patch_rollup(stale, [4, 3])
    with fu, fg, fs, up as upsert, lti as push:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"]
        )

    assert changes[0].new_score == 7
    upsert.assert_awaited_once()
    push.assert_awaited_once()


async def test_dry_run_leaves_a_pinned_manual_total_alone():
    pinned = SimpleNamespace(score=42, manual_total=True)
    fu, fg, fs, up, lti = _patch_rollup(pinned, [4, 3])
    with fu, fg, fs, up as upsert, lti as push:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], dry_run=True
        )

    assert changes[0].skipped_manual
    assert not changes[0].changed
    assert changes[0].new_score == 42
    upsert.assert_not_awaited()
    push.assert_not_awaited()


async def test_already_correct_total_is_not_reported_as_changed():
    current = SimpleNamespace(score=7, manual_total=False)
    fu, fg, fs, up, lti = _patch_rollup(current, [4, 3])
    with fu, fg, fs, up, lti:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], dry_run=True
        )

    assert not changes[0].changed


async def test_missing_grade_row_counts_as_a_change():
    fu, fg, fs, up, lti = _patch_rollup(None, [4, 3])
    with fu, fg, fs, up, lti:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], dry_run=True
        )

    assert changes[0].old_score is None
    assert changes[0].new_score == 7
    assert changes[0].changed


async def test_recompute_totals_for_still_returns_the_processed_count():
    """The int-returning wrapper the grader routes call is unchanged."""
    fu, fg, fs, up, lti = _patch_rollup(
        SimpleNamespace(score=0, manual_total=False), [5]
    )
    with fu, fg, fs, up, lti:
        processed = await regrade.recompute_totals_for(
            _course(), _assignment(), ["student1"]
        )

    assert processed == 1


async def test_recompute_totals_for_forwards_instructor_triggered_flag():
    fu, fg, fs, up, lti = _patch_rollup(
        SimpleNamespace(score=0, manual_total=False), [5]
    )
    with fu, fg, fs, up, lti as lti_mock:
        await regrade.recompute_totals_for(
            _course(), _assignment(), ["student1"], instructor_triggered=True
        )

    assert lti_mock.await_args.kwargs == {"instructor_triggered": True}


async def test_only_existing_skips_students_with_no_grade_row():
    """A bulk repair should not materialise a 0 for a student who never had a
    total -- that would push a fresh zero to the LMS for a non-submitter."""
    fu, fg, fs, up, lti = _patch_rollup(None, [])
    with fu, fg, fs, up as upsert, lti as push:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], only_existing=True
        )

    assert changes[0].skipped_no_grade_row
    assert not changes[0].changed
    upsert.assert_not_awaited()
    push.assert_not_awaited()


async def test_only_existing_still_repairs_a_stale_row():
    stale = SimpleNamespace(score=0, manual_total=False)
    fu, fg, fs, up, lti = _patch_rollup(stale, [4, 3])
    with fu, fg, fs, up as upsert, lti:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"], only_existing=True
        )

    assert changes[0].changed
    assert changes[0].new_score == 7
    upsert.assert_awaited_once()


async def test_missing_row_is_created_by_default():
    """Normal grading (and --create-missing) still creates the row."""
    fu, fg, fs, up, lti = _patch_rollup(None, [5])
    with fu, fg, fs, up as upsert, lti:
        changes = await regrade.recompute_totals_detail(
            _course(), _assignment(), ["student1"]
        )

    assert not changes[0].skipped_no_grade_row
    assert changes[0].new_score == 5
    upsert.assert_awaited_once()
