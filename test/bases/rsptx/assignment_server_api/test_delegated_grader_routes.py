"""Route tests for the assignment-scoped delegated-grader contract."""

import datetime
import uuid

import pytest

from rsptx.db.crud import (
    create_assignment,
    fetch_course,
    set_assignment_blind_grading,
)
from rsptx.db.models import AssignmentValidator


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_assignment(*, blind_grading: bool):
    course = await fetch_course("test_course_1")
    assignment = await create_assignment(
        AssignmentValidator(
            course=course.id,
            name=f"Delegated grader route {uuid.uuid4().hex}",
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
    if blind_grading:
        await set_assignment_blind_grading(assignment.id, True)
    return assignment


async def test_instructor_capabilities_keep_student_identities(
    auth_instructor_client,
):
    assignment = await _make_assignment(blind_grading=False)

    response = await auth_instructor_client.get(
        f"/grader/assignments/{assignment.id}/capabilities"
    )

    assert response.status_code == 200
    assert response.json()["detail"] == {
        "role": "instructor",
        "can_grade": True,
        "can_view_student_identities": True,
        "assignment_blind_grading": False,
    }


async def test_delegated_grader_capabilities_are_anonymous_for_blind_assignment(
    auth_delegated_grader_client,
):
    assignment = await _make_assignment(blind_grading=True)

    response = await auth_delegated_grader_client.get(
        f"/grader/assignments/{assignment.id}/capabilities"
    )

    assert response.status_code == 200
    assert response.json()["detail"] == {
        "role": "delegated_grader",
        "can_grade": True,
        "can_view_student_identities": False,
        "assignment_blind_grading": True,
    }


async def test_delegated_grader_cannot_grade_identified_assignment(
    auth_delegated_grader_client,
):
    assignment = await _make_assignment(blind_grading=False)

    response = await auth_delegated_grader_client.get(
        f"/grader/assignments/{assignment.id}/capabilities"
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Grading access denied"


async def test_student_cannot_claim_blind_grading_capabilities(auth_student_client):
    assignment = await _make_assignment(blind_grading=True)

    response = await auth_student_client.get(
        f"/grader/assignments/{assignment.id}/capabilities"
    )

    assert response.status_code == 403


async def test_delegated_grader_still_cannot_read_identity_bearing_answers(
    auth_delegated_grader_client,
):
    response = await auth_delegated_grader_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": 1, "question_id": 1},
    )

    assert response.status_code == 401
