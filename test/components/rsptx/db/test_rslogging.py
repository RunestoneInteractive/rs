"""
Tests for rslogging CRUD operations (useinfo, answer tables).
"""
import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import create_useinfo_entry, count_useinfo_for, fetch_poll_summary
from rsptx.db.models import UseinfoValidation
from rsptx.response_helpers.core import canonical_utcnow

COURSE = "test_course_1"
USER = "testuser1"


def _useinfo(div_id: str, event: str = "mChoice", act: str = "answer:1") -> UseinfoValidation:
    return UseinfoValidation(
        timestamp=canonical_utcnow(),
        sid=USER,
        event=event,
        act=act,
        div_id=div_id,
        course_id=COURSE,
    )


async def test_create_useinfo_entry(init_test_db):
    """A useinfo entry is persisted and returned with an id."""
    entry = await create_useinfo_entry(_useinfo("test_mchoice_q1"))
    assert entry is not None
    assert entry.id is not None
    assert entry.sid == USER
    assert entry.course_id == COURSE
    assert entry.event == "mChoice"


async def test_create_multiple_useinfo_entries(init_test_db):
    """Multiple entries for the same question are allowed (no unique constraint)."""
    await create_useinfo_entry(_useinfo("test_mchoice_q1", act="answer:0"))
    await create_useinfo_entry(_useinfo("test_mchoice_q1", act="answer:1"))
    count = await count_useinfo_for(
        "test_mchoice_q1", COURSE, datetime.datetime(2000, 1, 1)
    )
    # count returns a list of (act, count) tuples; total should be >= 2
    total = sum(row[1] for row in count)
    assert total >= 2


async def test_count_useinfo_for(init_test_db):
    """count_useinfo_for aggregates by act value."""
    div_id = "test_count_q"
    await create_useinfo_entry(_useinfo(div_id, act="answer:0"))
    await create_useinfo_entry(_useinfo(div_id, act="answer:0"))
    await create_useinfo_entry(_useinfo(div_id, act="answer:1"))

    rows = await count_useinfo_for(div_id, COURSE, datetime.datetime(2000, 1, 1))
    act_map = {row[0]: row[1] for row in rows}
    assert act_map.get("answer:0", 0) >= 2
    assert act_map.get("answer:1", 0) >= 1


async def test_create_useinfo_poll_event(init_test_db):
    """Poll events are stored correctly; fetch_poll_summary returns results."""
    div_id = "test_poll_q"
    await create_useinfo_entry(_useinfo(div_id, event="poll", act="2"))
    await create_useinfo_entry(_useinfo(div_id, event="poll", act="1"))

    summary = await fetch_poll_summary(div_id, COURSE)
    acts = [row[0] for row in summary]
    assert "2" in acts or "1" in acts


# Course last-access tracking
# ---------------------------


@pytest.fixture
async def enrolled(test_user, test_course, monkeypatch):
    """testuser1 enrolled in test_course_1, with an empty throttle cache."""
    from rsptx.db.crud import course as course_crud
    from rsptx.db.crud import create_user_course_entry, user_in_course

    monkeypatch.setattr(course_crud, "_last_recorded_access", {})
    if not await user_in_course(test_user.id, test_course.id):
        await create_user_course_entry(test_user.id, test_course.id)
    return test_user


async def _last_access(user_id: int):
    from rsptx.db.crud import fetch_course_access_for_user

    return (await fetch_course_access_for_user(user_id)).get(COURSE)


async def test_useinfo_entry_records_course_access(enrolled):
    """Logging an event stamps the enrollment's last_access."""
    when = canonical_utcnow() + datetime.timedelta(days=1)
    entry = _useinfo("test_access_q")
    entry.timestamp = when
    await create_useinfo_entry(entry)
    assert await _last_access(enrolled.id) == when


async def test_course_access_is_throttled(enrolled):
    """Events within the resolution window don't rewrite last_access."""
    from rsptx.db.crud import record_course_access

    first = canonical_utcnow() + datetime.timedelta(days=2)
    await record_course_access(USER, COURSE, first)
    await record_course_access(USER, COURSE, first + datetime.timedelta(minutes=1))
    assert await _last_access(enrolled.id) == first

    later = first + datetime.timedelta(minutes=6)
    await record_course_access(USER, COURSE, later)
    assert await _last_access(enrolled.id) == later


async def test_course_access_never_moves_backwards(enrolled, monkeypatch):
    """An older event (e.g. from another worker) doesn't overwrite a newer one."""
    from rsptx.db.crud import course as course_crud
    from rsptx.db.crud import record_course_access

    newest = canonical_utcnow() + datetime.timedelta(days=3)
    await record_course_access(USER, COURSE, newest)
    monkeypatch.setattr(course_crud, "_last_recorded_access", {})
    await record_course_access(USER, COURSE, newest - datetime.timedelta(hours=1))
    assert await _last_access(enrolled.id) == newest


async def test_anonymous_access_is_ignored(enrolled):
    """Anonymous readers have no enrollment; recording is a quiet no-op."""
    from rsptx.db.crud import record_course_access

    before = await _last_access(enrolled.id)
    await record_course_access("Anonymous", COURSE, canonical_utcnow())
    assert await _last_access(enrolled.id) == before
