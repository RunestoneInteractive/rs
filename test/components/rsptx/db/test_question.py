"""
Tests for question and question_grade CRUD operations.
"""

import asyncio
import datetime
import pytest
from sqlalchemy import func, select, update

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (
    fetch_question,
    create_question,
    create_question_grade_entry,
    fetch_question_grade,
    update_question_grade_entry,
    upsert_question_grade_entry,
)
from rsptx.db.crud.question import copy_question
from rsptx.db.async_session import async_session
from rsptx.db.models import Chapter, QuestionGrade, QuestionValidator, SubChapter
from rsptx.response_helpers.core import canonical_utcnow

BASE_COURSE = "test_course_1"
USER = "testuser1"
Q_NAME = "test_question_crud_1"
SOURCE_BASE_COURSE = "test_question_source_book"


@pytest.fixture(scope="session")
async def test_question(init_test_db):
    """Create a question for use across tests in this module."""
    q = await create_question(
        QuestionValidator(
            base_course=BASE_COURSE,
            name=Q_NAME,
            chapter="ch1",
            subchapter="sub1",
            author="testuser1",
            question="What is 1+1?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )
    return q


async def test_create_question(test_question):
    """Created question gets an id and correct fields."""
    assert test_question is not None
    assert test_question.id is not None
    assert test_question.name == Q_NAME
    assert test_question.base_course == BASE_COURSE


async def test_fetch_question_by_name(test_question):
    """Fetch by name returns the created question."""
    fetched = await fetch_question(Q_NAME, basecourse=BASE_COURSE)
    assert fetched is not None
    assert fetched.name == Q_NAME


async def test_create_question_grade(test_question):
    """Creating a question grade returns a validator with the right values."""
    qg = await create_question_grade_entry(USER, BASE_COURSE, Q_NAME, 90)
    assert qg is not None
    assert qg.sid == USER
    assert qg.course_name == BASE_COURSE
    assert qg.div_id == Q_NAME
    assert qg.score == 90
    assert qg.comment == "autograded"


async def test_fetch_question_grade(test_question):
    """Fetching the grade we created returns the right score."""
    fetched = await fetch_question_grade(USER, BASE_COURSE, Q_NAME)
    assert fetched is not None
    assert fetched.score == 90


async def test_create_duplicate_question_grade_returns_none(test_question):
    """A duplicate insert (same sid/course/div_id) is silently swallowed and returns None."""
    result = await create_question_grade_entry(USER, BASE_COURSE, Q_NAME, 75)
    assert result is None


async def test_update_question_grade(test_question):
    """update_question_grade_entry merges a new score."""
    existing = await fetch_question_grade(USER, BASE_COURSE, Q_NAME)
    updated = await update_question_grade_entry(
        USER, BASE_COURSE, Q_NAME, 100, qge_id=existing.id
    )
    assert updated is not None
    assert updated.score == 100


async def _hand_grade(div_id, comment):
    """Mark USER's grade for ``div_id`` the way the grading page does."""
    async with async_session.begin() as session:
        await session.execute(
            update(QuestionGrade)
            .where(
                (QuestionGrade.sid == USER)
                & (QuestionGrade.course_name == BASE_COURSE)
                & (QuestionGrade.div_id == div_id)
            )
            .values(comment=comment)
        )


async def test_upsert_creates_a_missing_grade(init_test_db):
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_new", 5, policy="last"
    )
    assert written
    assert (row.sid, row.div_id, row.score) == (USER, "upsert_new", 5)
    assert row.comment == "autograded"


async def test_upsert_first_keeps_the_first_score(init_test_db):
    await upsert_question_grade_entry(USER, BASE_COURSE, "upsert_first", 3, "first")
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_first", 9, policy="first"
    )
    assert not written
    assert row.score == 3


async def test_upsert_last_replaces_the_score(init_test_db):
    await upsert_question_grade_entry(USER, BASE_COURSE, "upsert_last", 9, "last")
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_last", 2, policy="last"
    )
    assert written
    assert row.score == 2
    fetched = await fetch_question_grade(USER, BASE_COURSE, "upsert_last")
    assert fetched.score == 2


async def test_upsert_best_keeps_the_higher_score(init_test_db):
    await upsert_question_grade_entry(USER, BASE_COURSE, "upsert_best", 6, "best")
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_best", 4, policy="best", max_score=10
    )
    assert not written
    assert row.score == 6
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_best", 8, policy="best", max_score=10
    )
    assert written
    assert row.score == 8


async def test_upsert_best_replaces_a_score_above_the_maximum(init_test_db):
    # Earned where the question is worth 2; in this assignment it is worth 1.
    await upsert_question_grade_entry(USER, BASE_COURSE, "upsert_over", 2, "best")
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_over", 1, policy="best", max_score=1
    )
    assert written
    assert row.score == 1


@pytest.mark.parametrize("policy", ["first", "last", "best"])
async def test_upsert_never_overwrites_a_hand_grade(init_test_db, policy):
    div_id = f"upsert_hand_{policy}"
    await upsert_question_grade_entry(USER, BASE_COURSE, div_id, 1, "last")
    await _hand_grade(div_id, "see me after class")
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, div_id, 10, policy=policy, max_score=10
    )
    assert not written
    assert row.score == 1
    assert row.comment == "see me after class"


async def test_upsert_rescores_a_blank_comment(init_test_db):
    # Rows from before the hand-graded marker have no comment; the autograder
    # may still score them.
    await upsert_question_grade_entry(USER, BASE_COURSE, "upsert_blank", 1, "last")
    await _hand_grade("upsert_blank", None)
    row, written = await upsert_question_grade_entry(
        USER, BASE_COURSE, "upsert_blank", 7, policy="last"
    )
    assert written
    assert row.score == 7


@pytest.mark.parametrize("policy", ["first", "last", "best"])
async def test_concurrent_upserts_store_one_row(init_test_db, policy):
    # The bug: submissions arriving together each found no row and each
    # inserted, and all but one failed on the unique index.
    div_id = f"upsert_race_{policy}"
    results = await asyncio.gather(
        *(
            upsert_question_grade_entry(USER, BASE_COURSE, div_id, s, policy=policy)
            for s in range(1, 9)
        )
    )
    assert sum(written for _, written in results) >= 1
    async with async_session() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(QuestionGrade)
            .where(
                (QuestionGrade.sid == USER)
                & (QuestionGrade.course_name == BASE_COURSE)
                & (QuestionGrade.div_id == div_id)
            )
        )
    assert count == 1
    if policy == "best":
        stored = await fetch_question_grade(USER, BASE_COURSE, div_id)
        assert stored.score == 8


@pytest.fixture(scope="session")
async def target_book_toc(init_test_db):
    """Give BASE_COURSE a one-section toc for copies to land in."""
    async with async_session() as session:
        chapter = Chapter(
            chapter_name="Chapter One",
            course_id=BASE_COURSE,
            chapter_label="ch1",
            chapter_num=1,
        )
        session.add(chapter)
        await session.flush()
        session.add(
            SubChapter(
                sub_chapter_name="Section One",
                chapter_id=chapter.id,
                sub_chapter_label="sub1",
                skipreading=False,
                sub_chapter_num=1,
            )
        )
        await session.commit()
    return "ch1", "sub1"


async def make_question(name, base_course, chapter, subchapter):
    return await create_question(
        QuestionValidator(
            base_course=base_course,
            name=name,
            chapter=chapter,
            subchapter=subchapter,
            author=USER,
            question="What is 1+1?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )


async def test_copy_question_rehomes_chapter_from_another_book(target_book_toc):
    """A copy re-homed to a new base course lands in that book's toc, not the source's.

    Keeping the source labels would leave the copy invisible to every view that
    joins the chapters/sub_chapters tables.
    """
    source = await make_question(
        "test_copy_src_1", SOURCE_BASE_COURSE, "unit-frq-practice", "HiddenWord"
    )

    copy = await copy_question(
        original_question_id=source.id,
        new_name="test_copy_dst_1",
        new_owner=USER,
        new_base_course=BASE_COURSE,
    )

    assert copy.base_course == BASE_COURSE
    assert (copy.chapter, copy.subchapter) == target_book_toc


async def test_copy_question_keeps_labels_the_target_book_has(target_book_toc):
    """A copy within the same book keeps its chapter and section."""
    source = await make_question("test_copy_src_2", BASE_COURSE, "ch1", "sub1")

    copy = await copy_question(
        original_question_id=source.id,
        new_name="test_copy_dst_2",
        new_owner=USER,
        new_base_course=BASE_COURSE,
    )

    assert (copy.chapter, copy.subchapter) == ("ch1", "sub1")


async def test_copy_question_keeps_labels_when_target_book_has_no_toc(init_test_db):
    """With no toc to re-home into, the original labels are left alone."""
    source = await make_question(
        "test_copy_src_3", SOURCE_BASE_COURSE, "unit-frq-practice", "HiddenWord"
    )

    copy = await copy_question(
        original_question_id=source.id,
        new_name="test_copy_dst_3",
        new_owner=USER,
        new_base_course="test_question_book_without_toc",
    )

    assert (copy.chapter, copy.subchapter) == ("unit-frq-practice", "HiddenWord")


async def test_fetch_question_grades_for(test_question):
    """The bulk fetch returns graded questions keyed by div_id and skips the rest."""
    from rsptx.db.crud import fetch_question_grades_for

    await create_question_grade_entry(USER, BASE_COURSE, "bulk_grade_q1", 3)
    await create_question_grade_entry(USER, BASE_COURSE, "bulk_grade_q2", 0)
    await create_question_grade_entry("someone_else", BASE_COURSE, "bulk_grade_q1", 9)

    grades = await fetch_question_grades_for(
        USER, BASE_COURSE, ["bulk_grade_q1", "bulk_grade_q2", "bulk_grade_none"]
    )
    assert set(grades) == {"bulk_grade_q1", "bulk_grade_q2"}
    assert grades["bulk_grade_q1"].score == 3
    assert grades["bulk_grade_q2"].score == 0
    assert await fetch_question_grades_for(USER, BASE_COURSE, []) == {}
