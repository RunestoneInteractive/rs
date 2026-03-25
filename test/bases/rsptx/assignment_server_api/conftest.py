"""
Assignment-server-specific test fixtures.

All clients use httpx.AsyncClient + ASGITransport so the server runs in the
same asyncio event loop as the test session, avoiding asyncpg "attached to a
different loop" errors.

``auth_assignment_client`` — authenticated as testuser1 (student).
``instructor_user``         — a seeded instructor user with CourseInstructor row.
``auth_instructor_client``  — auth_manager patched to return the instructor user.
"""

import datetime
import pytest_asyncio
import httpx
from unittest.mock import AsyncMock, patch


@pytest_asyncio.fixture(scope="session")
async def auth_assignment_client(student_user):
    """Async HTTP client for the assignment server authenticated as testuser1."""
    from rsptx.assignment_server_api.core import app
    from rsptx.auth.session import auth_manager

    app.dependency_overrides[auth_manager] = lambda: student_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(auth_manager, None)


@pytest_asyncio.fixture(scope="session")
async def instructor_user(init_test_db):
    """
    Create a test instructor user assigned to test_course_1, with a
    CourseInstructor row so that is_instructor() returns True for real.
    """
    from rsptx.db.crud import (
        create_user,
        fetch_user,
        fetch_course,
        create_course_instructor,
    )
    from rsptx.db.models import AuthUserValidator

    course = await fetch_course("test_course_1")

    existing = await fetch_user("test_instructor")
    if existing:
        return existing

    user = await create_user(
        AuthUserValidator(
            username="test_instructor",
            first_name="Test",
            last_name="Instructor",
            password="xxx",
            email="test_instructor@example.com",
            course_name="test_course_1",
            course_id=course.id,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1),
            modified_on=datetime.datetime(2020, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )
    await create_course_instructor(course.id, user.id)
    return user


@pytest_asyncio.fixture(scope="session")
async def auth_instructor_client(instructor_user):
    """
    Async HTTP client for the assignment server authenticated as test_instructor.

    Some routes use @instructor_role_required() (which calls auth_manager() directly
    inside the decorator, bypassing FastAPI DI), while others use Depends(auth_manager).
    We cover both by:
      1. Patching rsptx.endpoint_validators.core.auth_manager for the decorator path.
      2. Setting app.dependency_overrides[auth_manager] for the Depends() path.
    """
    from rsptx.assignment_server_api.core import app
    from rsptx.auth.session import auth_manager

    mock_auth = AsyncMock(return_value=instructor_user)
    app.dependency_overrides[auth_manager] = lambda: instructor_user
    transport = httpx.ASGITransport(app=app)
    with patch("rsptx.endpoint_validators.core.auth_manager", mock_auth):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    app.dependency_overrides.pop(auth_manager, None)
