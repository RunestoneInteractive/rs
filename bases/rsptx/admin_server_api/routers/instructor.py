from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Request,
    status,
    UploadFile,
    File,
)
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
)
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import csv
from io import StringIO

# Local application imports
# -------------------------

from rsptx.db.crud import (
    create_course_instructor,
    delete_course_instructor,
    delete_user_course_entry,
    create_user_course_entry,
    fetch_all_course_attributes,
    fetch_course,
    fetch_available_students_for_instructor_add,
    fetch_course_by_id,
    fetch_instructor_courses,
    fetch_users_for_course,
    create_instructor_course_entry,
    update_course_settings,
    fetch_timed_assessments,
    reset_student_assessment,
    delete_course_completely,
)
from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.configuration import settings
from rsptx.endpoint_validators import with_course, instructor_role_required
from rsptx.logging import rslogger
from rsptx.db.crud.user import create_user, fetch_user
from rsptx.db.models import AuthUserValidator
from rsptx.response_helpers.core import canonical_utcnow


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
    students = await fetch_users_for_course(course.course_name)

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
        temp_course = await fetch_course_by_id(course_relation.course)
        if temp_course:  # Make sure the course exists
            instructor_course_list.append(temp_course)

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
        "downloads_enabled": (
            str(course.downloads_enabled).lower()
            if course.downloads_enabled is not None
            else "false"
        ),
        "allow_pairs": (
            str(course.allow_pairs).lower()
            if course.allow_pairs is not None
            else "false"
        ),
        "enable_compare_me": course_attrs.get("enable_compare_me", "false"),
        "show_points": course_attrs.get("show_points") == "true",
        "groupsize": course_attrs.get("groupsize", "3"),
    }

    return templates.TemplateResponse("admin/instructor/course_settings.html", context)


# Assessment Reset Model
class AssessmentResetRequest(BaseModel):
    student_username: str
    assessment_name: str


@router.get("/assessment_reset")
@instructor_role_required()
@with_course()
async def get_assessment_reset(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the assessment reset interface.
    """
    templates = Jinja2Templates(directory=template_folder)

    # Get all students in the course
    students = await fetch_users_for_course(course.course_name)

    # Get all timed assessments for the course
    assessment_tuples = await fetch_timed_assessments(course.id)
    assessments = [
        {"name": name, "description": desc} for name, desc in assessment_tuples
    ]

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "students": students,
        "assessments": assessments,
        "settings": settings,
    }

    return templates.TemplateResponse("admin/instructor/assessment_reset.html", context)


@router.post("/reset_assessment")
@instructor_role_required()
@with_course()
async def post_reset_assessment(
    request: Request,
    reset_data: AssessmentResetRequest,
    user=Depends(auth_manager),
    course=None,
):
    """
    Handle the actual assessment reset operation.
    """
    try:
        # Perform the reset operation
        success = await reset_student_assessment(
            reset_data.student_username, reset_data.assessment_name, course.course_name
        )

        if success:
            return JSONResponse(
                content={
                    "success": True,
                    "message": f"Successfully reset assessment '{reset_data.assessment_name}' for student '{reset_data.student_username}'",
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "Failed to reset assessment. Please check the logs for details.",
                },
            )

    except Exception as e:
        rslogger.error(f"Error in reset_assessment endpoint: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"An error occurred: {str(e)}"},
        )


# Course Deletion Model
class CourseDeleteRequest(BaseModel):
    course_name: str
    confirmation: str


@router.get("/course_delete")
@instructor_role_required()
@with_course()
async def get_course_delete(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the course deletion interface.
    """
    try:
        # Get student count for the course
        students = await fetch_users_for_course(course.course_name)
        student_count = len(students) if students else 0

        rslogger.info(
            f"Rendering course deletion page for course: {course.course_name}"
        )
        templates = Jinja2Templates(directory=template_folder)
        context = {
            "course": course,
            "student_count": student_count,
            "user": user,
            "request": request,
            "is_instructor": True,
            "student_page": False,
            "settings": settings,
        }

        return templates.TemplateResponse(
            "admin/instructor/course_delete.html", context
        )

    except Exception as e:
        rslogger.error(f"Error in get_course_delete endpoint: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to load course deletion page: {str(e)}"
        )


@router.post("/delete_course")
@instructor_role_required()
@with_course()
async def post_delete_course(
    request: Request,
    delete_data: CourseDeleteRequest,
    user=Depends(auth_manager),
    course=None,
):
    """
    Handle the actual course deletion operation.
    """
    try:
        # Verify the course name matches
        if delete_data.course_name != course.course_name:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Course name does not match the current course",
                },
            )

        # Verify the confirmation
        if delete_data.confirmation != "DELETE":
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Invalid confirmation. Must be 'DELETE'",
                },
            )

        # Perform the course deletion
        success = await delete_course_completely(course.course_name)

        if success:
            rslogger.info(f"Successfully deleted course: {course.course_name}")
            return JSONResponse(
                content={
                    "success": True,
                    "message": f"Successfully deleted course '{course.course_name}'",
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "Failed to delete course. Please check the logs for details.",
                },
            )

    except Exception as e:
        rslogger.error(f"Error in delete_course endpoint: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"An error occurred: {str(e)}"},
        )


@router.get("/add_instructor")
@instructor_role_required()
@with_course()
async def get_add_instructor(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Render the Add Instructor page.
    """
    templates = Jinja2Templates(directory=template_folder)
    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }
    return templates.TemplateResponse("admin/instructor/add_instructor.html", context)


@router.get("/available_students")
@instructor_role_required()
@with_course()
async def get_available_students(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Return students in the course who are not instructors.
    """

    students = await fetch_available_students_for_instructor_add(course.id)
    for i in students:
        # Convert datetime objects to ISO format for JSON serialization
        if "created_on" in i:
            i["created_on"] = i["created_on"].isoformat()
        if "modified_on" in i:
            i["modified_on"] = i["modified_on"].isoformat()

    return JSONResponse(content={"students": [s for s in students]})


@router.get("/current_instructors")
@instructor_role_required()
@with_course()
async def get_current_instructors(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Return current instructors for the course.
    """
    from rsptx.db.crud import fetch_current_instructors_for_course

    instructors = await fetch_current_instructors_for_course(course.id)
    for i in instructors:
        # Convert datetime objects to ISO format for JSON serialization
        if "created_on" in i:
            i["created_on"] = i["created_on"].isoformat()
        if "modified_on" in i:
            i["modified_on"] = i["modified_on"].isoformat()

    return JSONResponse(content={"instructors": [i for i in instructors]})


@router.post("/add_instructor_user")
@instructor_role_required()
@with_course()
async def post_add_instructor(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Add a user as an instructor to the course.
    """
    data = await request.json()
    user_id = data.get("user_id")
    if not user_id:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Missing user_id"},
        )

    try:
        await create_course_instructor(course.id, int(user_id))
        return JSONResponse(content={"success": True})
    except Exception as e:
        rslogger.error(f"Error adding instructor: {e}")
        return JSONResponse(
            status_code=500, content={"success": False, "message": str(e)}
        )


@router.post("/remove_students")
@instructor_role_required()
@with_course()
async def remove_student(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Remove one or more students from the current course.
    Expects form data with student_id (can be a single value or a list).
    """
    try:
        form = await request.form()
        student_ids = form.getlist("student_id")
        if not student_ids:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "student_id is required"},
            )
        bc = await fetch_course(course.base_course)
        for sid in student_ids:
            await delete_user_course_entry(int(sid), course.id)
            await create_user_course_entry(int(sid), bc.id)
        return JSONResponse(
            content={
                "success": True,
                "message": f"Removed {len(student_ids)} student(s) from course",
            }
        )
    except Exception as e:
        rslogger.error(f"Error removing student(s): {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


@router.post("/reset_password")
@instructor_role_required()
@with_course()
async def reset_password(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Reset a student's password. Expects JSON with 'sid' (student id) and 'password'.
    """
    try:
        data = await request.json()
        sid = data.get("sid")
        password = data.get("password")
        if not sid or not password:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "sid and password are required"},
            )
        from rsptx.db.crud import fetch_user, update_user

        student = await fetch_user(sid)
        if not student:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Student not found"},
            )
        await update_user(student.id, {"password": password})
        return JSONResponse(
            content={"success": True, "message": "Password reset successfully."}
        )
    except Exception as e:
        rslogger.error(f"Error resetting password: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


@router.post("/enroll_students")
@instructor_role_required()
@with_course()
async def enroll_students(
    request: Request,
    user=Depends(auth_manager),
    students: UploadFile = File(...),
    course=None,
):
    """
    Enroll multiple students from an uploaded CSV file (multipart/form-data).
    The CSV must have columns: username,email,first_name,last_name,password,course
    """
    content = await students.read()
    try:
        csvfile = StringIO(content.decode("utf-8"))
        reader = csv.reader(csvfile)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")

    rslogger.info(f"Enrolling students for course: {course}")
    rslogger.info(f"user = {user}")
    mess = ""
    results = []
    failed = 0
    enrolled = 0
    for row in reader:
        rslogger.info(f"Processing row: {row}")
        if len(row) < 6:
            results.append(
                {
                    "username": row[0] if row else "?",
                    "status": "error: missing fields in csv",
                    "category": "error",
                }
            )
            failed += 1
            continue
        if course.course_name != row[5]:
            results.append(
                {
                    "username": row[0] if row else "?",
                    "status": f"error: course mismatch, expected {course.course_name}, got {row[5]}",
                    "category": "error",
                }
            )
            failed += 1
            continue
        if len(row) > 6:
            row = row[:6]  # Only take the first 6 columns
            mess = "Row has more than 6 columns, truncating."
            rslogger.warning(f"Row has more than 6 columns, truncating: {row}")
        try:
            user_data = AuthUserValidator(
                username=row[0],
                email=row[1],
                first_name=row[2],
                last_name=row[3],
                password=row[4],
                course_name=row[5],
                # Fill in other required fields with defaults or sensible values
                created_on=canonical_utcnow(),
                modified_on=canonical_utcnow(),
                registration_key="",
                reset_password_key="",
                registration_id="",
                course_id=course.id,
                active=True,
                donated=False,
                accept_tcp=False,
            )
            # Check if user exists
            if await fetch_user(user_data.username):
                results.append(
                    {
                        "username": user_data.username,
                        "status": "already exists",
                        "category": "duplicate",
                    }
                )
                failed += 1
                continue
            new_user = await create_user(user_data)
            await create_user_course_entry(
                new_user.id, course.id
            )  # Enroll the user in the course
            results.append(
                {
                    "username": user_data.username,
                    "status": "enrolled",
                    "category": "success",
                }
            )
            enrolled += 1
        except Exception as e:
            rslogger.error(f"Error enrolling {row[0] if row else '?'}: {e}")
            results.append(
                {
                    "username": row[0] if row else "?",
                    "status": f"error: {e}",
                    "category": "error",
                }
            )
            failed += 1
    # Render a results page with a table
    if failed > 0:
        mess = f"Enrollment completed with {enrolled} successful enrollments and {failed} failures."
    else:
        mess = f"All {enrolled} students enrolled successfully."
    templates = Jinja2Templates(directory=template_folder)
    return templates.TemplateResponse(
        "admin/instructor/enroll_results.html",
        {
            "request": request,
            "results": results,
            "course": course,
            "user": user,
            "mess": mess,
        },
    )
