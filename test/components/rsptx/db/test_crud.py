"""
Smoke tests for the top-level crud module (create_initial_courses_users, etc.).

The detailed per-domain tests live in test_user.py, test_course.py,
test_rslogging.py, test_question.py, and test_assignment.py.
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db import crud
from rsptx.db.crud import fetch_user, fetch_course


async def test_crud_module_importable():
    """The crud module must be importable."""
    assert crud is not None


async def test_seeded_courses_exist(init_test_db):
    """create_initial_courses_users must have seeded the expected base courses."""
    for course_name in ("overview", "test_course_1", "fopp", "thinkcspy"):
        course = await fetch_course(course_name)
        assert course is not None, f"Expected seeded course '{course_name}' not found"
        assert course.course_name == course_name


async def test_seeded_user_exists(init_test_db):
    """testuser1 must exist after seeding."""
    user = await fetch_user("testuser1")
    assert user is not None
    assert user.username == "testuser1"
    assert user.email == "testuser1@example.com"
