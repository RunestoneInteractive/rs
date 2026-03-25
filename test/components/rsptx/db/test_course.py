"""
Tests for course CRUD operations.
"""
import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import fetch_course, fetch_course_by_id, create_course
from rsptx.db.models import CoursesValidator

NEW_COURSE_NAME = "crud_test_course"


@pytest.fixture(scope="session")
async def new_course(init_test_db):
    """Create a transient test course for the duration of this module."""
    course = await create_course(
        CoursesValidator(
            course_name=NEW_COURSE_NAME,
            base_course="overview",
            term_start_date=datetime.date(2024, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Test University",
            new_server=True,
        )
    )
    yield course


async def test_fetch_seeded_course(test_course):
    """test_course_1 must exist after seed."""
    assert test_course is not None
    assert test_course.course_name == "test_course_1"


async def test_create_course(new_course):
    """Created course is returned with an id."""
    assert new_course is not None
    assert new_course.id is not None
    assert new_course.course_name == NEW_COURSE_NAME


async def test_fetch_course_by_name(new_course):
    """Fetching by name returns the newly created course."""
    fetched = await fetch_course(NEW_COURSE_NAME)
    assert fetched is not None
    assert fetched.course_name == NEW_COURSE_NAME
    assert fetched.institution == "Test University"


async def test_fetch_course_by_id(new_course):
    """Fetching by id returns the same course."""
    fetched = await fetch_course_by_id(new_course.id)
    assert fetched is not None
    assert fetched.course_name == NEW_COURSE_NAME


async def test_fetch_nonexistent_course():
    """Fetching a missing course returns None-wrapped validator."""
    result = await fetch_course("this_course_does_not_exist_xyz")
    assert result is None or result.course_name is None
