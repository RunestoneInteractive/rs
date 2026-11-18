"""
Admin-server-specific test fixtures.

``editor_user``          — a seeded user in the ``editor`` group who edits the
                           ``overview`` base course.
``auth_editor_client``   — auth_manager patched to return that editor.
``auth_noneditor_client``— authenticated as testuser1, who is not an editor.
``admin_instructor_user``— an instructor of a course of their own, for the
                           instructor pages (Copy Assignments and friends).
``auth_admin_instructor_client`` — auth_manager patched to return them.

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


@pytest_asyncio.fixture(scope="session")
async def admin_instructor_user(init_test_db):
    """An instructor with a course of their own to copy assignments into.

    Its own course rather than a shared one: the copy endpoints leave the
    caller's current course out of every list, so a course another test is also
    writing assignments into would make those lists depend on test order.
    """
    from rsptx.db.crud import (
        create_course,
        create_course_instructor,
        create_user,
        fetch_course,
        fetch_user,
    )
    from rsptx.db.models import AuthUserValidator, CoursesValidator

    existing = await fetch_user("test_admin_instructor")
    if existing:
        return existing

    if not await fetch_course("admin_copy_target"):
        await create_course(
            CoursesValidator(
                course_name="admin_copy_target",
                base_course="overview",
                term_start_date=datetime.date(2026, 8, 24),
                login_required=False,
                allow_pairs=False,
                downloads_enabled=False,
                courselevel="",
                institution="Copy Test University",
                new_server=True,
            )
        )
    course = await fetch_course("admin_copy_target")

    user = await create_user(
        AuthUserValidator(
            username="test_admin_instructor",
            first_name="Test",
            last_name="Instructor",
            password="xxx",
            email="test_admin_instructor@example.com",
            course_name="admin_copy_target",
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


@pytest_asyncio.fixture
async def auth_admin_instructor_client(admin_instructor_user):
    """Async HTTP client for the admin server authenticated as an instructor."""
    app, auth_manager, mock_auth, transport = _client_for(admin_instructor_user)
    with patch("rsptx.endpoint_validators.core.auth_manager", mock_auth):
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            yield client
    app.dependency_overrides.pop(auth_manager, None)


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
