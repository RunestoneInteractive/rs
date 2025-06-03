# ********************************
# |docname| - Create a course page
# ********************************
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------


# Third-party imports
# -------------------
from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates

# Local application imports
# -------------------------

from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.db.crud import (
    fetch_assignments,
    fetch_all_assignment_stats,
    fetch_course,
    fetch_courses_for_user,
    fetch_course_instructors,
    fetch_deadline_exception,
    fetch_last_page,
    fetch_library_book,
    update_user,
    fetch_lti_version,
)
from rsptx.logging import rslogger
from rsptx.response_helpers.core import make_json_response
from rsptx.auth.session import is_instructor
from rsptx.grading_helpers.core import adjust_deadlines


# .. _APIRouter config:
#
# Routing
# =======
# Setup the router object for the endpoints defined in this file.  These will
# be `connected <included routing>` to the main application in `../main.py`.
router = APIRouter(
    # shortcut so we don't have to repeat this part
    prefix="/course",
    tags=["course"],
)


@router.api_route("/index", methods=["GET", "POST"])
async def index(request: Request, user=Depends(auth_manager)):
    """Fetch current course information
       Fetch current assignment information

    :param request: _description_
    :type request: Request
    """
    course_name = user.course_name
    course = await fetch_course(course_name)
    instructors = await fetch_course_instructors(course_name)
    rslogger.debug(f"{instructors=}")
    templates = Jinja2Templates(directory=template_folder)
    books = await fetch_library_book(course.base_course)
    if books is None:
        books = []
    else:
        books = [books]
    row = await fetch_last_page(user, course_name)
    if row:
        last_page_url = row.last_page_url
    else:
        last_page_url = None

    is_lti1p1_course = await fetch_lti_version(course.id) == "1.1"
    course_list = await fetch_courses_for_user(user.id)
    course_list.sort(key=lambda x: x.id, reverse=True)
    user_is_instructor = await is_instructor(request)
    if user_is_instructor:
        # if the user is an instructor, we need to show all assignments
        assignments = await fetch_assignments(course.course_name, fetch_all=True)
    else:
        assignments = await fetch_assignments(course.course_name)

    accommodations = await fetch_deadline_exception(
        course.id, user.username, fetch_all=True
    )
    # filter assignments based on deadline exceptions
    assignment_ids = [a.assignment_id for a in accommodations]
    if not user_is_instructor:
        assignments = [a for a in assignments if a.visible or a.id in assignment_ids]
    assignments = adjust_deadlines(assignments, accommodations)
    assignments.sort(key=lambda x: x.duedate, reverse=True)
    stats_list = await fetch_all_assignment_stats(course_name, user.id)
    stats = {}
    for s in stats_list:
        stats[s.assignment] = s
    rslogger.debug(f"stats: {stats}")
    return templates.TemplateResponse(
        "book/course/current_course.html",
        {
            "assignment_list": assignments,
            "stats": stats,
            "course": course,
            "user": user,
            "request": request,
            "institution": course.institution,
            "instructor_list": instructors,
            "base_course": course.base_course,
            "book_list": books,
            "lastPageUrl": last_page_url,
            "student_page": True,
            "course_list": course_list,
            "is_instructor": user_is_instructor,
            "has_discussion_group": any([book.social_url for book in books]),
            "lti1p1": is_lti1p1_course,
        },
    )


@router.api_route("/changeCourse/{course_name:str}", methods=["GET", "POST"])
async def change_course(request: Request, course_name: str, user=Depends(auth_manager)):
    """Change the current course"""
    course = await fetch_course(course_name)
    d = {"course_name": course_name, "course_id": course.id}
    await update_user(user.id, d)
    return make_json_response(detail={"status": "success"})
