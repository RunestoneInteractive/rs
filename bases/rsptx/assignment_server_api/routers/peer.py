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
    fetch_recent_student_answers,
    fetch_student_answers_in_timerange,
    count_distinct_student_answers,
    count_peer_messages,
    fetch_last_useinfo_peergroup,
    fetch_course_students,
    fetch_all_grades_for_assignment,
    fetch_api_token,
    fetch_question,
)
from rsptx.db.models import UseinfoValidation, Useinfo
from rsptx.db.async_session import async_session
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
        rslogger.info("Resetting to first question")
        assignment.current_index = 0
        await update_assignment(assignment, pi_update=True)
    elif next == "Next":
        rslogger.info("Advancing to next question")
        new_idx = (assignment.current_index or 0) + 1
        rslogger.info(f"New index: {new_idx}")
        assignment.current_index = new_idx
        await update_assignment(assignment, pi_update=True)

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
        "peer_async_visible": bool(assignment.peer_async_visible),
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
    Instructor-only view showing live percent-correct for the current question.
    Meant to be opened on a separate device so students can't see it.
    """
    rslogger.info(f"Peer extra info for assignment {assignment_id}")
    templates = Jinja2Templates(directory=template_folder)

    assignment = await fetch_one_assignment(assignment_id)
    questions_result = await fetch_assignment_questions(assignment_id)
    questions = [q for q, _aq in questions_result]

    current_idx = assignment.current_index if assignment.current_index is not None else 0
    if current_idx >= len(questions):
        current_idx = len(questions) - 1 if questions else 0
    current_question = questions[current_idx] if questions else None

    if not current_question:
        return JSONResponse(status_code=404, content={"detail": "No questions found for this assignment"})

    context = {
        "request": request,
        "course": course,
        "user": user,
        "assignment_id": assignment_id,
        "current_question": current_question,
        "is_instructor": True,
    }

    return templates.TemplateResponse("assignment/instructor/peer_extra.html", context)


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
    rslogger.info(f"Peer review for assignment {assignment_id} - not yet implemented, redirecting")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"/assignment/instructor/reviewPeerAssignment?assignment_id={assignment_id}")


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
    rslogger.debug(f"Current index: {current_idx}, Questions count: {len(questions)}")
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

async def _has_vote1_async(div_id: str, sid: str) -> bool:
    from sqlalchemy import select
    async with async_session() as session:
        query = (
            select(Useinfo)
            .where(
                (Useinfo.event == "mChoice")
                & (Useinfo.sid == sid)
                & (Useinfo.div_id == div_id)
                & Useinfo.act.like("%vote1")
            )
            .order_by(Useinfo.id.desc())
            .limit(1)
        )
        result = await session.execute(query)
        return result.scalar() is not None


async def _has_reflection_async(div_id: str, sid: str) -> bool:
    from sqlalchemy import select
    async with async_session() as session:
        query = (
            select(Useinfo)
            .where(
                (Useinfo.event == "reflection")
                & (Useinfo.sid == sid)
                & (Useinfo.div_id == div_id)
            )
            .order_by(Useinfo.id.desc())
            .limit(1)
        )
        result = await session.execute(query)
        return result.scalar() is not None


async def _llm_enabled_async(course_id: int) -> bool:
    token = await fetch_api_token(course_id, "openai")
    return token is not None and bool(token.token)


@router.get("/student/async", response_class=HTMLResponse)
@with_course()
async def get_peer_async(
    request: Request,
    assignment_id: int,
    question_num: int = 1,
    user=Depends(auth_manager),
    course=None,
):

    import os
    import random

    rslogger.info(f"Peer async for assignment {assignment_id}, question {question_num}, user {user.username}")
    templates = Jinja2Templates(directory=template_folder)

    assignment = await fetch_one_assignment(assignment_id)
    if not assignment:
        return JSONResponse(status_code=404, content={"detail": "Assignment not found"})

    if not assignment.peer_async_visible:
        return JSONResponse(
            status_code=403,
            content={"message": "After-class peer instruction is not available for this assignment"},
        )

    qa_pairs = list(await fetch_assignment_questions(assignment_id))
    questions = [q for q, _aq in qa_pairs]
    total_questions = len(questions)

    idx = question_num - 1
    if not questions or idx >= total_questions:
        all_done = True
        current_question = None
        aq = None
    else:
        all_done = False
        current_question = questions[idx]
        aq = qa_pairs[idx][1]

    has_vote1 = False
    has_reflection = False
    if current_question:
        has_vote1 = await _has_vote1_async(current_question.name, user.username)
        has_reflection = await _has_reflection_async(current_question.name, user.username)

    course_attrs = await fetch_all_course_attributes(course.id)
    latex_macros = course_attrs.get("latex_macros", "")

    async_llm_modes_enabled = course_attrs.get("enable_async_llm_modes", "false") == "true"
    has_api_token = await _llm_enabled_async(course.id)
    question_async_mode = (getattr(aq, "async_mode", None) or "standard") if aq else "standard"
    if async_llm_modes_enabled:
        question_use_llm = question_async_mode in ("llm", "analogies")
        llm_enabled = question_use_llm and has_api_token
    else:
        llm_enabled = has_api_token

    try:
        await create_useinfo_entry(UseinfoValidation(
            course_id=course.course_name,
            sid=user.username,
            div_id=current_question.name if current_question else "",
            event="pi_mode",
            act=json.dumps({"mode": "llm" if llm_enabled else "legacy"}),
            timestamp=datetime.datetime.utcnow(),
        ))
    except Exception:
        rslogger.exception("Failed to log pi_mode for peer_async")

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
        "course_id": course.course_name,
        "assignment_id": assignment_id,
        "assignment_name": assignment.name,
        "current_question": current_question,
        "nextQnum": question_num + 1,
        "total_questions": total_questions,
        "is_last_question": question_num >= total_questions,
        "all_done": all_done,
        "has_vote1": has_vote1,
        "has_reflection": has_reflection,
        "llm_enabled": llm_enabled,
        "async_mode": question_async_mode,
        "llm_reply": None,
        "latex_macros": latex_macros,
        "peer_mtime": peer_mtime,
        "is_instructor": False,
        "student_page": True,
        "settings": settings,
        "wp_imports": wp_assets,
    }

    return templates.TemplateResponse("assignment/student/peer_async.html", context)


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
    """Create student pairs/groups for peer instruction based on their answers.

    When ``is_ab`` is true, split students into in-person groups (based on prior
    ``peergroup`` useinfo events) and chat groups to support A/B experimentation,
    mimicking the legacy web2py behavior.
    """
    import os
    import redis
    from dateutil.parser import parse

    rslogger.info(f"Making pairs for {div_id}, group_size={group_size}, is_ab={is_ab}")

    try:
        r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
        r.delete(f"partnerdb_{course.course_name}")

        # Get student answers from the database
        st = parse(start_time)
        start_time_dt = st.replace(tzinfo=None)

        rows = await fetch_recent_student_answers(
            div_id, course.course_name, start_time_dt
        )

        # Create a dictionary of student answers
        sid_ans = {sid: answer for sid, answer, correct in rows}
        peeps = list(sid_ans.keys())

        # Remove instructor if present
        if user.username in peeps:
            peeps.remove(user.username)

        # Shuffle the list of students
        random.shuffle(peeps)

        group_list: list[list[str]] = []
        in_person_groups: list[set[str]] = []
        peeps_in_person: list[str] = []

        # A/B logic: split into in-person vs chat groups using prior peergroup info
        if is_ab:
            # Build in-person groups from last peergroup entries
            useinfos = await fetch_last_useinfo_peergroup(course.course_name)
            in_person_groups = []
            for u in useinfos:
                # act format peergroup:student1,student2,...
                try:
                    _, members = u.act.split(":", 1)
                    grp = set(members.split(","))
                    if u.sid not in grp:
                        grp.add(u.sid)
                    in_person_groups.append(grp)
                except Exception:  # defensive; malformed rows shouldn't break pairing
                    continue

            def find_set_containing_string(
                list_of_sets: list[set[str]], target: str
            ) -> set[str]:
                result: set[str] = set()
                for s in list_of_sets:
                    if target in s:
                        result |= s
                return result

            def process_peep(
                sid: str,
                remaining: list[str],
                target_list: list[str],
                other_list: list[str],
                local_groups: list[set[str]],
                mode: str,
            ) -> None:
                target_list.append(sid)
                if sid in remaining:
                    remaining.remove(sid)
                other_peeps = find_set_containing_string(local_groups, sid)
                # If no other peeps then this person must be put into a chat group,
                # not an in-person group.
                if not other_peeps and mode == "in_person":
                    other_list.append(sid)
                    return
                for op in other_peeps:
                    if op in remaining:
                        remaining.remove(op)
                    if op not in target_list:
                        target_list.append(op)

            peeps_in_chat: list[str] = []
            peep_queue = [p for p in peeps if p in sid_ans]
            while peep_queue:
                p = peep_queue.pop()
                if p in peeps_in_person or p in peeps_in_chat:
                    continue
                if random.random() < 0.5:
                    rslogger.debug(f"Adding {p} to the in_person list")
                    process_peep(
                        p,
                        peeps,
                        peeps_in_person,
                        peeps_in_chat,
                        in_person_groups,
                        "in_person",
                    )
                else:
                    process_peep(
                        p,
                        peeps,
                        peeps_in_chat,
                        peeps_in_person,
                        in_person_groups,
                        "chat",
                    )
            # Need to ensure that chat peeps have answered the question
            peeps = [p for p in peeps_in_chat if p in sid_ans]
            rslogger.debug(f"FINAL PEEPS IN CHAT = {peeps}")
            rslogger.debug(f"FINAL PEEPS IN PERSON = {peeps_in_person}")

        # Chat pairing for the remaining students in `peeps`
        done = len(peeps) == 0
        while not done:
            # Start a new group with one student
            group = [peeps.pop()]

            # Try to add more students to the group with different answers
            for _ in range(group_size - 1):
                if not peeps:
                    break
                first_answer = sid_ans.get(group[0])
                # Find a partner with a different answer if possible
                partner_idx = None
                for idx, p in enumerate(peeps):
                    if sid_ans.get(p) != first_answer:
                        partner_idx = idx
                        break
                if partner_idx is None:
                    partner_idx = 0
                group.append(peeps.pop(partner_idx))

            # If the group only has one student, add them to the previous group
            if len(group) == 1 and group_list:
                group_list[-1].append(group[0])
            else:
                group_list.append(group)

            # Stop if all students have been grouped
            if len(peeps) == 0:
                done = True

        # Create partner dictionary for chat groups
        gdict: dict[str, list[str]] = {}
        for group in group_list:
            for p in group:
                partners = [partner for partner in group if partner != p]
                gdict[p] = partners

        # Save chat groups to Redis
        for k, v in gdict.items():
            r.hset(f"partnerdb_{course.course_name}", k, json.dumps(v))

        r.hset(f"{course.course_name}_state", "mess_count", "0")

        # Broadcast partner information for chat (enableChat)
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

        # If doing A/B, also send face-chat groups based on in-person groups
        if is_ab and peeps_in_person:
            # Build a map of username -> full name for this course
            from rsptx.db.crud import fetch_course_students

            students = await fetch_course_students(course.id)
            peeps_dict = {
                s.username: f"{getattr(s, 'first_name', '')} {getattr(s, 'last_name', '')}".strip()
                for s in students
            }

            for p in peeps_in_person:
                pgroup: set[str] = set()
                for grp in in_person_groups:
                    if p in grp:
                        pgroup = grp
                        break
                # Convert usernames to display names when possible
                display_group = [peeps_dict.get(x, x) for x in pgroup]
                mess = {
                    "type": "control",
                    "from": p,
                    "to": p,
                    "message": "enableFaceChat",
                    "broadcast": False,
                    "group": display_group,
                    "course_name": course.course_name,
                }
                r.publish("peermessages", json.dumps(mess))

        rslogger.info(f"Created {len(group_list)} chat groups (is_ab={is_ab})")
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

    rslogger.info(f"Getting chart data for {div_id}")

    try:
        # Get vote 1 data
        st = parse(start_time)
        start_time_dt = st.replace(tzinfo=None)

        end_time_dt = None
        if start_time2:
            st2 = parse(start_time2)
            end_time_dt = st2.replace(tzinfo=None)

        rows1 = await fetch_student_answers_in_timerange(
            div_id, course.course_name, start_time_dt, end_time_dt
        )
        data1 = [{"answer": answer, "rn": 1} for sid, answer in rows1]

        # Get vote 2 data if start_time2 is provided
        data2 = []
        if end_time_dt:
            rows2 = await fetch_student_answers_in_timerange(
                div_id, course.course_name, end_time_dt
            )
            data2 = [{"answer": answer, "rn": 2} for sid, answer in rows2]

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

    rslogger.info(f"Getting number of answers for {div_id} {start_time} {course_name}")
    if not start_time:
        return JSONResponse(content={"count": 0, "mess_count": 0})

    st = parse(start_time)
    start_time_dt = st.replace(tzinfo=None)

    try:
        # Count distinct students who answered
        answer_count = await count_distinct_student_answers(
            div_id, course_name, start_time_dt
        )

        # Count messages sent
        message_count = await count_peer_messages(div_id, course_name, start_time_dt)

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

    st = parse(start_time)
    start_time_dt = st.replace(tzinfo=None)

    try:
        # Get the most recent answer for each student
        rows = await fetch_recent_student_answers(div_id, course_name, start_time_dt)

        if not rows:
            return JSONResponse(content={"pct_correct": 0})

        total = len(rows)
        correct = sum(1 for sid, answer, is_correct in rows if is_correct == "T")

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
        await update_assignment(assignment, pi_update=True)
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


@router.post("/clear_pairs")
@instructor_role_required()
@with_course()
async def clear_pairs(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Clear the partner assignments for the current course from Redis.
    Called when the instructor switches to face-chat mode.
    """
    import os
    import redis as redis_lib

    r = redis_lib.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    r.delete(f"partnerdb_{course.course_name}")
    rslogger.info(f"Cleared pairs for course {course.course_name}")
    return JSONResponse(content="success")


@router.get("/course_students")
@instructor_role_required()
@with_course()
async def get_course_students(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """
    Return a dict of {username: full_name} for all students in the course.
    Used by peer.js to populate the group selection panel.
    """
    students = await fetch_course_students(course.id)
    result = {
        s.username: f"{s.first_name} {s.last_name}".strip()
        for s in students
    }
    return JSONResponse(content=result)


@router.post("/send_lti_scores")
@instructor_role_required()
@with_course()
async def send_lti_scores(
    request: Request,
    assignment_id: int = Body(..., embed=True),
    user=Depends(auth_manager),
    course=None,
):
    """
    Send LTI scores for all students in the assignment.
    Mirrors web2py peer.send_lti_scores.
    """
    from rsptx.lti1p3.core import attempt_lti1p3_score_updates

    rslogger.info(f"Sending LTI scores for assignment {assignment_id}")
    try:
        await attempt_lti1p3_score_updates(assignment_id, force=True)
    except Exception as e:
        rslogger.error(f"Error sending LTI scores: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
    return JSONResponse(content="success")


@router.post("/api/toggle_async")
@instructor_role_required()
@with_course()
async def toggle_async(
    request: Request,
    assignment_id: int = Body(..., embed=True),
    user=Depends(auth_manager),
    course=None,
):
    """
    Toggle peer_async_visible on an assignment. Instructors use this to open/close
    the after-class async interface for students.
    """
    assignment = await fetch_one_assignment(assignment_id)
    if not assignment:
        return JSONResponse(status_code=404, content={"ok": False, "error": "assignment not found"})
    if assignment.course != course.id:
        return JSONResponse(status_code=403, content={"ok": False, "error": "assignment does not belong to your course"})

    assignment.peer_async_visible = not bool(assignment.peer_async_visible)
    await update_assignment(assignment, pi_update=True)

    rslogger.info(f"Toggled peer_async_visible for assignment {assignment_id} to {assignment.peer_async_visible}")
    return JSONResponse(content={"peer_async_visible": assignment.peer_async_visible})


@router.post("/api/get_async_explainer")
async def get_async_explainer(
    request: Request,
    div_id: str = Body(...),
    course: str = Body(...),
    user=Depends(auth_manager),
):

    from sqlalchemy import select, or_
    rslogger.info(f"Getting async explainer for {div_id} in course {course}")

    try:
        async with async_session() as session:
            msg_query = (
                select(Useinfo)
                .where(
                    Useinfo.event.in_(["sendmessage", "reflection"]),
                    Useinfo.div_id == div_id,
                    Useinfo.course_id == course,
                )
                .order_by(Useinfo.id)
            )
            msg_result = await session.execute(msg_query)
            messages = msg_result.scalars().all()

            all_msgs = []
            last_per_sid = {}
            for row in messages:
                if row.event == "reflection":
                    msg = row.act
                else:
                    try:
                        msg = row.act.split(":", 2)[2]
                    except Exception:
                        msg = row.act
                if last_per_sid.get(row.sid) != msg:
                    all_msgs.append((row.sid, msg))
                    last_per_sid[row.sid] = msg

        parts = []
        for sid, msg in all_msgs:
            parts.append(f"<li><strong>{sid}</strong> said: {msg}</li>")

        if not parts:
            mess = "Sorry there are no explanations yet."
        else:
            mess = "<ul>" + "".join(parts) + "</ul>"

        return JSONResponse(content={"mess": mess, "user": "", "answer": "", "responses": {}})

    except Exception as e:
        rslogger.error(f"Error getting async explainer: {e}")
        return JSONResponse(
            status_code=500, content={"detail": f"Failed to get explainer: {str(e)}"}
        )


async def _get_mcq_context_async(div_id: str):
    try:
        q = await fetch_question(div_id)
        if not q:
            rslogger.error(f"_get_mcq_context_async: no question row for {div_id}")
            return "", "", []

        question = (q.question or "").strip()
        code = (q.code or "").strip() if hasattr(q, "code") else ""
        choices = []
        try:
            if q.answers:
                opts = json.loads(q.answers)
                for i, opt in enumerate(opts):
                    choices.append(f"{chr(65+i)}. {opt.strip()}")
        except Exception as e:
            rslogger.warning(f"Could not parse choices for {div_id}: {e}")
        return question, code, choices
    except Exception:
        rslogger.exception(f"_get_mcq_context_async failed for {div_id}")
        return "", "", []


async def _call_openai_async(messages: list, course_id: int) -> str:
    import os

    import aiohttp
    token_row = await fetch_api_token(course_id, "openai")
    if not token_row or not token_row.token:
        raise Exception("missing api key")

    api_key = token_row.token
    model = os.environ.get("PI_OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 300,
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            resp.raise_for_status()
            data = await resp.json()
    rslogger.warning(f"PEER LLM CALL | provider=openai-course-token | model={model}")
    return data["choices"][0]["message"]["content"].strip()


@router.post("/api/get_async_llm_reflection")
async def get_async_llm_reflection(
    request: Request,
    user=Depends(auth_manager),
):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(content={"ok": False, "error": "invalid json"})

    div_id = (data.get("div_id") or "").strip()
    selected = (data.get("selected_answer") or "").strip()
    messages = data.get("messages")

    if not div_id:
        return JSONResponse(content={"ok": False, "error": "missing div_id"})

    try:
        user_msgs = [m for m in (messages or []) if m.get("role") == "user"]
        for idx, m in enumerate(user_msgs):
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if idx == 0:
                await create_useinfo_entry(UseinfoValidation(
                    course_id=user.course_name,
                    sid=user.username,
                    div_id=div_id,
                    event="reflection",
                    act=content,
                    timestamp=datetime.datetime.utcnow(),
                ))
            else:
                await create_useinfo_entry(UseinfoValidation(
                    course_id=user.course_name,
                    sid=user.username,
                    div_id=div_id,
                    event="sendmessage",
                    act=f"to:llm:{content}",
                    timestamp=datetime.datetime.utcnow(),
                ))
    except Exception:
        rslogger.exception("Failed to log LLM user message")

    question, code, choices = await _get_mcq_context_async(div_id)

    sys_content = (
        "only speak in lower case.\n"
        "you are a student talking to another student during peer instruction.\n"
        "you are both looking at the same multiple choice question with code and answers.\n"
        "you remember the question and choices.\n"
        "most messages should be short (1 to 3 sentences often very short).\n"
        "use casual informal language and common typos.\n"
        "never use commas.\n"
        "never use gendered language.\n"
        "do not use new lines.\n"
        "do not sound like a teacher.\n"
        "do not explain step by step.\n"
        "never say something is right or wrong.\n"
        "do not pretend to have picked an answer yourself.\n"
        "never mention a choice letter as the correct answer.\n"
        "if the question includes code never clearly describe the final result or fully state what it prints.\n"
        "if the question does not include code do not make up or reference code that is not there.\n"
        "only refer to what is actually in the question.\n"
        "be aware of common misconceptions but do not introduce them yourself.\n"
        "if there is code refer to it loosely like 'that line' or 'the loop' or 'the print'.\n"
        "often hedge with uncertainty.\n"
        "ask the other student to explain why they picked their answer and how they reasoned through it.\n"
        "ask follow up questions about their reasoning like 'what makes you think that' or 'how did you trace through it'.\n"
        "do not push them toward a different answer or imply their answer is wrong.\n"
        "never reveal or hint at which answer is correct or incorrect.\n"
        "never say things like 'the feedback says' or 'according to the answer' or reference any grading or correctness information.\n"
        "do not make up information that is not in the question.\n"
        "if you are unsure about something say so honestly instead of guessing.\n"
        "if the other student clearly sounds confident or repeats the same answer twice tell them to vote again or submit it.\n"
        "do not continue reasoning after telling them to vote again.\n"
        "focus on getting them to think through the problem not on changing their mind.\n\n"
    )

    if question:
        sys_content += f"question:\n{question}\n\n"
    if code:
        sys_content += f"code:\n{code}\n\n"
    if choices:
        sys_content += "answer choices:\n" + "\n".join(choices) + "\n\n"
    if selected:
        sys_content += f"the other student chose: {selected}\n\n"

    system_msg = {"role": "system", "content": sys_content}

    if not messages:
        reflection = (data.get("reflection") or "").strip()
        if not reflection:
            return JSONResponse(content={"ok": False, "error": "missing reflection"})
        messages = [
            system_msg,
            {"role": "user", "content": f"i chose answer {selected}. my explanation was:\n\n{reflection}"},
        ]
    else:
        if not isinstance(messages, list):
            return JSONResponse(content={"ok": False, "error": "messages must be a list"})
        if len(messages) == 0 or messages[0].get("role") != "system":
            messages = [system_msg] + messages
        else:
            messages[0] = system_msg

    try:
        from rsptx.db.crud import fetch_course
        course = await fetch_course(user.course_name)
        reply = await _call_openai_async(messages, course.id)
    except Exception as e:
        rslogger.exception("LLM reflection failed")
        return JSONResponse(content={"ok": False, "error": str(e)})

    try:
        await create_useinfo_entry(UseinfoValidation(
            course_id=user.course_name,
            sid=user.username,
            div_id=div_id,
            event="llm_peer_sendmessage",
            act=f"to: student:{reply}",
            timestamp=datetime.datetime.utcnow(),
        ))
    except Exception:
        rslogger.exception("Failed to log LLM reply")

    if not reply:
        return JSONResponse(content={"ok": False, "error": "llm returned empty reply (missing api key?)"})

    return JSONResponse(content={"ok": True, "reply": reply})
