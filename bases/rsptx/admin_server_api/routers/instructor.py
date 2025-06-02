from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Request,
    status,
    Form,
)
from fastapi.responses import (
    HTMLResponse,
    RedirectResponse,
    JSONResponse,
)
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine
from pydantic import BaseModel
from typing import List, Optional, Annotated

# Local application imports
# -------------------------

from rsptx.db.crud import (
    create_invoice_request,
    delete_lti_course,
    delete_course_instructor,
    fetch_all_course_attributes,
    fetch_course,
    fetch_course_by_id,
    fetch_instructor_courses,
    fetch_users_for_course,
    create_instructor_course_entry,
    update_course_settings,
)
from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.configuration import settings
from rsptx.endpoint_validators import with_course, instructor_role_required
from rsptx.logging import rslogger


# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/instructor",
    tags=["instructor"],
)

rslogger.info("Registering instructor API routes")


@router.get("/foo")
async def foo(
    request: Request,
    response_class=JSONResponse,
):
    """
    A simple test endpoint to verify the instructor API is working.
    """
    rslogger.info("Instructor API foo endpoint called")
    rslogger.debug(f"Request.state.user: {request.state.user}")
    if not request.state.user:
        rslogger.warning("No user found in request state")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return JSONResponse(content={"message": "Instructor API is working!"})


@router.get("/menu")
@instructor_role_required()
@with_course()
async def get_instructor_menu(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the main instructor menu dashboard.
    """
    rslogger.info(f"Rendering instructor menu for course: {course.course_name}")
    templates = Jinja2Templates(directory=template_folder)
    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }

    return templates.TemplateResponse("admin/instructor/menu.html", context)


@router.get("/manage_students")
@instructor_role_required()
@with_course()
async def get_manage_students(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the student management interface.
    """
    templates = Jinja2Templates(directory=template_folder)

    # Get all students in the course
    students = {}  # This would normally be populated from the database
    # TODO: Implement actual student retrieval logic

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "students": students,
        "settings": settings,
    }

    return templates.TemplateResponse("admin/instructor/manage_students.html", context)


@router.get("/copy_assignments")
@instructor_role_required()
@with_course()
async def get_copy_assignments(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the copy assignments interface.
    """
    templates = Jinja2Templates(directory=template_folder)

    # Get instructor's available courses for copying from
    instructor_course_relationships = await fetch_instructor_courses(user.id)
    instructor_course_list = []

    # For each course where the user is an instructor, get the full course information
    for course_relation in instructor_course_relationships:
        course = await fetch_course_by_id(course_relation.course)
        if course:  # Make sure the course exists
            instructor_course_list.append(course)

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "instructor_course_list": instructor_course_list,
        "settings": settings,
    }

    return templates.TemplateResponse("admin/instructor/copy_assignments.html", context)


# TA Management endpoints
@router.post("/add_ta")
@instructor_role_required()
@with_course()
async def add_ta(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Add a student as a teaching assistant for the course.
    Expects JSON body with student_id.
    """
    try:
        data = await request.json()
        student_id = data.get("student_id")

        if not student_id:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "student_id is required"},
            )

        # Verify the student exists and is enrolled in the course
        students = await fetch_users_for_course(course.course_name)
        student_exists = any(s.id == int(student_id) for s in students)

        if not student_exists:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Student not found in course"},
            )

        # Add the student as an instructor
        await create_instructor_course_entry(int(student_id), course.id)

        return JSONResponse(
            content={
                "success": True,
                "message": "Teaching Assistant added successfully",
            }
        )

    except Exception as e:
        rslogger.error(f"Error adding TA: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


@router.post("/remove_ta")
@instructor_role_required()
@with_course()
async def remove_ta(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Remove a teaching assistant from the course.
    Expects JSON body with instructor_id.
    """
    try:
        data = await request.json()
        instructor_id = data.get("instructor_id")

        if not instructor_id:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "instructor_id is required"},
            )

        await delete_course_instructor(course.id, int(instructor_id))

        return JSONResponse(
            content={
                "success": True,
                "message": "Teaching Assistant removed successfully",
            }
        )

    except Exception as e:
        rslogger.error(f"Error removing TA: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


# Course Settings endpoint
@router.post("/update_course_setting")
@instructor_role_required()
@with_course()
async def update_course_setting(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Update a course setting/attribute.
    Expects JSON body with setting and value.
    """
    try:
        data = await request.json()
        setting = data.get("setting")
        value = data.get("value")

        if not setting or value is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "setting and value are required"},
            )

        try:
            await update_course_settings(course.id, setting, value)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Invalid date format",
                },
            )

        return JSONResponse(
            content={"success": True, "message": "Setting updated successfully"}
        )

    except Exception as e:
        rslogger.error(f"Error updating course setting: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


@router.get("/course_settings")
@instructor_role_required()
@with_course()
async def get_course_settings(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the course settings interface.
    """
    templates = Jinja2Templates(directory=template_folder)

    # Get all course attributes
    course_attrs = await fetch_all_course_attributes(course.id)

    # Format the start date for display
    start_date = ""
    if course.term_start_date:
        start_date = course.term_start_date.strftime("%Y-%m-%d")

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
        "start_date": start_date,
        "downloads_enabled": str(course.downloads_enabled).lower() if course.downloads_enabled is not None else "false",
        "allow_pairs": str(course.allow_pairs).lower() if course.allow_pairs is not None else "false",
        "enable_compare_me": course_attrs.get("enable_compare_me", "false"),
        "show_points": course_attrs.get("show_points") == "true",
        "groupsize": course_attrs.get("groupsize", "3"),
    }

    return templates.TemplateResponse("admin/instructor/course_settings.html", context)

