#
# Select Question Support
# -----------------------

from typing import Optional
from sqlalchemy import select, update

from ..models import SelectedQuestion, SelectedQuestionValidator
from ..async_session import async_session
from rsptx.logging import rslogger


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
