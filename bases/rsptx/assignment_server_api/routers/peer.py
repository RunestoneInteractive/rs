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
    fetch_api_token,
    fetch_question,
    replace_user_experiment_entries,
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

# Analogy themes for async LLM mode
# ==================================
PI_THEMES = [
    {"id": "family_tree", "label": "Family Tree"},
    {"id": "geographic", "label": "Geographic Hierarchy"},
    {"id": "html_dom", "label": "HTML/DOM Tree"},
    {"id": "university", "label": "Organizational Hierarchy"},
    {"id": "apartment", "label": "Apartment Building"},
    {"id": "grocery", "label": "Grocery Store"},
    {"id": "airport", "label": "Airport"},
    {"id": "discord", "label": "Discord Server"},
    {"id": "video_game", "label": "Video Game World"},
    {"id": "music_library", "label": "Music Library"},
    {"id": "audio_production", "label": "Audio Production"},
    {"id": "kitchen", "label": "Kitchen Storage"},
]
THEME_BY_ID = {t["id"]: t for t in PI_THEMES}

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
    rslogger.info(
        f"Peer review for assignment {assignment_id} - not yet implemented, redirecting"
    )
    from fastapi.responses import RedirectResponse

    return RedirectResponse(
        url=f"/assignment/instructor/reviewPeerAssignment?assignment_id={assignment_id}"
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

    rslogger.info(
        f"Peer async for assignment {assignment_id}, question {question_num}, user {user.username}"
    )
    templates = Jinja2Templates(directory=template_folder)

    assignment = await fetch_one_assignment(assignment_id)
    if not assignment:
        return JSONResponse(status_code=404, content={"detail": "Assignment not found"})

    if not assignment.peer_async_visible:
        return JSONResponse(
            status_code=403,
            content={
                "message": "After-class peer instruction is not available for this assignment"
            },
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
        has_reflection = await _has_reflection_async(
            current_question.name, user.username
        )

    course_attrs = await fetch_all_course_attributes(course.id)
    latex_macros = course_attrs.get("latex_macros", "")
    enable_likert = course_attrs.get("enable_likert", "false") == "true"

    async_llm_modes_enabled = (
        course_attrs.get("enable_async_llm_modes", "false") == "true"
    )
    has_api_token = await _llm_enabled_async(course.id)
    question_async_mode = (
        (getattr(aq, "async_mode", None) or "standard") if aq else "standard"
    )
    if async_llm_modes_enabled:
        question_use_llm = question_async_mode in ("llm", "analogies")
        llm_enabled = question_use_llm and has_api_token
    else:
        llm_enabled = has_api_token

    if not llm_enabled:
        pi_mode = "standard"
    elif question_async_mode == "analogies":
        pi_mode = "personalized_llm"
    else:
        pi_mode = "generic_llm"

    try:
        await create_useinfo_entry(
            UseinfoValidation(
                course_id=course.course_name,
                sid=user.username,
                div_id=current_question.name if current_question else "",
                event="pi_mode",
                act=json.dumps({"mode": pi_mode}),
                timestamp=datetime.datetime.utcnow(),
            )
        )
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
        "enable_likert": enable_likert,
        "pi_themes_json": json.dumps(PI_THEMES),
        "llm_reply": None,
        "latex_macros": latex_macros,
        "peer_mtime": peer_mtime,
        "is_instructor": False,
        "student_page": True,
        "settings": settings,
        "wp_imports": wp_assets,
    }

    return templates.TemplateResponse("assignment/student/peer_async.html", context)


def split_ab_conditions(
    answerers: list[str],
    in_person_groups: list[set[str]],
    rng: random.Random = random,
) -> tuple[list[str], list[str]]:
    """Split answering students into the verbal (in-person) and chat conditions
    for an A/B peer-instruction experiment.

    Students recorded in the same verbal-discussion group share a single
    condition so that verbal partners are never split into text chat. The full
    recorded group is kept, including partners who did not vote on this question,
    so a non-voting partner is still assigned the same condition.

    :param answerers: students who voted on this question, in the order they
        should be considered when forming clusters (callers typically shuffle).
    :param in_person_groups: recorded verbal-discussion groups, each a set of
        student ids, derived from prior ``peergroup`` useinfo events.
    :param rng: random source; injectable so tests can pass a seeded
        ``random.Random`` for deterministic results. Defaults to the module's
        ``random``.
    :return: ``(peeps_in_person, peeps_in_chat)`` — disjoint lists of student
        ids assigned to the verbal and chat conditions respectively.
    """

    def find_set_containing_string(
        list_of_sets: list[set[str]], target: str
    ) -> set[str]:
        result: set[str] = set()
        for s in list_of_sets:
            if target in s:
                result |= s
        return result

    # Group the answering students into their recorded verbal-discussion
    # clusters. A cluster is assigned to a condition as a whole and is never
    # split, because verbal discussion depends on physical seating.
    clusters: list[list[str]] = []
    clustered: set[str] = set()
    for p in answerers:
        if p in clustered:
            continue
        # Keep the full recorded verbal group, including partners who did not
        # vote on this question. Students should stay in the same condition as
        # their verbal partners so they aren't split into text chat. Subtract
        # already-clustered students so clusters stay disjoint when recorded
        # groups overlap.
        grp = set(find_set_containing_string(in_person_groups, p))
        grp -= clustered
        grp.add(p)
        clustered |= grp
        clusters.append(sorted(grp))

    # Assign clusters to conditions with an approximately balanced (~50/50)
    # split rather than an independent per-cluster coin flip. Shuffle for
    # randomness, then use a greedy algorithm to place each cluster into
    # whichever condition currently has fewer students. Singletons (no recorded
    # verbal partner) can only go to text chat, since they have no one to
    # discuss with verbally.
    rng.shuffle(clusters)
    peeps_in_person: list[str] = []
    peeps_in_chat: list[str] = []
    for grp in clusters:
        if len(grp) == 1:
            peeps_in_chat.extend(grp)
            continue
        if len(peeps_in_person) <= len(peeps_in_chat):
            peeps_in_person.extend(grp)
        else:
            peeps_in_chat.extend(grp)

    # Make sure there is at least one student in each condition whenever that is
    # actually possible (i.e. there is more than one cluster, or a multi-person
    # cluster exists to seed the verbal side).
    multi_clusters = [g for g in clusters if len(g) > 1]
    if not peeps_in_person and multi_clusters:
        promote = multi_clusters[0]
        peeps_in_chat = [s for s in peeps_in_chat if s not in promote]
        peeps_in_person.extend(promote)
    if not peeps_in_chat and len(clusters) > 1:
        demote = clusters[-1]
        peeps_in_person = [s for s in peeps_in_person if s not in demote]
        peeps_in_chat.extend(demote)

    return peeps_in_person, peeps_in_chat


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

            # Group answering students into their recorded verbal clusters and
            # split those clusters across the two conditions. See
            # split_ab_conditions for the clustering and balancing rules.
            answerers = [p for p in peeps if p in sid_ans]
            peeps_in_person, peeps_in_chat = split_ab_conditions(
                answerers, in_person_groups
            )

            peeps = [p for p in peeps_in_chat if p in sid_ans]
            rslogger.debug(f"FINAL PEEPS IN CHAT = {peeps}")
            rslogger.debug(f"FINAL PEEPS IN PERSON = {peeps_in_person}")

            # Re-running the experiment will randomize it again so that it can clear any previous assignments to keep one unambiguous group per student.
            # Delete + insert now will happen in a single call so re-running stays fast for larger courses.
            experiment_id = f"{div_id}_ab"
            # Record every clustered student in their group's condition, including
            # students whose partner did not vote, so partners always share a condition
            assignments = [(sid, 0) for sid in peeps_in_person] + [
                (sid, 1) for sid in peeps_in_chat
            ]
            await replace_user_experiment_entries(experiment_id, assignments)

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

        # Broadcast partner information for chat (enableChat).
        # Format matches web2py: "answer" is a JSON dict of {partner_sid: letter_answer}.
        def _to_letter(ans):
            if ans is None:
                return None
            ans = str(ans)
            if ans.isnumeric():
                return chr(65 + int(ans))
            if "," in ans:
                return ",".join([chr(65 + int(x)) for x in ans.split(",")])
            return ans

        for sid in gdict:
            partners = gdict[sid]
            pdict = {p: _to_letter(sid_ans.get(p)) for p in partners}
            mess = {
                "type": "control",
                "from": sid,
                "to": sid,
                "message": "enableChat",
                "broadcast": False,
                "answer": json.dumps(pdict),
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
            div_id,
            course.course_name,
            start_time_dt,
            end_time_dt,
            exclude_sid=user.username,
        )
        data1 = [{"answer": answer, "rn": 1} for sid, answer in rows1]

        # Get vote 2 data if start_time2 is provided
        data2 = []
        if end_time_dt:
            rows2 = await fetch_student_answers_in_timerange(
                div_id, course.course_name, end_time_dt, exclude_sid=user.username
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
        # Count distinct students who answered, excluding the instructor
        # running the session (they may select an answer on the dashboard view)
        answer_count = await count_distinct_student_answers(
            div_id, course_name, start_time_dt, exclude_sid=user.username
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
        rows = await fetch_recent_student_answers(
            div_id, course_name, start_time_dt, exclude_sid=user.username
        )

        if not rows:
            return JSONResponse(content={"pct_correct": 0})

        total = len(rows)
        correct = sum(1 for sid, answer, is_correct in rows if is_correct is True)

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
                event="ratepeer",
                act=f"{peer_id}:{rating}",
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
    if course.course_name == course.base_course:
        return JSONResponse(status_code=403, content={})

    students = await fetch_course_students(course.id)
    result = {s.username: f"{s.first_name} {s.last_name}".strip() for s in students}
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
        return JSONResponse(
            status_code=404, content={"ok": False, "error": "assignment not found"}
        )
    if assignment.course != course.id:
        return JSONResponse(
            status_code=403,
            content={"ok": False, "error": "assignment does not belong to your course"},
        )

    assignment.peer_async_visible = not bool(assignment.peer_async_visible)
    await update_assignment(assignment, pi_update=True)

    rslogger.info(
        f"Toggled peer_async_visible for assignment {assignment_id} to {assignment.peer_async_visible}"
    )
    return JSONResponse(content={"peer_async_visible": assignment.peer_async_visible})


@router.post("/api/get_async_explainer")
async def get_async_explainer(
    request: Request,
    div_id: str = Body(...),
    course: str = Body(...),
    user=Depends(auth_manager),
):

    from sqlalchemy import select

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

        return JSONResponse(
            content={"mess": mess, "user": "", "answer": "", "responses": {}}
        )

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
        async with session.post(
            url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=30)
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
    rslogger.warning(f"PEER LLM CALL | provider=openai-course-token | model={model}")
    return data["choices"][0]["message"]["content"].strip()


async def _generate_analogy_mapping_async(
    question: str,
    code: str,
    choices: list,
    theme_label: str,
    selected: str = "",
    reflection: str = "",
    course_id: int = 0,
):
    """
    Produces a structural mapping between the question's CS concept and the
    student's chosen theme, plus the first message to send to the student.
    Returns (mapping_string, first_message) or ("", "") on failure.
    """
    context_parts = []
    if question:
        context_parts.append(f"Question: {question}")
    if code:
        context_parts.append(f"Code:\n{code}")
    if choices:
        context_parts.append("Choices:\n" + "\n".join(choices))
    if selected:
        context_parts.append(f"Student's answer: {selected}")
    if reflection:
        context_parts.append(f"Student's explanation: {reflection}")
    context = "\n\n".join(context_parts)

    prompt = (
        f"Read this CS question carefully:\n\n"
        f"{context}\n\n"
        f"The student chose '{theme_label}' as their analogy theme.\n\n"
        f"Step 1: Identify the underlying CS concept this question is testing — one sentence, specific about what structurally happens (not just the topic name).\n\n"
        f"Step 2: Break the question's structure down into its meaningful spatial or logical elements — the starting point, the required location to perform the action, the target item, and the action itself. Do NOT include the command syntax itself as an element. Do NOT evaluate the outcome or describe dependencies (do not write elements like 'the outcome depends on...' or 'the action requires...'). Focus only on what factually exists: where the student currently is, where the target item is, and what location is needed to perform the action. Describe elements factually and neutrally. The structure should describe what exists, not what the right reasoning is. Use bullet points, one element per line.\n\n"
        f"Step 3: Find a real, concrete, familiar situation in '{theme_label}' that structurally mirrors the question. Map each element from step 2 to a specific, real, recognizable thing from that situation — not invented names or generic labels. CRITICAL: never use CS or file system terminology on the right side of the mapping — do not name a theme item after a folder name, variable name, or command (e.g. do not write 'project aisle' or 'backup section' — those are just CS names with a theme word appended). Instead use things that actually exist in '{theme_label}' (e.g. 'dairy section', 'frozen foods aisle', 'checkout counter'). The theme items should feel like something a person familiar with '{theme_label}' would immediately picture with no knowledge of CS. CRITICAL: if the question is about being in the right location to perform an action, the target item DOES exist at the required location — the only issue is whether the student is in the right place to reach it. Make this clear in the mapping: the item is there, the student just needs to get there. Do not create any ambiguity about whether the item exists. The required location must be somewhere the person would normally go — do not map it to a staff-only or restricted area (e.g. do not use 'back stockroom' in a grocery store — customers do not go there; use a specific aisle or section instead). The scene must start in a natural, already-stable state — do not invent events to explain how things came to be. IMPORTANT: if the question involves navigating toward a root or parent (e.g. `..` in a file path), that means moving toward the outermost container — in a building this is the ground floor or lobby, NOT a higher floor. Deep nested = higher up, closer to root = lower/ground. Make sure the direction in your theme matches this intuition. CRITICAL: the mapped action must be a concrete, physical, presence-required activity — something that only makes sense when you are physically at the required location. Do NOT map 'edit/run/modify a file' to any kind of writing, editing, or rewriting action on a document, card, or paper — documents are portable and can be edited anywhere, which breaks the analogy. Instead map the CS action to the act of REACHING, GRABBING, OR USING a fixed item that lives at that location: reach for a jar on a shelf, use the blender on the counter, pick up a bag at a carousel, order at a specific counter. The mapped item should be something fixed at the required location that you can only interact with by being there.\n\n"
        f"Step 4: Write the first message the LLM peer will send to the student. This message should:\n"
        f"- Be in casual, lowercase, peer voice — like a student talking to another student\n"
        f"- Use minimal commas\n"
        f"- Introduce the scene to the student from scratch — they have never heard of this scenario. Do not say 'i'm picturing X' or reference the scenario as if they already know it. Start with 'imagine you're in...' or 'so picture this...' to actually place them in the situation\n"
        f"- Set the scene in 1-2 sentences using theme vocabulary only — no file paths, no CS terms, no variable names\n"
        f"- Name the specific locations from your mapping (e.g. 'the dairy section' not 'an aisle') so the conversation is grounded from the start\n"
        f"- After placing them in the scene, ask a specific, concrete location question using the exact mapped action — e.g. 'can you board your flight from the lobby or do you need to get to gate 12 first?' not vague questions like 'can you use it from here' or 'where does the item end up'. The action in the question must be the specific mapped action, not a generic 'use it' or 'access it'.\n"
        f"- Do NOT assume the student is wrong — the question works whether they are right or wrong\n"
        f"- Never imply the student is wrong or ask a rhetorical question with an obvious answer\n"
        f"- Never say 'our scenario' or announce it as an analogy\n"
        f"- Do not narrate the full trace — set the scene then ask them to trace it\n\n"
        f"Output ONLY in this exact format:\n"
        f"CONCEPT: [one sentence]\n"
        f"STRUCTURE:\n"
        f"- [element 1]\n"
        f"- [element 2]\n"
        f"- ...\n"
        f"MAPPING:\n"
        f"- [element 1] -> [theme equivalent]\n"
        f"- [element 2] -> [theme equivalent]\n"
        f"- ...\n"
        f"FIRST_MESSAGE: [the first message to send]\n"
    )

    try:
        import os
        import aiohttp

        token_row = await fetch_api_token(course_id, "openai")
        if not token_row or not token_row.token:
            return "", ""
        api_key = token_row.token
        model = (
            os.environ.get("PI_OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
        )
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 700,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=45),
            ) as resp:
                resp.raise_for_status()
                result = await resp.json()
        raw = result["choices"][0]["message"]["content"].strip()
        rslogger.warning(f"ANALOGY MAPPING RAW RESPONSE:\n{raw}")
        first_message = ""
        mapping = raw
        if "FIRST_MESSAGE:" in raw:
            parts = raw.split("FIRST_MESSAGE:", 1)
            mapping = parts[0].strip()
            first_message = parts[1].strip()
        rslogger.warning(
            f"ANALOGY MAPPING parsed | mapping_len={len(mapping)} first_message_len={len(first_message)} first_message_preview={first_message[:120]!r}"
        )
        return mapping, first_message
    except Exception:
        rslogger.exception("Failed to generate analogy mapping")
        return "", ""


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
    theme_id = (data.get("theme_id") or "").strip()
    analogy_mapping = (data.get("analogy_mapping") or "").strip()

    if theme_id and div_id:
        theme_obj = THEME_BY_ID.get(theme_id)
        theme_label = theme_obj["label"] if theme_obj else theme_id

        try:
            await create_useinfo_entry(
                UseinfoValidation(
                    course_id=user.course_name,
                    sid=user.username,
                    div_id=div_id,
                    event="pi_theme",
                    act=json.dumps(
                        {
                            "theme_id": theme_id,
                            "theme_label": theme_label,
                        }
                    ),
                    timestamp=datetime.datetime.utcnow(),
                )
            )
        except Exception:
            rslogger.exception("Failed to log personalized LLM theme")

    if not div_id:
        return JSONResponse(content={"ok": False, "error": "missing div_id"})

    try:
        user_msgs = [m for m in (messages or []) if m.get("role") == "user"]
        for idx, m in enumerate(user_msgs):
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if idx == 0:
                await create_useinfo_entry(
                    UseinfoValidation(
                        course_id=user.course_name,
                        sid=user.username,
                        div_id=div_id,
                        event="reflection",
                        act=content,
                        timestamp=datetime.datetime.utcnow(),
                    )
                )
            else:
                await create_useinfo_entry(
                    UseinfoValidation(
                        course_id=user.course_name,
                        sid=user.username,
                        div_id=div_id,
                        event="sendmessage",
                        act=f"to:llm:{content}",
                        timestamp=datetime.datetime.utcnow(),
                    )
                )
    except Exception:
        rslogger.exception("Failed to log LLM user message")

    question, code, choices = await _get_mcq_context_async(div_id)

    reflection_text = (data.get("reflection") or "").strip()
    if not reflection_text and messages:
        first_user = next((m for m in messages if m.get("role") == "user"), None)
        if first_user:
            reflection_text = (first_user.get("content") or "").strip()

    generated_mapping = ""
    generated_first_message = ""
    if theme_id and not analogy_mapping:
        theme_obj = THEME_BY_ID.get(theme_id)
        if theme_obj:
            try:
                from rsptx.db.crud import fetch_course

                course_row = await fetch_course(user.course_name)
                generated_mapping, generated_first_message = (
                    await _generate_analogy_mapping_async(
                        question,
                        code,
                        choices,
                        theme_obj["label"],
                        selected=selected,
                        reflection=reflection_text,
                        course_id=course_row.id,
                    )
                )
                if generated_mapping:
                    analogy_mapping = generated_mapping
            except Exception:
                rslogger.exception("Failed to generate analogy mapping")

    analogy_preamble = ""
    if theme_id:
        theme = THEME_BY_ID.get(theme_id)
        rslogger.warning(
            f"PEER ANALOGY | theme_id={theme_id!r} theme={theme} has_mapping={bool(analogy_mapping)}"
        )
        if theme:
            theme_label = theme["label"]
            if analogy_mapping:
                analogy_preamble = (
                    f"the student chose '{theme_label}' as their analogy theme. here is a structural mapping between the question and the theme:\n"
                    f"{analogy_mapping}\n"
                    f"\n"
                    f"use this mapping to frame your conversation naturally. the student has never seen this mapping — you are introducing this scenario to them for the first time.\n"
                    f"IMPORTANT: in conversation only ever use the RIGHT side of the mapping (the theme terms). never use the LEFT side (the CS/file system terms) when talking in the analogy — so if the mapping says 'project/ folder -> dairy section' you say 'dairy section' never 'project folder' or 'project aisle'. this means never say words like 'staging', 'commit', 'repository', 'directory', 'git', or any CS term while you are in the analogy — stay fully in theme vocabulary until the explicit bridge-back moment.\n"
                    f"in your first message: paint the scenario in natural language — describe the situation as if you are telling a story, not reading a list. do not recite the mapping labels (e.g. do not say 'the move action' or 'forest of wisdom' as if they are technical terms — say 'imagine you're walking through...' or 'so you're in the...'). place the student in the scene concretely, then connect it to what they said, then ask a question. do not say 'our scenario' — introduce it fresh.\n"
                    f"in follow-ups: keep using the theme vocabulary. if the student engages with it, build on it. when they seem to understand the structure through the theme, bridge back to the actual question.\n"
                    f"do not formally announce the analogy. do not say 'in the {theme_label} analogy' or 'using {theme_label} as a metaphor'. just talk in those terms naturally.\n"
                    f"if the student makes a claim or assumption, use the theme to have them test it — like 'hmm would that floor even exist in that building tho?'\n"
                )
            else:
                # Mapping generation failed — still enforce the correct theme
                analogy_preamble = (
                    f"the student chose '{theme_label}' as their analogy theme.\n"
                    f"you MUST use only '{theme_label}' vocabulary to frame this conversation — do not invent a different scenario or theme.\n"
                    f"introduce a concrete scene from '{theme_label}' that mirrors the question structure, then ask the student to trace through it.\n"
                    f"never use CS terms or file-system terminology while in the analogy — stay fully in '{theme_label}' language.\n\n"
                )

    base_rules = (
        "only speak in lower case.\n"
        "you are a student talking to another student during peer instruction.\n"
        "you are both looking at the same multiple choice question with code and answers.\n"
        "you remember the question and choices.\n"
        "most messages should be short (1 to 3 sentences often very short).\n"
        "use casual informal language and common typos.\n"
        "never use commas.\n"
        "never use gendered language.\n"
        "do not use new lines.\n"
        "never use em dashes (—) or formal punctuation. write the way you actually talk.\n"
        "do not sound like a teacher.\n"
        "do not explain step by step.\n"
        "never say something is right or wrong.\n"
        "STRICT RULE: every message must begin with one of these allowed openers: a question word ('what', 'where', 'how', 'do', 'can', 'if', 'wait', 'hmm'), or the word 'so' followed immediately by a scenario observation (not 'so exactly' or 'so right'). never begin with 'yeah', 'right', 'exactly', 'correct', 'yes', 'yep', 'true', 'good', 'nice', 'great', 'perfect', 'cool', 'totally', 'sure', 'got it', or any variation. these imply the student is correct. check your first word before every message.\n"
        "never confirm or explain the code outcome after the student says something — only ask them to keep tracing or elaborate.\n"
        "if the student introduces a new assumption or claim, do not build on it as if it is correct — instead use the analogy to make them test that assumption themselves. for example if they claim 'it creates the directory' ask them through the analogy: 'does trying to walk to a floor that doesn't exist create it, or does something else happen?' never validate the assumption, never deny it — just ask them to examine it through the scenario.\n"
        "if an analogy scenario was established, always bring follow-up questions back through that scenario — do not abandon it for direct code talk. never use CS terms (like 'staging', 'commit', 'directory', 'repository', 'file path') in a message that is otherwise in analogy vocabulary — stay fully in the theme language until you are explicitly bridging back.\n"
        "each follow-up must move the conversation forward — do not ask the same question twice in different words. if the student answered your last question, accept that and go one level deeper or bridge back to the actual problem.\n"
        "when referencing a structural detail of the scenario in a follow-up, briefly restate that detail in the same message — do not assume the student remembers the exact structure from the first message. for example: 'remember in that tree the grandparent has two children — user and shared. you are currently under user...' then ask your question.\n"
        "never say things like 'let's focus on the code' or 'going back to the code' — always route through the scenario instead.\n"
        "if the student themselves references the analogy, use that as an opening to deepen it — never redirect away from it.\n"
        "once the student has traced through the analogy and seems to understand the structure, explicitly bridge back to the question — ask them to apply that same reasoning to the actual problem values or code.\n"
        "do not let the analogy float indefinitely without connecting it back to the question. the goal is for the student to say 'oh so in the question that means...' — guide them there.\n"
        "never use phrases like 'not quite' or 'not exactly' or 'almost' or 'close' or 'not yet' or any phrase that implies the student is incorrect.\n"
        "never react to whether the student's answer is correct or incorrect — only ask them to explain their reasoning.\n"
        "never use the analogy to imply the student's answer is wrong.\n"
        "never end a message with a rhetorical question whose obvious answer signals the student is wrong — like 'does that room just appear?' or 'is there really a backup area there?' — these tell the student they are wrong.\n"
        "instead: have the student trace through the scenario step by step. ask where they end up after each step, or ask them to walk you through what they think each part of the command does in the scenario. keep questions open — 'where does that put you?' not 'does that even exist?'\n"
        "the student should discover whether their answer is right or wrong by tracing through the analogy themselves.\n"
        "never connect the analogy conclusion back to a specific answer choice — do not say things like 'answer B says you need to be in X — does that match up with needing to be in the new server?' because this confirms the answer without saying it. if the student has traced through the analogy and reached a conclusion ask them what that tells them about the problem and let THEM connect it back to their choice — never make that connection for them.\n"
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
        "if the other student mentions the same answer more than once or sounds confident in their answer you must tell them to go ahead and vote again — this overrides everything else.\n"
        "do not ask another question or continue the analogy after they have confirmed their answer — just tell them to vote.\n"
        "do not continue reasoning after telling them to vote again.\n"
        "focus on getting them to think through the problem not on changing their mind.\n\n"
    )

    context_suffix = ""
    if question:
        context_suffix += f"question:\n{question}\n\n"
    if code:
        context_suffix += f"code:\n{code}\n\n"
    if choices:
        context_suffix += "answer choices:\n" + "\n".join(choices) + "\n\n"
    if selected:
        context_suffix += f"the other student chose: {selected}\n\n"

    sys_content = analogy_preamble + base_rules + context_suffix
    system_msg = {"role": "system", "content": sys_content}

    if not messages:
        reflection = (data.get("reflection") or "").strip()
        if not reflection:
            return JSONResponse(content={"ok": False, "error": "missing reflection"})
        messages = [
            system_msg,
            {
                "role": "user",
                "content": f"i chose answer {selected}. my explanation was:\n\n{reflection}",
            },
        ]
    else:
        if not isinstance(messages, list):
            return JSONResponse(
                content={"ok": False, "error": "messages must be a list"}
            )
        if len(messages) == 0 or messages[0].get("role") != "system":
            messages = [system_msg] + messages
        else:
            messages[0] = system_msg

    try:
        from rsptx.db.crud import fetch_course

        course = await fetch_course(user.course_name)
        user_turn_count = sum(1 for m in messages if m.get("role") == "user")
        if generated_first_message and user_turn_count <= 1:
            reply = generated_first_message
        else:
            reply = await _call_openai_async(messages, course.id)
    except Exception as e:
        rslogger.exception("LLM reflection failed")
        return JSONResponse(content={"ok": False, "error": str(e)})

    try:
        await create_useinfo_entry(
            UseinfoValidation(
                course_id=user.course_name,
                sid=user.username,
                div_id=div_id,
                event="llm_peer_sendmessage",
                act=f"to: student:{reply}",
                timestamp=datetime.datetime.utcnow(),
            )
        )
    except Exception:
        rslogger.exception("Failed to log LLM reply")

    if not reply:
        return JSONResponse(
            content={
                "ok": False,
                "error": "llm returned empty reply (missing api key?)",
            }
        )

    result = {"ok": True, "reply": reply}
    if generated_mapping:
        result["analogy_mapping"] = generated_mapping
    return JSONResponse(content=result)
