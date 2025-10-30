# *************************
# |docname| - Peer Instruction API
# *************************
# This module implements the Peer Instruction API for both instructors and students
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
from typing import Optional

# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import (
    fetch_assignments,
    fetch_one_assignment,
    update_assignment,
    # TODO: Uncomment when implementing dashboard/question functionality
    # fetch_assignment_questions,
)
from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.endpoint_validators import with_course, instructor_role_required
from rsptx.configuration import settings


# Routing
# =======
router = APIRouter(
    prefix="/peer",
    tags=["peer"],
)

rslogger.info("Registering peer instruction API routes")


# Instructor Routes
# =================


@router.get("/instructor", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_peer_instructor(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the peer instruction instructor interface showing all peer assignments.
    """
    rslogger.info(f"Rendering peer instructor page for course: {course.course_name}")
    templates = Jinja2Templates(directory=template_folder)

    # Fetch all peer assignments for the course
    all_assignments = await fetch_assignments(course.course_name, fetch_all=True)
    # Filter for peer assignments only
    assignments = [a for a in all_assignments if a.is_peer or a.kind == "Peer"]

    # Sort by due date (most recent first)
    assignments.sort(
        key=lambda x: x.duedate if x.duedate else datetime.datetime.min, reverse=True
    )

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "assignments": assignments,
        "settings": settings,
    }

    return templates.TemplateResponse(
        "assignment/instructor/peer_instructor.html", context
    )


@router.get("/instructor/dashboard", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_peer_dashboard(
    request: Request,
    assignment_id: int,
    next: Optional[str] = None,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the peer instruction dashboard for a specific assignment.
    This is where instructors control the flow of peer instruction.
    """
    rslogger.info(f"Peer dashboard for assignment {assignment_id}")

    # TODO: Implement dashboard logic
    # This will include:
    # - Current question navigation
    # - Student response tracking
    # - Real-time analytics
    # - Group formation controls

    assignment = await fetch_one_assignment(assignment_id)
    # TODO: Use assignment_questions when implementing dashboard
    # assignment_questions = await fetch_assignment_questions(assignment_id)

    # TODO: Create peer_dashboard.html template
    return JSONResponse(
        content={
            "message": "Dashboard functionality to be implemented",
            "assignment_id": assignment_id,
            "assignment_name": assignment.name,
        }
    )


@router.get("/instructor/extra", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_peer_extra(
    request: Request,
    assignment_id: int,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display extra information for peer instruction that instructors
    might not want to share with students (e.g., correct answers, insights).
    """
    rslogger.info(f"Peer extra info for assignment {assignment_id}")

    # TODO: Implement extra info display
    # This will show:
    # - Correct answers
    # - Instructor notes
    # - Common misconceptions

    assignment = await fetch_one_assignment(assignment_id)

    return JSONResponse(
        content={
            "message": "Extra info functionality to be implemented",
            "assignment_id": assignment_id,
            "assignment_name": assignment.name,
        }
    )


@router.get("/instructor/review", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_peer_review(
    request: Request,
    assignment_id: int,
    user=Depends(auth_manager),
    course=None,
):
    """
    Review peer instruction results and student interactions.
    """
    rslogger.info(f"Peer review for assignment {assignment_id}")

    # TODO: Implement review functionality
    # This will show:
    # - Overall statistics
    # - Student participation
    # - Answer distribution
    # - Chat transcripts

    assignment = await fetch_one_assignment(assignment_id)

    return JSONResponse(
        content={
            "message": "Review functionality to be implemented",
            "assignment_id": assignment_id,
            "assignment_name": assignment.name,
        }
    )


# Student Routes
# ==============


@router.get("/student", response_class=HTMLResponse)
@with_course()
async def get_peer_student(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the peer instruction student interface showing available peer assignments.
    """
    rslogger.info(f"Rendering peer student page for user: {user.username}")
    templates = Jinja2Templates(directory=template_folder)

    # Fetch visible peer assignments for the student
    all_assignments = await fetch_assignments(course.course_name)
    # Filter for peer assignments that are visible
    assignments = [
        a for a in all_assignments if (a.is_peer or a.kind == "Peer") and a.visible
    ]

    # Sort by due date (most recent first)
    assignments.sort(
        key=lambda x: x.duedate if x.duedate else datetime.datetime.min, reverse=True
    )

    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": False,
        "assignments": assignments,
        "settings": settings,
    }

    return templates.TemplateResponse("assignment/student/peer_student.html", context)


@router.get("/student/question", response_class=HTMLResponse)
@with_course()
async def get_peer_question(
    request: Request,
    assignment_id: int,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the current peer instruction question for in-class participation.
    """
    rslogger.info(f"Peer question for assignment {assignment_id}, user {user.username}")

    # TODO: Implement in-class peer question interface
    # This will include:
    # - Question display
    # - Voting mechanism (vote 1 and vote 2)
    # - Partner chat
    # - Real-time updates

    assignment = await fetch_one_assignment(assignment_id)
    # TODO: Use assignment_questions when implementing question interface
    # assignment_questions = await fetch_assignment_questions(assignment_id)

    return JSONResponse(
        content={
            "message": "In-class peer question functionality to be implemented",
            "assignment_id": assignment_id,
            "assignment_name": assignment.name,
        }
    )


@router.get("/student/async", response_class=HTMLResponse)
@with_course()
async def get_peer_async(
    request: Request,
    assignment_id: int,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the asynchronous (after-class) peer instruction interface.
    Students can review questions and see recorded chat transcripts.
    """
    rslogger.info(f"Peer async for assignment {assignment_id}, user {user.username}")

    # TODO: Implement async peer instruction interface
    # This will include:
    # - Question review
    # - Two voting rounds
    # - Access to recorded chat transcripts
    # - Explanations from peers

    assignment = await fetch_one_assignment(assignment_id)

    # Check if async is enabled for this assignment
    if not assignment.peer_async_visible:
        return JSONResponse(
            status_code=403,
            content={
                "message": "After-class peer instruction is not available for this assignment"
            },
        )

    # TODO: Use assignment_questions when implementing async interface
    # assignment_questions = await fetch_assignment_questions(assignment_id)

    return JSONResponse(
        content={
            "message": "Async peer instruction functionality to be implemented",
            "assignment_id": assignment_id,
            "assignment_name": assignment.name,
        }
    )


# API Endpoints
# =============


@router.post("/api/make_pairs")
@instructor_role_required()
@with_course()
async def make_pairs(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Create student pairs/groups for peer instruction based on their answers.
    """
    # TODO: Implement pairing algorithm
    # This will:
    # - Analyze student responses
    # - Group students with different answers
    # - Store pairs in Redis
    # - Notify students of their partners

    return JSONResponse(content={"message": "Pair creation to be implemented"})


@router.get("/api/chart_data")
@instructor_role_required()
@with_course()
async def get_chart_data(
    request: Request,
    div_id: str,
    start_time: str,
    user=Depends(auth_manager),
    course=None,
):
    """
    Get data for visualizing student responses.
    """
    # TODO: Implement chart data generation
    # This will return answer distribution for visualization

    return JSONResponse(content={"message": "Chart data to be implemented"})


@router.get("/api/num_answers")
@instructor_role_required()
@with_course()
async def get_num_answers(
    request: Request,
    div_id: str,
    start_time: str,
    user=Depends(auth_manager),
    course=None,
):
    """
    Get the count of student responses.
    """
    # TODO: Implement answer counting

    return JSONResponse(content={"count": 0, "mess_count": 0})


@router.post("/api/set_visibility")
@instructor_role_required()
@with_course()
async def set_assignment_visibility(
    request: Request,
    assignment_id: int = Body(..., embed=True),
    visible: bool = Body(..., embed=True),
    user=Depends(auth_manager),
    course=None,
):
    """
    Toggle assignment visibility for students.

    Body JSON: { "assignment_id": number, "visible": boolean }
    """
    try:
        assignment = await fetch_one_assignment(assignment_id)
    except Exception as e:
        rslogger.error(f"Error fetching assignment {assignment_id}: {e}")
        return JSONResponse(status_code=404, content={"detail": "Assignment not found"})

    # Ensure the assignment belongs to this course
    if assignment.course != course.id:
        return JSONResponse(
            status_code=403, content={"detail": "Assignment not in this course"}
        )

    # Update visibility
    assignment.visible = visible
    try:
        await update_assignment(assignment)
    except Exception as e:
        rslogger.error(f"Error updating assignment visibility: {e}")
        return JSONResponse(
            status_code=400, content={"detail": "Failed to update visibility"}
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "assignment_id": assignment_id,
            "visible": visible,
        },
    )
