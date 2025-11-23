from typing import List
from sqlalchemy import select, func, and_
from sqlalchemy.orm import aliased

from ..models import Useinfo
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
