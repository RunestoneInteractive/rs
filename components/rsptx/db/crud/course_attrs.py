from sqlalchemy import select

from ..models import CourseAttribute
from ..async_session import async_session


async def fetch_all_course_attributes(course_id: int) -> dict:
    """
    Retrieve all attributes and their values for a given course (course_id)

    :param course_id: int, the id of the course
    :return: dict, a dictionary containing all course attributes and their values
    """
    query = select(CourseAttribute).where(CourseAttribute.course_id == course_id)

    async with async_session() as session:
        res = await session.execute(query)
        return {row.attr: row.value for row in res.scalars().fetchall()}


async def fetch_one_course_attribute():
    """
    Fetch a single course attribute (not implemented)

    :raises: NotImplementedError
    """
    raise NotImplementedError()


async def create_course_attribute(course_id: int, attr: str, value: str):
    """
    Create a new course attribute for a given course (course_id)

    :param course_id: int, the id of the course
    :param attr: str, the attribute name
    :param value: str, the attribute value
    """
    new_attr = CourseAttribute(course_id=course_id, attr=attr, value=value)
    async with async_session.begin() as session:
        session.add(new_attr)


async def copy_course_attributes(basecourse_id: int, new_course_id: int):
    """
    Copy all course attributes from a base course to a new course
    """
    query = select(CourseAttribute).where(CourseAttribute.course_id == basecourse_id)
    async with async_session() as session:
        res = await session.execute(query)
        for row in res.scalars().fetchall():
            print(row.attr, row.value)
            new_attr = CourseAttribute(
                course_id=new_course_id, attr=row.attr, value=row.value
            )
            session.add(new_attr)
        await session.commit()


async def get_course_origin(base_course):
    """
    Retrieve the origin of a given course (base_course)

    :param base_course: str, the name of the base course
    :return: str, the origin of the course
    """
    query = select(CourseAttribute).where(
        (CourseAttribute.course_id == base_course)
        & (CourseAttribute.attr == "markup_system")
    )

    async with async_session() as session:
        res = await session.execute(query)
        ca = res.scalars().first()
        return ca.value
