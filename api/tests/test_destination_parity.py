"""PLATFORM_SPEC_v1.0_FROZEN.md §9.1 — destination workflow parity with
venues (submit-for-review, approve, reject), boundary write path (§7.3),
and computed destination stats (§2.1/§8.1).
"""


class TestDestinationWorkflow:
    def test_submit_for_review_moves_draft_to_review(self, client, make_destination, db):
        destination = make_destination(status="draft")

        response = client.post(f"/editor/destinations/{destination.id}/submit-for-review")

        assert response.status_code == 200
        assert response.json()["status"] == "review"
        db.refresh(destination)
        assert destination.status == "review"

    def test_submit_rejects_blank_name_readiness(self, client, db):
        """`region` can no longer be blank at all (Phase 1's
        `ck_destinations_region` CHECK rejects an empty string, and the
        column is `NOT NULL`) — that half of `validate_destination`'s gate
        is unreachable through any real write path now, so this exercises
        the still-reachable half instead: `name` has no such constraint.
        """
        from app.db.models import Destination

        destination = Destination(id="test-dest-blank-name", name="", region="Marina", status="draft")
        db.add(destination)
        db.commit()
        try:
            response = client.post(f"/editor/destinations/{destination.id}/submit-for-review")
            assert response.status_code == 422
            body = response.json()["detail"]
            assert body["error"] == "not_ready_for_review"
            assert any(error["field"] == "name" for error in body["errors"])
        finally:
            db.delete(destination)
            db.commit()

    def test_submit_rejects_wrong_status(self, client, make_destination):
        destination = make_destination(status="review")

        response = client.post(f"/editor/destinations/{destination.id}/submit-for-review")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_approve_moves_review_to_approved(self, client, make_destination, db):
        destination = make_destination(status="review")

        response = client.post(f"/editor/destinations/{destination.id}/approve")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        db.refresh(destination)
        assert destination.status == "approved"

    def test_reject_requires_a_reason(self, client, make_destination):
        destination = make_destination(status="review")

        response = client.post(f"/editor/destinations/{destination.id}/reject", json={"reason": ""})

        assert response.status_code == 422

    def test_reject_moves_review_to_draft_and_logs_reason(self, client, make_destination, db):
        from .conftest import latest_activity

        destination = make_destination(status="review")

        response = client.post(
            f"/editor/destinations/{destination.id}/reject", json={"reason": "Missing region detail"}
        )

        assert response.status_code == 200
        assert response.json()["status"] == "draft"
        db.refresh(destination)
        assert destination.status == "draft"

        entry = latest_activity(db, entity_type="destination", entity_id=destination.id, action="reject")
        assert entry is not None
        assert entry.activity_metadata["reason"] == "Missing region detail"

    def test_unknown_destination_returns_404_for_each_transition(self, client):
        assert client.post("/editor/destinations/does-not-exist/submit-for-review").status_code == 404
        assert client.post("/editor/destinations/does-not-exist/approve").status_code == 404
        assert (
            client.post("/editor/destinations/does-not-exist/reject", json={"reason": "x"}).status_code
            == 404
        )


class TestBoundaryWrite:
    def test_accepts_a_valid_polygon(self, client, make_destination, db):
        destination = make_destination()
        polygon = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"boundary": polygon},
            headers={"If-Match": str(destination.version)},
        )

        assert response.status_code == 200
        assert response.json()["boundary"] == polygon

    def test_rejects_a_malformed_boundary(self, client, make_destination):
        destination = make_destination()

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"boundary": {"type": "NotAShape"}},
            headers={"If-Match": str(destination.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_boundary"

    def test_rejects_an_invalid_region_on_update(self, client, make_destination):
        destination = make_destination()

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"region": "Not A Real Region"},
            headers={"If-Match": str(destination.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_region"


class TestDestinationStats:
    def test_computes_counts_and_breakdown_live(self, client, make_destination, make_venue):
        destination = make_destination()
        make_venue(destination=destination, category="Restaurant", is_verified=True)
        make_venue(destination=destination, category="Restaurant", is_verified=False)
        make_venue(destination=destination, category="Cafe", is_verified=True)

        response = client.get(f"/editor/destinations/{destination.id}/stats")

        assert response.status_code == 200
        body = response.json()
        assert body["venue_count"] == 3
        assert body["verified_count"] == 2
        assert body["category_breakdown"] == {"Restaurant": 2, "Cafe": 1}

    def test_unknown_destination_returns_404(self, client):
        response = client.get("/editor/destinations/does-not-exist/stats")

        assert response.status_code == 404
