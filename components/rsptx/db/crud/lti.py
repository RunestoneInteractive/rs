from typing import List
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from ..models import (
    Lti1p3Conf,
    Lti1p3ConfValidator,
    Lti1p3Course,
    Lti1p3CourseValidator,
    Lti1p3User,
    Lti1p3UserValidator,
    Lti1p3Assignment,
    Lti1p3AssignmentValidator,
    Assignment,
    CoursesValidator,
)
from ..async_session import async_session


# -----------------------------------------------------------------------
# LTI 1.3
async def upsert_lti1p3_config(config: Lti1p3Conf) -> Lti1p3Conf:
    """
    Insert or update an LTI1.3 platform config.
    issuer and client_id must be provided. If they match an existing record,
    all other fields are optional and only need to be provided if they are to be updated.
    """
    async with async_session() as session:
        query = select(Lti1p3Conf).where(
            (Lti1p3Conf.issuer == config.issuer)
            & (Lti1p3Conf.client_id == config.client_id)
        )
        res = await session.execute(query)
        existing_conf = res.scalars().one_or_none()
        await session.commit()
        if existing_conf:
            existing_conf.update_from_dict(config.dict())
            # Validate now that we have built full object
            Lti1p3ConfValidator.from_orm(existing_conf)
            ret = existing_conf
        else:
            Lti1p3ConfValidator.from_orm(config)  # validate data
            session.add(config)
            ret = config
        await session.commit()
        return ret


async def fetch_lti1p3_config(id: int) -> Lti1p3Conf:
    """
    Retrieve an LTI1.3 platform configuration
    """
    query = select(Lti1p3Conf).where((Lti1p3Conf.id == id))
    async with async_session() as session:
        res = await session.execute(query)
        conf = res.scalars().one_or_none()
        return conf


async def fetch_lti1p3_config_by_lti_data(issuer: str, client_id: str) -> Lti1p3Conf:
    """
    Retrieve an LTI1.3 platform config by issuer and client_id.
    """
    query = select(Lti1p3Conf).where(
        (Lti1p3Conf.issuer == issuer) & (Lti1p3Conf.client_id == client_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        conf = res.scalars().one_or_none()
        return conf


async def upsert_lti1p3_course(course: Lti1p3Course) -> Lti1p3Course:
    """
    Insert or update an LTI1.3 course.

    rs_course_id must be provided and will be used to identify the record to update.
    all other fields are optional and only need to be provided if they are to be updated.
    """
    async with async_session() as session:
        query = select(Lti1p3Course).where(
            (Lti1p3Course.rs_course_id == course.rs_course_id)
        )
        res = await session.execute(query)
        existing_course = res.scalars().one_or_none()
        await session.commit()
        if existing_course:
            existing_course.update_from_dict(course.dict())
            # Validate now that we have built full object
            Lti1p3CourseValidator.from_orm(existing_course)
            ret = existing_course
        else:
            Lti1p3CourseValidator.from_orm(course)
            session.add(course)
            ret = course
        await session.commit()
        return ret


async def delete_lti1p3_course(rs_course_id: int) -> int:
    """
    Delete an LTI1.3 course mapping by the rs_course_id it is associated with
    """
    query = delete(Lti1p3Course).where(Lti1p3Course.rs_course_id == rs_course_id)
    async with async_session() as session:
        res = await session.execute(query)
        await session.commit()
        return res.rowcount


async def fetch_lti1p3_course(
    id: int, with_config: bool = True, with_rs_course: bool = False
) -> Lti1p3Course:
    """
    Retrieve an LTI1.3 course by its id
    Also optionally fetches the associated Lti1p3Conf and/or RS Course
    """
    query = select(Lti1p3Course).where(Lti1p3Course.id == id)
    if with_config:
        query = query.options(joinedload(Lti1p3Course.lti_config))
    if with_rs_course:
        query = query.options(joinedload(Lti1p3Course.rs_course))
    async with async_session() as session:
        res = await session.execute(query)
        course = res.scalars().one_or_none()
        return course


async def fetch_lti1p3_course_by_rs_course(
    rs_course: CoursesValidator, with_config: bool = True
) -> Lti1p3Course:
    """
    Retrieve an LTI1.3 platform config by its id
    Also optionally fetches the associated Lti1p3Conf and/or Course
    """
    query = select(Lti1p3Course).where(Lti1p3Course.rs_course_id == rs_course.id)
    if with_config:
        query = query.options(joinedload(Lti1p3Course.lti_config))
    async with async_session() as session:
        res = await session.execute(query)
        course = res.scalars().one_or_none()
        return course


async def fetch_lti1p3_course_by_id(
    id: int, with_config: bool = True, with_rs_course: bool = False
) -> Lti1p3Course:
    """
    Retrieve an LTI1.3 platform config by its id
    Also optionally fetches the associated Lti1p3Conf and/or Course
    """
    query = select(Lti1p3Course).where(Lti1p3Course.id == id)
    if with_config:
        query = query.options(joinedload(Lti1p3Course.lti_config))
    if with_rs_course:
        query = query.options(joinedload(Lti1p3Course.rs_course))
    async with async_session() as session:
        res = await session.execute(query)
        dep = res.scalars().one_or_none()
        return dep


async def fetch_lti1p3_course_by_lti_id(
    lti_id: str, with_config: bool = True, with_rs_course: bool = False
) -> Lti1p3Course:
    """
    Retrieve an LTI1.3 platform config by its lti identifier
    Also optionally fetches the associated Lti1p3Conf and/or Course
    """
    query = select(Lti1p3Course).where(Lti1p3Course.lti1p3_course_id == lti_id)
    if with_config:
        query = query.options(joinedload(Lti1p3Course.lti_config))
    if with_rs_course:
        query = query.options(joinedload(Lti1p3Course.rs_course))
    async with async_session() as session:
        res = await session.execute(query)
        dep = res.scalars().one_or_none()
        return dep


async def fetch_lti1p3_course_by_lti_data(
    issuer: str, client_id: str, deploy_id: str, with_config: bool = True
) -> Lti1p3Course:
    """
    Retrieve an LTI1.3 platform config by issuer and client_id.
    Also fetches the associated Lti1p3Conf
    """
    query = (
        select(Lti1p3Course)
        .join(Lti1p3Conf)
        .where(
            (Lti1p3Conf.issuer == issuer)
            & (Lti1p3Conf.client_id == client_id)
            & (Lti1p3Course.deployment_id == deploy_id)
        )
    )
    if with_config:
        query = query.options(joinedload(Lti1p3Course.lti_config))
    async with async_session() as session:
        res = await session.execute(query)
        dep = res.scalars().one_or_none()
        return dep


async def upsert_lti1p3_user(user: Lti1p3User) -> Lti1p3User:
    """
    Insert or update an LTI1.3 user mapping for a particular course
    """
    async with async_session() as session:
        query = select(Lti1p3User).where(
            (Lti1p3User.lti1p3_course_id == user.lti1p3_course_id)
            & (Lti1p3User.rs_user_id == user.rs_user_id)
        )
        res = await session.execute(query)
        existing_user = res.scalars().one_or_none()
        await session.commit()
        if existing_user:
            # never should never need to update lti_user_id
            return existing_user
        else:
            new_user = Lti1p3User(
                lti1p3_course_id=user.lti1p3_course_id,
                rs_user_id=user.rs_user_id,
                lti_user_id=user.lti_user_id,
            )
            Lti1p3UserValidator.from_orm(new_user)
            session.add(new_user)
            await session.commit()
            return new_user


async def fetch_lti1p3_user(rs_user_id: int, lti1p3_course_id: int) -> Lti1p3User:
    """
    Retrieve a user's LTI1.3 mapping for a particular course
    """
    query = select(Lti1p3User).where(
        (Lti1p3User.rs_user_id == rs_user_id)
        & (Lti1p3User.lti1p3_course_id == lti1p3_course_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        user = res.scalars().one_or_none()
        return user


async def fetch_lti1p3_users_for_course(
    lti1p3_course_id: int, with_rsuser: bool = True
) -> List[Lti1p3User]:
    """
    Retrieve all LTI1.3 user mapping for a particular course
    """
    query = select(Lti1p3User).where((Lti1p3User.lti1p3_course_id == lti1p3_course_id))
    if with_rsuser:
        query = query.options(joinedload(Lti1p3User.rs_user))
    async with async_session() as session:
        res = await session.execute(query)
        users = res.scalars().all()
        return users


async def upsert_lti1p3_assignment(assignment: Lti1p3Assignment) -> Lti1p3Assignment:
    """
    Insert or update an LTI1.3 assignment mapping.
    """
    async with async_session() as session:
        query = select(Lti1p3Assignment).where(
            (Lti1p3Assignment.lti1p3_course_id == assignment.lti1p3_course_id)
            & (Lti1p3Assignment.rs_assignment_id == assignment.rs_assignment_id)
        )
        res = await session.execute(query)
        existing_assignment = res.scalars().one_or_none()
        await session.commit()
        if existing_assignment:
            existing_assignment.update_from_dict(assignment.dict())
            # Validate now that we have built full object
            Lti1p3AssignmentValidator.from_orm(existing_assignment)
            ret = existing_assignment
        else:
            new_assignment = Lti1p3Assignment(
                lti1p3_course_id=assignment.lti1p3_course_id,
                rs_assignment_id=assignment.rs_assignment_id,
                lti_lineitem_id=assignment.lti_lineitem_id,
            )
            Lti1p3AssignmentValidator.from_orm(new_assignment)
            session.add(new_assignment)
            ret = new_assignment
        await session.commit()
        return ret


async def fetch_lti1p3_assignments_by_rs_assignment_id(
    rs_assignment_id: int,
) -> Lti1p3Assignment:
    """
    Retrieve an LTI1.3 assignment mapping. There may be more than record as one RS course
    might be mapped to multiple different LTI assignments.
    """
    query = select(Lti1p3Assignment).where(
        (Lti1p3Assignment.rs_assignment_id == rs_assignment_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        assignment = res.scalars().all()
        return assignment


async def fetch_lti1p3_assignments_by_rs_course_id(
    rs_course_id: int,
) -> List[Lti1p3Assignment]:
    """
    Retrieve all LTI1.3 assignment mappings for a course
    """
    query = (
        select(Lti1p3Assignment)
        .join(Assignment)
        .where((Assignment.course == rs_course_id))
    )
    async with async_session() as session:
        res = await session.execute(query)
        assignments = res.scalars().all()
        return assignments


async def fetch_lti1p3_grading_data_for_assignment(
    rs_assignment_id: int,
) -> Lti1p3Assignment:
    """
    Fetch data needed to submit grades for a particular assignment
    """
    async with async_session() as session:
        query = (
            select(Lti1p3Assignment)
            .join(Lti1p3Course, Lti1p3Course.id == Lti1p3Assignment.lti1p3_course_id)
            .where(Lti1p3Assignment.rs_assignment_id == rs_assignment_id)
            .options(
                joinedload(Lti1p3Assignment.rs_assignment),
                joinedload(Lti1p3Assignment.lti1p3_course),
                joinedload(Lti1p3Assignment.lti1p3_course).joinedload(
                    Lti1p3Course.lti_config
                ),
                joinedload(Lti1p3Assignment.lti1p3_course).joinedload(
                    Lti1p3Course.rs_course
                ),
            )
        )
        res = await session.execute(query)
        assign = res.scalars().one_or_none()
        return assign


# /LTI 1.3
# -----------------------------------------------------------------------
