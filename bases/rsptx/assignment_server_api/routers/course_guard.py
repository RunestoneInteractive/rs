# ***************************************************************
# |docname| - Keep students from working an assignment in the wrong course
# ***************************************************************
#
# A student may belong to several Runestone courses at once, but only one of
# them is "active" at a time.  Direct links to an assignment (the kind an
# instructor pastes into their LMS) carry only an ``assignment_id``, so a
# student whose active course is some *other* course used to be handed the
# assignment anyway.  Their work was then recorded against the wrong course and
# silently scored zero in the course the assignment belongs to -- see
# https://github.com/RunestoneInteractive/rs/issues/1494
#
# The helpers here detect that mismatch and bounce the student to the "My
# Courses" page, which explains the problem and can switch them to the right
# course and send them back to the link they clicked.
from urllib.parse import quote

from fastapi.responses import RedirectResponse

from rsptx.db.crud import fetch_course_by_id
from rsptx.logging import rslogger


async def assignment_course_redirect(user, course, assignment, next_url: str):
    """Return a redirect when ``assignment`` does not belong to ``course``.

    :param user: the logged-in user
    :param course: the user's *active* course (a ``CoursesValidator``)
    :param assignment: the assignment they asked for
    :param next_url: where to send them once they have switched courses
    :return: a ``RedirectResponse`` to the My Courses page, or ``None`` when the
        assignment really is part of the active course and the caller should
        carry on.
    """
    if assignment.course == course.id:
        return None

    assignment_course = await fetch_course_by_id(assignment.course)
    # A dangling course id should not hand out the assignment either; fall back
    # to a name the page can still show.
    requested_course = (
        assignment_course.course_name if assignment_course else "another course"
    )
    rslogger.info(
        f"Course mismatch: {user.username} (active course {course.course_name}) "
        f"asked for assignment {assignment.id} in course {requested_course}"
    )

    return RedirectResponse(
        "/admin/auth/my_courses"
        f"?requested_course={quote(requested_course)}"
        f"&current_course={quote(course.course_name)}"
        f"&requested_assignment={quote(assignment.name or '')}"
        f"&next={quote(next_url)}"
    )
