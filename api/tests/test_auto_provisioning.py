"""C1 — the `auto_provision_users` gate on first-login provisioning.

Sprint 24's `_provision_viewer` auto-creates an `app_users` row (role
`viewer`) for any Supabase identity with a valid token and no existing
row. That's a real exposure if the Supabase project allows open signup:
anyone who signs up gets read access to the whole `/editor/*` surface.

`Settings.auto_provision_users` (default `True`, preserving that exact
behavior) lets a deployment close it: with it `False`, an unprovisioned
identity gets a structured `403` instead of a silent `viewer` row — except
the one configured bootstrap admin id, which must always be able to enter
a fresh deployment regardless of the flag.

Uses the same `unauthenticated` + real-minted-JWT technique
`test_auth.py` establishes, since the gate under test lives inside
`get_current_user` itself, before any dependency override could stand in
for it.
"""

import jwt
import pytest

from app.auth.dependencies import CurrentUser, get_current_user
from app.core.config import settings
from app.db.models import AppUser
from app.main import app

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE


@pytest.fixture()
def unauthenticated(client):
    """Same as `test_auth.py`'s fixture of the same name — removes the
    autouse `get_current_user` override for one test, restoring it after.
    """
    app.dependency_overrides.pop(get_current_user, None)
    yield client
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


def _make_token(user_id: str, *, email: str = "someone@example.com") -> str:
    payload = {"sub": user_id, "email": email, "aud": "authenticated"}
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


class TestExistingUserUnaffected:
    """An identity that already has an `app_users` row must behave
    identically regardless of `auto_provision_users` — the flag only ever
    governs the *first-login, no-row-yet* path."""

    def test_existing_user_logs_in_normally_when_true(self, unauthenticated, make_app_user, monkeypatch):
        monkeypatch.setattr(settings, "auto_provision_users", True)
        user = make_app_user(role="editor")

        response = unauthenticated.get(
            "/editor/venues", headers={"Authorization": f"Bearer {_make_token(user.id)}"}
        )

        assert response.status_code == 200

    def test_existing_user_logs_in_normally_when_false(self, unauthenticated, make_app_user, monkeypatch):
        monkeypatch.setattr(settings, "auto_provision_users", False)
        user = make_app_user(role="editor")

        response = unauthenticated.get(
            "/editor/venues", headers={"Authorization": f"Bearer {_make_token(user.id)}"}
        )

        assert response.status_code == 200


class TestBootstrapAdminUnaffected:
    """The bootstrap admin must always be provisionable, in either state
    of the flag — otherwise a fresh deployment with auto-provisioning
    already off would have no way to create its first admin at all."""

    def test_bootstrap_admin_provisions_when_true(self, unauthenticated, db, monkeypatch):
        bootstrap_id = "test-bootstrap-00000000"
        monkeypatch.setattr(settings, "bootstrap_admin_user_id", bootstrap_id)
        monkeypatch.setattr(settings, "auto_provision_users", True)

        try:
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {_make_token(bootstrap_id)}"}
            )
            assert response.status_code == 200
            row = db.get(AppUser, bootstrap_id)
            assert row is not None
            assert row.role == "admin"
        finally:
            db.query(AppUser).filter(AppUser.id == bootstrap_id).delete()
            db.commit()

    def test_bootstrap_admin_still_provisions_when_false(self, unauthenticated, db, monkeypatch):
        """The exact case the exemption exists for: auto-provisioning is
        off, and the bootstrap admin logs in for the very first time."""
        bootstrap_id = "test-bootstrap-11111111"
        monkeypatch.setattr(settings, "bootstrap_admin_user_id", bootstrap_id)
        monkeypatch.setattr(settings, "auto_provision_users", False)

        try:
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {_make_token(bootstrap_id)}"}
            )
            assert response.status_code == 200
            row = db.get(AppUser, bootstrap_id)
            assert row is not None
            assert row.role == "admin"
        finally:
            db.query(AppUser).filter(AppUser.id == bootstrap_id).delete()
            db.commit()


class TestUnknownUserAutoProvisionTrue:
    def test_unknown_user_is_provisioned_as_viewer(self, unauthenticated, db, monkeypatch):
        monkeypatch.setattr(settings, "auto_provision_users", True)
        user_id = "test-unknown-22222222"

        try:
            response = unauthenticated.get(
                "/editor/venues", headers={"Authorization": f"Bearer {_make_token(user_id)}"}
            )
            assert response.status_code == 200
            row = db.get(AppUser, user_id)
            assert row is not None
            assert row.role == "viewer"
        finally:
            db.query(AppUser).filter(AppUser.id == user_id).delete()
            db.commit()


class TestUnknownUserAutoProvisionFalse:
    def test_unknown_user_is_rejected_with_403(self, unauthenticated, db, monkeypatch):
        monkeypatch.setattr(settings, "auto_provision_users", False)
        user_id = "test-unknown-33333333"

        response = unauthenticated.get(
            "/editor/venues", headers={"Authorization": f"Bearer {_make_token(user_id)}"}
        )

        assert response.status_code == 403
        body = response.json()
        assert body["detail"]["error"] == "user_not_authorized"
        assert body["detail"]["message"] == "This account has not been provisioned."
        # No row was created — a rejected identity leaves no trace behind.
        assert db.get(AppUser, user_id) is None

    def test_rejection_applies_across_editor_routes(self, unauthenticated, monkeypatch):
        """Not just the one route above — the gate runs inside
        get_current_user, which every /editor/* route depends on."""
        monkeypatch.setattr(settings, "auto_provision_users", False)
        user_id = "test-unknown-44444444"
        token = _make_token(user_id)

        for method, path in [("get", "/editor/venues"), ("get", "/editor/me"), ("post", "/editor/publish")]:
            response = getattr(unauthenticated, method)(path, headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 403, f"{method.upper()} {path}"
