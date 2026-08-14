# *********************************************************
# |docname| - Version-aware LTI grade passback for grading
# *********************************************************
#
# The grading paths should not care which LTI version a course is linked to.
# This dispatches a batch of scores to whichever service the course actually
# uses, resolving the version once per batch rather than once per student.

from typing import List, Optional, Tuple

from rsptx.db.crud import fetch_lti_version
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
