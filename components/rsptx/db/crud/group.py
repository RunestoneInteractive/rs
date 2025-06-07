from sqlalchemy import select, and_
from ..models import AuthGroup, AuthMembership
from ..async_session import async_session


async def fetch_group(group_name):
    """
    Retrieve a group by its name (group_name)

    :param group_name: str, the name of the group
    :return: AuthGroup, the AuthGroup object representing the group
    """
    query = select(AuthGroup).where(AuthGroup.role == group_name)  # noqa: E712
    async with async_session() as session:
        res = await session.execute(query)
        # the result type of this query is a sqlalchemy CursorResult
        # .all will return a list of Rows
        ret = res.scalars().first()
        # the result of .scalars().first() is a single Library object

        return ret


async def create_group(group_name):
    """
    Create a new group with the given name (group_name)

    :param group_name: str, the name of the group to be created
    :return: AuthGroup, the newly created AuthGroup object
    """
    new_group = AuthGroup(role=group_name)
    async with async_session.begin() as session:
        session.add(new_group)
    return new_group


async def fetch_membership(group_id, user_id):
    """
    Retrieve a membership record by the group id (group_id) and user id (user_id)

    :param group_id: int, the id of the group
    :param user_id: int, the id of the user
    :return: AuthMembership, the AuthMembership object representing the membership record
    """
    query = select(AuthMembership).where(
        and_(AuthMembership.group_id == group_id, AuthMembership.user_id == user_id)
    )  # noqa: E712
    async with async_session() as session:
        res = await session.execute(query)
        # the result type of this query is a sqlalchemy CursorResult
        # .all will return a list of Rows
        ret = res.scalars().first()
        # the result of .scalars().first() is a single Library object

        return ret


async def create_membership(group_id, user_id):
    """
    Create a new membership record with the given group id (group_id) and user id (user_id)

    :param group_id: int, the id of the group
    :param user_id: int, the id of the user
    :return: AuthMembership, the newly created AuthMembership object
    """
    new_mem = AuthMembership(user_id=user_id, group_id=group_id)
    async with async_session.begin() as session:
        session.add(new_mem)
    return new_mem
