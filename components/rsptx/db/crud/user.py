from typing import Optional
from pydal.validators import CRYPT
from sqlalchemy import select, update, delete
from fastapi import HTTPException
from ..models import (
    AuthUser,
    Code,
    Useinfo,
    AuthUserValidator,
    runestone_component_dict,
    DeadlineException,
)
from ..async_session import async_session
from rsptx.configuration import settings
from rsptx.response_helpers.core import http_422error_detail
from rsptx.logging import rslogger


# auth_user
# ---------
async def fetch_user(
    user_name: str, fallback_to_registration: bool = False
) -> AuthUserValidator:
    """
    Retrieve a user by their username (user_name)

    fallback_to_registration is for LTI logins to match accounts with usernames that have
    been modified.
    If user_name is not found, try to find the user by their registration_id (initial id).

    :param user_name: str, the username of the user
    :return: AuthUserValidator, the AuthUserValidator object representing the user
    """
    query = select(AuthUser).where(AuthUser.username == user_name)
    async with async_session() as session:
        res = await session.execute(query)
        user = res.scalars().one_or_none()
        if not user and fallback_to_registration:
            fallback_query = select(AuthUser).where(
                AuthUser.registration_id == user_name
            )
            res = await session.execute(fallback_query)
            user = res.scalars().one_or_none()
    return AuthUserValidator.from_orm(user)


async def create_user(user: AuthUserValidator) -> Optional[AuthUserValidator]:
    """
    The given user will have the password in plain text.  First we will hash
    the password then add this user to the database.

    :param user: AuthUserValidator, the AuthUserValidator object representing the user to be created
    :return: Optional[AuthUserValidator], the newly created AuthUserValidator object if successful, None otherwise
    """
    if await fetch_user(user.username):
        raise HTTPException(
            status_code=422,
            detail=http_422error_detail(
                ["body", "username"], "duplicate username", "integrity_error"
            ),
        )

    new_user = AuthUser(**user.dict())
    crypt = CRYPT(key=settings.web2py_private_key, salt=True)
    new_user.password = str(crypt(user.password)[0])
    async with async_session.begin() as session:
        session.add(new_user)
    return AuthUserValidator.from_orm(new_user)


async def update_user(user_id: int, new_vals: dict):
    """
    Update a user's information by their id (user_id)

    :param user_id: int, the id of the user
    :param new_vals: dict, a dictionary containing the new values to be updated
    """
    if "password" in new_vals:
        crypt = CRYPT(key=settings.web2py_private_key, salt=True)
        new_vals["password"] = str(crypt(new_vals["password"])[0])
    stmt = update(AuthUser).where((AuthUser.id == user_id)).values(**new_vals)
    async with async_session.begin() as session:
        await session.execute(stmt)
    rslogger.debug("SUCCESS")


async def delete_user(username):
    """
    Delete a user by their username (username)

    :param username: str, the username of the user to be deleted
    """
    # We do not have foreign key constraints on the username in the answer tables
    # so delete all of the rows matching the username schedule for deletion
    stmt_list = []
    for tbl, item in runestone_component_dict.items():
        stmt = delete(item.model).where(item.model.sid == username)
        stmt_list.append(stmt)

    delcode = delete(Code).where(Code.sid == username)
    deluse = delete(Useinfo).where(Useinfo.sid == username)
    deluser = delete(AuthUser).where(AuthUser.username == username)
    delaccommodations = delete(DeadlineException).where(
        DeadlineException.sid == username
    )
    async with async_session.begin() as session:
        for stmt in stmt_list:
            await session.execute(stmt)
        await session.execute(delcode)
        await session.execute(deluse)
        await session.execute(delaccommodations)
        await session.execute(deluser)
        # This will delete many other things as well based on the CASECADING
        # foreign keys
