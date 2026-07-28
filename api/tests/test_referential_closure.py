"""PLATFORM_SPEC_v1.0_FROZEN.md §1 — a published venue must never
reference a destination absent from the same snapshot. Two layers: the
approve-time gate (§1.2, the common case) and the publish-time filter
(§1's actual closure guarantee, catching drift after approval).
"""


class TestApproveTimeGate:
    def test_cannot_approve_a_venue_under_a_draft_destination(self, client, make_destination, make_venue):
        destination = make_destination(status="draft")
        venue = make_venue(destination=destination, status="review")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "destination_not_approved"

    def test_can_approve_a_venue_under_an_approved_destination(self, client, make_destination, make_venue, db):
        destination = make_destination(status="approved")
        venue = make_venue(destination=destination, status="review")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 200
        db.refresh(venue)
        assert venue.status == "approved"

    def test_bulk_approve_reports_the_gate_as_a_per_item_failure(self, client, make_destination, make_venue):
        destination = make_destination(status="draft")
        venue = make_venue(destination=destination, status="review")

        response = client.post("/editor/venues/bulk/approve", json={"venue_ids": [venue.id]})

        assert response.status_code == 200
        body = response.json()
        assert body["failed"] == 1
        assert body["succeeded"] == 0


class TestPublishTimeFilter:
    def test_excludes_a_venue_whose_destination_drifted_after_approval(
        self, client, make_destination, make_venue, db, preserve_seed_state
    ):
        """The gate only catches drift at approval time — this reproduces
        the case it cannot catch: the destination is archived *after* its
        venue was already validly approved.
        """
        destination = make_destination(status="approved")
        venue = make_venue(destination=destination, status="approved")

        destination.status = "archived"
        db.commit()

        response = client.post("/editor/publish")

        assert response.status_code == 200
        body = response.json()
        assert body["excluded_venue_count"] >= 1

        revision = client.get(f"/editor/publish/revisions/{body['id']}").json()
        venue_ids_in_snapshot = {v["id"] for v in revision["snapshot"]["venues"]}
        assert venue.id not in venue_ids_in_snapshot

    def test_exclusion_is_logged_to_activity(
        self, client, make_destination, make_venue, db, preserve_seed_state
    ):
        from .conftest import latest_activity

        destination = make_destination(status="approved")
        venue = make_venue(destination=destination, status="approved")
        destination.status = "archived"
        db.commit()

        client.post("/editor/publish")

        entry = latest_activity(
            db, entity_type="venue", entity_id=venue.id, action="publish_excluded_orphan_venue"
        )
        assert entry is not None
        assert entry.activity_metadata["destination_status"] == "archived"

    def test_zero_exclusions_is_the_common_case(self, client, make_destination, make_venue, preserve_seed_state):
        destination = make_destination(status="approved")
        make_venue(destination=destination, status="approved")

        response = client.post("/editor/publish")

        assert response.status_code == 200
        assert response.json()["excluded_venue_count"] == 0

    def test_other_approved_content_still_publishes_despite_one_exclusion(
        self, client, make_destination, make_venue, db, preserve_seed_state
    ):
        drifted_destination = make_destination(status="approved")
        drifted_venue = make_venue(destination=drifted_destination, status="approved")
        drifted_destination.status = "draft"
        db.commit()

        healthy_destination = make_destination(status="approved")
        healthy_venue = make_venue(destination=healthy_destination, status="approved")

        response = client.post("/editor/publish")

        assert response.status_code == 200
        revision = client.get(f"/editor/publish/revisions/{response.json()['id']}").json()
        venue_ids = {v["id"] for v in revision["snapshot"]["venues"]}
        assert healthy_venue.id in venue_ids
        assert drifted_venue.id not in venue_ids
