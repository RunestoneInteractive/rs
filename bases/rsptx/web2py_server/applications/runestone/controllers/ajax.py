# *************************
# |docname| - Runestone API
# *************************
# **Most of this file is Deprecated.**
# The endpoints that used to live here have moved to the BookServer. Only the
# endpoints still required by the legacy web2py application remain:
#
# * ``set_tz_offset()``   -- records the browser timezone offset in the session
#                            (still posted to by some web2py views).
# * ``getassignmentgrade()`` -- returns a student's grade/comment for a question.
# * ``broadcast_code()``  -- lets an instructor share scratch ActiveCode with the
#                            whole class.
#
# If you are debugging browser-to-server API behavior you almost certainly want
# the BookServer, not this file.
#
# Imports
# =======
import datetime
import json
import logging

logger = logging.getLogger(settings.logger)
logger.setLevel(settings.log_level)
logger.propagate = False

# Comment prefix by language, used when sharing instructor code.
COMMENT_MAP = {
    "sql": "--",
    "python": "#",
    "java": "//",
    "javascript": "//",
    "c": "//",
    "cpp": "//",
}


def set_tz_offset():
    session.timezoneoffset = request.vars.timezoneoffset
    logger.debug("setting timezone offset in session %s hours" % session.timezoneoffset)
    return "done"


def getassignmentgrade():
    response.headers["content-type"] = "application/json"
    if not auth.user:
        return json.dumps([dict(message="not logged in")])

    divid = request.vars.div_id

    ret = {
        "grade": "Not graded yet",
        "comment": "No Comments",
        "avg": "None",
        "count": "None",
        "released": False,
    }

    # check that the assignment is released
    #
    a_q = (
        db(
            (db.assignments.course == auth.user.course_id)
            & (db.assignment_questions.assignment_id == db.assignments.id)
            & (db.assignment_questions.question_id == db.questions.id)
            & (db.questions.name == divid)
        )
        .select(
            db.assignments.released, db.assignments.id, db.assignment_questions.points
        )
        .first()
    )

    # if there is no assignment_question
    # try new way that we store scores and comments
    # divid is a question; find question_grades row
    result = (
        db(
            (db.question_grades.sid == auth.user.username)
            & (db.question_grades.course_name == auth.user.course_name)
            & (db.question_grades.div_id == divid)
        )
        .select(db.question_grades.score, db.question_grades.comment)
        .first()
    )
    logger.debug(result)
    if result:
        # say that we're sending back result styles in new version, so they can be processed differently without affecting old way during transition.
        ret["version"] = 2
        ret["released"] = a_q.assignments.released if a_q else False
        if a_q and not a_q.assignments.released:
            ret["grade"] = "Not graded yet"
        elif a_q and a_q.assignments.released:
            ret["grade"] = result.score or "Written Feedback Only"

        if a_q and a_q.assignments.released == True:
            ret["max"] = a_q.assignment_questions.points
        else:
            ret["max"] = ""

        if result.comment:
            ret["comment"] = result.comment

    return json.dumps([ret])


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_name, auth.user),
    requires_login=True,
)
def broadcast_code():
    """
    Callable by an instructor to send the code in their scratch activecode
    to all students in the class.
    """
    the_course = (
        db(db.courses.course_name == auth.user.course_name)
        .select(**SELECT_CACHE)
        .first()
    )
    cid = the_course.id
    student_list = db(
        (db.user_courses.course_id == cid)
        & (db.auth_user.id == db.user_courses.user_id)
    ).select()
    shared_code = (
        "{} Instructor shared code on {}\n".format(
            COMMENT_MAP.get(request.vars.lang, "#"), datetime.datetime.utcnow().date()
        )
        + request.vars.code
    )
    counter = 0
    for student in student_list:
        if student.auth_user.id == auth.user.id:
            continue
        sid = student.auth_user.username
        try:
            db.code.insert(
                sid=sid,
                acid=request.vars.divid,
                code=shared_code,
                emessage="",
                timestamp=datetime.datetime.utcnow(),
                course_id=cid,
                language=request.vars.lang,
                comment="Instructor shared code",
            )
        except Exception as e:
            logger.error("Failed to insert instructor code! details: {}".format(e))
            return json.dumps(dict(mess="failed"))

        counter += 1

    return json.dumps(dict(mess="success", share_count=counter))
