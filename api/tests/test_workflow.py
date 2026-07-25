"""Editorial workflow: Submit for Review (draft -> review) and Approve
(review -> approved). Covers success paths, invalid transitions, and the
expected HTTP status code + database state for each.
"""


class TestSubmitForReview:
    def test_success_moves_draft_to_review(self, client, make_venue, db):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 200
        assert response.json()["status"] == "review"
        db.refresh(venue)
        assert venue.status == "review"

    def test_rejects_venue_already_in_review(self, client, make_venue):
        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_rejects_approved_venue(self, client, make_venue):
        venue = make_venue(status="approved")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 409

    def test_rejects_venue_not_ready_for_review(self, client, make_venue):
        venue = make_venue(status="draft", name="")

        response = client.post(f"/editor/venues/{venue.id}/submit-for-review")

        assert response.status_code == 422
        body = response.json()["detail"]
        assert body["error"] == "not_ready_for_review"
        assert any(error["field"] == "name" for error in body["errors"])

    def test_rejected_transition_leaves_status_unchanged(self, client, make_venue, db):
        venue = make_venue(status="draft", name="")

        client.post(f"/editor/venues/{venue.id}/submit-for-review")

        db.refresh(venue)
        assert venue.status == "draft"

    def test_unknown_venue_returns_404(self, client):
        response = client.post("/editor/venues/does-not-exist/submit-for-review")

        assert response.status_code == 404


class TestApprove:
    def test_success_moves_review_to_approved(self, client, make_venue, db):
        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        db.refresh(venue)
        assert venue.status == "approved"

    def test_rejects_draft_venue(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_rejects_already_approved_venue(self, client, make_venue):
        venue = make_venue(status="approved")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 409

    def test_rejected_transition_leaves_status_unchanged(self, client, make_venue, db):
        venue = make_venue(status="draft")

        client.post(f"/editor/venues/{venue.id}/approve")

        db.refresh(venue)
        assert venue.status == "draft"

    def test_unknown_venue_returns_404(self, client):
        response = client.post("/editor/venues/does-not-exist/approve")

        assert response.status_code == 404

    def test_does_not_re_run_editorial_readiness(self, client, make_venue, db):
        """Approval never re-validates — a venue with a blank name (which
        would fail Editorial Readiness) can still be approved as long as
        it's already `review`, since Validation is only ever a Review
        prerequisite, not an Approval one.
        """
        venue = make_venue(status="review", name="")

        response = client.post(f"/editor/venues/{venue.id}/approve")

        assert response.status_code == 200
        db.refresh(venue)
        assert venue.status == "approved"
