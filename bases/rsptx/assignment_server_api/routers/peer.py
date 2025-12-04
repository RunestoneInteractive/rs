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
from rsptx.db.models import UseinfoValidation, MchoiceAnswers, Useinfo
from rsptx.auth.session import auth_manager
import pandas as pd
import random
import json
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
    div_id: str = Body(...),
    start_time: str = Body(...),
    group_size: int = Body(2),
    is_ab: bool = Body(False),
    user=Depends(auth_manager),
    course=None,
):
    """
    Create student pairs/groups for peer instruction based on their answers.
    """
    import os
    import redis
    from dateutil.parser import parse
    from sqlalchemy import select, func
    from rsptx.db.async_session import async_session

    rslogger.info(f"Making pairs for {div_id}, group_size={group_size}, is_ab={is_ab}")

    try:
        r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
        r.delete(f"partnerdb_{course.course_name}")

        # Get student answers from the database
        st = parse(start_time)
        start_time = st.replace(tzinfo=None)
        async with async_session() as session:
            # Get the most recent answer for each student
            subquery = (
                select(
                    MchoiceAnswers.sid,
                    MchoiceAnswers.answer,
                    MchoiceAnswers.correct,
                    func.row_number()
                    .over(
                        partition_by=MchoiceAnswers.sid,
                        order_by=MchoiceAnswers.id.desc(),
                    )
                    .label("rn"),
                )
                .where(
                    MchoiceAnswers.div_id == div_id,
                    MchoiceAnswers.course_name == course.course_name,
                    MchoiceAnswers.timestamp > start_time,
                )
                .subquery()
            )

            query = select(subquery).where(subquery.c.rn == 1)
            result = await session.execute(query)
            rows = result.all()

        # Create a dictionary of student answers
        sid_ans = {row.sid: row.answer for row in rows if row.answer}
        peeps = list(sid_ans.keys())

        # Remove instructor if present
        if user.username in peeps:
            peeps.remove(user.username)

        # Shuffle the list
        random.shuffle(peeps)

        # Create groups
        group_list = []

        while peeps:
            # Start a new group
            group = [peeps.pop()]

            # Try to add more students with different answers
            for i in range(group_size - 1):
                if not peeps:
                    break

                # Try to find someone with a different answer
                first_answer = sid_ans.get(group[0])
                partner_idx = 0
                for idx, p in enumerate(peeps):
                    if sid_ans.get(p) != first_answer:
                        partner_idx = idx
                        break

                group.append(peeps.pop(partner_idx))

            # If group has only one student, add to previous group
            if len(group) == 1 and group_list:
                group_list[-1].append(group[0])
            else:
                group_list.append(group)

        # Create partner dictionary
        gdict = {}
        for group in group_list:
            for p in group:
                partners = [partner for partner in group if partner != p]
                gdict[p] = partners

        # Save to Redis
        for k, v in gdict.items():
            r.hset(f"partnerdb_{course.course_name}", k, json.dumps(v))

        r.hset(f"{course.course_name}_state", "mess_count", "0")

        # Broadcast partner information
        for sid, answer in sid_ans.items():
            partners = gdict.get(sid, [])
            mess = {
                "sender": user.username,
                "type": "control",
                "message": "enableChat",
                "broadcast": False,
                "partner_answer": answer,
                "yourPartner": partners,
                "from": sid,
                "to": sid,
                "course_name": course.course_name,
            }
            r.publish("peermessages", json.dumps(mess))

        rslogger.info(f"Created {len(group_list)} groups")
        return JSONResponse(content={"status": "success", "groups": len(group_list)})

    except Exception as e:
        rslogger.error(f"Error making pairs: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to create pairs: {str(e)}"},
        )


@router.post("/api/chart_data")
@instructor_role_required()
@with_course()
async def get_chart_data(
    request: Request,
    div_id: str = Body(...),
    start_time: str = Body(...),
    start_time2: Optional[str] = Body(None),
    num_answers: int = Body(4),
    answer_num: int = Body(1),
    user=Depends(auth_manager),
    course=None,
):
    """
    Get data for visualizing student responses using Vega-Lite.
    """
    from dateutil.parser import parse
    from sqlalchemy import select, func
    from rsptx.db.async_session import async_session

    rslogger.info(f"Getting chart data for {div_id}")

    try:
        async with async_session() as session:
            # Get vote 1 data
            st = parse(start_time)
            start_time = st.replace(tzinfo=None)
            subquery1 = select(
                MchoiceAnswers.sid,
                MchoiceAnswers.answer,
                func.row_number()
                .over(
                    partition_by=MchoiceAnswers.sid,
                    order_by=MchoiceAnswers.id.desc(),
                )
                .label("rn"),
            ).where(
                MchoiceAnswers.div_id == div_id,
                MchoiceAnswers.course_name == course.course_name,
                MchoiceAnswers.timestamp > start_time,
            )

            if start_time2:
                st = parse(start_time2)
                start_time2 = st.replace(tzinfo=None)
                subquery1 = subquery1.where(
                    MchoiceAnswers.timestamp < start_time2
                )

            subquery1 = subquery1.subquery()
            query1 = select(subquery1).where(subquery1.c.rn == 1).limit(4000)
            result1 = await session.execute(query1)
            rows1 = result1.all()

            # Convert to dataframe format
            data1 = [{"answer": row.answer, "rn": 1} for row in rows1 if row.answer]

            # Get vote 2 data if start_time2 is provided
            data2 = []
            if start_time2:
                subquery2 = (
                    select(
                        MchoiceAnswers.sid,
                        MchoiceAnswers.answer,
                        func.row_number()
                        .over(
                            partition_by=MchoiceAnswers.sid,
                            order_by=MchoiceAnswers.id.desc(),
                        )
                        .label("rn"),
                    )
                    .where(
                        MchoiceAnswers.div_id == div_id,
                        MchoiceAnswers.course_name == course.course_name,
                        MchoiceAnswers.timestamp > start_time2,
                    )
                    .subquery()
                )

                query2 = select(subquery2).where(subquery2.c.rn == 1).limit(4000)
                result2 = await session.execute(query2)
                rows2 = result2.all()
                data2 = [{"answer": row.answer, "rn": 2} for row in rows2 if row.answer]

        # Convert numeric answers to letters
        def to_letter(ans):
            if ans.isnumeric():
                return chr(65 + int(ans))
            elif "," in ans:
                return ",".join([chr(65 + int(x)) for x in ans.split(",")])
            return ans

        for item in data1 + data2:
            item["letter"] = to_letter(item["answer"])

        # Count answers by letter
        df = pd.DataFrame(data1 + data2)
        if df.empty:
            counts = pd.DataFrame({"letter": [], "rn": [], "count": []})
        else:
            counts = df.groupby(["letter", "rn"]).size().reset_index(name="count")

        # Ensure all answer options are represented
        alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        all_options = []
        for vote in [1, 2] if start_time2 else [1]:
            for letter in alpha[:num_answers]:
                if not ((counts["letter"] == letter) & (counts["rn"] == vote)).any():
                    all_options.append({"letter": letter, "rn": vote, "count": 0})

        if all_options:
            counts = pd.concat([counts, pd.DataFrame(all_options)], ignore_index=True)

        # Determine max height for consistent y-axis
        yheight = int(counts["count"].max()) if not counts.empty else 10

        # Build Vega-Lite spec
        vote1_data = counts[counts["rn"] == 1].to_dict("records")

        chart1 = {
            "title": "First Answer",
            "mark": "bar",
            "data": {"values": vote1_data},
            "encoding": {
                "x": {
                    "field": "letter",
                    "type": "nominal",
                    "axis": {"title": "Choice", "labelAngle": 0},
                },
                "y": {
                    "field": "count",
                    "type": "quantitative",
                    "title": "Number of Students",
                    "scale": {"domain": [0, yheight]},
                },
            },
        }

        if start_time2:
            vote2_data = counts[counts["rn"] == 2].to_dict("records")
            chart2 = {
                "title": "Second Answer",
                "mark": "bar",
                "data": {"values": vote2_data},
                "encoding": {
                    "x": {
                        "field": "letter",
                        "type": "nominal",
                        "axis": {"title": "Choice", "labelAngle": 0},
                    },
                    "y": {
                        "field": "count",
                        "type": "quantitative",
                        "title": "Number of Students",
                        "scale": {"domain": [0, yheight]},
                    },
                },
            }
            spec = {"hconcat": [chart1, chart2]}
        else:
            spec = chart1

        return JSONResponse(content=spec)

    except Exception as e:
        rslogger.error(f"Error generating chart data: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to generate chart data: {str(e)}"},
        )


@router.post("/api/num_answers")
@instructor_role_required()
@with_course()
async def get_num_answers(
    request: Request,
    div_id: str = Body(...),
    start_time: str = Body(...),
    course_name: str = Body(...),
    user=Depends(auth_manager),
    course=None,
):
    """
    Get the count of student responses and messages.
    """
    from dateutil.parser import parse
    from sqlalchemy import select, func
    from rsptx.db.async_session import async_session

    rslogger.info(f"Getting number of answers for {div_id} {start_time} {course_name}")
    if not start_time:
        return JSONResponse(content={"count": 0, "mess_count": 0})
    st = parse(start_time)
    # remove timezone info for comparison
    start_time = st.replace(tzinfo=None)
    try:
        async with async_session() as session:
            # Count distinct students who answered
            answer_query = select(func.count(func.distinct(MchoiceAnswers.sid))).where(
                MchoiceAnswers.div_id == div_id,
                MchoiceAnswers.course_name == course_name,
                MchoiceAnswers.timestamp > start_time,
            )
            answer_result = await session.execute(answer_query)
            answer_count = answer_result.scalar() or 0

            # Count messages sent
            message_query = select(func.count(Useinfo.id)).where(
                Useinfo.div_id == div_id,
                Useinfo.course_id == course_name,
                Useinfo.event == "sendmessage",
                Useinfo.timestamp > start_time,
            )
            message_result = await session.execute(message_query)
            message_count = message_result.scalar() or 0

        return JSONResponse(
            content={"count": answer_count, "mess_count": message_count}
        )

    except Exception as e:
        rslogger.error(f"Error counting answers: {e}")
        return JSONResponse(content={"count": 0, "mess_count": 0})


@router.post("/api/percent_correct")
@instructor_role_required()
@with_course()
async def get_percent_correct(
    request: Request,
    div_id: str = Body(...),
    start_time: str = Body(...),
    course_name: str = Body(...),
    user=Depends(auth_manager),
    course=None,
):
    """
    Calculate the percentage of correct answers for the first vote.
    """
    from dateutil.parser import parse
    from sqlalchemy import select, func
    from rsptx.db.async_session import async_session

    st = parse(start_time)
    # remove timezone info for comparison
    start_time = st.replace(tzinfo=None)
    try:
        async with async_session() as session:
            # Get the most recent answer for each student
            subquery = (
                select(
                    MchoiceAnswers.sid,
                    MchoiceAnswers.correct,
                    func.row_number()
                    .over(
                        partition_by=MchoiceAnswers.sid,
                        order_by=MchoiceAnswers.id.desc(),
                    )
                    .label("rn"),
                )
                .where(
                    MchoiceAnswers.div_id == div_id,
                    MchoiceAnswers.course_name == course_name,
                    MchoiceAnswers.timestamp > start_time,
                )
                .subquery()
            )

            query = select(subquery).where(subquery.c.rn == 1).limit(4000)
            result = await session.execute(query)
            rows = result.all()

        if not rows:
            return JSONResponse(content={"pct_correct": 0})

        total = len(rows)
        correct = sum(1 for row in rows if row.correct == "T")

        pct_correct = round((correct / total * 100), 1) if total > 0 else 0

        return JSONResponse(content={"pct_correct": pct_correct})

    except Exception as e:
        rslogger.error(f"Error calculating percent correct: {e}")
        return JSONResponse(content={"pct_correct": 0})


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
