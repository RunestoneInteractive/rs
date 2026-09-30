"""
Tests for scoring a class's attempts at a page of questions.

The fixture builds one page holding one question of each kind the report
treats differently, and a small class whose answers put a student in every
outcome bucket, then runs the real SQL.  ``classify`` is tested on its own in
``test_classify.py``.
"""

import datetime

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.async_session import async_session  # noqa: E402
from rsptx.db.crud import (  # noqa: E402
    create_course,
    create_instructor_course_entry,
    create_user_course_entry,
    fetch_course,
)
from rsptx.db.crud.user import create_user  # noqa: E402
from rsptx.db.models import (  # noqa: E402
    AuthUserValidator,
    Chapter,
    CoursesValidator,
    MchoiceAnswers,
    Question,
    SelectedQuestion,
    ShortanswerAnswers,
    SubChapter,
    UnittestAnswers,
    Useinfo,
)
from rsptx.db.sync_session import engine  # noqa: E402
from rsptx.question_outcomes import (  # noqa: E402
    fetch_chapters,
    fetch_roster,
    fetch_subchapter_questions,
    fetch_subchapters,
    question_outcomes,
)

COURSE = "qo_course"
OTHER_COURSE = "qo_other_course"
BOOK = "thinkcspy"
CHAPTER = "qo_ch"
PAGE = "qo_sub"
OTHER_PAGE = "qo_other_sub"
STUDENTS = ["qo_s1", "qo_s2", "qo_s3", "qo_s4"]
INSTRUCTOR = "qo_inst"
T0 = datetime.datetime(2026, 9, 1, 12, 0, 0)


def at(minutes):
    return T0 + datetime.timedelta(minutes=minutes)


async def _make_user(username, course):
    return await create_user(
        AuthUserValidator(
            username=username,
            first_name="test",
            last_name=username,
            password="xxx",
            email=f"{username}@example.com",
            course_name=course.course_name,
            course_id=course.id,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1),
            modified_on=datetime.datetime(2020, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )


async def _make_course(name):
    await create_course(
        CoursesValidator(
            course_name=name,
            base_course=BOOK,
            term_start_date=datetime.date(2026, 8, 1),
            login_required=True,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Test University",
            new_server=True,
        )
    )
    return await fetch_course(name)


def _question(name, qtype, qnumber=None, subchapter=PAGE, **kw):
    return Question(
        base_course=BOOK,
        name=name,
        chapter=CHAPTER,
        subchapter=subchapter,
        timestamp=T0,
        question_type=qtype,
        qnumber=qnumber,
        from_source=kw.pop("from_source", True),
        is_private=False,
        review_flag=False,
        **kw,
    )


def _mc(sid, div_id, correct, minutes, course=COURSE):
    return MchoiceAnswers(
        sid=sid,
        div_id=div_id,
        course_name=course,
        correct=correct,
        answer="0",
        timestamp=at(minutes),
    )


def _log(sid, div_id, event, act, minutes):
    return Useinfo(
        sid=sid,
        div_id=div_id,
        course_id=COURSE,
        event=event,
        act=act,
        timestamp=at(minutes),
    )


@pytest.fixture(scope="session")
async def page(init_test_db):
    """A page of questions and a class that has answered them."""
    course = await _make_course(COURSE)
    other = await _make_course(OTHER_COURSE)
    for sid in STUDENTS + [INSTRUCTOR]:
        user = await _make_user(sid, course)
        await create_user_course_entry(user.id, course.id)
        if sid == INSTRUCTOR:
            await create_instructor_course_entry(user.id, course.id)
    outsider = await _make_user("qo_outsider", other)
    await create_user_course_entry(outsider.id, other.id)

    async with async_session() as session:
        chapter = Chapter(
            chapter_name="QO Chapter",
            course_id=BOOK,
            chapter_label=CHAPTER,
            chapter_num=1,
        )
        session.add(chapter)
        await session.flush()
        for num, (label, title) in enumerate(
            [(PAGE, "The Page"), (OTHER_PAGE, "Another Page")], start=1
        ):
            session.add(
                SubChapter(
                    sub_chapter_name=title,
                    chapter_id=chapter.id,
                    sub_chapter_label=label,
                    skipreading=False,
                    sub_chapter_num=num,
                )
            )
        session.add_all(
            [
                # Q-10 is added first so the test can see page order come
                # from the question number rather than insertion order.
                _question("qo_fitb", "fillintheblank", "Q-10"),
                _question("qo_mc", "mchoice", "Q-2"),
                _question("qo_sa", "shortanswer", "Q-3"),
                _question("qo_poll", "poll", "Q-4"),
                _question("qo_vid", "youtube", "Q-5"),
                _question("qo_ac", "activecode", "Q-6", autograde="unittest"),
                _question("qo_ac_plain", "activecode", "Q-7", autograde=""),
                _question("qo_sel", "selectquestion", "Q-8"),
                # Not reported: not a question, and not on the page.
                _question("qo_page", "page"),
                _question("qo_mine", "mchoice", "Q-9", from_source=False),
                # The pool the selectquestion draws from lives elsewhere.
                _question("qo_pool1", "mchoice", subchapter=OTHER_PAGE),
            ]
        )
        session.add_all(
            [
                # qo_mc: s1 right first, s2 wrong then right, s3 never right,
                # s4 never tried. Instructor and another course are ignored.
                _mc("qo_s1", "qo_mc", True, 1),
                _mc("qo_s2", "qo_mc", False, 1),
                _mc("qo_s2", "qo_mc", True, 5),
                _mc("qo_s3", "qo_mc", False, 1),
                _mc("qo_s3", "qo_mc", False, 2),
                _mc(INSTRUCTOR, "qo_mc", True, 1),
                _mc("qo_outsider", "qo_mc", True, 1, course=OTHER_COURSE),
                # a wrong answer *after* a right one is still right first try
                _mc("qo_s1", "qo_mc", False, 9),
                ShortanswerAnswers(
                    sid="qo_s1",
                    div_id="qo_sa",
                    course_name=COURSE,
                    answer="words",
                    timestamp=at(1),
                ),
                _log("qo_s1", "qo_poll", "poll", "2", 1),
                # loading a video is not watching it
                _log("qo_s1", "qo_vid", "video", "ready", 1),
                _log("qo_s2", "qo_vid", "video", "play:3.5", 1),
                UnittestAnswers(
                    sid="qo_s1",
                    div_id="qo_ac",
                    course_name=COURSE,
                    correct=True,
                    passed=3,
                    failed=0,
                    timestamp=at(1),
                ),
                _log("qo_s3", "qo_ac_plain", "activecode", "run", 1),
                # s1 and s2 were served qo_pool1; s1 got it right. s3 answered
                # qo_pool1 directly without being served it, which does not
                # count toward the selectquestion.
                SelectedQuestion(
                    selector_id="qo_sel", sid="qo_s1", selected_id="qo_pool1"
                ),
                SelectedQuestion(
                    selector_id="qo_sel", sid="qo_s2", selected_id="qo_pool1"
                ),
                _mc("qo_s1", "qo_pool1", True, 1),
                _mc("qo_s3", "qo_pool1", True, 1),
            ]
        )
        await session.commit()
    return course


async def test_roster_excludes_instructors_and_other_courses(page):
    with engine.connect() as conn:
        assert fetch_roster(conn, COURSE) == sorted(STUDENTS)


async def test_chapter_and_subchapter_options(page):
    with engine.connect() as conn:
        chapters = fetch_chapters(conn, BOOK)
        subchapters = fetch_subchapters(conn, BOOK, CHAPTER)
    assert {"label": "QO Chapter", "value": CHAPTER} in chapters
    assert subchapters == [
        {"label": "The Page", "value": PAGE},
        {"label": "Another Page", "value": OTHER_PAGE},
    ]


async def test_page_questions_in_page_order(page):
    with engine.connect() as conn:
        questions = fetch_subchapter_questions(conn, BOOK, CHAPTER, PAGE)
    assert [q.name for q in questions] == [
        "qo_mc",
        "qo_sa",
        "qo_poll",
        "qo_vid",
        "qo_ac",
        "qo_ac_plain",
        "qo_sel",
        "qo_fitb",
    ]
    graded = {q.name: q.graded for q in questions}
    assert graded["qo_mc"] and graded["qo_ac"] and graded["qo_sel"]
    assert not graded["qo_sa"] and not graded["qo_poll"] and not graded["qo_ac_plain"]


def _outcomes(cutoffs=None):
    with engine.connect() as conn:
        questions = fetch_subchapter_questions(conn, BOOK, CHAPTER, PAGE)
        df = question_outcomes(conn, COURSE, BOOK, questions, cutoffs)
    cols = ["first_try", "later", "never_correct", "tried", "not_tried"]
    return {row.name: [getattr(row, c) for c in cols] for row in df.itertuples()}


async def test_every_bucket(page):
    got = _outcomes()
    #                      first later never tried not_tried
    assert got["qo_mc"] == [1, 1, 1, 0, 1]
    assert got["qo_fitb"] == [0, 0, 0, 0, 4]
    assert got["qo_sa"] == [0, 0, 0, 1, 3]
    assert got["qo_poll"] == [0, 0, 0, 1, 3]
    assert got["qo_vid"] == [0, 0, 0, 1, 3]
    assert got["qo_ac"] == [1, 0, 0, 0, 3]
    assert got["qo_ac_plain"] == [0, 0, 0, 1, 3]
    assert got["qo_sel"] == [1, 0, 0, 0, 3]


async def test_buckets_add_up_to_the_class(page):
    for counts in _outcomes().values():
        assert sum(counts) == len(STUDENTS)


async def test_cutoff_drops_later_answers_per_student(page):
    # s2's correct answer came after their cutoff; s1 has no cutoff.
    got = _outcomes(cutoffs={"qo_s2": at(3), "qo_s1": None})
    assert got["qo_mc"] == [1, 0, 2, 0, 1]
    # A cutoff before a student's first answer means they never tried.
    got = _outcomes(cutoffs={"qo_s3": at(0)})
    assert got["qo_mc"] == [1, 1, 0, 0, 2]
