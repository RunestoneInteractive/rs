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
from rsptx.db.models import QuestionValidator
from rsptx.response_helpers.core import canonical_utcnow

BASE_COURSE = "test_course_1"
USER = "testuser1"
Q_NAME = "test_question_crud_1"


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
