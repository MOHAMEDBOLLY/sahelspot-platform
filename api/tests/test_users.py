"""Sprint 32 — User Role Management. The last gap in the permission system:
roles, permissions, authentication, authorization, and the bootstrap admin
all already existed (Sprint 22-24) — the only capability missing was
changing another user's role after their first login. `GET /editor/users`
and `PATCH /editor/users/{id}/role` are the two routes that close it, both
gated by `Permission.USER_MANAGE_ROLES`.
"""

from .conftest import TEST_USER_ID, latest_activity


class TestListUsers:
    def test_returns_created_users(self, client, make_app_user):
        user = make_app_user(email="list-test@example.com", role="editor")

        response = client.get("/editor/users")

        assert response.status_code == 200
        body = response.json()
        ids = {u["id"] for u in body}
        assert user.id in ids
        matched = next(u for u in body if u["id"] == user.id)
        assert matched["email"] == "list-test@example.com"
        assert matched["role"] == "editor"
        assert "created_at" in matched

    def test_viewer_cannot_list_users(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/users")

        assert response.status_code == 403


class TestUpdateUserRole:
    def test_updates_the_role(self, client, make_app_user, db):
        user = make_app_user(role="viewer")

        response = client.patch(f"/editor/users/{user.id}/role", json={"role": "editor"})

        assert response.status_code == 200
        assert response.json()["role"] == "editor"
        db.refresh(user)
        assert user.role == "editor"

    def test_rejects_an_invalid_role(self, client, make_app_user):
        user = make_app_user(role="viewer")

        response = client.patch(f"/editor/users/{user.id}/role", json={"role": "superadmin"})

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_role"

    def test_viewer_cannot_update_a_role(self, client, make_app_user, as_role):
        user = make_app_user(role="viewer")
        as_role("viewer")

        response = client.patch(f"/editor/users/{user.id}/role", json={"role": "editor"})

        assert response.status_code == 403

    def test_unknown_user_returns_404(self, client):
        response = client.patch("/editor/users/does-not-exist/role", json={"role": "editor"})

        assert response.status_code == 404

    def test_cannot_demote_the_last_remaining_admin(self, client, make_app_user, db):
        admin = make_app_user(role="admin")

        response = client.patch(f"/editor/users/{admin.id}/role", json={"role": "viewer"})

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "last_admin"
        db.refresh(admin)
        assert admin.role == "admin"

    def test_can_demote_an_admin_when_another_admin_exists(self, client, make_app_user, db):
        first_admin = make_app_user(role="admin")
        make_app_user(role="admin")

        response = client.patch(f"/editor/users/{first_admin.id}/role", json={"role": "editor"})

        assert response.status_code == 200
        db.refresh(first_admin)
        assert first_admin.role == "editor"

    def test_records_an_activity_entry(self, client, make_app_user, db):
        user = make_app_user(role="viewer")

        client.patch(f"/editor/users/{user.id}/role", json={"role": "publisher"})

        entry = latest_activity(db, entity_type="app_user", entity_id=user.id, action="role_changed")
        assert entry is not None
        assert entry.actor == TEST_USER_ID
        assert entry.activity_metadata == {"role": "publisher"}
