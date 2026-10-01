"""Tests for the dormant delegated-grader permission foundation."""

import asyncio
import datetime

import pytest

from rsptx.auth.grader_permissions import (
    GraderRole,
    resolve_grader_capabilities,
)
from rsptx.db.crud import (
    create_assignment,
    create_instructor_course_entry,
    fetch_assignment_grading_policy,
    fetch_course,
    fetch_course_grader,
    fetch_course_graders,
    grant_course_grader,
    is_course_grader,
    revoke_course_grader,
    set_assignment_blind_grading,
)
from rsptx.db.crud.user import create_user
from rsptx.db.models import AssignmentValidator, AuthUserValidator


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_user(username: str):
    return await create_user(
        AuthUserValidator(
            username=username,
            first_name="Blind",
            last_name="Grader",
            password="xxx",
            email=f"{username}@example.com",
            course_name="overview",
            course_id=1,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2026, 1, 1),
            modified_on=datetime.datetime(2026, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )


async def _make_assignment(course_id: int, name: str):
    return await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=0,
            released=False,
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
        )
    )


@pytest.fixture(scope="session")
async def grader_permission_world(init_test_db):
    course = await fetch_course("test_course_1")
    other_course = await fetch_course("overview")
    delegated = await _make_user("blind_grader_delegated")
    scoped = await _make_user("blind_grader_scoped")
    concurrent = await _make_user("blind_grader_concurrent")
    revocable = await _make_user("blind_grader_revocable")
    instructor = await _make_user("blind_grader_instructor")
    unrelated = await _make_user("blind_grader_unrelated")
    identified_assignment = await _make_assignment(
        course.id, "Blind grading permissions identified"
    )
    blind_assignment = await _make_assignment(
        course.id, "Blind grading permissions anonymous"
    )
    await set_assignment_blind_grading(blind_assignment.id, True)
    await grant_course_grader(course.id, delegated.id)
    await grant_course_grader(course.id, instructor.id)
    await create_instructor_course_entry(instructor.id, course.id)

    return {
        "course": course,
        "other_course": other_course,
        "delegated": delegated,
        "scoped": scoped,
        "concurrent": concurrent,
        "revocable": revocable,
        "instructor": instructor,
        "unrelated": unrelated,
        "identified_assignment": identified_assignment,
        "blind_assignment": blind_assignment,
    }


async def test_course_grader_grant_is_idempotent_and_course_scoped(
    grader_permission_world,
):
    world = grader_permission_world
    first = await grant_course_grader(world["course"].id, world["scoped"].id)
    second = await grant_course_grader(world["course"].id, world["scoped"].id)

    assert first.id == second.id
    assert await is_course_grader(world["course"].id, world["scoped"].id)
    assert not await is_course_grader(world["other_course"].id, world["scoped"].id)
    memberships = await fetch_course_graders(world["course"].id)
    assert sum(row.user_id == world["scoped"].id for row in memberships) == 1


async def test_concurrent_course_grader_grants_return_the_same_membership(
    grader_permission_world,
):
    world = grader_permission_world
    first, second = await asyncio.gather(
        grant_course_grader(world["course"].id, world["concurrent"].id),
        grant_course_grader(world["course"].id, world["concurrent"].id),
    )

    assert first.id == second.id
    memberships = await fetch_course_graders(world["course"].id)
    assert sum(row.user_id == world["concurrent"].id for row in memberships) == 1


async def test_course_grader_can_be_revoked(grader_permission_world):
    world = grader_permission_world
    await grant_course_grader(world["course"].id, world["revocable"].id)

    assert await revoke_course_grader(world["course"].id, world["revocable"].id)
    assert await fetch_course_grader(world["course"].id, world["revocable"].id) is None
    assert not await revoke_course_grader(world["course"].id, world["revocable"].id)


async def test_assignment_blind_grading_defaults_off_and_can_be_changed(
    grader_permission_world,
):
    assignment = grader_permission_world["identified_assignment"]
    policy = await fetch_assignment_grading_policy(assignment.id)

    assert policy is not None
    assert policy.course_id == grader_permission_world["course"].id
    assert policy.blind_grading is False

    assert await set_assignment_blind_grading(assignment.id, True)
    assert (await fetch_assignment_grading_policy(assignment.id)).blind_grading is True
    assert await set_assignment_blind_grading(assignment.id, False)
    assert (await fetch_assignment_grading_policy(assignment.id)).blind_grading is False
    assert not await set_assignment_blind_grading(999_999_999, True)
    assert await fetch_assignment_grading_policy(999_999_999) is None


async def test_delegated_grader_is_fail_closed_for_identified_assignment(
    grader_permission_world,
):
    world = grader_permission_world
    capabilities = await resolve_grader_capabilities(
        user_id=world["delegated"].id,
        course_id=world["course"].id,
        assignment_id=world["identified_assignment"].id,
    )

    assert capabilities.role is GraderRole.NONE
    assert capabilities.can_grade is False
    assert capabilities.can_view_student_identities is False
    assert capabilities.assignment_blind_grading is False


async def test_delegated_grader_can_grade_only_anonymous_assignment(
    grader_permission_world,
):
    world = grader_permission_world
    capabilities = await resolve_grader_capabilities(
        user_id=world["delegated"].id,
        course_id=world["course"].id,
        assignment_id=world["blind_assignment"].id,
    )

    assert capabilities.role is GraderRole.DELEGATED_GRADER
    assert capabilities.can_grade is True
    assert capabilities.can_view_student_identities is False
    assert capabilities.assignment_blind_grading is True


async def test_full_instructor_takes_precedence_over_delegated_membership(
    grader_permission_world,
):
    world = grader_permission_world
    capabilities = await resolve_grader_capabilities(
        user_id=world["instructor"].id,
        course_id=world["course"].id,
        assignment_id=world["blind_assignment"].id,
    )

    assert capabilities.role is GraderRole.INSTRUCTOR
    assert capabilities.can_grade is True
    assert capabilities.can_view_student_identities is True
    assert capabilities.assignment_blind_grading is True


async def test_unrelated_user_and_cross_course_request_have_no_capabilities(
    grader_permission_world,
):
    world = grader_permission_world
    unrelated = await resolve_grader_capabilities(
        user_id=world["unrelated"].id,
        course_id=world["course"].id,
        assignment_id=world["blind_assignment"].id,
    )
    wrong_course = await resolve_grader_capabilities(
        user_id=world["delegated"].id,
        course_id=world["other_course"].id,
        assignment_id=world["blind_assignment"].id,
    )

    assert unrelated.role is GraderRole.NONE
    assert unrelated.can_grade is False
    assert wrong_course.role is GraderRole.NONE
    assert wrong_course.can_grade is False
