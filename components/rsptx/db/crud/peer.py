from typing import List, Optional, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.orm import aliased
from datetime import datetime

from ..models import Useinfo, MchoiceAnswers
from ..async_session import async_session


async def get_peer_votes(div_id: str, course_name: str, voting_stage: int):
    """
    Provide the answers for a peer instruction multiple choice question.
    What percent of students chose each option. This is used for the Review page of Peer Instruction questions.
    """
    # Subquery to get the latest vote for each student
    subquery = (
        select(func.max(Useinfo.id).label("max_id"))
        .where(
            (Useinfo.event == "mChoice")
            & (Useinfo.course_id == course_name)
            & (Useinfo.div_id == div_id)
            & Useinfo.act.like(f"%vote{voting_stage}")
        )
        # Group by student ID to get each student's latest vote
        .group_by(Useinfo.sid)
        .subquery()
    )

    # Querying the Useinfo table for every student's latest votes using the subquery
    query = (
        select(Useinfo.act)
        .join(subquery, Useinfo.id == subquery.c.max_id)
        .order_by(Useinfo.id.desc())
    )

    async with async_session() as session:
        result = await session.execute(query)
        ans = result.scalars().all()

    if ans:
        return {"acts": ans}
    else:
        return {"acts": []}


async def fetch_last_useinfo_peergroup(course_name: str) -> List[Useinfo]:
    """
    Fetch the last peergroup entry for each student in the given course.

    :param course_name: str, the name of the course
    :return: List[Useinfo], a list of Useinfo objects
    """
    async with async_session.begin() as session:
        # Aliases for the Useinfo table
        u1 = aliased(Useinfo)
        u2 = aliased(Useinfo)

        # Subquery to get the last entry for each student
        subquery = (
            select(u2.sid, func.max(u2.timestamp).label("last_entry"))
            .filter(and_(u2.course_id == course_name, u2.event == "peergroup"))
            .group_by(u2.sid)
            .subquery()
        )

        # Main query to join the subquery and get the last entry details
        query = (
            select(u1)
            .join(
                subquery,
                (u1.sid == subquery.c.sid) & (u1.timestamp == subquery.c.last_entry),
            )
            .filter(and_(u1.course_id == course_name, u1.event == "peergroup"))
        )

        # Execute the query
        results = await session.execute(query)
        return results.scalars().all()


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


async def fetch_recent_student_answers(
    div_id: str, course_name: str, start_time: datetime, limit: int = 4000
) -> List[Tuple[str, str, str]]:
    """
    Fetch the most recent answer for each student for a given question.

    :param div_id: str, the question div_id
    :param course_name: str, the course name
    :param start_time: datetime, only fetch answers after this time
    :param limit: int, maximum number of results to return
    :return: List[Tuple[str, str, str]], list of (sid, answer, correct) tuples
    """
    async with async_session() as session:
        # Get the most recent answer for each student
        subquery = (
            select(
                MchoiceAnswers.sid,
                MchoiceAnswers.answer,
                MchoiceAnswers.correct,
                func.row_number()
                .over(
                    partition_by=MchoiceAnswers.sid,
                    order_by=MchoiceAnswers.id.desc(),
                )
                .label("rn"),
            )
            .where(
                MchoiceAnswers.div_id == div_id,
                MchoiceAnswers.course_name == course_name,
                MchoiceAnswers.timestamp > start_time,
            )
            .subquery()
        )

        query = select(subquery).where(subquery.c.rn == 1).limit(limit)
        result = await session.execute(query)
        rows = result.all()

        return [(row.sid, row.answer, row.correct) for row in rows if row.answer]


async def fetch_student_answers_in_timerange(
    div_id: str,
    course_name: str,
    start_time: datetime,
    end_time: Optional[datetime] = None,
    limit: int = 4000,
) -> List[Tuple[str, str]]:
    """
    Fetch the most recent answer for each student within a time range.

    :param div_id: str, the question div_id
    :param course_name: str, the course name
    :param start_time: datetime, only fetch answers after this time
    :param end_time: Optional[datetime], only fetch answers before this time
    :param limit: int, maximum number of results to return
    :return: List[Tuple[str, str]], list of (sid, answer) tuples
    """
    async with async_session() as session:
        subquery = select(
            MchoiceAnswers.sid,
            MchoiceAnswers.answer,
            func.row_number()
            .over(
                partition_by=MchoiceAnswers.sid,
                order_by=MchoiceAnswers.id.desc(),
            )
            .label("rn"),
        ).where(
            MchoiceAnswers.div_id == div_id,
            MchoiceAnswers.course_name == course_name,
            MchoiceAnswers.timestamp > start_time,
        )

        if end_time:
            subquery = subquery.where(MchoiceAnswers.timestamp < end_time)

        subquery = subquery.subquery()
        query = select(subquery).where(subquery.c.rn == 1).limit(limit)
        result = await session.execute(query)
        rows = result.all()

        return [(row.sid, row.answer) for row in rows if row.answer]


async def count_distinct_student_answers(
    div_id: str, course_name: str, start_time: datetime
) -> int:
    """
    Count distinct students who answered a question after a given time.

    :param div_id: str, the question div_id
    :param course_name: str, the course name
    :param start_time: datetime, only count answers after this time
    :return: int, count of distinct students
    """
    async with async_session() as session:
        query = select(func.count(func.distinct(MchoiceAnswers.sid))).where(
            MchoiceAnswers.div_id == div_id,
            MchoiceAnswers.course_name == course_name,
            MchoiceAnswers.timestamp > start_time,
        )
        result = await session.execute(query)
        return result.scalar() or 0


async def count_peer_messages(
    div_id: str, course_name: str, start_time: datetime
) -> int:
    """
    Count messages sent during peer instruction for a question.

    :param div_id: str, the question div_id
    :param course_name: str, the course name
    :param start_time: datetime, only count messages after this time
    :return: int, count of messages
    """
    async with async_session() as session:
        query = select(func.count(Useinfo.id)).where(
            Useinfo.div_id == div_id,
            Useinfo.course_id == course_name,
            Useinfo.event == "sendmessage",
            Useinfo.timestamp > start_time,
        )
        result = await session.execute(query)
        return result.scalar() or 0
