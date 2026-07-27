"""Security hardening PR 5 — every authentication/authorization failure
path logs one consistent line via `log_auth_failure` (app/auth/dependencies.py),
with no token, header, or credential ever included. See that function's
docstring for the exact fields logged.
"""

import jwt
import pytest

from app.auth.dependencies import CurrentUser, get_current_user
from app.core.config import settings
from app.main import app

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE


@pytest.fixture()
def unauthenticated(client):
    """Same technique `test_auth.py` defines locally for itself."""
    app.dependency_overrides.pop(get_current_user, None)
    yield client
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


def _make_token(*, secret: str | None = None, **claims) -> str:
    payload = {"sub": TEST_USER_ID, "email": "real-editor@example.com", "aud": "authenticated"}
    payload.update(claims)
    return jwt.encode(payload, secret or settings.supabase_jwt_secret, algorithm="HS256")


class TestMissingTokenLogging:
    def test_logs_missing_token_and_does_not_change_the_response(self, unauthenticated, caplog):
        with caplog.at_level("WARNING"):
            response = unauthenticated.get("/editor/venues")

        assert response.status_code == 401
        assert response.json()["detail"] == "Missing or malformed Authorization header"

        [record] = [r for r in caplog.records if "auth_failure" in r.message]
        assert "event=missing_token" in record.message
        assert "path=/editor/venues" in record.message
        assert "method=GET" in record.message


class TestInvalidTokenLogging:
    def test_logs_invalid_signature_and_does_not_change_the_response(self, unauthenticated, caplog):
        bad_token = _make_token(secret="wrong-secret")

        with caplog.at_level("WARNING"):
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {bad_token}"}
            )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired token"

        [record] = [r for r in caplog.records if "auth_failure" in r.message]
        assert "event=invalid_token" in record.message
        # The token itself must never appear in the log line.
        assert bad_token not in record.message

    def test_logs_expired_token_with_its_own_distinct_event(self, unauthenticated, caplog):
        import time

        expired_token = _make_token(exp=int(time.time()) - 3600)

        with caplog.at_level("WARNING"):
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {expired_token}"}
            )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired token"

        [record] = [r for r in caplog.records if "auth_failure" in r.message]
        assert "event=expired_token" in record.message
        assert expired_token not in record.message

    def test_logs_missing_subject_claim(self, unauthenticated, caplog):
        # A `null` `sub` claim is rejected by PyJWT itself before this
        # app's own code ever runs (a subclass of `InvalidTokenError`), so
        # exercising `get_current_user`'s own "missing sub" branch needs a
        # token whose payload never has a `sub` key at all — not one
        # `_make_token` can produce, since it always seeds one.
        payload = {"email": "real-editor@example.com", "aud": "authenticated"}
        token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

        with caplog.at_level("WARNING"):
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {token}"}
            )

        assert response.status_code == 401
        assert response.json()["detail"] == "Token missing subject claim"

        [record] = [r for r in caplog.records if "auth_failure" in r.message]
        assert "event=invalid_token" in record.message
        assert "missing subject claim" in record.message


class TestPermissionDeniedLogging:
    def test_logs_permission_denied_with_the_caller_identified(self, client, make_venue, as_role, caplog):
        venue = make_venue()
        as_role("viewer")

        with caplog.at_level("WARNING"):
            response = client.patch(f"/editor/venues/{venue.id}", json={"name": "New Name"})

        assert response.status_code == 403
        assert response.json()["detail"]["error"] == "missing_permission"

        [record] = [r for r in caplog.records if "auth_failure" in r.message]
        assert "event=permission_denied" in record.message
        assert f"user_id={TEST_USER_ID}" in record.message
        assert "content_edit" in record.message


class TestSuccessfulAuthIsUnaffected:
    def test_valid_token_still_succeeds_and_is_not_logged_as_a_failure(
        self, unauthenticated, make_app_user, caplog
    ):
        # A valid token exercises `get_current_user`'s real DB-backed role
        # lookup, not the autouse override — same reasoning `test_auth.py`'s
        # own `TestValidToken` already documents. Pre-provisioning via
        # `make_app_user` (self-cleaning) avoids ever triggering a real
        # first-login auto-provisioning insert against the shared `TEST_USER_ID`
        # here, which would otherwise leave a permanent, uncleaned row
        # in the shared dev database.
        make_app_user(id=TEST_USER_ID, email=TEST_USER_EMAIL, role="viewer")
        token = _make_token()

        with caplog.at_level("WARNING"):
            response = unauthenticated.get("/editor/venues", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        assert not [r for r in caplog.records if "auth_failure" in r.message]

    def test_no_log_message_ever_contains_the_bearer_token(self, unauthenticated, caplog):
        bad_token = _make_token(secret="wrong-secret")

        with caplog.at_level("WARNING"):
            unauthenticated.get("/editor/venues", headers={"Authorization": f"Bearer {bad_token}"})

        for record in caplog.records:
            assert bad_token not in record.message
            assert "Bearer" not in record.message
