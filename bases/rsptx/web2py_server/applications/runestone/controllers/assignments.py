# *********************************************
# |docname| - Endpoints relating to assignments
# *********************************************
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8
# <http://www.python.org/dev/peps/pep-0008/#imports>`_.
#
# Standard library
# ----------------
import json
import logging
import datetime
from collections import OrderedDict
import traceback

# Third-party imports
# -------------------
from psycopg2 import IntegrityError
import six
import bleach

# Local application imports
# -------------------------
from rs_grading import (
    do_autograde,
    do_calculate_totals,
    do_check_answer,
    send_lti_grade,
    _get_lti_record,
    _try_to_send_lti_grade,
)
from rs_practice import (
    _get_practice_data,
    _get_practice_completion,
    _get_qualified_questions,
)
from questions_report import query_assignment, grades_to_hot, questions_to_grades

logger = logging.getLogger(settings.logger)
logger.setLevel(settings.log_level)

admin_logger(logger)


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def record_assignment_score():
    score = request.vars.get("score", None)
    assignment_name = request.vars.assignment
    assignment = (
        db(
            (db.assignments.name == assignment_name)
            & (db.assignments.course == auth.user.course_id)
        )
        .select()
        .first()
    )
    if assignment:
        assignment_id = assignment.id
    else:
        return json.dumps(
            {
                "success": False,
                "message": "Select an assignment before trying to calculate totals.",
            }
        )

    if score:
        # Write the score to the grades table
        # grades table expects row ids for auth_user and assignment
        sname = request.vars.get("sid", None)
        sid = db((db.auth_user.username == sname)).select(db.auth_user.id).first().id
        db.grades.update_or_insert(
            ((db.grades.auth_user == sid) & (db.grades.assignment == assignment_id)),
            auth_user=sid,
            assignment=assignment_id,
            score=score,
            manual_total=True,
        )


def _calculate_totals(
    sid=None, student_rownum=None, assignment_name=None, assignment_id=None
):
    if assignment_id:
        assignment = (
            db(
                (db.assignments.id == assignment_id)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
    else:
        assignment = (
            db(
                (db.assignments.name == assignment_name)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
    if assignment:
        return do_calculate_totals(
            assignment,
            auth.user.course_id,
            auth.user.course_name,
            sid,
            student_rownum,
            db,
            settings,
        )
    else:
        return {
            "success": False,
            "message": "Select an assignment before trying to calculate totals.",
        }


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def calculate_totals():
    assignment_name = request.vars.assignment
    sid = request.vars.get("sid", None)
    return json.dumps(_calculate_totals(sid=sid, assignment_name=assignment_name))


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def get_summary():
    assignment_name = request.vars.assignment  # recieves json sent by ajax call
    assignment = (
        db(
            (db.assignments.name == assignment_name)
            & (db.assignments.course == auth.user.course_id)
        )
        .select()
        .first()
    )

    res = db.executesql(
        """select chapter, name, min(question_type) question_type, min(score), max(score), to_char(avg(score), '00.999') as  mean, count(score)
from assignment_questions join questions on question_id = questions.id join question_grades on name =  div_id
where assignment_id = %s and course_name = %s
group by chapter, name""",
        (assignment.id, auth.user.course_name),
        as_dict=True,
    )

    """ List of question types that are not supported by the exercisemetrics page """

    unsupported_question_types = [
        "activecode",
        "quizly",
        "khanex",
        "poll",
        "shortanswer",
    ]

    for row in res:
        # do not construct links for unsupported questions
        if row["question_type"] not in unsupported_question_types and row["count"] > 0:
            row["name"] = (
                f"""<a href="/runestone/dashboard/exercisemetrics?id={row['name']}&chapter={row['chapter']}">{row['name']}</a>"""
            )

    return json.dumps(res)


def _autograde(
    sid=None,
    student_rownum=None,
    question_name=None,
    enforce_deadline=False,
    assignment_name=None,
    assignment_id=None,
    timezoneoffset=None,
):
    if assignment_id:
        assignment = (
            db(
                (db.assignments.id == assignment_id)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
    else:
        assignment = (
            db(
                (db.assignments.name == assignment_name)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
    if assignment:
        count = do_autograde(
            assignment,
            auth.user.course_id,
            auth.user.course_name,
            sid,
            student_rownum,
            question_name,
            enforce_deadline,
            timezoneoffset,
            db,
            settings,
        )
        return {
            "success": True,
            "message": "scored {} items".format(count),
            "count": count,
        }
    else:
        return {
            "success": False,
            "message": "Select an assignment before trying to score it.",
        }


@auth.requires_login()
def student_autograde():
    """
    This is a safe endpoint that students can call from the assignment page
    to get a preliminary grade on their assignment. If in coursera_mode,
    the total for the assignment is calculated and stored in the db, and
    sent via LTI (if LTI is configured).
    """
    assignment_id = request.vars.assignment_id
    timezoneoffset = session.timezoneoffset if "timezoneoffset" in session else None
    if not timezoneoffset and "RS_info" in request.cookies:
        parsed_js = json.loads(request.cookies["RS_info"].value)
        timezoneoffset = parsed_js.get("tz_offset", None)

    is_timed = request.vars.is_timed

    if assignment_id.isnumeric() is False:
        aidrow = (
            db(
                (db.assignments.name == assignment_id)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
        if aidrow:
            assignment_id = aidrow.id
        else:
            res = {"success": False, "message": "Could not find this assignment"}
            return json.dumps(res)

    res = _autograde(
        student_rownum=auth.user.id,
        assignment_id=assignment_id,
        timezoneoffset=timezoneoffset,
    )

    if not res["success"]:
        session.flash = (
            "Failed to score questions for user id {} for assignment {}".format(
                auth.user.id, assignment_id
            )
        )
        res = {"success": False}
    else:
        if settings.coursera_mode or is_timed:
            res2 = _calculate_totals(
                student_rownum=auth.user.id, assignment_id=assignment_id
            )
            if not res2["success"]:
                session.flash = (
                    "Failed to compute totals for user id {} for assignment {}".format(
                        auth.user.id, assignment_id
                    )
                )
                res = {"success": False}
            else:
                _try_to_send_lti_grade(auth.user.id, assignment_id)
    return json.dumps(res)


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def autograde():
    ### This endpoint is hit to autograde one or all students or questions for an assignment
    sid = request.vars.get("sid", None)
    question_name = request.vars.get("question", None)
    if ":::" in question_name:
        questions_to_grade = question_name.split(":::")
    else:
        questions_to_grade = [question_name]
    logger.debug(f"questions_to_grade = {questions_to_grade}")
    enforce_deadline = request.vars.get("enforceDeadline", None)
    assignment_name = request.vars.assignment
    timezoneoffset = session.timezoneoffset if "timezoneoffset" in session else None
    for question_name in questions_to_grade:
        res = _autograde(
            sid=sid,
            question_name=question_name,
            enforce_deadline=enforce_deadline,
            assignment_name=assignment_name,
            timezoneoffset=timezoneoffset,
        )
    res["message"] = f"scored {len(questions_to_grade)} items"
    tres = _calculate_totals(sid=sid, assignment_name=assignment_name)
    if "computed_score" in tres:
        res["total_mess"] = tres["computed_score"]
    else:
        res["total_mess"] = tres["message"]

    try:
        if sid:
            if pass_grade_to_lti(sid, assignment_name):
                logger.info(f"Grade passed successfully for {sid} in {assignment_name}")
    except Exception as e:
        logger.error(f"Error passing grade to LTI for {sid} in {assignment_name}: {e}")
        traceback.print_exc()

    return json.dumps(res)


def pass_grade_to_lti(sid, assignment_name):
    # if this assignment has an LMS counterpart then send the grade to the LMS

    # First check to see if the course uses LTI
    # We order by the id and get the last one to ensure we get the most recent entry
    # in case there are multiple entries for the same course
    lti_map = (
        db(db.course_lti_map.course_id == auth.user.course_id)
        .select(orderby=db.course_lti_map.id)
        .last()
    )
    if not lti_map:
        return False

    # Now gather the information needed to submit a grade
    student = db(db.auth_user.username == sid).select().first()

    assignment = (
        db(
            (db.assignments.name == assignment_name)
            & (db.assignments.course == auth.user.course_id)
        )
        .select()
        .first()
    )

    grade = (
        db(
            (db.grades.auth_user == student.id)
            & (db.grades.assignment == assignment.id)
        )
        .select()
        .first()
    )
    if not grade:
        logger.warning(f"No grade found for {sid} in {assignment_name}")
        return False

    lti_record = db(db.lti_keys.id == lti_map.lti_id).select().first()
    if not lti_record:
        return False

    # Only send the grade if we have a valid LTI record and the grade is set
    # and the outcome URL is set
    if grade and grade.lis_result_sourcedid and grade.lis_outcome_url:
        logger.info(f"Passing grade for {sid} in {assignment_name} score {grade.score}")
        send_lti_grade(
            assignment.points,
            score=grade.score,
            consumer=lti_record.consumer,
            secret=lti_record.secret,
            outcome_url=grade.lis_outcome_url,
            result_sourcedid=grade.lis_result_sourcedid,
        )
        return True

    return False


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def send_assignment_score_via_LTI():

    assignment_name = request.vars.assignment
    sid = request.vars.get("sid", None)
    assignment = (
        db(
            (db.assignments.name == assignment_name)
            & (db.assignments.course == auth.user.course_id)
        )
        .select()
        .first()
    )
    student_row = db((db.auth_user.username == sid)).select(db.auth_user.id).first()
    _try_to_send_lti_grade(student_row.id, assignment.id)
    return json.dumps({"success": True})


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def record_grade():
    """
    Called from the grading interface when the instructor manually records a grade.
    """
    # Validate parameters.
    if "acid" not in request.vars or not (
        ("sid" in request.vars) or ("sid[]" in request.vars)
    ):
        return json.dumps({"success": False, "message": "Need problem and user."})
    if ("sid" in request.vars) and ("sid[]" in request.vars):
        return json.dumps(
            {"success": False, "message": "Cannot specify both sid and sid[]."}
        )
    if ("comment" not in request.vars) and ("grade" not in request.vars):
        return json.dumps(
            {"success": False, "message": "Must provide either grade or comment."}
        )
    if "assignmentid" not in request.vars:
        return json.dumps({"success": False, "message": "Must provide assignment id."})

    # Create a dict of updates for this grade.
    updates = dict(course_name=auth.user.course_name)

    # Parse the grade into a score.
    if "grade" in request.vars:
        score_str = request.vars.grade.strip()
        # An empty score means delete it.
        if not score_str:
            updates["score"] = None
        else:
            try:
                updates["score"] = float(score_str)
            except ValueError as e:
                logger.error("Bad Score: {} - Details: {}".format(score_str, e))
                return json.dumps({"response": "not replaced"})

    # Update the comment if supplied.
    comment = request.vars.comment
    if comment is not None:
        updates["comment"] = comment

    # Gather the remaining parameters.
    div_id = request.vars.acid
    # Accept input of a single sid from the request variable ``sid`` or a list from ``sid[]``, following the way `jQuery serielizes this <https://api.jquery.com/jQuery.param/>`_ (with the ``traditional`` flag set to its default value of ``false``). Note that ``$.param({sid: ["one"]})`` produces ``"sid%5B%5D=one"``, meaning that this "list" will still be a single-element value. Therefore, use ``getlist`` for **both** "sid" (which should always be only one element) and "sid[]" (which could be a single element or a list).
    sids = request.vars.getlist("sid") or request.vars.getlist("sid[]")
    # Gather assignment id for future use by do_calculate_totals function
    assignment_id = request.vars.assignmentid
    if assignment_id.isnumeric():
        assignment = (
            db(
                (db.assignments.id == assignment_id)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
    else:
        assignment = (
            db(
                (db.assignments.name == assignment_id)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )

    student_rownum = None

    # Update the score(s).
    try:
        # sid can be a list of sids to change. Walk through each element in the list.
        for sid in sids:
            db.question_grades.update_or_insert(
                (
                    (db.question_grades.sid == sid)
                    & (db.question_grades.div_id == div_id)
                    & (db.question_grades.course_name == auth.user.course_name)
                ),
                sid=sid,
                div_id=div_id,
                **updates,
            )
            if assignment:
                try:
                    do_calculate_totals(
                        assignment,
                        auth.user.course_id,
                        auth.user.course_name,
                        sid,
                        student_rownum,
                        db,
                        settings,
                    )
                except Exception as e:
                    logger.error(
                        f"Calculate totals failed for reason {e} - {auth.user.course_name} {sid} {student_rownum} {assignment}"
                    )
    except IntegrityError:
        logger.error(
            "IntegrityError {} {} {}".format(sid, div_id, auth.user.course_name)
        )
        # TODO: Maybe we should just do an update when we get an Integrity error?
        return json.dumps({"response": "not replaced"})

    return json.dumps({"response": "replaced"})


# create a unique index:  question_grades_sid_course_name_div_id_idx" UNIQUE, btree (sid, course_name, div_id)


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def get_problem():
    """
    Called from the instructors grading interface
    """
    if "acid" not in request.vars or "sid" not in request.vars:
        return json.dumps({"success": False, "message": "Need problem and user."})

    user = db(db.auth_user.username == request.vars.sid).select().first()
    if not user:
        return json.dumps({"success": False, "message": "User does not exist. Sorry!"})

    res = {
        "id": "%s-%d" % (request.vars.acid, user.id),
        "acid": request.vars.acid,
        "sid": user.id,
        "username": user.username,
        "name": "%s %s" % (user.first_name, user.last_name),
        "code": "",
    }

    # get the deadline associated with the assignment
    assignment_name = request.vars.assignment
    if assignment_name and auth.user.course_id:
        assignment = (
            db(
                (db.assignments.name == assignment_name)
                & (db.assignments.course == auth.user.course_id)
            )
            .select()
            .first()
        )
        deadline = assignment.duedate if assignment else None
        if deadline is None:
            logger.error(
                f"Did not find assignment {assignment_name} for course {auth.user.course_name} this should not happen"
            )
    else:
        deadline = None

    offset = datetime.timedelta(0)
    if session.timezoneoffset and deadline:
        offset = datetime.timedelta(hours=float(session.timezoneoffset))
        logger.debug("setting offset %s %s", offset, deadline + offset)

    query = (
        (db.code.acid == request.vars.acid)
        & (db.code.sid == request.vars.sid)
        & (db.code.course_id == auth.user.course_id)
    )
    if request.vars.enforceDeadline == "true" and deadline:
        query = query & (db.code.timestamp < deadline + offset)
        logger.debug("DEADLINE QUERY = %s", query)
    c = db(query).select(orderby=db.code.id).last()

    if c:
        res["code"] = c.code

    # add prefixes, suffix_code and files that are available
    # retrieve the db record
    source = db.source_code(acid=request.vars.acid, course_id=auth.user.course_name)

    if source and c and c.code:

        def get_source(acid):
            r = db.source_code(acid=acid)
            if r:
                return r.main_code
            else:
                return ""

        if source.includes:
            # strip off "data-include"
            txt = source.includes[len("data-include=") :]
            included_divs = [x.strip() for x in txt.split(",") if x != ""]
            # join together code for each of the includes
            res["includes"] = "\n".join([get_source(acid) for acid in included_divs])
            # logger.debug(res['includes'])
        if source.suffix_code:
            res["suffix_code"] = source.suffix_code
            # logger.debug(source.suffix_code)

        file_divs = [x.strip() for x in source.available_files.split(",") if x != ""]
        res["file_includes"] = [
            {"acid": acid, "contents": get_source(acid)} for acid in file_divs
        ]
    return json.dumps(res)


@auth.requires_login()
def update_submit():
    """This function is ran from the Assignments page on the students view to change the
    status of their assignment to completed or not"""

    assignment_id = (
        request.vars.assignment_id
    )  # used to grab the data from jQuery request
    student_id = auth.user.id
    # pull the grades table for the current student
    grade = (
        db(
            (db.grades.auth_user == student_id)
            & (db.grades.assignment == assignment_id)
        )
        .select()
        .first()
    )
    if request.vars.new_state:
        is_submit = request.vars.new_state
    else:
        is_submit = None

    res = {}

    if grade:
        # toggles the is_submit variable from True to False
        # keep this clause for backward compatibility
        if is_submit is None:
            if grade.is_submit == "In Progress":
                is_submit = "Finished"
            elif grade.is_submit == "Finished":
                is_submit = "Not Started"
            else:
                is_submit = "In Progress"

        db.grades.update_or_insert(
            (db.grades.auth_user == student_id)
            & (db.grades.assignment == assignment_id),
            auth_user=student_id,
            assignment=assignment_id,
            is_submit=is_submit,
        )
        res["success"] = True
    # if can't find grades table for current user, return no success
    else:
        db.grades.insert(
            auth_user=auth.user.id, assignment=assignment_id, is_submit=is_submit
        )
        res["success"] = True

    return json.dumps(res)


@auth.requires_login()
def doAssignment():

    if "access_token" not in request.cookies:
        # this means the user is logged in to web2py but not fastapi - this is not good
        # as the javascript in the questions assumes the new server and a token.
        logger.error(f"Missing Access Token: {auth.user.username} adding one Now")
        create_rs_token()
        response.flash = (
            "Access Token Created - If this re-occurs check your cookie settings"
        )
    redirect(
        "/assignment/student/doAssignment?assignment_id=" + request.vars.assignment_id
    )
    course = db(db.courses.id == auth.user.course_id).select(**SELECT_CACHE).first()
    assignment_id = request.vars.assignment_id
    if not assignment_id or assignment_id.isdigit() == False:  # noqa: E712
        logger.error("BAD ASSIGNMENT = %s assignment %s", course, assignment_id)
        session.flash = "Bad Assignment ID"
        return redirect(URL("assignments", "chooseAssignment"))
    course_attrs = getCourseAttributesDict(course.id, course.base_course)
    logger.debug("COURSE = %s assignment %s", course, assignment_id)
    # Web2Py documentation for querying databases is really helpful here.
    assignment = (
        db(
            (db.assignments.id == assignment_id)
            & (db.assignments.course == auth.user.course_id)
        )
        .select()
        .first()
    )

    if not assignment:
        logger.error(
            "NO ASSIGNMENT assign_id = %s course = %s user = %s",
            assignment_id,
            course,
            auth.user.username,
        )
        session.flash = "Could not find login and try again."
        return redirect(URL("default", "index"))

    if assignment.visible == "F" or assignment.visible is None:
        if verifyInstructorStatus(auth.user.course_name, auth.user) is False:
            session.flash = "That assignment is no longer available"
            return redirect(URL("assignments", "chooseAssignment"))

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

    questions = db(
        (db.assignment_questions.assignment_id == assignment.id)
        & (db.assignment_questions.question_id == db.questions.id)
    ).select(
        db.questions.name,
        db.questions.htmlsrc,
        db.questions.id,
        db.questions.chapter,
        db.questions.subchapter,
        db.questions.base_course,
        db.assignment_questions.points,
        db.assignment_questions.activities_required,
        db.assignment_questions.reading_assignment,
        orderby=db.assignment_questions.sorting_priority,
    )
    try:
        db.useinfo.insert(
            sid=auth.user.username,
            act="viewassignment",
            div_id=assignment.name,
            event="page",
            timestamp=datetime.datetime.utcnow(),
            course_id=course.course_name,
        )
    except Exception as e:
        logger.debug(
            "failed to insert log record for {} in {} : doAssignment Details: {}".format(
                auth.user.username, course.course_name, e
            )
        )

    questionslist = []
    questions_score = 0
    readings = OrderedDict()
    readings_score = 0

    # For each question, accumulate information, and add it to either the readings or questions data structure
    # If scores have not been released for the question or if there are no scores yet available, the scoring information will be recorded as empty strings
    qset = set()
    for q in questions:
        if q.questions.htmlsrc:
            # This replacement is to render images
            if six.PY3:
                bts = q.questions.htmlsrc
            else:
                bts = bytes(q.questions.htmlsrc).decode("utf8")

            htmlsrc = bts.replace(
                'src="../_static/', 'src="' + get_course_url("_static/")
            )
            htmlsrc = htmlsrc.replace("../_images", get_course_url("_images"))
            htmlsrc = htmlsrc.replace(
                "generated/webwork", get_course_url("generated/webwork")
            )
        else:
            htmlsrc = None

        # get score and comment
        grade = (
            db(
                (db.question_grades.sid == auth.user.username)
                & (db.question_grades.course_name == auth.user.course_name)
                & (db.question_grades.div_id == q.questions.name)
            )
            .select()
            .first()
        )
        if grade:
            score, comment = grade.score, grade.comment
        else:
            score, comment = 0, "ungraded"

        if score is None:
            score = 0

        chap_name = q.questions.chapter
        subchap_name = q.questions.subchapter

        info = dict(
            htmlsrc=htmlsrc,
            score=score,
            points=q.assignment_questions.points,
            comment=comment,
            chapter=q.questions.chapter,
            subchapter=q.questions.subchapter,
            chapter_name=chap_name,
            subchapter_name=subchap_name,
            name=q.questions.name,
            activities_required=q.assignment_questions.activities_required,
        )
        if q.assignment_questions.reading_assignment:
            # add to readings
            if chap_name not in readings:
                # add chapter info
                completion = (
                    db(
                        (db.user_chapter_progress.user_id == auth.user.id)
                        & (db.user_chapter_progress.chapter_id == chap_name)
                    )
                    .select()
                    .first()
                )
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
            subch_completion = (
                db(
                    (db.user_sub_chapter_progress.user_id == auth.user.id)
                    & (
                        db.user_sub_chapter_progress.sub_chapter_id
                        == q.questions.subchapter
                    )
                    & (db.user_sub_chapter_progress.chapter_id == q.questions.chapter)
                    & (
                        db.user_sub_chapter_progress.course_name
                        == auth.user.course_name
                    )
                )
                .select()
                .first()
            )
            if not subch_completion:
                status = "notstarted"
            elif subch_completion.status == 1:
                status = "completed"
            elif subch_completion.status == 0:
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
                q.questions.name not in qset and info not in questionslist
            ):  # add to questions
                questionslist.append(info)
                questions_score += info["score"]
                qset.add(q.questions.name)

    # put readings into a session variable, to enable next/prev button
    readings_names = []
    for chapname in readings:
        readings_names = readings_names + [
            "{}/{}.html".format(d["chapter"], d["subchapter"])
            for d in readings[chapname]["subchapters"]
        ]

    if "RS_info" in request.cookies:
        logger.debug(f"RS_info Cookie {request.cookies['RS_info']}")
        # Note that to get to the value of the cookie you must use ``.value``
        parsed_js = json.loads(request.cookies["RS_info"].value)
    else:
        parsed_js = {}
    parsed_js["readings"] = readings_names
    # But to set the cookie you do NOT use ``.value``
    response.cookies["RS_info"] = json.dumps(parsed_js)
    response.cookies["RS_info"]["path"] = "/"
    # By not setting expire this remains/becomes a session cookie

    user_is_instructor = (
        True
        if auth.user and verifyInstructorStatus(auth.user.course_id, auth.user)
        else False
    )

    set_latex_preamble(course.base_course)

    c_origin = getCourseOrigin(course.base_course)
    if c_origin and c_origin.value == "PreTeXt":
        c_origin = "PreTeXt"
    else:
        c_origin = "Runestone"
    print("ORIGIN", c_origin)

    # grabs the row for the current user and and assignment in the grades table
    grade = (
        db(
            (db.grades.auth_user == auth.user.id)
            & (db.grades.assignment == assignment_id)
        )
        .select()
        .first()
    )
    # If cannot find the row in the grades folder, make one and set to not submitted
    if not grade:
        db.grades.update_or_insert(
            auth_user=auth.user.id,
            assignment=assignment_id,
            is_submit="",  # set is_submit variable to incomplete
        )
        grade = (
            db(
                (db.grades.auth_user == auth.user.id)
                & (db.grades.assignment == assignment_id)
            )
            .select()
            .first()
        )

    # Makes variable that will not allow student to change status if assignment is graded.
    if grade.score:
        is_graded = True
    else:
        is_graded = False

    timezoneoffset = session.timezoneoffset if "timezoneoffset" in session else None
    if not timezoneoffset and "RS_info" in request.cookies:
        parsed_js = json.loads(request.cookies["RS_info"].value)
        timezoneoffset = parsed_js.get("tz_offset", None)

    timestamp = datetime.datetime.utcnow()
    deadline = assignment.duedate
    if timezoneoffset:
        deadline = deadline + datetime.timedelta(hours=float(timezoneoffset))

    enforce_pastdue = False
    if assignment.enforce_due and timestamp > deadline:
        enforce_pastdue = True

    return dict(  # This is all the variables that will be used in the doAssignment.html document
        course=course,
        course_name=auth.user.course_name,
        assignment=assignment,
        questioninfo=questionslist,
        course_id=auth.user.course_name,
        readings=readings,
        questions_score=questions_score,
        readings_score=readings_score,
        # gradeRecordingUrl=URL('assignments', 'record_grade'),
        # calcTotalsURL=URL('assignments', 'calculate_totals'),
        student_id=auth.user.username,
        student_num=auth.user.id,
        released=assignment["released"],
        is_instructor=user_is_instructor,
        origin=c_origin,
        is_submit=grade.is_submit,
        is_graded=is_graded,
        enforce_pastdue=enforce_pastdue,
        ptx_js_version=course_attrs.get("ptx_js_version", "0.2"),
        webwork_js_version=course_attrs.get("webwork_js_version", "2.17"),
    )


@auth.requires_login()
def chooseAssignment():

    if "access_token" not in request.cookies:
        logger.error(f"Missing Access Token: {auth.user.username} adding one Now")
        create_rs_token()

    redirect("/assignment/student/chooseAssignment")
    timezoneoffset = session.timezoneoffset if "timezoneoffset" in session else None
    if not timezoneoffset and "RS_info" in request.cookies:
        parsed_js = json.loads(request.cookies["RS_info"].value)
        timezoneoffset = parsed_js.get("tz_offset", None)

    status = []  # This will be used to show the status of each assignment on html file
    score = []
    duedates = []  # This will be used to display the due date for each assignment
    ontime = []

    course = db(db.courses.id == auth.user.course_id).select().first()
    assignments = db(
        (db.assignments.course == course.id)
        & (db.assignments.visible == "T")
        & ((db.assignments.is_peer == False) | (db.assignments.is_peer == None))
    ).select(orderby=~db.assignments.duedate)

    for assignment in assignments:

        timestamp = datetime.datetime.utcnow()
        deadline = assignment.duedate

        # deadline is in localtime of the instructor - we should display
        # the deadline with no conversion.  TODO: end this craziness by storing the deadline in UTC
        # convert the timestamp to localtime - avoid false positive Past Due messages
        if timezoneoffset:
            timestamp = timestamp - datetime.timedelta(hours=float(timezoneoffset))

        # Finds the grades table for each assignment
        grade = (
            db(
                (db.grades.auth_user == auth.user.id)
                & (db.grades.assignment == assignment.id)
            )
            .select()
            .first()
        )

        # Creates a list of statuses that will display the grade or the is_submit variable
        if grade:
            if (grade.score is not None) and assignment.points:
                if assignment.points:
                    percent_grade = 100 * grade.score / assignment.points
                else:
                    percent_grade = 0.0
                percent_grade = 100 * grade.score / assignment.points
                if percent_grade % 10 == 0:
                    score.append(str(int(percent_grade)) + "%")
                else:
                    score.append("{0:.1f}%".format(percent_grade))
            else:
                score.append("Not Graded")

            if deadline <= datetime.datetime.utcnow() and grade.is_submit != "Finished":
                ontime.append(False)
            else:
                ontime.append(True)

            if grade.is_submit:
                status.append(grade.is_submit)
            elif timestamp > deadline and assignment.enforce_due:
                status.append("Past Due")
            else:
                status.append("")
        elif timestamp > deadline and assignment.enforce_due:
            status.append("Past Due")
            score.append("Not Graded")
            ontime.append(False)
        else:
            status.append("")
            score.append("Not Graded")
            ontime.append(True)

        # Convert the duedate for current assignment to string
        duedates.append(date2String(deadline))

    is_parallel = len(status) == len(score) == len(ontime) == len(duedates)
    if is_parallel is False:
        logger.error(
            "Arrays must be parallel {auth.user.username=} {course.course_name=}"
        )
        logger.debug(f"{status=}")
        logger.debug(f"{score=}")
        logger.debug(f"{ontime=}")
        logger.debug(f"{duedates=}")

    assert len(status) == len(score) == len(ontime) == len(duedates)

    return dict(
        assignments=assignments,
        status=status,
        duedates=duedates,
        score=score,
        course_id=auth.user.course_name,
        course=course,
        ontime=ontime,
    )


def date2String(date_time):
    """This function is used to take a datetime object and convert it to a string
    representing the month, day, and time in 12 hour form"""
    day = str(date_time.strftime("%b")) + " " + str(date_time.day)
    time = date_time.strftime("%I:%M %p")
    displayDate = day + ", " + time
    return displayDate


# The rest of the file is about the the spaced practice:


def _get_course_practice_record(course_name):
    return db(db.course_practice.course_name == course_name).select().first()


def _get_student_practice_grade(sid, course_name):
    return (
        db(
            (db.practice_grades.auth_user == sid)
            & (db.practice_grades.course_name == course_name)
        )
        .select()
        .first()
    )


# Called when user clicks "I'm done" button.
@auth.requires_login()
def checkanswer():

    sid = auth.user.id
    course_name = auth.user.course_name
    # Retrieve the question id from the request object.
    qid = request.vars.get("QID", None)
    username = auth.user.username
    # Retrieve the q (quality of answer) from the request object.
    q = request.vars.get("q", None)

    # If the question id exists:
    if request.vars.QID:
        now = datetime.datetime.utcnow()
        # Use the autograding function to update the flashcard's e-factor and i-interval.
        do_check_answer(
            sid,
            course_name,
            qid,
            username,
            q,
            db,
            settings,
            now,
            float(session.timezoneoffset) if "timezoneoffset" in session else 0,
        )

        # Since the user wants to continue practicing, continue with the practice action.
        redirect(URL("practice"))
    session.flash = (
        "Sorry, your score was not saved. Please try submitting your answer again."
    )
    redirect(URL("practice"))


# Gets invoked from lti to set timezone and then redirect to practice()
def settz_then_practice():
    return dict(
        course=get_course_row(),
        course_name=request.vars.get("course_name", settings.default_course),
    )


# Gets invoked from practice if there is no record in course_practice for this course or the practice is not started.
@auth.requires_login()
def practiceNotStartedYet():
    return dict(
        course=get_course_row(db.courses.ALL),
        course_id=auth.user.course_name,
        message1=bleach.clean(request.vars.message1 or ""),
        message2=bleach.clean(request.vars.message2 or ""),
    )


# Gets invoked when the student requests practicing topics.
@auth.requires_login()
def practice():

    if "access_token" not in request.cookies:
        return redirect(URL("default", "accessIssue"))

    if not session.timezoneoffset:
        session.timezoneoffset = 0

    feedback_saved = request.vars.get("feedback_saved", None)
    if feedback_saved is None:
        feedback_saved = ""

    (
        now,
        now_local,
        message1,
        message2,
        practice_graded,
        spacing,
        interleaving,
        practice_completion_count,
        remaining_days,
        max_days,
        max_questions,
        day_points,
        question_points,
        presentable_flashcards,
        available_flashcards_num,
        practiced_today_count,
        questions_to_complete_day,
        practice_today_left,
        points_received,
        total_possible_points,
        flashcard_creation_method,
    ) = _get_practice_data(
        auth.user,
        float(session.timezoneoffset) if "timezoneoffset" in session else 0,
        db,
    )

    try:
        db.useinfo.insert(
            sid=auth.user.username,
            act=message1 or "beginning practice",
            div_id="/runestone/assignments/practice",
            event="practice",
            timestamp=datetime.datetime.utcnow(),
            course_id=auth.user.course_name,
        )
    except Exception as e:
        logger.error(f"failed to insert log record for practice: {e}")

    if message1 != "":
        # session.flash = message1 + " " + message2
        return redirect(
            URL(
                "practiceNotStartedYet", vars=dict(message1=message1, message2=message2)
            )
        )

    # Since each authenticated user has only one active course, we retrieve the course this way.
    course = db(db.courses.id == auth.user.course_id).select().first()

    all_flashcards = db(
        (db.user_topic_practice.course_name == auth.user.course_name)
        & (db.user_topic_practice.user_id == auth.user.id)
        & (db.user_topic_practice.chapter_label == db.chapters.chapter_label)
        & (
            db.user_topic_practice.sub_chapter_label
            == db.sub_chapters.sub_chapter_label
        )
        & (db.chapters.course_id == course.base_course)
        & (db.sub_chapters.chapter_id == db.chapters.id)
    ).select(
        db.chapters.chapter_name,
        db.sub_chapters.sub_chapter_name,
        db.user_topic_practice.i_interval,
        db.user_topic_practice.next_eligible_date,
        db.user_topic_practice.e_factor,
        db.user_topic_practice.q,
        db.user_topic_practice.last_completed,
        orderby=db.user_topic_practice.id,
    )
    for f_card in all_flashcards:
        if interleaving == 1:
            f_card["remaining_days"] = max(
                0,
                (f_card.user_topic_practice.next_eligible_date - now_local.date()).days,
            )
            # f_card["mastery_percent"] = int(100 * f_card["remaining_days"] // 55)
            f_card["mastery_percent"] = int(f_card["remaining_days"])
        else:
            # The maximum q is 5.0 and the minimum e_factor that indicates mastery of the topic is 2.5. `5 * 2.5 = 12.5`
            # I learned that when students under the blocking condition answer something wrong multiple times,
            # it becomes too difficult for them to pass it and the system asks them the same question many times
            # (because most subchapters have only one question). To solve this issue, I changed the blocking formula.
            f_card["mastery_percent"] = int(
                100
                * f_card.user_topic_practice.e_factor
                * f_card.user_topic_practice.q
                / 12.5
            )
            if f_card["mastery_percent"] > 100:
                f_card["mastery_percent"] = 100

        f_card["mastery_color"] = "danger"
        if f_card["mastery_percent"] >= 75:
            f_card["mastery_color"] = "success"
        elif f_card["mastery_percent"] >= 50:
            f_card["mastery_color"] = "info"
        elif f_card["mastery_percent"] >= 25:
            f_card["mastery_color"] = "warning"

    # If an instructor removes the practice flag from a question in the middle of the semester
    # and students are in the middle of practicing it, the following code makes sure the practice tool does not crash.
    questions = []
    if len(presentable_flashcards) > 0:
        # Present the first one.
        flashcard = presentable_flashcards[0]
        # Get eligible questions.
        questions = _get_qualified_questions(
            course.base_course, flashcard.chapter_label, flashcard.sub_chapter_label, db
        )
    # If the student has any flashcards to practice and has not practiced enough to get their points for today or they
    # have intrinsic motivation to practice beyond what they are expected to do.
    if (
        available_flashcards_num > 0
        and len(questions) > 0
        and (
            practiced_today_count != questions_to_complete_day
            or request.vars.willing_to_continue
            or spacing == 0
        )
    ):
        # Find index of the last question asked.
        question_names = [q.name for q in questions]

        try:
            qIndex = question_names.index(flashcard.question_name)
        except Exception:
            qIndex = 0

        # present the next one in the list after the last one that was asked
        question = questions[(qIndex + 1) % len(questions)]

        if question.htmlsrc:
            # This replacement is to render images
            question.htmlsrc = question.htmlsrc.replace(
                'src="../_static/', 'src="' + get_course_url("_static/")
            )
            question.htmlsrc = question.htmlsrc.replace(
                "../_images/", get_course_url("_images/")
            )
        else:
            logger.error(
                f"NO HTML SOURCE for question {question.id}, {question.name} sid: {auth.user.username}"
            )

        autogradable = 1
        # If it is possible to autograde it:
        if (question.autograde is not None) or (
            question.question_type is not None
            and question.question_type
            in [
                "mchoice",
                "parsonsprob",
                "fillintheblank",
                "clickablearea",
                "dragndrop",
            ]
        ):
            autogradable = 2

        questioninfo = [question.htmlsrc, question.name, question.id, autogradable]

        # This is required to check the same question in do_check_answer().
        flashcard.question_name = question.name
        # This is required to only check answers after this timestamp in do_check_answer().
        flashcard.last_presented = now
        flashcard.timezoneoffset = (
            float(session.timezoneoffset) if "timezoneoffset" in session else 0
        )
        flashcard.update_record()

    else:
        questioninfo = None

        # Add a practice completion record for today, if there isn't one already.
        practice_completion_today = db(
            (db.user_topic_practice_completion.course_name == auth.user.course_name)
            & (db.user_topic_practice_completion.user_id == auth.user.id)
            & (
                db.user_topic_practice_completion.practice_completion_date
                == now_local.date()
            )
        )
        if practice_completion_today.isempty():
            db.user_topic_practice_completion.insert(
                user_id=auth.user.id,
                course_name=auth.user.course_name,
                practice_completion_date=now_local.date(),
            )
            practice_completion_count = _get_practice_completion(
                auth.user.id, auth.user.course_name, spacing, db
            )
            if practice_graded == 1:
                # send practice grade via lti, if setup for that
                lti_record = _get_lti_record(session.oauth_consumer_key)
                practice_grade = _get_student_practice_grade(
                    auth.user.id, auth.user.course_name
                )
                course_settings = _get_course_practice_record(auth.user.course_name)

                if spacing == 1:
                    total_possible_points = day_points * max_days
                    points_received = day_points * practice_completion_count
                else:
                    total_possible_points = question_points * max_questions
                    points_received = question_points * practice_completion_count

                if (
                    lti_record
                    and practice_grade
                    and practice_grade.lis_outcome_url
                    and practice_grade.lis_result_sourcedid
                    and course_settings
                ):
                    if spacing == 1:
                        send_lti_grade(
                            assignment_points=max_days,
                            score=practice_completion_count,
                            consumer=lti_record.consumer,
                            secret=lti_record.secret,
                            outcome_url=practice_grade.lis_outcome_url,
                            result_sourcedid=practice_grade.lis_result_sourcedid,
                        )
                    else:
                        send_lti_grade(
                            assignment_points=max_questions,
                            score=practice_completion_count,
                            consumer=lti_record.consumer,
                            secret=lti_record.secret,
                            outcome_url=practice_grade.lis_outcome_url,
                            result_sourcedid=practice_grade.lis_result_sourcedid,
                        )

    set_latex_preamble(course.base_course)

    return dict(
        course=course,
        q=questioninfo,
        all_flashcards=all_flashcards,
        flashcard_count=available_flashcards_num,
        # The number of days the student has completed their practice.
        practice_completion_count=practice_completion_count,
        remaining_days=remaining_days,
        max_questions=max_questions,
        max_days=max_days,
        # The number of times remaining to practice today to get the completion point.
        practice_today_left=practice_today_left,
        # The number of times this user has submitted their practice from the beginning of today (12:00 am)
        # till now.
        practiced_today_count=practiced_today_count,
        total_today_count=min(
            practice_today_left + practiced_today_count, questions_to_complete_day
        ),
        questions_to_complete_day=questions_to_complete_day,
        points_received=points_received,
        total_possible_points=total_possible_points,
        practice_graded=practice_graded,
        spacing=spacing,
        interleaving=interleaving,
        flashcard_creation_method=flashcard_creation_method,
        feedback_saved=feedback_saved,
        day_points=day_points,
    )


# Called when user clicks like or dislike icons.
@auth.requires_login()
def like_dislike():

    sid = auth.user.id
    course_name = auth.user.course_name
    likeVal = request.vars.get("likeVal", None)

    if likeVal:
        db.user_topic_practice_survey.insert(
            user_id=sid,
            course_name=course_name,
            like_practice=likeVal,
            response_time=datetime.datetime.utcnow(),
            timezoneoffset=(
                float(session.timezoneoffset) if "timezoneoffset" in session else 0
            ),
        )
        redirect(URL("practice"))
    session.flash = "Sorry, your request was not saved. Please login and try again."
    redirect(URL("practice"))


# Called when user submits their feedback at the end of practicing.
@auth.requires_login()
def practice_feedback():

    sid = auth.user.id
    course_name = auth.user.course_name
    feedback = request.vars.get("Feed", None)

    if feedback:
        db.user_topic_practice_feedback.insert(
            user_id=sid,
            course_name=course_name,
            feedback=feedback,
            response_time=datetime.datetime.utcnow(),
            timezoneoffset=(
                float(session.timezoneoffset) if "timezoneoffset" in session else 0
            ),
        )
        redirect(URL("practice", vars=dict(feedback_saved=1)))
    session.flash = "Sorry, your request was not saved. Please login and try again."
    redirect(URL("practice"))


# Assignment report
# =================
# Return an error.
def _error_formatter(e):
    response.headers["content-type"] = "application/json"

    return json.dumps({"errors": [traceback.format_exc()]})


# .. _assignments/grades_report endpoint:
#
# assignments/grades_report endpoint
# ----------------------------------
# Produce an table with information about an assignment or chapter, for use in the grading tab.
@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def grades_report():
    try:
        if request.vars.report_type == "assignment":
            grades = query_assignment(
                auth.user.course_name,
                request.vars.chap_or_assign,
            )
        else:
            assert (
                request.vars.report_type == "chapter"
            ), "Unknown report type {}".format(request.vars.report_type)
            grades = questions_to_grades(
                auth.user.course_name,
                (db.questions.chapter == request.vars.chap_or_assign)
                & (db.questions.base_course == get_course_row().base_course),
            )
    except Exception as e:
        return _error_formatter(e)

    response.headers["content-type"] = "application/json"
    return grades_to_hot(grades)
