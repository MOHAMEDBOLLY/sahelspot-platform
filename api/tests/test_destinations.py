"""Destination read/write endpoints. Originally (Sprint 21) just GET
(list, single) and PATCH (Save Draft), reusing venues' pattern with no
workflow endpoints (Editorial Readiness, Review, Approval, Publish are
still out of scope for destinations). Sprint 29 (Destination CRUD Parity)
adds Create, Delete, search + pagination on the list endpoint, and cover
image upload — this file grew to cover all of it rather than splitting,
since it's still one entity's CRUD surface.
"""

import uuid

from app.db.models import Destination


def _unique_tag() -> str:
    return uuid.uuid4().hex[:8]


class TestListDestinations:
    def test_returns_created_destination(self, client, make_destination):
        destination = make_destination(name="List Test Destination")

        response = client.get("/editor/destinations")

        assert response.status_code == 200
        body = response.json()
        names = {d["name"] for d in body["items"]}
        assert destination.name in names
        assert "total" in body
        assert "page" in body
        assert "page_size" in body


class TestGetDestination:
    def test_returns_destination_by_id(self, client, make_destination):
        destination = make_destination(name="Detail Test Destination", region="Test Region")

        response = client.get(f"/editor/destinations/{destination.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Detail Test Destination"
        assert body["region"] == "Test Region"

    def test_unknown_destination_returns_404(self, client):
        response = client.get("/editor/destinations/does-not-exist")

        assert response.status_code == 404


class TestUpdateDestination:
    def test_success_persists_changes(self, client, make_destination, db):
        destination = make_destination(name="Original Name", region="Original Region")

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"name": "Updated Name", "region": "Updated Region"},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"
        db.refresh(destination)
        assert destination.name == "Updated Name"
        assert destination.region == "Updated Region"

    def test_partial_update_leaves_other_fields_unchanged(self, client, make_destination, db):
        destination = make_destination(name="Keep This Name", region="Original Region")

        response = client.patch(f"/editor/destinations/{destination.id}", json={"region": "New Region"})

        assert response.status_code == 200
        assert response.json()["name"] == "Keep This Name"
        db.refresh(destination)
        assert destination.name == "Keep This Name"
        assert destination.region == "New Region"

    def test_does_not_change_status(self, client, make_destination, db):
        destination = make_destination(status="draft")

        client.patch(f"/editor/destinations/{destination.id}", json={"name": "Still Draft"})

        db.refresh(destination)
        assert destination.status == "draft"

    def test_updates_aliases(self, client, make_destination, db):
        destination = make_destination()

        response = client.patch(
            f"/editor/destinations/{destination.id}", json={"aliases": ["Alt Name One", "Alt Name Two"]}
        )

        assert response.status_code == 200
        assert response.json()["aliases"] == ["Alt Name One", "Alt Name Two"]
        db.refresh(destination)
        assert destination.aliases == ["Alt Name One", "Alt Name Two"]

    def test_unknown_destination_returns_404(self, client):
        response = client.patch("/editor/destinations/does-not-exist", json={"name": "Doesn't Matter"})

        assert response.status_code == 404

    def test_no_activity_is_logged_for_save_draft(self, client, make_destination, db):
        """Save Draft is deliberately unlogged — same reasoning as venues'
        PATCH (see docs/API.md's Activity Log section): it's not an
        editorial state transition or a publish event, and it can fire many
        times per edit session.
        """
        from app.db.models import ActivityLogEntry

        destination = make_destination()

        client.patch(f"/editor/destinations/{destination.id}", json={"name": "Edited"})

        entry = (
            db.query(ActivityLogEntry)
            .filter(ActivityLogEntry.entity_type == "destination", ActivityLogEntry.entity_id == destination.id)
            .first()
        )
        assert entry is None


class TestCreateDestination:
    def test_creates_a_draft_destination(self, client, db):
        dest_id = f"test-dest-create-{_unique_tag()}"
        try:
            response = client.post(
                "/editor/destinations",
                json={"id": dest_id, "name": "New Destination", "region": "New Region"},
            )

            assert response.status_code == 201
            body = response.json()
            assert body["id"] == dest_id
            assert body["status"] == "draft"
            assert body["name"] == "New Destination"
        finally:
            db.query(Destination).filter(Destination.id == dest_id).delete()
            db.commit()

    def test_accepts_aliases_and_notes(self, client, db):
        dest_id = f"test-dest-create-{_unique_tag()}"
        try:
            response = client.post(
                "/editor/destinations",
                json={
                    "id": dest_id,
                    "name": "New Destination",
                    "region": "New Region",
                    "aliases": ["Alt One"],
                    "notes": "Some notes",
                },
            )

            assert response.status_code == 201
            body = response.json()
            assert body["aliases"] == ["Alt One"]
            assert body["notes"] == "Some notes"
        finally:
            db.query(Destination).filter(Destination.id == dest_id).delete()
            db.commit()

    def test_rejects_a_duplicate_id(self, client, make_destination):
        destination = make_destination()

        response = client.post(
            "/editor/destinations",
            json={"id": destination.id, "name": "Duplicate", "region": "Somewhere"},
        )

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "destination_already_exists"

    def test_viewer_cannot_create(self, client, as_role):
        dest_id = f"test-dest-create-{_unique_tag()}"
        as_role("viewer")

        response = client.post(
            "/editor/destinations", json={"id": dest_id, "name": "Nope", "region": "Nowhere"}
        )

        assert response.status_code == 403


class TestDeleteDestination:
    def test_deletes_a_destination_with_no_venues(self, client, make_destination, db):
        destination = make_destination()
        destination_id = destination.id

        response = client.delete(f"/editor/destinations/{destination_id}")

        assert response.status_code == 204
        # `db.get()` would return the identity-map copy this same session
        # already loaded via `make_destination` without re-querying — a
        # fresh `query().filter()` forces a real SELECT against the row
        # the *other* (request-scoped) session actually deleted.
        remaining = db.query(Destination).filter(Destination.id == destination_id).first()
        assert remaining is None

    def test_blocked_when_destination_has_venues(self, client, make_destination, make_venue, db):
        destination = make_destination()
        venue = make_venue(destination=destination)

        response = client.delete(f"/editor/destinations/{destination.id}")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "destination_has_venues"
        # Not cascaded — both rows still exist.
        remaining = db.query(Destination).filter(Destination.id == destination.id).first()
        assert remaining is not None
        db.refresh(venue)
        assert venue.destination_id == destination.id

    def test_unknown_destination_returns_404(self, client):
        response = client.delete("/editor/destinations/does-not-exist")

        assert response.status_code == 404

    def test_viewer_cannot_delete(self, client, make_destination, as_role):
        destination = make_destination()
        as_role("viewer")

        response = client.delete(f"/editor/destinations/{destination.id}")

        assert response.status_code == 403


class TestSearchAndPagination:
    def test_search_matches_a_substring_case_insensitively(self, client, make_destination):
        tag = _unique_tag()
        make_destination(name=f"Marina Bay {tag}")

        response = client.get(f"/editor/destinations?q={tag.upper()}")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1

    def test_search_no_match_returns_empty_result(self, client):
        response = client.get(f"/editor/destinations?q=definitely-not-real-{_unique_tag()}")

        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 0

    def test_page_size_limits_items_but_not_total(self, client, make_destination):
        tag = _unique_tag()
        for i in range(5):
            make_destination(name=f"Dest {tag} {i}")

        response = client.get(f"/editor/destinations?q={tag}&page_size=2")

        assert response.status_code == 200
        body = response.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5

    def test_second_page_returns_remaining_items(self, client, make_destination):
        tag = _unique_tag()
        for i in range(3):
            make_destination(name=f"Dest {tag} {i}")

        first_page = client.get(f"/editor/destinations?q={tag}&page=1&page_size=2").json()
        second_page = client.get(f"/editor/destinations?q={tag}&page=2&page_size=2").json()

        assert len(first_page["items"]) == 2
        assert len(second_page["items"]) == 1

    def test_page_size_over_cap_is_rejected(self, client):
        response = client.get("/editor/destinations?page_size=1000")

        assert response.status_code == 422
