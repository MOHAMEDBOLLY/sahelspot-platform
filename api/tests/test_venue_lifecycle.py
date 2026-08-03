"""Venue Lifecycle Management — the transitions the draft -> review ->
approved workflow (test_workflow.py) never covered: approved -> draft,
approved -> archived, archived -> approved (restore), and permanent
delete. Same success/invalid-transition/404 coverage shape as
test_workflow.py, plus the bulk-* siblings (test_bulk_operations.py's
style) and confirmation that Archived/Draft never reach the public API.
"""


class TestMoveToDraft:
    def test_success_moves_approved_to_draft(self, client, make_venue, db):
        venue = make_venue(status="approved")

        response = client.post(f"/editor/venues/{venue.id}/move-to-draft")

        assert response.status_code == 200
        assert response.json()["status"] == "draft"
        db.refresh(venue)
        assert venue.status == "draft"

    def test_rejects_draft_venue(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/move-to-draft")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_rejects_archived_venue(self, client, make_venue):
        venue = make_venue(status="archived")

        response = client.post(f"/editor/venues/{venue.id}/move-to-draft")

        assert response.status_code == 409

    def test_unknown_venue_returns_404(self, client):
        response = client.post("/editor/venues/does-not-exist/move-to-draft")

        assert response.status_code == 404


class TestArchive:
    def test_success_moves_approved_to_archived(self, client, make_venue, db):
        venue = make_venue(status="approved")

        response = client.post(f"/editor/venues/{venue.id}/archive")

        assert response.status_code == 200
        assert response.json()["status"] == "archived"
        db.refresh(venue)
        assert venue.status == "archived"

    def test_rejects_draft_venue(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/archive")

        assert response.status_code == 409

    def test_rejects_already_archived_venue(self, client, make_venue):
        venue = make_venue(status="archived")

        response = client.post(f"/editor/venues/{venue.id}/archive")

        assert response.status_code == 409

    def test_still_editable_while_archived(self, client, make_venue, db):
        """Archived is a visibility state, not a lock — PATCH must still work."""
        venue = make_venue(status="archived")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Renamed While Archived"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        db.refresh(venue)
        assert venue.name == "Renamed While Archived"
        assert venue.status == "archived"


class TestRestore:
    def test_success_moves_archived_to_approved(self, client, make_venue, db):
        venue = make_venue(status="archived")

        response = client.post(f"/editor/venues/{venue.id}/restore")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        db.refresh(venue)
        assert venue.status == "approved"

    def test_rejects_draft_venue(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/restore")

        assert response.status_code == 409

    def test_rejects_approved_venue(self, client, make_venue):
        venue = make_venue(status="approved")

        response = client.post(f"/editor/venues/{venue.id}/restore")

        assert response.status_code == 409


class TestDeleteVenue:
    def test_deletes_draft_venue(self, client, make_venue, db):
        venue = make_venue(status="draft")
        venue_id = venue.id

        response = client.delete(f"/editor/venues/{venue_id}")

        assert response.status_code == 204
        assert client.get(f"/editor/venues/{venue_id}").status_code == 404

    def test_deletes_approved_venue(self, client, make_venue):
        """Delete is always available regardless of current status."""
        venue = make_venue(status="approved")

        response = client.delete(f"/editor/venues/{venue.id}")

        assert response.status_code == 204

    def test_deletes_archived_venue(self, client, make_venue):
        venue = make_venue(status="archived")

        response = client.delete(f"/editor/venues/{venue.id}")

        assert response.status_code == 204

    def test_unknown_venue_returns_404(self, client):
        response = client.delete("/editor/venues/does-not-exist")

        assert response.status_code == 404


class TestBulkLifecycleActions:
    def test_bulk_move_to_draft(self, client, make_venue, db):
        v1 = make_venue(status="approved")
        v2 = make_venue(status="approved")

        response = client.post(
            "/editor/venues/bulk/move-to-draft", json={"venue_ids": [v1.id, v2.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        assert body["failed"] == 0
        db.refresh(v1)
        db.refresh(v2)
        assert v1.status == "draft"
        assert v2.status == "draft"

    def test_bulk_archive(self, client, make_venue, db):
        v1 = make_venue(status="approved")

        response = client.post("/editor/venues/bulk/archive", json={"venue_ids": [v1.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 1
        db.refresh(v1)
        assert v1.status == "archived"

    def test_bulk_restore(self, client, make_venue, db):
        v1 = make_venue(status="archived")

        response = client.post("/editor/venues/bulk/restore", json={"venue_ids": [v1.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 1
        db.refresh(v1)
        assert v1.status == "approved"

    def test_bulk_partial_failure_does_not_abort_batch(self, client, make_venue, db):
        """One item in the wrong status fails as its own row; the rest of
        the batch still applies — same contract every other bulk-*
        endpoint already gives (test_bulk_operations.py)."""
        approved = make_venue(status="approved")
        draft = make_venue(status="draft")

        response = client.post(
            "/editor/venues/bulk/archive", json={"venue_ids": [approved.id, draft.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1
        db.refresh(approved)
        db.refresh(draft)
        assert approved.status == "archived"
        assert draft.status == "draft"

    def test_bulk_delete(self, client, make_venue):
        v1 = make_venue(status="draft")
        v2 = make_venue(status="approved")

        response = client.post("/editor/venues/bulk/delete", json={"venue_ids": [v1.id, v2.id]})

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        assert client.get(f"/editor/venues/{v1.id}").status_code == 404
        assert client.get(f"/editor/venues/{v2.id}").status_code == 404


class TestConsumerCompatibility:
    """The publish engine already filters `Venue.status == 'approved'`
    (app/publishing/engine.py) — Draft and Archived were never publishable
    even before this feature existed. These tests confirm that guarantee
    still holds for a venue that reached Archived via this feature's new
    Approve -> Archive transition, using the same real publish + public-
    read pattern `test_public.py`'s `TestDraftNeverLeaksPublicly` already
    establishes for Draft.
    """

    def test_archived_venue_excluded_from_public_venues(self, client, make_venue, preserve_seed_state):
        approved = make_venue(status="approved", name="Stays Public")
        archived = make_venue(status="approved", name="Gets Archived")

        client.post(f"/editor/venues/{archived.id}/archive")
        client.post("/editor/publish")

        response = client.get("/public/venues")

        assert response.status_code == 200
        ids = {item["id"] for item in response.json()}
        assert approved.id in ids
        assert archived.id not in ids

    def test_draft_venue_excluded_from_public_venues(self, client, make_venue, preserve_seed_state):
        approved = make_venue(status="approved", name="Stays Public")
        moved_to_draft = make_venue(status="approved", name="Moved To Draft")

        client.post(f"/editor/venues/{moved_to_draft.id}/move-to-draft")
        client.post("/editor/publish")

        response = client.get("/public/venues")

        assert response.status_code == 200
        ids = {item["id"] for item in response.json()}
        assert approved.id in ids
        assert moved_to_draft.id not in ids
