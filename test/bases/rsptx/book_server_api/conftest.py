"""
Book-server-specific test fixtures.

``auth_book_client`` provides an httpx.AsyncClient with ASGITransport so the
book server runs in the *same* asyncio event loop as the test session.  This
avoids the "attached to a different loop" error that occurs when TestClient
(which spins up its own event loop) tries to reuse asyncpg connections that
were created in the pytest session loop.

All tests that use this client must be async functions.
"""

import pytest_asyncio
import httpx


@pytest_asyncio.fixture(scope="session")
async def auth_book_client(student_user):
    """Async HTTP client for the book server authenticated as testuser1."""
    from rsptx.book_server_api.main import app
    from rsptx.auth.session import auth_manager

    app.dependency_overrides[auth_manager] = lambda: student_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(auth_manager, None)
