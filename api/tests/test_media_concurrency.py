"""H3 — media storage calls must not block the event loop.

The regression this fences: `upload_image`/`delete_image` used the
*synchronous* `httpx.put`/`httpx.delete` while the upload routes were
`async def`. A synchronous network call inside a coroutine blocks the
whole event loop for its duration — measured before the fix, a 2s storage
stall delayed every concurrent request by 2091ms, and the 30s timeout
would stall the entire API process.

These tests use a real ASGI transport with `asyncio`, not `TestClient`:
`TestClient` is synchronous and runs each request to completion, so it
cannot observe loop blocking at all — a suite built only on it would pass
just as happily with the bug present.

Timing note: each concurrent request is timed from a fixed origin taken
*before* the requests are launched. Timing from inside the coroutine
would start the clock only after a blocked loop resumed, hiding the exact
delay being measured (this produced a false negative during the H3
investigation before the method was corrected).
"""

import asyncio
import time

import httpx
import pytest

from app.auth.dependencies import CurrentUser, get_current_user
from app.core.config import settings
from app.main import app as fastapi_app
from app.media import service as media_service

from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE

# Long enough that a blocked loop is unambiguous, short enough to keep the
# suite fast. The assertion threshold is a wide margin below it.
STALL_SECONDS = 1.0
JPEG_BYTES = b"\xff\xd8\xff" + b"padding-bytes" * 64


@pytest.fixture()
def stalled_storage(monkeypatch):
    """Storage that takes `STALL_SECONDS` to respond, implemented the way a
    slow network genuinely behaves for the calling task: an awaitable that
    yields to the loop. If the production code were still calling a
    *synchronous* client, it would block regardless of this fixture — which
    is precisely what these tests detect."""
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")

    async def _slow_put(url, *, content, headers):
        await asyncio.sleep(STALL_SECONDS)
        return httpx.Response(200, request=httpx.Request("PUT", url))

    async def _slow_delete(url, *, headers):
        await asyncio.sleep(STALL_SECONDS)
        return httpx.Response(200, request=httpx.Request("DELETE", url))

    monkeypatch.setattr(media_service, "_storage_put", _slow_put)
    monkeypatch.setattr(media_service, "_storage_delete", _slow_delete)


@pytest.fixture()
def event_with_cover(db, make_destination):
    """A minimal draft event. `make_event` lives in `test_events.py` rather
    than `conftest.py`; promoting it to a shared fixture would be an
    unrelated refactor, so this file creates the one row it needs and
    cleans it up. `destination_id` satisfies `ck_events_has_location`.
    """
    import datetime
    import uuid

    from app.db.models import Event

    event_id = f"test-e-h3-{uuid.uuid4().hex[:8]}"
    event = Event(
        id=event_id,
        title="H3 Probe Event",
        slug=f"h3-probe-{event_id}",
        status="draft",
        start_date=datetime.date(2026, 12, 1),
        destination_id=make_destination().id,
    )
    db.add(event)
    db.commit()
    yield event
    db.query(Event).filter(Event.id == event_id).delete()
    db.commit()


@pytest.fixture()
def authenticated_asgi():
    """`get_current_user` is overridden by conftest's autouse fixture for
    `TestClient`; the ASGI transport used here needs the same override."""
    fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


async def _measure_loop_responsiveness(media_request):
    """Runs `media_request` concurrently with several trivial GETs and
    returns the worst trivial-GET latency, measured from a fixed origin."""
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        started_at = time.perf_counter()

        async def trivial_request():
            await asyncio.sleep(0.05)  # let the media request reach storage first
            response = await client.get("/")
            return (time.perf_counter() - started_at) * 1000, response.status_code

        results = await asyncio.gather(
            media_request(client), *[trivial_request() for _ in range(5)]
        )
        media_status = results[0]
        latencies = [ms for ms, _ in results[1:]]
        statuses = {status for _, status in results[1:]}
        assert statuses == {200}
        return media_status, max(latencies)


# A blocked loop would show ~STALL_SECONDS (1000ms). A responsive loop
# answers in single-digit ms. 500ms is a wide margin either side.
BLOCKING_THRESHOLD_MS = STALL_SECONDS * 500


class TestUploadDoesNotBlockTheEventLoop:
    def test_venue_cover_upload_leaves_the_loop_responsive(
        self, make_venue, stalled_storage, authenticated_asgi
    ):
        venue = make_venue()

        async def upload(client):
            response = await client.post(
                f"/editor/venues/{venue.id}/media",
                data={"slot": "cover"},
                files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
            )
            return response.status_code

        status, worst_ms = asyncio.run(_measure_loop_responsiveness(upload))

        assert status == 200
        assert worst_ms < BLOCKING_THRESHOLD_MS, (
            f"event loop was blocked for {worst_ms:.0f}ms during a "
            f"{STALL_SECONDS}s storage call — the H3 regression is back"
        )

    def test_event_cover_upload_leaves_the_loop_responsive(
        self, event_with_cover, stalled_storage, authenticated_asgi
    ):
        event = event_with_cover

        async def upload(client):
            response = await client.post(
                f"/editor/events/{event.id}/media",
                files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
            )
            return response.status_code

        status, worst_ms = asyncio.run(_measure_loop_responsiveness(upload))

        assert status == 200
        assert worst_ms < BLOCKING_THRESHOLD_MS

    def test_destination_cover_upload_leaves_the_loop_responsive(
        self, make_destination, stalled_storage, authenticated_asgi
    ):
        destination = make_destination()

        async def upload(client):
            response = await client.post(
                f"/editor/destinations/{destination.id}/media",
                files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
            )
            return response.status_code

        status, worst_ms = asyncio.run(_measure_loop_responsiveness(upload))

        assert status == 200
        assert worst_ms < BLOCKING_THRESHOLD_MS


class TestDeleteDoesNotBlockTheEventLoop:
    """These routes became `async def` in H3. They were previously sync
    `def` (threadpool-dispatched, so never a loop problem) — this proves
    the conversion did not introduce one."""

    def test_venue_media_delete_leaves_the_loop_responsive(
        self, make_venue, stalled_storage, authenticated_asgi
    ):
        venue = make_venue(
            cover_image_url=(
                "https://example.supabase.co/storage/v1/object/public/"
                "venue-media/venues/x/cover.jpg"
            )
        )

        async def delete(client):
            response = await client.request(
                "DELETE", f"/editor/venues/{venue.id}/media", params={"slot": "cover"}
            )
            return response.status_code

        status, worst_ms = asyncio.run(_measure_loop_responsiveness(delete))

        assert status == 200
        assert worst_ms < BLOCKING_THRESHOLD_MS


class TestTransportFailuresAreStructured:
    """H3 — a storage *transport* failure (unreachable, DNS, timeout) had no
    handling and escaped as a generic 500. A storage *error status* was
    already a structured 502. Both are 502 now."""

    @pytest.fixture()
    def unreachable_storage(self, monkeypatch):
        monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
        monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")

    @pytest.mark.parametrize(
        "error",
        [
            httpx.ConnectError("connection refused"),
            httpx.ReadTimeout("timed out"),
            httpx.ConnectTimeout("connect timed out"),
        ],
    )
    def test_upload_transport_failure_is_502_not_500(
        self, client, make_venue, monkeypatch, unreachable_storage, error
    ):
        venue = make_venue()

        async def _raising_put(url, *, content, headers):
            raise error

        monkeypatch.setattr(media_service, "_storage_put", _raising_put)

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
        )

        assert response.status_code == 502
        assert response.json()["detail"] == "Failed to upload media."

    def test_upload_error_status_is_still_502(
        self, client, make_venue, monkeypatch, unreachable_storage
    ):
        """Unchanged pre-existing behaviour — guarded so H3's new except
        block can't be mistaken for the only path to a 502."""
        venue = make_venue()

        async def _failing_put(url, *, content, headers):
            return httpx.Response(500, request=httpx.Request("PUT", url))

        monkeypatch.setattr(media_service, "_storage_put", _failing_put)

        response = client.post(
            f"/editor/venues/{venue.id}/media",
            data={"slot": "cover"},
            files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
        )

        assert response.status_code == 502

    def test_delete_transport_failure_stays_best_effort(
        self, client, make_venue, monkeypatch, unreachable_storage
    ):
        """`delete_image` is documented best-effort: an unreachable storage
        must not turn a successful media clear into a 500. The database
        change still commits."""
        venue = make_venue(
            cover_image_url=(
                "https://example.supabase.co/storage/v1/object/public/"
                "venue-media/venues/x/cover.jpg"
            )
        )

        async def _raising_delete(url, *, headers):
            raise httpx.ConnectError("connection refused")

        monkeypatch.setattr(media_service, "_storage_delete", _raising_delete)

        response = client.delete(f"/editor/venues/{venue.id}/media?slot=cover")

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None
