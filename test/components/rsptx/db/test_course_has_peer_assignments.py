"""
Tests for course_has_peer_assignments, which decides whether the user menus
offer "Peer Instruction (Student)".
"""

import datetime

import pytest

from rsptx.db.crud import (
    course_has_peer_assignments,
    create_assignment,
    create_course,
    fetch_course,
)
from rsptx.db.models import AssignmentValidator, CoursesValidator

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_course(course_name):
    """A course of its own: other modules add peer assignments to test_course_1."""
    existing = await fetch_course(course_name)
    if existing:
        return existing
    await create_course(
        CoursesValidator(
            course_name=course_name,
            base_course="overview",
            term_start_date=datetime.date(2026, 8, 24),
            login_required=True,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Peer Menu University",
            new_server=True,
        )
    )
    return await fetch_course(course_name)


async def _add_assignment(course_id, name, **kwargs):
    fields = dict(
        course=course_id,
        name=name,
        points=0,
        released=False,
        description="",
        duedate=datetime.datetime(2099, 1, 1),
        visible=True,
        from_source=False,
        is_peer=False,
        current_index=0,
        peer_async_visible=False,
    )
    fields.update(kwargs)
    return await create_assignment(AssignmentValidator(**fields))


async def test_is_peer_flag(init_test_db):
    course = await _make_course("peer_menu_flag_course")

    # No assignments, then only a regular assignment.
    assert await course_has_peer_assignments(course.id) is False
    await _add_assignment(course.id, "peer_menu_regular")
    assert await course_has_peer_assignments(course.id) is False

    # A hidden peer assignment counts: visibility is deliberately ignored.
    await _add_assignment(
        course.id, "peer_menu_hidden_peer", is_peer=True, visible=False
    )
    assert await course_has_peer_assignments(course.id) is True


async def test_kind_peer_without_flag(init_test_db):
    # Some assignments carry only kind == "Peer", with is_peer left False.
    course = await _make_course("peer_menu_kind_course")
    assert await course_has_peer_assignments(course.id) is False
    await _add_assignment(course.id, "peer_menu_kind_only", kind="Peer")
    assert await course_has_peer_assignments(course.id) is True


async def test_unknown_course(init_test_db):
    assert await course_has_peer_assignments(-1) is False
