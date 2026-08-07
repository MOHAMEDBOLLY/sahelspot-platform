"""Events Module v1 — same coverage shape as test_workflow.py/
test_venue_lifecycle.py/test_media.py, applied to the new Event entity:
CRUD, editorial workflow (draft/review/approved/archived), cover upload,
bulk actions, and Consumer-visibility (only Approved, only after publish).
"""

import httpx

from app.media import service as media_service
import pytest

from app.core.config import settings


@pytest.fixture()
def make_event(db, make_destination):
    from app.db.models import Event

    created_ids: list[str] = []

    def _make(**overrides):
        event_id = overrides.pop("id", f"test-e-{__import__('uuid').uuid4().hex[:8]}")
        # ck_events_has_location (0013_events_require_location.py) — an
        # event needs at least one of venue_id/destination_id. Defaults to
        # a fresh destination unless the caller explicitly supplies either
        # (including explicit `venue_id=None, destination_id=None` for the
        # handful of tests that intentionally exercise the constraint
        # itself — pass a sentinel-free override to skip this default).
        if "venue_id" not in overrides and "destination_id" not in overrides:
            overrides["destination_id"] = make_destination().id
        event = Event(
            id=event_id,
            title=overrides.pop("title", "Test Event"),
            slug=overrides.pop("slug", f"test-event-{event_id}"),
            status=overrides.pop("status", "draft"),
            start_date=overrides.pop("start_date", __import__("datetime").date(2026, 12, 1)),
            **overrides,
        )
        db.add(event)
        db.commit()
        created_ids.append(event_id)
        return event

    yield _make

    for event_id in created_ids:
        db.query(Event).filter(Event.id == event_id).delete()
    db.commit()


@pytest.fixture(autouse=True)
def configured_storage(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")


@pytest.fixture()
def mock_successful_upload(monkeypatch):
    async def _fake_put(url, *, content, headers):
        return httpx.Response(status_code=200, request=httpx.Request("PUT", url))

    async def _fake_delete(url, *, headers):
        return httpx.Response(status_code=200, request=httpx.Request("DELETE", url))

    monkeypatch.setattr(media_service, "_storage_put", _fake_put)
    monkeypatch.setattr(media_service, "_storage_delete", _fake_delete)


class TestCreateEvent:
    def test_creates_draft_event(self, client, make_destination):
        destination = make_destination()
        response = client.post(
            "/editor/events",
            json={
                "id": "test-create-1",
                "title": "Kite Festival",
                "slug": "kite-festival",
                "start_date": "2026-09-01",
                "destination_id": destination.id,
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "draft"
        assert body["title"] == "Kite Festival"
        assert body["featured"] is False

        client.delete("/editor/events/test-create-1")

    def test_rejects_duplicate_id(self, client, make_event):
        event = make_event()

        response = client.post(
            "/editor/events",
            json={
                "id": event.id,
                "title": "Dup",
                "slug": "dup-slug",
                "start_date": "2026-09-01",
                "destination_id": event.destination_id,
            },
        )

        assert response.status_code == 409

    def test_rejects_duplicate_slug(self, client, make_event, make_destination):
        make_event(slug="shared-slug")
        destination = make_destination()

        response = client.post(
            "/editor/events",
            json={
                "id": "test-dup-slug",
                "title": "Dup",
                "slug": "shared-slug",
                "start_date": "2026-09-01",
                "destination_id": destination.id,
            },
        )

        assert response.status_code == 409
        client.delete("/editor/events/test-dup-slug")

    def test_rejects_unknown_venue_id(self, client):
        response = client.post(
            "/editor/events",
            json={
                "id": "test-bad-venue",
                "title": "Bad Venue Event",
                "slug": "bad-venue-event",
                "start_date": "2026-09-01",
                "venue_id": "does-not-exist",
            },
        )

        assert response.status_code == 404

    def test_rejects_missing_location(self, client):
        """ck_events_has_location (0013) — at least one of venue_id/
        destination_id is required; the route rejects this with a clean
        422 before it ever reaches the database CHECK constraint."""
        response = client.post(
            "/editor/events",
            json={
                "id": "test-no-location",
                "title": "No Location Event",
                "slug": "no-location-event",
                "start_date": "2026-09-01",
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "location_required"

    def test_accepts_venue_only(self, client, make_venue):
        venue = make_venue(status="approved")
        response = client.post(
            "/editor/events",
            json={
                "id": "test-venue-only",
                "title": "Venue Only Event",
                "slug": "venue-only-event",
                "start_date": "2026-09-01",
                "venue_id": venue.id,
            },
        )

        assert response.status_code == 201
        client.delete("/editor/events/test-venue-only")

    def test_accepts_both_venue_and_destination(self, client, make_venue, make_destination):
        venue = make_venue(status="approved")
        destination = make_destination()
        response = client.post(
            "/editor/events",
            json={
                "id": "test-both-locations",
                "title": "Both Locations Event",
                "slug": "both-locations-event",
                "start_date": "2026-09-01",
                "venue_id": venue.id,
                "destination_id": destination.id,
            },
        )

        assert response.status_code == 201
        client.delete("/editor/events/test-both-locations")


class TestUpdateLocationConstraint:
    def test_rejects_clearing_the_only_location(self, client, make_event):
        """An event created with only a destination_id can't have that
        destination_id cleared without ever setting a venue_id — the
        resulting row would have neither."""
        event = make_event()

        response = client.patch(
            f"/editor/events/{event.id}",
            json={"destination_id": None},
            headers={"If-Match": str(event.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "location_required"

    def test_allows_swapping_venue_for_destination(self, client, make_event, make_venue, db):
        """Clearing destination_id is fine as long as venue_id is set in
        the same request — the resulting row still has a location."""
        event = make_event()
        venue = make_venue(status="approved")

        response = client.patch(
            f"/editor/events/{event.id}",
            json={"destination_id": None, "venue_id": venue.id},
            headers={"If-Match": str(event.version)},
        )

        assert response.status_code == 200
        db.refresh(event)
        assert event.destination_id is None
        assert event.venue_id == venue.id

        # Delete the event before fixture teardown deletes `venue` — this
        # event now depends solely on that venue for location, and
        # ck_events_has_location would otherwise reject the venue's
        # ON DELETE SET NULL cascade during cleanup.
        client.delete(f"/editor/events/{event.id}")


class TestGetUpdateDeleteEvent:
    def test_get_event(self, client, make_event):
        event = make_event(title="Beach Party")

        response = client.get(f"/editor/events/{event.id}")

        assert response.status_code == 200
        assert response.json()["title"] == "Beach Party"

    def test_unknown_event_returns_404(self, client):
        assert client.get("/editor/events/does-not-exist").status_code == 404

    def test_update_requires_if_match(self, client, make_event):
        event = make_event()

        response = client.patch(f"/editor/events/{event.id}", json={"title": "New Title"})

        assert response.status_code == 428

    def test_update_saves_draft_fields(self, client, make_event, db):
        event = make_event()

        response = client.patch(
            f"/editor/events/{event.id}",
            json={"title": "Updated Title", "featured": True},
            headers={"If-Match": str(event.version)},
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"
        assert response.json()["featured"] is True
        db.refresh(event)
        assert event.version == 2

    def test_delete_removes_event(self, client, make_event):
        event = make_event()

        response = client.delete(f"/editor/events/{event.id}")

        assert response.status_code == 204
        assert client.get(f"/editor/events/{event.id}").status_code == 404

    def test_delete_works_regardless_of_status(self, client, make_event):
        event = make_event(status="approved")

        assert client.delete(f"/editor/events/{event.id}").status_code == 204


class TestDeletingLocationIsGuarded:
    """Deleting a venue/destination that's an event's *sole* location
    reference must be blocked with a clean 409 — otherwise the FK's
    ON DELETE SET NULL would silently violate ck_events_has_location
    (0013_events_require_location.py) with a raw 500.
    """

    def test_cannot_delete_venue_that_is_an_events_only_location(self, client, make_venue):
        venue = make_venue(status="approved")
        create_response = client.post(
            "/editor/events",
            json={
                "id": "test-guard-venue",
                "title": "Guard Venue Event",
                "slug": "guard-venue-event",
                "start_date": "2026-09-01",
                "venue_id": venue.id,
            },
        )
        assert create_response.status_code == 201

        response = client.delete(f"/editor/venues/{venue.id}")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "venue_has_sole_events"

        client.delete("/editor/events/test-guard-venue")

    def test_can_delete_venue_once_the_event_also_has_a_destination(self, client, make_venue, make_destination):
        venue = make_venue(status="approved")
        destination = make_destination()
        client.post(
            "/editor/events",
            json={
                "id": "test-guard-venue-2",
                "title": "Guard Venue Event 2",
                "slug": "guard-venue-event-2",
                "start_date": "2026-09-01",
                "venue_id": venue.id,
                "destination_id": destination.id,
            },
        )

        response = client.delete(f"/editor/venues/{venue.id}")

        assert response.status_code == 204
        client.delete("/editor/events/test-guard-venue-2")

    def test_cannot_delete_destination_that_is_an_events_only_location(self, client, make_destination):
        destination = make_destination()
        create_response = client.post(
            "/editor/events",
            json={
                "id": "test-guard-dest",
                "title": "Guard Destination Event",
                "slug": "guard-destination-event",
                "start_date": "2026-09-01",
                "destination_id": destination.id,
            },
        )
        assert create_response.status_code == 201

        response = client.delete(f"/editor/destinations/{destination.id}")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "destination_has_sole_events"

        client.delete("/editor/events/test-guard-dest")


class TestEventWorkflow:
    def test_submit_for_review_requires_title(self, client, make_event):
        event = make_event(title="")

        response = client.post(f"/editor/events/{event.id}/submit-for-review")

        assert response.status_code == 422

    def test_submit_for_review_success(self, client, make_event, db):
        event = make_event()

        response = client.post(f"/editor/events/{event.id}/submit-for-review")

        assert response.status_code == 200
        assert response.json()["status"] == "review"

    def test_approve_success(self, client, make_event):
        event = make_event(status="review")

        response = client.post(f"/editor/events/{event.id}/approve")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"

    def test_reject_requires_reason(self, client, make_event):
        event = make_event(status="review")

        response = client.post(f"/editor/events/{event.id}/reject", json={"reason": ""})

        assert response.status_code == 422

    def test_reject_success(self, client, make_event):
        event = make_event(status="review")

        response = client.post(f"/editor/events/{event.id}/reject", json={"reason": "Needs more info"})

        assert response.status_code == 200
        assert response.json()["status"] == "draft"

    def test_move_to_draft_from_approved(self, client, make_event):
        event = make_event(status="approved")

        response = client.post(f"/editor/events/{event.id}/move-to-draft")

        assert response.status_code == 200
        assert response.json()["status"] == "draft"

    def test_archive_from_approved(self, client, make_event):
        event = make_event(status="approved")

        response = client.post(f"/editor/events/{event.id}/archive")

        assert response.status_code == 200
        assert response.json()["status"] == "archived"

    def test_restore_from_archived(self, client, make_event):
        event = make_event(status="archived")

        response = client.post(f"/editor/events/{event.id}/restore")

        assert response.status_code == 200
        assert response.json()["status"] == "approved"

    def test_invalid_transition_returns_409(self, client, make_event):
        event = make_event(status="draft")

        response = client.post(f"/editor/events/{event.id}/archive")

        assert response.status_code == 409


class TestBulkEventActions:
    def test_bulk_approve(self, client, make_event, db):
        e1 = make_event(status="review")
        e2 = make_event(status="review")

        response = client.post("/editor/events/bulk/approve", json={"event_ids": [e1.id, e2.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 2

    def test_bulk_delete(self, client, make_event):
        e1 = make_event()
        e2 = make_event()

        response = client.post("/editor/events/bulk/delete", json={"event_ids": [e1.id, e2.id]})

        assert response.status_code == 200
        assert response.json()["succeeded"] == 2
        assert client.get(f"/editor/events/{e1.id}").status_code == 404


class TestEventCoverUpload:
    def test_uploads_cover(self, client, make_event, mock_successful_upload):
        event = make_event()

        response = client.post(
            f"/editor/events/{event.id}/media",
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is not None

    def test_removes_cover(self, client, make_event, mock_successful_upload, db):
        event = make_event()
        client.post(
            f"/editor/events/{event.id}/media",
            files={"file": ("cover.jpg", b"\xff\xd8\xfffake-image-bytes", "image/jpeg")},
        )

        response = client.delete(f"/editor/events/{event.id}/media")

        assert response.status_code == 200
        assert response.json()["cover_image_url"] is None


class TestEventPhase:
    def test_future_event_is_upcoming(self, client, make_event):
        from datetime import date, timedelta

        event = make_event(start_date=date.today() + timedelta(days=30))

        response = client.get(f"/editor/events/{event.id}")

        assert response.json()["phase"] == "upcoming"

    def test_past_event_is_ended(self, client, make_event):
        from datetime import date, timedelta

        event = make_event(start_date=date.today() - timedelta(days=30))

        response = client.get(f"/editor/events/{event.id}")

        assert response.json()["phase"] == "ended"

    def test_event_happening_today_is_live(self, client, make_event):
        from datetime import date

        event = make_event(start_date=date.today(), end_date=date.today())

        response = client.get(f"/editor/events/{event.id}")

        assert response.json()["phase"] == "live"


class TestConsumerVisibility:
    def test_only_approved_events_are_public(self, client, make_event, preserve_seed_state):
        approved = make_event(title="Approved Event", status="approved")
        make_event(title="Draft Event", status="draft")
        make_event(title="Review Event", status="review")
        make_event(title="Archived Event", status="archived")

        client.post("/editor/publish")

        response = client.get("/public/events")

        assert response.status_code == 200
        titles = {item["title"] for item in response.json()}
        assert titles == {"Approved Event"}
        assert response.json()[0]["id"] == approved.id

    def test_public_event_detail(self, client, make_event, preserve_seed_state):
        event = make_event(title="Detail Event", status="approved", ticket_url="https://tickets.example.com/x")

        client.post("/editor/publish")

        response = client.get(f"/public/events/{event.slug}")

        assert response.status_code == 200
        assert response.json()["ticket_url"] == "https://tickets.example.com/x"

    def test_draft_event_404s_on_public_detail_even_after_a_publish(
        self, client, make_event, preserve_seed_state
    ):
        make_event(title="Unrelated Approved", status="approved")
        draft = make_event(title="Still Draft", status="draft")

        client.post("/editor/publish")

        assert client.get(f"/public/events/{draft.slug}").status_code == 404

    def test_featured_event_publishes_correctly(self, client, make_event, preserve_seed_state):
        event = make_event(title="Featured Event", status="approved", featured=True)

        client.post("/editor/publish")

        response = client.get("/public/events")

        assert response.status_code == 200
        by_id = {item["id"]: item for item in response.json()}
        assert by_id[event.id]["featured"] is True

    def test_related_venue_resolves_on_public_read(self, client, make_event, make_venue, preserve_seed_state):
        venue = make_venue(status="approved", name="The Venue")
        event = make_event(title="Venue Event", status="approved", venue_id=venue.id)

        client.post("/editor/publish")

        response = client.get(f"/public/events/{event.slug}")

        assert response.status_code == 200
        assert response.json()["venue"]["id"] == venue.id
        assert response.json()["venue"]["name"] == "The Venue"

        # Same fixture-teardown-ordering reason as
        # test_allows_swapping_venue_for_destination above.
        client.delete(f"/editor/events/{event.id}")

    def test_dangling_venue_ref_resolves_to_none_not_excluded(self, client, make_event, make_venue, preserve_seed_state):
        """venue_id is optional — an event whose venue isn't itself
        approved/published still publishes, just with venue=None."""
        venue = make_venue(status="draft", name="Not Approved Venue")
        event = make_event(title="Orphaned Venue Ref", status="approved", venue_id=venue.id)

        client.post("/editor/publish")

        response = client.get(f"/public/events/{event.slug}")

        assert response.status_code == 200
        assert response.json()["venue"] is None

        # Same fixture-teardown-ordering reason as
        # test_allows_swapping_venue_for_destination above.
        client.delete(f"/editor/events/{event.id}")
