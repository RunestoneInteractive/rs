"""
Shared fixtures for base-server route tests.

These fixtures set up authenticated TestClients for the book and assignment
servers by overriding the ``auth_manager`` FastAPI dependency with a lambda
that returns the seeded ``testuser1`` object directly.

Fixtures that depend on the DB (``init_test_db``) are session-scoped and
share the single event loop used by all async tests.
"""

import pytest
import pytest_asyncio


@pytest_asyncio.fixture(scope="session")
async def student_user(init_test_db):
    """Return the seeded testuser1 AuthUserValidator (course = overview)."""
    from rsptx.db.crud import fetch_user

    return await fetch_user("testuser1")
