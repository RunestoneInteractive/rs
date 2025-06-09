import logging
import datetime
from typing import List
from sqlalchemy import select, and_, func, text

from ..models import (
    Useinfo,
    UseinfoValidation,
    CoursesValidator,
    Code,
    CodeValidator,
    runestone_component_dict,
)
from ..async_session import async_session
from rsptx.validation import schemas
from .crud import EVENT2TABLE

rslogger = logging.getLogger(__name__)


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
