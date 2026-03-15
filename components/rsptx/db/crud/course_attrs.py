from sqlalchemy import select

from ..models import CourseAttribute, Courses
from ..async_session import async_session
from rsptx.logging import rslogger


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
            rslogger.debug(f"copy_course_attributes: {row.attr}={row.value}")
            new_attr = CourseAttribute(
                course_id=new_course_id, attr=row.attr, value=row.value
            )
            session.add(new_attr)
        await session.commit()


async def get_course_origin(base_course: str):
    """
    Retrieve the origin (markup system) of a given course by its name.

    :param base_course: str, the name of the base course (i.e. ``courses.course_name``)
    :return: str, the value of the ``markup_system`` course attribute, or None if not found
    """
    query = (
        select(CourseAttribute)
        .join(Courses, Courses.id == CourseAttribute.course_id)
        .where(
            (Courses.course_name == base_course)
            & (CourseAttribute.attr == "markup_system")
        )
    )

    async with async_session() as session:
        res = await session.execute(query)
        ca = res.scalars().first()
        return ca.value if ca else None
