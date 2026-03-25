"""
Root test configuration for the Runestone test suite.

This conftest.py runs before any test module is imported. It sets the
SERVER_CONFIG and TEST_DBURL environment variables so that async_session.py
picks up the test database when the engine is created at import time.

Requires a running PostgreSQL instance. Set TEST_DBURL in your .env file or
environment, e.g.:
    TEST_DBURL=postgresql://runestone:runestone@localhost:2345/runestone_test
"""

import os


def pytest_configure(config):
    """Set test environment variables before any rsptx modules are imported."""
    os.environ.setdefault("SERVER_CONFIG", "test")
    os.environ.setdefault(
        "TEST_DBURL",
        "postgresql://runestone:runestone@localhost:2345/runestone_test",
    )
    # Drop and recreate tables at the start of each test session.
    os.environ.setdefault("DROP_TABLES", "Yes")


import pytest  # noqa: E402  (must come after env vars are set)


@pytest.fixture(scope="session")
async def init_test_db():
    """
    Session-scoped fixture: creates all tables, seeds base courses and testuser1,
    then tears down the engine when the session ends.

    All tests that touch the database should depend on this fixture (directly or
    via a db-layer fixture that depends on it).
    """
    # Import here — after pytest_configure has set SERVER_CONFIG — so the engine
    # is created with the test database URL.
    from rsptx.db.async_session import init_models, term_models
    from rsptx.db.crud import create_initial_courses_users

    await init_models()
    await create_initial_courses_users()
    yield
    await term_models()
