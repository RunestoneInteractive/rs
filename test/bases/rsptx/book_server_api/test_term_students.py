"""
Tests for ``/books/term_students``, the count behind the PreTeXt donation
banner's "N students have started using Runestone books since ..." appeal.

The count is a full scan of auth_user, so it must be cached, and the cache must
roll over when a new term starts.
"""

import json
from datetime import date, datetime

import pytest

from rsptx.book_server_api.routers import books

# See the async-loop note in the project memory: without this, a module that
# pulls in no session-scoped fixture breaks every DB test that runs after it.
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.mark.parametrize(
    "today, start",
    [
        (date(2026, 1, 1), date(2026, 1, 1)),
        (date(2026, 7, 31), date(2026, 1, 1)),
        (date(2026, 8, 1), date(2026, 8, 1)),
        (date(2026, 12, 31), date(2026, 8, 1)),
    ],
)
def test_current_term_start(today, start):
    assert books.current_term_start(today) == start


@pytest.fixture
def counted(monkeypatch):
    """Replace the DB count with a recorder, and start from an empty cache."""
    calls = []

    async def fake_count(since):
        calls.append(since)
        return 48213

    monkeypatch.setattr(books, "count_users_created_since", fake_count)
    monkeypatch.setattr(
        books, "_term_students_cache", {"since": None, "count": 0, "expires": 0.0}
    )
    return calls


def _set_today(monkeypatch, when):
    monkeypatch.setattr(books, "canonical_utcnow", lambda: when)


async def test_reports_count_since_term_start(counted, monkeypatch):
    _set_today(monkeypatch, datetime(2026, 10, 8, 15, 0))

    response = await books.term_students()

    assert json.loads(response.body) == {"count": 48213, "since": "2026-08-01"}
    assert counted == [datetime(2026, 8, 1)]
    assert "max-age" in response.headers["cache-control"]


async def test_caches_the_count(counted, monkeypatch):
    _set_today(monkeypatch, datetime(2026, 10, 8, 15, 0))

    await books.term_students()
    await books.term_students()

    assert len(counted) == 1


async def test_new_term_recounts_despite_cache(counted, monkeypatch):
    _set_today(monkeypatch, datetime(2026, 12, 31, 23, 0))
    await books.term_students()

    _set_today(monkeypatch, datetime(2027, 1, 1, 0, 30))
    response = await books.term_students()

    assert json.loads(response.body)["since"] == "2027-01-01"
    assert counted == [datetime(2026, 8, 1), datetime(2027, 1, 1)]
