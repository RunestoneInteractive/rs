"""
The donate page records each visit in useinfo, crediting the ad that sent the
reader there.

Rows match what web2py's donate page wrote (event ``default``, act ``donate``),
with ``div_id`` set to ``ad=N`` from the query string, so the access-log-only
``ad`` parameter becomes something we can count per ad in the database.
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from rsptx.auth.session import NotAuthenticatedException
from rsptx.db.async_session import async_session
from rsptx.db.models import Useinfo

pytestmark = pytest.mark.asyncio(loop_scope="session")

DONATE_URL = "/auth/donate"


def _client(auth_mock):
    from rsptx.admin_server_api.core import app

    patcher = patch("rsptx.admin_server_api.routers.auth.auth_manager", auth_mock)
    return patcher, httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


@pytest_asyncio.fixture
async def student_client(student_user):
    patcher, client = _client(AsyncMock(return_value=student_user))
    with patcher:
        async with client:
            yield client


@pytest_asyncio.fixture
async def anonymous_client(init_test_db):
    patcher, client = _client(AsyncMock(side_effect=NotAuthenticatedException))
    with patcher:
        async with client:
            yield client


async def _donate_rows(sid):
    async with async_session() as session:
        result = await session.execute(
            select(Useinfo)
            .where(Useinfo.sid == sid, Useinfo.act == "donate")
            .order_by(Useinfo.id)
        )
        return result.scalars().all()


@pytest_asyncio.fixture(autouse=True)
async def clear_donate_rows(init_test_db):
    async def clear():
        async with async_session.begin() as session:
            await session.execute(delete(Useinfo).where(Useinfo.act == "donate"))

    await clear()
    yield
    await clear()


async def test_logs_the_ad_for_a_signed_in_reader(student_client, student_user):
    resp = await student_client.get(DONATE_URL, params={"ad": "4"})

    assert resp.status_code == 200
    [row] = await _donate_rows("testuser1")
    assert (row.event, row.act, row.div_id) == ("default", "donate", "ad=4")
    assert row.course_id == student_user.course_name


async def test_logs_an_anonymous_reader_under_boguscourse(anonymous_client):
    resp = await anonymous_client.get(DONATE_URL, params={"ad": "3"})

    assert resp.status_code == 200
    [row] = await _donate_rows("Anonymous")
    assert (row.event, row.act, row.div_id) == ("default", "donate", "ad=3")
    assert row.course_id == "boguscourse"


@pytest.mark.parametrize("params", [{}, {"ad": "<script>"}, {"ad": "123456789"}])
async def test_missing_or_junk_ad_is_logged_as_none(anonymous_client, params):
    resp = await anonymous_client.get(DONATE_URL, params=params)

    assert resp.status_code == 200
    [row] = await _donate_rows("Anonymous")
    assert row.div_id == "ad=none"


async def test_a_logging_failure_still_shows_the_page(anonymous_client):
    with patch(
        "rsptx.admin_server_api.routers.auth.create_useinfo_entry",
        AsyncMock(side_effect=RuntimeError("db down")),
    ):
        resp = await anonymous_client.get(DONATE_URL, params={"ad": "5"})

    assert resp.status_code == 200
