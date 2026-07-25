"""Authentication gate on the /editor/* API (Sprint 22, restructured for
the explicit /editor + /public boundary in Sprint 23).

Every other test file relies on `conftest.py`'s `_authenticated_by_default`
override, so it never has to think about tokens. This file is the one
place that deliberately turns that override off, to prove the gate itself
— missing/invalid tokens are rejected by everything under /editor,
/public stays open regardless, and a valid token is attributed as the
activity log's actor — actually works, not just that routes assume it
does.
"""

import jwt
import pytest

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.main import app

from .conftest import TEST_USER_ID, latest_activity


@pytest.fixture()
def unauthenticated(client):
    """Removes the autouse `get_current_user` override for the duration of
    a single test, restoring it afterward so later tests are unaffected.
    """
    app.dependency_overrides.pop(get_current_user, None)
    yield client
    from app.auth.dependencies import CurrentUser

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email="test-editor@example.com"
    )


def _make_token(*, secret: str = None, **claims) -> str:
    payload = {"sub": TEST_USER_ID, "email": "real-editor@example.com", "aud": "authenticated"}
    payload.update(claims)
    return jwt.encode(payload, secret or settings.supabase_jwt_secret, algorithm="HS256")


class TestEditorRequiresAuth:
    """Sprint 23: the gate is enforced once, at the /editor router level —
    these tests deliberately hit a mix of GET and mutation endpoints
    across venues/destinations/publish/activity to prove the router-level
    dependency covers the whole namespace, not just the mutation endpoints
    Sprint 22 protected individually.
    """

    def test_patch_venue_without_authorization_header_is_401(self, unauthenticated, make_venue):
        venue = make_venue()

        response = unauthenticated.patch(f"/editor/venues/{venue.id}", json={"name": "New Name"})

        assert response.status_code == 401

    def test_patch_destination_without_authorization_header_is_401(self, unauthenticated, make_destination):
        destination = make_destination()

        response = unauthenticated.patch(f"/editor/destinations/{destination.id}", json={"name": "New Name"})

        assert response.status_code == 401

    def test_publish_without_authorization_header_is_401(self, unauthenticated):
        response = unauthenticated.post("/editor/publish")

        assert response.status_code == 401

    def test_get_venues_requires_authentication(self, unauthenticated):
        # Sprint 23 change from Sprint 22: every /editor/* route requires
        # auth now, including reads — the router-level gate doesn't
        # distinguish GET from mutation, on purpose (see docs/API.md's
        # "API boundary" section for why a uniform gate was chosen over a
        # per-route allowlist).
        response = unauthenticated.get("/editor/venues")

        assert response.status_code == 401

    def test_get_destinations_requires_authentication(self, unauthenticated):
        response = unauthenticated.get("/editor/destinations")

        assert response.status_code == 401

    def test_get_activity_requires_authentication(self, unauthenticated):
        response = unauthenticated.get("/editor/activity")

        assert response.status_code == 401

    def test_get_publish_revisions_requires_authentication(self, unauthenticated):
        response = unauthenticated.get("/editor/publish/revisions")

        assert response.status_code == 401

    def test_malformed_header_is_401(self, unauthenticated, make_venue):
        venue = make_venue()

        response = unauthenticated.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "New Name"},
            headers={"Authorization": "NotBearer sometoken"},
        )

        assert response.status_code == 401


class TestPublicNeverRequiresAuth:
    """The /public/* namespace has no auth gate at all — a future mobile
    app or integration must be able to call it with no token. These tests
    exercise it with the autouse override removed to prove that's really
    true, not just true because every other test happens to be logged in.
    """

    def test_public_venues_accessible_without_a_token(self, unauthenticated):
        response = unauthenticated.get("/public/venues")

        assert response.status_code == 200

    def test_public_destinations_accessible_without_a_token(self, unauthenticated):
        response = unauthenticated.get("/public/destinations")

        assert response.status_code == 200


class TestInvalidToken:
    def test_wrong_signature_is_401(self, unauthenticated, make_venue):
        venue = make_venue()
        token = _make_token(secret="not-the-real-secret")

        response = unauthenticated.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 401

    def test_expired_token_is_401(self, unauthenticated, make_venue):
        venue = make_venue()
        token = _make_token(exp=1)  # 1 second past epoch — long expired

        response = unauthenticated.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 401

    def test_wrong_audience_is_401(self, unauthenticated, make_venue):
        venue = make_venue()
        token = _make_token(aud="not-authenticated")

        response = unauthenticated.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 401


class TestValidToken:
    def test_valid_token_is_accepted_and_attributed_as_actor(self, unauthenticated, make_venue, db):
        venue = make_venue(status="draft")
        token = _make_token()

        response = unauthenticated.post(
            f"/editor/venues/{venue.id}/submit-for-review",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="submit_for_review")
        assert entry is not None
        assert entry.actor == TEST_USER_ID
