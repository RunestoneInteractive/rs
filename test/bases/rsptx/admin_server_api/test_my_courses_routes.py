"""
Functional tests for the My Courses page and its "switch active course" form.

Issue #1494: a direct link to an assignment in a course that is not the
student's active one used to open the assignment anyway, so their work was
recorded against the wrong course and silently scored zero in the right one.
The assignment server now bounces them here, naming the assignment and passing
the link along in ``next`` so that switching courses takes them back to it.
"""

import httpx
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (  # noqa: E402
    create_user_course_entry,
    fetch_course,
    fetch_courses_for_user,
    fetch_user,
    update_user,
)

MY_COURSES_URL = "/auth/my_courses"
SWITCH_URL = "/auth/my_courses/switch"
HOME_COURSE = "overview"
ASSIGNMENT_LINK = "/assignment/student/doAssignment?assignment_id=42"


@pytest_asyncio.fixture
async def auth_student_client(student_user):
    """Client for the auth router, authenticated as testuser1.

    The auth router resolves the reader with ``auth_manager(request)`` rather
    than through ``Depends()``, so it has to be patched at the module level.
    """
    from rsptx.admin_server_api.core import app

    with patch(
        "rsptx.admin_server_api.routers.auth.auth_manager",
        AsyncMock(return_value=student_user),
    ):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            yield client


@pytest_asyncio.fixture
async def enrolled_student(student_user):
    """The seeded student has no ``user_courses`` row, so My Courses lists
    nothing for them and the switch form never renders. Enroll them in the
    course they are already active in."""
    course = await fetch_course(HOME_COURSE)
    if not await fetch_courses_for_user(student_user.id, course_id=course.id):
        await create_user_course_entry(student_user.id, course.id)
    return student_user


@pytest_asyncio.fixture(autouse=True)
async def restore_active_course(student_user):
    """Put testuser1 back in ``overview``; the rest of the suite expects them there."""
    yield
    course = await fetch_course(HOME_COURSE)
    await update_user(
        student_user.id, {"course_name": course.course_name, "course_id": course.id}
    )


async def test_assignment_mismatch_is_explained(auth_student_client, enrolled_student):
    """The page names the assignment and both courses, not just 'wrong course'."""
    resp = await auth_student_client.get(
        MY_COURSES_URL,
        params={
            "requested_course": "some_other_course",
            "current_course": HOME_COURSE,
            "requested_assignment": "Homework 3",
            "next": ASSIGNMENT_LINK,
        },
    )

    assert resp.status_code == 200
    assert "Homework 3" in resp.text
    assert "some_other_course" in resp.text
    # The link the student clicked rides along on the switch form.
    assert f'name="next" value="{ASSIGNMENT_LINK}"' in resp.text
    # Not enrolled in that course, so the page says so rather than offering a
    # switch button that would fail.
    assert "You are not enrolled in" in resp.text


async def test_enrolled_student_gets_a_one_click_switch(
    auth_student_client, enrolled_student
):
    """When the student *is* in the assignment's course, the alert offers a
    direct switch instead of making them find the row in a long course list."""
    resp = await auth_student_client.get(
        MY_COURSES_URL,
        params={
            "requested_course": HOME_COURSE,
            "current_course": "some_other_course",
            "requested_assignment": "Homework 3",
            "next": ASSIGNMENT_LINK,
        },
    )

    assert f"Switch to {HOME_COURSE} and open the assignment" in resp.text


async def test_switching_follows_next_back_to_the_assignment(auth_student_client):
    """Switching courses returns the student to the link that sent them here."""
    resp = await auth_student_client.post(
        SWITCH_URL, data={"course_name": HOME_COURSE, "next": ASSIGNMENT_LINK}
    )

    assert resp.status_code in (302, 303)
    assert resp.headers["location"] == ASSIGNMENT_LINK
    user = await fetch_user("testuser1")
    assert user.course_name == HOME_COURSE


async def test_switching_without_next_goes_to_the_course_home(auth_student_client):
    resp = await auth_student_client.post(SWITCH_URL, data={"course_name": HOME_COURSE})

    assert resp.status_code in (302, 303)
    assert resp.headers["location"] == "/ns/course/index"


async def test_next_cannot_be_an_offsite_url(auth_student_client):
    """``next`` is attacker-controllable, so only same-site paths are honoured."""
    resp = await auth_student_client.post(
        SWITCH_URL,
        data={"course_name": HOME_COURSE, "next": "https://evil.example/phish"},
    )

    assert resp.headers["location"] == "/ns/course/index"
