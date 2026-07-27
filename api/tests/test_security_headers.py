"""Security hardening PR 2 — baseline response headers applied to every
request via `security_headers_middleware` (app/main.py).
"""

import pytest

from app.auth.dependencies import CurrentUser, get_current_user
from app.main import app

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE


@pytest.fixture()
def unauthenticated(client):
    """Same technique `test_auth.py` defines locally for itself — fixtures
    aren't shared across test modules unless they live in conftest.py, so
    this is a deliberate, small duplication rather than a new shared
    fixture for what's currently a single extra call site.
    """
    app.dependency_overrides.pop(get_current_user, None)
    yield client
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


class TestSecurityHeaders:
    def test_health_response_has_all_baseline_headers(self, client):
        response = client.get("/health")

        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_public_endpoint_has_baseline_headers(self, client):
        response = client.get("/public/venues")

        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_headers_present_even_on_error_responses(self, client):
        # A 404 (unknown route) still goes through the middleware —
        # headers should be universal, not just on the happy path.
        response = client.get("/this-route-does-not-exist")

        assert response.status_code == 404
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_headers_present_on_401_response(self, unauthenticated):
        # `unauthenticated` clears the default admin override so this
        # actually exercises a real auth failure, not the test suite's
        # usual bypass.
        response = unauthenticated.get("/editor/venues")

        assert response.status_code == 401
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_does_not_add_content_security_policy(self, client):
        # Explicitly out of scope for this PR — asserting its absence
        # documents that boundary in the test suite itself.
        response = client.get("/health")

        assert "Content-Security-Policy" not in response.headers
        assert "Strict-Transport-Security" not in response.headers
