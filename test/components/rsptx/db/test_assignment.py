"""
Tests for assignment CRUD operations.
"""
import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (
    fetch_assignments,
    fetch_one_assignment,
    create_assignment,
    update_assignment,
    create_assignment_question,
    create_question,
)
from rsptx.db.models import AssignmentValidator, AssignmentQuestionValidator, QuestionValidator
from rsptx.response_helpers.core import canonical_utcnow

COURSE_NAME = "test_course_1"
ASSIGN_NAME = "crud_test_assignment"
Q_NAME = "crud_assign_question_1"


@pytest.fixture(scope="session")
async def test_question_for_assignment(init_test_db):
    """A question to attach to assignments."""
    return await create_question(
        QuestionValidator(
            base_course=COURSE_NAME,
            name=Q_NAME,
            chapter="ch1",
            subchapter="sub1",
            author="testuser1",
            question="Assignment test question?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )


@pytest.fixture(scope="session")
async def test_assignment(test_course, test_question_for_assignment):
    """Create an assignment for this module's tests."""
    assignment = await create_assignment(
        AssignmentValidator(
            course=test_course.id,
            name=ASSIGN_NAME,
            points=10,
            released=False,
            description="CRUD test assignment",
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
        )
    )
    return assignment


async def test_create_assignment(test_assignment):
    """Created assignment has an id and correct name."""
    assert test_assignment is not None
    assert test_assignment.id is not None
    assert test_assignment.name == ASSIGN_NAME
    assert test_assignment.course is not None


async def test_fetch_assignments(test_assignment):
    """fetch_assignments returns a list that includes our assignment."""
    assignments = await fetch_assignments(COURSE_NAME, fetch_all=True)
    names = [a.name for a in assignments]
    assert ASSIGN_NAME in names


async def test_fetch_one_assignment(test_assignment):
    """fetch_one_assignment returns the correct assignment by id."""
    fetched = await fetch_one_assignment(test_assignment.id)
    assert fetched is not None
    assert fetched.id == test_assignment.id
    assert fetched.name == ASSIGN_NAME


async def test_update_assignment(test_assignment):
    """Updating the description persists."""
    updated = AssignmentValidator(**test_assignment.dict())
    updated.description = "Updated description"
    await update_assignment(updated)

    fetched = await fetch_one_assignment(test_assignment.id)
    assert fetched.description == "Updated description"


async def test_create_assignment_question(test_assignment, test_question_for_assignment):
    """Adding a question to an assignment persists."""
    aq = await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=test_assignment.id,
            question_id=test_question_for_assignment.id,
            points=10,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="pct_correct",
        )
    )
    assert aq is not None
    assert aq.id is not None
    assert aq.assignment_id == test_assignment.id
    assert aq.question_id == test_question_for_assignment.id


async def test_fetch_visible_assignments(test_assignment):
    """is_visible filter returns our visible assignment."""
    visible = await fetch_assignments(COURSE_NAME, is_visible=True)
    names = [a.name for a in visible]
    assert ASSIGN_NAME in names
