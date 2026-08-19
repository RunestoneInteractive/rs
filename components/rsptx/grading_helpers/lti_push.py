# *********************************************************
# |docname| - Version-aware LTI grade passback for grading
# *********************************************************
#
# The grading paths should not care which LTI version a course is linked to.
# This dispatches a batch of scores to whichever service the course actually
# uses, resolving the version once per batch rather than once per student.
#
# Two entry points, with deliberately different trade-offs:
#
# * :func:`attempt_lti_score_updates` -- instructor-triggered batches (regrade,
#   recompute totals, manual override). Resolves the version fresh every time
#   and awaits the send, so the instructor's request does not return until the
#   LMS has the scores.
# * :func:`schedule_lti1p1_score_push` -- real-time student activity. Runs on
#   the hottest path in the system, so it leans on a cached version lookup and
#   hands the (blocking) 1.1 outcomes POST to a debounced background task.

import asyncio
import time
from typing import Dict, List, Optional, Tuple

from rsptx.db.crud import fetch_lti_version, fetch_one_assignment
from rsptx.db.models import AssignmentValidator
from rsptx.logging import rslogger
from rsptx.lti1p1.core import attempt_lti1p1_score_updates
from rsptx.lti1p3.core import attempt_lti1p3_score_updates_for


async def attempt_lti_score_updates(
    assignment: AssignmentValidator,
    course_id: int,
    updates: List[Tuple[int, Optional[float]]],
    force: bool = False,
    instructor_triggered: bool = False,
) -> None:
    """Push a batch of ``(rs_user_id, score)`` updates to the course's LMS.

    Courses linked over LTI 1.1 used to be ignored by every grading path: the
    only ``replaceResult`` Runestone ever sent was on the student's first launch
    of a released assignment, so a later regrade or manual override never
    reached the LMS.

    ``fetch_lti_version`` costs two queries, and the 1.1/1.3 implementations
    each resolve their per-course credentials once, so callers should hand over
    the whole set of changed students in one call instead of looping.

    The version is looked up fresh here rather than through
    :func:`_cached_lti_version`: these callers are instructor-triggered and
    rare, and an instructor who has just linked a course should not have to wait
    out a cache TTL to see grades move.

    :param assignment: the assignment being graded
    :param course_id: the Runestone course id the assignment belongs to
    :param updates: list of ``(rs_user_id, score)`` pairs to send
    :param force: send even if grades are unreleased or auto-update is off
    :param instructor_triggered: report the score as submitted before the
        deadline so LMS late policies do not penalize an instructor's entry
        (LTI 1.3 only -- the 1.1 outcomes service carries no submission time)
    """
    if not updates:
        return

    version = await fetch_lti_version(course_id)
    rslogger.debug(
        f"LTI - {len(updates)} score update(s) for assignment {assignment.id}, "
        f"course {course_id} is LTI {version}"
    )
    if version == "1.1":
        await attempt_lti1p1_score_updates(assignment, course_id, updates, force=force)
    elif version == "1.3":
        await attempt_lti1p3_score_updates_for(
            assignment.id,
            updates,
            force=force,
            instructor_triggered=instructor_triggered,
        )


# Real-time passback for LTI 1.1
# ==============================
#
# ``compute_total_score`` runs on every scored student answer and every
# completed reading page, and it used to push to LTI 1.3 only -- so a 1.1 course
# saw a student's total move in Runestone but not in the LMS until an instructor
# ran a recompute. Two things kept 1.1 off that path, and both are handled here
# rather than by skipping the push:
#
# 1. ``fetch_lti_version`` costs two queries per event. The answer changes only
#    when a course is linked to or unlinked from an LMS, so it is cached per
#    course with a short TTL.
# 2. The 1.1 ``replaceResult`` POST is blocking (oauth2/httplib2 under
#    ``asyncio.to_thread``) and talks to a third-party LMS. Making a student's
#    save wait on it would be unacceptable, so it is dispatched off the request
#    path and debounced: a student working quickly through a page produces one
#    POST carrying the latest total, not one per answer.

#: How long a cached "which LTI version is this course?" answer stays good.
#: Short enough that newly linked courses start pushing on their own.
LTI_VERSION_CACHE_SECONDS = 300.0

#: How long to wait for a student's score to settle before pushing it. Sends for
#: one (course, assignment, student) are coalesced within this window.
LTI1P1_DEBOUNCE_SECONDS = 5.0

# course_id -> (version, monotonic timestamp of the lookup)
_version_cache: Dict[int, Tuple[Optional[str], float]] = {}

# (course_id, assignment_id, rs_user_id) -> most recent total awaiting a push
_pending_scores: Dict[Tuple[int, int, int], Optional[float]] = {}

# The same key -> the task that will flush it. Also the strong reference that
# keeps the task from being garbage collected mid-flight.
_flush_tasks: Dict[Tuple[int, int, int], asyncio.Task] = {}


async def _cached_lti_version(course_id: int) -> Optional[str]:
    """``fetch_lti_version`` with a short per-course TTL cache.

    Only for the real-time path, where the two-query lookup would otherwise be
    paid on every scored answer. The cache is per process, so each worker warms
    its own copy and a stale entry costs at most
    :data:`LTI_VERSION_CACHE_SECONDS` of missed (or wasted) pushes.
    """
    cached = _version_cache.get(course_id)
    now = time.monotonic()
    if cached is not None and now - cached[1] < LTI_VERSION_CACHE_SECONDS:
        return cached[0]

    version = await fetch_lti_version(course_id)
    _version_cache[course_id] = (version, now)
    return version


async def schedule_lti1p1_score_push(
    rs_user_id: int,
    course_id: int,
    assignment_id: int,
    score: Optional[float],
) -> None:
    """Queue a real-time LTI 1.1 push for one student's assignment total.

    Returns as soon as the score is recorded -- the LMS round trip happens in a
    background task after :data:`LTI1P1_DEBOUNCE_SECONDS` of quiet. Repeated
    calls for the same student and assignment replace the pending score instead
    of queueing another POST.

    Does nothing for courses that are not linked over LTI 1.1; LTI 1.3 courses
    are served by ``attempt_lti1p3_score_update`` on the same path, which is
    already non-blocking enough to await inline.

    Nothing is retried: a push lost to an LMS outage or a server restart is
    repaired by the instructor's recompute, which resends every changed total.
    """
    if await _cached_lti_version(course_id) != "1.1":
        return

    key = (course_id, assignment_id, rs_user_id)
    # No await between here and the task check, so a concurrent caller cannot
    # slip in and leave a pending score with nothing scheduled to flush it.
    _pending_scores[key] = score
    if key not in _flush_tasks:
        _flush_tasks[key] = asyncio.create_task(_flush_pending_score(key))


async def _flush_pending_score(key: Tuple[int, int, int]) -> None:
    """Wait for the debounce window, then push the latest score for ``key``.

    Loops rather than exiting after one send so that scores arriving *during* a
    send are picked up by the same task: pushes for one student stay serialized,
    and the LMS never receives an older total after a newer one.
    """
    course_id, assignment_id, rs_user_id = key
    try:
        while key in _pending_scores:
            await asyncio.sleep(LTI1P1_DEBOUNCE_SECONDS)
            score = _pending_scores.pop(key, None)
            try:
                assignment = await fetch_one_assignment(assignment_id)
                await attempt_lti1p1_score_updates(
                    assignment, course_id, [(rs_user_id, score)]
                )
            except Exception as e:
                # A background task's exception would otherwise surface only
                # when the task is garbage collected.
                rslogger.error(
                    f"LTI1.1 - real-time score push failed for user {rs_user_id} "
                    f"on assignment {assignment_id}: {e}"
                )
    finally:
        # Runs with no await since the last loop check, so a caller that sees
        # the key absent from _flush_tasks also sees it absent from
        # _pending_scores and will schedule a fresh task.
        _flush_tasks.pop(key, None)
