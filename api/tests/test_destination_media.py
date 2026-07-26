"""Sprint 29 — destination cover image upload. Same mocking approach as
test_media.py's venue upload tests: no real Supabase Storage credentials
exist in this environment, so `httpx.put` (the one network call
`app/media/service.py` makes) is monkeypatched rather than skipped.
`upload_destination_cover` reuses that exact function unchanged — these
tests exercise the route (permission gating, 404, the actual column
write), not a second upload implementation.
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


class TestUploadDestinationCover:
    def test_sets_cover_image_url(self, client, make_destination, mock_successful_upload):
        destination = make_destination()

        response = client.post(
            f"/editor/destinations/{destination.id}/media",
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is not None

    def test_replaces_existing_cover_image_url(self, client, make_destination, mock_successful_upload):
        destination = make_destination(cover_image_url="https://example.com/old-cover.jpg")

        response = client.post(
            f"/editor/destinations/{destination.id}/media",
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] != "https://example.com/old-cover.jpg"

    def test_rejects_unsupported_content_type(self, client, make_destination, mock_successful_upload):
        destination = make_destination()

        response = client.post(
            f"/editor/destinations/{destination.id}/media",
            files={"file": ("notes.txt", b"not an image", "text/plain")},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "unsupported_media_type"

    def test_unknown_destination_returns_404(self, client, mock_successful_upload):
        response = client.post(
            "/editor/destinations/does-not-exist/media",
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 404

    def test_viewer_cannot_upload_cover(self, client, make_destination, mock_successful_upload, as_role):
        destination = make_destination()
        as_role("viewer")

        response = client.post(
            f"/editor/destinations/{destination.id}/media",
            files={"file": ("cover.jpg", b"fake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 403

    def test_clearing_cover_via_patch(self, client, make_destination, db):
        destination = make_destination(cover_image_url="https://example.com/cover.jpg")

        response = client.patch(
            f"/editor/destinations/{destination.id}", json={"cover_image_url": None}
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None
