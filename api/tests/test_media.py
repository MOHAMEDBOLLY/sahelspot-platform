"""Sprint 25 — Media Library Foundation.

No real Supabase Storage credentials exist in this environment (same
situation Sprint 22's auth work was in), so every test here monkeypatches
`httpx.put` — the one network call `app/media/service.py` makes — rather
than skipping storage-dependent behavior. This still exercises the real
route: permission gating, the venue update (cover vs. gallery), the
"reassign, don't mutate in place" array-update requirement, and the
content-type/size validation, all against the real database.
"""

import httpx
import pytest

from app.core.config import settings
from app.media.service import MAX_UPLOAD_BYTES


@pytest.fixture(autouse=True)
def configured_storage(monkeypatch):
    """Every test in this file needs `upload_image()` to believe storage
    is configured — without this, every upload would 503 before ever
    reaching the mocked network call.
    """
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")


@pytest.fixture()
def mock_successful_upload(monkeypatch):
    def _fake_put(url, *, content, headers, timeout):
        return httpx.Response(status_code=200, request=httpx.Request("PUT", url))

    monkeypatch.setattr(httpx, "put", _fake_put)


class TestUploadCover:
    def test_sets_cover_image_url(self, client, make_venue, mock_successful_upload):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["cover_image_url"] is not None
        assert "venue-media" in body["cover_image_url"] or "storage" in body["cover_image_url"]

    def test_replaces_existing_cover_image_url(self, client, make_venue, mock_successful_upload, db):
        venue = make_venue(cover_image_url="https://example.com/old-cover.jpg")

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] != "https://example.com/old-cover.jpg"


class TestUploadGallery:
    def test_appends_to_empty_gallery(self, client, make_venue, mock_successful_upload):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "gallery"},
            files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert len(response.json()["gallery_image_urls"]) == 1

    def test_appends_without_discarding_existing_gallery_images(
        self, client, make_venue, mock_successful_upload
    ):
        venue = make_venue(gallery_image_urls=["https://example.com/existing.jpg"])

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "gallery"},
            files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        urls = response.json()["gallery_image_urls"]
        assert len(urls) == 2
        assert "https://example.com/existing.jpg" in urls


class TestValidation:
    def test_rejects_unsupported_content_type(self, client, make_venue, mock_successful_upload):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("notes.txt", b"not an image", "text/plain")},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "unsupported_media_type"

    def test_rejects_file_over_the_size_limit(self, client, make_venue, mock_successful_upload):
        venue = make_venue()
        oversized = b"x" * (MAX_UPLOAD_BYTES + 1)

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", oversized, "image/jpeg")},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "file_too_large"

    def test_unknown_venue_returns_404(self, client, mock_successful_upload):
        response = client.post(
            "/editor/venues/does-not-exist/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 404


class TestStorageNotConfigured:
    def test_returns_503_when_supabase_settings_are_unset(self, client, make_venue, monkeypatch):
        monkeypatch.setattr(settings, "supabase_url", None)
        monkeypatch.setattr(settings, "supabase_service_role_key", None)
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 503


class TestUploadStorageFailure:
    def test_returns_502_when_storage_rejects_the_upload(self, client, make_venue, monkeypatch):
        def _fake_put(url, *, content, headers, timeout):
            return httpx.Response(status_code=500, request=httpx.Request("PUT", url))

        monkeypatch.setattr(httpx, "put", _fake_put)
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 502


class TestUploadPermission:
    def test_viewer_cannot_upload_media(self, client, make_venue, mock_successful_upload):
        from app.auth.dependencies import CurrentUser, get_current_user
        from app.main import app as fastapi_app

        venue = make_venue()
        fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="test-viewer", email="viewer@example.com", role="viewer"
        )
        try:
            response = client.post(
                f"/editor/venues/{venue.id}/media",
                data={"slot": "cover"},
                files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
            )
        finally:
            from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE

            fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
                id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
            )

        assert response.status_code == 403
