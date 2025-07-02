# *************************
# |docname| - Runestone API
# *************************
# This module implements the Student facing API for assignments
#
# *     chooseAssignment
# *     doAssignment
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
from typing import Optional
import json

# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request, Cookie
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import (
    create_useinfo_entry,
    fetch_assignments,
    fetch_all_assignment_stats,
    fetch_grade,
    upsert_grade,
    fetch_lti_version,
    fetch_course,
    fetch_all_course_attributes,
    fetch_deadline_exception,
    fetch_one_assignment,
    fetch_assignment_questions,
    fetch_question_grade,
    fetch_user_chapter_progress,
    fetch_user_sub_chapter_progress,
)
from rsptx.grading_helpers.core import check_for_exceptions

from rsptx.db.models import GradeValidator, UseinfoValidation, CoursesValidator
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.templates import template_folder
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
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
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
    is_lti1p1_course = await fetch_lti_version(course.id) == "1.1"
    templates = Jinja2Templates(directory=template_folder)
    user_is_instructor = await is_instructor(request, user=user)
    if user_is_instructor:
        # if the user is an instructor, we need to show all assignments
        assignments = await fetch_assignments(course.course_name, fetch_all=True)
    else:
        assignments = await fetch_assignments(course.course_name)
    # fetch all deadline exceptions for the user
    accommodations = await fetch_deadline_exception(
        course.id, user.username, fetch_all=True
    )
    # filter assignments based on deadline exceptions
    assignment_ids = [a.assignment_id for a in accommodations]
    if not user_is_instructor:
        assignments = [a for a in assignments if a.visible or a.id in assignment_ids]

    assignments.sort(key=lambda x: x.duedate, reverse=True)
    stats_list = await fetch_all_assignment_stats(course.course_name, user.id)
    stats = {}
    for s in stats_list:
        stats[s.assignment] = s
    rslogger.debug(f"stats: {stats}")
    return templates.TemplateResponse(
        "assignment/student/chooseAssignment.html",
        {
            "assignment_list": assignments,
            "stats": stats,
            "course": course,
            "user": sid,
            "request": request,
            "is_instructor": user_is_instructor,
            "student_page": True,
            "lti1p1": is_lti1p1_course,
        },
    )


class UpdateStatusRequest(BaseModel):
    """
    This is the request data for the update_submit endpoint. We use a Pydantic model so that
    the data is validated before it is passed to the endpoint.
    """

    assignment_id: int
    new_state: Optional[str] = None


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


def get_course_url(course: CoursesValidator, *args) -> str:
    """Get the URL for the course.

    :param course: _description_
    :type course: CourseValidator
    :return: _description_
    :rtype: str
    """
    rest = "/".join(args)
    return f"/ns/books/published/{course.course_name}/{rest}"


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

    deadline_exception = await check_for_exceptions(user, assignment_id)

    if (
        assignment.visible == "F"
        or assignment.visible is None
        or assignment.visible == False
    ):
        if not (await is_instructor(request) or deadline_exception.visible):
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

    # For each question, accumulate information, and add it to either the readings or questions data structure
    # If scores have not been released for the question or if there are no scores yet available, the scoring information will be recorded as empty strings
    qset = set()

    preambles = {course.base_course: course_attrs.get("latex_macros", "")}
    for q in questions:
        if q.Question.htmlsrc:
            # This replacement is to render images
            bts = q.Question.htmlsrc
            htmlsrc = bts.replace(
                'src="../_static/', 'src="' + get_course_url(course, "_static/")
            )
            htmlsrc = htmlsrc.replace("../_images", get_course_url(course, "_images"))
            htmlsrc = htmlsrc.replace(
                'src=\\"external', 'src=\\"' + get_course_url(course, "external")
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

        chap_name = q.Question.chapter
        subchap_name = q.Question.subchapter
        if q.Question.base_course not in preambles:
            preambles[q.Question.base_course] = await addPreamble(q.Question.base_course)

        info = dict(
            htmlsrc=htmlsrc,
            score=score,
            points=q.AssignmentQuestion.points,
            comment=comment,
            chapter=q.Question.chapter,
            subchapter=q.Question.subchapter,
            chapter_name=chap_name,
            subchapter_name=subchap_name,
            name=q.Question.name,
            question_type=q.Question.question_type,
            activities_required=q.AssignmentQuestion.activities_required,
        )
        if q.AssignmentQuestion.autograde == "manual":
            info["how_graded"] = "Needs Manual Grading"
        elif q.AssignmentQuestion.which_to_grade == "first_answer":
            info["how_graded"] = "First Answer"
        elif q.AssignmentQuestion.which_to_grade == "last_answer":
            info["how_graded"] = "Last Answer"
        elif q.AssignmentQuestion.which_to_grade == "best_answer":
            info["how_graded"] = "Best Answer"

        if q.AssignmentQuestion.reading_assignment:
            # add to readings
            if chap_name not in readings:
                # add chapter info
                completion = await fetch_user_chapter_progress(user, chap_name)
                if not completion:
                    status = "notstarted"
                elif completion.status == 1:
                    status = "completed"
                elif completion.status == 0:
                    status = "started"
                else:
                    status = "notstarted"
                readings[chap_name] = dict(status=status, subchapters=[])

            # add subchapter info
            # add completion status to info
            subch_completion = await fetch_user_sub_chapter_progress(
                user, chap_name, subchap_name
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
            if info not in readings[chap_name]["subchapters"]:
                readings[chap_name]["subchapters"].append(info)
                readings_score += info["score"]

        else:
            if (
                q.Question.name not in qset and info not in questionslist
            ):  # add to questions
                questionslist.append(info)
                questions_score += info["score"]
                qset.add(q.Question.name)

    # put readings into a session variable, to enable next/prev button
    readings_names = []
    for chapname in readings:
        readings_names = readings_names + [
            "{}/{}.html".format(d["chapter"], d["subchapter"])
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
    # But to set the cookie you do NOT use ``.value``

    # By not setting expire this remains/becomes a session cookie

    user_is_instructor = await is_instructor(request, user=user)

    c_origin = course_attrs.get("markup_system", "Runestone")
    print("ORIGIN", c_origin)

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
    templates = Jinja2Templates(directory=template_folder)
    # reverse the order of the keys in the preambles dictionary so that the first key I added is now the last
    # this will ensure that when multiple preamble definitions are used the last one is from the current course
    preambles = dict(
        (k, v) for k, v in reversed(preambles.items())
    )
    context = dict(  # This is all the variables that will be used in the doAssignment.html document
        course=course,
        course_name=user.course_name,
        assignment=assignment,
        questioninfo=questionslist,
        course_id=user.course_name,
        readings=readings,
        questions_score=questions_score,
        readings_score=readings_score,
        user=user,
        # gradeRecordingUrl=URL('assignments', 'record_grade'),
        # calcTotalsURL=URL('assignments', 'calculate_totals'),
        released=assignment.released,
        is_instructor=user_is_instructor,
        student_page=True,
        origin=c_origin,
        is_submit=grade.is_submit,
        is_graded=is_graded,
        overdue=overdue,
        enforce_pastdue=enforce_pastdue,
        ptx_js_version=course_attrs.get("ptx_js_version", "0.2"),
        webwork_js_version=course_attrs.get("webwork_js_version", "2.17"),
        request=request,
        latex_preamble_dict=preambles,
        wp_imports=get_webpack_static_imports(course),
        settings=settings,
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
