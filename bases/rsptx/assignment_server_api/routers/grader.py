import csv
import io
import json
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func, and_

from rsptx.auth.session import auth_manager
from rsptx.db.async_session import async_session
from rsptx.db.crud import (
    fetch_assignment_questions,
    fetch_course,
    fetch_course_instructors,
    fetch_gradebook,
    fetch_grade,
    fetch_interaction_useinfo,
    fetch_one_assignment,
    fetch_interacted_sids,
    fetch_interaction_counts,
    fetch_question_grade,
    fetch_user,
    fetch_users_for_course,
    page_interaction_key,
    create_question_grade_entry,
    is_interaction_event,
    set_manual_total,
    update_question_grade_entry,
    update_assignment_released,
    update_assignment_threshold,
    update_course_settings,
)
from rsptx.db.models import (
    Assignment,
    AssignmentQuestion,
    Code,
    Question,
    QuestionGrade,
    Useinfo,
)
from rsptx.endpoint_validators import instructor_role_required
from rsptx.logging import rslogger
from rsptx.grading_helpers.comments import (
    display_comment,
    instructor_comment,
    is_hand_graded,
)
from rsptx.grading_helpers.lti_push import attempt_lti_score_updates
from rsptx.response_helpers.core import make_json_response
from rsptx.grading_helpers.answer_tables import (
    CODE_TABLE_TYPES,
    answer_table_for,
    describe_interaction,
    interaction_events_for,
)
from rsptx.grading_helpers.select_questions import (
    is_select_question,
    resolve_for_class,
    resolve_one,
)
from rsptx.grading_helpers.regrade import (
    RegradeOptions,
    regrade_batch,
    recompute_totals_for,
    recompute_totals_detail,
)

router = APIRouter(
    prefix="/instructor/grader",
    tags=["grader"],
)


def _answer_table_for(question_type: str):
    model, _table_name = answer_table_for(question_type)
    return model


def _answer_text(raw_answer: Any) -> str:
    """Return the string form expected by the grader frontend.

    JSON-backed answer columns are loaded as dictionaries or lists.  ``str``
    would produce Python syntax with single quotes, which is not valid JSON and
    cannot be decoded by the compact Matching renderer.
    """
    if isinstance(raw_answer, (dict, list)):
        return json.dumps(raw_answer, separators=(",", ":"), ensure_ascii=False)
    return str(raw_answer or "")


class GraderQuestionStats(BaseModel):
    id: int
    name: str
    question_type: str
    htmlsrc: Optional[str] = None
    points: int
    autograde: Optional[str] = None
    which_to_grade: Optional[str] = None

    answered_count: int

    total_attempts: int

    correct_count: int

    graded_count: int

    average_score: float

    avg_percent: Optional[float] = None


class GraderStudentAnswer(BaseModel):
    sid: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    answer: Optional[str] = None
    correct: Optional[bool] = None
    percent: Optional[float] = None
    timestamp: Optional[str] = None
    attempts: int = 0
    score: Optional[float] = None
    comment: Optional[str] = None
    #: True when a human set this score, so the student list can tell a hand
    #: grade apart from an auto-graded one even with no comment to show.
    hand_graded: bool = False
    max_points: int = 0
    #: For a selectquestion, the question this student was actually served.
    #: The grading preview has to render that one, not the wrapper.
    selected_div_id: Optional[str] = None
    selected_question_type: Optional[str] = None
    selected_htmlsrc: Optional[str] = None


class GraderAnswerHistoryItem(BaseModel):
    id: int

    answer: Optional[Any] = None
    correct: Optional[bool] = None
    percent: Optional[float] = None
    timestamp: Optional[str] = None
    source: Optional[str] = None
    min_height: Optional[int] = None
    drag_width: Optional[int] = None
    drop_width: Optional[int] = None


class GradeUpdatePayload(BaseModel):
    sid: str
    div_id: str
    score: float
    comment: Optional[str] = ""
    # Which assignment's total to roll up after saving. Optional so that older
    # clients (and the direct-POST e2e tests) keep working; when it is missing we
    # fall back to looking the assignment(s) up from ``div_id``.
    assignment_id: Optional[int] = None


class _QuestionTally:
    """What the batched queries learn about one question on the list."""

    def __init__(self, max_points: int):
        self.max_points = max_points
        self.answered: set = set()
        self.total_attempts = 0
        #: Set from the answer table when it has a ``correct`` column;
        #: otherwise derived from question_grades below.
        self.correct_count: Optional[int] = None
        self.avg_percent: Optional[float] = None
        self.graded_count = 0
        self.average_score = 0.0


def _excluding(column, instructor_list):
    """``column NOT IN instructors`` as a list of 0 or 1 clauses."""
    return [column.notin_(instructor_list)] if instructor_list else []


async def _answer_table_stats(tbl, tallies, course, instructor_list):
    """Fill in answered / attempts / correct / avg percent for every question
    stored in one answer table, from a single query.

    ``DISTINCT ON (div_id, sid) ... ORDER BY id DESC`` keeps each student's
    latest answer, and the window count rides along on that row so attempts
    need no second query.
    """
    has_correct = hasattr(tbl, "correct")
    has_percent = hasattr(tbl, "percent")
    cols = [
        tbl.div_id,
        tbl.sid,
        func.count().over(partition_by=(tbl.div_id, tbl.sid)).label("attempts"),
    ]
    if has_correct:
        cols.append(tbl.correct)
    if has_percent:
        cols.append(tbl.percent)
    query = (
        select(*cols)
        .where(
            and_(
                tbl.div_id.in_(list(tallies)),
                tbl.course_name == course.course_name,
                *_excluding(tbl.sid, instructor_list),
            )
        )
        .distinct(tbl.div_id, tbl.sid)
        .order_by(tbl.div_id, tbl.sid, tbl.id.desc())
    )
    async with async_session() as session:
        rows = (await session.execute(query)).all()

    correct_sids: dict = {name: set() for name in tallies}
    percents: dict = {name: [] for name in tallies}
    for row in rows:
        tally = tallies[row.div_id]
        if row.sid:
            tally.answered.add(row.sid)
        tally.total_attempts += int(row.attempts)
        if has_correct and (row.correct or (has_percent and (row.percent or 0) >= 1.0)):
            correct_sids[row.div_id].add(row.sid)
        if has_percent and row.percent is not None:
            percents[row.div_id].append(row.percent)

    for name, tally in tallies.items():
        if has_correct:
            tally.correct_count = len(correct_sids[name])
        if percents[name]:
            tally.avg_percent = round(sum(percents[name]) / len(percents[name]), 4)


async def _code_table_stats(tallies, course, instructor_list):
    """Answered / attempts from the ``code`` table for activecode-like
    questions, which save a row for every run whether or not tests ran."""
    query = (
        select(Code.acid, Code.sid, func.count(Code.id))
        .where(
            and_(
                Code.acid.in_(list(tallies)),
                Code.course_id == course.id,
                *_excluding(Code.sid, instructor_list),
            )
        )
        .group_by(Code.acid, Code.sid)
    )
    async with async_session() as session:
        for acid, sid, count in (await session.execute(query)).all():
            tally = tallies[acid]
            if sid:
                tally.answered.add(sid)
            tally.total_attempts += int(count or 0)


async def _interaction_stats(names, tallies, course, instructor_ids):
    """Videos and polls have no answer table; their submissions are logged
    interactions, so "answered" has to be counted from those or every one of
    them reports 0 answered no matter how much the class interacted.

    Read from ``user_interactions``, which counts only real activity -- a
    video's ``ready``, logged whenever its player is built, is left out.
    """
    counts = await fetch_interaction_counts(course.course_name, names)
    for name, by_sid in counts.items():
        for sid, n in by_sid.items():
            if sid in instructor_ids:
                continue
            tallies[name].answered.add(sid)
            tallies[name].total_attempts += n


async def _reading_stats(reading_rows, tallies, course, instructor_ids):
    """A reading has no answers.  What it has is readers: count the students
    who opened the page, so the row reports what happened instead of a flat 0.
    See issue #1493.

    Read from ``user_interactions``, where page views are filed under the
    page's chapter/subchapter labels -- the log itself records a URL path that
    can only be matched by suffix, which meant scanning the course's history.
    """
    keys = {q.name: page_interaction_key(q.chapter, q.subchapter) for q in reading_rows}
    readers = await fetch_interacted_sids(course.course_name, keys.values())
    for name, key in keys.items():
        tallies[name].answered.update(readers[key] - instructor_ids)


async def _question_grade_stats(tallies, course, instructor_list):
    """Graded count and average score for every question in one query, plus
    the "correct" count for questions whose answers have no ``correct``
    column: a grade at full marks."""
    query = select(QuestionGrade.div_id, QuestionGrade.sid, QuestionGrade.score).where(
        and_(
            QuestionGrade.course_name == course.course_name,
            QuestionGrade.div_id.in_(list(tallies)),
            QuestionGrade.score != None,  # noqa: E711
            *_excluding(QuestionGrade.sid, instructor_list),
        )
    )
    async with async_session() as session:
        rows = (await session.execute(query)).all()

    scores: dict = {name: [] for name in tallies}
    for div_id, sid, score in rows:
        scores[div_id].append((sid, score))
    for name, tally in tallies.items():
        graded = scores[name]
        if graded:
            tally.average_score = sum(s for _, s in graded) / len(graded)
            tally.graded_count = len({sid for sid, _ in graded})
        if tally.correct_count is None:
            tally.correct_count = (
                len({sid for sid, s in graded if s >= float(tally.max_points)})
                if tally.max_points > 0
                else 0
            )


async def _select_question_answered_sids(questions, course, instructor_ids):
    """The students who have answered each ``selectquestion``.

    Their answers are filed under whichever question each of them was served,
    so counting rows under the wrapper's own name reports 0 no matter how much
    of the class answered.  See issue #1481.

    Every selectquestion's served questions are looked up together, one query
    per question type rather than one per selectquestion.

    :return: ``{wrapper name: {sid, ...}}``.
    """
    answered = {q.name: set() for q in questions}
    # (sid, served div_id) -> the wrappers that served it to that student
    credit_to: dict = {}
    by_type: dict = {}
    for q in questions:
        resolved = await resolve_for_class(q, basecourse=course.base_course)
        for sid, r in resolved.items():
            if not sid or sid in instructor_ids:
                continue
            credit_to.setdefault((sid, r.div_id), []).append(q.name)
            by_type.setdefault(r.question_type, set()).add(r.div_id)

    def credit(sid, div_id):
        for name in credit_to.get((sid, div_id), ()):
            answered[name].add(sid)

    for qtype, div_ids in by_type.items():
        tbl = _answer_table_for(qtype)
        if tbl is not None:
            async with async_session() as session:
                res = await session.execute(
                    select(tbl.sid, tbl.div_id)
                    .where(
                        and_(
                            tbl.div_id.in_(div_ids),
                            tbl.course_name == course.course_name,
                        )
                    )
                    .distinct()
                )
                for sid, div_id in res.all():
                    credit(sid, div_id)

        if interaction_events_for(qtype):
            for div_id, by_sid in (
                await fetch_interaction_counts(course.course_name, div_ids)
            ).items():
                for sid in by_sid:
                    credit(sid, div_id)

        if qtype in CODE_TABLE_TYPES:
            async with async_session() as session:
                res = await session.execute(
                    select(Code.sid, Code.acid)
                    .where(and_(Code.acid.in_(div_ids), Code.course_id == course.id))
                    .distinct()
                )
                for sid, acid in res.all():
                    credit(sid, acid)

    return answered


async def _guarded(label, coro):
    """Run one batch of stats, logging a failure instead of failing the page.

    Each batch uses its own session, so one bad query cannot abort the
    transaction the others run in.  The questions it covers keep their zeros.
    """
    try:
        return await coro
    except Exception as e:  # pragma: no cover - defensive
        rslogger.error(f"Grader stats failed for {label}: {e}")
        return None


@router.get("/assignments/{assignment_id}/questions")
@instructor_role_required()
async def list_assignment_questions(
    assignment_id: int, request: Request, user=Depends(auth_manager)
):
    """Return the list of questions in the assignment along with aggregate
    student answer statistics. Only non-instructor answers are counted.

    The statistics are gathered in batches -- one query per answer table, one
    for question_grades, one for the course's page views, and so on -- rather
    than several queries per question.  The page refetches this after every
    grade an instructor saves, and the per-question loop took minutes on a
    large course's readings.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    instructor_ids = {
        u.username for u in await fetch_course_instructors(course.course_name)
    }
    instructor_list = list(instructor_ids)

    rows = list(await fetch_assignment_questions(assignment_id))

    tallies: dict = {}
    by_table: dict = {}
    code_names: set = set()
    interaction_names: set = set()
    reading_rows = []
    select_questions = []
    for row in rows:
        q = row.Question
        tallies.setdefault(q.name, _QuestionTally(row.AssignmentQuestion.points or 0))
        tbl = _answer_table_for(q.question_type)
        if tbl is not None:
            by_table.setdefault(tbl, set()).add(q.name)
        if q.question_type in CODE_TABLE_TYPES:
            code_names.add(q.name)
        if interaction_events_for(q.question_type):
            interaction_names.add(q.name)
        if q.question_type == "page":
            reading_rows.append(q)
        if is_select_question(q):
            select_questions.append(q)

    def subset(names):
        return {name: tallies[name] for name in names}

    for tbl, names in by_table.items():
        await _guarded(
            tbl.__tablename__,
            _answer_table_stats(tbl, subset(names), course, instructor_list),
        )
    if code_names:
        await _guarded(
            "code", _code_table_stats(subset(code_names), course, instructor_list)
        )
    if interaction_names:
        await _guarded(
            "interactions",
            _interaction_stats(interaction_names, tallies, course, instructor_ids),
        )
    if reading_rows:
        await _guarded(
            "readings", _reading_stats(reading_rows, tallies, course, instructor_ids)
        )
    if select_questions:
        answered = await _guarded(
            "selectquestions",
            _select_question_answered_sids(select_questions, course, instructor_ids),
        )
        for name, sids in (answered or {}).items():
            tallies[name].answered.update(sids)
    # Last: it fills in correct_count for every question the answer tables
    # did not.
    await _guarded(
        "question_grades", _question_grade_stats(tallies, course, instructor_list)
    )

    questions: List[GraderQuestionStats] = []
    for row in rows:
        q = row.Question
        aq = row.AssignmentQuestion
        tally = tallies[q.name]
        questions.append(
            GraderQuestionStats(
                id=q.id,
                name=q.name,
                question_type=q.question_type,
                htmlsrc=q.htmlsrc,
                points=tally.max_points,
                autograde=aq.autograde,
                which_to_grade=aq.which_to_grade,
                answered_count=len(tally.answered),
                total_attempts=tally.total_attempts,
                correct_count=tally.correct_count or 0,
                graded_count=tally.graded_count,
                average_score=round(tally.average_score, 2),
                avg_percent=tally.avg_percent,
            )
        )

    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "assignment": {
                "id": assignment.id,
                "name": assignment.name,
                "description": assignment.description,
                "duedate": (
                    assignment.duedate.isoformat() if assignment.duedate else None
                ),
                "points": assignment.points,
            },
            "questions": [q.dict() for q in questions],
        },
    )


@router.get("/questions/answers")
@instructor_role_required()
async def list_question_answers(
    request: Request,
    assignment_id: int = Query(...),
    question_id: int = Query(...),
    user=Depends(auth_manager),
):
    """Return the most-recent answer for every student in the course, excluding
    instructors.

    Students who never submitted are included with ``attempts`` of 0 and no
    answer: an instructor still has to see them to record a zero, and the grading
    page marks them "No submission" rather than pretending the class is smaller
    than it is.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    rows = await fetch_assignment_questions(assignment_id)
    question = None
    max_points = 0
    for row in rows:
        if row.Question.id == question_id:
            question = row.Question
            max_points = row.AssignmentQuestion.points or 0
            break
    if question is None:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Question not in assignment"
        )

    students = await fetch_users_for_course(course.course_name)
    instructor_ids = {
        u.username for u in await fetch_course_instructors(course.course_name)
    }
    student_map = {s.username: s for s in students if s.username not in instructor_ids}

    # A selectquestion stores the grade under the wrapper but the answer under
    # whichever question the student was actually served, so it has to be
    # resolved per student or the whole class reads as "No submission" on a
    # question that has already been graded.  See issue #1481.
    resolved = await resolve_for_class(
        question, student_map.keys(), basecourse=course.base_course
    )
    # Which div_id holds this student's work, and which answer table it is in.
    scoring_div = {sid: r.div_id for sid, r in resolved.items()}
    if resolved:
        by_type: dict = {}
        for r in resolved.values():
            by_type.setdefault(r.question_type, set()).add(r.div_id)
    else:
        by_type = {question.question_type: {question.name}}

    def _wanted(sid: str, div_id: str) -> bool:
        """True when this row belongs to the question this student was served."""
        return sid in student_map and scoring_div.get(sid, question.name) == div_id

    answers: List[GraderStudentAnswer] = []
    latest_by_sid: dict = {}
    attempt_counts: dict = {}
    answer_source: dict = {}

    for qtype, div_ids in by_type.items():
        tbl = _answer_table_for(qtype)
        if tbl is not None:
            async with async_session() as session:
                q = (
                    select(tbl)
                    .where(
                        and_(
                            tbl.div_id.in_(div_ids),
                            tbl.course_name == course.course_name,
                        )
                    )
                    .order_by(tbl.sid, tbl.timestamp.desc())
                )
                res = await session.execute(q)
                for a in res.scalars():
                    if not _wanted(a.sid, a.div_id):
                        continue
                    attempt_counts[a.sid] = attempt_counts.get(a.sid, 0) + 1
                    if a.sid not in latest_by_sid:
                        latest_by_sid[a.sid] = a
                        answer_source[a.sid] = "answer_table"

        interaction_events = interaction_events_for(qtype)
        if interaction_events:
            # No answer table: the student's "answer" is the interaction itself,
            # so show the most recent one rather than an empty list of students.
            for div_id in div_ids:
                for u in await fetch_interaction_useinfo(
                    div_id, course.course_name, interaction_events
                ):
                    if not _wanted(u.sid, div_id) or not is_interaction_event(
                        u.event, u.act
                    ):
                        continue
                    attempt_counts[u.sid] = attempt_counts.get(u.sid, 0) + 1
                    # Rows arrive oldest first, so keep overwriting to end on
                    # the latest.
                    latest_by_sid[u.sid] = u
                    answer_source[u.sid] = "useinfo"

        if qtype in CODE_TABLE_TYPES:
            async with async_session() as session:
                q = (
                    select(Code)
                    .where(
                        and_(
                            Code.acid.in_(div_ids),
                            Code.course_id == course.id,
                        )
                    )
                    .order_by(Code.sid, Code.timestamp.desc())
                )
                res = await session.execute(q)
                for c in res.scalars():
                    if not _wanted(c.sid, c.acid):
                        continue
                    attempt_counts[c.sid] = attempt_counts.get(c.sid, 0) + 1
                    if c.sid not in latest_by_sid:
                        latest_by_sid[c.sid] = c
                        answer_source[c.sid] = "code_table"

    # One query for the whole class rather than one per student: the roster is
    # the loop bound now, not the (usually shorter) list of submitters.
    grades_by_sid: dict = {}
    async with async_session() as session:
        res = await session.execute(
            select(QuestionGrade)
            .where(
                and_(
                    QuestionGrade.div_id == question.name,
                    QuestionGrade.course_name == course.course_name,
                )
            )
            .order_by(QuestionGrade.id)
        )
        # Ordered by id, so the last row written for a sid is the newest.
        for g in res.scalars():
            grades_by_sid[g.sid] = g

    for sid, stu in student_map.items():
        row = latest_by_sid.get(sid)
        grade = grades_by_sid.get(sid)
        served = resolved.get(sid)

        if row is None:
            answer_text = None
            correct_val = None
            percent_val = None
        elif answer_source.get(sid) == "code_table":
            answer_text = row.code or ""
            correct_val = None
            percent_val = None
        elif answer_source.get(sid) == "useinfo":
            answer_text = describe_interaction(row.event, row.act)
            correct_val = None
            percent_val = None
        else:
            answer_text = _answer_text(getattr(row, "answer", ""))
            correct_val = bool(row.correct) if hasattr(row, "correct") else None
            percent_val = (
                float(row.percent)
                if hasattr(row, "percent") and row.percent is not None
                else None
            )

        answers.append(
            GraderStudentAnswer(
                sid=sid,
                first_name=getattr(stu, "first_name", None),
                last_name=getattr(stu, "last_name", None),
                email=getattr(stu, "email", None),
                answer=answer_text,
                correct=correct_val,
                percent=percent_val,
                timestamp=(
                    row.timestamp.isoformat()
                    if row is not None and row.timestamp
                    else None
                ),
                # 0 attempts is what marks a student as never having submitted.
                attempts=attempt_counts.get(sid, 0),
                score=float(grade.score) if grade and grade.score is not None else None,
                # The bookkeeping words the graders write among themselves are
                # not a comment; the grading page would otherwise open with
                # "autograded" sitting in the instructor's comment box.
                comment=display_comment(grade.comment) if grade else None,
                hand_graded=bool(grade and is_hand_graded(grade.comment)),
                max_points=max_points,
                selected_div_id=served.div_id if served else None,
                selected_question_type=served.question_type if served else None,
                selected_htmlsrc=served.htmlsrc if served else None,
            )
        )

    answers.sort(key=lambda x: ((x.last_name or ""), (x.first_name or ""), x.sid))

    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "question": {
                "id": question.id,
                "name": question.name,
                "question_type": question.question_type,
                "htmlsrc": question.htmlsrc,
                "max_points": max_points,
            },
            "answers": [a.dict() for a in answers],
        },
    )


@router.get("/questions/history")
@instructor_role_required()
async def get_student_answer_history(
    request: Request,
    assignment_id: int = Query(...),
    question_id: int = Query(...),
    sid: str = Query(...),
    user=Depends(auth_manager),
):
    """Return every attempt a student made on a particular question so the
    instructor can detect brute-force behaviour.
    """
    course = await fetch_course(user.course_name)

    rows = await fetch_assignment_questions(assignment_id)
    question = None
    for row in rows:
        if row.Question.id == question_id:
            question = row.Question
            break
    if question is None:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Question not in assignment"
        )

    # See issue #1481: a selectquestion keeps its answers under the question the
    # student was served, not under the wrapper named by the assignment.
    served = await resolve_one(question, sid, basecourse=course.base_course)
    tbl = _answer_table_for(served.question_type)
    history: List[GraderAnswerHistoryItem] = []

    if tbl is not None:
        async with async_session() as session:
            q = (
                select(tbl)
                .where(
                    and_(
                        tbl.div_id == served.div_id,
                        tbl.course_name == course.course_name,
                        tbl.sid == sid,
                    )
                )
                .order_by(tbl.timestamp.asc())
            )
            res = await session.execute(q)
            for a in res.scalars():
                raw_answer = getattr(a, "answer", None)

                if isinstance(raw_answer, (dict, list)):
                    answer_val: Any = raw_answer
                else:
                    answer_val = "" if raw_answer is None else str(raw_answer)
                history.append(
                    GraderAnswerHistoryItem(
                        id=a.id,
                        answer=answer_val,
                        correct=bool(a.correct) if hasattr(a, "correct") else None,
                        percent=(
                            float(a.percent)
                            if hasattr(a, "percent") and a.percent is not None
                            else None
                        ),
                        timestamp=a.timestamp.isoformat() if a.timestamp else None,
                        source=(
                            str(getattr(a, "source", "") or "")
                            if hasattr(a, "source")
                            else None
                        ),
                        min_height=getattr(a, "min_height", None),
                        drag_width=getattr(a, "drag_width", None),
                        drop_width=getattr(a, "drop_width", None),
                    )
                )

    interaction_events = interaction_events_for(served.question_type)
    if interaction_events:
        # The submissions are the useinfo rows themselves, so build the timeline
        # from them rather than leaving the history empty.
        for u in await fetch_interaction_useinfo(
            served.div_id, course.course_name, interaction_events, sid=sid
        ):
            if not is_interaction_event(u.event, u.act):
                continue
            history.append(
                GraderAnswerHistoryItem(
                    id=u.id,
                    answer=describe_interaction(u.event, u.act),
                    correct=None,
                    percent=None,
                    timestamp=u.timestamp.isoformat() if u.timestamp else None,
                    source="useinfo",
                )
            )

    if served.question_type in CODE_TABLE_TYPES:
        async with async_session() as session:
            q = (
                select(Code)
                .where(
                    and_(
                        Code.acid == served.div_id,
                        Code.course_id == course.id,
                        Code.sid == sid,
                    )
                )
                .order_by(Code.timestamp.asc())
            )
            res = await session.execute(q)
            for c in res.scalars():
                history.append(
                    GraderAnswerHistoryItem(
                        id=c.id,
                        answer=c.code or "",
                        correct=None,
                        percent=None,
                        timestamp=c.timestamp.isoformat() if c.timestamp else None,
                        source="code_table",
                    )
                )

    history.sort(key=lambda h: h.timestamp or "")

    async with async_session() as session:
        # For a selectquestion both names appear in useinfo -- the wrapper logs
        # the selection, the served question logs the work -- so show both.
        div_ids = {question.name, served.div_id}
        q = (
            select(Useinfo)
            .where(
                and_(
                    Useinfo.div_id.in_(div_ids),
                    Useinfo.course_id == course.course_name,
                    Useinfo.sid == sid,
                )
            )
            .order_by(Useinfo.timestamp.asc())
        )
        res = await session.execute(q)
        useinfo_rows = [
            {
                "id": u.id,
                "timestamp": u.timestamp.isoformat() if u.timestamp else None,
                "event": u.event,
                "act": u.act,
            }
            for u in res.scalars()
        ]

    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "history": [h.dict() for h in history],
            "useinfo": useinfo_rows,
        },
    )


async def _assignments_to_recompute(course, payload: GradeUpdatePayload):
    """Resolve which assignment(s) the just-saved question grade rolls up into.

    Prefers the ``assignment_id`` the client sent. Without one, fall back to every
    assignment in this course that contains ``div_id`` -- a question can be used in
    more than one assignment, and recomputing a total is idempotent, so touching
    each of them is safer than guessing a single winner.
    """
    if payload.assignment_id is not None:
        assignment = await fetch_one_assignment(payload.assignment_id)
        if assignment and assignment.course == course.id:
            return [assignment]
        return []

    async with async_session() as session:
        res = await session.execute(
            select(AssignmentQuestion.assignment_id)
            .join(Question, AssignmentQuestion.question_id == Question.id)
            .join(Assignment, AssignmentQuestion.assignment_id == Assignment.id)
            .where(
                and_(
                    Question.name == payload.div_id,
                    Assignment.course == course.id,
                )
            )
            .distinct()
        )
        assignment_ids = [row for row in res.scalars()]

    assignments = []
    for aid in assignment_ids:
        assignment = await fetch_one_assignment(aid)
        if assignment:
            assignments.append(assignment)
    return assignments


@router.post("/grade")
@instructor_role_required()
async def upsert_grade(
    payload: GradeUpdatePayload, request: Request, user=Depends(auth_manager)
):
    """Create or update a QuestionGrade row for a student on a given question.
    The comment is stored alongside the score.

    After the per-question grade is written the student's assignment total is
    rolled up. Skipping that roll-up left ``grades.score`` stale after every
    manual grade or hand-edit of an autograded score, so the gradebook, the
    student's own progress page and the LTI score pushed to the LMS all kept
    showing the pre-grading total.
    """
    course = await fetch_course(user.course_name)
    existing = await fetch_question_grade(
        payload.sid, course.course_name, payload.div_id
    )
    # Whatever the instructor typed -- or, when they typed nothing, the marker
    # that says a human set this score. Saving the autograder's own placeholder
    # back would leave the row looking auto-graded, and the next submission or
    # re-grade would throw the grade away.
    comment = instructor_comment(payload.comment)

    if existing is None:
        await create_question_grade_entry(
            payload.sid, course.course_name, payload.div_id, int(payload.score)
        )
    else:
        await update_question_grade_entry(
            payload.sid,
            course.course_name,
            payload.div_id,
            int(payload.score),
            qge_id=existing.id,
        )

    async with async_session() as session:
        q = select(QuestionGrade).where(
            and_(
                QuestionGrade.sid == payload.sid,
                QuestionGrade.course_name == course.course_name,
                QuestionGrade.div_id == payload.div_id,
            )
        )
        res = await session.execute(q)
        row = res.scalars().first()
        if row is not None:
            row.score = payload.score
            row.comment = comment
            await session.commit()

    # Roll the new question grade up into the assignment total (and push the new
    # total to the course's LMS). recompute_totals_detail honors a pinned
    # manual_total and applies the assignment threshold.
    recomputed = []
    # The student's new total for each assignment, so a page showing it can
    # update without a reload.
    totals = {}
    for assignment in await _assignments_to_recompute(course, payload):
        try:
            changes = await recompute_totals_detail(
                course, assignment, [payload.sid], instructor_triggered=True
            )
            recomputed.append(assignment.id)
            for change in changes:
                totals[assignment.id] = change.new_score
        except Exception as e:  # pragma: no cover - defensive
            # A failed roll-up must not lose the grade the instructor just typed.
            rslogger.error(
                f"Failed to recompute total sid={payload.sid} "
                f"assignment={assignment.id}: {e}"
            )

    rslogger.info(
        f"Grader saved grade sid={payload.sid} div={payload.div_id} "
        f"score={payload.score} recomputed={recomputed}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "score": payload.score,
            "comment": display_comment(comment) or "",
            "sid": payload.sid,
            "div_id": payload.div_id,
            "recomputed_assignments": recomputed,
            "totals": totals,
        },
    )


class RegradeRequest(BaseModel):
    assignment_id: int
    question_ids: List[int]
    sids: List[str] = []
    overwrite_manual: bool = False
    enforce_deadline: bool = True
    recompute_totals: bool = True
    resend_all_scores_via_lti: bool = False
    which_to_grade_override: Optional[str] = None


async def _build_regrade_inputs(course, assignment, req: RegradeRequest):
    """Resolve the requested question ids and student ids into the objects the
    regrade service needs. Returns (questions, sids) or raises ValueError."""
    rows = await fetch_assignment_questions(assignment.id)
    by_id = {row.Question.id: row for row in rows}
    questions = []
    for qid in req.question_ids:
        row = by_id.get(qid)
        if row is None:
            raise ValueError(f"Question {qid} is not part of this assignment")
        questions.append((row.Question, row.AssignmentQuestion))

    instructor_ids = {
        u.username for u in await fetch_course_instructors(course.course_name)
    }
    if req.sids:
        sids = [s for s in req.sids if s not in instructor_ids]
    else:
        students = await fetch_users_for_course(course.course_name)
        sids = [s.username for s in students if s.username not in instructor_ids]
    return questions, sids


@router.post("/regrade/preview")
@instructor_role_required()
async def regrade_preview(
    payload: RegradeRequest, request: Request, user=Depends(auth_manager)
):
    """Dry-run a re-grade and return the before/after diff without writing."""
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )
    try:
        questions, sids = await _build_regrade_inputs(course, assignment, payload)
    except ValueError as e:
        return make_json_response(status=status.HTTP_404_NOT_FOUND, detail=str(e))

    options = RegradeOptions(
        overwrite_manual=payload.overwrite_manual,
        enforce_deadline=payload.enforce_deadline,
        recompute_totals=payload.recompute_totals,
        resend_all_scores_via_lti=payload.resend_all_scores_via_lti,
        which_to_grade_override=payload.which_to_grade_override,
    )
    report = await regrade_batch(
        course, sids, questions, assignment, options, dry_run=True
    )
    return make_json_response(status=status.HTTP_200_OK, detail=report.dict())


@router.post("/regrade")
@instructor_role_required()
async def regrade_run(
    payload: RegradeRequest, request: Request, user=Depends(auth_manager)
):
    """Run the re-grade across the student x question matrix and persist the
    results, optionally recomputing assignment totals and pushing to the LMS.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )
    try:
        questions, sids = await _build_regrade_inputs(course, assignment, payload)
    except ValueError as e:
        return make_json_response(status=status.HTTP_404_NOT_FOUND, detail=str(e))

    options = RegradeOptions(
        overwrite_manual=payload.overwrite_manual,
        enforce_deadline=payload.enforce_deadline,
        recompute_totals=payload.recompute_totals,
        resend_all_scores_via_lti=payload.resend_all_scores_via_lti,
        which_to_grade_override=payload.which_to_grade_override,
    )
    report = await regrade_batch(
        course,
        sids,
        questions,
        assignment,
        options,
        dry_run=False,
        instructor_triggered=True,
    )
    rslogger.info(
        f"Regrade run by {user.username} assignment={assignment.id} "
        f"total={report.total} changed={report.changed} errors={report.errors}"
    )
    return make_json_response(status=status.HTTP_200_OK, detail=report.dict())


class RecomputeTotalsRequest(BaseModel):
    assignment_id: int
    sids: List[str] = []
    push_unchanged: bool = False


@router.post("/recompute_totals")
@instructor_role_required()
async def recompute_totals(
    payload: RecomputeTotalsRequest, request: Request, user=Depends(auth_manager)
):
    """Recompute assignment totals (and push to the LMS) for the given students.

    ``POST /grade`` already rolls up the total for the one student it graded;
    this is the bulk form, for repairing a whole roster at once.

    Only totals that actually moved are sent to the LMS. ``push_unchanged``
    resends every student's current total instead, to repair an LMS gradebook
    that has drifted out of agreement with Runestone's.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    instructor_ids = {
        u.username for u in await fetch_course_instructors(course.course_name)
    }
    sids = [s for s in payload.sids if s not in instructor_ids]

    processed = await recompute_totals_for(
        course,
        assignment,
        sids,
        instructor_triggered=True,
        push_unchanged=payload.push_unchanged,
    )
    rslogger.info(
        f"Recompute totals by {user.username} assignment={assignment.id} "
        f"students={processed}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={"assignment_id": assignment.id, "students": processed},
    )


class ReleaseRequest(BaseModel):
    assignment_id: int
    released: bool


@router.post("/release")
@instructor_role_required()
async def set_assignment_released(
    payload: ReleaseRequest, request: Request, user=Depends(auth_manager)
):
    """Release or hide an assignment's grades to students by flipping the
    Assignment.released flag. When released is False, the student-facing read
    path hides scores (see the doAssignment template and the student dashboard).

    Releasing also sends every student's current total to the course's LMS.
    ``released`` is the same flag that gates LTI passback, so grades entered
    while the assignment was hidden -- the whole point of hiding it -- were
    dropped by the 1.1 and 1.3 senders at the time. Nothing else would ever
    resend them: a later recompute finds the totals already correct in
    Runestone and skips them as unchanged.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    was_released = assignment.released
    await update_assignment_released(assignment.id, payload.released)

    pushed = 0
    if payload.released and not was_released:
        # Re-read so the roll-up sees released=True and the senders let the
        # scores through; ``assignment`` above still holds the old flag.
        assignment = await fetch_one_assignment(assignment.id)
        try:
            changes = await recompute_totals_detail(
                course,
                assignment,
                instructor_triggered=True,
                only_existing=True,
                push_unchanged=True,
            )
            # ``only_existing`` keeps a student who never submitted from having
            # a zero materialised and sent to the LMS; those rows come back
            # flagged and are the only ones the push skips here.
            pushed = len([c for c in changes if not c.skipped_no_grade_row])
        except Exception as e:  # pragma: no cover - defensive
            # An LMS that is down must not leave the assignment unreleased in
            # Runestone. The instructor's repair hatch is POST
            # /recompute_totals with push_unchanged.
            rslogger.error(
                f"Release of assignment {assignment.id} could not push grades "
                f"to the LMS: {e}"
            )

    rslogger.info(
        f"Grades {'released' if payload.released else 'hidden'} by {user.username} "
        f"assignment={assignment.id} lms_pushed={pushed}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "assignment_id": assignment.id,
            "released": payload.released,
            "lms_pushed": pushed,
        },
    )


class ThresholdRequest(BaseModel):
    assignment_id: int
    threshold_pct: Optional[float] = None


@router.post("/threshold")
@instructor_role_required()
async def set_assignment_threshold(
    payload: ThresholdRequest, request: Request, user=Depends(auth_manager)
):
    """Set an assignment's threshold scoring percentage (a fraction in 0..1).

    When a positive threshold is set, the AB recompute roll-up awards full
    points to any student whose earned fraction exceeds it. A null or zero
    threshold disables threshold scoring (recompute then uses the raw
    per-question sum). This mirrors the legacy web2py threshold rule.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    if payload.threshold_pct is not None and not (0 <= payload.threshold_pct <= 1):
        return make_json_response(
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="threshold_pct must be a fraction between 0 and 1",
        )

    await update_assignment_threshold(assignment.id, payload.threshold_pct)
    rslogger.info(
        f"Threshold set by {user.username} assignment={assignment.id} "
        f"threshold_pct={payload.threshold_pct}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "assignment_id": assignment.id,
            "threshold_pct": payload.threshold_pct,
        },
    )


class ManualTotalRequest(BaseModel):
    assignment_id: int
    sid: str
    score: Optional[float] = None
    manual: bool = True


@router.post("/manual_total")
@instructor_role_required()
async def set_manual_assignment_total(
    payload: ManualTotalRequest, request: Request, user=Depends(auth_manager)
):
    """Override or revert a student's assignment total.

    With manual True the given score is stored and pinned: recompute_totals_for
    will preserve it instead of rolling up the per-question grades. With manual
    False the pin is cleared and the total is recomputed from the per-question
    grades.
    """
    course = await fetch_course(user.course_name)
    assignment = await fetch_one_assignment(payload.assignment_id)
    if not assignment or assignment.course != course.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    student = await fetch_user(payload.sid)
    if not student or not student.id:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND, detail="Student not found"
        )

    if payload.manual:
        if payload.score is None:
            return make_json_response(
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="score is required when manual is true",
            )
        grade = await set_manual_total(
            student.id, assignment.id, course.course_name, payload.score, True
        )
        if assignment.released:
            await attempt_lti_score_updates(
                assignment,
                course.id,
                [(student.id, payload.score)],
                force=True,
                instructor_triggered=True,
            )
        rslogger.info(
            f"Manual total set by {user.username} assignment={assignment.id} "
            f"sid={payload.sid} score={payload.score}"
        )
        return make_json_response(
            status=status.HTTP_200_OK,
            detail={
                "assignment_id": assignment.id,
                "sid": payload.sid,
                "score": grade.score,
                "manual_total": True,
            },
        )

    existing = await fetch_grade(student.id, assignment.id)
    preserved = existing.score if existing and existing.score is not None else 0
    await set_manual_total(
        student.id, assignment.id, course.course_name, preserved, False
    )
    await recompute_totals_for(
        course, assignment, [payload.sid], instructor_triggered=True
    )
    recomputed = await fetch_grade(student.id, assignment.id)
    rslogger.info(
        f"Manual total reverted by {user.username} assignment={assignment.id} "
        f"sid={payload.sid}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "assignment_id": assignment.id,
            "sid": payload.sid,
            "score": recomputed.score if recomputed else None,
            "manual_total": False,
        },
    )


def _format_score(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(round(value, 2))


def _display_score(score: float, points: float, show_points: bool) -> float:
    """The number to display for a score: the raw points, or the percent of what
    the assignment was worth. An assignment worth nothing has no meaningful
    percent, so its raw score is reported either way.
    """
    if show_points or not points:
        return score
    return round(score / points * 100, 2)


class GradebookContractModel(BaseModel):
    """Strict base for the public React gradebook data contract."""

    model_config = ConfigDict(extra="forbid")


class GradebookAssignmentResponse(GradebookContractModel):
    id: int
    name: str
    points: float
    duedate: str | None = None
    released: bool
    kind: Literal["assignment", "practice"] = "assignment"


class GradebookStudentResponse(GradebookContractModel):
    sid: str
    name: str
    sort_name: str
    email: str | None = None


class GradebookCellResponse(GradebookContractModel):
    sid: str
    assignment_id: int
    score: float | None = None
    released: bool
    manual_total: bool


class GradebookDataResponse(GradebookContractModel):
    assignments: list[GradebookAssignmentResponse]
    students: list[GradebookStudentResponse]
    cells: list[GradebookCellResponse]
    averages: dict[str, float | None]
    show_points: bool


class GradebookEnvelopeResponse(GradebookContractModel):
    detail: GradebookDataResponse


def _gradebook_to_csv(data: dict) -> str:
    """Render the gradebook as CSV in the same units the on-screen gradebook uses:
    a percent of each assignment's points, or raw points when the course has set
    the ``show_points`` attribute.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    assignments = data["assignments"]
    show_points = bool(data.get("show_points"))

    def column_name(assignment: dict) -> str:
        if show_points:
            return f"{assignment['name']} ({_format_score(assignment['points'])} pts)"
        return f"{assignment['name']} (%)"

    writer.writerow(
        ["Username", "Student", "Email"]
        + [column_name(a) for a in assignments]
        + ["Total" if show_points else "Total (%)"]
    )
    scores = {
        (cell["sid"], cell["assignment_id"]): cell["score"] for cell in data["cells"]
    }
    for student in data["students"]:
        # The username leads the row: instructors key their own grading scripts off
        # it, and display names are neither unique nor stable. See issue #1477.
        row = [student["sid"], student["name"], student.get("email") or ""]
        earned = 0.0
        possible = 0.0
        graded = False
        for assignment in assignments:
            score = scores.get((student["sid"], assignment["id"]))
            if score is None:
                row.append("")
                continue
            points = assignment["points"] or 0
            row.append(_format_score(_display_score(score, points, show_points)))
            earned += score
            possible += points
            graded = True
        # The total is a percent of only the assignments this student was graded
        # on, so ungraded work does not read as a zero.
        row.append(
            _format_score(_display_score(earned, possible, show_points))
            if graded
            else ""
        )
        writer.writerow(row)
    return output.getvalue()


@router.get("/gradebook/data", response_model=GradebookEnvelopeResponse)
@instructor_role_required()
async def get_gradebook(request: Request, user=Depends(auth_manager)):
    """Return the gradebook matrix (assignments x students) for the caller's
    course: assignments, students, per-cell scores, and per-assignment averages.

    Served under ``/gradebook/data`` (not ``/gradebook``) so the single-segment
    SPA deep link ``/grader/gradebook`` falls through to the React app instead of
    being shadowed by this JSON endpoint.
    """
    data = GradebookDataResponse.model_validate(await fetch_gradebook(user.course_name))
    return GradebookEnvelopeResponse(detail=data)


@router.get("/gradebook.csv")
@instructor_role_required()
async def get_gradebook_csv(request: Request, user=Depends(auth_manager)):
    """Stream the gradebook as a CSV download (one row per student, one column
    per assignment plus a total column).
    """
    data = await fetch_gradebook(user.course_name)
    content = _gradebook_to_csv(data)
    safe_course = "".join(
        c if c.isalnum() or c in ("-", "_") else "-" for c in user.course_name
    )
    filename = f"gradebook-{safe_course}.csv"
    rslogger.info(
        f"Gradebook CSV exported by {user.username} course={user.course_name}"
    )
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class GradebookUnitsRequest(BaseModel):
    show_points: bool


@router.post("/gradebook/units")
@instructor_role_required()
async def set_gradebook_units(
    payload: GradebookUnitsRequest, request: Request, user=Depends(auth_manager)
):
    """Switch this course's gradebook between percentages and raw points.

    This writes the same ``show_points`` course attribute the course settings page
    edits, so it is a course-wide setting rather than a per-instructor view
    preference. LTI 1.3 grade passback reads the same attribute to decide whether
    it sends points or a score out of 100.
    """
    course = await fetch_course(user.course_name)
    await update_course_settings(
        course.id, "show_points", "true" if payload.show_points else "false"
    )
    rslogger.info(
        f"Gradebook units set by {user.username} course={course.course_name} "
        f"show_points={payload.show_points}"
    )
    return make_json_response(
        status=status.HTTP_200_OK, detail={"show_points": payload.show_points}
    )
