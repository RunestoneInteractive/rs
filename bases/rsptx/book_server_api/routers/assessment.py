# *************************
# |docname| - Runestone API
# *************************
# This module implements the API that the Runestone Components use to get results from assessment components
#
# *     multiple choice
# *     fill in the blank
# *     parsons problems
# *     drag and dorp
# *     clickable area
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import random
from typing import Optional, Dict, Any

# Third-party imports
# -------------------
from bleach import clean
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import (
    EVENT2TABLE,
    count_matching_questions,
    count_useinfo_for,
    did_start_timed,
    create_selected_question,
    create_user_experiment_entry,
    fetch_assignment_question,
    fetch_code,
    fetch_course,
    fetch_last_answer_table_entry,
    fetch_last_poll_response,
    fetch_matching_questions,
    fetch_poll_summary,
    fetch_previous_selections,
    fetch_question,
    fetch_question_grade,
    fetch_selected_question,
    fetch_timed_exam,
    fetch_top10_fitb,
    fetch_user,
    fetch_user_experiment,
    fetch_viewed_questions,
    is_server_feedback,
    update_selected_question,
)
from rsptx.response_helpers.core import make_json_response, canonical_utcnow
from rsptx.db.models import runestone_component_dict
from rsptx.validation.schemas import AssessmentRequest, SelectQRequest
from rsptx.auth.session import is_instructor, auth_manager


# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/assessment",
    tags=["assessment"],
)


# getAssessResults
# ----------------
@router.post("/results")
async def get_assessment_results(
    request_data: AssessmentRequest,
    request: Request,
    user=Depends(auth_manager),
):
    # if the user is not logged in an HTTP 401 will be returned.
    # Otherwise if the user is an instructor then use the provided
    # sid (it could be any student in the class). If none is provided then
    # use the user objects username
    sid = user.username
    if await is_instructor(request):
        if request_data.sid:
            sid = request_data.sid
    else:
        if request_data.sid:
            # someone is attempting to spoof the api
            return make_json_response(
                status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
            )
    request_data.sid = sid

    row = await fetch_last_answer_table_entry(request_data)
    # mypy complains that ``row.id`` doesn't exist (true, but the return type wasn't exact and this does exist).
    if not row or row.id is None:  # type: ignore
        return make_json_response(detail="no data")
    ret = row.dict()
    rslogger.debug(f"row is {ret}")
    if "timestamp" in ret:
        ret["timestamp"] = (
            ret["timestamp"].replace(tzinfo=datetime.timezone.utc).isoformat()
        )
        rslogger.debug(f"timestamp is {ret['timestamp']}")

    # Do server-side grading if needed, which restores the answer and feedback.
    if feedback := await is_server_feedback(request_data.div_id, request_data.course):
        rcd = runestone_component_dict[EVENT2TABLE[request_data.event]]
        # The grader should also be defined if there's feedback.
        assert rcd.grader
        # Use the grader to add server-side feedback to the returned dict.
        ret.update(await rcd.grader(row, feedback))

    # get grade and instructor feedback if Any
    grades = await fetch_question_grade(sid, request_data.course, request_data.div_id)
    if grades:
        ret["comment"] = grades.comment
        ret["score"] = grades.score
    rslogger.debug(f"Returning {ret}")
    return make_json_response(detail=ret)


# Define a simple model for the gethist request.
# If you just try to specify the two fields as parameters it expects
# them to be in a query string.
class HistoryRequest(BaseModel):
    # ``acid`` : id of the active code block also called div_id
    acid: str
    # ``sid``: optional identifier for the owner of the code (username)
    sid: Optional[str] = None


@router.post("/gethist")
async def get_history(
    request: Request, request_data: HistoryRequest, user=Depends(auth_manager)
):
    """
    return the history of saved code by this user for a particular
    active code id (acid) -- known as div_id elsewhere
    See :ref:`addHistoryScrubber`

    :Parameters:
        - See HistoryRequest

    :Return:
        - json object with a detail key that references a dictionary

        ::

            { "acid": div_id,
              "sid" : id of student requested,
              "history": [code, code, code],
              "timestamps": [ts, ts, ts]
            }
    """
    acid = request_data.acid
    sid = request_data.sid
    # if request_data.sid then we know this is being called from the grading interface
    # so verify that the actual user is an instructor.
    if sid:
        if user.username != sid:
            if await is_instructor(request):
                course_id = user.course_id
            else:
                raise HTTPException(401)
        else:
            raise HTTPException(401)
    # In this case, the request is simply from a student, so we will use
    # their logged in username
    else:
        sid = user.username
        course_id = user.course_id

    res: Dict[str, Any] = {}
    res["acid"] = acid
    res["sid"] = sid
    # get the code they saved in chronological order; id order gets that for us
    r = await fetch_code(sid, acid, course_id)  # type: ignore
    res["history"] = [row.code for row in r]
    res["timestamps"] = [
        row.timestamp.replace(tzinfo=datetime.timezone.utc).isoformat() for row in r
    ]

    return make_json_response(detail=res)


@router.post("/get_latest_code")
async def get_latest_code(
    request: Request, acid: str, user=Depends(auth_manager)
):
    """
    return the history of saved code by this user for a particular a active code id (acid)

    :Return:
        - detail is JSON blob code of the last saved code block for this user
            { "code": code }
        - if no code is found then return an empty blob
    """
    sid = user.username
    course_id = user.course_id

    res: Dict[str, Any] = {}

    # get the code they saved in chronological order; id order gets that for us
    r = await fetch_code(sid, acid, course_id, 1)  # type: ignore
    if len(r) > 0:
        res["code"] = r[0].code

    return make_json_response(detail=res)


# Used by :ref:`compareAnswers`
@router.get("/getaggregateresults")
async def getaggregateresults(request: Request, div_id: str, course_name: str):
    """
    Provide the data for a summary of the answers for a multiple choice question.
    What percent of students chose each answer.  This is used when the compare me
    button is pressed by the student.
    """
    question = div_id

    if not request.state.user:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED,
            detail=dict(answerDict={}, misc={}, emess="You must be logged in"),
        )

    # Since open base courses may have many years of data we limit the
    # results there to the last 90 days.
    course = await fetch_course(course_name)
    if course.course_name == course.base_course:
        start_date = canonical_utcnow() - datetime.timedelta(days=90)
    else:
        start_date = course.term_start_date

    result = await count_useinfo_for(question, course_name, start_date)
    # result rows will look like act, count
    # the act field may look like
    # ``answer:1:correct`` or
    # ``answer:1,3,5:no``

    tdata = {}
    tot = 0.0
    for row in result:
        tdata[row[0]] = row[1]
        tot += row[1]

    tot = float(tot)
    rdata: Dict[str, float] = {}
    miscdata = {}
    correct = ""
    if tot > 0:
        for key in tdata:
            all_a = key.split(":")
            try:
                answer = all_a[1]
                if "correct" in key:
                    correct = answer
                count = float(tdata[key])
                if answer in rdata:
                    count += rdata[answer] / 100.0 * tot
                pct = round(count / tot * 100.0)

                if answer != "undefined" and answer != "":
                    rdata[answer] = pct
            except Exception as e:
                rslogger.error(f"Bad data for {question} data is {key} -- {e}")

    miscdata["correct"] = correct
    miscdata["course"] = course

    returnDict = dict(answerDict=rdata, misc=miscdata)

    ## if instructor:
    # There is little value to doing this now when the instructor
    # Dashboard provides more and better detail
    ##     resultList = _getStudentResults(question)
    ##     returnDict["reslist"] = resultList

    return make_json_response(detail=returnDict)


@router.get("/getpollresults")
async def getpollresults(request: Request, course: str, div_id: str):
    # fetch summary of poll answers
    result = await fetch_poll_summary(div_id, course)

    opt_counts = {}

    for row in result:
        rslogger.debug(row)
        if ":" in row[0]:
            val = int(row[0].split(":")[0])
        else:
            val = int(row[0])
        opt_counts[val] = row[1]

    opt_num = max(opt_counts.keys()) if opt_counts else 0
    for i in range(opt_num):
        if i not in opt_counts:
            opt_counts[i] = 0
    # opt_list holds the option numbers from smallest to largest
    # count_list[i] holds the count of responses that chose option i
    opt_list = sorted(opt_counts.keys())
    count_list = []
    for i in opt_list:
        count_list.append(opt_counts[i])

    total = sum(opt_counts.values())
    user_res = None
    if request.state.user:
        user_res = await fetch_last_poll_response(
            request.state.user.username, course, div_id
        )
    my_comment = ""
    if user_res:
        if ":" in user_res:
            my_vote = int(user_res.split(":")[0])
            my_comment = user_res.split(":")[1]
        else:
            my_vote = int(user_res)
            my_comment = ""
    else:
        my_vote = -1

    return make_json_response(
        detail=dict(
            total=total,
            opt_counts=opt_counts,
            div_id=div_id,
            my_vote=my_vote,
            my_comment=my_comment,
        )
    )


# Called from :ref:`compareFITBAnswers`
#
@router.get("/gettop10Answers")
async def gettop10Answers(request: Request, course: str, div_id: str):
    rows = []

    dbcourse = await fetch_course(course)
    # returns a list that looks like this:
    # [(["12"], 2), (["22"], 1), (["11"], 1), (["10"], 1)]
    # the first element of each tuple is a list of the responses to 1 or more blanks
    # the second element of each tuple is the count
    rows = await fetch_top10_fitb(dbcourse, div_id)
    rslogger.debug(f"{rows=}")
    res = [{"answer": clean(row[0]), "count": row[1]} for row in rows]

    miscdata = {"course": course}

    return make_json_response(detail=dict(res=res, miscdata=miscdata))


@router.get("/set_selected_question")
async def set_selected_question(request: Request, metaid: str, selected: str):
    """
    This endpoint is used by the selectquestion problems that allow the
    student to select the problem they work on.  For example they may have
    a programming problem that can be solved with writing code, or they
    can switch to a parsons problem if necessary.

    Called from :ref:`toggleSet`

    Caller must provide:
    * ``metaid`` -- the id of the selectquestion
    * ``selected`` -- the id of the real question chosen by the student
    """
    if not request.state.user:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not logged in"
        )
    sid = request.state.user.username
    selector_id = metaid
    selected_id = selected
    rslogger.debug(f"USQ - {selector_id} --> {selected_id} for {sid}")
    qrecord = await fetch_selected_question(sid, selector_id)
    if qrecord:
        await update_selected_question(sid, selector_id, selected_id)
    else:
        await create_selected_question(sid, selector_id, selected_id)


@router.post("/get_question_source")
async def get_question_source(request: Request, request_data: SelectQRequest):
    """Called from the selectquestion directive
    There are 4 cases:

    1. If there is only 1 question in the question list then return the html source for it.
    2. If there are multiple questions then choose a question at random
    3. If a proficiency is selected then select a random question that tests that proficiency
    4. If the question is an AB question then see if this student is an A or a B or assign them to one randomly.

    In the last two cases, first check to see if there is a question for this student for this
    component that was previously selected.

    Returns:
        json: html source for this question
    """
    prof = False
    points = request_data.points
    rslogger.debug(f"POINTS = {points}")
    not_seen_ever = request_data.not_seen_ever
    is_ab = request_data.AB
    selector_id = request_data.selector_id
    assignment_name = request_data.timedWrapper
    toggle = request_data.toggleOptions

    # If the question has a :points: option then those points are the default
    # however sometimes questions are entered in the web ui without the :points:
    # and points are assigned in the UI instead.  If this is part of an
    # assignment or timed exam AND the points are set in the web UI we will
    # use the points from the UI over the :points:  If this is an assignment
    # or exam that is totally written in RST then  the points in the UI will match
    # the points from the assignment anyway.
    if assignment_name:
        aq = await fetch_assignment_question(assignment_name, selector_id)
        if aq:
            ui_points = aq.points
        else:
            ui_points = None
        rslogger.debug(
            f"Assignment Points for {assignment_name}, {selector_id} = {ui_points}"
        )
        if ui_points:
            points = ui_points
        else:
            points = 0
    questionlist = await fetch_matching_questions(request_data)

    if not questionlist:
        rslogger.error(f"No questions found for proficiency {prof}")
        return make_json_response(
            detail=f"<p>No Questions found for proficiency: {prof}</p>"
        )

    if request.state.user:
        sid = request.state.user.username
    else:
        if questionlist:
            q = random.choice(questionlist)
            qres = await fetch_question(q)
            if qres:
                return make_json_response(detail=qres.htmlsrc)
            else:
                return make_json_response(
                    detail=f"<p>Question {q} is not in the database.</p>"
                )
        else:
            return make_json_response(detail="<p>No Questions available</p>")

    rslogger.debug(f"is_ab is {is_ab}")
    if is_ab:
        res = await fetch_user_experiment(sid, is_ab)  # returns an int or None
        if res is None:
            exp_group = random.randrange(2)
            await create_user_experiment_entry(sid, is_ab, exp_group)
            rslogger.debug(f"added {sid} to {is_ab} group {exp_group}")
        else:
            exp_group = res

        rslogger.debug(f"experimental group is {exp_group}")

        prev_selection = await fetch_selected_question(sid, selector_id)

        if prev_selection:
            questionid = prev_selection.selected_id
        else:
            questionid = questionlist[exp_group]

    if not is_ab:
        poss = set()
        if not_seen_ever:
            seenq = await fetch_viewed_questions(sid, questionlist)
            seen = set(seenq)
            poss = set(questionlist)
            questionlist = list(poss - seen)

        if len(questionlist) == 0 and len(poss) > 0:
            questionlist = list(poss)

        htmlsrc = ""

        prev_selection = await fetch_selected_question(sid, selector_id)

        if prev_selection:
            questionid = prev_selection.selected_id
        else:
            # Eliminate any previous exam questions for this student
            prev_questions_l = await fetch_previous_selections(sid)

            prev_questions = set(prev_questions_l)
            possible = set(questionlist)
            questionlist = list(possible - prev_questions)
            if questionlist:
                questionid = random.choice(questionlist)
            else:
                # If there are no questions left we should still return a random question.
                questionid = random.choice(list(possible))

    rslogger.debug(f"toggle is {toggle}")
    if toggle:
        prev_selection = await fetch_selected_question(sid, selector_id)
        if prev_selection:
            questionid = prev_selection.selected_id
        else:
            if request_data.questions is not None:
                questionid = request_data.questions.split(",")[0]
            else:
                rslogger.error("No questions given")
                return make_json_response(
                    status.HTTP_417_EXPECTATION_FAILED,
                    detail="Toggle questions must use the fromid option",
                )

    qres = await fetch_question(questionid)
    if qres and not prev_selection:
        await create_selected_question(sid, selector_id, questionid, points=points)
    else:
        rslogger.debug(
            f"Did not insert a record for {selector_id}, {questionid} Conditions are {qres} QL: {questionlist} PREV: {prev_selection}"
        )

    if qres and qres.htmlsrc:
        htmlsrc = qres.htmlsrc
    else:
        rslogger.error(
            f"HTML Source not found for {questionid} in course {request.state.user.course_name} for {request.state.user.username}"
        )
        htmlsrc = "<p>No preview available</p>"
    return make_json_response(detail=htmlsrc)


class ExamRequest(BaseModel):
    div_id: str
    course_name: str


@router.post("/tookTimedAssessment")
async def tookTimedAssessment(request: Request, request_data: ExamRequest):
    if request.state.user:
        sid = request.state.user.username
    else:
        # todo: Is this what we really want? Seems like a 401??
        return make_json_response(detail={"tookAssessment": False})

    exam_id = request_data.div_id
    course = request_data.course_name
    rows = await fetch_timed_exam(sid, exam_id, course)
    if not rows:
        rows = await did_start_timed(sid, exam_id, course)
    rslogger.debug(f"checking {exam_id} {sid} {course} {rows}")
    if rows:
        return make_json_response(detail={"tookAssessment": True})
    else:
        return make_json_response(detail={"tookAssessment": False})


@router.get("/htmlsrc")
async def htmlsrc(
    request: Request,
    acid: str,
    sid: Optional[str] = None,
    assignmentId: Optional[int] = None,
):
    """
    Used by Toggle Questions and the grading interface
    Get the html source for a question.  If just the divid is included then assume that
    the question must come from the current base course.  If an assignment_id is provided
    then that question could come from any base course and so make sure it is part of the
    current assignment_questions set.
    """
    assignment_id = assignmentId
    if sid:
        studentId = sid
    elif request.state.user:
        studentId = request.state.user.username
    else:
        studentId = None
    htmlsrc = ""
    count = await count_matching_questions(acid)
    rslogger.debug(f"we have an sid of {studentId} and {count=}")
    if count > 1 and assignment_id:
        rslogger.debug(f"assignment_id = {assignment_id}")
        # todo fix up for assignment
        res = await fetch_question(acid)
    elif count > 1 and studentId:
        rslogger.debug("Fetching by base course")
        student = await fetch_user(studentId)
        bc = await fetch_course(student.course_name)
        res = await fetch_question(acid, basecourse=bc.base_course)
    else:
        res = await fetch_question(acid)
    if res and (res.htmlsrc or res.question_type == "selectquestion"):
        if res.question_type == "selectquestion" and studentId:
            # Check the selected_questions table to see which actual question was chosen
            # then get that question.
            realq = await fetch_selected_question(studentId, acid)
            if realq:
                htmlsrc = realq.htmlsrc
        else:
            htmlsrc = res.htmlsrc
    else:
        rslogger.error(f"HTML Source not found for {acid} in course ??")
        htmlsrc = "<p>No preview available</p>"

    return make_json_response(detail=htmlsrc)
