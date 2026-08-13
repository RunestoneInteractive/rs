import datetime

import aiohttp
from typing import List, Tuple

from rsptx.db.crud import (
    fetch_all_grades_for_assignment,
    fetch_lti1p3_grading_data_for_assignment,
    fetch_all_course_attributes,
    fetch_lti1p3_user,
    fetch_lti1p3_users_for_course,
)

from rsptx.db.models import Assignment, Courses, Lti1p3Assignment, Lti1p3User
from rsptx.logging import rslogger

from rsptx.lti1p3.tool_conf_rs import ToolConfRS
from rsptx.lti1p3.pylti1p3.grade import Grade
from rsptx.lti1p3.pylti1p3.lineitem import LineItem
from rsptx.lti1p3.pylti1p3.service_connector import ServiceConnector
from rsptx.lti1p3.pylti1p3.assignments_grades import AssignmentsGradesService


def get_assignment_score_resource_id(course, assignment):
    """
    Generate an identifier combining a course and assignment id.
    """
    return f"{course.id}_{assignment.id}"


def parse_assignment_score_resource_id(resource_id):
    """
    Parse the resource id back into course and assignment id.
    """
    parts = resource_id.split("_")
    return (int(parts[0]), int(parts[1]))


def update_line_item_from_assignment(
    line_item: LineItem,
    rs_assignment: Assignment,
    rs_course: Courses,
    use_pts: bool = False,
    push_duedate: bool = False,
) -> LineItem:
    """
    Update a LineItem with information from a Runestone assignment
    """
    line_item.set_label(rs_assignment.name)
    line_item.set_resource_id(
        get_assignment_score_resource_id(rs_course, rs_assignment)
    )
    if push_duedate:
        # duedate is stored as naive UTC. Send it with an explicit offset,
        # matching the format time_now() uses -- without one the LMS is free to
        # read it as its own local time and silently shift the deadline.
        line_item.set_end_date_time(
            rs_assignment.duedate.replace(tzinfo=datetime.timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
    line_item.set_tag("grade")
    line_item.set_score_maximum(rs_assignment.points if use_pts else 100)
    return line_item


def time_now() -> str:
    """
    Get current time formatted the way LTI spec expects it.
    """
    return _format_lti_timestamp(datetime.datetime.now(datetime.timezone.utc))


def _format_lti_timestamp(value: datetime.datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=datetime.timezone.utc)
    else:
        value = value.astimezone(datetime.timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _submitted_at_for_score(
    rs_assignment: Assignment, score_timestamp: str, instructor_triggered: bool
) -> str:
    if not instructor_triggered:
        return score_timestamp
    if rs_assignment.duedate is None:
        return score_timestamp
    return _format_lti_timestamp(rs_assignment.duedate - datetime.timedelta(minutes=1))


async def attempt_lti1p3_score_update(
    rs_user_id: int,
    rs_assign_id: int,
    score: float,
    force: bool = False,
    instructor_triggered: bool = False,
):
    """
    Attempt to send a score update to any linked LTI 1.3 tools for a given user and assignment.
    Will return early if no LTI 1.3 data is found for the assignment.

    :param rs_user_id: The Runestone user id
    :param rs_assign_id: The Runestone assignment id
    :param score: The score to send
    :param force: If True, will send the score even if the grades are not yet released in RS or the course is set to not auto-update grades
    :param instructor_triggered: If True, report submission.submittedAt as just before the assignment deadline.
    """
    rslogger.debug("LTI1p3 - attempt_lti1p3_score_update")
    lti_assign = await fetch_lti1p3_grading_data_for_assignment(rs_assign_id)
    if not lti_assign:
        return
    rslogger.debug(f"LTI1p3 - {lti_assign.rs_assignment_id}")

    updates = [
        (await fetch_lti1p3_user(rs_user_id, lti_assign.lti1p3_course.id), score)
    ]
    await _send_lti1p3_score_updates(
        lti_assign=lti_assign,
        updates=updates,
        force=force,
        instructor_triggered=instructor_triggered,
    )


async def attempt_lti1p3_score_updates(
    rs_assign_id: int, force: bool = False, instructor_triggered: bool = False
):
    """
    Attempt to send a score update to any linked LTI 1.3 tools for a given assignment.
    Will return early if no LTI 1.3 data is found for the assignment.

    :param rs_assign_id: The Runestone assignment id
    :param force: If True, will send the score even if the grades are not yet released in RS or the course is set to not auto-update grades
    :param instructor_triggered: If True, report submission.submittedAt as just before the assignment deadline.
    """
    rslogger.debug("LTI1p3 - attempt_lti1p3_score_updates")
    lti_assign = await fetch_lti1p3_grading_data_for_assignment(rs_assign_id)
    if not lti_assign:
        return

    all_users = await fetch_lti1p3_users_for_course(lti_assign.lti1p3_course.id)
    all_grades_list = await fetch_all_grades_for_assignment(rs_assign_id)
    grades_dict = {g.auth_user: g.score for g in all_grades_list if g.score is not None}

    updates = []
    for u in all_users:
        if u.rs_user_id in grades_dict:
            updates.append((u, grades_dict[u.rs_user_id]))

    # updates = [(u, grades_dict.get(u.rs_user_id)) for u in all_users if u.rs_user_id in grades_dict]
    await _send_lti1p3_score_updates(
        lti_assign=lti_assign,
        updates=updates,
        force=force,
        instructor_triggered=instructor_triggered,
    )


async def attempt_lti1p3_score_updates_for(
    rs_assign_id: int,
    updates: List[Tuple[int, float]],
    force: bool = False,
    instructor_triggered: bool = False,
):
    """
    Attempt to send score updates for an explicit set of users.

    Unlike :func:`attempt_lti1p3_score_updates`, which pushes every graded
    student on the assignment, this sends only the users named in ``updates``
    -- while still resolving the assignment's grading data (and therefore the
    OAuth token and HTTP session) once for the whole batch rather than once per
    student, as repeated :func:`attempt_lti1p3_score_update` calls would.

    :param rs_assign_id: The Runestone assignment id
    :param updates: List of tuples (rs_user_id, score) to send
    :param force: If True, will send the score even if the grades are not yet released in RS or the course is set to not auto-update grades
    :param instructor_triggered: If True, report submission.submittedAt as just before the assignment deadline.
    """
    rslogger.debug("LTI1p3 - attempt_lti1p3_score_updates_for")
    if not updates:
        return
    lti_assign = await fetch_lti1p3_grading_data_for_assignment(rs_assign_id)
    if not lti_assign:
        return

    resolved = []
    for rs_user_id, score in updates:
        lti_user = await fetch_lti1p3_user(rs_user_id, lti_assign.lti1p3_course.id)
        resolved.append((lti_user, score))

    await _send_lti1p3_score_updates(
        lti_assign=lti_assign,
        updates=resolved,
        force=force,
        instructor_triggered=instructor_triggered,
    )


async def _send_lti1p3_score_updates(
    lti_assign: Lti1p3Assignment,
    updates: List[Tuple[Lti1p3User, int]],
    force: bool = False,
    instructor_triggered: bool = False,
):
    """
    Attempt to send a set of 1+ updates to any linked LTI 1.3 tools for a given assignment.

    :param lti_assign: The Lti1p3Assignment object - must have the LTI 1.3 course and rs assignment linked. LTIcourse should have rs_course and lti_config linked.
    :param updates: List of tuples (Lti1p3User, score) to send
    :param force: If True, will send the score even if the grades are not yet released in RS or the course is set to not auto-update grades
    :param instructor_triggered: If True, set submission.submittedAt just before the assignment deadline so LMS late policies don't mark instructor-entered grades late.
    """
    rslogger.debug(f"LTI1p3 - _send_lti1p3_score_updates {updates}")

    # Alias some of the linked data for easier access
    rs_course = lti_assign.lti1p3_course.rs_course
    rs_assignment = lti_assign.rs_assignment

    course_attributes = await fetch_all_course_attributes(rs_course.id)

    # Check if we should be sending the score yet
    if (
        not rs_assignment.released
        or course_attributes.get("no_lti_auto_grade_update") == "true"
    ) and not force:
        return

    # Check if we should be using points or percentages, determine max_score
    use_pts = course_attributes.get("show_points") == "true"
    max_score = rs_assignment.points
    if not use_pts:
        max_score = 100

    try:
        async with aiohttp.ClientSession() as session:
            # Get the LTI 1.3 registration data for the course and make a service connector
            lti_conf = lti_assign.lti1p3_course.lti_config
            reg = ToolConfRS.registration_from_lti_config(lti_conf)
            sc = ServiceConnector(reg, session)

            # Set up the AGS service
            service_data = {
                "lineitem": lti_assign.lti_lineitem_id,
                "scope": [
                    "https://purl.imsglobal.org/spec/lti-ags/scope/score",
                    "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
                    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
                    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
                ],
            }
            ags = AssignmentsGradesService(sc, service_data)

            # Update the line item to ensure the LMS assignment shows the right max score
            line_item = LineItem().set_id(lti_assign.lti_lineitem_id)
            update_line_item_from_assignment(
                line_item, rs_assignment, rs_course, use_pts
            )

            rslogger.debug(
                f"LTI1p3 - Update LineItem {lti_assign.lti_lineitem_id} for assignment {rs_assignment.id}"
            )
            try:
                await ags.update_lineitem(line_item)
            except Exception as e:
                rslogger.error(f"LTI1p3 - update_lineitem failed: {e}")

            for lti_user, score in updates:
                # A student with no LTI mapping in this course (never launched
                # through the LMS, or enrolled directly) has no user id to send
                # to. Skip them rather than dereferencing None -- this used to
                # raise out to the handler below and abandon every remaining
                # user in the batch.
                if lti_user is None:
                    rslogger.warning(
                        f"LTI1p3 - skipping score update on assignment "
                        f"{rs_assignment.id}: no LTI user mapping for this student"
                    )
                    continue

                rslogger.debug(
                    f"LTI1p3 - Sending LTI grade update for RS user id {lti_user.rs_user_id} on assignment {rs_assignment.id}, score {score}"
                )

                if not use_pts:
                    # An assignment worth 0 points has no percentage to express;
                    # sending a raw score against a max of 100 would be wrong, so
                    # report it and move on.
                    if not rs_assignment.points:
                        rslogger.warning(
                            f"LTI1p3 - skipping score update for RS user id "
                            f"{lti_user.rs_user_id}: assignment {rs_assignment.id} "
                            f"is worth 0 points, cannot compute a percentage"
                        )
                        continue
                    score = score / rs_assignment.points * 100

                # The total is the raw sum of question_grades, which exceeds the
                # assignment's points whenever its questions add up to more than
                # assignment.points. The LMS rejects scoreGiven > scoreMaximum
                # with a 422, so clamp and say so -- the underlying mismatch is
                # an authoring problem to fix on the assignment, not here.
                if max_score is not None and score > max_score:
                    rslogger.warning(
                        f"LTI1p3 - clamping score {score} to {max_score} for RS "
                        f"user id {lti_user.rs_user_id} on assignment "
                        f"{rs_assignment.id}; the computed total exceeds the "
                        f"assignment's points"
                    )
                    score = max_score

                # Send the grade
                score_timestamp = time_now()
                submitted_at = _submitted_at_for_score(
                    rs_assignment, score_timestamp, instructor_triggered
                )
                g = (
                    Grade()
                    .set_score_given(score)
                    .set_score_maximum(max_score)
                    .set_user_id(lti_user.lti_user_id)
                    .set_timestamp(score_timestamp)
                    .set_activity_progress("Completed")
                    .set_grading_progress("FullyGraded")
                    .set_extra_claims({"submission": {"submittedAt": submitted_at}})
                )
                try:
                    _ = await ags.put_grade(g, line_item)
                except Exception as e:
                    rslogger.error(
                        f"LTI1p3 - put_grade failed: {e}. RS user id {lti_user.rs_user_id} on assignment {rs_assignment.id}, score {score}."
                    )
    except Exception as e:
        rslogger.error(f"LTI1p3 - grade update failed: {e}")
