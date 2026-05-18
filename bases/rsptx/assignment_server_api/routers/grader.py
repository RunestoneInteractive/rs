from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_

from rsptx.auth.session import auth_manager
from rsptx.db.async_session import async_session
from rsptx.db.crud import (
    fetch_assignment_questions,
    fetch_course,
    fetch_course_instructors,
    fetch_one_assignment,
    fetch_question_grade,
    fetch_users_for_course,
    create_question_grade_entry,
    update_question_grade_entry,
)
from rsptx.db.models import (
    Code,
    QuestionGrade,
    Useinfo,
    runestone_component_dict,
)
from rsptx.endpoint_validators import instructor_role_required
from rsptx.logging import rslogger
from rsptx.response_helpers.core import make_json_response


router = APIRouter(
    prefix="/instructor/grader",
    tags=["grader"],
)


QTYPE_TO_TABLE = {
    "mchoice": "mchoice_answers",
    "fillintheblank": "fitb_answers",
    "parsonsprob": "parsons_answers",
    "activecode": "unittest_answers",
    "actex": "unittest_answers",
    "shortanswer": "shortanswer_answers",
    "clickablearea": "clickablearea_answers",
    "dragndrop": "dragndrop_answers",
    "codelens": "codelens_answers",
    "matching": "matching_answers",
    "webwork": "webwork_answers",
    "hparsons": "microparsons_answers",
    "microparsons": "microparsons_answers",
    "splice": "splice_answers",
}


CODE_TABLE_TYPES = {"activecode", "actex", "codelens"}


def _answer_table_for(question_type: str):
    table_name = QTYPE_TO_TABLE.get(question_type)
    if not table_name:
        return None
    rcd = runestone_component_dict.get(table_name)
    if not rcd:
        return None
    return rcd.model


class GraderQuestionStats(BaseModel):
    id: int
    name: str
    question_type: str
    htmlsrc: Optional[str] = None
    points: int
    autograde: Optional[str] = None
    which_to_grade: Optional[str] = None

    answered_count: int

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
    max_points: int = 0


class GraderAnswerHistoryItem(BaseModel):
    id: int

    answer: Optional[Any] = None
    correct: Optional[bool] = None
    percent: Optional[float] = None
    timestamp: Optional[str] = None
    source: Optional[str] = None


class GradeUpdatePayload(BaseModel):
    sid: str
    div_id: str
    score: float
    comment: Optional[str] = ""


@router.get("/assignments/{assignment_id}/questions")
@instructor_role_required()
async def list_assignment_questions(
    assignment_id: int, request: Request, user=Depends(auth_manager)
):
    """Return the list of questions in the assignment along with aggregate
    student answer statistics. Only non-instructor answers are counted.
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

    rows = await fetch_assignment_questions(assignment_id)

    row_list = [r for r in rows]
    questions: List[GraderQuestionStats] = []
    instructor_list = list(instructor_ids) if instructor_ids else []
    for row in row_list:
        q = row.Question
        aq = row.AssignmentQuestion
        tbl = _answer_table_for(q.question_type)

        answered_count = 0
        correct_count = 0
        graded_count = 0
        average_score = 0.0
        avg_percent: Optional[float] = None
        max_points = aq.points or 0

        try:
            async with async_session() as session:

                base_clauses = []
                latest_ids_q = None
                if tbl is not None:
                    base_clauses = [
                        tbl.div_id == q.name,
                        tbl.course_name == course.course_name,
                    ]
                    if instructor_list:
                        base_clauses.append(tbl.sid.notin_(instructor_list))
                    latest_ids_q = (
                        select(func.max(tbl.id))
                        .where(and_(*base_clauses))
                        .group_by(tbl.sid)
                    )

                answered_sids: set = set()
                if tbl is not None:
                    res = await session.execute(
                        select(func.distinct(tbl.sid)).where(and_(*base_clauses))
                    )
                    answered_sids.update(s for (s,) in res.all() if s)

                if q.question_type in CODE_TABLE_TYPES:
                    code_clauses = [
                        Code.acid == q.name,
                        Code.course_id == course.id,
                    ]
                    if instructor_list:
                        code_clauses.append(Code.sid.notin_(instructor_list))
                    res = await session.execute(
                        select(func.distinct(Code.sid)).where(and_(*code_clauses))
                    )
                    answered_sids.update(s for (s,) in res.all() if s)

                answered_count = len(answered_sids)

                if (
                    tbl is not None
                    and hasattr(tbl, "correct")
                    and latest_ids_q is not None
                ):
                    last_correct_clauses = [tbl.id.in_(latest_ids_q)]
                    if hasattr(tbl, "percent"):
                        last_correct_clauses.append(
                            or_(
                                tbl.correct == True,  # noqa: E712
                                tbl.percent >= 1.0,
                            )
                        )
                    else:
                        last_correct_clauses.append(tbl.correct == True)  # noqa: E712
                    res = await session.execute(
                        select(func.count(func.distinct(tbl.sid))).where(
                            and_(*last_correct_clauses)
                        )
                    )
                    correct_count = int(res.scalar() or 0)
                else:

                    if max_points > 0:
                        qg_clauses = [
                            QuestionGrade.div_id == q.name,
                            QuestionGrade.course_name == course.course_name,
                            QuestionGrade.score != None,  # noqa: E711
                            QuestionGrade.score >= float(max_points),
                        ]
                        if instructor_list:
                            qg_clauses.append(QuestionGrade.sid.notin_(instructor_list))
                        res = await session.execute(
                            select(func.count(func.distinct(QuestionGrade.sid))).where(
                                and_(*qg_clauses)
                            )
                        )
                        correct_count = int(res.scalar() or 0)

                if (
                    tbl is not None
                    and hasattr(tbl, "percent")
                    and latest_ids_q is not None
                ):
                    res = await session.execute(
                        select(func.avg(tbl.percent)).where(
                            and_(
                                tbl.id.in_(latest_ids_q),
                                tbl.percent != None,  # noqa: E711
                            )
                        )
                    )
                    val = res.scalar()
                    if val is not None:
                        avg_percent = round(float(val), 4)

                qg_base = [
                    QuestionGrade.div_id == q.name,
                    QuestionGrade.course_name == course.course_name,
                    QuestionGrade.score != None,  # noqa: E711
                ]
                if instructor_list:
                    qg_base.append(QuestionGrade.sid.notin_(instructor_list))

                res = await session.execute(
                    select(
                        func.avg(QuestionGrade.score),
                        func.count(func.distinct(QuestionGrade.sid)),
                    ).where(and_(*qg_base))
                )
                row_avg = res.first()
                if row_avg is not None:
                    avg_val, gcount = row_avg
                    average_score = float(avg_val) if avg_val is not None else 0.0
                    graded_count = int(gcount or 0)
        except Exception as e:  # pragma: no cover - defensive
            rslogger.error(f"Grader stats failed for question {q.name}: {e}")

        questions.append(
            GraderQuestionStats(
                id=q.id,
                name=q.name,
                question_type=q.question_type,
                htmlsrc=q.htmlsrc,
                points=max_points,
                autograde=aq.autograde,
                which_to_grade=aq.which_to_grade,
                answered_count=answered_count,
                correct_count=correct_count,
                graded_count=graded_count,
                average_score=round(average_score, 2),
                avg_percent=avg_percent,
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
    """Return the most-recent answer for every student (excluding instructors)
    that submitted something for this question.
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

    tbl = _answer_table_for(question.question_type)
    students = await fetch_users_for_course(course.course_name)
    instructor_ids = {
        u.username for u in await fetch_course_instructors(course.course_name)
    }
    student_map = {s.username: s for s in students if s.username not in instructor_ids}

    answers: List[GraderStudentAnswer] = []
    latest_by_sid: dict = {}
    attempt_counts: dict = {}
    answer_source: dict = {}

    if tbl is not None:
        async with async_session() as session:
            q = (
                select(tbl)
                .where(
                    and_(
                        tbl.div_id == question.name,
                        tbl.course_name == course.course_name,
                    )
                )
                .order_by(tbl.sid, tbl.timestamp.desc())
            )
            res = await session.execute(q)
            for a in res.scalars():
                if a.sid not in student_map:
                    continue
                attempt_counts[a.sid] = attempt_counts.get(a.sid, 0) + 1
                if a.sid not in latest_by_sid:
                    latest_by_sid[a.sid] = a
                    answer_source[a.sid] = "answer_table"

    if question.question_type in CODE_TABLE_TYPES:
        async with async_session() as session:
            q = (
                select(Code)
                .where(
                    and_(
                        Code.acid == question.name,
                        Code.course_id == course.id,
                    )
                )
                .order_by(Code.sid, Code.timestamp.desc())
            )
            res = await session.execute(q)
            for c in res.scalars():
                if c.sid not in student_map:
                    continue
                attempt_counts[c.sid] = attempt_counts.get(c.sid, 0) + 1
                if c.sid not in latest_by_sid:
                    latest_by_sid[c.sid] = c
                    answer_source[c.sid] = "code_table"

    for sid, row in latest_by_sid.items():
        stu = student_map.get(sid)
        grade = await fetch_question_grade(sid, course.course_name, question.name)

        if answer_source.get(sid) == "code_table":
            answer_text = row.code or ""
            correct_val = None
            percent_val = None
        else:
            answer_text = str(getattr(row, "answer", "") or "")
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
                timestamp=row.timestamp.isoformat() if row.timestamp else None,
                attempts=attempt_counts.get(sid, 1),
                score=float(grade.score) if grade and grade.score is not None else None,
                comment=grade.comment if grade else None,
                max_points=max_points,
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

    tbl = _answer_table_for(question.question_type)
    history: List[GraderAnswerHistoryItem] = []

    if tbl is not None:
        async with async_session() as session:
            q = (
                select(tbl)
                .where(
                    and_(
                        tbl.div_id == question.name,
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
                    )
                )

    if question.question_type in CODE_TABLE_TYPES:
        async with async_session() as session:
            q = (
                select(Code)
                .where(
                    and_(
                        Code.acid == question.name,
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
        q = (
            select(Useinfo)
            .where(
                and_(
                    Useinfo.div_id == question.name,
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


@router.post("/grade")
@instructor_role_required()
async def upsert_grade(
    payload: GradeUpdatePayload, request: Request, user=Depends(auth_manager)
):
    """Create or update a QuestionGrade row for a student on a given question.
    The comment is stored alongside the score.
    """
    course = await fetch_course(user.course_name)
    existing = await fetch_question_grade(
        payload.sid, course.course_name, payload.div_id
    )

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
            row.comment = payload.comment or ""
            await session.commit()

    rslogger.info(
        f"Grader saved grade sid={payload.sid} div={payload.div_id} score={payload.score}"
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "score": payload.score,
            "comment": payload.comment or "",
            "sid": payload.sid,
            "div_id": payload.div_id,
        },
    )
