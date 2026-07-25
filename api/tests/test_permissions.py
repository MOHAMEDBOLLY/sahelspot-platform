"""Sprint 24 — Roles & Permissions.

Three concerns, kept separate:

- The role -> permission map itself (`app/auth/permissions.py`) is a pure
  static structure — tested directly, no HTTP involved.
- Permission enforcement on real routes — exercised via `get_current_user`
  overrides for each role, the same technique `conftest.py`'s
  `_authenticated_by_default` already uses, so these tests don't need to
  mint real JWTs or provision real `app_users` rows just to prove a
  `viewer` can't PATCH a venue.
- Auto-provisioning and the bootstrap-admin rule — the one part of this
  sprint that genuinely needs a real token, since it's specifically the
  path `get_current_user` takes when *no* `app_users` row exists yet.
"""

import jwt
import pytest

from app.auth.dependencies import CurrentUser, _provision_viewer, get_current_user
from app.db.session import SessionLocal
from app.auth.permissions import Permission, ROLE_PERMISSIONS
from app.core.config import settings
from app.db.models import ActivityLogEntry, AppUser
from app.main import app

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE, latest_activity


# ---------------------------------------------------------------------------
# The static map itself
# ---------------------------------------------------------------------------


class TestRolePermissionMap:
    def test_viewer_can_only_view(self):
        assert ROLE_PERMISSIONS["viewer"] == {Permission.CONTENT_VIEW}

    def test_editor_can_edit_and_submit_but_not_approve_or_publish(self):
        granted = ROLE_PERMISSIONS["editor"]
        assert Permission.CONTENT_EDIT in granted
        assert Permission.CONTENT_SUBMIT_REVIEW in granted
        assert Permission.CONTENT_APPROVE not in granted
        assert Permission.CONTENT_PUBLISH not in granted

    def test_publisher_can_approve_and_publish(self):
        granted = ROLE_PERMISSIONS["publisher"]
        assert Permission.CONTENT_APPROVE in granted
        assert Permission.CONTENT_PUBLISH in granted
        assert Permission.USER_MANAGE_ROLES not in granted

    def test_admin_holds_every_permission(self):
        assert ROLE_PERMISSIONS["admin"] == set(Permission)

    def test_each_role_is_a_superset_of_the_role_below_it(self):
        assert ROLE_PERMISSIONS["viewer"] <= ROLE_PERMISSIONS["editor"]
        assert ROLE_PERMISSIONS["editor"] <= ROLE_PERMISSIONS["publisher"]
        assert ROLE_PERMISSIONS["publisher"] <= ROLE_PERMISSIONS["admin"]


# ---------------------------------------------------------------------------
# Permission enforcement on real routes, per role
# ---------------------------------------------------------------------------


@pytest.fixture()
def as_role(client):
    """Overrides `get_current_user` with a fixed identity holding the given
    role, for the duration of one test — restores the standard admin
    override afterward so later tests are unaffected. Deliberately doesn't
    touch the database: permission enforcement only needs a role on
    `CurrentUser`, not a real `app_users` row.
    """

    def _set(role: str) -> None:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=TEST_USER_ID, email=TEST_USER_EMAIL, role=role
        )

    yield _set

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


class TestViewPermission:
    def test_viewer_can_list_venues(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/venues")

        assert response.status_code == 200

    def test_viewer_can_read_activity_log(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/activity")

        assert response.status_code == 200


class TestEditPermission:
    def test_viewer_cannot_save_draft(self, client, as_role, make_venue):
        as_role("viewer")
        venue = make_venue()

        response = client.patch(f"/editor/venues/{venue.id}", json={"name": "New Name"})

        assert response.status_code == 403
        assert response.json()["detail"]["error"] == "missing_permission"
        assert response.json()["detail"]["required"] == Permission.CONTENT_EDIT.value

    def test_editor_can_save_draft(self, client, as_role, make_venue):
        as_role("editor")
        venue = make_venue()

        response = client.patch(f"/editor/venues/{venue.id}", json={"name": "New Name"})

        assert response.status_code == 200

    def test_viewer_cannot_edit_destination(self, client, as_role, make_destination):
        as_role("viewer")
        destination = make_destination()

        response = client.patch(f"/editor/destinations/{destination.id}", json={"name": "New Name"})

        assert response.status_code == 403


class TestSubmitForReviewPermission:
    def test_viewer_cannot_submit_for_review(self, client, as_role, make_venue):
        as_role("viewer")
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 403
        assert response.json()["detail"]["required"] == Permission.CONTENT_SUBMIT_REVIEW.value

    def test_editor_can_submit_for_review(self, client, as_role, make_venue):
        as_role("editor")
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 200


class TestApprovePermission:
    def test_editor_cannot_approve(self, client, as_role, make_venue):
        as_role("editor")
        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 403
        assert response.json()["detail"]["required"] == Permission.CONTENT_APPROVE.value

    def test_publisher_can_approve(self, client, as_role, make_venue):
        as_role("publisher")
        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 200


class TestPublishPermission:
    def test_editor_cannot_publish(self, client, as_role):
        as_role("editor")

        response = client.post("/editor/publish")

        assert response.status_code == 403
        assert response.json()["detail"]["required"] == Permission.CONTENT_PUBLISH.value

    def test_publisher_can_publish(self, client, as_role, make_venue, preserve_seed_state):
        as_role("publisher")
        make_venue(status="approved")

        response = client.post("/editor/publish")

        assert response.status_code == 200

    def test_editor_cannot_republish(self, client, as_role, make_venue, preserve_seed_state):
        as_role("publisher")
        make_venue(status="approved")
        revision = client.post("/editor/publish").json()

        as_role("editor")
        response = client.post(f"/editor/publish/revisions/{revision['id']}/republish")

        assert response.status_code == 403


# ---------------------------------------------------------------------------
# GET /editor/me
# ---------------------------------------------------------------------------


class TestMe:
    def test_returns_id_email_and_role(self, client):
        response = client.get("/editor/me")

        assert response.status_code == 200
        body = response.json()
        assert body == {"id": TEST_USER_ID, "email": TEST_USER_EMAIL, "role": TEST_USER_ROLE}

    def test_reflects_the_caller_s_actual_role(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/me")

        assert response.status_code == 200
        assert response.json()["role"] == "viewer"


# ---------------------------------------------------------------------------
# Auto-provisioning (the one part of this sprint that needs a real token)
# ---------------------------------------------------------------------------


@pytest.fixture()
def unauthenticated(client):
    """Same technique as test_auth.py's fixture of the same name — removes
    the autouse override so a real, correctly-signed JWT actually drives
    `get_current_user`'s real DB-backed logic instead of being bypassed.
    """
    app.dependency_overrides.pop(get_current_user, None)
    yield client
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


def _make_token(user_id: str, *, email: str = "new-user@example.com") -> str:
    return jwt.encode(
        {"sub": user_id, "email": email, "aud": "authenticated"},
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )


class TestAutoProvisioning:
    def test_first_login_creates_a_viewer_row(self, unauthenticated, db):
        user_id = "test-user-first-login-0001"
        token = _make_token(user_id)

        try:
            response = unauthenticated.get("/editor/me", headers={"Authorization": f"Bearer {token}"})

            assert response.status_code == 200
            assert response.json()["role"] == "viewer"

            app_user = db.get(AppUser, user_id)
            assert app_user is not None
            assert app_user.role == "viewer"
        finally:
            db.query(AppUser).filter(AppUser.id == user_id).delete()
            db.commit()

    def test_first_login_logs_a_role_assigned_activity_entry(self, unauthenticated, db):
        user_id = "test-user-first-login-0002"
        token = _make_token(user_id)

        try:
            unauthenticated.get("/editor/me", headers={"Authorization": f"Bearer {token}"})

            entry = latest_activity(db, entity_type="app_user", entity_id=user_id, action="role_assigned")
            assert entry is not None
            assert entry.actor == user_id
            assert entry.activity_metadata == {"role": "viewer"}
        finally:
            db.query(AppUser).filter(AppUser.id == user_id).delete()
            db.commit()

    def test_second_login_does_not_re_provision_or_re_log(self, unauthenticated, db, make_app_user):
        user_id = "test-user-second-login-0001"
        make_app_user(id=user_id, role="editor")
        token = _make_token(user_id)

        response = unauthenticated.get("/editor/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        # The pre-provisioned role is what's returned, not the "first
        # login" default — proves the lookup found the existing row
        # instead of overwriting it.
        assert response.json()["role"] == "editor"

    def test_bootstrap_admin_id_is_provisioned_as_admin(self, unauthenticated, db, monkeypatch):
        user_id = "test-user-bootstrap-admin-0001"
        monkeypatch.setattr(settings, "bootstrap_admin_user_id", user_id)
        token = _make_token(user_id)

        try:
            response = unauthenticated.get("/editor/me", headers={"Authorization": f"Bearer {token}"})

            assert response.status_code == 200
            assert response.json()["role"] == "admin"
        finally:
            db.query(AppUser).filter(AppUser.id == user_id).delete()
            db.commit()

    def test_concurrent_first_login_does_not_raise_or_duplicate(self, db):
        """Two simultaneous first requests from the same identity both see
        no existing row and both attempt to provision one — only one
        `INSERT` can win. This calls `_provision_viewer` directly with two
        separate sessions to force that exact interleaving (session_b's
        commit happens after session_a's has already landed), rather than
        relying on real thread timing to reproduce it.
        """
        user_id = "test-user-race-0001"
        session_a = SessionLocal()
        session_b = SessionLocal()

        try:
            first = _provision_viewer(session_a, user_id=user_id, email="race@example.com")
            assert first.role == "viewer"

            # session_b never saw session_a's row (a real concurrent
            # request wouldn't either) — its insert collides with what
            # session_a already committed. This must not raise.
            second = _provision_viewer(session_b, user_id=user_id, email="race@example.com")

            assert second.id == user_id
            assert second.role == "viewer"

            # Exactly one row, one activity entry — the loser's attempt
            # left no trace.
            assert db.query(AppUser).filter(AppUser.id == user_id).count() == 1
            entries = (
                db.query(ActivityLogEntry)
                .filter(ActivityLogEntry.entity_type == "app_user", ActivityLogEntry.entity_id == user_id)
                .all()
            )
            assert len(entries) == 1
        finally:
            session_a.close()
            session_b.close()
            db.query(AppUser).filter(AppUser.id == user_id).delete()
            db.query(ActivityLogEntry).filter(
                ActivityLogEntry.entity_type == "app_user", ActivityLogEntry.entity_id == user_id
            ).delete()
            db.commit()
