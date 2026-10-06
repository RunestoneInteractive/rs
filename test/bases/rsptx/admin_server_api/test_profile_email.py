"""Profile email requirements for accounts linked to LTI 1.3."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from rsptx.admin_server_api.core import app

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture
def profile_user():
    return SimpleNamespace(
        id=123,
        username="profile_test_user",
        first_name="Before",
        last_name="Person",
        email="before@example.com",
        course_name="overview",
        course_id=1,
    )


@pytest.fixture
async def profile_client(profile_user):
    with (
        patch(
            "rsptx.admin_server_api.routers.auth.auth_manager",
            AsyncMock(return_value=profile_user),
        ),
        patch(
            "rsptx.admin_server_api.routers.auth._navbar_context",
            AsyncMock(return_value={"course": None, "is_instructor": False}),
        ),
        patch(
            "rsptx.admin_server_api.routers.auth.fetch_user",
            AsyncMock(return_value=profile_user),
        ),
        patch(
            "rsptx.admin_server_api.routers.auth.fetch_user_by_email",
            AsyncMock(return_value=None),
        ) as fetch_by_email,
        patch(
            "rsptx.admin_server_api.routers.auth.update_user",
            AsyncMock(),
        ) as update_user,
        patch(
            "rsptx.admin_server_api.routers.auth.has_lti1p3_user_association",
            AsyncMock(return_value=False),
        ) as has_association,
    ):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client, has_association, update_user, fetch_by_email


@pytest.mark.parametrize("linked", [True, False])
async def test_profile_form_requires_email_only_without_lti_link(
    profile_client, linked
):
    client, has_association, _, _ = profile_client
    has_association.return_value = linked

    response = await client.get("/auth/profile")

    assert response.status_code == 200
    email_field = response.text.split('id="email"', 1)[1].split(">", 1)[0]
    assert ("required" in email_field) is not linked


async def test_lti_linked_user_can_save_without_email(profile_client, profile_user):
    client, has_association, update_user, fetch_by_email = profile_client
    has_association.return_value = True

    response = await client.post(
        "/auth/profile",
        data={"first_name": "After", "last_name": "Person"},
    )

    assert response.status_code == 200
    assert "Profile updated successfully." in response.text
    update_user.assert_awaited_once_with(
        profile_user.id,
        {"first_name": "After", "last_name": "Person", "email": ""},
    )
    fetch_by_email.assert_not_awaited()


async def test_unlinked_user_cannot_save_without_email(profile_client):
    client, _, update_user, fetch_by_email = profile_client

    response = await client.post(
        "/auth/profile",
        data={"first_name": "After", "last_name": "Person", "email": "  "},
    )

    assert response.status_code == 200
    assert "Email address is required." in response.text
    update_user.assert_not_awaited()
    fetch_by_email.assert_not_awaited()


async def test_duplicate_email_is_rejected_for_lti_linked_user(
    profile_client, profile_user
):
    client, has_association, update_user, fetch_by_email = profile_client
    has_association.return_value = True
    fetch_by_email.return_value = SimpleNamespace(id=profile_user.id + 1)

    response = await client.post(
        "/auth/profile",
        data={
            "first_name": "After",
            "last_name": "Person",
            "email": "taken@example.com",
        },
    )

    assert response.status_code == 200
    assert "That email address is already in use" in response.text
    update_user.assert_not_awaited()
