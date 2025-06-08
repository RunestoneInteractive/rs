# *************************************************
# |docname| - reusable functions for our data model
# *************************************************
"""
Create Retrieve Update and Delete (CRUD) functions for database tables

Rather than litter the code with raw database queries the vast majority should be
turned into reusable functions that are defined in this file.

"""
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import hashlib
import json
from typing import Dict, List, Optional, Tuple, Any
import textwrap
import traceback
import pytz

from sqlalchemy import (
    select,
    func,
    and_,
    or_,
)

# Third-party imports
# -------------------

from sqlalchemy import update
from sqlalchemy.sql import select, text, delete
from sqlalchemy.orm import attributes
from starlette.requests import Request

from rsptx.validation import schemas

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from ..async_session import async_session
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.db.models import (
    Assignment,
    AssignmentQuestion,
    AuthUser,
    AuthUserValidator,
    Chapter,
    ChapterValidator,
    Code,
    CodeValidator,
    CourseAttribute,
    CourseInstructor,
    CourseInstructorValidator,
    CourseLtiMap,
    Courses,
    CoursesValidator,
    DeadlineExceptionValidator,
    DomainApprovals,
    EditorBasecourse,
    InvoiceRequest,
    LtiKey,
    Lti1p3Course,
    Question,
    QuestionGrade,
    QuestionGradeValidator,
    QuestionValidator,
    runestone_component_dict,
    SelectedQuestion,
    SelectedQuestionValidator,
    SubChapter,
    SubChapterValidator,
    TimedExam,
    TimedExamValidator,
    TraceBack,
    Useinfo,
    UseinfoValidation,
    UserCourse,
    APIToken,
    APITokenValidator,
)
from .course import fetch_course, create_course
from .user import create_user

# Map from the ``event`` field of a ``LogItemIncoming`` to the database table used to store data associated with this event.
EVENT2TABLE = {
    "clickableArea": "clickablearea_answers",
    "codelens": "codelens_answers",
    "dragNdrop": "dragndrop_answers",
    "fillb": "fitb_answers",
    "lp_build": "lp_answers",
    "matching": "matching_answers",
    "mChoice": "mchoice_answers",
    "parsons": "parsons_answers",
    "shortanswer": "shortanswer_answers",
    "unittest": "unittest_answers",
    "timedExam": "timed_exam",
    "webwork": "webwork_answers",
    "hparsonsAnswer": "microparsons_answers",
    "SPLICE.score": "splice_answers",
    "SPLICE.reportScoreAndState": "splice_answers",
    "SPLICE.getState": "splice_answers",
}


# useinfo
# -------
async def create_useinfo_entry(log_entry: UseinfoValidation) -> UseinfoValidation:
    """Add a row to the ``useinfo`` table.

    :param log_entry: Log entries contain a timestamp, an event, details about the event, a student id, and the identifier of the book element that was interacted with.
    :type log_entry: UseinfoValidation
    :return: A representation of the row inserted.
    :rtype: UseinfoValidation
    """
    async with async_session.begin() as session:
        new_entry = Useinfo(**log_entry.dict())
        rslogger.debug(f"timestamp = {log_entry.timestamp} ")
        rslogger.debug(f"New Entry = {new_entry}")
        rslogger.debug(f"session = {session}")
        session.add(new_entry)
    rslogger.debug(new_entry)
    return UseinfoValidation.from_orm(new_entry)


async def count_useinfo_for(
    div_id: str, course_name: str, start_date: datetime.datetime
) -> List[tuple]:
    """return a list of tuples that include the [(act, count), (act, count)]
    act is a freeform field in the useinfo table that varies from event
    type to event type.

    :param div_id: Unique identifier of a Runestone component
    :type div_id: str
    :param course_name: The current course
    :type course_name: str
    :param start_date:
    :type start_date: datetime.datetime
    :return: A list of tuples [(act, count), (act), count)]
    :rtype: List[tuple]
    """
    query = (
        select(Useinfo.act, func.count(Useinfo.act).label("count"))
        .where(
            (Useinfo.div_id == div_id)
            & (Useinfo.course_id == course_name)
            & (Useinfo.timestamp > start_date)
        )
        .group_by(Useinfo.act)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"res = {res}")
        return res.all()







async def fetch_poll_summary(div_id: str, course_name: str) -> List[tuple]:
    """
    Find the last answer for each student and then aggregate those answers to provide a summary of poll
    responses for the given question. For a poll, the value of act is a response number 0--N where N is
    the number of different choices.

    :param div_id: The div_id of the poll
    :type div_id: str
    :param course_name: The name of the course
    :type course_name: str
    :return: A list of tuples where the first element is the response number and the second element is the count
             of students who chose that response.
    :rtype: List[tuple]
    """
    query = text(
        """select act, count(*) from useinfo
        join (select sid, max(id) mid
        from useinfo where event='poll' and div_id = :div_id and course_id = :course_name group by sid) as T
        on id = T.mid group by act"""
    )

    async with async_session() as session:
        rows = await session.execute(
            query, params=dict(div_id=div_id, course_name=course_name)
        )
        return rows.all()


async def fetch_top10_fitb(dbcourse: CoursesValidator, div_id: str) -> List[tuple]:
    """
    Return the top 10 answers to a fill in the blank question.

    :param dbcourse: The course for which to retrieve the top answers.
    :type dbcourse: CoursesValidator
    :param div_id: The div_id of the fill in the blank question.
    :type div_id: str
    :return: A list of tuples where the first element is the answer and the second element is the count of times
             that answer was given.
    :rtype: List[tuple]
    """
    rcd = runestone_component_dict["fitb_answers"]
    tbl = rcd.model
    query = (
        select(tbl.answer, func.count(tbl.answer).label("count"))
        .where(
            (tbl.div_id == div_id)
            & (tbl.course_name == dbcourse.course_name)
            & (tbl.timestamp > dbcourse.term_start_date)
        )
        .group_by(tbl.answer)
        .order_by(func.count(tbl.answer).desc())
        .limit(10)
    )
    async with async_session() as session:
        rows = await session.execute(query)
        return rows.all()


# xxx_answers
# -----------
async def create_answer_table_entry(
    # The correct type is one of the validators for an answer table; we use LogItemIncoming as a generalization of this.
    log_entry: schemas.LogItemIncoming,
    # The event type.
    event: str,
) -> schemas.LogItemIncoming:
    """Populate the xxx_answers table with the incoming data

    :param log_entry:
    :type log_entry: schemas.LogItemIncoming
    :param event: Will be something like "mchoice", "parsons", etc.
    :type event: str
    :return: Returns the newly created item
    :rtype: schemas.LogItemIncoming
    """
    rslogger.debug(f"hello from create at {log_entry}")
    rcd = runestone_component_dict[EVENT2TABLE[event]]
    new_entry = rcd.model(**log_entry.dict())  # type: ignore
    async with async_session.begin() as session:
        session.add(new_entry)

    rslogger.debug(f"returning {new_entry}")
    return rcd.validator.from_orm(new_entry)  # type: ignore


async def fetch_last_answer_table_entry(
    query_data: schemas.AssessmentRequest,
) -> schemas.LogItemIncoming:
    """The xxx_answers table contains ALL of the answers a student has made for this question.  but most often all we want is the most recent answer

    :param query_data:
    :type query_data: schemas.AssessmentRequest
    :return: The most recent answer
    :rtype: schemas.LogItemIncoming
    """
    rcd = runestone_component_dict[EVENT2TABLE[query_data.event]]
    tbl = rcd.model
    deadline_offset_naive = query_data.deadline.replace(tzinfo=None)
    query = (
        select(tbl)
        .where(
            and_(
                tbl.div_id == query_data.div_id,
                tbl.course_name == query_data.course,
                tbl.sid == query_data.sid,
                tbl.timestamp <= deadline_offset_naive,
            )
        )
        .order_by(tbl.timestamp.desc())
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"res = {res}")
        return rcd.validator.from_orm(res.scalars().first())  # type: ignore


async def fetch_last_poll_response(sid: str, course_name: str, poll_id: str) -> str:
    """
    Return a student's (sid) last response to a given poll (poll_id)

    :param sid: str, the student id
    :param course_name: str, the name of the course
    :param poll_id: str, the id of the poll
    :return: str, the last response of the student for the given poll
    """
    query = (
        select(Useinfo.act)
        .where(
            (Useinfo.sid == sid)
            & (Useinfo.course_id == course_name)
            & (Useinfo.div_id == poll_id)
        )
        .order_by(Useinfo.id.desc())
    )
    async with async_session() as session:
        res = await session.execute(query)
        return res.scalars().first()


# course_attributes
# -----------------


async def fetch_all_course_attributes(course_id: int) -> dict:
    """
    Retrieve all attributes and their values for a given course (course_id)

    :param course_id: int, the id of the course
    :return: dict, a dictionary containing all course attributes and their values
    """
    query = select(CourseAttribute).where(CourseAttribute.course_id == course_id)

    async with async_session() as session:
        res = await session.execute(query)
        return {row.attr: row.value for row in res.scalars().fetchall()}


async def fetch_one_course_attribute():
    """
    Fetch a single course attribute (not implemented)

    :raises: NotImplementedError
    """
    raise NotImplementedError()


async def create_course_attribute(course_id: int, attr: str, value: str):
    """
    Create a new course attribute for a given course (course_id)

    :param course_id: int, the id of the course
    :param attr: str, the attribute name
    :param value: str, the attribute value
    """
    new_attr = CourseAttribute(course_id=course_id, attr=attr, value=value)
    async with async_session.begin() as session:
        session.add(new_attr)


async def copy_course_attributes(basecourse_id: int, new_course_id: int):
    """
    Copy all course attributes from a base course to a new course
    """
    query = select(CourseAttribute).where(CourseAttribute.course_id == basecourse_id)
    async with async_session() as session:
        res = await session.execute(query)
        for row in res.scalars().fetchall():
            print(row.attr, row.value)
            new_attr = CourseAttribute(
                course_id=new_course_id, attr=row.attr, value=row.value
            )
            session.add(new_attr)
        await session.commit()


async def get_course_origin(base_course):
    """
    Retrieve the origin of a given course (base_course)

    :param base_course: str, the name of the base course
    :return: str, the origin of the course
    """
    query = select(CourseAttribute).where(
        (CourseAttribute.course_id == base_course)
        & (CourseAttribute.attr == "markup_system")
    )

    async with async_session() as session:
        res = await session.execute(query)
        ca = res.scalars().first()
        return ca.value



# instructor_courses
# ------------------
async def fetch_instructor_courses(
    instructor_id: int, course_id: Optional[int] = None
) -> List[CourseInstructorValidator]:
    """
    Retrieve a list of courses for which the given instructor id (instructor_id) is an instructor.
    If the optional course_id value is included then return the row for that
    course to verify that instructor_id is an instructor for course_id

    :param instructor_id: int, the id of the instructor
    :param course_id: Optional[int], the id of the course (if provided)
    :return: List[CourseInstructorValidator], a list of CourseInstructorValidator objects representing the courses
    """
    query = select(CourseInstructor)
    if course_id is not None:
        query = query.where(
            and_(
                CourseInstructor.instructor == instructor_id,
                CourseInstructor.course == course_id,
            )
        )
    else:
        query = query.where(CourseInstructor.instructor == instructor_id)
    async with async_session() as session:
        res = await session.execute(query)

        course_list = [
            CourseInstructorValidator.from_orm(x) for x in res.scalars().fetchall()
        ]
        return course_list


async def fetch_course_instructors(
    course_name: Optional[str] = None,
) -> List[AuthUserValidator]:
    """
    Retrieve a list of instructors for the given course name (course_name).
    If course_name is not provided, return a list of all instructors.

    :param course_name: Optional[str], the name of the course (if provided)
    :return: List[AuthUserValidator], a list of AuthUserValidator objects representing the instructors
    """
    query = select(AuthUser).join(CourseInstructor)
    if course_name:
        course = await fetch_course(course_name)
        query = query.where(CourseInstructor.course == course.id)
    async with async_session() as session:
        res = await session.execute(query)

    instructor_list = [AuthUserValidator.from_orm(x) for x in res.scalars().fetchall()]
    return instructor_list


async def create_instructor_course_entry(iid: int, cid: int) -> CourseInstructor:
    """
    Create a new CourseInstructor entry with the given instructor id (iid) and course id (cid)
    Sanity checks to make sure that the instructor is not already associated with the course

    :param iid: int, the id of the instructor
    :param cid: int, the id of the course
    :return: CourseInstructor, the newly created CourseInstructor object
    """

    async with async_session.begin() as session:
        res = await session.execute(
            select(CourseInstructor).where(
                (CourseInstructor.course == cid) & (CourseInstructor.instructor == iid)
            )
        )
        ci = res.scalars().first()
        if ci is None:
            ci = CourseInstructor(course=cid, instructor=iid)
            session.add(ci)
    return ci


async def fetch_course_students(course_id: int) -> List[AuthUserValidator]:
    """
    Retrieve a list of students for the given course id (course_id)

    :param course_id: int, the id of the course
    :return: List[AuthUserValidator], a list of AuthUserValidator objects representing the students
    """
    query = (
        select(AuthUser)
        .join(UserCourse, UserCourse.user_id == AuthUser.id)
        .where(UserCourse.course_id == course_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
    student_list = [AuthUserValidator.from_orm(x) for x in res.scalars().fetchall()]
    return student_list


# Code
# ----
async def create_code_entry(data: CodeValidator) -> CodeValidator:
    """
    Create a new code entry with the given data (data)

    :param data: CodeValidator, the CodeValidator object representing the code entry data
    :return: CodeValidator, the newly created CodeValidator object
    """
    new_code = Code(**data.dict())
    async with async_session.begin() as session:
        session.add(new_code)

    return CodeValidator.from_orm(new_code)


async def fetch_code(
    sid: str, acid: str, course_id: int, limit: int = 0
) -> List[CodeValidator]:
    """
    Retrieve a list of the most recent code entries for the given student id (sid), assignment id (acid), and course id (course_id).

    :param sid: str, the id of the student
    :param acid: str, the id of the assignment
    :param course_id: int, the id of the course
    :param limit: int, the maximum number of code entries to retrieve (0 for all)
    :return: List[CodeValidator], a list of CodeValidator objects representing the code entries
    """
    query = (
        select(Code)
        .where((Code.sid == sid) & (Code.acid == acid) & (Code.course_id == course_id))
        .order_by(Code.id.desc())
    )
    if limit > 0:
        query = query.limit(limit)
    async with async_session() as session:
        res = await session.execute(query)

        code_list = [CodeValidator.from_orm(x) for x in res.scalars().fetchall()]
        # We retrieved most recent first, but want to return results in chronological order
        code_list.reverse()
        return code_list


# Server-side grading
# -------------------
# Return the feedback associated with this question if this question should be graded on the server instead of on the client; otherwise, return None.
async def is_server_feedback(div_id: str, course: str) -> Optional[Dict[str, Any]]:
    """
    Check if server feedback is available for the given div id (div_id) and course name (course).
    If server feedback is available and login is required, return the decoded feedback.

    :param div_id: str, the id of the div element
    :param course: str, the name of the course
    :return: Optional[Dict[str, Any]], a dictionary representing the decoded feedback (if available)
    """
    # Get the information about this question.
    query = (
        select(Question, Courses)
        .where(Question.name == div_id)
        .join(Courses, Question.base_course == Courses.base_course)
        .where(Courses.course_name == course)
    )
    async with async_session() as session:
        query_results = (await session.execute(query)).first()

        # Get the feedback, if it exists.
        feedback = query_results and query_results.Question.feedback
        # If there's feedback and a login is required (necessary for server-side grading), return the decoded feedback.
        if feedback and query_results.Courses.login_required:
            return json.loads(feedback)
        # Otherwise, grade on the client.
        return None


# Development and Testing Utils
# -----------------------------


async def create_initial_courses_users():
    """
    This function populates the database with the common base courses and creates a test user.
    """
    BASE_COURSES = [
        "boguscourse",
        "ac1",
        "cppds",
        "cppforpython",
        "csawesome",
        "csjava",
        "fopp",
        "httlads",
        "java4python",
        "JS4Python",
        "learnwebgl2",
        "MasteringDatabases",
        "overview",
        "py4e-int",
        "pythonds",
        "pythonds3",
        "StudentCSP",
        "TeacherCSP",
        "thinkcpp",
        "thinkcspy",
        "webfundamentals",
        "test_course_1",
    ]

    for c in BASE_COURSES:
        new_course = CoursesValidator(
            course_name=c,
            base_course=c,
            term_start_date=datetime.date(2000, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="",
            new_server=True,
        )
        await create_course(new_course)
    # Make a user. TODO: should we not do this for production?
    await create_user(
        AuthUserValidator(
            username="testuser1",
            first_name="test",
            last_name="user",
            password="xxx",
            email="testuser1@example.com",
            course_name="overview",
            course_id=BASE_COURSES.index("overview") + 1,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1, 0, 0, 0),
            modified_on=datetime.datetime(2020, 1, 1, 0, 0, 0),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )




#
# Select Question Support
# -----------------------


async def create_selected_question(
    sid: str,
    selector_id: str,
    selected_id: str,
    points: Optional[int] = None,
    competency: Optional[str] = None,
) -> SelectedQuestionValidator:
    """
    Create a new SelectedQuestion entry with the given sid, selector_id, selected_id, points, and competency.

    :param sid: str, the student id
    :param selector_id: str, the id of the question selector
    :param selected_id: str, the id of the selected question
    :param points: int, the points earned (optional)
    :param competency: str, the competency (optional)
    :return: SelectedQuestionValidator, the newly created SelectedQuestionValidator object
    """
    new_sqv = SelectedQuestion(
        sid=sid,
        selector_id=selector_id,
        selected_id=selected_id,
        points=points,
        competency=competency,
    )
    async with async_session.begin() as session:
        session.add(new_sqv)
    return SelectedQuestionValidator.from_orm(new_sqv)


async def fetch_selected_question(
    sid: str, selector_id: str
) -> SelectedQuestionValidator:
    """
    Retrieve the SelectedQuestion entry for the given sid and selector_id.

    :param sid: str, the student id
    :param selector_id: str, the id of the question selector
    :return: SelectedQuestionValidator, the SelectedQuestionValidator object
    """
    query = select(SelectedQuestion).where(
        (SelectedQuestion.sid == sid) & (SelectedQuestion.selector_id == selector_id)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return SelectedQuestionValidator.from_orm(res.scalars().first())


async def update_selected_question(sid: str, selector_id: str, selected_id: str):
    """
    Update the selected_id of the SelectedQuestion entry for the given sid and selector_id.

    :param sid: str, the student id
    :param selector_id: str, the id of the question selector
    :param selected_id: str, the id of the selected question
    """
    stmt = (
        update(SelectedQuestion)
        .where(
            (SelectedQuestion.sid == sid)
            & (SelectedQuestion.selector_id == selector_id)
        )
        .values(selected_id=selected_id)
    )
    async with async_session.begin() as session:
        await session.execute(stmt)
    rslogger.debug("SUCCESS")


# Questions and Assignments
# -------------------------





async def fetch_timed_exam(
    sid: str, exam_id: str, course_name: str
) -> TimedExamValidator:
    """
    Retrieve the TimedExam entry for the given sid, exam_id, and course_name.

    :param sid: str, the student id
    :param exam_id: str, the id of the timed exam
    :param course_name: str, the name of the course
    :return: TimedExamValidator, the TimedExamValidator object
    """
    query = (
        select(TimedExam)
        .where(
            (TimedExam.div_id == exam_id)
            & (TimedExam.sid == sid)
            & (TimedExam.course_name == course_name)
        )
        .order_by(TimedExam.id.desc())
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return TimedExamValidator.from_orm(res.scalars().first())


async def did_start_timed(sid: str, exam_id: str, course_name: str) -> bool:
    """
    Retrieve the start time for the given sid, exam_id, and course_name.

    :param sid: str, the student id
    :param exam_id: str, the id of the timed exam
    :param course_name: str, the name of the course
    :return: bool, whether the exam has started
    """
    start_query = select(Useinfo).where(
        and_(
            Useinfo.sid == sid,
            Useinfo.div_id == exam_id,
            Useinfo.course_id == course_name,
            Useinfo.event == "timedExam",
            Useinfo.act == "start",
        )
    )
    async with async_session() as session:
        start = await session.execute(start_query)
        return start.scalars().first() is not None


async def create_timed_exam_entry(
    sid: str, exam_id: str, course_name: str, start_time: datetime
) -> TimedExamValidator:
    """
    Create a new TimedExam entry with the given sid, exam_id, course_name, and start_time.

    :param sid: str, the student id
    :param exam_id: str, the id of the timed exam
    :param course_name: str, the name of the course
    :param start_time: datetime, the start time of the exam
    :return: TimedExamValidator, the TimedExamValidator object
    """
    new_te = TimedExam(
        div_id=exam_id,
        sid=sid,
        course_name=course_name,
        start_time=start_time,
        correct=0,
        incorrect=0,
        skipped=0,
    )
    async with async_session.begin() as session:
        session.add(new_te)
    return TimedExamValidator.from_orm(new_te)


async def fetch_subchapters(course, chap):
    """
    Retrieve all subchapters for a given chapter.

    :param course: str, the name of the course
    :param chap: str, the label of the chapter
    :return: ResultProxy, the result of the query
    """
    # Note: we are joining two tables so this query will not result in an defined in schemas.py
    # instead it will simply produce a bunch of tuples with the columns in the order given in the
    # select statement.
    query = (
        select(SubChapter.sub_chapter_label, SubChapter.sub_chapter_name)
        .where(
            (Chapter.id == SubChapter.chapter_id)
            & (Chapter.course_id == course)
            & (Chapter.chapter_label == chap)
        )
        .order_by(SubChapter.sub_chapter_num)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        # **Note** with this kind of query you do NOT want to call ``.scalars()`` on the result
        return res


async def create_traceback(exc: Exception, request: Request, host: str):
    """
    Create a new TraceBack entry with the given Exception, Request, and host.

    :param exc: Exception, the exception that occurred
    :param request: Request, the request object
    :param host: str, the hostname
    """
    async with async_session.begin() as session:
        tbtext = "".join(traceback.format_tb(exc.__traceback__))
        # walk the stack trace and collect local variables into a dictionary
        curr = exc.__traceback__
        dl = []
        while curr is not None:
            frame = curr.tb_frame
            name = frame.f_code.co_name
            local_vars = frame.f_locals
            dl.append(dict(name=name, local_vars=local_vars))
            curr = curr.tb_next
        rslogger.debug(f"{dl[-2:]=}")

        new_entry = TraceBack(
            traceback=tbtext + "\n".join(textwrap.wrap(str(dl[-2:]), 80)),
            timestamp=canonical_utcnow(),
            err_message=str(exc)[:512],
            path=request.url.path[:1024],
            query_string=str(request.query_params)[:512],
            hash=hashlib.md5(tbtext.encode("utf8")).hexdigest(),
            hostname=host,
        )
        session.add(new_entry)






async def create_editor_for_basecourse(user_id: int, bc_name: str) -> EditorBasecourse:
    """
    Creates a new editor for a given basecourse.

    :param user_id: The ID of the user creating the editor.
    :type user_id: int
    :param bc_name: The name of the basecourse for which the editor is being created.
    :type bc_name: str
    :return: The newly created editor for the basecourse.
    :rtype: EditorBasecourse
    """
    new_ed = EditorBasecourse(user_id, bc_name)
    async with async_session.begin() as session:
        session.add(new_ed)
    return new_ed


# Used by the library page
async def get_students_per_basecourse() -> dict:
    """
    Gets the number of students using a book for each course.

    :return: A dictionary containing the course name and the number of students using it.
    :rtype: Dict[str,int]
    """
    query = (
        select(Courses.base_course, func.count(UserCourse.user_id))
        .join(UserCourse, Courses.id == UserCourse.course_id)
        .group_by(Courses.base_course)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        retval = {}
        for row in res.all():
            retval[row[0]] = row[1]

        return retval


async def get_courses_per_basecourse() -> dict:
    """
    Gets the number of courses using a basecourse.

    :return: A dictionary containing the base course name and the number of courses using it.
    :rtype: Dict[str,int]
    """
    query = select(Courses.base_course, func.count(Courses.id)).group_by(
        Courses.base_course
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        retval = {}
        for row in res.all():
            retval[row[0]] = row[1]

        return retval


async def fetch_questions_for_chapter_subchapter(
    base_course: str,
    skipreading: bool = False,
    from_source_only: bool = True,
    pages_only: bool = False,
) -> List[dict]:
    """
    Fetch all questions for a given base course, where the skipreading and from_source
    flags are set to the given values.

    :param base_course: str, the base course
    :param skipreading: bool, whether to skip questions/sections marked as "skipreading" Usually
       these sections are the Exercises sections at the end of chapters.
    :param from_source_only: bool, whether the question is from the source, if this is True
       then instructor contributed questions will not be included in the result.
    :param pages_only: bool, whether to include only pages for reading assignment creation.
    :return: List[dict], a list of questions in a hierarchical json structure
    """
    if skipreading:
        skipr_clause = SubChapter.skipreading == True  # noqa: E712
    else:
        skipr_clause = True
    if from_source_only:
        froms_clause = Question.from_source == True  # noqa: E712
    else:
        froms_clause = True
    if pages_only:
        page_clause = Question.question_type == "page"
    else:
        page_clause = True
    query = (
        select(Question, Chapter, SubChapter)
        .join(
            Chapter,
            and_(
                Question.chapter == Chapter.chapter_label,
                Question.base_course == Chapter.course_id,
            ),
        )
        .join(
            SubChapter,
            and_(
                SubChapter.chapter_id == Chapter.id,
                Question.subchapter == SubChapter.sub_chapter_label,
            ),
        )
        .where(
            and_(
                Chapter.course_id == base_course,
                skipr_clause,
                froms_clause,
                page_clause,
            )
        )
        .order_by(Chapter.chapter_num, SubChapter.sub_chapter_num, Question.id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        # convert the result to a hierarchical json structure using the chapter and subchapter labels
        questions = {}
        chapters = {}

        for row in res:
            q = QuestionValidator.from_orm(row.Question)
            c = ChapterValidator.from_orm(row.Chapter)
            c.chapter_label = f"{c.chapter_label}"
            sc = SubChapterValidator.from_orm(row.SubChapter)
            sc.sub_chapter_label = f"{sc.sub_chapter_label}"
            if c.chapter_label not in questions:
                questions[c.chapter_label] = {}
            if c.chapter_label not in chapters:
                chapters[c.chapter_label] = {**c.dict(), "sub_chapters": {}}
            if sc.sub_chapter_label not in questions[c.chapter_label]:
                questions[c.chapter_label][sc.sub_chapter_label] = []
            if sc.sub_chapter_label not in chapters[c.chapter_label]["sub_chapters"]:
                chapters[c.chapter_label]["sub_chapters"][sc.sub_chapter_label] = {
                    **sc.dict(),
                }
            del q.timestamp  # Does not convert to json
            del q.question
            questions[c.chapter_label][sc.sub_chapter_label].append(q)

        # Now create the hierarchical json structure where the keys are the chapter and subchapter labels
        # This is the structure that is used by the React TreeTable component
        def find_page_id(chapter, subchapter):
            for q in questions[chapter][subchapter]:
                if q.question_type == "page":
                    return q.id
            return None

        chaps = []
        for chapter in questions:
            subs = []
            for subchapter in questions[chapter]:
                subs.append(
                    {
                        "key": subchapter,
                        "data": {
                            "title": chapters[chapter]["sub_chapters"][subchapter][
                                "sub_chapter_name"
                            ],
                            "num": chapters[chapter]["sub_chapters"][subchapter][
                                "sub_chapter_num"
                            ],
                            "chapter": chapter,
                            "subchapter": subchapter,
                            "id": find_page_id(chapter, subchapter),
                            "numQuestions": len(
                                [
                                    q
                                    for q in questions[chapter][subchapter]
                                    if q.optional != True  # noqa: E712
                                ]
                            ),
                        },
                        "children": [
                            {"key": q.name, "data": q.dict()}
                            for q in questions[chapter][subchapter]
                        ],
                    }
                )
            chaps.append(
                {
                    "key": chapter,
                    "data": {
                        "title": chapters[chapter]["chapter_name"],
                        "num": chapters[chapter]["chapter_num"],
                    },
                    "children": subs,
                }
            )

        return chaps


async def fetch_answers(question_id: str, event: str, course_name: str, username: str):
    """
    Fetch all answers for a given question.

    :param question_id: int, the id of the question
    :return: List[AnswerValidator], a list of AnswerValidator objects
    """

    rcd = runestone_component_dict[EVENT2TABLE[event]]
    tbl = rcd.model
    query = select(tbl).where(
        and_(
            (tbl.div_id == question_id),
            (tbl.course_name == course_name),
            (tbl.sid == username),
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [a for a in res.scalars()]


async def is_assigned(
    question_id: str,
    course_id: int,
    assignment_id: Optional[int] = None,
    accommodation: Optional[DeadlineExceptionValidator] = None,
) -> schemas.ScoringSpecification:
    """
    Check if a question is part of an assignment.
    If the assignment is not visible, the question is not considered assigned.
    If the assignment is not yet due -- no problem.
    If the assignment is past due but the instructor has not enforced the due date -- no problem.
    If the assignment is past due but the instructor has not enforced the due date, but HAS released the assignment -- then no longer assigned.

    :param question_id: str, the name of the question
    :param course_id: int, the id of the course
    :return: ScoringSpecification, the scoring specification object
    """
    # select * from assignments join assignment_questions on assignment_questions.assignment_id = assignments.id join courses on courses.id = assignments.course where courses.course_name = 'overview'
    clauses = [
        (Question.name == question_id),
        (AssignmentQuestion.question_id == Question.id),
        (AssignmentQuestion.assignment_id == Assignment.id),
        (Assignment.course == course_id),
        (Assignment.is_timed == False),  # noqa: E712
    ]
    if assignment_id is not None:
        clauses.append(Assignment.id == assignment_id)
    query = (
        select(Assignment, AssignmentQuestion, Question)
        .where(and_(*clauses))
        .order_by(Assignment.duedate.desc())
    )
    visible_exception = False
    if accommodation and accommodation.visible:
        visible_exception = True
    async with async_session() as session:
        res = await session.execute(query)
        for row in res:
            scoringSpec = schemas.ScoringSpecification(
                assigned=False,
                max_score=row.AssignmentQuestion.points,
                score=0,
                assignment_id=row.Assignment.id,
                which_to_grade=row.AssignmentQuestion.which_to_grade,
                how_to_score=row.AssignmentQuestion.autograde,
                is_reading=row.AssignmentQuestion.reading_assignment,
                username="",
                comment="",
                question_id=row.Question.id,
            )
            if accommodation and accommodation.duedate:
                row.Assignment.duedate += datetime.timedelta(days=accommodation.duedate)
            if datetime.datetime.now(datetime.UTC) <= row.Assignment.duedate.replace(
                tzinfo=pytz.utc
            ):
                if row.Assignment.visible:  # todo update this when we have a visible by
                    scoringSpec.assigned = True
                    return scoringSpec
            else:
                if not row.Assignment.enforce_due and not row.Assignment.released:
                    if row.Assignment.visible or visible_exception:
                        scoringSpec.assigned = True
                        return scoringSpec
        return schemas.ScoringSpecification()


async def fetch_reading_assignment_spec(
    chapter: str,
    subchapter: str,
    course_id: int,
) -> Optional[int]:
    """
    Check if a reading assignment is assigned for a given chapter and subchapter.

    :param chapter: str, the label of the chapter
    :param subchapter: str, the label of the subchapter
    :param course_id: int, the id of the course
    :return: The number of required activities or None if not found
    """
    query = (
        select(
            AssignmentQuestion.activities_required,
            AssignmentQuestion.question_id,
            AssignmentQuestion.points,
            AssignmentQuestion.assignment_id,
            Question.name,
        )
        .select_from(Assignment)
        .join(AssignmentQuestion, AssignmentQuestion.assignment_id == Assignment.id)
        .join(Question, Question.id == AssignmentQuestion.question_id)
        .where(
            and_(
                Assignment.course == course_id,
                AssignmentQuestion.reading_assignment == True,  # noqa: E712
                Question.chapter == chapter,
                Question.subchapter == subchapter,
                Assignment.visible == True,  # noqa: E712
                or_(
                    Assignment.duedate > canonical_utcnow(),
                    Assignment.enforce_due == False,  # noqa: E712
                ),
            )
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        return res.first()


async def fetch_assignment_scores(
    assignment_id: int, course_name: str, username: str
) -> List[QuestionGradeValidator]:
    """
    Fetch all scores for a given assignment.

    :param assignment_id: int, the id of the assignment
    :param course_id: int, the id of the course
    :param username: str, the username of the student
    :return: List[ScoringSpecification], a list of ScoringSpecification objects
    """
    query = select(QuestionGrade).where(
        and_(
            (QuestionGrade.sid == username),
            (QuestionGrade.div_id == Question.name),
            (Question.id == AssignmentQuestion.question_id),
            (AssignmentQuestion.assignment_id == assignment_id),
            (QuestionGrade.course_name == course_name),
        )
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [QuestionGradeValidator.from_orm(q) for q in res.scalars()]


async def did_send_messages(sid: str, div_id: str, course_name: str) -> bool:
    """
    Fetch all messages sent to a given student.

    :param sid: str, the student id
    :return: List[SentMessageValidator], a list of SentMessageValidator objects
    """
    query = select(Useinfo).where(
        and_(
            (Useinfo.sid == sid),
            (Useinfo.div_id == div_id),
            (Useinfo.course_id == course_name),
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        if len(res.all()) > 0:
            return True
        else:
            return False


async def fetch_lti_version(course_id: int) -> str:
    """
    Check if a course uses LTI 1.1, 1.3 or none

    :param course_id: int, the id of the course
    :return: str for LTI version (1.1 or 1.3) or None
    """
    query = select(CourseLtiMap).where(CourseLtiMap.course_id == course_id)
    query2 = select(Lti1p3Course).where(Lti1p3Course.rs_course_id == course_id)
    async with async_session() as session:
        res = await session.execute(query)
        if len(res.all()) > 0:
            return "1.1"

        res2 = await session.execute(query2)
        if len(res2.all()) > 0:
            return "1.3"

        return None


async def create_lti_course(course_id: int, lti_id: str) -> CourseLtiMap:
    """
    Create a new course in the LTI map.

    :param course_id: int, the id of the course
    :param lti_id: str, the LTI id of the course
    :return: CourseLtiMap, the CourseLtiMap object
    """
    new_entry = CourseLtiMap(course_id=course_id, lti_id=lti_id)
    async with async_session.begin() as session:
        session.add(new_entry)

    return new_entry


async def delete_lti_course(course_id: int) -> bool:
    """
    Delete a course from the LTI map.

    :param course_id: int, the id of the course
    """
    query = select(CourseLtiMap).where(CourseLtiMap.course_id == course_id)
    async with async_session() as session:
        res = await session.execute(query)
    if res:
        lti_key = res.scalars().first().lti_id
    else:
        return False

    d_query1 = delete(CourseLtiMap).where(CourseLtiMap.course_id == course_id)
    d_query2 = delete(LtiKey).where(LtiKey.id == lti_key)
    async with async_session.begin() as session:
        await session.execute(d_query1)
        await session.execute(d_query2)

    return True




async def create_invoice_request(
    user_id: str, course_name: str, amount: float, email: str
) -> InvoiceRequest:
    """
    Create a new invoice request.

    :param user_id: str, the id of the user
    :param course_name: str, the name of the course
    :param amount: float, the amount of the invoice
    :param email: str, the email address of the user
    :return: InvoiceRequest, the InvoiceRequest object
    """
    new_entry = InvoiceRequest(
        sid=user_id,
        course_name=course_name,
        amount=amount,
        email=email,
        timestamp=canonical_utcnow(),
        processed=False,
    )
    async with async_session.begin() as session:
        session.add(new_entry)

    return new_entry







# new function to create encrypted API tokens
async def create_api_token(
    course_id: int,
    provider: str,
    token: str,
) -> APITokenValidator:
    """
    Create a new API token for a course with encrypted storage.

    :param course_id: int, the id of the course
    :param provider: str, the provider name
    :param token: str, plaintext token to encrypt and store
    :return: APITokenValidator, the newly created token record
    """
    new_token = APIToken(course_id=course_id, provider=provider, token=token)
    async with async_session.begin() as session:
        session.add(new_token)
    return APITokenValidator.from_orm(new_token)


async def fetch_api_token(
    course_id: int,
    provider: str,
) -> Optional[APITokenValidator]:
    """
    Fetch the least recently used API token for a given course and provider.
    Updates the last_used field to the current datetime when returning a token.

    :param course_id: int, the id of the course
    :param provider: str, the provider name
    :return: Optional[APITokenValidator], the least recently used token or None if not found
    """
    query = (
        select(APIToken)
        .where((APIToken.course_id == course_id) & (APIToken.provider == provider))
        .order_by(
            APIToken.last_used.asc().nulls_first()
        )  # Least recently used first, NULL values first
        .limit(1)
    )

    async with async_session.begin() as session:
        res = await session.execute(query)
        token = res.scalars().first()
        if token:
            # Update the last_used field to current datetime
            token.last_used = canonical_utcnow()
            session.add(token)
            return APITokenValidator.from_orm(token)
        return None


# DomainApprovals
# ------------------
async def check_domain_approval(
    course_id: int, approval_type: attributes.InstrumentedAttribute
) -> bool:
    """
    Check if a domain approval exists for a given course and approval type.
    :param course_id: int, the id of the course
    :param approval_type: sqlalchemy.orm.attributes.InstrumentedAttribute, the type of approval (e.g., 'DomainApprovals.lti1p3')
    """
    query = (
        select(Courses.domain_name)
        .join(DomainApprovals, Courses.domain_name == DomainApprovals.domain_name)
        .where((approval_type == True) & (Courses.id == course_id)) # noqa: E712
    )
    async with async_session() as session:
        res = await session.execute(query)
        domain = res.scalars().first()
        return domain is not None


async def delete_course_instructor(course_id: int, instructor_id: int) -> None:
    """
    Remove an instructor from a course by deleting the CourseInstructor relationship.

    :param course_id: int, the id of the course
    :param instructor_id: int, the id of the instructor to remove
    :return: None
    """
    stmt = delete(CourseInstructor).where(
        (CourseInstructor.course == course_id)
        & (CourseInstructor.instructor == instructor_id)
    )

    async with async_session() as session:
        await session.execute(stmt)
        await session.commit()


async def create_course_instructor(course_id: int, instructor_id: int) -> None:
    """
    Add an instructor to a course by creating a new CourseInstructor relationship.

    :param course_id: int, the id of the course
    :param instructor_id: int, the id of the instructor to add
    :return: None
    """
    new_entry = CourseInstructor(course=course_id, instructor=instructor_id)
    async with async_session.begin() as session:
        session.add(new_entry)


async def update_course_settings(course_id: int, setting: str, value: str) -> None:
    """
    Update a course setting/attribute. Handles both special course table fields
    and course attributes.

    :param course_id: int, the id of the course
    :param setting: str, the setting name to update
    :param value: str, the value to set
    :return: None
    :raises ValueError: If date format is invalid for new_date setting
    """
    async with async_session() as session:
        # Handle special course table fields
        if setting in ["new_date", "allow_pairs", "downloads_enabled"]:
            if setting == "new_date":
                # Update term_start_date in courses table
                import datetime

                try:
                    new_date = datetime.datetime.strptime(value, "%Y-%m-%d").date()
                    stmt = (
                        update(Courses)
                        .where(Courses.id == course_id)
                        .values(term_start_date=new_date)
                    )
                    await session.execute(stmt)
                except ValueError:
                    raise ValueError("Invalid date format")

            elif setting == "allow_pairs":
                bool_val = value.lower() == "true"
                stmt = (
                    update(Courses)
                    .where(Courses.id == course_id)
                    .values(allow_pairs=bool_val)
                )
                await session.execute(stmt)

            elif setting == "downloads_enabled":
                bool_val = value.lower() == "true"
                stmt = (
                    update(Courses)
                    .where(Courses.id == course_id)
                    .values(downloads_enabled=bool_val)
                )
                await session.execute(stmt)
        else:
            # Handle course attributes
            # Check if attribute exists
            stmt = select(CourseAttribute).where(
                (CourseAttribute.course_id == course_id)
                & (CourseAttribute.attr == setting)
            )
            result = await session.execute(stmt)
            existing_attr = result.scalar_one_or_none()

            if existing_attr:
                # Update existing attribute
                stmt = (
                    update(CourseAttribute)
                    .where(
                        (CourseAttribute.course_id == course_id)
                        & (CourseAttribute.attr == setting)
                    )
                    .values(value=str(value))
                )
                await session.execute(stmt)
            else:
                # Create new attribute
                new_attr = CourseAttribute(
                    course_id=course_id,
                    attr=setting,
                    value=str(value),
                )
                session.add(new_attr)

        await session.commit()


# -----------------------------------------------------------------------
# Assessment Reset Functions
# -----------------------------------------------------------------------


async def fetch_timed_assessments(course_id: int) -> List[Tuple[str, str]]:
    """
    Retrieve all timed assessments for a given course.

    :param course_id: int, the course id
    :return: List[Tuple[str, str]], list of (name, description) tuples for timed assessments
    """
    query = (
        select(Assignment.name, Assignment.description)
        .where((Assignment.course == course_id) & (Assignment.is_timed == "T"))
        .order_by(Assignment.name)
    )

    async with async_session() as session:
        res = await session.execute(query)
        return [(row.name, row.description or "") for row in res.all()]


async def reset_student_assessment(
    username: str, assessment_name: str, course_name: str
) -> bool:
    """
    Reset a student's timed assessment by:
    1. Updating useinfo records to set act="start_reset"
    2. Deleting timed_exam records
    3. Deleting selected_questions records for exam questions

    :param username: str, the student's username
    :param assessment_name: str, the name of the assessment to reset
    :param course_name: str, the name of the course
    :return: bool, True if reset was successful
    """
    try:
        async with async_session.begin() as session:
            # Update useinfo records for this exam to mark as reset
            useinfo_update = (
                update(Useinfo)
                .where(
                    (Useinfo.sid == username)
                    & (Useinfo.div_id == assessment_name)
                    & (Useinfo.course_id == course_name)
                    & (Useinfo.event == "timedExam")
                )
                .values(act="start_reset")
            )
            await session.execute(useinfo_update)

            # Delete timed_exam records
            timed_exam_delete = delete(TimedExam).where(
                (TimedExam.sid == username)
                & (TimedExam.div_id == assessment_name)
                & (TimedExam.course_name == course_name)
            )
            await session.execute(timed_exam_delete)

            # Get all question names for this assessment
            assessment_questions_query = (
                select(Question.name)
                .join(AssignmentQuestion, Question.id == AssignmentQuestion.question_id)
                .join(Assignment, AssignmentQuestion.assignment_id == Assignment.id)
                .where(Assignment.name == assessment_name)
            )
            question_result = await session.execute(assessment_questions_query)
            question_names = [row.name for row in question_result.scalars().all()]

            # Delete selected_questions records for all questions in this exam
            if question_names:
                selected_questions_delete = delete(SelectedQuestion).where(
                    (SelectedQuestion.sid == username)
                    & (SelectedQuestion.selector_id.in_(question_names))
                )
                await session.execute(selected_questions_delete)

            return True

    except Exception as e:
        rslogger.error(f"Error deleting course {course_name}: {e}")
        return False




async def fetch_available_students_for_instructor_add(
    course_id: int,
) -> List[Dict[str, Any]]:
    """
    Fetch students in the course who are not already instructors.
    """
    async with async_session() as session:
        students_stmt = (
            select(AuthUser)
            .join(UserCourse, AuthUser.id == UserCourse.user_id)
            .where(UserCourse.course_id == course_id)
        )
        students = (await session.execute(students_stmt)).scalars().all()
        instructors_stmt = select(CourseInstructor.instructor).where(
            CourseInstructor.course == course_id
        )
        instructor_ids = set((await session.execute(instructors_stmt)).scalars().all())
        available_students = [
            AuthUserValidator.from_orm(s).model_dump()
            for s in students
            if s.id not in instructor_ids
        ]
        return available_students


async def fetch_current_instructors_for_course(course_id: int) -> List[Dict[str, Any]]:
    """
    Fetch all instructors for a given course.
    """
    async with async_session() as session:
        stmt = (
            select(AuthUser)
            .join(CourseInstructor, AuthUser.id == CourseInstructor.instructor)
            .where(CourseInstructor.course == course_id)
        )
        instructors = (await session.execute(stmt)).scalars().all()
        return [AuthUserValidator.from_orm(i).model_dump() for i in instructors]
