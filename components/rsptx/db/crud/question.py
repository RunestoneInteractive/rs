import logging
from typing import List, Optional, Tuple, Dict
from sqlalchemy import select, and_, or_, func, asc, desc, not_
from sqlalchemy.exc import IntegrityError

from ..models import (
    Question,
    QuestionValidator,
    Assignment,
    AssignmentQuestion,
    AssignmentQuestionValidator,
    QuestionGrade,
    QuestionGradeValidator,
    Competency,
    Useinfo,
    SelectedQuestion,
    UserExperiment,
    UserExperimentValidator,
)
from ..async_session import async_session
from .. import schemas
from asyncpg.exceptions import UniqueViolationError
from rsptx.logging import rslogger


async def fetch_question(
    name: str, basecourse: Optional[str] = None, assignment: Optional[str] = None
) -> QuestionValidator:
    """
    Fetch a single matching question row from the database that matches
    the name (div_id) of the question.  If the base course is provided
    make sure the question comes from that basecourse. basecourse,name pairs
    are guaranteed to be unique in the questions table

    More and more questions have globally unique names in the runestone
    database and that is definitely a direction to keep pushing.  But
    it is possible that there are duplicates but we are not going to
    worry about that we are just going to return the first one we find.

    :param name: str, the name (div_id) of the question
    :param basecourse: str, the base course (optional)
    :param assignment: str, the assignment (optional)
    :return: QuestionValidator, the QuestionValidator object
    """
    where_clause = Question.name == name
    if basecourse:
        where_clause = where_clause & (Question.base_course == basecourse)

    query = select(Question).where(where_clause)

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return QuestionValidator.from_orm(res.scalars().first())


async def count_matching_questions(name: str) -> int:
    """
    Count the number of Question entries that match the given name.

    :param name: str, the name (div_id) of the question
    :return: int, the number of matching questions
    """
    query = select(func.count(Question.name)).where(Question.name == name)

    async with async_session() as session:
        res = await session.execute(query)
        return res.scalars().first()


auto_gradable_q = [
    "clickablearea",
    "mchoice",
    "parsonsprob",
    "dragndrop",
    "fillintheblank",
    "lp",
]


async def fetch_matching_questions(request_data: schemas.SelectQRequest) -> List[str]:
    """
    Return a list of question names (div_ids) that match the criteria
    for a particular question. This is used by select questions and in
    particular `get_question_source`
    """
    if request_data.questions:
        questionlist = request_data.questions.split(",")
        questionlist = [q.strip() for q in questionlist]
    elif request_data.proficiency:
        prof = request_data.proficiency.strip()
        rslogger.debug(prof)
        where_clause = (Competency.competency == prof) & (
            Competency.question == Question.id
        )
        if request_data.primary:
            where_clause = where_clause & (Competency.is_primary == True)  # noqa E712
        if request_data.min_difficulty:
            where_clause = where_clause & (
                Question.difficulty >= float(request_data.min_difficulty)
            )
        if request_data.max_difficulty:
            where_clause = where_clause & (
                Question.difficulty <= float(request_data.max_difficulty)
            )
        if request_data.autogradable:
            where_clause = where_clause & (
                (Question.autograde == "unittest")
                | Question.question_type.in_(auto_gradable_q)
            )
        if request_data.limitBaseCourse:
            where_clause = where_clause & (
                Question.base_course == request_data.limitBaseCourse
            )
        query = select(Question.name).where(where_clause)

        async with async_session() as session:
            res = await session.execute(query)
            rslogger.debug(f"{res=}")
            questionlist = []
            for row in res:
                questionlist.append(row[0])

    return questionlist


async def fetch_questions_by_search_criteria(
    criteria: schemas.SearchSpecification,
) -> List[QuestionValidator]:
    """
    Fetch a list of questions that match the search criteria
    regular expression matches are case insensitive

    :param search: str, the search string
    :return: List[QuestionValidator], a list of QuestionValidator objects
    """
    where_criteria = []
    if criteria.source_regex:
        where_criteria.append(
            or_(
                Question.question.regexp_match(criteria.source_regex, flags="i"),
                Question.htmlsrc.regexp_match(criteria.source_regex, flags="i"),
                Question.topic.regexp_match(criteria.source_regex, flags="i"),
                Question.name.regexp_match(criteria.source_regex, flags="i"),
            )
        )

    if criteria.question_type:
        where_criteria.append(Question.question_type == criteria.question_type)

    if criteria.author:
        where_criteria.append(Question.author.regexp_match(criteria.author, flags="i"))

    if criteria.base_course:
        where_criteria.append(Question.base_course == criteria.base_course)

    if len(where_criteria) == 0:
        raise ValueError("No search criteria provided")

    # todo: add support for tags
    query = select(Question).where(and_(*where_criteria))
    rslogger.debug(f"{query=}")
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [QuestionValidator.from_orm(q) for q in res.scalars().fetchall()]


async def search_exercises(
    criteria: schemas.ExercisesSearchRequest,
) -> dict:
    """
    Smart search for exercises with pagination, filtering, and sorting.

    :param criteria: Search parameters including filters, pagination, and sorting
    :return: Dictionary with search results and pagination metadata
    """
    # Base query
    query = select(Question).where(Question.question_type != "page")

    # If assignment_id is provided, exclude already attached exercises
    if criteria.assignment_id is not None:
        assigned_questions = (
            select(AssignmentQuestion.question_id)
            .where(AssignmentQuestion.assignment_id == criteria.assignment_id)
            .scalar_subquery()
        )
        query = query.where(Question.id.not_in(assigned_questions))

    # Process filters
    if criteria.filters:
        for field, filter_data in criteria.filters.items():
            if not filter_data:
                continue

            # Get filter value and mode
            filter_value = filter_data.get("value")
            filter_mode = filter_data.get("matchMode", "contains")

            # Skip empty filter values
            if filter_value is None or filter_value == "":
                continue

            # Process global search (search in multiple fields)
            if field == "global":
                search_fields = ["name", "author", "topic", "tags"]
                or_conditions = []

                for search_field in search_fields:
                    if hasattr(Question, search_field):
                        column = getattr(Question, search_field)
                        or_conditions.append(column.ilike(f"%{filter_value}%"))

                if or_conditions:
                    query = query.where(or_(*or_conditions))

            # Process specific field filters
            elif hasattr(Question, field):
                column = getattr(Question, field)

                if filter_value is not None:
                    if filter_mode == "contains":
                        query = query.where(column.ilike(f"%{filter_value}%"))
                    elif filter_mode == "equals":
                        query = query.where(column == filter_value)
                    elif filter_mode == "startsWith":
                        query = query.where(column.ilike(f"{filter_value}%"))
                    elif filter_mode == "endsWith":
                        query = query.where(column.ilike(f"%{filter_value}"))
                    elif filter_mode == "notContains":
                        query = query.where(not_(column.ilike(f"%{filter_value}%")))
                    elif filter_mode == "notEquals":
                        query = query.where(column != filter_value)
                    elif (
                        filter_mode == "in"
                        and isinstance(filter_value, list)
                        and len(filter_value) > 0
                    ):
                        query = query.where(column.in_(filter_value))

    # Apply sorting
    if criteria.sorting and criteria.sorting.get("field"):
        field = criteria.sorting["field"]
        order = criteria.sorting.get("order", 1)  # 1 for ascending, -1 for descending

        if hasattr(Question, field):
            column = getattr(Question, field)
            query = query.order_by(asc(column) if order == 1 else desc(column))

    # Count total results (before pagination)
    count_query = select(func.count()).select_from(query.subquery())

    # Apply pagination
    query = query.offset(criteria.page * criteria.limit).limit(criteria.limit)

    # Execute queries
    async with async_session() as session:
        total_count = (await session.execute(count_query)).scalar()
        result = await session.execute(query)
        exercises = [
            QuestionValidator.from_orm(row) for row in result.scalars().fetchall()
        ]

        return {
            "exercises": exercises,
            "pagination": {
                "total": total_count,
                "page": criteria.page,
                "limit": criteria.limit,
                "pages": (total_count + criteria.limit - 1) // criteria.limit,
            },
        }


async def fetch_assignment_question(
    assignment_name: str, question_name: str
) -> AssignmentQuestionValidator:
    """
    Retrieve the AssignmentQuestion entry for the given assignment_name and question_name.

    :param assignment_name: str, the name of the assignment
    :param question_name: str, the name (div_id) of the question
    :return: AssignmentQuestionValidator, the AssignmentQuestionValidator object
    """
    query = select(AssignmentQuestion).where(
        (Assignment.name == assignment_name)
        & (Assignment.id == AssignmentQuestion.assignment_id)
        & (AssignmentQuestion.question_id == Question.id)
        & (Question.name == question_name)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return AssignmentQuestionValidator.from_orm(res.scalars().first())


async def fetch_assignment_questions(
    assignment_id: int,
) -> List[Tuple[Question, AssignmentQuestion]]:
    """
    Retrieve the AssignmentQuestion entry for the given assignment_name and question_name.

    :param assignment_name: str, the name of the assignment
    :param question_name: str, the name (div_id) of the question
    :return: AssignmentQuestionValidator, the AssignmentQuestionValidator object
    """
    query = (
        select(Question, AssignmentQuestion)
        .join(Question, AssignmentQuestion.question_id == Question.id)
        .where(AssignmentQuestion.assignment_id == assignment_id)
        .order_by(AssignmentQuestion.sorting_priority)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        # we cannot return res.scalars() because we want both objects in the row.
        # and the scalars() method onnly returns the first object in the row.
        return res


async def fetch_question_count_per_subchapter(
    course_name: str,
) -> Dict[Dict[str, str], int]:
    """
    Return a dictionary of subchapter_id: count of questions in that subchapter
    """
    query = (
        select(
            Question.chapter,
            Question.subchapter,
            func.count(Question.id).label("question_count"),
        )
        .where(
            and_(
                Question.base_course == course_name,
                Question.from_source == True,  # noqa 711
                Question.optional != True,  # noqa 711
            )
        )
        .group_by(Question.chapter, Question.subchapter)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")

    resd = {}
    for row in res:
        if row[0] not in resd:
            resd[row[0]] = {}
        resd[row[0]][row[1]] = row[2]
    return resd


async def fetch_question_grade(sid: str, course_name: str, qid: str):
    """
    Retrieve the QuestionGrade entry for the given sid, course_name, and qid.

    :param sid: str, the student id
    :param course_name: str, the course name
    :param qid: str, the question id (div_id)
    :return: QuestionGradeValidator, the QuestionGradeValidator object
    """
    query = (
        select(QuestionGrade)
        .where(
            (QuestionGrade.sid == sid)
            & (QuestionGrade.course_name == course_name)
            & (QuestionGrade.div_id == qid)
        )
        .order_by(
            QuestionGrade.id.desc(),
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        return QuestionGradeValidator.from_orm(res.scalars().one_or_none())


async def create_question_grade_entry(
    sid: str, course_name: str, qid: str, grade: int
) -> QuestionGradeValidator:
    """
    Create a new QuestionGrade entry with the given sid, course_name, qid, and grade.
    """
    new_qg = QuestionGrade(
        sid=sid,
        course_name=course_name,
        div_id=qid,
        score=grade,
        comment="autograded",
    )
    try:
        async with async_session.begin() as session:
            session.add(new_qg)
    except (IntegrityError, UniqueViolationError) as e:
        rslogger.error(f"IntegrityError: {e} id = {new_qg.id}")
        return None
    return QuestionGradeValidator.from_orm(new_qg)


async def update_question_grade_entry(
    sid: str, course_name: str, qid: str, grade: int, qge_id: Optional[int] = None
) -> QuestionGradeValidator:
    """
    Create a new QuestionGrade entry with the given sid, course_name, qid, and grade.
    """
    new_qg = QuestionGrade(
        sid=sid,
        course_name=course_name,
        div_id=qid,
        score=grade,
        comment="autograded",
    )
    if qge_id is not None:
        new_qg.id = qge_id

    async with async_session.begin() as session:
        await session.merge(new_qg)
    return QuestionGradeValidator.from_orm(new_qg)


async def fetch_user_experiment(sid: str, ab_name: str) -> int:
    """
    When a question is part of an AB experiement (ab_name) get the experiment
    group for a particular student (sid).  The group number will have
    been randomly assigned by the initial question selection.

    This number indicates whether the student will see the 1st or 2nd
    question in the question list.

    :param sid: str, the student id
    :param ab_name: str, the name of the AB experiment
    :return: int, the experiment group number
    """
    query = (
        select(UserExperiment.exp_group)
        .where((UserExperiment.sid == sid) & (UserExperiment.experiment_id == ab_name))
        .order_by(UserExperiment.id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        r = res.scalars().first()
        rslogger.debug(f"{r=}")
        return r


async def create_user_experiment_entry(
    sid: str, ab: str, group: int
) -> UserExperimentValidator:
    """
    Create a new UserExperiment entry with the given sid, ab, and group.

    :param sid: str, the student id
    :param ab: str, the name of the AB experiment
    :param group: int, the experiment group number
    :return: UserExperimentValidator, the UserExperimentValidator object
    """
    new_ue = UserExperiment(sid=sid, exp_group=group, experiment_id=ab)
    async with async_session.begin() as session:
        session.add(new_ue)
    return UserExperimentValidator.from_orm(new_ue)


async def fetch_viewed_questions(sid: str, questionlist: List[str]) -> List[str]:
    """
    Retrieve a list of questions from the given questionlist that a student (sid)
    has viewed before. Used for the selectquestion `get_question_source` to filter
    out questions that a student has seen before. One criteria of a select question
    is to make sure that a student has never seen a question before.

    The best approximation we have for that is that they will have clicked on the
    run button for that question. Of course, they may have seen the question but not
    run it, but this is the best we can do.

    :param sid: str, the student id
    :param questionlist: List[str], a list of question ids (div_id)
    :return: List[str], a list of question ids from the given questionlist that the
             student has viewed before
    """
    query = select(Useinfo).where(
        (Useinfo.sid == sid) & (Useinfo.div_id.in_(questionlist))
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        rlist = [row.div_id for row in res]
    return rlist


async def fetch_previous_selections(sid) -> List[str]:
    """
    Retrieve a list of selected question ids for the given student id (sid).

    :param sid: str, the student id
    :return: List[str], a list of selected question ids
    """
    query = select(SelectedQuestion).where(SelectedQuestion.sid == sid)
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [row.selected_id for row in res.scalars().fetchall()]
