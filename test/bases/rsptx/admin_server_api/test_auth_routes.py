"""
Functional tests for the course-enrollment route on the admin server.

Issue #1489: on the Choose a Course page a student can type the course name
their instructor handed out *and* also click the open book that course is built
from. The typed name has to win. Picking the base course instead enrolls them in
a course that looks identical to the real one but where their work does not
count, and nobody notices until grades are due.

The priority lives in the route rather than only in the page's JavaScript, so
these post the form directly -- which is also the case the browser never
exercises, because the page's own validation intercepts an empty submit.
"""

import datetime
import httpx
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (  # noqa: E402
    create_course,
    fetch_course,
    fetch_user,
    update_user,
)
from rsptx.db.models import CoursesValidator  # noqa: E402

COURSES_URL = "/auth/courses"

# The course an instructor would hand out, and the base course it is built from.
# A student who types the first and also clicks the second must land in the first.
TYPED_COURSE = "enroll_typed_course"
BASE_COURSE = "overview"


@pytest_asyncio.fixture(scope="session")
async def typed_course(init_test_db):
    """A regular course, distinct from the base course it is built on."""
    existing = await fetch_course(TYPED_COURSE)
    if existing:
        return existing
    await create_course(
        CoursesValidator(
            course_name=TYPED_COURSE,
            base_course=BASE_COURSE,
            term_start_date=datetime.date(2026, 8, 24),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Enroll Test University",
            new_server=True,
        )
    )
    return await fetch_course(TYPED_COURSE)


@pytest_asyncio.fixture
async def auth_student_client(student_user):
    """Client for the auth router, authenticated as testuser1.

    The auth router resolves the reader itself with ``auth_manager(request)``
    rather than through ``Depends()``, so the shared clients in conftest patch
    the wrong place for these routes.
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


@pytest_asyncio.fixture(autouse=True)
async def restore_active_course(student_user):
    """Put testuser1 back in ``overview`` after each test.

    These tests switch the seeded student's active course, and the rest of the
    suite expects to find them where conftest left them.
    """
    yield
    course = await fetch_course(BASE_COURSE)
    await update_user(
        student_user.id, {"course_name": course.course_name, "course_id": course.id}
    )


async def active_course():
    """The course testuser1 is currently in, read back from the database."""
    user = await fetch_user("testuser1")
    return user.course_name


async def set_active(course_name):
    """Park testuser1 in a known course before a test that asserts they stayed.

    The rejection tests have to start somewhere *other* than the course being
    posted, or "nothing moved" and "the wrong thing happened" look identical.
    """
    course = await fetch_course(course_name)
    user = await fetch_user("testuser1")
    await update_user(
        user.id, {"course_name": course.course_name, "course_id": course.id}
    )


async def test_typed_course_beats_a_selected_base_course(
    auth_student_client, typed_course
):
    """#1489: both fields posted -- the typed name wins."""
    resp = await auth_student_client.post(
        COURSES_URL,
        data={"course_name": BASE_COURSE, "direct_course": TYPED_COURSE},
    )

    assert resp.status_code in (302, 303)
    assert await active_course() == TYPED_COURSE


async def test_surrounding_whitespace_does_not_hide_the_typed_name(
    auth_student_client, typed_course
):
    """A name pasted with a stray space still has to win, and still resolve."""
    resp = await auth_student_client.post(
        COURSES_URL,
        data={"course_name": BASE_COURSE, "direct_course": f"  {TYPED_COURSE} "},
    )

    assert resp.status_code in (302, 303)
    assert await active_course() == TYPED_COURSE


async def test_a_selected_course_alone_still_enrolls(auth_student_client):
    """With nothing typed, the radio the student picked is used as before."""
    resp = await auth_student_client.post(
        COURSES_URL, data={"course_name": BASE_COURSE, "direct_course": ""}
    )

    assert resp.status_code in (302, 303)
    assert await active_course() == BASE_COURSE


async def test_an_empty_form_asks_again_instead_of_failing_validation(
    auth_student_client, typed_course
):
    """Neither field posted: the form comes back, not a 422.

    ``course_name`` had to become optional for the typed name to take over, so
    an empty submit now has to be handled rather than rejected by FastAPI.
    """
    await set_active(TYPED_COURSE)

    resp = await auth_student_client.post(COURSES_URL, data={})

    assert resp.status_code == 200
    assert "Please enter a course name or choose a book." in resp.text
    # Nothing was chosen, so nothing should have moved.
    assert await active_course() == TYPED_COURSE


async def test_an_unknown_typed_name_is_reported_and_kept(
    auth_student_client, typed_course
):
    """A typo comes back named, with the text still in the box to be corrected."""
    await set_active(TYPED_COURSE)

    resp = await auth_student_client.post(
        COURSES_URL, data={"direct_course": "no_such_course_xyz"}
    )

    assert resp.status_code == 200
    assert "no_such_course_xyz" in resp.text
    assert "not found" in resp.text
    # The value is rendered back into the field rather than making them retype it.
    assert 'value="no_such_course_xyz"' in resp.text
    assert await active_course() == TYPED_COURSE


async def test_an_unknown_name_does_not_fall_back_to_the_selected_book(
    auth_student_client, typed_course
):
    """A typo must not silently enroll them in the book they also clicked.

    Falling back would be the #1489 bug wearing a different hat: the student
    asked for one course, mistyped it, and would end up somewhere else entirely
    without being told.
    """
    # Start somewhere else, so landing in BASE_COURSE could only mean a fallback.
    await set_active(TYPED_COURSE)

    resp = await auth_student_client.post(
        COURSES_URL,
        data={"course_name": BASE_COURSE, "direct_course": "no_such_course_xyz"},
    )

    assert resp.status_code == 200
    assert "no_such_course_xyz" in resp.text
    assert await active_course() == TYPED_COURSE
