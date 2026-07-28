"""Sprint 25 — Media Library Foundation. Sprint 26 — Media Management
(reorder, set-cover-from-gallery, and their permission/consistency
coverage) extends this same file rather than starting a new one, since
it's testing the same upload route plus one small addition.

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

from app.auth.dependencies import CurrentUser, get_current_user
from app.core.config import settings
from app.main import app as fastapi_app
from app.media.service import MAX_UPLOAD_BYTES

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE


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


@pytest.fixture()
def as_role(client):
    """Overrides `get_current_user` with a fixed identity holding the given
    role for one test — same technique `test_permissions.py` uses. Restores
    the standard admin override afterward.
    """

    def _set(role: str) -> None:
        fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=TEST_USER_ID, email=TEST_USER_EMAIL, role=role
        )

    yield _set

    fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


class TestUploadCover:
    def test_sets_cover_image_url(self, client, make_venue, mock_successful_upload):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
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
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] != "https://example.com/old-cover.jpg"


class TestUploadGallery:
    def test_appends_to_empty_gallery(self, client, make_venue, mock_successful_upload):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "gallery"},
            files={"file": ("photo.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
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
            files={"file": ("photo.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
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
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 404

    def test_unknown_venue_with_an_oversized_file_still_returns_404_not_422(
        self, client, mock_successful_upload
    ):
        # Security hardening — `reject_if_declared_too_large` runs *after*
        # the 404 check, preserving the existing precedence: a nonexistent
        # venue must still 404 before any file-size handling, not 422.
        oversized = b"x" * (MAX_UPLOAD_BYTES + 1)

        response = client.post(
            "/editor/venues/does-not-exist/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", oversized, "image/jpeg")},
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
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
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
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 502


class TestUploadPermission:
    def test_viewer_cannot_upload_media(self, client, make_venue, mock_successful_upload, as_role):
        venue = make_venue()
        as_role("viewer")

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 403


class TestSetCoverFromGallery:
    """Sprint 26 — promoting an existing gallery image to cover."""

    def test_promotes_a_gallery_image_to_cover(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"])

        response = client.post(
            f"/editor/venues/{venue.id}/media/set-cover",
            json={"url": "https://example.com/b.jpg"},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] == "https://example.com/b.jpg"

    def test_promoted_image_remains_in_the_gallery(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])

        response = client.post(
            f"/editor/venues/{venue.id}/media/set-cover",
            json={"url": "https://example.com/a.jpg"},
        )

        assert response.status_code == 200
        assert "https://example.com/a.jpg" in response.json()["gallery_image_urls"]

    def test_rejects_a_url_not_in_the_gallery(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])

        response = client.post(
            f"/editor/venues/{venue.id}/media/set-cover",
            json={"url": "https://example.com/not-in-gallery.jpg"},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "not_in_gallery"

    def test_rejects_when_gallery_is_empty(self, client, make_venue):
        venue = make_venue()

        response = client.post(
            f"/editor/venues/{venue.id}/media/set-cover",
            json={"url": "https://example.com/anything.jpg"},
        )

        assert response.status_code == 422

    def test_unknown_venue_returns_404(self, client):
        response = client.post(
            "/editor/venues/does-not-exist/media/set-cover",
            json={"url": "https://example.com/a.jpg"},
        )

        assert response.status_code == 404

    def test_viewer_cannot_set_cover(self, client, make_venue, as_role):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])
        as_role("viewer")

        response = client.post(
            f"/editor/venues/{venue.id}/media/set-cover",
            json={"url": "https://example.com/a.jpg"},
        )

        assert response.status_code == 403


class TestGalleryReordering:
    """Sprint 26 — reordering reuses the existing PATCH; no new endpoint.
    See `update_venue`'s docstring in `routes/venues.py` for why.
    """

    def test_patch_persists_a_new_gallery_order(self, client, make_venue):
        venue = make_venue(
            gallery_image_urls=[
                "https://example.com/a.jpg",
                "https://example.com/b.jpg",
                "https://example.com/c.jpg",
            ]
        )
        reordered = [
            "https://example.com/c.jpg",
            "https://example.com/a.jpg",
            "https://example.com/b.jpg",
        ]

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": reordered},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["gallery_image_urls"] == reordered

    def test_reordered_order_survives_a_fresh_read(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"])
        reordered = ["https://example.com/b.jpg", "https://example.com/a.jpg"]
        client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": reordered},
            headers={"If-Match": str(venue.version)},
        )

        response = client.get(f"/editor/venues/{venue.id}")

        assert response.json()["gallery_image_urls"] == reordered

    def test_reordering_does_not_touch_cover_image_url(self, client, make_venue):
        venue = make_venue(
            cover_image_url="https://example.com/cover.jpg",
            gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"],
        )

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": ["https://example.com/b.jpg", "https://example.com/a.jpg"]},
            headers={"If-Match": str(venue.version)},
        )

        assert response.json()["cover_image_url"] == "https://example.com/cover.jpg"

    def test_viewer_cannot_reorder_gallery(self, client, make_venue, as_role):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"])
        as_role("viewer")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": ["https://example.com/b.jpg", "https://example.com/a.jpg"]},
        )

        assert response.status_code == 403


class TestGalleryDeletion:
    """Sprint 26 — removing a gallery image also reuses the existing
    PATCH (made editable in Sprint 25); no dedicated delete endpoint.
    """

    def test_patch_removes_one_gallery_image(self, client, make_venue):
        venue = make_venue(
            gallery_image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"]
        )

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": ["https://example.com/b.jpg"]},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["gallery_image_urls"] == ["https://example.com/b.jpg"]

    def test_patch_can_clear_the_entire_gallery(self, client, make_venue):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"gallery_image_urls": []},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["gallery_image_urls"] == []

    def test_clearing_cover_image_url(self, client, make_venue):
        venue = make_venue(cover_image_url="https://example.com/cover.jpg")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"cover_image_url": None},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None

    def test_viewer_cannot_remove_gallery_images(self, client, make_venue, as_role):
        venue = make_venue(gallery_image_urls=["https://example.com/a.jpg"])
        as_role("viewer")

        response = client.patch(f"/editor/venues/{venue.id}", json={"gallery_image_urls": []})

        assert response.status_code == 403
