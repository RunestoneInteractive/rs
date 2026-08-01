"""
Admin-server-specific test fixtures.

``editor_user``          — a seeded user in the ``editor`` group who edits the
                           ``overview`` base course.
``auth_editor_client``   — auth_manager patched to return that editor.
``auth_noneditor_client``— authenticated as testuser1, who is not an editor.

Routes decorated with @editor_role_required() call auth_manager() directly
inside the decorator -- not via FastAPI's Depends() -- so the clients patch
auth_manager at the endpoint_validators module level as well as overriding the
Depends() path.
"""

import datetime
import httpx
import pytest_asyncio
from unittest.mock import AsyncMock, patch


@pytest_asyncio.fixture(scope="session")
async def editor_user(init_test_db):
    """Create a user who is a member of the editor group for ``overview``."""
    from rsptx.db.crud import (
        create_editor_for_basecourse,
        create_group,
        create_membership,
        create_user,
        fetch_course,
        fetch_group,
        fetch_user,
    )
    from rsptx.db.models import AuthUserValidator

    existing = await fetch_user("test_editor")
    if existing:
        return existing

    course = await fetch_course("overview")
    user = await create_user(
        AuthUserValidator(
            username="test_editor",
            first_name="Test",
            last_name="Editor",
            password="xxx",
            email="test_editor@example.com",
            course_name="overview",
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
    group = await fetch_group("editor")
    if group is None:
        group = await create_group("editor")
    await create_membership(group.id, user.id)
    await create_editor_for_basecourse(user.id, "overview")
    return user


def _client_for(user):
    """Build an httpx client for the admin server authenticated as ``user``."""
    from rsptx.admin_server_api.core import app
    from rsptx.auth.session import auth_manager

    mock_auth = AsyncMock(return_value=user)
    app.dependency_overrides[auth_manager] = lambda: user
    transport = httpx.ASGITransport(app=app)
    return app, auth_manager, mock_auth, transport


@pytest_asyncio.fixture
async def auth_editor_client(editor_user):
    """Async HTTP client for the admin server authenticated as test_editor."""
    app, auth_manager, mock_auth, transport = _client_for(editor_user)
    with patch("rsptx.endpoint_validators.core.auth_manager", mock_auth):
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            yield client
    app.dependency_overrides.pop(auth_manager, None)


@pytest_asyncio.fixture
async def auth_noneditor_client(student_user):
    """Async HTTP client authenticated as testuser1, who is not an editor."""
    app, auth_manager, mock_auth, transport = _client_for(student_user)
    with patch("rsptx.endpoint_validators.core.auth_manager", mock_auth):
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            yield client
    app.dependency_overrides.pop(auth_manager, None)
