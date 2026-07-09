"""
Functional tests for instructor routes in the assignment server.

Routes decorated with @instructor_role_required() call auth_manager() directly
inside the decorator — not via FastAPI's Depends() — so they are tested via
the ``auth_instructor_client`` fixture, which patches auth_manager at the
endpoint_validators module level and uses a real instructor DB user.

Tests are async functions sharing the session event loop with the asyncpg
connection pool.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ---------------------------------------------------------------------------
# GET /instructor/assignments
# ---------------------------------------------------------------------------


async def test_get_assignments(auth_instructor_client):
    """Instructor can list assignments for their course."""
    resp = await auth_instructor_client.get("/instructor/assignments")
    assert resp.status_code == 200
    data = resp.json()
    assert "detail" in data
    assert "assignments" in data["detail"]


# ---------------------------------------------------------------------------
# POST /instructor/assignments
# ---------------------------------------------------------------------------


async def test_create_assignment(auth_instructor_client):
    """Instructor can create a new assignment."""
    payload = {
        "name": "route_test_assignment",
        "description": "Created by route test",
        "duedate": "2099-01-01T00:00:00",
        "points": 10,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    resp = await auth_instructor_client.post("/instructor/assignments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["detail"]["status"] == "success"
    assert "id" in data["detail"]


# ---------------------------------------------------------------------------
# GET /instructor/assignments/{id}
# ---------------------------------------------------------------------------


async def test_get_assignment_by_id(auth_instructor_client):
    """Instructor can fetch a specific assignment by id after creating one."""
    payload = {
        "name": "route_test_assignment_for_get",
        "description": "For GET by id test",
        "duedate": "2099-01-01T00:00:00",
        "points": 5,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    create_resp = await auth_instructor_client.post(
        "/instructor/assignments", json=payload
    )
    assert create_resp.status_code == 201
    assignment_id = create_resp.json()["detail"]["id"]

    get_resp = await auth_instructor_client.get(
        f"/instructor/assignments/{assignment_id}"
    )
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "assignment" in data["detail"]
    assert data["detail"]["assignment"]["id"] == assignment_id


# ---------------------------------------------------------------------------
# GET /instructor/course_roster
# ---------------------------------------------------------------------------


async def test_course_roster(auth_instructor_client):
    """Instructor can retrieve the course roster with a students list."""
    resp = await auth_instructor_client.get("/instructor/course_roster")
    assert resp.status_code == 200
    data = resp.json()
    assert "students" in data["detail"]
    assert isinstance(data["detail"]["students"], list)


async def test_course_roster_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get("/instructor/course_roster")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /instructor/assignments/{id}/late_students
# ---------------------------------------------------------------------------

import datetime  # noqa: E402

from rsptx.db.crud import (  # noqa: E402
    create_assignment,
    create_assignment_question,
    create_question,
    create_useinfo_entry,
    fetch_course,
)
from rsptx.db.models import (  # noqa: E402
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
    UseinfoValidation,
)
from rsptx.response_helpers.core import canonical_utcnow  # noqa: E402

LATE_COURSE = "test_course_1"
# Enforced assignments use a due date in the past so we can record submissions
# on either side of it.
LATE_DUEDATE = datetime.datetime(2020, 1, 1)
BEFORE_DUE = datetime.datetime(2019, 6, 1)
AFTER_DUE = datetime.datetime(2020, 6, 1)


async def _add_question(name):
    return await create_question(
        QuestionValidator(
            base_course=LATE_COURSE,
            name=name,
            chapter="ch1",
            subchapter="sub1",
            author="test_instructor",
            question="late route test question?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )


async def _add_assignment(course_id, name, enforce_due):
    assignment = await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=10,
            released=False,
            description="late route test assignment",
            duedate=LATE_DUEDATE,
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
            enforce_due=enforce_due,
        )
    )
    return assignment


async def _link_question(assignment_id, question_id):
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment_id,
            question_id=question_id,
            points=10,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="pct_correct",
        )
    )


async def _add_useinfo(sid, div_id, timestamp):
    await create_useinfo_entry(
        UseinfoValidation(
            timestamp=timestamp,
            sid=sid,
            event="mChoice",
            act="answer:1",
            div_id=div_id,
            course_id=LATE_COURSE,
        )
    )


@pytest.fixture(scope="session")
async def late_work_assignment(instructor_user):
    """An enforced assignment with one late and one on-time submission."""
    course = await fetch_course(LATE_COURSE)
    q = await _add_question("late_route_q1")
    assignment = await _add_assignment(course.id, "late_route_assignment", True)
    await _link_question(assignment.id, q.id)
    # testuser1 submitted after the deadline -> late.
    await _add_useinfo("testuser1", "late_route_q1", AFTER_DUE)
    # ontime_student submitted before the deadline -> not late.
    await _add_useinfo("ontime_student", "late_route_q1", BEFORE_DUE)
    return assignment


@pytest.fixture(scope="session")
async def non_enforced_assignment(instructor_user):
    """An assignment that does not enforce its due date, with a late submission."""
    course = await fetch_course(LATE_COURSE)
    q = await _add_question("late_route_q2")
    assignment = await _add_assignment(course.id, "non_enforced_assignment", False)
    await _link_question(assignment.id, q.id)
    await _add_useinfo("testuser1", "late_route_q2", AFTER_DUE)
    return assignment


@pytest.fixture(scope="session")
async def other_course_assignment(instructor_user):
    """An enforced assignment that lives in a different course (overview)."""
    course = await fetch_course("overview")
    assignment = await _add_assignment(course.id, "other_course_late_assignment", True)
    return assignment


async def test_late_students_lists_late_student(
    auth_instructor_client, late_work_assignment
):
    """Only the student who submitted after the deadline is reported."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{late_work_assignment.id}/late_students"
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["assignment_id"] == late_work_assignment.id
    assert detail["enforce_due"] is True

    usernames = [s["username"] for s in detail["students"]]
    assert "testuser1" in usernames
    assert "ontime_student" not in usernames

    late = next(s for s in detail["students"] if s["username"] == "testuser1")
    assert late["name"]  # a display name is always provided


async def test_late_students_not_enforced_is_empty(
    auth_instructor_client, non_enforced_assignment
):
    """When the due date is not enforced no work is counted as late."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{non_enforced_assignment.id}/late_students"
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["enforce_due"] is False
    assert detail["students"] == []


async def test_late_students_other_course_forbidden(
    auth_instructor_client, other_course_assignment
):
    """An instructor cannot read late work for an assignment in another course."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{other_course_assignment.id}/late_students"
    )
    assert resp.status_code == 404


async def test_late_students_rejects_non_instructor(
    auth_student_client, late_work_assignment
):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get(
        f"/instructor/assignments/{late_work_assignment.id}/late_students"
    )
    assert resp.status_code in (401, 403)
