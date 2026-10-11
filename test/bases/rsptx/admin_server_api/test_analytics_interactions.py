"""
The analytics reports read per-(student, item) activity from
``user_interactions``.  These tests log events the way the servers do and
check what the reports see.
"""

import datetime

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

COURSE = "test_course_1"
SID = "an_student"
CHAPTER = "an_ch"
SUBCHAPTER = "an_sub"


def t(minute):
    return datetime.datetime(2026, 3, 1, 12, minute)


async def _log(div_id, event, act, when, key=None):
    from rsptx.db.crud import create_useinfo_entry
    from rsptx.db.models import UseinfoValidation

    await create_useinfo_entry(
        UseinfoValidation(
            event=event,
            act=act,
            div_id=div_id,
            course_id=COURSE,
            sid=SID,
            timestamp=when,
        ),
        interaction_key=key,
    )


@pytest.fixture(scope="session")
async def reading(init_test_db):
    """A page with one activity on it, plus a video elsewhere, and a student
    who opened the page twice, answered the activity twice, and only loaded the
    video's player.  Returns the page question's id."""
    from rsptx.db.async_session import async_session
    from rsptx.db.crud import page_interaction_key
    from rsptx.db.models import Question

    async with async_session.begin() as session:
        page = Question(
            base_course=COURSE,
            name=f"{CHAPTER}/{SUBCHAPTER}",
            chapter=CHAPTER,
            subchapter=SUBCHAPTER,
            question_type="page",
            timestamp=t(0),
            from_source=True,
        )
        session.add_all(
            [
                page,
                Question(
                    base_course=COURSE,
                    name="an_q1",
                    chapter=CHAPTER,
                    subchapter=SUBCHAPTER,
                    question_type="mchoice",
                    timestamp=t(0),
                    from_source=True,
                    optional=False,
                ),
                Question(
                    base_course=COURSE,
                    name="an_v1",
                    chapter=CHAPTER,
                    subchapter="an_other",
                    question_type="youtube",
                    timestamp=t(0),
                    from_source=True,
                ),
            ]
        )
        await session.flush()
        page_id = page.id

    key = page_interaction_key(CHAPTER, SUBCHAPTER)
    await _log(f"{CHAPTER}/{SUBCHAPTER}.html", "page", "view", t(1), key=key)
    await _log(f"{CHAPTER}/{SUBCHAPTER}.html", "page", "view", t(5), key=key)
    await _log("an_q1", "mChoice", "answer:1:no", t(2))
    await _log("an_q1", "mChoice", "answer:0:correct", t(3))
    await _log("an_v1", "video", "ready", t(4))
    return page_id


async def test_reading_interactions_combine_page_views_and_activities(reading):
    from rsptx.admin_server_api.routers.analytics import _reading_interactions
    from rsptx.db.sync_session import engine

    df = _reading_interactions(engine, COURSE, [reading], sid=SID)
    assert len(df) == 1
    row = df.iloc[0]
    assert row.div_id == f"{CHAPTER}/{SUBCHAPTER}"
    # two page views + two answers
    assert row.interactions == 4
    assert row.first_interaction == t(1)
    assert row.last_interaction == t(5)


async def test_student_detail_counts_clicks_per_exercise(reading):
    from rsptx.admin_server_api.routers.analytics import _build_student_detail
    from rsptx.db.sync_session import engine

    detail = _build_student_detail(engine, COURSE, COURSE, SID, 0)
    rows = {
        name: r
        for r in detail["exercise_detail"]
        for name in r.values()
        if name in ("an_q1", "an_v1")
    }
    assert rows["an_q1"]["Clicks"] == 2
    # Loading a video's player is not watching it.
    assert "an_v1" not in rows
