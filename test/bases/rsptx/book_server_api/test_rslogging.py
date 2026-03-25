"""
Functional tests for POST /logger/bookevent.

Requires a running PostgreSQL instance (TEST_DBURL) with the test schema
initialised via the ``init_test_db`` session fixture.

All requests are authenticated as ``testuser1`` via the ``auth_book_client``
fixture, which overrides the ``auth_manager`` FastAPI dependency.

Tests are async functions so they share the session event loop with the
asyncpg connection pool — using httpx.AsyncClient + ASGITransport instead
of TestClient avoids the "attached to a different loop" error.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

COURSE = "test_course_1"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _bookevent(event, act, div_id, **extra):
    payload = {
        "event": event,
        "act": act,
        "div_id": div_id,
        "course_name": COURSE,
    }
    payload.update(extra)
    return payload


# ---------------------------------------------------------------------------
# /logger/bookevent
# ---------------------------------------------------------------------------

async def test_bookevent_page_view(auth_book_client):
    """A simple page-view event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("page", "view", "ch1_introduction"),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_mchoice(auth_book_client):
    """A multiple-choice answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "mChoice",
            "answer:A:correct",
            "ch1_q1",
            answer="A",
            correct=True,
        ),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_fillb(auth_book_client):
    """A fill-in-the-blank answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "fillb",
            "answer:hello:correct",
            "ch1_q2",
            answer="hello",
            correct=True,
            percent=1.0,
        ),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_shortanswer(auth_book_client):
    """A short-answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "shortanswer",
            "answer:This is my answer",
            "ch1_sa1",
            answer="This is my answer",
        ),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_missing_required_fields(auth_book_client):
    """A request missing required fields returns 422."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json={"event": "page"},  # missing act, div_id, course_name
    )
    assert resp.status_code == 422


async def test_bookevent_empty_body(auth_book_client):
    """An empty body returns 422."""
    resp = await auth_book_client.post("/logger/bookevent", json={})
    assert resp.status_code == 422
