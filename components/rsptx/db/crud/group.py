from sqlalchemy import select, and_
from ..models import AuthGroup, AuthMembership, EditorBasecourse
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


async def is_author(userid: int) -> bool:
    """
    Checks if a user is an author.

    :param userid: The ID of the user to check.
    :type userid: int
    :return: True if the user is an author, False otherwise.
    :rtype: bool
    """
    ed = await fetch_group("author")
    row = await fetch_membership(ed.id, userid)

    if row:
        return True
    else:
        return False


async def is_editor(userid: int) -> bool:
    """
    Checks if a user is an editor.

    :param userid: The ID of the user to check.
    :type userid: int
    :return: True if the user is an editor, False otherwise.
    :rtype: bool
    """
    ed = await fetch_group("editor")
    row = await fetch_membership(ed.id, userid)

    if row:
        return True
    else:
        return False


async def create_editor_for_basecourse(user_id: int, bc_name: str) -> EditorBasecourse:
    """
    Creates a new editor for a given basecourse.

    :param user_id: The ID of the user creating the editor.
    :type user_id: int
    :param bc_name: The name of the basecourse for which the editor is being created.
    :type bc_name: str
    :return: The newly created editor for the basecourse.
    :rtype: EditorBasecourse
    """
    new_ed = EditorBasecourse(editor=user_id, base_course=bc_name)
    async with async_session.begin() as session:
        session.add(new_ed)
    return new_ed
