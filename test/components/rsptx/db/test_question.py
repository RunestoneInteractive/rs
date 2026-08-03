"""
Tests for question and question_grade CRUD operations.
"""

import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (
    fetch_question,
    create_question,
    create_question_grade_entry,
    fetch_question_grade,
    update_question_grade_entry,
)
from rsptx.db.crud.question import copy_question
from rsptx.db.async_session import async_session
from rsptx.db.models import Chapter, QuestionValidator, SubChapter
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
