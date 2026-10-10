"""
Tests for ``user_interactions``: the live write path through
``create_useinfo_entry``, the reader, and the backfill from historical
``useinfo`` rows.
"""

import datetime

import pytest
from sqlalchemy import select

from rsptx.db.async_session import async_session
from rsptx.db.crud import (
    backfill_user_interactions,
    create_course,
    create_useinfo_entry,
    fetch_interacted_sids,
    interaction_key_for,
    page_interaction_key,
)
from rsptx.db.models import (
    Chapter,
    CourseAttribute,
    CoursesValidator,
    SubChapter,
    Useinfo,
    UseinfoValidation,
    UserInteraction,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

PTX_COURSE = "ui_ptx_course"
RST_COURSE = "ui_rst_course"
LIVE_COURSE = "ui_live_course"
PTX_BOOK = "ui_ptx_book"


@pytest.fixture(scope="session")
async def interaction_courses(init_test_db):
    """A PreTeXt course whose book has one chapter/subchapter, a Sphinx
    course, and a course for the live write path."""
    courses = {}
    for name, base in [
        # Base courses are their own base, and must exist first.
        (PTX_BOOK, PTX_BOOK),
        ("ui_rst_book", "ui_rst_book"),
        (PTX_COURSE, PTX_BOOK),
        (RST_COURSE, "ui_rst_book"),
        (LIVE_COURSE, "ui_rst_book"),
    ]:
        courses[name] = await create_course(
            CoursesValidator(
                course_name=name,
                base_course=base,
                term_start_date=datetime.date(2026, 1, 1),
                login_required=False,
                allow_pairs=False,
                downloads_enabled=False,
                courselevel="",
                institution="Test University",
                new_server=True,
            )
        )
    async with async_session.begin() as session:
        session.add(
            CourseAttribute(
                course_id=courses[PTX_COURSE].id, attr="markup_system", value="PreTeXt"
            )
        )
        chapter = Chapter(
            chapter_name="Chapter A",
            course_id=PTX_BOOK,
            chapter_label="ui_ch_a",
            chapter_num=1,
        )
        session.add(chapter)
        await session.flush()
        session.add(
            SubChapter(
                sub_chapter_name="Section A",
                chapter_id=chapter.id,
                sub_chapter_label="ui_sub_a",
                skipreading=False,
                sub_chapter_num=1,
            )
        )
    return courses


async def _tracker_rows(course_name):
    async with async_session() as session:
        res = await session.execute(
            select(UserInteraction).where(UserInteraction.course_name == course_name)
        )
        return {
            (r.div_id, r.sid): (r.first_interaction, r.last_interaction, r.interactions)
            for r in res.scalars()
        }


def t(month, day=1, hour=12):
    return datetime.datetime(2026, month, day, hour, 0, 0)


async def test_interaction_key_for():
    assert interaction_key_for("mChoice", "answer:1:correct", "s1", "q1") == "q1"
    assert interaction_key_for("poll", "3", "s1", "p1") == "p1"
    assert interaction_key_for("video", "play:12.5", "s1", "v1") == "v1"
    # A player that was merely built is not the student doing anything.
    assert interaction_key_for("video", "ready", "s1", "v1") is None
    assert interaction_key_for("mChoice", "x", "Anonymous", "q1") is None
    assert interaction_key_for("mChoice", "x", "", "q1") is None
    assert interaction_key_for("mChoice", "x", "s1", "") is None
    # Page views are keyed by the caller, never by their URL path.
    assert interaction_key_for("page", "view", "s1", "ch/sub.html") is None


async def _log(sid, div_id, event, act, when, key=None):
    await create_useinfo_entry(
        UseinfoValidation(
            event=event,
            act=act,
            div_id=div_id,
            course_id=LIVE_COURSE,
            sid=sid,
            timestamp=when,
        ),
        interaction_key=key,
    )


async def test_logging_records_interactions(interaction_courses):
    # Logged out of order: first/last must still come out right.
    await _log("ui_s1", "ui_q1", "mChoice", "answer:1:correct", t(3))
    await _log("ui_s1", "ui_q1", "mChoice", "answer:2:no", t(2))
    await _log("ui_s1", "ui_q1", "mChoice", "answer:1:correct", t(4))
    await _log("ui_s2", "ui_v1", "video", "ready", t(2))
    await _log("ui_s2", "ui_v1", "video", "play:4", t(3))
    await _log("Anonymous", "ui_q1", "mChoice", "answer:1:correct", t(2))
    # A page view with no key (e.g. an unresolved chapter) is logged only.
    await _log("ui_s1", "rch/rsub.html", "page", "view", t(2))
    await _log(
        "ui_s1",
        "rch/rsub2.html",
        "page",
        "view",
        t(5),
        key=page_interaction_key("rch", "rsub2"),
    )

    assert await _tracker_rows(LIVE_COURSE) == {
        ("ui_q1", "ui_s1"): (t(2), t(4), 3),
        ("ui_v1", "ui_s2"): (t(3), t(3), 1),
        ("page:rch/rsub2", "ui_s1"): (t(5), t(5), 1),
    }

    # The log itself is untouched: every event is still there.
    async with async_session() as session:
        res = await session.execute(
            select(Useinfo).where(Useinfo.course_id == LIVE_COURSE)
        )
        assert len(res.scalars().all()) == 8


async def test_fetch_interacted_sids(interaction_courses):
    await _log("ui_s3", "ui_q2", "mChoice", "answer:1:correct", t(6))
    await _log("ui_s4", "ui_q2", "mChoice", "answer:1:correct", t(6))
    readers = await fetch_interacted_sids(
        LIVE_COURSE, ["ui_q2", "page:rch/rsub2", "ui_nobody"]
    )
    assert readers == {
        "ui_q2": {"ui_s3", "ui_s4"},
        "page:rch/rsub2": {"ui_s1"},
        "ui_nobody": set(),
    }


async def test_backfill_from_useinfo(interaction_courses):
    """History logged before the tracker existed is folded in, with page
    paths resolved to the same keys the live path writes."""
    rows = [
        # PreTeXt: the chapter is looked up from the subchapter label.
        (PTX_COURSE, "ui_s1", "page", "view", "ui_sub_a.html", t(2)),
        (PTX_COURSE, "ui_s1", "page", "view", "/ns/x/ui_sub_a.html", t(3)),
        (PTX_COURSE, "ui_s1", "page", "view", "not_in_the_book.html", t(3)),
        (PTX_COURSE, "ui_s1", "mChoice", "answer:1", "ui_pq", t(2)),
        (PTX_COURSE, "ui_s2", "video", "ready", "ui_pv", t(2)),
        (PTX_COURSE, "ui_s2", "video", "complete", "ui_pv", t(4)),
        (
            PTX_COURSE,
            "ui_s3",
            "mChoice",
            "answer:1",
            "ui_pq",
            datetime.datetime(2025, 12, 31),
        ),
        (PTX_COURSE, "Anonymous", "page", "view", "ui_sub_a.html", t(2)),
        # Sphinx: the chapter is the directory above the page.
        (RST_COURSE, "ui_s4", "page", "view", "rch/rsub.html", t(2)),
        (RST_COURSE, "ui_s4", "page", "view", "/books/x/rch/rsub.html", t(5)),
    ]
    ids = []
    async with async_session.begin() as session:
        for course, sid, event, act, div_id, when in rows:
            row = Useinfo(
                course_id=course,
                sid=sid,
                event=event,
                act=act,
                div_id=div_id,
                timestamp=when,
            )
            session.add(row)
            await session.flush()
            ids.append(row.id)
    lo, hi = min(ids), max(ids) + 1
    since = datetime.datetime(2026, 1, 1)

    await backfill_user_interactions(lo, hi, since)

    assert await _tracker_rows(PTX_COURSE) == {
        ("page:ui_ch_a/ui_sub_a", "ui_s1"): (t(2), t(3), 2),
        ("ui_pq", "ui_s1"): (t(2), t(2), 1),
        ("ui_pv", "ui_s2"): (t(4), t(4), 1),
    }
    assert await _tracker_rows(RST_COURSE) == {
        ("page:rch/rsub", "ui_s4"): (t(2), t(5), 2),
    }

    # Re-running a range keeps first/last exact; only the counts grow.
    await backfill_user_interactions(lo, hi, since)
    again = await _tracker_rows(RST_COURSE)
    assert again[("page:rch/rsub", "ui_s4")] == (t(2), t(5), 4)
