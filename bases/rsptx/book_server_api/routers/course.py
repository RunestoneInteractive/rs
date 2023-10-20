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
from fastapi import APIRouter, Request, status
from fastapi.templating import Jinja2Templates

# Local application imports
# -------------------------
from rsptx.templates import template_folder
from rsptx.db.crud import CRUD
from rsptx.logging import rslogger
from rsptx.response_helpers.core import make_json_response


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
async def index(request: Request):
    """Fetch current course information
       Fetch current assignment information

    :param request: _description_
    :type request: Request
    """
    if not request.state.user:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED,
            detail=dict(answerDict={}, misc={}, emess="You must be logged in"),
        )
    else:
        user = request.state.user
    crud = CRUD(request.app.state.db_session)

    course_name = user.course_name
    course = await crud.fetch_course(course_name)
    instructors = await crud.fetch_course_instructors(course_name)
    rslogger.debug(f"{instructors=}")
    templates = Jinja2Templates(directory=template_folder)
    books = await crud.fetch_library_book(course.base_course)
    books = [books]
    row = await crud.fetch_last_page(user, course_name)
    if row:
        last_page_url = row.last_page_url
    else:
        last_page_url = None

    course_list = await crud.fetch_courses_for_user(user.id)
    course_list.sort(key=lambda x: x.id, reverse=True)
    user_is_instructor = await crud.is_instructor(request)
    assignments = await crud.fetch_assignments(course_name, is_visible=True)
    assignments.sort(key=lambda x: x.duedate, reverse=True)
    stats_list = await crud.fetch_all_assignment_stats(course_name, user.id)
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
        },
    )


@router.api_route("/changeCourse/{course_name:str}", methods=["GET", "POST"])
async def change_course(request: Request, course_name: str):
    """Change the current course"""
    if not request.state.user:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED,
            detail=dict(answerDict={}, misc={}, emess="You must be logged in"),
        )
    else:
        user = request.state.user

    crud = CRUD(request.app.state.db_session)
    course = await crud.fetch_course(course_name)
    d = {"course_name": course_name, "course_id": course.id}
    await crud.update_user(user.id, d)
    return make_json_response(detail={"status": "success"})
