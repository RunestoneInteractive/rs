"""
Smoke tests for the book server API.

Verifies route registration and that unauthenticated requests return the
expected auth error codes (401/422), not 500. No database is required.
"""

import pytest
from fastapi.testclient import TestClient

from rsptx.book_server_api.main import app


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
    assert any("/logger" in p for p in paths)
    assert any("/assessment" in p for p in paths)
    assert any("/books" in p for p in paths)
    assert any("/course" in p for p in paths)
    assert any("/auth" in p for p in paths)


# ---------------------------------------------------------------------------
# /logger — authenticated routes return 401/422
# ---------------------------------------------------------------------------

def test_bookevent_unauthenticated(client):
    resp = client.post("/logger/bookevent", json={})
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /assessment — authenticated routes return 401/422
# ---------------------------------------------------------------------------

def test_assessment_results_unauthenticated(client):
    resp = client.post("/assessment/results", json={})
    assert resp.status_code in (401, 422)


def test_assessment_gethist_unauthenticated(client):
    resp = client.post("/assessment/gethist", json={})
    assert resp.status_code in (401, 422)


def test_assessment_get_latest_code_unauthenticated(client):
    resp = client.post("/assessment/get_latest_code", json={})
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /course — authenticated routes return 401/422
# ---------------------------------------------------------------------------

def test_course_index_unauthenticated(client):
    resp = client.get("/course/index")
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /auth — public routes are reachable (not 500)
# ---------------------------------------------------------------------------

def test_auth_login_reachable(client):
    resp = client.get("/auth/login")
    assert resp.status_code != 500


def test_auth_course_students_unauthenticated(client):
    resp = client.get("/auth/course_students")
    assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# /books — public routes are reachable (not 500)
# ---------------------------------------------------------------------------

def test_books_crashtest_returns_500(client):
    # /books/crashtest intentionally raises ZeroDivisionError to exercise the
    # error handler; 500 is the correct response here.
    resp = client.get("/books/crashtest")
    assert resp.status_code == 500
