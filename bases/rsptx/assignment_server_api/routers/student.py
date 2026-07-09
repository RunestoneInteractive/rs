# *************************
# |docname| - Runestone API
# *************************
# This module implements the Student facing API for assignments
#
# *     chooseAssignment
# *     doAssignment
# *     studentreport
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import csv
import datetime
import io
from typing import Optional
import json
import re
import requests

# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request, Cookie
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    StreamingResponse,
)
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import (
    create_useinfo_entry,
    fetch_assignments,
    fetch_all_assignment_stats,
    fetch_all_grades_for_assignment,
    fetch_grade,
    upsert_grade,
    fetch_lti_version,
    fetch_course,
    fetch_all_course_attributes,
    fetch_code_for_sid,
    fetch_deadline_exception,
    fetch_one_assignment,
    fetch_assignment_questions,
    fetch_question_grade,
    fetch_assignment_release_for_div_id,
    fetch_recent_useinfo,
    fetch_user,
    fetch_user_chapter_progress,
    fetch_user_sub_chapter_progress,
    fetch_useinfo_for_sid,
    get_book_chapters,
    get_book_subchapters,
)
from rsptx.grading_helpers.core import check_for_exceptions

from rsptx.db.models import GradeValidator, UseinfoValidation, CoursesValidator
from rsptx.db.crud.assignment import is_assignment_visible_to_students
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.templates import template_folder, get_jinja_templates
from rsptx.response_helpers import construct_course_url, safe_join
from rsptx.response_helpers.core import (
    make_json_response,
    get_webpack_static_imports,
    canonical_utcnow,
)
from rsptx.configuration import settings

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/student",
    tags=["student"],
)


# getAssessResults
# ----------------
@router.get("/chooseAssignment")
async def get_assignments(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    RS_info: Optional[str] = Cookie(None),
):
    """Create the chooseAssignment page for the user.

    :param request: _description_
    :type request: Request
    :param user: _description_, defaults to Depends(auth_manager
    :type user: _type_, optional
    :param response_class: _description_, defaults to HTMLResponse
    :type response_class: _type_, optional
    """

    sid = user.username
    course = await fetch_course(user.course_name)
    course_attrs = await fetch_all_course_attributes(course.id)
    is_lti1p1_course = await fetch_lti_version(course.id) == "1.1"

    course_markup_system = course_attrs.get("markup_system", "Runestone")

    user_is_instructor = await is_instructor(request, user=user)
    if user_is_instructor:
        # if the user is an instructor, we need to show all assignments
        assignments = await fetch_assignments(course.course_name, fetch_all=True)
    else:
        # Use is_visible=True to apply SQL-level scheduled visibility filtering
        # (respects visible_on and hidden_on dates)
        assignments = await fetch_assignments(course.course_name, is_visible=True)
    # fetch all deadline exceptions for the user
    accommodations = await fetch_deadline_exception(
        course.id, user.username, fetch_all=True
    )
    # filter assignments based on deadline exceptions
    assignment_ids = [a.assignment_id for a in accommodations]
    if not user_is_instructor:
        # Also include assignments the student has deadline exceptions for,
        # even if they are not currently visible via scheduled dates
        if assignment_ids:
            all_assignments = await fetch_assignments(
                course.course_name, fetch_all=True
            )
            exception_assignments = [
                a
                for a in all_assignments
                if a.id in assignment_ids and not is_assignment_visible_to_students(a)
            ]
            assignments = list(assignments) + exception_assignments

    parsed_js = json.loads(RS_info) if RS_info else {}
    timezoneoffset = parsed_js.get("tz_offset", None)

    def sort_key(assignment):
        deadline = assignment.duedate
        if timezoneoffset:
            deadline = deadline + datetime.timedelta(hours=float(timezoneoffset))
            return (
                deadline < canonical_utcnow(),
                abs((deadline - canonical_utcnow()).total_seconds()),
            )
        else:
            return (
                assignment.duedate < canonical_utcnow(),
                abs((assignment.duedate - canonical_utcnow()).total_seconds()),
            )

    # Sort assignments: upcoming assignments first (closest to current date), past due assignments last
    now = canonical_utcnow()
    assignments.sort(key=sort_key)
    stats_list = await fetch_all_assignment_stats(course.course_name, user.id)
    stats = {}
    for s in stats_list:
        stats[s.assignment] = s
    rslogger.debug(f"stats: {stats}")

    # Build a visibility map for the template.
    # For instructors: enables the "Student View: Hide Hidden Assignments" toggle
    # For students: ensures scheduled assignments (visible_on/hidden_on) get correct CSS class
    # This takes into account visible_on and hidden_on dates, not just the visible flag
    visibility_map = {}
    for a in assignments:
        visibility_map[a.id] = is_assignment_visible_to_students(a)

    use_pretext_student_pages = (
        str(course_attrs.get("use_pretext_student_pages", "false")).lower() == "true"
    )
    if use_pretext_student_pages:
        book_path = safe_join(
            settings.book_path,
            course.base_course,
            "published",
            course.base_course,
        )
        if book_path:
            templates = get_jinja_templates(book_path)
        else:
            rslogger.warning(
                "Unsafe or invalid book_path computed for course %s; falling back to shared templates",
                course.course_name,
            )
            templates = Jinja2Templates(directory=template_folder)
    else:
        templates = Jinja2Templates(directory=template_folder)

    context = dict(
        course=course,
        course_name=user.course_name,
        request=request,
        assignment_list=assignments,
        readings="null",  # force bookfuncs to not render assignment tracker
        stats=stats,
        user=sid,
        is_logged_in="true",
        is_instructor="true" if user_is_instructor else "false",
        student_page=True,
        lti1p1=is_lti1p1_course,
        now=now,
        visibility_map=visibility_map,
        settings=settings,
        base_url=construct_course_url(course),
        activity_info="{}",
        downloads_enabled="true" if course.downloads_enabled else "false",
        allow_pairs="true" if course.allow_pairs else "false",
        origin=course_markup_system,
        **course_attrs,
    )
    return templates.TemplateResponse(
        "assignment/student/chooseAssignment.html", context
    )


# studentreport
# -------------
# A student's progress report: book completion, assignment grades, profile
# information and recent activity.  This is a port of the legacy web2py
# ``dashboard/studentreport`` controller.  An instructor may view any student in
# their course by passing ``?id=<username>``; a student sees only their own
# report.
_COMPLETION_STATUS_TEXT = {1: "completed", 0: "started", -1: "notstarted"}


def _build_chapter_progress(chapters, subchapters, progress):
    """Build the "Book Completion" data structure for the progress report.

    :param chapters: List[ChapterValidator] ordered by chapter_num.
    :param subchapters: List[SubChapterValidator] ordered by chapter/subchapter.
    :param progress: List[UserSubChapterProgressValidator] for the student.
        Note ``chapter_id`` here holds the chapter *label* and ``sub_chapter_id``
        holds the subchapter *label*.
    :return: A list of dicts with ``label``, ``status`` and ``subchapters``.
    """
    # Map a chapter's numeric id -> its label, so we can group subchapters
    # (which reference Chapter.id) by the chapter label used in the progress
    # table.
    label_by_id = {c.id: c.chapter_label for c in chapters}

    # chapter_label -> {sub_chapter_label: sub_chapter_name} (preserving order)
    subnames_by_chapter: dict = {}
    for sc in subchapters:
        clabel = label_by_id.get(sc.chapter_id)
        if clabel is None:
            continue
        subnames_by_chapter.setdefault(clabel, {})[
            sc.sub_chapter_label
        ] = sc.sub_chapter_name

    # chapter_label -> {sub_chapter_label: status}
    progress_by_chapter: dict = {}
    for p in progress:
        progress_by_chapter.setdefault(p.chapter_id, {})[p.sub_chapter_id] = p.status

    result = []
    for chapter in chapters:
        clabel = chapter.chapter_label
        chap_progress = progress_by_chapter.get(clabel, {})

        # Determine the chapter-level status the same way the legacy dashboard
        # did: completed only if every started subchapter is completed, started
        # if any progress exists, otherwise not started.
        highest = -1
        lowest = 1
        for status in chap_progress.values():
            lowest = min(lowest, status)
            highest = max(highest, status)
        if highest == -1:
            chapter_status = -1
        elif lowest == 1:
            chapter_status = 1
        else:
            chapter_status = 0

        sub_name_map = subnames_by_chapter.get(clabel, {})
        sub_list = []
        for sub_label, status in chap_progress.items():
            sub_list.append(
                {
                    "label": sub_name_map.get(sub_label, sub_label),
                    "status": _COMPLETION_STATUS_TEXT.get(status, status),
                }
            )

        result.append(
            {
                "label": chapter.chapter_name,
                "status": _COMPLETION_STATUS_TEXT.get(chapter_status, chapter_status),
                "subchapters": sub_list,
            }
        )
    return result


async def _build_assignment_grades(course_name, target_id, student_view):
    """Build the per-assignment grade table (score, percent, class average).

    :param course_name: The course name.
    :param target_id: The auth_user id of the student being reported on.
    :param student_view: bool, True when a student is viewing their own report;
        unreleased assignments are shown as N/A in that case.
    :return: dict keyed by assignment name.
    """
    assignments = await fetch_assignments(course_name, fetch_all=True)
    grades = {}
    for assign in assignments:
        due_date = assign.duedate.date().strftime("%m-%d-%Y")
        entry = {
            "score": "N/A",
            "pct": "N/A",
            "class_average": "N/A",
            "due_date": due_date,
        }
        if not (student_view and not assign.released):
            all_grades = await fetch_all_grades_for_assignment(assign.id)
            total = 0.0
            count = 0
            for g in all_grades:
                if g.score is not None:
                    total += g.score
                    count += 1
                    if g.auth_user == target_id:
                        entry["score"] = g.score
                        if assign.points:
                            entry["pct"] = round(100 * g.score / assign.points)
                        else:
                            entry["pct"] = "N/A"
            average = total / count if count else 0
            entry["class_average"] = "{:.02f}".format(average)
        grades[assign.name] = entry
    return grades


def _validators_to_csv(rows) -> str:
    """Serialize a list of pydantic validator objects to CSV text."""
    output = io.StringIO()
    if not rows:
        return output.getvalue()
    fieldnames = list(rows[0].dict().keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row.dict())
    return output.getvalue()


@router.get("/studentreport")
async def studentreport(
    request: Request,
    id: Optional[str] = None,
    action: Optional[str] = None,
    user=Depends(auth_manager),
):
    """Render the student progress report (book completion, grades, profile and
    recent activity).  Instructors may pass ``?id=<username>`` to view another
    student; ``?action=dlcsv`` / ``?action=dlcode`` download the student's raw
    activity / code history as CSV.
    """
    course = await fetch_course(user.course_name)
    user_is_instructor = await is_instructor(request, user=user)

    if id and user_is_instructor:
        sid = id
        target_user = await fetch_user(id)
    else:
        sid = user.username
        target_user = user

    # Students only see released assignment grades; instructors see everything
    # (matches the legacy dashboard ``studentView = not for_dashboard``).
    student_view = not user_is_instructor

    if not target_user:
        return RedirectResponse(url="/assignment/student/chooseAssignment")

    # CSV downloads -----------------------------------------------------------
    if action == "dlcsv":
        rows = await fetch_useinfo_for_sid(sid, course.course_name)
        return StreamingResponse(
            iter([_validators_to_csv(rows)]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="data_for_{sid}.csv"'
            },
        )
    if action == "dlcode":
        rows = await fetch_code_for_sid(sid, course.id)
        return StreamingResponse(
            iter([_validators_to_csv(rows)]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="code_for_{sid}.csv"'
            },
        )

    # Book completion ---------------------------------------------------------
    base_course = course.base_course
    chapters = await get_book_chapters(base_course)
    subchapters = await get_book_subchapters(base_course)
    progress = await fetch_user_sub_chapter_progress(target_user)
    chapter_progress = _build_chapter_progress(chapters, subchapters, progress)

    # Grades ------------------------------------------------------------------
    grades = await _build_assignment_grades(
        course.course_name, target_user.id, student_view
    )

    # Recent activity ---------------------------------------------------------
    activity = await fetch_recent_useinfo(sid, course.course_name)

    templates = Jinja2Templates(directory=template_folder)
    context = dict(
        request=request,
        course=course,
        user=target_user,
        is_instructor=user_is_instructor,
        student_page=True,
        chapters=chapter_progress,
        assignments=grades,
        activity=activity,
        target_id=id if (id and user_is_instructor) else None,
    )
    return templates.TemplateResponse("assignment/student/studentreport.html", context)


class UpdateStatusRequest(BaseModel):
    """
    This is the request data for the update_submit endpoint. We use a Pydantic model so that
    the data is validated before it is passed to the endpoint.
    """

    assignment_id: int
    new_state: Optional[str] = None


def get_studyclues_book_id(course: CoursesValidator) -> str:
    """Get the StudyClues book ID for a given course.

    :param course: The course object.
    :type course: CoursesValidator
    :return: The StudyClues book ID.
    :rtype: str
    """
    # This is a placeholder implementation. You should replace this with your actual logic to get the book ID.
    # For example, you might have a mapping of course names to book IDs.
    course_to_book_id = {
        "csawesome2": 28,
        "httlacs": 29,
        "py4e-int": 30,
        "cppds2": 35,
        "thinkcspy": 36,
        "dmoi-4": 41,
        "ac-single": 42,
        "py4eint": 43,
        "foppff": 44,
        # Add more mappings as needed
    }
    return course_to_book_id.get(course.base_course, 28)


class StudyCluesQueryRequest(BaseModel):
    query: str
    conversation_id: Optional[int] = -1
    coachMode: Optional[bool] = False


@router.post("/studyclues_query")
async def studyclues_query(
    request_data: StudyCluesQueryRequest,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    """Proxy a student query to StudyClues and return the response payload."""

    api_base_domain = getattr(
        settings,
        "studyclues_api_base_url",
        "https://api.demo.learningclues.com/",
    )
    query_studyclues_post_url = f"{api_base_domain.rstrip('/')}/studyclues/query"

    # Maybe cache the user_id for StudyClues in the future in Redis
    runestone_login_url = f"{api_base_domain.rstrip('/')}/auth/runestone_login"
    params = {"runestone_username": user.username}
    rslogger.debug(
        f"Logging in to StudyClues with params: {params} and url: {runestone_login_url}"
    )
    response = requests.get(runestone_login_url, params=params)
    if response.status_code != 200:
        rslogger.error(
            f"StudyClues login request failed with status {response.status_code}: {response.text}"
        )
        return make_json_response(
            status=502,
            detail={
                "success": False,
                "message": "StudyClues login request failed",
                "status_code": response.status_code,
            },
        )
    data = response.json()
    lc_user = data.get("user_id")

    course = await fetch_course(user.course_name)
    book_id = get_studyclues_book_id(course)
    studyclues_params = {
        "course_id": book_id,  # todo: make this dynamic based on the basecourse
        "query": request_data.query,
        "num_passages": 20,
        "dry_run": False,
        "user_id": lc_user,
        "conversation_id": request_data.conversation_id,
        "coach_mode": request_data.coachMode,
        "source_priorities": {"GITHUB_FILE": "prioritize"},
    }

    try:
        with requests.Session() as session:
            upstream_response = session.post(
                query_studyclues_post_url,
                json=studyclues_params,
                timeout=30,
            )
            upstream_response.raise_for_status()
            studyclues_response = upstream_response.json()
    except requests.RequestException as err:
        rslogger.error(f"StudyClues request failed: {err}")
        return make_json_response(
            status=502,
            detail={"success": False, "message": "StudyClues request failed"},
        )
    except ValueError:
        rslogger.error("StudyClues returned non-JSON response")
        return make_json_response(
            status=502,
            detail={"success": False, "message": "Invalid StudyClues response"},
        )

    conversation_id = studyclues_response.get(
        "conversation_id", request_data.conversation_id
    )
    return make_json_response(
        detail={"response": studyclues_response, "conversation_id": conversation_id}
    )


@router.post("/update_submit")
async def update_submit(
    request: Request,
    request_data: UpdateStatusRequest,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    """Update the submit date for an assignment.

    This is an API endpoint that is called by the client to update the status of an assignment.
    The endpoint is called updateAssignmentProgress and is defined in assignmentStatus.js.

    :param request: _description_
    :type request: Request
    :param user: _description_, defaults to Depends(auth_manager
    :type user: _type_, optional
    :param response_class: _description_, defaults to JSONResponse
    :type response_class: _type_, optional
    """

    assignment_id = request_data.assignment_id
    is_submit = request_data.new_state

    grade = await fetch_grade(user.id, assignment_id)
    rslogger.debug(f"grade: {grade}")
    if grade:
        # toggles the is_submit variable from True to False
        # keep this clause for backward compatibility
        if is_submit is None:
            if grade.is_submit == "In Progress":
                grade.is_submit = "Finished"
            elif grade.is_submit == "Finished":
                grade.is_submit = "Not Started"
            else:
                grade.is_submit = "In Progress"
        else:
            grade.is_submit = is_submit
    else:
        grade = GradeValidator(
            auth_user=user.id,
            assignment=assignment_id,
            is_submit=is_submit,
            manual_total=False,
        )
    await upsert_grade(grade)

    return make_json_response(detail=dict(success=True))


@router.get("/doAssignment")
async def doAssignment(
    request: Request,
    assignment_id: int | None = None,
    user=Depends(auth_manager),
    RS_info: Optional[str] = Cookie(None),
):
    """
    This is the main entry point for a student to start an assignment.
    """
    course = await fetch_course(user.course_name)

    if not assignment_id:  # noqa: E712
        rslogger.error("BAD ASSIGNMENT = %s assignment %s", course, assignment_id)
        return RedirectResponse("/assignment/student/chooseAssignment")

    course_attrs = await fetch_all_course_attributes(course.id)

    rslogger.debug(f"COURSE = {course} assignment {assignment_id}")
    # Web2Py documentation for querying databases is really helpful here.
    assignment = await fetch_one_assignment(assignment_id)

    if not assignment:
        rslogger.error(
            "NO ASSIGNMENT assign_id = %s course = %s user = %s",
            assignment_id,
            course,
            user.username,
        )

        return RedirectResponse("/assignment/student/chooseAssignment")
    user_is_instructor = await is_instructor(request, user=user)

    if assignment.is_peer or assignment.kind == "Peer":
        # if student redirects to peer assignment
        if not user_is_instructor:
            return RedirectResponse(
                f"/assignment/peer/student/question?assignment_id={assignment_id}"
            )
        else:
            return RedirectResponse(
                f"/assignment/peer/instructor/dashboard?assignment_id={assignment_id}"
            )

    deadline_exception = await check_for_exceptions(user, assignment_id)

    # Check if assignment is visible to students based on visible, visible_on, and hidden_on

    if not is_assignment_visible_to_students(assignment):
        # Allow access for instructors and students with exceptions
        if not (
            await is_instructor(request)
            or deadline_exception.visible
            or deadline_exception.allowLink
        ):
            rslogger.error(
                f"Attempt to access invisible assignment {assignment_id} by {user.username}"
            )
            return RedirectResponse("/assignment/student/chooseAssignment")

    if assignment.points is None:
        assignment.points = 0

    # This query assumes that questions are on a page and in a subchapter that is
    # present in the book.  For many questions that is of course a given.  But for
    # instructor created questions on the web interface it is not. Therefore we
    # store those questions in the chapter the person selects and the subchapter
    # is automatically populated as Exercises.  The implication of this is that IF
    # a book does not have an Exercises.rst page for each chapter then the questions
    # will not appear as a part of the assignment!  This also means that fore a
    # proficiency exam that you are writing as an rst page that the page containing
    # the exam should be linked to a toctree somewhere so that it gets added.
    #
    # write a sql insert statement to add a visible exception for testuser1 for assignment 187
    # insert into deadline_exceptions (course_id, assignment_id, visible, time_limit, due_date, user_id)
    # values ('testcourse', 187, 1, 1, '2020-12-31 23:59:59', 1);
    if assignment.is_timed or assignment.kind == "Timed":
        if assignment.time_limit is not None and deadline_exception.time_limit:
            assignment.time_limit = (
                assignment.time_limit * deadline_exception.time_limit
            )
    if assignment.kind == "Timed":
        assignment.is_timed = True

    questions = await fetch_assignment_questions(assignment_id)

    await create_useinfo_entry(
        UseinfoValidation(
            sid=user.username,
            act="viewassignment",
            div_id=assignment.name,
            event="page",
            timestamp=canonical_utcnow(),
            course_id=course.course_name,
        )
    )
    questionslist = []
    questions_score = 0
    readings = dict()
    readings_score = 0
    needs_manual_grading = False

    # For each question, accumulate information, and add it to either the readings or questions data structure
    # If scores have not been released for the question or if there are no scores yet available, the scoring information will be recorded as empty strings
    qset = set()

    preambles = {course.base_course: course_attrs.get("latex_macros", "")}
    for q in questions:
        if q.Question.htmlsrc:
            # This replacement is to render images
            bts = q.Question.htmlsrc
            htmlsrc = bts.replace(
                'src="../_static/', 'src="' + construct_course_url(course, "_static/")
            )
            htmlsrc = htmlsrc.replace(
                "../_images", construct_course_url(course, "_images")
            )
            htmlsrc = htmlsrc.replace(
                'src=\\"external', 'src=\\"' + construct_course_url(course, "external")
            )
            # htmlsrc = htmlsrc.replace(
            #     "generated/webwork", get_course_url(course, "generated/webwork")
            # )
            # rewrite xref links and knowls in fillintheblank questions
            if "fillintheblank" in htmlsrc:
                htmlsrc = htmlsrc.replace(
                    'href="', f'href="/ns/books/published/{course.base_course}/'
                )

            # Unescape contents of script tags in fitb questions.
            if "application/json" in htmlsrc:
                htmlsrc = htmlsrc.replace("&lt;", "<")
                htmlsrc = htmlsrc.replace("&gt;", ">")
                htmlsrc = htmlsrc.replace("&amp;", "&")

            if 'data-knowl="./' in htmlsrc:
                htmlsrc = htmlsrc.replace(
                    'data-knowl="./',
                    f'data-knowl="/ns/books/published/{course.base_course}/',
                )
            # check if the htmlsrc contains a self closing iframe tag (using a regex) and if so, replace it with a regular iframe tag
            if re.search(r"<iframe[^>]*?\/>", htmlsrc):
                htmlsrc = re.sub(
                    r"<iframe([^>]*?)\/>", r"<iframe\1>  </iframe>", htmlsrc
                )

        else:
            htmlsrc = None

        # get score and comment
        grade = await fetch_question_grade(
            user.username, user.course_name, q.Question.name
        )
        if grade:
            score, comment = grade.score, grade.comment
        else:
            score, comment = 0, "ungraded"

        if score is None:
            score = 0

        is_incorrect = score == 0 and comment != "ungraded"

        chap_label = q.Question.chapter
        subchap_label = q.Question.subchapter
        if q.Question.base_course not in preambles:
            preambles[q.Question.base_course] = await addPreamble(
                q.Question.base_course
            )

        # Temporarily prevent chapter numbers from being duplicated while we unwind
        # number being added to chapter name in DB. Assume any leaning numbers are
        # not part of the chapter name and should be stripped off.
        chapter_name = q.Chapter.chapter_name
        chapter_name = re.sub(r"^\d+\s*", "", chapter_name)
        chapter_chapter_name = q.SubChapter.sub_chapter_name
        chapter_chapter_name = re.sub(r"^[\d\.]+\s*", "", chapter_chapter_name)

        info = dict(
            htmlsrc=htmlsrc,
            score=score,
            is_incorrect=is_incorrect,
            points=q.AssignmentQuestion.points,
            comment=comment,
            name=q.Question.name,
            qnumber=q.Question.qnumber,
            question_type=q.Question.question_type,
            activities_required=q.AssignmentQuestion.activities_required,
            chapter_name=chapter_name,
            chapter_label=chap_label,
            chapter_num=q.Chapter.chapter_num,
            chapter_chapter_name=chapter_chapter_name,
            sub_chapter_label=subchap_label,
            chapter_chapter_num=q.SubChapter.sub_chapter_num,
            base_url=construct_course_url(course),
            # for rendering with ptx template, we need these for the menu
            is_logged_in="true",
            is_instructor="true" if user_is_instructor else "false",
            readings=[],
            activity_info="{}",
            downloads_enabled="true" if course.downloads_enabled else "false",
            allow_pairs="true" if course.allow_pairs else "false",
            **course_attrs,
        )
        if q.AssignmentQuestion.autograde == "manual":
            if comment == "ungraded":
                needs_manual_grading = True
            info["how_graded"] = "Needs Manual Grading"
        elif q.AssignmentQuestion.which_to_grade == "first_answer":
            info["how_graded"] = "First Answer"
        elif q.AssignmentQuestion.which_to_grade == "last_answer":
            info["how_graded"] = "Last Answer"
        elif q.AssignmentQuestion.which_to_grade == "best_answer":
            info["how_graded"] = "Best Answer"

        if q.AssignmentQuestion.reading_assignment:
            # add to readings
            if chap_label not in readings:
                # add chapter info
                completion = await fetch_user_chapter_progress(user, chap_label)
                if not completion:
                    status = "notstarted"
                elif completion.status == 1:
                    status = "completed"
                elif completion.status == 0:
                    status = "started"
                else:
                    status = "notstarted"
                readings[chap_label] = dict(
                    status=status,
                    subchapters=[],
                    chapter_label=chap_label,
                    chapter_name=chapter_name,
                    chapter_num=q.Chapter.chapter_num,
                )

            # add subchapter info
            # add completion status to info
            subch_completion = await fetch_user_sub_chapter_progress(
                user, chap_label, subchap_label
            )

            if not subch_completion:
                status = "notstarted"
            elif subch_completion[0].status == 1:
                status = "completed"
            elif subch_completion[0].status == 0:
                status = "started"
            else:
                status = "notstarted"
            info["status"] = status

            # Make sure we don't create duplicate entries for older courses. New style
            # courses only have the base course in the database, but old will have both
            if info not in readings[chap_label]["subchapters"]:
                readings[chap_label]["subchapters"].append(info)
                readings_score += info["score"]

        else:
            if (
                q.Question.name not in qset and info not in questionslist
            ):  # add to questions
                questionslist.append(info)
                questions_score += info["score"]
                qset.add(q.Question.name)
    # Just to be sure we are current, we will update the total score for the assignment
    current_grade = await fetch_grade(user.id, assignment_id)
    if current_grade and current_grade.score != (readings_score + questions_score):
        rslogger.debug(
            f"Updating total score for {user.id} assignment {assignment_id} to {current_grade.score}"
        )
        current_grade.score = readings_score + questions_score
        await upsert_grade(current_grade)
    elif not current_grade:
        new_grade = GradeValidator(
            auth_user=user.id,
            assignment=assignment_id,
            is_submit="",
            manual_total=False,
            score=readings_score + questions_score,
        )
        await upsert_grade(new_grade)
        rslogger.debug(
            f"Creating total score for {user.id} assignment {assignment_id} to {new_grade.score}"
        )

    # put readings into a session variable, to enable next/prev button
    readings_names = []
    for chapname in readings:
        readings_names = readings_names + [
            "{}/{}.html".format(d["chapter_label"], d["sub_chapter_label"])
            for d in readings[chapname]["subchapters"]
        ]

    if RS_info:
        rslogger.debug(f"RS_info Cookie {RS_info}")
        # Note that to get to the value of the cookie you must use ``.value``
        try:
            parsed_js = json.loads(RS_info)
        except Exception:
            parsed_js = {}
    else:
        parsed_js = {}
    parsed_js["readings"] = readings_names

    course_markup_system = course_attrs.get("markup_system", "Runestone")

    # grabs the row for the current user and and assignment in the grades table
    grade = await fetch_grade(user.id, assignment_id)
    # If cannot find the row in the grades folder, make one and set to not submitted
    if not grade:
        grade = await upsert_grade(
            GradeValidator(
                auth_user=user.id,
                assignment=assignment_id,
                is_submit="",  # set is_submit variable to incomplete
                manual_total=False,
            )
        )

    # Makes variable that will not allow student to change status if assignment is graded.
    if grade.score:
        is_graded = True
    else:
        is_graded = False

    timezoneoffset = parsed_js.get("tz_offset", None)

    timestamp = canonical_utcnow()
    deadline = assignment.duedate
    if timezoneoffset:
        deadline = deadline + datetime.timedelta(hours=float(timezoneoffset))
    assignment.duedate = assignment.duedate.strftime("%a %d, %b %Y %I:%M %p")
    enforce_pastdue = False
    if assignment.enforce_due and timestamp > deadline:
        enforce_pastdue = True
    overdue = False
    if timestamp > deadline:
        overdue = True

    use_pretext_student_pages = (
        str(course_attrs.get("use_pretext_student_pages", "false")).lower() == "true"
    )
    if use_pretext_student_pages:
        book_path = safe_join(
            settings.book_path,
            course.base_course,
            "published",
            course.base_course,
        )
        if book_path:
            templates = get_jinja_templates(book_path)
        else:
            rslogger.warning(
                "Unsafe or invalid book_path computed for course %s; falling back to shared templates",
                course.course_name,
            )
            templates = Jinja2Templates(directory=template_folder)
    else:
        templates = Jinja2Templates(directory=template_folder)

    # templates = Jinja2Templates(directory=template_folder)
    # reverse the order of the keys in the preambles dictionary so that the first key I added is now the last
    # this will ensure that when multiple preamble definitions are used the last one is from the current course
    preambles = dict((k, v) for k, v in reversed(preambles.items()))
    if "webwork_js_version" in course_attrs:
        webwork_js_version = course_attrs["webwork_js_version"]
        del course_attrs["webwork_js_version"]
    else:
        webwork_js_version = "2.20"
    if "ptx_js_version" in course_attrs:
        ptx_js_version = course_attrs["ptx_js_version"]
        del course_attrs["ptx_js_version"]
    else:
        ptx_js_version = "0.2"
    context = dict(  # This is all the variables that will be used in the doAssignment.html document
        course=course,
        request=request,
        course_name=user.course_name,
        assignment=assignment,
        questioninfo=questionslist,
        course_id=user.course_name,
        readings="null",  # force bookfuncs to not render assignment tracker
        readings_full=readings,
        questions_score=questions_score,
        readings_score=readings_score,
        user=user,
        # gradeRecordingUrl=URL('assignments', 'record_grade'),
        # calcTotalsURL=URL('assignments', 'calculate_totals'),
        released=assignment.released,
        is_logged_in="true",
        is_instructor="true" if user_is_instructor else "false",
        needs_manual_grading=needs_manual_grading,
        student_page="true",
        origin=course_markup_system,
        is_submit=grade.is_submit,
        is_graded=is_graded,
        overdue=overdue,
        enforce_pastdue=enforce_pastdue,
        ptx_js_version=ptx_js_version,
        webwork_js_version=webwork_js_version,
        latex_preamble_dict=preambles,
        wp_imports=get_webpack_static_imports(course),
        settings=settings,
        course_attrs=course_attrs,
        base_url=construct_course_url(course),
        activity_info="{}",
        downloads_enabled="true" if course.downloads_enabled else "false",
        allow_pairs="true" if course.allow_pairs else "false",
        **course_attrs,
    )
    response = templates.TemplateResponse(
        "assignment/student/doAssignment.html", context
    )
    response.set_cookie(key="RS_info", value=str(json.dumps(parsed_js)))
    return response


async def addPreamble(base_course: str) -> str:
    """
    Add the preamble to the HTML source code.

    :param htmlsrc: The HTML source code to which the preamble will be added.
    :type htmlsrc: str
    :param base_course: The base course name.
    :type base_course: str
    :return: The HTML source code with the preamble added.
    :rtype: str
    """

    # get the course id fro the base course
    course = await fetch_course(base_course)
    if not course:
        rslogger.error(f"Base course {base_course} not found.")
        return ""
    # get the course attributes
    course_attrs = await fetch_all_course_attributes(course.id)
    if not course_attrs:
        rslogger.error(f"Course attributes for {base_course} not found.")
        return ""
    return course_attrs.get("latex_macros", "")


class GetAssignmentGradeRequest(BaseModel):
    div_id: str


@router.post("/getassignmentgrade")
async def getassignmentgrade(
    request_data: GetAssignmentGradeRequest,
    request: Request,
    user=Depends(auth_manager),
):
    """
    Return the current grade and instructor comment for a single question (``div_id``)
    for the logged-in student. Drives the activecode "grade report" popup.

    Ported from the legacy web2py ``ajax/getassignmentgrade`` endpoint.
    """
    div_id = request_data.div_id
    ret = {
        "grade": "Not graded yet",
        "comment": "No Comments",
        "avg": "None",
        "count": "None",
        "released": False,
    }

    course = await fetch_course(user.course_name)
    # Is this question part of an assignment in the course, and is it released?
    a_q = await fetch_assignment_release_for_div_id(course.id, div_id)

    # New-style scores/comments are stored per question in question_grades.
    result = await fetch_question_grade(user.username, user.course_name, div_id)
    if result:
        ret["version"] = 2
        ret["released"] = a_q.released if a_q else False
        if a_q and not a_q.released:
            ret["grade"] = "Not graded yet"
        elif a_q and a_q.released:
            ret["grade"] = result.score or "Written Feedback Only"

        ret["max"] = a_q.points if (a_q and a_q.released) else ""

        if result.comment:
            ret["comment"] = result.comment

    return JSONResponse(content=ret)
