"""
Tests for user CRUD operations.
"""

import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import fetch_user, create_user, update_user, delete_user
from rsptx.db.models import AuthUserValidator

TEST_USERNAME = "crud_test_user"


@pytest.fixture(scope="session")
async def new_user(init_test_db):
    """Create a transient test user; delete on teardown."""
    user = await create_user(
        AuthUserValidator(
            username=TEST_USERNAME,
            first_name="Crud",
            last_name="Tester",
            password="testpass",
            email="crud_test_user@example.com",
            course_name="overview",
            course_id=1,
            donated=False,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2024, 1, 1),
            modified_on=datetime.datetime(2024, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )
    yield user
    await delete_user(TEST_USERNAME)


async def test_fetch_seeded_user(test_user):
    """testuser1 must exist after seed."""
    assert test_user is not None
    assert test_user.username == "testuser1"


async def test_create_user(new_user):
    """Created user is returned with an id."""
    assert new_user is not None
    assert new_user.id is not None
    assert new_user.username == TEST_USERNAME


async def test_fetch_created_user(new_user):
    """Fetching by username returns the user we created."""
    fetched = await fetch_user(TEST_USERNAME)
    assert fetched is not None
    assert fetched.username == TEST_USERNAME
    assert fetched.email == "crud_test_user@example.com"


async def test_update_user(new_user):
    """Updating the email persists."""
    await update_user(new_user.id, {"email": "updated@example.com"})
    fetched = await fetch_user(TEST_USERNAME)
    assert fetched.email == "updated@example.com"


async def test_fetch_nonexistent_user():
    """Fetching a missing user returns None-wrapped validator (not an exception)."""
    result = await fetch_user("this_user_does_not_exist_xyz")
    # from_orm(None) yields a validator whose fields are all None
    assert result is None or result.username is None


def _user_kwargs(username, registration_id):
    return AuthUserValidator(
        username=username,
        first_name="Fallback",
        last_name="Tester",
        password="testpass",
        email=f"{username}@example.com",
        course_name="overview",
        course_id=1,
        donated=False,
        active=True,
        accept_tcp=True,
        created_on=datetime.datetime(2024, 1, 1),
        modified_on=datetime.datetime(2024, 1, 1),
        registration_key="",
        registration_id=registration_id,
        reset_password_key="",
    )


@pytest.fixture
async def duplicate_registration_users(init_test_db):
    """Two accounts sharing one registration_id, as legacy LTI rows can."""
    shared = "shared_reg_id@example.com"
    older = await create_user(_user_kwargs("fallback_user_older", shared))
    newer = await create_user(_user_kwargs("fallback_user_newer", shared))
    yield older, newer
    await delete_user("fallback_user_older")
    await delete_user("fallback_user_newer")


async def test_fallback_finds_user_by_registration_id(duplicate_registration_users):
    """A name that matches no username falls back to registration_id."""
    fetched = await fetch_user(
        "shared_reg_id@example.com", fallback_to_registration=True
    )
    assert fetched is not None
    assert fetched.username == "fallback_user_older"


async def test_fallback_on_duplicates_prefers_oldest(duplicate_registration_users):
    """Duplicate registration_ids must not raise; the oldest account wins."""
    older, _newer = duplicate_registration_users
    fetched = await fetch_user(
        "shared_reg_id@example.com", fallback_to_registration=True
    )
    assert fetched.id == older.id


async def test_fallback_ignores_blank_username(new_user):
    """A blank name must not match the many users with registration_id=''."""
    result = await fetch_user("", fallback_to_registration=True)
    assert result is None or result.username is None


async def test_fallback_off_does_not_match_registration_id(
    duplicate_registration_users,
):
    """Without the flag, registration_id is never consulted."""
    result = await fetch_user("shared_reg_id@example.com")
    assert result is None or result.username is None


async def test_create_duplicate_user_raises(new_user):
    """Creating a user with a duplicate username must raise HTTPException."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await create_user(
            AuthUserValidator(
                username=TEST_USERNAME,
                first_name="Dup",
                last_name="User",
                password="testpass",
                email="dup@example.com",
                course_name="overview",
                course_id=1,
                donated=False,
                active=True,
                accept_tcp=True,
                created_on=datetime.datetime(2024, 1, 1),
                modified_on=datetime.datetime(2024, 1, 1),
                registration_key="",
                registration_id="",
                reset_password_key="",
            )
        )
