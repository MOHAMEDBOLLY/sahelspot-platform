"""Brand Asset Propagation for Venue Covers. Same mocked-storage pattern
`test_media.py` already establishes — `configured_storage`/
`mock_successful_upload` here are the same fixtures, deliberately not
imported from that file (this repo doesn't share fixtures across test
files outside conftest.py) but written identically since they exercise
the same real route, permission gating, and database.
"""

import httpx
import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def configured_storage(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")


@pytest.fixture()
def mock_successful_upload(monkeypatch):
    def _fake_put(url, *, content, headers, timeout):
        return httpx.Response(status_code=200, request=httpx.Request("PUT", url))

    monkeypatch.setattr(httpx, "put", _fake_put)


class TestBrandFilter:
    def test_list_venues_filters_by_brand(self, client, make_venue):
        kazoku_1 = make_venue(name="Kazoku Marassi", brand="Kazoku")
        kazoku_2 = make_venue(name="Kazoku Almaza", brand="Kazoku")
        make_venue(name="Unrelated Cafe", brand=None)

        response = client.get("/editor/venues", params={"brand": "Kazoku"})

        assert response.status_code == 200
        ids = {item["id"] for item in response.json()["items"]}
        assert ids == {kazoku_1.id, kazoku_2.id}

    def test_venue_with_no_brand_is_excluded_from_any_brand_filter(self, client, make_venue):
        make_venue(name="No Brand Venue", brand=None)

        response = client.get("/editor/venues", params={"brand": "Kazoku"})

        assert response.status_code == 200
        assert response.json()["items"] == []


class TestSingleVenueCoverUploadUnaffected:
    """Requirement: single venue upload still works — apply_to_brand
    defaults to False, so every existing call site (and every test in
    test_media.py) is unaffected by this feature's addition.
    """

    def test_upload_without_apply_to_brand_only_changes_this_venue(
        self, client, make_venue, mock_successful_upload, db
    ):
        target = make_venue(name="Kazoku Marassi", brand="Kazoku")
        sibling = make_venue(name="Kazoku Almaza", brand="Kazoku")

        response = client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is not None
        db.refresh(sibling)
        assert sibling.cover_image_url is None

    def test_venue_with_no_brand_ignores_apply_to_brand_flag(
        self, client, make_venue, mock_successful_upload
    ):
        """No brand set — apply_to_brand=true has nothing to propagate to,
        and must not error."""
        venue = make_venue(name="Standalone Venue", brand=None)

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is not None


class TestBrandPropagation:
    def test_updates_every_venue_in_the_same_brand(self, client, make_venue, mock_successful_upload, db):
        target = make_venue(name="Kazoku Marassi", brand="Kazoku")
        sibling_1 = make_venue(name="Kazoku Almaza", brand="Kazoku")
        sibling_2 = make_venue(name="Kazoku Hacienda", brand="Kazoku")

        response = client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        new_url = response.json()["cover_image_url"]
        assert new_url is not None

        db.refresh(sibling_1)
        db.refresh(sibling_2)
        assert sibling_1.cover_image_url == new_url
        assert sibling_2.cover_image_url == new_url

    def test_does_not_touch_unrelated_venues(self, client, make_venue, mock_successful_upload, db):
        target = make_venue(name="Kazoku Marassi", brand="Kazoku")
        make_venue(name="Kazoku Almaza", brand="Kazoku")
        unrelated = make_venue(
            name="Some Other Cafe",
            brand="Different Brand",
            cover_image_url="https://example.com/unrelated-cover.jpg",
        )
        no_brand = make_venue(name="No Brand Venue", brand=None)

        client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        db.refresh(unrelated)
        db.refresh(no_brand)
        assert unrelated.cover_image_url == "https://example.com/unrelated-cover.jpg"
        assert no_brand.cover_image_url is None

    def test_preserves_all_other_sibling_data(self, client, make_venue, mock_successful_upload, db):
        """Propagation must only ever touch cover_image_url — never
        location, category, contacts, or anything else on a sibling."""
        target = make_venue(name="Kazoku Marassi", brand="Kazoku", category="Restaurant")
        sibling = make_venue(
            name="Kazoku Almaza",
            brand="Kazoku",
            category="Cafe",
            latitude="30.123456",
            longitude="28.654321",
            phone="0123456789",
            district="Original District",
        )

        client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        db.refresh(sibling)
        assert sibling.category == "Cafe"
        assert str(sibling.latitude) == "30.123456"
        assert str(sibling.longitude) == "28.654321"
        assert sibling.phone == "0123456789"
        assert sibling.district == "Original District"
        assert sibling.name == "Kazoku Almaza"

    def test_sibling_version_increments(self, client, make_venue, mock_successful_upload, db):
        """A sibling was genuinely written to — its optimistic-concurrency
        version must still advance, same as any other field change
        (`update_venue`'s own contract)."""
        target = make_venue(name="Kazoku Marassi", brand="Kazoku")
        sibling = make_venue(name="Kazoku Almaza", brand="Kazoku")
        original_version = sibling.version

        client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        db.refresh(sibling)
        assert sibling.version == original_version + 1

    def test_gallery_upload_ignores_apply_to_brand(self, client, make_venue, mock_successful_upload, db):
        """Propagation is cover-only, per spec — a gallery upload with
        apply_to_brand=true must not touch any sibling."""
        target = make_venue(name="Kazoku Marassi", brand="Kazoku")
        sibling = make_venue(name="Kazoku Almaza", brand="Kazoku")

        response = client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "gallery", "apply_to_brand": "true"},
            files={"file": ("photo.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        db.refresh(sibling)
        assert sibling.cover_image_url is None
        assert sibling.gallery_image_urls in (None, [])


class TestConsumerReceivesUpdatedCovers:
    def test_publish_after_propagation_reflects_new_cover_on_every_sibling(
        self, client, make_venue, mock_successful_upload, preserve_seed_state
    ):
        target = make_venue(name="Kazoku Marassi", brand="Kazoku", status="approved")
        sibling = make_venue(name="Kazoku Almaza", brand="Kazoku", status="approved")

        upload_response = client.post(
            f"/editor/venues/{target.id}/media",
            data={"slot": "cover", "apply_to_brand": "true"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )
        new_url = upload_response.json()["cover_image_url"]

        client.post("/editor/publish")

        public_response = client.get("/public/venues")
        assert public_response.status_code == 200
        by_id = {item["id"]: item for item in public_response.json()}
        assert by_id[target.id]["cover_image_url"] == new_url
        assert by_id[sibling.id]["cover_image_url"] == new_url
