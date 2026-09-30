"""
Tests for the assignment half of question outcomes: finding an assignment's
exercises and readings, each student's cutoff, and reading progress.

One course, one reading page and one exercise.  Three students:

* s1 has no extension. Wrong before the due date, right only after it; did
  every activity on the reading page.
* s2 has a one-week extension for every assignment. Right after the due date
  but inside the extension; only opened the reading page before the cutoff.
* s3 has a five-day extension for all assignments but a one-day extension for
  this one. Never answered; only touched an optional activity and did the rest
  before the term started.
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
    Assignment,
    AssignmentQuestion,
    AuthUserValidator,
    Chapter,
    CoursesValidator,
    DeadlineException,
    MchoiceAnswers,
    Question,
    SubChapter,
    Useinfo,
)
from rsptx.db.sync_session import engine  # noqa: E402
from rsptx.question_outcomes import (  # noqa: E402
    ReadingRef,
    assignment_cutoffs,
    fetch_assignment,
    fetch_assignment_parts,
    fetch_assignments,
    fetch_roster,
    question_outcomes,
    reading_progress,
)

COURSE = "qa_course"
OTHER_COURSE = "qa_other_course"
BOOK = "thinkcspy"
CHAPTER = "qa_ch"
PAGE = "qa_page"
PAGE_Q = "QA Chapter/QA Page"
STUDENTS = ["qa_s1", "qa_s2", "qa_s3"]
INSTRUCTOR = "qa_inst"
DUE = datetime.datetime(2026, 9, 1, 12, 0, 0)


def at(minutes=0, days=0):
    return DUE + datetime.timedelta(minutes=minutes, days=days)


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


def _question(name, qtype, subchapter=PAGE, **kw):
    return Question(
        base_course=BOOK,
        name=name,
        chapter=CHAPTER,
        subchapter=subchapter,
        timestamp=DUE,
        question_type=qtype,
        from_source=True,
        is_private=False,
        review_flag=False,
        **kw,
    )


def _assignment(course_id, name, enforce_due):
    return Assignment(
        course=course_id,
        name=name,
        points=10,
        released=False,
        duedate=DUE,
        visible=True,
        from_source=False,
        enforce_due=enforce_due,
    )


def _log(sid, div_id, when, event="mChoice", act="answer"):
    return Useinfo(
        sid=sid, div_id=div_id, course_id=COURSE, event=event, act=act, timestamp=when
    )


def _page_view(sid, when):
    return _log(
        sid, f"/ns/books/published/{COURSE}/{CHAPTER}/{PAGE}.html", when, event="page"
    )


@pytest.fixture(scope="session")
async def course_with_assignments(init_test_db):
    course = await _make_course(COURSE)
    other = await _make_course(OTHER_COURSE)
    for sid in STUDENTS + [INSTRUCTOR]:
        user = await _make_user(sid, course)
        await create_user_course_entry(user.id, course.id)
        if sid == INSTRUCTOR:
            await create_instructor_course_entry(user.id, course.id)

    async with async_session() as session:
        chapter = Chapter(
            chapter_name="QA Chapter",
            course_id=BOOK,
            chapter_label=CHAPTER,
            chapter_num=1,
        )
        session.add(chapter)
        await session.flush()
        session.add(
            SubChapter(
                sub_chapter_name="QA Page",
                chapter_id=chapter.id,
                sub_chapter_label=PAGE,
                skipreading=False,
                sub_chapter_num=1,
            )
        )
        page_q = _question(PAGE_Q, "page")
        exercise = _question("qa_mc", "mchoice", subchapter="qa_elsewhere")
        session.add_all(
            [
                page_q,
                exercise,
                # the activities on the reading page
                _question("qa_act1", "mchoice"),
                _question("qa_act2", "activecode"),
                _question("qa_opt", "mchoice", optional=True),
            ]
        )
        enforced = _assignment(course.id, "qa enforced", True)
        lenient = _assignment(course.id, "qa lenient", False)
        elsewhere = _assignment(other.id, "qa elsewhere", True)
        session.add_all([enforced, lenient, elsewhere])
        await session.flush()
        for a in (enforced, lenient):
            session.add_all(
                [
                    AssignmentQuestion(
                        assignment_id=a.id,
                        question_id=exercise.id,
                        points=1,
                        autograde="pct_correct",
                        which_to_grade="best_answer",
                        sorting_priority=2,
                    ),
                    AssignmentQuestion(
                        assignment_id=a.id,
                        question_id=page_q.id,
                        points=1,
                        autograde="interaction",
                        which_to_grade="best_answer",
                        sorting_priority=1,
                        reading_assignment=True,
                        activities_required=3,
                    ),
                ]
            )
        session.add_all(
            [
                DeadlineException(course_id=course.id, sid="qa_s2", duedate=7),
                DeadlineException(course_id=course.id, sid="qa_s3", duedate=5),
                DeadlineException(
                    course_id=course.id,
                    sid="qa_s3",
                    assignment_id=enforced.id,
                    duedate=1,
                ),
            ]
        )
        session.add_all(
            [
                # the exercise
                MchoiceAnswers(
                    sid="qa_s1",
                    div_id="qa_mc",
                    course_name=COURSE,
                    correct=False,
                    answer="0",
                    timestamp=at(-5),
                ),
                MchoiceAnswers(
                    sid="qa_s1",
                    div_id="qa_mc",
                    course_name=COURSE,
                    correct=True,
                    answer="1",
                    timestamp=at(20),
                ),
                MchoiceAnswers(
                    sid="qa_s2",
                    div_id="qa_mc",
                    course_name=COURSE,
                    correct=True,
                    answer="1",
                    timestamp=at(days=2),
                ),
                # the reading: page view + 2 activities = 3 for s1
                _page_view("qa_s1", at(-30)),
                _page_view("qa_s1", at(-29)),
                _log("qa_s1", "qa_act1", at(-20)),
                _log("qa_s1", "qa_act1", at(-19)),
                _log("qa_s1", "qa_act2", at(-10), event="activecode", act="run"),
                # s2: page view in time; an activity after even the extension
                _page_view("qa_s2", at(-30)),
                _log("qa_s2", "qa_act1", at(days=8)),
                # s3: an optional activity, and work from before the term
                _log("qa_s3", "qa_opt", at(-10)),
                _page_view("qa_s3", datetime.datetime(2026, 7, 1)),
                _log("qa_s3", "qa_act1", datetime.datetime(2026, 7, 1)),
                # the instructor is never counted
                _page_view(INSTRUCTOR, at(-30)),
            ]
        )
        await session.commit()
    return {
        "course": course,
        "other": other,
        "enforced": enforced.id,
        "lenient": lenient.id,
        "elsewhere": elsewhere.id,
    }


async def test_assignment_list_is_the_courses_own(course_with_assignments):
    ids = course_with_assignments
    with engine.connect() as conn:
        options = fetch_assignments(conn, ids["course"].id)
    assert {o["value"] for o in options} == {ids["enforced"], ids["lenient"]}


async def test_fetch_assignment_is_scoped_to_the_course(course_with_assignments):
    ids = course_with_assignments
    with engine.connect() as conn:
        assert fetch_assignment(conn, ids["course"].id, ids["enforced"]).enforce_due
        assert fetch_assignment(conn, ids["course"].id, ids["elsewhere"]) is None


async def test_parts_split_into_exercises_and_readings(course_with_assignments):
    with engine.connect() as conn:
        exercises, readings = fetch_assignment_parts(
            conn, course_with_assignments["enforced"]
        )
    assert [q.name for q in exercises] == ["qa_mc"]
    assert readings == [
        ReadingRef(
            name=PAGE_Q,
            chapter=CHAPTER,
            subchapter=PAGE,
            label="QA Page",
            base_course=BOOK,
            activities_required=3,
        )
    ]


async def test_cutoffs_apply_extensions(course_with_assignments):
    ids = course_with_assignments
    with engine.connect() as conn:
        a = fetch_assignment(conn, ids["course"].id, ids["enforced"])
        cutoffs, extended = assignment_cutoffs(conn, ids["course"].id, a, STUDENTS)
    assert cutoffs == {
        "qa_s1": DUE,
        # an extension for every assignment
        "qa_s2": at(days=7),
        # one for this assignment wins over one for every assignment
        "qa_s3": at(days=1),
    }
    assert extended == 2


async def test_no_cutoffs_when_late_work_is_allowed(course_with_assignments):
    ids = course_with_assignments
    with engine.connect() as conn:
        a = fetch_assignment(conn, ids["course"].id, ids["lenient"])
        assert assignment_cutoffs(conn, ids["course"].id, a, STUDENTS) == (None, 0)


def _exercise_counts(assignment_key, ids):
    with engine.connect() as conn:
        a = fetch_assignment(conn, ids["course"].id, ids[assignment_key])
        exercises, _ = fetch_assignment_parts(conn, a.id)
        roster = fetch_roster(conn, COURSE)
        cutoffs, _ = assignment_cutoffs(conn, ids["course"].id, a, roster)
        df = question_outcomes(conn, COURSE, BOOK, exercises, cutoffs, roster)
    row = df.iloc[0]
    return [row.first_try, row.later, row.never_correct, row.tried, row.not_tried]


async def test_exercise_outcomes_respect_the_due_date(course_with_assignments):
    # s1's right answer came after the due date; s2's inside their extension.
    #                                              first later never tried none
    assert _exercise_counts("enforced", course_with_assignments) == [1, 0, 1, 0, 1]


async def test_exercise_outcomes_count_late_work_when_allowed(
    course_with_assignments,
):
    assert _exercise_counts("lenient", course_with_assignments) == [1, 1, 0, 0, 1]


def _reading_counts(assignment_key, ids):
    with engine.connect() as conn:
        a = fetch_assignment(conn, ids["course"].id, ids[assignment_key])
        _, readings = fetch_assignment_parts(conn, a.id)
        roster = fetch_roster(conn, COURSE)
        cutoffs, _ = assignment_cutoffs(conn, ids["course"].id, a, roster)
        df = reading_progress(conn, COURSE, BOOK, readings, roster, cutoffs)
    row = df.iloc[0]
    return [row.completed, row.in_progress, row.not_started]


async def test_reading_progress(course_with_assignments):
    # s1 did all 3; s2 only opened the page in time; s3's work doesn't count.
    assert _reading_counts("enforced", course_with_assignments) == [1, 1, 1]


async def test_reading_progress_counts_late_work_when_allowed(
    course_with_assignments,
):
    # s2's late activity now counts, but 2 of 3 is still in progress.
    assert _reading_counts("lenient", course_with_assignments) == [1, 1, 1]
