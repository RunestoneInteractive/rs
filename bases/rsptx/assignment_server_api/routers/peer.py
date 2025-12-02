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
import sys
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
    fetch_assignment_questions,
    fetch_all_course_attributes,
    create_useinfo_entry,
    fetch_lti_version,
)
from rsptx.db.models import UseinfoValidation
from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.endpoint_validators import with_course, instructor_role_required
from rsptx.configuration import settings

from rsptx.response_helpers.core import (
    get_webpack_static_imports,
)

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
    groupsize: Optional[str] = None,
    user=Depends(auth_manager),
    course=None,
):
    """
    Display the peer instruction dashboard for a specific assignment.
    This is where instructors control the flow of peer instruction.
    """
    rslogger.info(f"Peer dashboard for assignment {assignment_id}, next={next}")
    templates = Jinja2Templates(directory=template_folder)

    # Fetch the assignment
    assignment = await fetch_one_assignment(assignment_id)

    # Handle question navigation
    if next == "Reset":
        assignment.current_index = 0
        await update_assignment(assignment)
    elif next == "Next":
        new_idx = (assignment.current_index or 0) + 1
        assignment.current_index = new_idx
        await update_assignment(assignment)

    # Get all questions for this assignment
    questions_result = await fetch_assignment_questions(assignment_id)
    questions = []
    for row in questions_result:
        question, assignment_question = row
        questions.append(question)

    # Get current question based on assignment's current_index
    current_idx = (
        assignment.current_index if assignment.current_index is not None else 0
    )
    num_questions = len(questions)

    if current_idx >= num_questions:
        current_idx = num_questions - 1 if questions else 0

    current_question = questions[current_idx] if questions else None
    is_last = current_idx == num_questions - 1
    current_qnum = current_idx + 1

    if not current_question:
        return JSONResponse(
            status_code=404,
            content={"detail": "No questions found for this assignment"},
        )

    # Fetch course attributes
    course_attrs = await fetch_all_course_attributes(course.id)
    latex_macros = course_attrs.get("latex_macros", "")
    enable_ab = course_attrs.get("enable_ab", False)
    if not groupsize:
        groupsize = course_attrs.get("groupsize", "3")

    # Check if LTI is enabled
    lti_version = await fetch_lti_version(course.id)
    is_lti = lti_version is not None

    # Log the start_question event

    log_entry = UseinfoValidation(
        sid=user.username,
        course_id=course.course_name,
        div_id=current_question.name,
        event="peer",
        act="start_question",
        timestamp=datetime.datetime.utcnow(),
    )
    await create_useinfo_entry(log_entry)

    # Initialize Redis state and publish enableNext message
    import os
    import redis
    import json

    try:
        r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
        r.hset(f"{course.course_name}_state", "mess_count", "0")
        mess = {
            "sender": user.username,
            "type": "control",
            "message": "enableNext",
            "broadcast": True,
            "course_name": course.course_name,
        }
        r.publish("peermessages", json.dumps(mess))
    except Exception as e:
        rslogger.error(f"Error initializing Redis: {e}")

    # Get peer.js mtime for cache busting
    import random

    site_packages_path = sys.path[0]
    peer_js_path = os.path.join(
        site_packages_path, "rsptx/templates/staticAssets", "js", "peer.js"
    )

    try:
        peer_mtime = str(int(os.path.getmtime(peer_js_path)))
    except (FileNotFoundError, AttributeError):
        peer_mtime = str(random.randrange(10000))

    wp_assets = get_webpack_static_imports(course)

    context = {
        "request": request,
        "course": course,
        "user": user,
        "assignment_id": assignment_id,
        "assignment_name": assignment.name,
        "current_question": current_question,
        "all_questions": questions,
        "current_qnum": current_qnum,
        "num_questions": num_questions,
        "is_instructor": True,
        "is_last": is_last,
        "lti": is_lti,
        "latex_macros": latex_macros,
        "enable_ab": enable_ab,
        "groupsize": groupsize,
        "peer_mtime": peer_mtime,
        "settings": settings,
        "wp_imports": wp_assets,
    }

    return templates.TemplateResponse(
        "assignment/instructor/peer_dashboard.html", context
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
    all_assignments = await fetch_assignments(
        course.course_name, is_peer=True, is_visible=True
    )
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
    templates = Jinja2Templates(directory=template_folder)

    # Fetch the assignment and its questions
    assignment = await fetch_one_assignment(assignment_id)

    # Get all questions for this assignment
    questions_result = await fetch_assignment_questions(assignment_id)
    questions = []
    for row in questions_result:
        question, assignment_question = row
        questions.append(question)

    # Get the current question based on assignment's current_index
    current_idx = (
        assignment.current_index if assignment.current_index is not None else 0
    )
    if current_idx >= len(questions):
        current_idx = len(questions) - 1 if questions else 0

    current_question = questions[current_idx] if questions else None

    if not current_question:
        return JSONResponse(
            status_code=404,
            content={"detail": "No questions found for this assignment"},
        )

    # Fetch course attributes for latex_macros
    course_attrs = await fetch_all_course_attributes(course.id)
    latex_macros = course_attrs.get("latex_macros", "")

    # Get peer.js mtime for cache busting
    import os
    import random

    # find the path to site-packages

    site_packages_path = sys.path[0]

    peer_js_path = os.path.join(
        site_packages_path, "rsptx/templates/staticAssets", "js", "peer.js"
    )
    try:
        peer_mtime = str(int(os.path.getmtime(peer_js_path)))
    except (FileNotFoundError, AttributeError):
        peer_mtime = str(random.randrange(10000))

    wp_assets = get_webpack_static_imports(course)
    context = {
        "request": request,
        "course": course,
        "user": user,
        "assignment_id": assignment_id,
        "assignment_name": assignment.name,
        "current_question": current_question,
        "latex_macros": latex_macros,
        "peer_mtime": peer_mtime,
        "settings": settings,
        "wp_imports": wp_assets,
    }

    return templates.TemplateResponse("assignment/student/peer_question.html", context)


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


@router.post("/api/publish_message")
@with_course()
async def publish_message(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Publish a message to the Redis pub/sub for peer instruction.
    Used for both text chat and control messages.
    """
    import os
    import redis
    import json

    data = await request.json()
    rslogger.info(f"Publishing peer message: {data}")

    try:
        r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
        r.publish("peermessages", json.dumps(data))

        # Track message count for text messages
        if data.get("type") == "text":
            res = r.hget(f"{course.course_name}_state", "mess_count")
            if res is not None:
                mess_count = int(res) + 1
            else:
                mess_count = 1
            r.hset(f"{course.course_name}_state", "mess_count", str(mess_count))

        return JSONResponse(content={"status": "success"})
    except Exception as e:
        rslogger.error(f"Error publishing message: {e}")
        return JSONResponse(
            status_code=500, content={"detail": f"Failed to publish message: {str(e)}"}
        )


@router.post("/api/log_peer_rating")
@with_course()
async def log_peer_rating(
    request: Request,
    div_id: str = Body(...),
    peer_id: Optional[str] = Body(None),
    rating: Optional[str] = Body(None),
    user=Depends(auth_manager),
    course=None,
):
    """
    Log a student's rating of their peer interaction.
    """
    import datetime
    from rsptx.validation.schemas import UseinfoValidation

    rslogger.info(
        f"Logging peer rating for {user.username}: div_id={div_id}, peer={peer_id}, rating={rating}"
    )

    retmess = "Error: no peer to rate"

    if peer_id:
        try:
            # Log the rating event to the database
            log_entry = UseinfoValidation(
                sid=user.username,
                course_id=course.course_name,
                div_id=div_id,
                event="peer_rating",
                act=f"peer:{peer_id}:rating:{rating}",
                timestamp=datetime.datetime.utcnow(),
            )
            await create_useinfo_entry(log_entry)

            retmess = "Rating logged successfully"
        except Exception as e:
            rslogger.error(f"Error logging peer rating: {e}")
            retmess = f"Error: {str(e)}"

    return JSONResponse(content={"message": retmess})


@router.post("/api/get_async_explainer")
@with_course()
async def get_async_explainer(
    request: Request,
    div_id: str = Body(...),
    course: str = Body(...),
    user=Depends(auth_manager),
    course_obj=None,
):
    """
    Get a peer's explanation for async peer instruction mode.
    Returns a recorded explanation and the peer's answer.
    """
    rslogger.info(f"Getting async explainer for {div_id} in course {course}")

    try:
        # TODO: Implement the logic to fetch a recorded peer explanation
        # This should:
        # 1. Query the database for peer messages from this question
        # 2. Find a good explanation to show (not from this student)
        # 3. Return the explanation and the peer's answer

        # Placeholder response
        return JSONResponse(
            content={
                "user": "peer_student",
                "answer": "A",
                "mess": "This is a placeholder explanation. The actual implementation will fetch recorded peer explanations from the database.",
                "responses": {"peer1": "A", "peer2": "B"},
            }
        )
    except Exception as e:
        rslogger.error(f"Error getting async explainer: {e}")
        return JSONResponse(
            status_code=500, content={"detail": f"Failed to get explainer: {str(e)}"}
        )
