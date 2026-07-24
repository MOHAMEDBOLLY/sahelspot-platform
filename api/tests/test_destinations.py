"""Destination read/write endpoints — the first entity to reuse the Save
Draft pattern Sprint 11 established for venues. No workflow endpoints exist
for destinations yet (Editorial Readiness, Review, Approval, Publish are
all out of this sprint's scope), so this file only covers GET (list,
single) and PATCH (Save Draft): success paths, 404s, and that a PATCH
actually persists in the database, not just in the HTTP response.
"""


class TestListDestinations:
    def test_returns_created_destination(self, client, make_destination):
        destination = make_destination(name="List Test Destination")

        response = client.get("/destinations")

        assert response.status_code == 200
        names = {d["name"] for d in response.json()}
        assert destination.name in names


class TestGetDestination:
    def test_returns_destination_by_id(self, client, make_destination):
        destination = make_destination(name="Detail Test Destination", region="Test Region")

        response = client.get(f"/destinations/{destination.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Detail Test Destination"
        assert body["region"] == "Test Region"

    def test_unknown_destination_returns_404(self, client):
        response = client.get("/destinations/does-not-exist")

        assert response.status_code == 404


class TestUpdateDestination:
    def test_success_persists_changes(self, client, make_destination, db):
        destination = make_destination(name="Original Name", region="Original Region")

        response = client.patch(
            f"/destinations/{destination.id}",
            json={"name": "Updated Name", "region": "Updated Region"},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"
        db.refresh(destination)
        assert destination.name == "Updated Name"
        assert destination.region == "Updated Region"

    def test_partial_update_leaves_other_fields_unchanged(self, client, make_destination, db):
        destination = make_destination(name="Keep This Name", region="Original Region")

        response = client.patch(f"/destinations/{destination.id}", json={"region": "New Region"})

        assert response.status_code == 200
        assert response.json()["name"] == "Keep This Name"
        db.refresh(destination)
        assert destination.name == "Keep This Name"
        assert destination.region == "New Region"

    def test_does_not_change_status(self, client, make_destination, db):
        destination = make_destination(status="draft")

        client.patch(f"/destinations/{destination.id}", json={"name": "Still Draft"})

        db.refresh(destination)
        assert destination.status == "draft"

    def test_updates_aliases(self, client, make_destination, db):
        destination = make_destination()

        response = client.patch(
            f"/destinations/{destination.id}", json={"aliases": ["Alt Name One", "Alt Name Two"]}
        )

        assert response.status_code == 200
        assert response.json()["aliases"] == ["Alt Name One", "Alt Name Two"]
        db.refresh(destination)
        assert destination.aliases == ["Alt Name One", "Alt Name Two"]

    def test_unknown_destination_returns_404(self, client):
        response = client.patch("/destinations/does-not-exist", json={"name": "Doesn't Matter"})

        assert response.status_code == 404

    def test_no_activity_is_logged_for_save_draft(self, client, make_destination, db):
        """Save Draft is deliberately unlogged — same reasoning as venues'
        PATCH (see docs/API.md's Activity Log section): it's not an
        editorial state transition or a publish event, and it can fire many
        times per edit session.
        """
        from app.db.models import ActivityLogEntry

        destination = make_destination()

        client.patch(f"/destinations/{destination.id}", json={"name": "Edited"})

        entry = (
            db.query(ActivityLogEntry)
            .filter(ActivityLogEntry.entity_type == "destination", ActivityLogEntry.entity_id == destination.id)
            .first()
        )
        assert entry is None
