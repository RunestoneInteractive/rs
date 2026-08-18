import datetime
from typing import NamedTuple, Optional, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import HTTPException, status
from asyncpg.exceptions import UniqueViolationError
from rsptx.validation import schemas
from rsptx.validation.schemas import (
    AssignmentQuestionUpdateDict,
    CreateExercisesPayload,
)
from rsptx.data_types.which_to_grade import WhichToGradeOptions
from rsptx.data_types.autograde import AutogradeOptions, default_autograde_for
from rsptx.response_helpers.core import canonical_utcnow

import logging
from sqlalchemy import select, update, delete, and_, or_, func, asc, desc, case
from sqlalchemy.exc import IntegrityError
from .question import fetch_question_count_per_subchapter

# Models and validators
from ..models import (
    Assignment,
    AssignmentValidator,
    AssignmentQuestion,
    AssignmentQuestionValidator,
    AuthUser,
    CourseAttribute,
    CourseInstructor,
    Courses,
    DeadlineException,
    DeadlineExceptionValidator,
    Grade,
    GradeValidator,
    Library,
    Question,
    QuestionGrade,
    Useinfo,
    UserCourse,
)

from ..async_session import async_session

rslogger = logging.getLogger(__name__)


def is_assignment_visible_to_students(assignment: Assignment) -> bool:
    """
    Check if an assignment is currently visible to students based on visible, visible_on, and hidden_on fields.

    Logic:
    - If visible = False and both visible_on and hidden_on are set: scheduled period
      - Visible only between visible_on and hidden_on
    - If visible = False and only visible_on is set: will become visible at that time
      - Visible once visible_on has passed
    - If visible = False with no dates: always hidden
    - If visible = True:
      - If visible_on is set and current time < visible_on, assignment is hidden
      - If hidden_on is set and current time >= hidden_on, assignment is hidden
      - Otherwise, assignment is visible

    :param assignment: Assignment object
    :return: bool, True if assignment should be visible to students
    """
    now = canonical_utcnow()

    # Handle scheduled period (both dates set, visible=False)
    if not assignment.visible and assignment.visible_on and assignment.hidden_on:
        # Assignment is visible only during the specified period
        return assignment.visible_on <= now < assignment.hidden_on

    # If visible = False, check other conditions
    if not assignment.visible:
        # "Visible on" mode: visible_on is set, no hidden_on
        # Assignment becomes visible once visible_on passes
        if assignment.visible_on:
            return now >= assignment.visible_on
        # No dates set - always hidden
        return False

    # visible = True cases

    # Check if assignment should become visible in the future
    if assignment.visible_on and now < assignment.visible_on:
        return False

    # Check if assignment should be hidden now
    if assignment.hidden_on and now >= assignment.hidden_on:
        return False

    return True


async def fetch_deadline_exception(
    course_id: int, username: str, assignment_id: int = None, fetch_all: bool = False
) -> DeadlineExceptionValidator:
    """
    Fetch the deadline exception for a given username and assignment_id.

    :param username: str, the username of the student
    :param assignment_id: int, the id of the assignment
    :return: DeadlineExceptionValidator, the DeadlineExceptionValidator object
    """
    query = (
        select(DeadlineException)
        .where(
            and_(
                DeadlineException.course_id == course_id,
                DeadlineException.sid == username,
            )
        )
        .order_by(DeadlineException.id.desc())
    )
    time_limit = None
    deadline = None
    async with async_session() as session:
        res = await session.execute(query)
        if fetch_all:
            return [
                DeadlineExceptionValidator.from_orm(row)
                for row in res.scalars().fetchall()
            ]
        for row in res.scalars().fetchall():
            rslogger.debug(f"{row=}, {assignment_id=}")
            if assignment_id is not None:
                if row.assignment_id == assignment_id:
                    return DeadlineExceptionValidator.from_orm(row)
            else:
                if row.time_limit is not None and row.assignment_id is None:
                    time_limit = row.time_limit
                if row.duedate is not None and row.assignment_id is None:
                    deadline = row.duedate
        return DeadlineExceptionValidator(
            course_id=course_id, sid=username, time_limit=time_limit, duedate=deadline
        )


async def has_submissions_after_deadline(
    username: str, assignment_id: int, deadline: datetime.datetime
) -> bool:
    """
    Check whether a student has any logged activity (useinfo) for a question
    that belongs to the given assignment after the supplied deadline.

    Looking at the useinfo table is intentional: it captures a row for every
    save/submission and is far cheaper than querying each of the per-type
    ``*_answers`` tables individually.

    :param username: str, the student's username (matches ``useinfo.sid``)
    :param assignment_id: int, the id of the assignment to check
    :param deadline: datetime, naive UTC cutoff; activity recorded strictly
        after this time is considered late
    :return: bool, True if the student logged work after the deadline
    """
    query = (
        select(Useinfo.id)
        .select_from(AssignmentQuestion)
        .join(Question, Question.id == AssignmentQuestion.question_id)
        .join(Assignment, Assignment.id == AssignmentQuestion.assignment_id)
        .join(Courses, Courses.id == Assignment.course)
        .join(
            Useinfo,
            and_(
                Useinfo.div_id == Question.name,
                Useinfo.course_id == Courses.course_name,
            ),
        )
        .where(
            and_(
                AssignmentQuestion.assignment_id == assignment_id,
                Useinfo.sid == username,
                Useinfo.timestamp > deadline,
            )
        )
        .limit(1)
    )
    async with async_session() as session:
        res = await session.execute(query)
        return res.first() is not None


async def fetch_late_students_for_assignment(assignment_id: int) -> List[dict]:
    """
    Return the students who saved work for a given assignment after the
    (accommodation adjusted) deadline.

    This is the multi-student counterpart to ``has_submissions_after_deadline``
    for a single assignment: it answers the late-work question for every student
    in one query.  The due date is only meaningful when the instructor enforces
    it (``Assignment.enforce_due``); when it is not enforced the result is empty.
    Any per-student accommodation in ``deadline_exceptions`` extends that
    student's deadline.  Deadlines are compared in UTC, matching the default
    behavior of the grading helpers.

    :param assignment_id: int, the id of the assignment to check
    :return: List[dict], one entry per late student with ``username``,
        ``first_name`` and ``last_name``, ordered by name
    """
    query = (
        select(
            Useinfo.sid,
            AuthUser.first_name,
            AuthUser.last_name,
        )
        .select_from(Useinfo)
        .join(Courses, Courses.course_name == Useinfo.course_id)
        .join(Question, Question.name == Useinfo.div_id)
        .join(AssignmentQuestion, AssignmentQuestion.question_id == Question.id)
        .join(
            Assignment,
            and_(
                Assignment.id == AssignmentQuestion.assignment_id,
                Assignment.course == Courses.id,
            ),
        )
        .outerjoin(
            DeadlineException,
            and_(
                DeadlineException.course_id == Courses.id,
                DeadlineException.assignment_id == Assignment.id,
                DeadlineException.sid == Useinfo.sid,
            ),
        )
        .outerjoin(AuthUser, AuthUser.username == Useinfo.sid)
        .where(
            and_(
                Assignment.id == assignment_id,
                Assignment.enforce_due == True,  # noqa: E712
                Useinfo.timestamp
                > Assignment.duedate
                + func.make_interval(
                    0, 0, 0, func.coalesce(DeadlineException.duedate, 0)
                ),
            )
        )
        .distinct()
        .order_by(AuthUser.last_name, AuthUser.first_name, Useinfo.sid)
    )
    async with async_session() as session:
        res = await session.execute(query)
        return [
            {
                "username": row.sid,
                "first_name": row.first_name,
                "last_name": row.last_name,
            }
            for row in res.all()
        ]


async def fetch_student_assignment_scores(
    assignment_id: int, sid: str, course_name: str
) -> List[dict]:
    """
    Return the per-question scores one student earned on one assignment.

    This is the drill-down behind a single gradebook cell: every question in the
    assignment is listed (in the order the student sees it) whether or not it has
    been answered, with the score from ``question_grades`` when there is one.

    :param assignment_id: int, the id of the assignment
    :param sid: str, the username of the student
    :param course_name: str, the course the grades belong to
    :return: List[dict], one entry per question in assignment order
    """
    query = (
        select(
            Question.id,
            Question.name,
            Question.qnumber,
            Question.question_type,
            Question.chapter,
            Question.subchapter,
            AssignmentQuestion.points,
            AssignmentQuestion.reading_assignment,
            QuestionGrade.score,
            QuestionGrade.comment,
        )
        .select_from(AssignmentQuestion)
        .join(Question, Question.id == AssignmentQuestion.question_id)
        .outerjoin(
            QuestionGrade,
            and_(
                QuestionGrade.div_id == Question.name,
                QuestionGrade.sid == sid,
                QuestionGrade.course_name == course_name,
            ),
        )
        .where(AssignmentQuestion.assignment_id == assignment_id)
        .order_by(AssignmentQuestion.sorting_priority, AssignmentQuestion.id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        return [
            {
                "id": row.id,
                "name": row.name,
                "qnumber": row.qnumber,
                "question_type": row.question_type,
                "chapter": row.chapter,
                "subchapter": row.subchapter,
                "points": row.points,
                "reading_assignment": bool(row.reading_assignment),
                "score": float(row.score) if row.score is not None else None,
                "comment": row.comment,
            }
            for row in res.all()
        ]


async def create_deadline_exception(
    course_id: int,
    username: str,
    time_limit: float,
    deadline: int,
    visible: bool,
    assignment_id: int = None,
    allowLink: Optional[bool] = None,
) -> DeadlineExceptionValidator:
    """
    Create a new deadline exception for a given username and assignment_id.

    :param username: str, the username of the student
    :param assignment_id: int, the id of the assignment
    :return: DeadlineExceptionValidator, the DeadlineExceptionValidator object
    """
    new_entry = DeadlineException(
        course_id=course_id,
        sid=username,
        time_limit=time_limit,
        duedate=deadline,
        visible=visible,
        allowLink=allowLink,
        assignment_id=assignment_id,
    )
    async with async_session.begin() as session:
        session.add(new_entry)

    return DeadlineExceptionValidator.from_orm(new_entry)


async def fetch_all_deadline_exceptions(
    course_id: int, assignment_id: Optional[int] = None
) -> List[dict]:
    """
    Fetch all deadline exceptions for a given course_id and optional assignment_id.

    :param course_id: int, the id of the course
    :param assignment_id: Optional[int], the id of the assignment
    :return: List[dict], a list of deadline exception dictionaries
    """
    # Build base query with explicit column selection and outer join
    # outer join allows for null assignment_ids which can happen if the accommodation
    # is not tied to a specific assignment
    query = (
        select(
            DeadlineException.id,
            DeadlineException.course_id,
            DeadlineException.sid,
            DeadlineException.time_limit,
            DeadlineException.duedate,
            DeadlineException.visible,
            DeadlineException.allowLink,
            Assignment.name.label("assignment_name"),
        )
        .select_from(DeadlineException)
        .outerjoin(Assignment, Assignment.id == DeadlineException.assignment_id)
        .where(DeadlineException.course_id == course_id)
    )

    # Add assignment filter if provided
    if assignment_id is not None:
        query = query.where(DeadlineException.assignment_id == assignment_id)

    async with async_session() as session:
        result = await session.execute(query)
        return [
            {
                "course_id": row.course_id,
                "sid": row.sid,
                "time_limit": row.time_limit,
                "duedate": row.duedate,
                "visible": row.visible,
                "assignment_id": row.assignment_name,
                "row_id": row.id,
                "allowLink": row.allowLink,
            }
            for row in result.fetchall()
        ]


async def delete_deadline_exception(entry_id: int) -> None:
    """
    Delete a deadline exception by its ID.

    :param entry_id: int, the ID of the deadline exception to delete
    """
    stmt = delete(DeadlineException).where(DeadlineException.id == entry_id)
    async with async_session.begin() as session:
        await session.execute(stmt)


async def upsert_deadline_exception(
    course_id: int,
    username: str,
    time_limit: Optional[float] = None,
    deadline: Optional[int] = None,
    visible: Optional[bool] = None,
    assignment_id: Optional[int] = None,
    allowLink: Optional[bool] = None,
) -> DeadlineExceptionValidator:
    """
    Create or update a deadline exception for a (course, student, assignment) triple.

    Uniqueness is enforced on (course_id, sid, assignment_id); a NULL assignment_id
    represents an exception that applies to every assignment for the student.

    :param course_id: int, the id of the course
    :param username: str, the username of the student
    :param time_limit: Optional[float], multiplier for a timed-exam time limit
    :param deadline: Optional[int], number of days to extend the deadline
    :param visible: Optional[bool], override the assignment visibility
    :param assignment_id: Optional[int], the assignment the exception applies to
    :param allowLink: Optional[bool], allow link access even when not visible
    :return: DeadlineExceptionValidator, the persisted exception
    """
    clauses = [
        DeadlineException.course_id == course_id,
        DeadlineException.sid == username,
    ]
    if assignment_id is None:
        clauses.append(DeadlineException.assignment_id.is_(None))
    else:
        clauses.append(DeadlineException.assignment_id == assignment_id)

    async with async_session.begin() as session:
        res = await session.execute(select(DeadlineException).where(and_(*clauses)))
        existing = res.scalars().first()
        if existing is None:
            existing = DeadlineException(
                course_id=course_id,
                sid=username,
                assignment_id=assignment_id,
                time_limit=time_limit,
                duedate=deadline,
                visible=visible,
                allowLink=allowLink,
            )
            session.add(existing)
        else:
            if time_limit is not None:
                existing.time_limit = time_limit
            if deadline is not None:
                existing.duedate = deadline
            if visible is not None:
                existing.visible = visible
            if allowLink is not None:
                existing.allowLink = allowLink
        await session.flush()
        return DeadlineExceptionValidator.from_orm(existing)


async def update_deadline_exception(
    entry_id: int,
    time_limit: Optional[float] = None,
    deadline: Optional[int] = None,
    visible: Optional[bool] = None,
    allowLink: Optional[bool] = None,
) -> Optional[DeadlineExceptionValidator]:
    """
    Update an existing deadline exception identified by its primary key.

    :param entry_id: int, the id of the deadline exception row
    :return: the updated DeadlineExceptionValidator or None when not found
    """
    async with async_session.begin() as session:
        res = await session.execute(
            select(DeadlineException).where(DeadlineException.id == entry_id)
        )
        existing = res.scalars().first()
        if existing is None:
            return None
        if time_limit is not None:
            existing.time_limit = time_limit
        if deadline is not None:
            existing.duedate = deadline
        if visible is not None:
            existing.visible = visible
        if allowLink is not None:
            existing.allowLink = allowLink
        await session.flush()
        return DeadlineExceptionValidator.from_orm(existing)


async def get_repo_path(book: str) -> Optional[str]:
    """
    Get the repo_path for a book from the library table

    :param book: book name (basecourse)
    :return: repo_path or None if not found
    """
    async with async_session() as session:
        query = select(Library.repo_path).where(Library.basecourse == book)
        result = await session.execute(query)
        repo_path = result.scalar()
        return repo_path


# write a function that fetches all Assignment objects given a course name
async def fetch_assignments(
    course_name: str,
    is_peer: Optional[bool] = False,
    is_visible: Optional[bool] = False,
    fetch_all: Optional[bool] = False,
) -> List[AssignmentValidator]:
    """
    Fetch all Assignment objects for the given course name.
    If is_peer is True then only select asssigments for peer isntruction.
    If is_visible is True then only fetch visible assignments (considering visible_on and hidden_on).

    :param course_name: str, the course name
    :param is_peer: bool, whether or not the assignment is a peer assignment
    :param is_visible: bool, whether to filter by visibility (including scheduled visibility)
    :param fetch_all: bool, whether to fetch all assignments regardless of visibility/peer status
    :return: List[AssignmentValidator], a list of AssignmentValidator objects
    """
    if is_visible:
        # For students: check visible flag AND scheduled visibility
        now = canonical_utcnow()

        # Complex visibility logic:
        # 1. Scheduled period: visible=False AND both dates set AND now is between them
        # 2. "Visible on" mode: visible=False AND only visible_on set AND visible_on has passed
        # 3. Regular visible: visible=True AND (no visible_on OR visible_on passed) AND (no hidden_on OR hidden_on not reached)
        vclause = or_(
            # Case 1: Scheduled period (visible during specific timeframe)
            and_(
                Assignment.visible == False,  # noqa: E712
                Assignment.visible_on.isnot(None),
                Assignment.hidden_on.isnot(None),
                Assignment.visible_on <= now,
                Assignment.hidden_on > now,
            ),
            # Case 2: "Visible on" mode (visible once visible_on passes)
            and_(
                Assignment.visible == False,  # noqa: E712
                Assignment.visible_on.isnot(None),
                Assignment.hidden_on.is_(None),
                Assignment.visible_on <= now,
            ),
            # Case 3: Regular visible assignment
            and_(
                Assignment.visible == True,  # noqa: E712
                # visible_on check
                or_(Assignment.visible_on.is_(None), Assignment.visible_on <= now),
                # hidden_on check
                or_(Assignment.hidden_on.is_(None), Assignment.hidden_on > now),
            ),
        )
    else:
        vclause = True

    if is_peer:
        pclause = or_(
            Assignment.is_peer == True, Assignment.kind == "Peer"  # noqa: E712
        )  # noqa: E712
    else:
        pclause = or_(
            Assignment.is_peer == False,  # noqa: E712
            Assignment.is_peer.is_(None),  # noqa: E712, E711
        )

    if fetch_all:
        pclause = True
        vclause = True

    query = (
        select(Assignment)
        .where(
            and_(
                Assignment.course == Courses.id,
                Courses.course_name == course_name,
                vclause,
                pclause,
            )
        )
        .order_by(Assignment.duedate.desc())
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [AssignmentValidator.from_orm(a) for a in res.scalars()]


# write a function that fetches all Assignment objects given a course name
async def fetch_one_assignment(assignment_id: int) -> AssignmentValidator:
    """
    Fetch one Assignment object with calculated total points for related exercises.

    :param assignment_id: int, the assignment id

    :return: AssignmentValidator
    """
    async with async_session() as session:
        assignment_query = select(Assignment).where(Assignment.id == assignment_id)
        assignment_result = await session.execute(assignment_query)
        assignment = assignment_result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignment with id {assignment_id} not found",
            )

        exercises_query = select(AssignmentQuestion).where(
            AssignmentQuestion.assignment_id == assignment_id
        )
        exercises_result = await session.execute(exercises_query)
        exercises = exercises_result.scalars().all()

        total_points = sum(exercise.points for exercise in exercises)

        assignment.points = total_points
        session.add(assignment)
        await session.commit()

        return AssignmentValidator.from_orm(assignment)


async def fetch_assignment_by_name(
    name: str, course_id: int
) -> Optional[AssignmentValidator]:
    """
    Fetch one Assignment (with calculated total points) by its name within a
    course. Returns ``None`` when no such assignment exists.

    :param name: str, the assignment name
    :param course_id: int, the course the assignment belongs to
    :return: Optional[AssignmentValidator]
    """
    async with async_session() as session:
        query = select(Assignment.id).where(
            (Assignment.name == name) & (Assignment.course == course_id)
        )
        result = await session.execute(query)
        assignment_id = result.scalar_one_or_none()

    if assignment_id is None:
        return None
    return await fetch_one_assignment(assignment_id)


async def create_assignment(assignment: AssignmentValidator) -> AssignmentValidator:
    """
    Create a new Assignment object with the given data (assignment)

    :param assignment: AssignmentValidator, the AssignmentValidator object representing the assignment data
    :return: AssignmentValidator, the newly created AssignmentValidator object
    """
    new_assignment = Assignment(**assignment.dict())
    async with async_session.begin() as session:
        session.add(new_assignment)

    return AssignmentValidator.from_orm(new_assignment)


async def update_assignment(assignment: AssignmentValidator, pi_update=False) -> None:
    """
    Update an Assignment object with the given data (assignment)
    """
    assignment_updates = assignment.dict()
    if not pi_update:
        assignment_updates["current_index"] = 0

    # Always update the updated_date to track last modification
    assignment_updates["updated_date"] = canonical_utcnow()

    del assignment_updates["id"]

    stmt = (
        update(Assignment)
        .where(Assignment.id == assignment.id)
        .values(assignment_updates)
    )
    async with async_session.begin() as session:
        await session.execute(stmt)


async def update_assignment_released(assignment_id: int, released: bool) -> None:
    """
    Set only the ``released`` flag on an Assignment, controlling whether students
    can see their grades. Additive, focused update: it touches ``released`` and
    ``updated_date`` only and never alters ``current_index`` or other fields.
    """
    stmt = (
        update(Assignment)
        .where(Assignment.id == assignment_id)
        .values(released=released, updated_date=canonical_utcnow())
    )
    async with async_session.begin() as session:
        await session.execute(stmt)


async def update_assignment_threshold(
    assignment_id: int, threshold_pct: Optional[float]
) -> None:
    """
    Set only the ``threshold_pct`` field on an Assignment, controlling threshold
    scoring during the recompute roll-up. Additive, focused update: it touches
    ``threshold_pct`` and ``updated_date`` only and never alters
    ``current_index`` or other fields. A null or zero threshold disables
    threshold scoring (recompute then uses the raw per-question sum).
    """
    stmt = (
        update(Assignment)
        .where(Assignment.id == assignment_id)
        .values(threshold_pct=threshold_pct, updated_date=canonical_utcnow())
    )
    async with async_session.begin() as session:
        await session.execute(stmt)


async def create_assignment_question(
    assignmentQuestion: AssignmentQuestionValidator,
) -> AssignmentQuestionValidator:
    """
    Create a new AssignmentQuestion object with the given data (assignmentQuestion)

    :param assignmentQuestion: AssignmentQuestionValidator, the AssignmentQuestionValidator object representing the assignment question data
    :return: AssignmentQuestionValidator, the newly created AssignmentQuestionValidator object
    """
    new_assignment_question = AssignmentQuestion(**assignmentQuestion.dict())
    async with async_session.begin() as session:
        session.add(new_assignment_question)

    return AssignmentQuestionValidator.from_orm(new_assignment_question)


async def update_multiple_assignment_questions(
    exercises: List[AssignmentQuestionUpdateDict],
) -> list[AssignmentQuestionValidator]:
    """
    Update multiple AssignmentQuestion objects with the given data (exercises).
    Also updates the Question table for fields like question_json, htmlsrc, chapter, subchapter,
    author, autograde, topic, feedback, name, difficulty, and tags if the user is the owner.

    :param exercises: List of dictionaries with fields from both AssignmentQuestionValidator and QuestionValidator
    :return: List of updated AssignmentQuestionValidator objects
    """

    def is_valid_option(option, question_type, options_enum):
        """
        Check if the given option is valid for the specified question type.

        :param option: Option to validate (e.g., which_to_grade or autograde).
        :param question_type: QuestionType of the exercise.
        :param options_enum: Enum class (e.g., WhichToGradeOptions or AutogradeOptions).
        :return: True if valid, False otherwise.
        """
        for enum_option in options_enum:
            if enum_option.value[0] == option:
                supported_types = [qt.value_only() for qt in enum_option.value[2]]
                return question_type in supported_types
        return False

    async with async_session.begin() as session:
        updated_questions = []

        # Preload all necessary data to minimize database queries
        exercise_ids = [exercise.get("id") for exercise in exercises]
        question_ids = [exercise.get("question_id") for exercise in exercises]

        existing_questions_query = select(AssignmentQuestion).where(
            AssignmentQuestion.id.in_(exercise_ids)
        )
        existing_questions_result = await session.execute(existing_questions_query)
        existing_questions = {q.id: q for q in existing_questions_result.scalars()}

        questions_query = select(Question).where(Question.id.in_(question_ids))
        questions_result = await session.execute(questions_query)
        questions = {q.id: q for q in questions_result.scalars()}

        for exercise in exercises:
            existing_question = existing_questions.get(exercise.get("id"))

            if not existing_question:
                continue

            question = questions.get(exercise.get("question_id"))

            if not question:
                continue

            question_type = (
                question.question_type
            )  # Access question_type from the related question

            exercise_dict = exercise.copy()

            # Validate and update which_to_grade
            if not is_valid_option(
                exercise_dict.get("which_to_grade"), question_type, WhichToGradeOptions
            ):
                exercise_dict["which_to_grade"] = existing_question.which_to_grade

            # Validate and update autograde
            if not is_valid_option(
                exercise_dict.get("autograde"), question_type, AutogradeOptions
            ):
                exercise_dict["autograde"] = existing_question.autograde

            # Extract AssignmentQuestion fields and exclude Question fields
            aq_fields = {
                k: v
                for k, v in exercise_dict.items()
                if k in AssignmentQuestionValidator.__annotations__
            }

            # Update the existing question with validated data
            for field, value in aq_fields.items():
                setattr(existing_question, field, value)

            # Add the updated question to the session
            session.add(existing_question)

            # Update the Question table if the user is the owner
            if exercise.get("owner") == question.owner:
                question_updates = {}

                # List of fields to check and update in the Question table
                editable_fields = [
                    "question_json",
                    "htmlsrc",
                    "chapter",
                    "subchapter",
                    "author",
                    "topic",
                    "name",
                    "difficulty",
                    "tags",
                    "activities_required",
                    "is_private",
                ]

                # Check if any of the editable fields have changed
                for field in editable_fields:
                    if (
                        field in exercise_dict
                        and exercise_dict[field] is not None
                        and exercise_dict[field] != getattr(question, field, None)
                    ):
                        question_updates[field] = exercise_dict[field]

                # If there are updates to apply to the Question table
                if question_updates:
                    # Update the Question record
                    for field, value in question_updates.items():
                        setattr(question, field, value)

                    # Add the updated question to the session
                    session.add(question)

            updated_questions.append(
                AssignmentQuestionValidator.from_orm(existing_question)
            )

        await session.commit()

    return updated_questions


async def update_assignment_question(
    assignmentQuestion: AssignmentQuestionValidator,
) -> AssignmentQuestionValidator:
    """
    Update an AssignmentQuestion object with the given data (assignmentQuestion)
    """
    new_assignment_question = AssignmentQuestion(**assignmentQuestion.dict())
    async with async_session.begin() as session:
        await session.merge(new_assignment_question)

    return AssignmentQuestionValidator.from_orm(new_assignment_question)


async def update_assignment_exercises(
    payload: schemas.UpdateAssignmentExercisesPayload,
):
    async with async_session() as session:
        # Step 1: Get the current assignment data
        assignment_query = select(Assignment).where(
            Assignment.id == payload.assignmentId
        )
        assignment_result = await session.execute(assignment_query)
        assignment = assignment_result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignment with id {payload.assignmentId} not found",
            )

        # Step 2: Get the maximum sorting_priority considering isReading
        query_max_priority = select(
            func.max(AssignmentQuestion.sorting_priority)
        ).where(
            AssignmentQuestion.assignment_id == payload.assignmentId,
            AssignmentQuestion.reading_assignment == payload.isReading,
        )
        max_priority_result = await session.execute(query_max_priority)
        max_sort_priority = (
            max_priority_result.scalar() or 0
        )  # If there are no records, start from 0

        points_to_add = 0
        points_to_remove = 0
        new_questions = []

        # Step 3: Create new records in AssignmentQuestion for idsToAdd (if any)
        if payload.idsToAdd:
            for i, question_id in enumerate(payload.idsToAdd, start=1):
                # Assume we have a way to get the points for the question
                question_info_query = select(
                    Question.difficulty,
                    Question.chapter,
                    Question.subchapter,
                    Question.base_course,
                    Question.question_type,
                ).where(Question.id == question_id)
                question_info_result = await session.execute(question_info_query)
                question_info = question_info_result.first()

                difficulty, chapter, subchapter, base_course, question_type = (
                    question_info
                )
                question_points = difficulty or 1

                default_activities_required = None
                if payload.isReading:
                    counts = await fetch_question_count_per_subchapter(base_course)
                    activity_count = counts.get(chapter, {}).get(subchapter, 0)
                    default_activities_required = max(int(activity_count * 0.8), 1)

                new_question = AssignmentQuestion(
                    assignment_id=payload.assignmentId,
                    question_id=question_id,
                    points=question_points,  # Use the points from the question
                    timed=None,  # Leave as null
                    autograde=default_autograde_for(question_type, payload.isReading),
                    which_to_grade="best_answer",
                    reading_assignment=payload.isReading,
                    sorting_priority=max_sort_priority
                    + i,  # Increment from max_sort_priority
                    activities_required=default_activities_required,
                )
                new_questions.append(new_question)
                points_to_add += question_points  # Increase by the number of points

            # Add new records to the session
            session.add_all(new_questions)

        # Step 4: Remove records for idsToRemove (if any)
        if payload.idsToRemove:
            query_remove = select(AssignmentQuestion).where(
                AssignmentQuestion.assignment_id == payload.assignmentId,
                AssignmentQuestion.id.in_(payload.idsToRemove),
            )
            remove_result = await session.execute(query_remove)
            questions_to_remove = remove_result.scalars().all()

            # Calculate the total points for the questions to be removed
            for question in questions_to_remove:
                points_to_remove += question.points

            # Remove records
            query_delete = delete(AssignmentQuestion).where(
                AssignmentQuestion.assignment_id == payload.assignmentId,
                AssignmentQuestion.id.in_(payload.idsToRemove),
            )
            await session.execute(query_delete)

        # Step 5: Update points in Assignment
        assignment.points += points_to_add - points_to_remove
        # Update the updated_date to track when exercises were modified
        assignment.updated_date = canonical_utcnow()
        session.add(assignment)

        # Step 6: Apply changes
        await session.commit()

        # Log the result
        rslogger.debug(f"Added questions: {new_questions}")
        rslogger.debug(f"Removed questions: {points_to_remove}")
        return {
            "added": len(payload.idsToAdd) if payload.idsToAdd else 0,
            "removed": len(payload.idsToRemove) if payload.idsToRemove else 0,
            "total_points": assignment.points,
        }


async def add_assignment_question(
    data: CreateExercisesPayload, question: Question
) -> None:
    async with async_session() as session:
        assignment_result = await session.execute(
            select(Assignment).where(Assignment.id == data.assignment_id)
        )
        assignment = assignment_result.scalar_one_or_none()

        if not assignment:
            raise Exception(
                f"The assignment with id {data.assignment_id} is not found."
            )

        # Get the maximum sorting_priority considering isReading
        query_max_priority = select(
            func.max(AssignmentQuestion.sorting_priority)
        ).where(
            AssignmentQuestion.assignment_id == data.assignment_id,
            AssignmentQuestion.reading_assignment == data.is_reading,
        )
        max_priority_result = await session.execute(query_max_priority)
        max_sort_priority = (
            max_priority_result.scalar() or 0
        )  # If there are no records, start from 0

        session.add(
            AssignmentQuestion(
                assignment_id=data.assignment_id,
                question_id=question.id,
                points=data.points,  # Use the points from the question
                timed=None,  # Leave as null
                autograde=default_autograde_for(
                    question.question_type, data.is_reading
                ),
                which_to_grade="best_answer",
                reading_assignment=data.is_reading,
                sorting_priority=max_sort_priority,
                activities_required=None,
            )
        )
        assignment.points += data.points
        # Update the updated_date to track when question was added
        assignment.updated_date = canonical_utcnow()

        await session.commit()


async def reorder_assignment_questions(question_ids: List[int]):
    """
    Reorder the assignment questions with the given question ids (question_ids)
    """
    async with async_session.begin() as session:
        for i, qid in enumerate(question_ids):
            d = dict(sorting_priority=i)
            stmt = (
                update(AssignmentQuestion)
                .where(AssignmentQuestion.id == qid)
                .values(**d)
            )
            await session.execute(stmt)


async def remove_assignment_questions(assignment_ids: List[int]):
    """
    Remove all assignment questions for the given assignment ids (assignment_ids)
    """
    stmt = delete(AssignmentQuestion).where(AssignmentQuestion.id.in_(assignment_ids))
    async with async_session.begin() as session:
        await session.execute(stmt)


async def fetch_problem_data(assignment_id: int, course_name: str) -> list:
    """
    Fetch problem data for a given assignment.

    :param assignment_id: int, the id of the assignment
    :return: list, a list of tuples containing timestamp, name, sid, event, and act
    """
    query = (
        select(
            Useinfo.timestamp.label("ts"),
            Question.name,
            Useinfo.sid,
            Useinfo.event,
            Useinfo.act,
        )
        .join(AssignmentQuestion, AssignmentQuestion.question_id == Question.id)
        .join(Useinfo, Question.name == Useinfo.div_id)
        .where(
            and_(AssignmentQuestion.assignment_id == assignment_id),
            (Useinfo.course_id == course_name),
        )
        .order_by(Useinfo.sid, Useinfo.timestamp)
    )

    async with async_session() as session:
        result = await session.execute(query)
        return result.all()


async def fetch_reading_assignment_data(assignment_id: int, sid: str) -> list:
    """
    Fetch reading assignment data for a given assignment and student id.

    :param assignment_id: int, the id of the assignment
    :param sid: str, the student id
    :return: list[AssignmentQuestionValidator], a list of AssignmentQuestionValidator objects
    """

    pass


async def fetch_all_assignment_stats(
    course_name: str, userid: int
) -> list[GradeValidator]:
    """
    Fetch the Grade information for all assignments for a given student in a given course.

    :param course_name: The name of the current course
    :type course_name: str
    :param userid: the users numeric id
    :type userid: int
    :return list[AssignmentValidator]: a list of AssignmentValidator objects
    """
    query = select(Grade).where(
        and_(
            Assignment.course == Courses.id,
            Courses.course_name == course_name,
            Grade.assignment == Assignment.id,
            Grade.auth_user == userid,
        )
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [GradeValidator.from_orm(a) for a in res.scalars()]


async def fetch_all_grades_for_assignment(
    assignment_id: int,
) -> list[GradeValidator]:
    """
    Fetch all grades for the given assignment id (assignment_id)

    :param assignment_id: int, the id of the assignment
    :return: List[GradeValidator], a list of GradeValidator objects
    """
    query = select(Grade).where(Grade.assignment == assignment_id)

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [GradeValidator.from_orm(a) for a in res.scalars()]


async def fetch_gradebook(course_name: str) -> dict:
    """
    Build the gradebook matrix for a course: every assignment, every enrolled
    student (instructors excluded), and the per-(student, assignment) total score
    from the ``grades`` table, plus the class average per assignment.

    Additive read-only aggregation used only by the Assignment Builder grader. It
    does not modify any shared fetch_* function.

    :param course_name: str, the course name
    :return: dict with ``assignments``, ``students``, ``cells`` and ``averages``
    """
    from .course import fetch_course

    course = await fetch_course(course_name)

    async with async_session() as session:
        assignment_rows = (
            (
                await session.execute(
                    select(Assignment)
                    .where(Assignment.course == course.id)
                    .order_by(Assignment.duedate, Assignment.id)
                )
            )
            .scalars()
            .all()
        )
        assignment_ids = [a.id for a in assignment_rows]

        points_map: dict = {}
        if assignment_ids:
            points_result = await session.execute(
                select(
                    AssignmentQuestion.assignment_id,
                    func.sum(AssignmentQuestion.points),
                )
                .where(AssignmentQuestion.assignment_id.in_(assignment_ids))
                .group_by(AssignmentQuestion.assignment_id)
            )
            for aid, total in points_result.all():
                points_map[aid] = int(total or 0)

        instructor_ids = set(
            (
                await session.execute(
                    select(CourseInstructor.instructor).where(
                        CourseInstructor.course == course.id
                    )
                )
            )
            .scalars()
            .all()
        )

        student_rows = (
            (
                await session.execute(
                    select(AuthUser)
                    .join(UserCourse, UserCourse.user_id == AuthUser.id)
                    .where(UserCourse.course_id == course.id)
                    .order_by(
                        AuthUser.last_name, AuthUser.first_name, AuthUser.username
                    )
                )
            )
            .scalars()
            .all()
        )
        students = [s for s in student_rows if s.id not in instructor_ids]
        id_to_sid = {s.id: s.username for s in students}

        grade_rows = []
        if assignment_ids:
            grade_rows = (
                await session.execute(
                    select(
                        Grade.auth_user,
                        Grade.assignment,
                        Grade.score,
                        Grade.manual_total,
                    ).where(Grade.assignment.in_(assignment_ids))
                )
            ).all()

    released_map = {a.id: bool(a.released) for a in assignment_rows}
    assignments = [
        {
            "id": a.id,
            "name": a.name,
            "points": points_map.get(a.id, 0),
            "duedate": a.duedate.isoformat() if a.duedate else None,
            "released": bool(a.released),
        }
        for a in assignment_rows
    ]
    student_list = [
        {
            "sid": s.username,
            "name": f"{s.first_name} {s.last_name}".strip() or s.username,
        }
        for s in students
    ]

    cells = []
    sums: dict = {}
    for auth_user, assignment_id, score, manual_total in grade_rows:
        sid = id_to_sid.get(auth_user)
        if sid is None:
            continue
        cells.append(
            {
                "sid": sid,
                "assignment_id": assignment_id,
                "score": score,
                "released": released_map.get(assignment_id, False),
                "manual_total": bool(manual_total),
            }
        )
        if score is not None:
            bucket = sums.setdefault(assignment_id, [0.0, 0])
            bucket[0] += score
            bucket[1] += 1

    averages = {
        str(a.id): (
            round(sums[a.id][0] / sums[a.id][1], 2)
            if a.id in sums and sums[a.id][1]
            else None
        )
        for a in assignment_rows
    }

    return {
        "assignments": assignments,
        "students": student_list,
        "cells": cells,
        "averages": averages,
    }


async def fetch_grade(userid: int, assignmentid: int) -> Optional[GradeValidator]:
    """
    Fetch the Grade object for the given user and assignment.

    :param userid: int, the user id
    :param assignmentid: int, the assignment id
    :return: Optional[GradeValidator], the GradeValidator object
    """
    query = select(Grade).where(
        and_(
            Grade.auth_user == userid,
            Grade.assignment == assignmentid,
        )
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return GradeValidator.from_orm(res.scalars().first())


# write a function that given a GradeValidator object inserts a new Grade object into the database
# or updates an existing one
#
# This function should return the GradeValidator object that was inserted or updated
async def upsert_grade(grade: GradeValidator) -> GradeValidator:
    """
    Insert a new Grade object into the database or update an existing one.

    :param grade: GradeValidator, the GradeValidator object
    :return: GradeValidator, the GradeValidator object
    """
    new_grade = Grade(**grade.dict())
    success = True
    try:
        async with async_session.begin() as session:
            # merge either inserts or updates the object
            await session.merge(new_grade)
    except (IntegrityError, UniqueViolationError) as e:
        rslogger.error(f"IntegrityError: {e} id = {new_grade.id}")
        success = False
    if success:
        return GradeValidator.from_orm(new_grade)
    else:
        return await fetch_grade(grade.auth_user, grade.assignment)


async def set_manual_total(
    userid: int,
    assignmentid: int,
    course_name: str,
    score: float,
    manual: bool = True,
) -> GradeValidator:
    """Set the grades row total for a student and flag whether it was set
    manually. When manual is True, recompute_totals_for preserves this score
    instead of overwriting it from the per-question grades; when False the row
    becomes eligible for recomputation again.

    :param userid: int, the auth_user id
    :param assignmentid: int, the assignment id
    :param course_name: str, the course name (used only when inserting a new row)
    :param score: float, the total score to store
    :param manual: bool, the value for the manual_total flag
    :return: GradeValidator, the upserted grade
    """
    grade = await fetch_grade(userid, assignmentid)
    if grade:
        grade.score = score
        grade.manual_total = manual
        return await upsert_grade(grade)
    new_grade = GradeValidator(
        auth_user=userid,
        course_name=course_name,
        assignment=assignmentid,
        score=score,
        manual_total=manual,
    )
    return await upsert_grade(new_grade)


async def delete_assignment(assignment_id: int) -> None:
    try:
        async with async_session.begin() as session:
            assignment = await session.get(Assignment, assignment_id)
            if assignment:
                await session.delete(assignment)
    except Exception as e:
        rslogger.error(f"Unable to remove assignment {assignment_id}. {e}")
        raise e


async def duplicate_assignment(
    original_assignment_id: int, course_id: int, existing_assignment_names: set
) -> tuple[AssignmentValidator, str]:
    """
    Duplicate an assignment with all its exercises and readings.

    :param original_assignment_id: int, the ID of the assignment to duplicate
    :param course_id: int, the ID of the course
    :param existing_assignment_names: set, set of existing assignment names to avoid duplicates
    :return: tuple[AssignmentValidator, str], the new assignment and its name
    """
    from .question import fetch_assignment_questions

    async with async_session.begin() as session:
        # Fetch the original assignment
        original_assignment_result = await session.execute(
            select(Assignment).where(Assignment.id == original_assignment_id)
        )
        original_assignment = original_assignment_result.scalar_one_or_none()

        if not original_assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignment {original_assignment_id} not found",
            )

        # Generate unique copy name
        base_name_match = original_assignment.name
        if " (Copy" in base_name_match:
            base_name = base_name_match.split(" (Copy")[0]
        else:
            base_name = base_name_match

        copy_number = 1
        new_name = f"{base_name} (Copy)"
        while new_name in existing_assignment_names:
            copy_number += 1
            new_name = f"{base_name} (Copy {copy_number})"

        # Create the new assignment with copied data
        new_assignment_data = AssignmentValidator(
            name=new_name,
            description=original_assignment.description,
            duedate=original_assignment.duedate,
            updated_date=canonical_utcnow(),
            points=original_assignment.points,
            kind=original_assignment.kind,
            time_limit=original_assignment.time_limit,
            nofeedback=original_assignment.nofeedback,
            nopause=original_assignment.nopause,
            peer_async_visible=original_assignment.peer_async_visible,
            course=course_id,
            visible=False,  # Start as hidden
            released=original_assignment.released,
            from_source=False,
            current_index=0,
            enforce_due=original_assignment.enforce_due,
            is_timed=original_assignment.is_timed,
            is_peer=original_assignment.is_peer,
        )

        # Create the new assignment
        new_assignment = Assignment(**new_assignment_data.dict())
        session.add(new_assignment)
        await session.flush()  # Get the ID without committing

        # Copy assignment questions
        assignment_questions = await fetch_assignment_questions(original_assignment_id)

        for question_data in assignment_questions:
            assignment_question = question_data.AssignmentQuestion

            new_assignment_question = AssignmentQuestion(
                assignment_id=new_assignment.id,
                question_id=assignment_question.question_id,
                points=assignment_question.points,
                timed=assignment_question.timed,
                autograde=assignment_question.autograde,
                which_to_grade=assignment_question.which_to_grade,
                reading_assignment=assignment_question.reading_assignment,
                sorting_priority=assignment_question.sorting_priority,
                activities_required=assignment_question.activities_required,
            )

            session.add(new_assignment_question)

        await session.commit()

        rslogger.debug(
            f"Successfully duplicated assignment {original_assignment_id} as {new_assignment.id}"
        )

        return AssignmentValidator.from_orm(new_assignment), new_name


def term_start_utc(
    term_start_date: datetime.date, timezone: Optional[str]
) -> datetime.datetime:
    """Midnight local time on the first day of term, expressed as naive UTC.

    ``term_start_date`` is a bare date, so on its own it has no timezone. Due
    dates are stored as naive UTC, so the term start has to be anchored in the
    course timezone before the two can be subtracted -- otherwise the offset
    from the start of term is wrong by the course's UTC offset. A course with
    no timezone is treated as UTC, matching the ``duedate`` migration.
    """
    midnight = datetime.datetime.combine(term_start_date, datetime.time())
    tz = ZoneInfo(timezone) if timezone else datetime.timezone.utc
    return (
        midnight.replace(tzinfo=tz)
        .astimezone(datetime.timezone.utc)
        .replace(tzinfo=None)
    )


def shift_duedate_between_courses(
    duedate: datetime.datetime, source_course, target_course
) -> tuple[datetime.datetime, Optional[str]]:
    """Re-date ``duedate`` so it keeps its offset from the start of term.

    Both term starts are anchored in their own course timezone, so the offset
    is preserved as local wall clock time even when the two terms fall on
    opposite sides of a DST change. If either course is missing a term start
    there is nothing to shift against, so the original date is kept.

    A course timezone that is no longer a recognized zoneinfo key (a user can
    pick one that later gets removed from the tz database) would otherwise
    take the whole import down with it. That is worse than an unshifted due
    date, so the shift is skipped and a warning string is returned instead of
    raising -- the caller still gets an assignment, just not a re-dated one.
    """
    if not (source_course.term_start_date and target_course.term_start_date):
        return duedate, None

    try:
        due_delta = duedate - term_start_utc(
            source_course.term_start_date, source_course.timezone
        )
        shifted = (
            term_start_utc(target_course.term_start_date, target_course.timezone)
            + due_delta
        )
    except (ZoneInfoNotFoundError, ValueError) as e:
        rslogger.warning(
            f"Could not shift due date from {source_course.course_name!r} to "
            f"{target_course.course_name!r}, one of their timezones is invalid "
            f"({source_course.timezone!r} -> {target_course.timezone!r}): {e}"
        )
        return duedate, (
            "The due date could not be adjusted because a course timezone "
            "setting is invalid. Update the timezone in Course Settings, then "
            "check this assignment's due date."
        )

    return shifted, None


def _normalize_assignment_kind(kind: str, is_timed: bool, is_peer: bool):
    """Reconcile the ``is_timed``/``is_peer`` flags with ``kind``.

    Older assignments predate ``kind`` and can carry flag combinations it
    disallows. Copying one forward is a good moment to make the two agree,
    rather than propagating the inconsistency into a new course.
    """
    if kind == "Regular":
        return False, False
    if kind == "Timed":
        return True, False
    if kind == "Peer":
        return False, True
    return is_timed, is_peer


def unique_assignment_name(base_name: str, existing_names) -> str:
    """Pick a name for a copied assignment that is free within the course.

    The ``(name, course)`` index on ``assignments`` is unique, so a copy landing
    in a course that already has that name has to be renamed. Matches the
    ``X (Copy)`` / ``X (Copy 2)`` scheme ``duplicate_assignment`` uses.
    """
    if base_name not in existing_names:
        return base_name

    stem = base_name.split(" (Copy")[0] if " (Copy" in base_name else base_name
    candidate = f"{stem} (Copy)"
    counter = 1
    while candidate in existing_names:
        counter += 1
        candidate = f"{stem} (Copy {counter})"
    return candidate


def _is_book_bound(assignment_question, question) -> bool:
    """True when a row only makes sense inside the book it came from.

    A reading is an instruction to read a subchapter, and it is graded by
    counting activity in that subchapter of the course's own book -- neither of
    which survives the trip to a different book. Exercises carry their own
    content and travel freely. ``question_type == "page"`` is checked alongside
    the flag because a page question is a reading whether or not the flag on
    the row happens to say so.
    """
    return (
        bool(assignment_question.reading_assignment) or question.question_type == "page"
    )


class ImportedAssignment(NamedTuple):
    """What :func:`import_assignment` produced.

    ``skipped_readings`` is how many rows were left behind by the cross-book
    rule above, so the caller can say so rather than letting the instructor
    discover the gap themselves. ``duedate_warning`` is set when the due date
    could not be shifted to the target course's term because a course
    timezone is invalid -- the assignment still imports, with its original
    due date.
    """

    assignment: AssignmentValidator
    name: str
    skipped_readings: int
    duedate_warning: Optional[str] = None


def _searchable_column(field: str, joined_columns: dict):
    """Resolve a client-supplied field name to a column, or None.

    Checked against the table's columns rather than ``hasattr``: a declarative
    class also answers to ``metadata``, ``registry`` and the ``questions``
    relationship, none of which can be filtered or sorted on.
    """
    if field in joined_columns:
        return joined_columns[field]
    if field in Assignment.__table__.columns:
        return getattr(Assignment, field)
    return None


# How much of a course's sharing blurb to carry in a page of search results.
SHARING_DESCRIPTION_PREVIEW_CHARS = 1000


# An assignment the book itself ships: it lives on the base course row, which is
# the course whose ``base_course`` points at its own name.
#
# Two things follow from that. It needs no sharing flag -- a book has always been
# copyable by anyone, which is what ``_fetch_source_for_import`` already allows,
# and requiring an opt-in would hide every official assignment until some author
# went looking for a toggle that has no UI. And ``from_source`` rows are excluded:
# those are generated from the book's own markup on every build, so a copy starts
# drifting from the book the moment the book changes.
_IS_OFFICIAL = (Courses.course_name == Courses.base_course) & (
    Assignment.from_source == False  # noqa: E712
)


def _is_official(assignment, course) -> bool:
    """The Python-side reading of :data:`_IS_OFFICIAL`, for a fetched row."""
    return course.course_name == course.base_course and not assignment.from_source


# The course attribute an instructor sets on the Course Settings page to offer
# their assignments to other courses.
COURSE_SHARING_ATTR = "share_assignments"


# Sharing is a decision about a course, not about each assignment in it. It used
# to live on ``Assignment.is_private``, one switch per row in the assignment
# list, which put a column in front of every instructor to answer a question
# most of them never think about -- and which did nothing at all on a base
# course, whose assignments are public regardless.
#
# ``is_private`` still exists and is still set on an imported copy, so importing
# something never signs the importer up for sharing it onward. It just no longer
# decides who can see what.
_COURSE_SHARES_ASSIGNMENTS = (
    select(CourseAttribute.id)
    .where(
        (CourseAttribute.course_id == Courses.id)
        & (CourseAttribute.attr == COURSE_SHARING_ATTR)
        & (func.lower(CourseAttribute.value) == "true")
    )
    .exists()
)


async def course_shares_assignments(course_id: int) -> bool:
    """Has this course opted in to offering its assignments to other courses?

    The row-at-a-time counterpart to :data:`_COURSE_SHARES_ASSIGNMENTS`, for the
    authorization check on a single assignment.
    """
    async with async_session() as session:
        value = (
            await session.execute(
                select(CourseAttribute.value).where(
                    (CourseAttribute.course_id == course_id)
                    & (CourseAttribute.attr == COURSE_SHARING_ATTR)
                )
            )
        ).scalar()
    return (value or "").lower() == "true"


def _visibility(my_course_ids: List[int]):
    """Which assignments this instructor may see in the import browser.

    Three ways in, and they are the same three the import endpoint enforces:
    the owning course offers its assignments, the assignment belongs to a book,
    or the caller already instructs the course it lives in.
    """
    visibility = or_(_COURSE_SHARES_ASSIGNMENTS, _IS_OFFICIAL)
    if my_course_ids:
        visibility = or_(visibility, Courses.id.in_(my_course_ids))
    return visibility


async def _existing_imports(
    session, source_assignment_ids: List[int], target_course_id: Optional[int]
) -> dict:
    """Map source assignment id -> name of the copy already in ``target_course``.

    Answers "have I imported this before" for a page of search results in one
    query. Keyed off ``imported_from_assignment_id`` rather than the name or the
    linked question set, both of which stop matching the moment the instructor
    edits their copy -- which is the normal thing to do after importing.
    """
    if not source_assignment_ids or target_course_id is None:
        return {}

    rows = await session.execute(
        select(Assignment.imported_from_assignment_id, Assignment.name)
        .where(
            (Assignment.course == target_course_id)
            & (Assignment.imported_from_assignment_id.in_(source_assignment_ids))
        )
        .order_by(Assignment.id)
    )

    # Oldest copy wins when a source was imported more than once: it is the one
    # the instructor has had longest and the one they are likeliest to know by
    # name. Later copies are still covered -- the flag is per source, not per
    # copy -- so nothing goes unmarked.
    existing = {}
    for source_id, name in rows.all():
        existing.setdefault(source_id, name)
    return existing


async def search_assignments(
    criteria: schemas.AssignmentsSearchRequest,
    user_id: int,
    exclude_course_id: Optional[int] = None,
    target_course_id: Optional[int] = None,
    prefer_base_course: Optional[str] = None,
) -> dict:
    """Find assignments an instructor is allowed to see, for the import browser.

    An assignment is visible when its owning course offers its assignments, when
    it belongs to a book, or when the requester already instructs the course that
    owns it. That last case mirrors ``search_exercises``: your own material never
    disappears from your own search results.

    :param criteria: search parameters (filters, sorting, pagination)
    :param user_id: id of the requesting instructor
    :param exclude_course_id: course to leave out, normally the requester's own
    :param target_course_id: course the results would be imported into; each row
        is marked with whether it is already there. Normally the same course as
        ``exclude_course_id``, but kept separate so neither implies the other.
    :param prefer_base_course: sort this book's own assignments first, normally
        the caller's book
    :return: dict with ``assignments`` and ``pagination`` keys
    """
    from .course import fetch_instructor_courses

    my_course_ids = [ci.course for ci in await fetch_instructor_courses(user_id)]

    visibility = _visibility(my_course_ids)

    query = (
        select(Assignment, Courses, Library)
        .join(Courses, Assignment.course == Courses.id)
        .outerjoin(Library, Courses.base_course == Library.basecourse)
        .where(visibility)
    )

    # Never browsable, wherever they live. The book build regenerates a
    # ``from_source`` assignment from the book's own markup every time it runs,
    # so a copy is a snapshot that starts drifting immediately. Importing one
    # directly by id still works -- this governs what gets advertised, not what
    # an instructor who knows the id may do.
    query = query.where(Assignment.from_source == False)  # noqa: E712

    if exclude_course_id is not None:
        query = query.where(Courses.id != exclude_course_id)

    # Restrict to a single book when the caller asked for "my book only".
    if criteria.base_course:
        query = query.where(Courses.base_course == criteria.base_course)

    # "Only from my courses": material the caller has taught with, as opposed to
    # everything on the platform. An empty ``my_course_ids`` renders as a false
    # predicate, which is the honest answer -- there is nothing of theirs to show.
    if criteria.only_my_courses:
        query = query.where(Courses.id.in_(my_course_ids))

    # Columns a filter may name, beyond the plain Assignment columns. "Course"
    # and "book" are the same join here -- a book is just a course whose
    # base_course points at itself.
    joined_columns = {
        "course_name": Courses.course_name,
        "institution": Courses.institution,
        "base_course": Courses.base_course,
        "book_title": Library.title,
    }

    for field, filter_data in (criteria.filters or {}).items():
        # ``filters`` is loosely typed, so a caller can hand us a bare value
        # where the nested {"value": ..., "matchMode": ...} shape is expected.
        if not isinstance(filter_data, dict):
            continue
        filter_value = filter_data.get("value")
        filter_mode = filter_data.get("matchMode", "contains")
        if filter_value is None or filter_value == "":
            continue

        if field == "global":
            # Every whitespace-separated term must appear somewhere, so extra
            # words narrow the result set instead of widening it.
            search_columns = [
                Assignment.name,
                Assignment.description,
                Courses.course_name,
                Library.title,
            ]
            terms = str(filter_value).strip().split()
            for term in terms:
                query = query.where(
                    or_(*[col.ilike(f"%{term}%") for col in search_columns])
                )
            continue

        column = _searchable_column(field, joined_columns)
        if column is None:
            continue

        # Only "in" takes a list; interpolating one into a LIKE pattern would
        # match on its repr and quietly return nothing.
        if isinstance(filter_value, list) and filter_mode != "in":
            continue

        if filter_mode == "contains":
            query = query.where(column.ilike(f"%{filter_value}%"))
        elif filter_mode == "equals":
            query = query.where(column == filter_value)
        elif filter_mode == "startsWith":
            query = query.where(column.ilike(f"{filter_value}%"))
        elif filter_mode == "endsWith":
            query = query.where(column.ilike(f"%{filter_value}"))
        elif filter_mode == "notContains":
            query = query.where(~column.ilike(f"%{filter_value}%"))
        elif filter_mode == "notEquals":
            query = query.where(column != filter_value)
        elif filter_mode == "in" and isinstance(filter_value, list) and filter_value:
            query = query.where(column.in_(filter_value))

    # The caller's *own* book leads, and their chosen column orders within each
    # group. Only their own book: elevating every book's official assignments
    # would put nineteen other books' material ahead of what an instructor
    # actually shares, which is the opposite of not losing things.
    if prefer_base_course:
        query = query.order_by(
            case(
                (_IS_OFFICIAL & (Courses.base_course == prefer_base_course), 0), else_=1
            )
        )

    if criteria.sorting and criteria.sorting.get("field"):
        field = criteria.sorting["field"]
        order = criteria.sorting.get("order", 1)
        column = _searchable_column(field, joined_columns)
        if column is not None:
            query = query.order_by(asc(column) if order == 1 else desc(column))

    # Order by id last so paging is stable when the sort column ties.
    query = query.order_by(Assignment.id)

    count_query = select(func.count()).select_from(query.subquery())
    page_query = query.offset(criteria.page * criteria.limit).limit(criteria.limit)

    async with async_session() as session:
        total_count = (await session.execute(count_query)).scalar() or 0
        rows = (await session.execute(page_query)).all()

        assignment_ids = [row.Assignment.id for row in rows]
        course_ids = {row.Courses.id for row in rows}

        # One extra query each for question counts and sharing blurbs, rather
        # than joins that would complicate the count query above.
        question_counts = {}
        if assignment_ids:
            count_rows = await session.execute(
                select(
                    AssignmentQuestion.assignment_id,
                    func.count(AssignmentQuestion.id),
                )
                .where(AssignmentQuestion.assignment_id.in_(assignment_ids))
                .group_by(AssignmentQuestion.assignment_id)
            )
            question_counts = {aid: count for aid, count in count_rows.all()}

        sharing_descriptions = {}
        if course_ids:
            attr_rows = await session.execute(
                select(CourseAttribute.course_id, CourseAttribute.value).where(
                    (CourseAttribute.course_id.in_(course_ids))
                    & (CourseAttribute.attr == "sharing_description")
                )
            )
            # Truncated because a page of results carries one of these per
            # course and the value is instructor-entered free text; the form's
            # maxlength is only advisory.
            sharing_descriptions = {
                cid: (value or "")[:SHARING_DESCRIPTION_PREVIEW_CHARS]
                for cid, value in attr_rows.all()
            }

        existing_imports = await _existing_imports(
            session, assignment_ids, target_course_id
        )

        assignments = []
        for row in rows:
            assignment, course, library = row.Assignment, row.Courses, row.Library
            assignments.append(
                {
                    "id": assignment.id,
                    "name": assignment.name,
                    "description": assignment.description,
                    "duedate": assignment.duedate,
                    "points": assignment.points,
                    "kind": assignment.kind,
                    "is_private": assignment.is_private,
                    "question_count": question_counts.get(assignment.id, 0),
                    "course_id": course.id,
                    "course_name": course.course_name,
                    "institution": course.institution,
                    "base_course": course.base_course,
                    "book_title": library.title if library else course.base_course,
                    "sharing_description": sharing_descriptions.get(course.id, ""),
                    "is_mine": course.id in my_course_ids,
                    "is_official": _is_official(assignment, course),
                    # Left in the results rather than filtered out: a row that
                    # silently vanishes after an import looks like a bug, and
                    # seeing it marked is what tells the instructor why they
                    # cannot find it.
                    "already_imported": assignment.id in existing_imports,
                    "imported_as": existing_imports.get(assignment.id),
                }
            )

        return {
            "assignments": assignments,
            "pagination": {
                "total": total_count,
                "page": criteria.page,
                "limit": criteria.limit,
                "pages": (total_count + criteria.limit - 1) // criteria.limit,
            },
        }


async def _fetch_source_for_import(source_assignment_id: int, user_id: int):
    """Load an assignment and its course, enforcing the sharing rules.

    Import and preview both need the same answer to "may this person look at
    this assignment", so they share this. Raises rather than returning a flag so
    a caller cannot forget to check.
    """
    from .course import fetch_instructor_courses

    async with async_session() as session:
        row = (
            await session.execute(
                select(Assignment, Courses)
                .join(Courses, Assignment.course == Courses.id)
                .where(Assignment.id == source_assignment_id)
            )
        ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment {source_assignment_id} not found",
        )

    assignment, source_course = row.Assignment, row.Courses

    # The same three ways in that ``_visibility`` allows, asked of one row: the
    # owning course offers its assignments, it belongs to a book (which has
    # always been copyable), or the caller already instructs that course.
    allowed = (
        await course_shares_assignments(source_course.id)
        or source_course.course_name == source_course.base_course
        or bool(await fetch_instructor_courses(user_id, source_course.id))
    )
    if not allowed:
        # 404 rather than 403: a private assignment should not confirm it exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment {source_assignment_id} not found",
        )

    return assignment, source_course


async def fetch_assignment_for_preview(
    source_assignment_id: int, user_id: int, target_course=None
) -> dict:
    """Summarize a shareable assignment without exposing question content.

    Deliberately separate from ``GET /assignments/{id}``, which is scoped to the
    caller's own course and should stay that way.
    """
    assignment, source_course = await _fetch_source_for_import(
        source_assignment_id, user_id
    )

    async with async_session() as session:
        rows = (
            await session.execute(
                select(AssignmentQuestion, Question)
                .join(Question, AssignmentQuestion.question_id == Question.id)
                .where(AssignmentQuestion.assignment_id == source_assignment_id)
                .order_by(AssignmentQuestion.sorting_priority)
            )
        ).all()

        library = (
            (
                await session.execute(
                    select(Library).where(
                        Library.basecourse == source_course.base_course
                    )
                )
            )
            .scalars()
            .first()
        )

        sharing_description = (
            await session.execute(
                select(CourseAttribute.value).where(
                    (CourseAttribute.course_id == source_course.id)
                    & (CourseAttribute.attr == "sharing_description")
                )
            )
        ).scalar()

        existing_imports = await _existing_imports(
            session,
            [source_assignment_id],
            target_course.id if target_course is not None else None,
        )

    duedate = assignment.duedate
    duedate_warning = None
    if target_course is not None:
        duedate, duedate_warning = shift_duedate_between_courses(
            duedate, source_course, target_course
        )

    cross_book = (
        target_course is not None
        and target_course.base_course != source_course.base_course
    )
    # Which rows import tells the instructor what they are getting before they
    # commit to it, and is worked out the same way import_assignment does.
    will_import = [
        not (cross_book and _is_book_bound(row.AssignmentQuestion, row.Question))
        for row in rows
    ]

    return {
        "id": assignment.id,
        "name": assignment.name,
        "description": assignment.description,
        "points": assignment.points,
        "kind": assignment.kind,
        "duedate": duedate,
        "question_count": len(rows),
        "course_name": source_course.course_name,
        "base_course": source_course.base_course,
        "book_title": library.title if library else source_course.base_course,
        "institution": source_course.institution,
        "is_official": _is_official(assignment, source_course),
        "sharing_description": sharing_description or "",
        # True when the source belongs to a different book than the target.
        # Exercises still link across, but readings do not travel.
        "is_cross_book": cross_book,
        # A copy of this source already sits in the target course. Reported, not
        # enforced -- re-importing to get a clean copy back is a real thing to
        # want, so the decision belongs to the instructor looking at the warning.
        "already_imported": source_assignment_id in existing_imports,
        "imported_as": existing_imports.get(source_assignment_id),
        "skipped_readings": will_import.count(False),
        "duedate_warning": duedate_warning,
        "questions": [
            {
                "id": row.Question.id,
                "name": row.Question.name,
                "question_type": row.Question.question_type,
                "points": row.AssignmentQuestion.points,
                "chapter": row.Question.chapter,
                "subchapter": row.Question.subchapter,
                "reading_assignment": row.AssignmentQuestion.reading_assignment,
                "will_import": imported,
            }
            for row, imported in zip(rows, will_import)
        ],
    }


async def import_assignment(
    source_assignment_id: int,
    target_course,
    importing_user,
) -> ImportedAssignment:
    """Copy a shareable assignment from any course into ``target_course``.

    Questions are linked, never copied, exactly as adding an exercise from
    another course does. An exercise renders from its own stored HTML and is
    identified everywhere -- in the DOM, in ``useinfo``, in grading -- by the
    div id baked into that HTML, so a copy would have to rewrite the HTML to
    stay coherent; a link needs nothing rewritten and leaves no duplicate
    behind in the book when the imported assignment is deleted.

    Readings are the exception when the books differ: a reading points at a
    chapter and subchapter of its own book, which the importer's students are
    not reading, so those rows are left behind rather than imported broken.

    :param source_assignment_id: assignment being imported
    :param target_course: course to import into, as a Courses row or validator
    :param importing_user: the instructor performing the import
    :return: the new assignment, its name, and how many readings were skipped
    """
    assignment, source_course = await _fetch_source_for_import(
        source_assignment_id, importing_user.id
    )

    duedate, duedate_warning = shift_duedate_between_courses(
        assignment.duedate, source_course, target_course
    )
    is_timed, is_peer = _normalize_assignment_kind(
        assignment.kind, assignment.is_timed, assignment.is_peer
    )
    cross_book = source_course.base_course != target_course.base_course

    async with async_session.begin() as session:
        existing_names = set(
            (
                await session.execute(
                    select(Assignment.name).where(Assignment.course == target_course.id)
                )
            )
            .scalars()
            .all()
        )
        new_name = unique_assignment_name(assignment.name, existing_names)

        source_rows = (
            await session.execute(
                select(AssignmentQuestion, Question)
                .join(Question, AssignmentQuestion.question_id == Question.id)
                .where(AssignmentQuestion.assignment_id == source_assignment_id)
                .order_by(AssignmentQuestion.sorting_priority)
            )
        ).all()

        rows_to_import = [
            row
            for row in source_rows
            if not (cross_book and _is_book_bound(row.AssignmentQuestion, row.Question))
        ]
        skipped_readings = len(source_rows) - len(rows_to_import)

        new_assignment = Assignment(
            course=target_course.id,
            name=new_name,
            duedate=duedate,
            updated_date=canonical_utcnow(),
            description=assignment.description,
            # Recomputed rather than copied: skipping a reading changes the
            # total, and fetch_one_assignment overwrites this with the sum of
            # the question points anyway.
            points=sum(row.AssignmentQuestion.points or 0 for row in rows_to_import),
            threshold_pct=assignment.threshold_pct,
            is_timed=is_timed,
            is_peer=is_peer,
            time_limit=assignment.time_limit,
            from_source=False,
            nofeedback=assignment.nofeedback,
            nopause=assignment.nopause,
            released=assignment.released,
            # Hidden until the importer has looked it over, and not re-shared on
            # their behalf -- sharing is a decision each owner makes themselves.
            visible=False,
            is_private=True,
            allow_self_autograde=assignment.allow_self_autograde,
            current_index=0,
            enforce_due=assignment.enforce_due,
            peer_async_visible=assignment.peer_async_visible,
            kind=assignment.kind,
            # The breadcrumb the import browser reads back to warn about a
            # second import. Records the immediate source, so a copy of a copy
            # points at the copy rather than at the original.
            imported_from_assignment_id=source_assignment_id,
        )
        session.add(new_assignment)
        await session.flush()

        for row in rows_to_import:
            source_aq = row.AssignmentQuestion

            # Field by field rather than through copy_question, whose linking
            # path looks the source row up under the *new* assignment id and so
            # always falls back to its defaults. Here the points and grading
            # settings the source author chose ride along with the exercise.
            session.add(
                AssignmentQuestion(
                    assignment_id=new_assignment.id,
                    question_id=source_aq.question_id,
                    points=source_aq.points,
                    timed=source_aq.timed,
                    autograde=source_aq.autograde,
                    which_to_grade=source_aq.which_to_grade,
                    reading_assignment=source_aq.reading_assignment,
                    sorting_priority=source_aq.sorting_priority,
                    activities_required=source_aq.activities_required,
                )
            )

        await session.flush()
        result = AssignmentValidator.from_orm(new_assignment)

    rslogger.info(
        f"Imported assignment {source_assignment_id} from {source_course.course_name} "
        f"into {target_course.course_name} as {result.id} ({new_name}) with "
        f"{len(rows_to_import)} questions, {skipped_readings} readings skipped"
    )
    return ImportedAssignment(result, new_name, skipped_readings, duedate_warning)


class BulkImportResult(NamedTuple):
    """What :func:`import_course_assignments` did, item by item.

    Names rather than counts so a caller can show either. ``skipped_existing``
    holds the source names that were passed over, which is the difference
    between "that course only had two new ones" and "nothing happened".
    ``duedate_not_shifted`` counts imports whose due date could not be moved
    to the target term because a course timezone is invalid -- the assignment
    still imports, just with its original due date.
    """

    imported: List[str]
    skipped_existing: List[str]
    skipped_readings: int
    failed: List[str]
    duedate_not_shifted: int = 0


async def import_course_assignments(
    source_course_id: int,
    target_course,
    importing_user,
    skip_existing: bool = True,
) -> BulkImportResult:
    """Import every importable assignment from one course into another.

    The case the assignment-at-a-time browser serves badly: an instructor
    picking up a colleague's whole semester, or starting from the book's
    official set. Each assignment goes through :func:`import_assignment`, so
    the sharing rules, name de-duplication, due-date shifting and cross-book
    reading handling are the same as importing one by hand.

    ``from_source`` assignments are left out. The book build regenerates those
    from the book's own markup every time it runs, so a copy is a snapshot that
    starts drifting immediately -- the older Copy Assignments page excluded them
    from its "all assignments" option for the same reason.

    Not one transaction. Each import commits on its own, so a failure partway
    through leaves the ones that already worked in place and reports the rest;
    for a bulk copy that beats rolling back thirty successful imports because
    the thirty-first had a bad row.

    :param source_course_id: course to take assignments from
    :param target_course: course to import into, as a Courses row or validator
    :param importing_user: the instructor performing the import
    :param skip_existing: pass over assignments already imported into the target
    :return: what was imported, skipped and failed
    """
    from .course import fetch_instructor_courses

    if source_course_id == target_course.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot import a course's assignments into itself",
        )

    my_course_ids = [
        ci.course for ci in await fetch_instructor_courses(importing_user.id)
    ]

    visibility = _visibility(my_course_ids)

    async with async_session() as session:
        source_course = (
            (
                await session.execute(
                    select(Courses).where(Courses.id == source_course_id)
                )
            )
            .scalars()
            .first()
        )

        if source_course is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course {source_course_id} not found",
            )

        allowed = (
            await session.execute(
                select(visibility).where(Courses.id == source_course_id)
            )
        ).scalar()
        if not allowed:
            # 404 rather than 403: a private course should not confirm it exists.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course {source_course_id} not found",
            )

        rows = (
            (
                await session.execute(
                    select(Assignment)
                    .join(Courses, Assignment.course == Courses.id)
                    .where(
                        (Courses.id == source_course_id)
                        & visibility
                        & (Assignment.from_source == False)  # noqa: E712
                    )
                    .order_by(Assignment.name)
                )
            )
            .scalars()
            .all()
        )

        already_imported = await _existing_imports(
            session, [row.id for row in rows], target_course.id
        )

    imported: List[str] = []
    skipped_existing: List[str] = []
    failed: List[str] = []
    skipped_readings = 0
    duedate_not_shifted = 0

    for source in rows:
        if skip_existing and source.id in already_imported:
            skipped_existing.append(source.name)
            continue
        try:
            result = await import_assignment(
                source_assignment_id=source.id,
                target_course=target_course,
                importing_user=importing_user,
            )
        except Exception as e:
            # One bad assignment should not cost the instructor the other
            # twenty-nine, so this records the failure and carries on.
            rslogger.error(f"Bulk import skipped assignment {source.id}: {e}")
            failed.append(source.name)
            continue
        imported.append(result.name)
        skipped_readings += result.skipped_readings
        if result.duedate_warning:
            duedate_not_shifted += 1

    rslogger.info(
        f"Bulk imported {len(imported)} assignments from {source_course.course_name} "
        f"into {target_course.course_name}; {len(skipped_existing)} already present, "
        f"{len(failed)} failed, {skipped_readings} readings skipped, "
        f"{duedate_not_shifted} due dates not shifted"
    )
    return BulkImportResult(
        imported, skipped_existing, skipped_readings, failed, duedate_not_shifted
    )


async def search_shareable_courses(
    user_id: int,
    search: str = "",
    base_course: Optional[str] = None,
    prefer_base_course: Optional[str] = None,
    only_my_courses: bool = False,
    exclude_course_id: Optional[int] = None,
    page: int = 0,
    limit: int = 20,
) -> dict:
    """List courses that have something an instructor could import.

    Course-first browsing, for the case the assignment grid handles badly:
    "give me what that course uses" rather than "find me one problem set". A
    course only appears if at least one of its assignments passes the same
    visibility rules :func:`search_assignments` applies, so nothing shows up
    here that would turn out to be empty when opened.

    :param user_id: id of the requesting instructor
    :param search: matched against course name, institution and book title
    :param base_course: restrict to one book
    :param prefer_base_course: sort this book's own course to the very top,
        normally the caller's book -- its official assignments are the answer
        often enough to be worth not making anyone search for them
    :param only_my_courses: restrict to courses the caller instructs
    :param exclude_course_id: course to leave out, normally the caller's own
    :return: dict with ``courses`` and ``pagination`` keys
    """
    from .course import fetch_instructor_courses

    my_course_ids = [ci.course for ci in await fetch_instructor_courses(user_id)]

    visibility = _visibility(my_course_ids)

    query = (
        select(
            Courses.id,
            Courses.course_name,
            Courses.institution,
            Courses.base_course,
            Library.title,
            func.count(Assignment.id).label("shareable_count"),
        )
        .join(Assignment, Assignment.course == Courses.id)
        .outerjoin(Library, Courses.base_course == Library.basecourse)
        # Same exclusion the assignment search and the bulk import apply, so
        # the count here is what opening the course actually offers.
        .where(visibility & (Assignment.from_source == False))  # noqa: E712
        .group_by(
            Courses.id,
            Courses.course_name,
            Courses.institution,
            Courses.base_course,
            Library.title,
        )
    )

    if exclude_course_id is not None:
        query = query.where(Courses.id != exclude_course_id)
    if base_course:
        query = query.where(Courses.base_course == base_course)
    if only_my_courses:
        query = query.where(Courses.id.in_(my_course_ids))

    if search and search.strip():
        # Every term must appear somewhere, so extra words narrow rather than
        # widen -- the same rule the assignment search uses.
        columns = [Courses.course_name, Courses.institution, Library.title]
        for term in search.strip().split():
            query = query.where(or_(*[col.ilike(f"%{term}%") for col in columns]))

    # The caller's own book first; everything else alphabetically. Other books
    # get no boost -- another book's official set is no more relevant to this
    # instructor than a colleague's course, and putting every book on top buries
    # the courses that actually share.
    if prefer_base_course:
        query = query.order_by(
            case((Courses.course_name == prefer_base_course, 0), else_=1)
        )
    query = query.order_by(Courses.course_name)

    count_query = select(func.count()).select_from(query.subquery())
    page_query = query.offset(page * limit).limit(limit)

    async with async_session() as session:
        total_count = (await session.execute(count_query)).scalar() or 0
        rows = (await session.execute(page_query)).all()

    courses = [
        {
            "id": row.id,
            "course_name": row.course_name,
            "institution": row.institution,
            "base_course": row.base_course,
            "book_title": row.title or row.base_course,
            "shareable_count": row.shareable_count,
            "is_official": row.course_name == row.base_course,
            "is_mine": row.id in my_course_ids,
        }
        for row in rows
    ]

    return {
        "courses": courses,
        "pagination": {
            "total": total_count,
            "page": page,
            "limit": limit,
            "pages": (total_count + limit - 1) // limit,
        },
    }


async def fetch_shareable_assignment_tree(
    user_id: int,
    target_course=None,
    search: str = "",
    use_base_course: bool = False,
    only_my_courses: bool = False,
    page: int = 0,
    limit: int = 20,
) -> dict:
    """Courses with the assignments each one offers, for the import tree.

    The browser shows courses and expands them, so both levels arrive together
    rather than a request per expansion. That is affordable because the page is
    bounded by *courses*, not assignments: one extra query fetches the children
    of every course on the page at once.

    :param user_id: id of the requesting instructor
    :param target_course: course being imported into; rows are marked with
        whether they are already there and its book sorts first
    :param search: matched against course name, institution and book title
    :param use_base_course: restrict to courses on the target course's book
    :param only_my_courses: restrict to courses the caller instructs
    :return: dict with ``courses`` (each carrying ``assignments``) and
        ``pagination`` keys
    """
    from .course import fetch_instructor_courses

    result = await search_shareable_courses(
        user_id=user_id,
        search=search,
        base_course=(
            target_course.base_course if use_base_course and target_course else None
        ),
        prefer_base_course=target_course.base_course if target_course else None,
        only_my_courses=only_my_courses,
        exclude_course_id=target_course.id if target_course else None,
        page=page,
        limit=limit,
    )

    course_ids = [c["id"] for c in result["courses"]]
    if not course_ids:
        return result

    my_course_ids = [ci.course for ci in await fetch_instructor_courses(user_id)]

    async with async_session() as session:
        rows = (
            await session.execute(
                select(Assignment, Courses)
                .join(Courses, Assignment.course == Courses.id)
                .where(
                    Courses.id.in_(course_ids)
                    & _visibility(my_course_ids)
                    & (Assignment.from_source == False)  # noqa: E712
                )
                .order_by(Assignment.name)
            )
        ).all()

        counts = {}
        if rows:
            count_rows = await session.execute(
                select(
                    AssignmentQuestion.assignment_id, func.count(AssignmentQuestion.id)
                )
                .where(
                    AssignmentQuestion.assignment_id.in_(
                        [r.Assignment.id for r in rows]
                    )
                )
                .group_by(AssignmentQuestion.assignment_id)
            )
            counts = {aid: count for aid, count in count_rows.all()}

        existing_imports = await _existing_imports(
            session,
            [r.Assignment.id for r in rows],
            target_course.id if target_course else None,
        )

    by_course = {course_id: [] for course_id in course_ids}
    for row in rows:
        assignment, course = row.Assignment, row.Courses
        by_course[course.id].append(
            {
                "id": assignment.id,
                "name": assignment.name,
                "description": assignment.description,
                "points": assignment.points,
                "kind": assignment.kind,
                "question_count": counts.get(assignment.id, 0),
                "is_official": _is_official(assignment, course),
                "already_imported": assignment.id in existing_imports,
                "imported_as": existing_imports.get(assignment.id),
            }
        )

    for course in result["courses"]:
        course["assignments"] = by_course.get(course["id"], [])

    return result
