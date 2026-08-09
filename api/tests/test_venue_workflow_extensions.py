"""PLATFORM_SPEC_v1.0_FROZEN.md §7.4 (Reject, with a required reason) and
§6.3/§7.8 (beach_details writable via PATCH /editor/venues/{id}).
"""


class TestRejectVenue:
    def test_requires_a_reason(self, client, make_venue):
        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/reject", json={"reason": ""})

        assert response.status_code == 422

    def test_moves_review_to_draft_and_logs_reason(self, client, make_venue, db):
        from .conftest import latest_activity

        venue = make_venue(status="review")

        response = client.post(f"/editor/venues/{venue.id}/reject", json={"reason": "Needs a real cover photo"})

        assert response.status_code == 200
        assert response.json()["status"] == "draft"
        db.refresh(venue)
        assert venue.status == "draft"

        entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="reject")
        assert entry is not None
        assert entry.activity_metadata["reason"] == "Needs a real cover photo"

    def test_rejects_wrong_status(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.post(f"/editor/venues/{venue.id}/reject", json={"reason": "x"})

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "invalid_transition"

    def test_unknown_venue_returns_404(self, client):
        response = client.post("/editor/venues/does-not-exist/reject", json={"reason": "x"})

        assert response.status_code == 404


class TestBeachDetailsPatch:
    def test_sets_beach_details_when_category_is_beach(self, client, make_venue):
        venue = make_venue(category="Beach Club", beach_details={"type": None, "publicAccess": "unknown"})

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"beach_details": {"type": "public", "publicAccess": "yes"}},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["beach_details"] == {"type": "public", "publicAccess": "yes"}

    def test_rejects_missing_key(self, client, make_venue):
        venue = make_venue(category="Beach Club", beach_details={"type": None, "publicAccess": "unknown"})

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"beach_details": {"type": "public"}},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_beach_details"

    def test_rejects_beach_details_on_a_non_beach_venue(self, client, make_venue):
        venue = make_venue(category="Restaurant")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"beach_details": {"type": "public", "publicAccess": "yes"}},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_beach_details"

    def test_setting_category_and_beach_details_together_is_validated_against_the_new_category(
        self, client, make_venue
    ):
        venue = make_venue(category="Restaurant")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"category": "Beach Club", "beach_details": {"type": "public", "publicAccess": "yes"}},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["category"] == "Beach Club"
        assert response.json()["beach_details"] == {"type": "public", "publicAccess": "yes"}


class TestTranslationsPatch:
    def test_updates_translations(self, client, make_venue, db):
        """EP23 — `translations` is writable via PATCH (PLATFORM_SPEC_v1.0_
        FROZEN.md §5); previously readable on `VenueOut` but absent from
        `VenueUpdate`, so it silently couldn't be saved.
        """
        venue = make_venue()

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"translations": {"ar": {"name": "مطعم النخيل"}}},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["translations"] == {"ar": {"name": "مطعم النخيل"}}
        db.refresh(venue)
        assert venue.translations == {"ar": {"name": "مطعم النخيل"}}
