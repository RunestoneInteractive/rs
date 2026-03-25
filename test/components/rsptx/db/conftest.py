"""
Database-layer test fixtures.

All fixtures here depend on `init_test_db` (defined in test/conftest.py) to
ensure the database is initialised and seeded before use.
"""

import pytest


@pytest.fixture(scope="session")
async def test_user(init_test_db):
    """Return the seeded testuser1 AuthUserValidator."""
    from rsptx.db.crud import fetch_user

    return await fetch_user("testuser1")


@pytest.fixture(scope="session")
async def test_course(init_test_db):
    """Return the seeded test_course_1 CoursesValidator."""
    from rsptx.db.crud import fetch_course

    return await fetch_course("test_course_1")


@pytest.fixture(scope="session")
async def overview_course(init_test_db):
    """Return the seeded overview course (testuser1's home course)."""
    from rsptx.db.crud import fetch_course

    return await fetch_course("overview")
