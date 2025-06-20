"""
Test the admin_server_api core module including the assessment reset functionality.
"""

import pytest
from fastapi.testclient import TestClient

from rsptx.admin_server_api.core import app


def test_app_creation():
    """Test that the FastAPI app is created successfully."""
    assert app is not None
    assert hasattr(app, "include_router")


def test_instructor_router_included():
    """Test that the instructor router is included in the app."""
    # Check that instructor routes are in the app
    routes = [route.path for route in app.routes]
    assert any("/instructor" in path for path in routes)


class TestAssessmentResetEndpoints:
    """Test the assessment reset endpoints."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        return TestClient(app)

    def test_assessment_reset_routes_exist(self, client):
        """Test that the assessment reset routes are properly registered."""
        # Test that the routes exist (even if we get auth errors)
        response = client.get("/instructor/assessment_reset")
        # We expect a 401 or redirect due to authentication requirements
        assert response.status_code in [401, 422, 302]

        response = client.post(
            "/instructor/reset_assessment",
            json={"student_username": "test", "assessment_name": "test"},
        )
        # We expect a 401 or redirect due to authentication requirements
        assert response.status_code in [401, 422, 302]


if __name__ == "__main__":
    # Run basic tests
    test_app_creation()
    test_instructor_router_included()
    print("✓ Basic admin server API tests passed!")

    # Test with client
    with TestClient(app) as client:
        test_endpoints = TestAssessmentResetEndpoints()
        test_endpoints.test_assessment_reset_routes_exist(client)
        print("✓ Assessment reset endpoint registration tests passed!")
