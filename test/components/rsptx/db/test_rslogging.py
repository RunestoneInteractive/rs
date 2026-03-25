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
