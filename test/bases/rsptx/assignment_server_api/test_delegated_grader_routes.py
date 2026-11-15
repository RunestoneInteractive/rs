"""Route tests for the assignment-scoped delegated-grader contract."""

import datetime
import uuid

import pytest

from rsptx.db.crud import (
    create_assignment,
    create_assignment_question,
    create_question,
    create_user_course_entry,
    fetch_course,
    fetch_user,
    fetch_users_for_course,
    set_assignment_blind_grading,
)
from rsptx.db.models import (
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
    ShortanswerAnswers,
)
from rsptx.db.async_session import async_session
from rsptx.response_helpers.core import canonical_utcnow

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


async def _add_short_answer_question(assignment_id: int):
    course = await fetch_course("test_course_1")
    question = await create_question(
        QuestionValidator(
            base_course=course.base_course,
            name=f"delegated_short_answer_{uuid.uuid4().hex}",
            chapter="ch1",
            subchapter="sub1",
            author="test_instructor",
            question="Explain your answer.",
            timestamp=canonical_utcnow(),
            question_type="shortanswer",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment_id,
            question_id=question.id,
            points=5,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="manual",
        )
    )
    return question


async def _ensure_test_student_is_enrolled():
    course = await fetch_course("test_course_1")
    student = await fetch_user("testuser1")
    enrolled = {
        user.username for user in await fetch_users_for_course(course.course_name)
    }
    if student.username not in enrolled:
        await create_user_course_entry(student.id, course.id)
    return course, student


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


async def test_delegated_grader_reads_answers_without_student_identity(
    auth_delegated_grader_client,
):
    assignment = await _make_assignment(blind_grading=True)
    question = await _add_short_answer_question(assignment.id)
    course, student = await _ensure_test_student_is_enrolled()
    async with async_session.begin() as session:
        session.add(
            ShortanswerAnswers(
                timestamp=canonical_utcnow(),
                sid=student.username,
                div_id=question.name,
                course_name=course.course_name,
                answer="Because the invariant is preserved.",
            )
        )

    path = f"/grader/assignments/{assignment.id}/questions/{question.id}/answers"
    response = await auth_delegated_grader_client.get(path)

    assert response.status_code == 200
    payload = response.json()
    answer = next(
        item
        for item in payload["detail"]["answers"]
        if item["answer"] == "Because the invariant is preserved."
    )
    assert answer["student_label"].startswith("Student ")
    assert student.username not in answer["student_token"]
    assert {"sid", "first_name", "last_name", "email"}.isdisjoint(answer)
    assert student.username not in response.text
    assert student.first_name not in response.text
    assert student.last_name not in response.text
    assert student.email not in response.text

    repeated = await auth_delegated_grader_client.get(path)
    repeated_answer = next(
        item
        for item in repeated.json()["detail"]["answers"]
        if item["answer"] == "Because the invariant is preserved."
    )
    assert repeated_answer["student_token"] == answer["student_token"]
    assert repeated_answer["student_label"] == answer["student_label"]


async def test_anonymous_answers_reject_identified_assignment(
    auth_delegated_grader_client,
):
    assignment = await _make_assignment(blind_grading=False)

    response = await auth_delegated_grader_client.get(
        f"/grader/assignments/{assignment.id}/questions/1/answers"
    )

    assert response.status_code == 403


async def test_anonymous_answers_reject_student(auth_student_client):
    assignment = await _make_assignment(blind_grading=True)

    response = await auth_student_client.get(
        f"/grader/assignments/{assignment.id}/questions/1/answers"
    )

    assert response.status_code == 403
