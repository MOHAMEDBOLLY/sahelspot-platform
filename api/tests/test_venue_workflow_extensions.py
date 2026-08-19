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


class TestBookingCtaUrlsPatch:
    """Booking CTA Fields (Phase 1) — three plain optional external URLs,
    same shape/treatment as every other contact/social field (no format
    validation, writable via the same PATCH path)."""

    def test_sets_reserve_your_spot_beach_url(self, client, make_venue, db):
        venue = make_venue(category="Beach Club")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"reserve_your_spot_beach_url": "https://booking.example.com/beach"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["reserve_your_spot_beach_url"] == "https://booking.example.com/beach"
        db.refresh(venue)
        assert venue.reserve_your_spot_beach_url == "https://booking.example.com/beach"

    def test_sets_reserve_your_table_url(self, client, make_venue, db):
        venue = make_venue(category="Restaurant")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"reserve_your_table_url": "https://booking.example.com/table"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["reserve_your_table_url"] == "https://booking.example.com/table"
        db.refresh(venue)
        assert venue.reserve_your_table_url == "https://booking.example.com/table"

    def test_sets_reserve_your_spot_nightlife_url(self, client, make_venue, db):
        venue = make_venue(category="Nightlife")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"reserve_your_spot_nightlife_url": "https://booking.example.com/nightlife"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["reserve_your_spot_nightlife_url"] == "https://booking.example.com/nightlife"
        db.refresh(venue)
        assert venue.reserve_your_spot_nightlife_url == "https://booking.example.com/nightlife"

    def test_no_format_validation_is_applied(self, client, make_venue):
        """Same "plain free text, not validated" treatment as website/
        instagram_handle/etc — confirmed by audit before writing this
        migration; a non-URL string is accepted, same as those fields."""
        venue = make_venue(category="Beach Club")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"reserve_your_spot_beach_url": "not-a-url"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["reserve_your_spot_beach_url"] == "not-a-url"

    def test_defaults_to_null(self, client, make_venue):
        venue = make_venue()

        response = client.get(f"/editor/venues/{venue.id}")

        assert response.json()["reserve_your_spot_beach_url"] is None
        assert response.json()["reserve_your_table_url"] is None
        assert response.json()["reserve_your_spot_nightlife_url"] is None
