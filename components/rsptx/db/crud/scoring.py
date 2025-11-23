import datetime
from typing import List, Optional
from sqlalchemy import select, and_, or_
from zoneinfo import ZoneInfo

from ..models import (
    Assignment,
    AssignmentQuestion,
    Question,
    QuestionGrade,
    QuestionGradeValidator,
    DeadlineExceptionValidator,
    runestone_component_dict,
)
from ..async_session import async_session
from rsptx.validation import schemas
from .crud import EVENT2TABLE
from rsptx.logging import rslogger


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
    timezone: Optional[str] = "UTC",
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
        or_(Assignment.is_timed == False, Assignment.kind != "Timed"),  # noqa: E712
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
    tz = ZoneInfo(timezone)
    course_tz_now = datetime.datetime.now(tz)
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
            if course_tz_now <= row.Assignment.duedate.replace(tzinfo=tz):
                if row.Assignment.visible:  # todo update this when we have a visible by
                    scoringSpec.assigned = True
                    return scoringSpec
            else:
                if not row.Assignment.enforce_due:
                    if row.Assignment.visible or visible_exception:
                        scoringSpec.assigned = True
                        return scoringSpec
        return schemas.ScoringSpecification()


async def fetch_reading_assignment_spec(
    chapter: str,
    subchapter: str,
    course_id: int,
    timezone: Optional[str] = "UTC",
) -> Optional[int]:
    """
    Check if a reading assignment is assigned for a given chapter and subchapter.

    :param chapter: str, the label of the chapter
    :param subchapter: str, the label of the subchapter
    :param course_id: int, the id of the course
    :return: The number of required activities or None if not found
    """
    tz = ZoneInfo(timezone)
    course_tz_now = datetime.datetime.now(tz)
    course_tz_now = course_tz_now.replace(tzinfo=None)
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
                    Assignment.duedate > course_tz_now,
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
