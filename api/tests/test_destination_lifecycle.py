"""Destination Lifecycle Management — the same transitions
`test_venue_lifecycle.py` covers for venues (approved -> draft,
approved -> archived, archived -> approved/restore, permanent delete),
applied to destinations. Same success/invalid-transition/404 coverage
shape, plus the bulk-* siblings and confirmation Archived/Draft never
reach the public API, plus the two delete guards (venue-count,
orphaned-event) `test_destinations.py` already covers for the single-item
`DELETE` — repeated here for the bulk-delete endpoint specifically.
"""


class TestMoveToDraft:
    def test_success_moves_approved_to_draft(self, client, make_destination, db):
        destination = make_destination(status="approved")

        response = client.post(f"/editor/destinations/{destination.id}/move-to-draft")

        assert response.status_code == 200
        assert response.json()["status"] == "draft"
        db.refresh(destination)
        assert destination.status == "draft"

    def test_rejects_draft_destination(self, client, make_destination):
        destination = make_destination(status="draft")

        response = client.post(f"/editor/destinations/{destination.id}/move-to-draft")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_rejects_archived_destination(self, client, make_destination):
        destination = make_destination(status="archived")

        response = client.post(f"/editor/destinations/{destination.id}/move-to-draft")

        assert response.status_code == 409

    def test_unknown_destination_returns_404(self, client):
        response = client.post("/editor/destinations/does-not-exist/move-to-draft")

        assert response.status_code == 404


class TestArchive:
    def test_success_moves_approved_to_archived(self, client, make_destination, db):
        destination = make_destination(status="approved")

        response = client.post(f"/editor/destinations/{destination.id}/archive")

        assert response.status_code == 200
        assert response.json()["status"] == "archived"
        db.refresh(destination)
        assert destination.status == "archived"

    def test_rejects_draft_destination(self, client, make_destination):
        destination = make_destination(status="draft")

        response = client.post(f"/editor/destinations/{destination.id}/archive")

        assert response.status_code == 409

    def test_rejects_already_archived_destination(self, client, make_destination):
        destination = make_destination(status="archived")

        response = client.post(f"/editor/destinations/{destination.id}/archive")

        assert response.status_code == 409


class TestRestore:
    def test_success_moves_archived_to_approved(self, client, make_destination, db):
        destination = make_destination(status="archived")

        response = client.post(f"/editor/destinations/{destination.id}/restore")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        db.refresh(destination)
        assert destination.status == "approved"

    def test_rejects_draft_destination(self, client, make_destination):
        destination = make_destination(status="draft")

        response = client.post(f"/editor/destinations/{destination.id}/restore")

        assert response.status_code == 409

    def test_rejects_approved_destination(self, client, make_destination):
        destination = make_destination(status="approved")

        response = client.post(f"/editor/destinations/{destination.id}/restore")

        assert response.status_code == 409


class TestBulkLifecycleActions:
    def test_bulk_move_to_draft(self, client, make_destination, db):
        d1 = make_destination(status="approved")
        d2 = make_destination(status="approved")

        response = client.post(
            "/editor/destinations/bulk/move-to-draft", json={"destination_ids": [d1.id, d2.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        assert body["failed"] == 0
        db.refresh(d1)
        db.refresh(d2)
        assert d1.status == "draft"
        assert d2.status == "draft"

    def test_bulk_archive(self, client, make_destination, db):
        d1 = make_destination(status="approved")

        response = client.post("/editor/destinations/bulk/archive", json={"destination_ids": [d1.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 1
        db.refresh(d1)
        assert d1.status == "archived"

    def test_bulk_restore(self, client, make_destination, db):
        d1 = make_destination(status="archived")

        response = client.post("/editor/destinations/bulk/restore", json={"destination_ids": [d1.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 1
        db.refresh(d1)
        assert d1.status == "approved"

    def test_bulk_partial_failure_does_not_abort_batch(self, client, make_destination, db):
        """Same contract every other bulk-* endpoint gives — one item in
        the wrong status fails as its own row, the rest of the batch still
        applies."""
        approved = make_destination(status="approved")
        draft = make_destination(status="draft")

        response = client.post(
            "/editor/destinations/bulk/archive", json={"destination_ids": [approved.id, draft.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1
        db.refresh(approved)
        db.refresh(draft)
        assert approved.status == "archived"
        assert draft.status == "draft"

    def test_bulk_delete(self, client, make_destination):
        d1 = make_destination(status="draft")
        d2 = make_destination(status="approved")

        response = client.post("/editor/destinations/bulk/delete", json={"destination_ids": [d1.id, d2.id]})

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        assert client.get(f"/editor/destinations/{d1.id}").status_code == 404
        assert client.get(f"/editor/destinations/{d2.id}").status_code == 404

    def test_bulk_delete_skips_destination_with_venues(self, client, make_destination, make_venue):
        """Same guard as the single-item `DELETE` — a destination that
        still has venues attached fails as its own row rather than
        aborting the batch or raising a raw IntegrityError."""
        has_venue = make_destination(status="draft")
        make_venue(destination=has_venue, status="draft")
        empty = make_destination(status="draft")

        response = client.post(
            "/editor/destinations/bulk/delete", json={"destination_ids": [has_venue.id, empty.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1
        assert client.get(f"/editor/destinations/{has_venue.id}").status_code == 200
        assert client.get(f"/editor/destinations/{empty.id}").status_code == 404


class TestConsumerCompatibility:
    """The publish engine already filters `Destination.status == 'approved'`
    (app/publishing/engine.py) — Draft and Archived were never publishable
    even before this feature existed. Same pattern
    `test_venue_lifecycle.py`'s `TestConsumerCompatibility` already
    establishes for venues.
    """

    def test_archived_destination_excluded_from_public_destinations(self, client, make_destination, preserve_seed_state):
        approved = make_destination(status="approved", name="Stays Public")
        archived = make_destination(status="approved", name="Gets Archived")

        client.post(f"/editor/destinations/{archived.id}/archive")
        client.post("/editor/publish")

        response = client.get("/public/destinations")

        assert response.status_code == 200
        ids = {item["id"] for item in response.json()}
        assert approved.id in ids
        assert archived.id not in ids

    def test_draft_destination_excluded_from_public_destinations(self, client, make_destination, preserve_seed_state):
        approved = make_destination(status="approved", name="Stays Public")
        moved_to_draft = make_destination(status="approved", name="Moved To Draft")

        client.post(f"/editor/destinations/{moved_to_draft.id}/move-to-draft")
        client.post("/editor/publish")

        response = client.get("/public/destinations")

        assert response.status_code == 200
        ids = {item["id"] for item in response.json()}
        assert approved.id in ids
        assert moved_to_draft.id not in ids
