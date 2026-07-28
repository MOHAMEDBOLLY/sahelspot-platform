"""Sprint 28 — Bulk Operations.

Every bulk endpoint reuses the exact function its single-item counterpart
calls (`validate_venue()`, `_submit_for_review_or_raise()`,
`_approve_or_raise()`, or the same "set attribute, commit" pattern
`update_venue` already uses) — these tests focus on what's genuinely new:
partial-failure handling (one bad id in a batch doesn't abort the rest),
and that permission enforcement applies to the bulk endpoints exactly as
it does to their single-item counterparts (already covered exhaustively in
test_permissions.py/test_workflow.py, so not re-derived here in full).
"""

import pytest

from app.auth.dependencies import CurrentUser, get_current_user
from app.main import app as fastapi_app

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE


@pytest.fixture()
def as_role(client):
    def _set(role: str) -> None:
        fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=TEST_USER_ID, email=TEST_USER_EMAIL, role=role
        )

    yield _set

    fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


class TestBulkValidate:
    def test_reports_readiness_per_venue(self, client, make_venue):
        ready = make_venue(status="draft", name="Ready Venue")
        not_ready = make_venue(status="draft", name="")

        response = client.post(
            "/editor/venues/bulk/validate", json={"venue_ids": [ready.id, not_ready.id]}
        )

        assert response.status_code == 200
        body = response.json()
        by_id = {row["venue_id"]: row for row in body["results"]}
        assert by_id[ready.id]["success"] is True
        assert by_id[ready.id]["validation"]["ready_for_review"] is True
        # A found-but-not-ready venue is a failed validation, not a
        # successful check with a negative result — `success` must reflect
        # readiness, not just "the check ran."
        assert by_id[not_ready.id]["success"] is False
        assert by_id[not_ready.id]["validation"]["ready_for_review"] is False
        assert body["succeeded"] == 1
        assert body["failed"] == 1

    def test_does_not_mutate_any_venue(self, client, make_venue, db):
        venue = make_venue(status="draft")

        client.post("/editor/venues/bulk/validate", json={"venue_ids": [venue.id]})

        db.refresh(venue)
        assert venue.status == "draft"

    def test_unknown_id_reports_failure_without_aborting_the_batch(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(
            "/editor/venues/bulk/validate", json={"venue_ids": ["does-not-exist", venue.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1

    def test_viewer_cannot_bulk_validate(self, client, make_venue, as_role):
        venue = make_venue(status="draft")
        as_role("viewer")

        response = client.post("/editor/venues/bulk/validate", json={"venue_ids": [venue.id]})

        assert response.status_code == 403


class TestBulkSubmitForReview:
    def test_transitions_all_ready_draft_venues(self, client, make_venue, db):
        first = make_venue(status="draft", name="First")
        second = make_venue(status="draft", name="Second")

        response = client.post(
            "/editor/venues/bulk/submit-for-review", json={"venue_ids": [first.id, second.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        assert body["failed"] == 0
        db.refresh(first)
        db.refresh(second)
        assert first.status == "review"
        assert second.status == "review"

    def test_partial_failure_does_not_block_the_rest_of_the_batch(self, client, make_venue, db):
        ready = make_venue(status="draft", name="Ready")
        already_in_review = make_venue(status="review", name="Already Review")
        not_ready = make_venue(status="draft", name="")

        response = client.post(
            "/editor/venues/bulk/submit-for-review",
            json={"venue_ids": [ready.id, already_in_review.id, not_ready.id]},
        )

        assert response.status_code == 200
        body = response.json()
        by_id = {row["venue_id"]: row for row in body["results"]}
        assert by_id[ready.id]["success"] is True
        assert by_id[already_in_review.id]["success"] is False
        assert by_id[not_ready.id]["success"] is False
        assert body["succeeded"] == 1
        assert body["failed"] == 2

        db.refresh(ready)
        db.refresh(already_in_review)
        db.refresh(not_ready)
        assert ready.status == "review"
        assert already_in_review.status == "review"  # unchanged, not double-transitioned
        assert not_ready.status == "draft"  # rejected transition leaves status untouched

    def test_logs_activity_for_each_successful_transition(self, client, make_venue, db):
        from .conftest import latest_activity

        venue = make_venue(status="draft")

        client.post("/editor/venues/bulk/submit-for-review", json={"venue_ids": [venue.id]})

        entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="submit_for_review")
        assert entry is not None
        assert entry.actor == TEST_USER_ID

    def test_unknown_id_reports_failure_without_aborting_the_batch(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(
            "/editor/venues/bulk/submit-for-review",
            json={"venue_ids": ["does-not-exist", venue.id]},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1

    def test_viewer_cannot_bulk_submit_for_review(self, client, make_venue, as_role):
        venue = make_venue(status="draft")
        as_role("viewer")

        response = client.post(
            "/editor/venues/bulk/submit-for-review", json={"venue_ids": [venue.id]}
        )

        assert response.status_code == 403

    def test_editor_cannot_bulk_approve(self, client, make_venue, as_role):
        # Sanity check that permission enforcement is per-action, not just
        # "any bulk endpoint" — an editor has CONTENT_SUBMIT_REVIEW but not
        # CONTENT_APPROVE.
        venue = make_venue(status="review")
        as_role("editor")

        response = client.post("/editor/venues/bulk/approve", json={"venue_ids": [venue.id]})

        assert response.status_code == 403


class TestBulkApprove:
    def test_transitions_all_review_venues(self, client, make_venue, db):
        first = make_venue(status="review")
        second = make_venue(status="review")

        response = client.post(
            "/editor/venues/bulk/approve", json={"venue_ids": [first.id, second.id]}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 2
        db.refresh(first)
        db.refresh(second)
        assert first.status == "approved"
        assert second.status == "approved"

    def test_partial_failure_does_not_block_the_rest_of_the_batch(self, client, make_venue, db):
        ready = make_venue(status="review")
        wrong_status = make_venue(status="draft")

        response = client.post(
            "/editor/venues/bulk/approve", json={"venue_ids": [ready.id, wrong_status.id]}
        )

        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1
        db.refresh(ready)
        db.refresh(wrong_status)
        assert ready.status == "approved"
        assert wrong_status.status == "draft"

    def test_viewer_cannot_bulk_approve(self, client, make_venue, as_role):
        venue = make_venue(status="review")
        as_role("viewer")

        response = client.post("/editor/venues/bulk/approve", json={"venue_ids": [venue.id]})

        assert response.status_code == 403


class TestBulkCategoryUpdate:
    def test_updates_category_for_every_venue(self, client, make_venue, db):
        first = make_venue(category="Restaurant")
        second = make_venue(category="Cafe")

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [first.id, second.id], "category": "Hotel"},
        )

        assert response.status_code == 200
        assert response.json()["succeeded"] == 2
        db.refresh(first)
        db.refresh(second)
        assert first.category == "Hotel"
        assert second.category == "Hotel"

    def test_rejects_an_unrecognized_category_before_touching_any_venue(self, client, make_venue, db):
        venue = make_venue(category="Restaurant")

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [venue.id], "category": "NotARealCategory"},
        )

        assert response.status_code == 422
        db.refresh(venue)
        assert venue.category == "Restaurant"

    def test_unknown_id_reports_failure_without_aborting_the_batch(self, client, make_venue):
        venue = make_venue(category="Restaurant")

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": ["does-not-exist", venue.id], "category": "Hotel"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1

    def test_does_not_log_activity(self, client, make_venue, db):
        # Bulk category update is a bulk Save Draft — Save Draft itself is
        # deliberately unlogged (Sprint 19), and this doesn't change that.
        from .conftest import latest_activity

        venue = make_venue(category="Restaurant")

        client.patch(
            "/editor/venues/bulk", json={"venue_ids": [venue.id], "category": "Hotel"}
        )

        entry = latest_activity(db, entity_type="venue", entity_id=venue.id)
        assert entry is None

    def test_viewer_cannot_bulk_update_category(self, client, make_venue, as_role):
        venue = make_venue(category="Restaurant")
        as_role("viewer")

        response = client.patch(
            "/editor/venues/bulk", json={"venue_ids": [venue.id], "category": "Hotel"}
        )

        assert response.status_code == 403


class TestBulkDestinationUpdate:
    def test_reassigns_every_venue_to_the_target_destination(
        self, client, make_destination, make_venue, db
    ):
        target = make_destination()
        first = make_venue()
        second = make_venue()

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [first.id, second.id], "destination_id": target.id},
        )

        assert response.status_code == 200
        assert response.json()["succeeded"] == 2
        db.refresh(first)
        db.refresh(second)
        assert first.destination_id == target.id
        assert second.destination_id == target.id

    def test_rejects_an_unknown_destination_before_touching_any_venue(self, client, make_venue, db):
        venue = make_venue()
        original_destination_id = venue.destination_id

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [venue.id], "destination_id": "does-not-exist"},
        )

        assert response.status_code == 404
        db.refresh(venue)
        assert venue.destination_id == original_destination_id

    def test_unknown_venue_id_reports_failure_without_aborting_the_batch(
        self, client, make_destination, make_venue
    ):
        target = make_destination()
        venue = make_venue()

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": ["does-not-exist", venue.id], "destination_id": target.id},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["succeeded"] == 1
        assert body["failed"] == 1

    def test_viewer_cannot_bulk_update_destination(self, client, make_destination, make_venue, as_role):
        target = make_destination()
        venue = make_venue()
        as_role("viewer")

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [venue.id], "destination_id": target.id},
        )

        assert response.status_code == 403


class TestBulkRequestValidation:
    def test_empty_venue_ids_is_rejected(self, client):
        response = client.post("/editor/venues/bulk/validate", json={"venue_ids": []})

        assert response.status_code == 422

    def test_over_the_cap_venue_ids_is_rejected(self, client):
        response = client.post(
            "/editor/venues/bulk/validate", json={"venue_ids": [f"v{i}" for i in range(101)]}
        )

        assert response.status_code == 422


class TestBulkUpdateUnified:
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.6 — the new capability the unified
    endpoint adds over the two it replaced: setting both fields in one call.
    """

    def test_updates_category_and_destination_in_one_call(self, client, make_destination, make_venue, db):
        target = make_destination()
        venue = make_venue(category="Restaurant")

        response = client.patch(
            "/editor/venues/bulk",
            json={"venue_ids": [venue.id], "category": "Cafe", "destination_id": target.id},
        )

        assert response.status_code == 200
        assert response.json()["succeeded"] == 1
        db.refresh(venue)
        assert venue.category == "Cafe"
        assert venue.destination_id == target.id

    def test_rejects_a_call_with_neither_field(self, client, make_venue):
        venue = make_venue()

        response = client.patch("/editor/venues/bulk", json={"venue_ids": [venue.id]})

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "no_fields_to_update"
