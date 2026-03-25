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
    create_resp = await auth_instructor_client.post("/instructor/assignments", json=payload)
    assert create_resp.status_code == 201
    assignment_id = create_resp.json()["detail"]["id"]

    get_resp = await auth_instructor_client.get(f"/instructor/assignments/{assignment_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "assignment" in data["detail"]
    assert data["detail"]["assignment"]["id"] == assignment_id


# ---------------------------------------------------------------------------
# GET /instructor/course_roster
# ---------------------------------------------------------------------------

async def test_course_roster(auth_instructor_client):
    """Instructor can retrieve the course roster."""
    resp = await auth_instructor_client.get("/instructor/course_roster")
    assert resp.status_code == 200
