"""
Smoke tests for the assignment server API.

Verifies route registration and that unauthenticated requests return the
expected auth error codes (401/422), not 500. No database is required.
"""

import pytest
from fastapi.testclient import TestClient

from rsptx.assignment_server_api.core import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ---------------------------------------------------------------------------
# App-level
# ---------------------------------------------------------------------------

def test_app_exists():
    assert app is not None


def test_routes_registered():
    paths = {r.path for r in app.routes}
    assert any("/student" in p for p in paths)
    assert any("/instructor" in p for p in paths)
    assert any("/peer" in p for p in paths)


# ---------------------------------------------------------------------------
# /student — all routes require auth
# ---------------------------------------------------------------------------

def test_choose_assignment_unauthenticated(client):
    resp = client.get("/student/chooseAssignment")
    assert resp.status_code in (401, 422)


def test_do_assignment_unauthenticated(client):
    resp = client.get("/student/doAssignment")
    assert resp.status_code in (401, 422)


def test_update_submit_unauthenticated(client):
    resp = client.post("/student/update_submit", json={})
    assert resp.status_code in (401, 422)


def test_studyclues_query_unauthenticated(client):
    resp = client.post("/student/studyclues_query", json={})
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /instructor — all routes require auth + instructor role
# ---------------------------------------------------------------------------

def test_assignments_list_unauthenticated(client):
    resp = client.get("/instructor/assignments")
    assert resp.status_code in (401, 422)


def test_assignment_get_unauthenticated(client):
    resp = client.get("/instructor/assignments/1")
    assert resp.status_code in (401, 422)


def test_assignment_create_unauthenticated(client):
    resp = client.post("/instructor/assignments", json={})
    assert resp.status_code in (401, 422)


def test_assignment_update_unauthenticated(client):
    resp = client.put("/instructor/assignments/1", json={})
    assert resp.status_code in (401, 422)


def test_assignment_delete_unauthenticated(client):
    resp = client.delete("/instructor/assignments/1")
    assert resp.status_code in (401, 422)


def test_gradebook_unauthenticated(client):
    resp = client.get("/instructor/gradebook")
    assert resp.status_code in (401, 422)


def test_new_question_unauthenticated(client):
    resp = client.post("/instructor/new_question", json={})
    assert resp.status_code in (401, 422)


def test_new_assignment_q_unauthenticated(client):
    resp = client.post("/instructor/new_assignment_q", json={})
    assert resp.status_code in (401, 422)


def test_search_questions_unauthenticated(client):
    resp = client.post("/instructor/search_questions", json={})
    assert resp.status_code in (401, 422)


def test_course_roster_unauthenticated(client):
    resp = client.get("/instructor/course_roster")
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /peer — all routes require auth
# ---------------------------------------------------------------------------

def test_peer_student_unauthenticated(client):
    resp = client.get("/peer/student")
    assert resp.status_code in (401, 422)


def test_peer_instructor_unauthenticated(client):
    resp = client.get("/peer/instructor")
    assert resp.status_code in (401, 422)
