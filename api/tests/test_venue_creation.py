"""PLATFORM_SPEC_v1.0_FROZEN.md §8.2 — POST /editor/venues, the one write
path venues never had. Covers success, duplicate id, reserved id, unknown
destination, invalid category, and the beach_details shape gate at
creation time. Also DELETE .../media (§8.4/§9.2).
"""

import uuid

import httpx
import pytest

from app.core.config import settings


def _tag() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture(autouse=True)
def configured_storage(monkeypatch):
    """Same fixture `test_media.py` defines for itself — `delete_image()`
    needs storage to appear configured, and a mocked `httpx.delete` so
    these tests never make a real network call.
    """
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")
    monkeypatch.setattr(
        httpx, "delete", lambda url, *, headers, timeout: httpx.Response(200, request=httpx.Request("DELETE", url))
    )


class TestCreateVenue:
    def test_creates_a_draft_venue(self, client, make_destination, db):
        from app.db.models import Venue

        destination = make_destination()
        venue_id = f"test-v-create-{_tag()}"
        try:
            response = client.post(
                "/editor/venues",
                json={
                    "id": venue_id,
                    "name": "New Venue",
                    "slug": f"new-venue-{venue_id}",
                    "destination_id": destination.id,
                    "category": "Restaurant",
                },
            )

            assert response.status_code == 201
            body = response.json()
            assert body["id"] == venue_id
            assert body["status"] == "draft"
            assert body["destination"]["id"] == destination.id
        finally:
            db.query(Venue).filter(Venue.id == venue_id).delete()
            db.commit()

    def test_rejects_a_duplicate_id(self, client, make_venue):
        venue = make_venue()

        response = client.post(
            "/editor/venues",
            json={
                "id": venue.id,
                "name": "Duplicate",
                "slug": "duplicate-slug",
                "destination_id": venue.destination_id,
                "category": "Restaurant",
            },
        )

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "venue_already_exists"

    def test_rejects_a_reserved_id(self, client, make_destination):
        destination = make_destination()

        response = client.post(
            "/editor/venues",
            json={
                "id": "bulk",
                "name": "Nope",
                "slug": "nope",
                "destination_id": destination.id,
                "category": "Restaurant",
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "reserved_id"

    def test_rejects_an_unknown_destination(self, client):
        response = client.post(
            "/editor/venues",
            json={
                "id": f"test-v-{_tag()}",
                "name": "Orphan",
                "slug": "orphan",
                "destination_id": "does-not-exist",
                "category": "Restaurant",
            },
        )

        assert response.status_code == 404

    def test_rejects_an_unrecognized_category(self, client, make_destination):
        destination = make_destination()

        response = client.post(
            "/editor/venues",
            json={
                "id": f"test-v-{_tag()}",
                "name": "Bad Category",
                "slug": "bad-category",
                "destination_id": destination.id,
                "category": "NotARealCategory",
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_category"

    def test_creates_a_beach_with_valid_beach_details(self, client, make_destination, db):
        from app.db.models import Venue

        destination = make_destination()
        venue_id = f"test-v-beach-{_tag()}"
        try:
            response = client.post(
                "/editor/venues",
                json={
                    "id": venue_id,
                    "name": "New Beach",
                    "slug": f"new-beach-{venue_id}",
                    "destination_id": destination.id,
                    "category": "Beach",
                    "beach_details": {"type": "public", "publicAccess": "yes"},
                },
            )

            assert response.status_code == 201
            assert response.json()["beach_details"] == {"type": "public", "publicAccess": "yes"}
        finally:
            db.query(Venue).filter(Venue.id == venue_id).delete()
            db.commit()

    def test_rejects_beach_details_on_a_non_beach_category(self, client, make_destination):
        destination = make_destination()

        response = client.post(
            "/editor/venues",
            json={
                "id": f"test-v-{_tag()}",
                "name": "Not A Beach",
                "slug": "not-a-beach",
                "destination_id": destination.id,
                "category": "Restaurant",
                "beach_details": {"type": "public", "publicAccess": "yes"},
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_beach_details"

    def test_viewer_cannot_create(self, client, as_role, make_destination):
        destination = make_destination()
        as_role("viewer")

        response = client.post(
            "/editor/venues",
            json={
                "id": f"test-v-{_tag()}",
                "name": "Nope",
                "slug": "nope",
                "destination_id": destination.id,
                "category": "Restaurant",
            },
        )

        assert response.status_code == 403


class TestDeleteVenueMedia:
    def test_clears_cover_image_url(self, client, make_venue):
        venue = make_venue(cover_image_url="https://example.com/cover.jpg")

        response = client.delete(f"/editor/venues/{venue.id}/media?slot=cover")

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None

    def test_clearing_absent_cover_is_idempotent(self, client, make_venue):
        venue = make_venue(cover_image_url=None)

        response = client.delete(f"/editor/venues/{venue.id}/media?slot=cover")

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None

    def test_removes_one_gallery_image(self, client, make_venue):
        venue = make_venue(
            gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"]
        )

        response = client.delete(
            f"/editor/venues/{venue.id}/media?slot=gallery&url=https://example.com/a.jpg"
        )

        assert response.status_code == 200
        assert response.json()["gallery_image_urls"] == ["https://example.com/b.jpg"]

    def test_gallery_delete_requires_url(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])

        response = client.delete(f"/editor/venues/{venue.id}/media?slot=gallery")

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "url_required"

    def test_unknown_venue_returns_404(self, client):
        response = client.delete("/editor/venues/does-not-exist/media?slot=cover")

        assert response.status_code == 404
