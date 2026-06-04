from typing import Optional, List
from fastapi import HTTPException, status
from asyncpg.exceptions import UniqueViolationError
from rsptx.validation import schemas
from rsptx.validation.schemas import (
    AssignmentQuestionUpdateDict,
    CreateExercisesPayload,
)
from rsptx.data_types.which_to_grade import WhichToGradeOptions
from rsptx.data_types.autograde import AutogradeOptions
from rsptx.response_helpers.core import canonical_utcnow

import logging
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.exc import IntegrityError
from .question import fetch_question_count_per_subchapter

# Models and validators
from ..models import (
    Assignment,
    AssignmentValidator,
    AssignmentQuestion,
    AssignmentQuestionValidator,
    AuthUser,
    CourseInstructor,
    Courses,
    DeadlineException,
    DeadlineExceptionValidator,
    Grade,
    GradeValidator,
    Library,
    Question,
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
                ).where(Question.id == question_id)
                question_info_result = await session.execute(question_info_query)
                question_info = question_info_result.first()

                difficulty, chapter, subchapter, base_course = question_info
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
                    autograde=(
                        "interaction" if payload.isReading else "pct_correct"
                    ),  # Depends on isReading
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
                autograde=(
                    "interaction" if data.is_reading else "pct_correct"
                ),  # Depends on isReading
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
