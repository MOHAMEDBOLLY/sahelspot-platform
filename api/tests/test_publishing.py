"""Publish (snapshot creation) and Republish (pointer-only restore).

publish() and republish() are whole-dataset operations, so every test here
requests `preserve_seed_state` — see tests/conftest.py for why.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


class TestPublish:
    def test_creates_current_revision_containing_approved_content(
        self, client, make_venue, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Publish Test Venue")

        response = client.post("/editor/publish")

        assert response.status_code == 200
        body = response.json()
        assert body["is_current"] is True
        assert body["venue_count"] >= 1
        assert body["destination_count"] >= 1

        detail = client.get(f"/editor/publish/revisions/{body['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert venue.name in venue_names

    def test_excludes_non_approved_venues_from_snapshot(self, client, make_venue, preserve_seed_state):
        make_venue(status="draft", name="Should Not Be Published")

        response = client.post("/editor/publish")

        detail = client.get(f"/editor/publish/revisions/{response.json()['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert "Should Not Be Published" not in venue_names

    def test_second_publish_supersedes_the_first(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/editor/publish").json()

        make_venue(status="approved")
        second = client.post("/editor/publish").json()

        assert second["is_current"] is True
        first_after = client.get(f"/editor/publish/revisions/{first['id']}").json()
        assert first_after["is_current"] is False

    def test_does_not_change_venue_status(self, client, make_venue, db, preserve_seed_state):
        venue = make_venue(status="approved")

        client.post("/editor/publish")

        db.refresh(venue)
        assert venue.status == "approved"

    def test_published_venues_endpoint_reads_current_revision(
        self, client, make_venue, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Published Read Check")

        client.post("/editor/publish")

        published = client.get("/public/venues").json()
        names = {v["name"] for v in published}
        assert venue.name in names

    def test_draft_edit_after_publish_does_not_affect_published_snapshot(
        self, client, make_venue, db, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Original Name")
        client.post("/editor/publish")

        venue.name = "Edited After Publish"
        db.add(venue)
        db.commit()

        published = client.get("/public/venues").json()
        names = {v["name"] for v in published}
        assert "Original Name" in names
        assert "Edited After Publish" not in names

    def test_concurrent_publish_conflict_returns_409(self, client, make_venue, preserve_seed_state, monkeypatch):
        """Sprint 31 — simulates the losing side of a concurrent publish
        race. `publish()` calls `db.flush()` (to assign `revision.id`)
        before it ever calls `db.commit()`, and `SessionLocal` is
        `autoflush=False` (see `app/db/session.py`), so `flush()` is the
        statement that actually sends the new revision's `INSERT` to the
        database — that's the point where the partial unique index on
        `is_current` would raise on a real concurrent publish, not the
        later `db.commit()`, which by then has nothing new left to send.
        This patches `Session.flush` (not `commit`) to raise once, so the
        test exercises the same code path a real race would hit.
        """
        make_venue(status="approved")

        original_flush = Session.flush

        def _raise_once(self, *args, **kwargs):
            monkeypatch.setattr(Session, "flush", original_flush)
            raise IntegrityError("INSERT ...", {}, Exception("uq_publish_revisions_is_current"))

        monkeypatch.setattr(Session, "flush", _raise_once)

        response = client.post("/editor/publish")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "concurrent_publish"


class TestRepublish:
    def test_moves_current_pointer_to_target_revision(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/editor/publish").json()
        make_venue(status="approved")
        second = client.post("/editor/publish").json()
        assert second["is_current"] is True

        response = client.post(f"/editor/publish/revisions/{first['id']}/republish")

        assert response.status_code == 200
        assert response.json()["is_current"] is True
        revisions = {r["id"]: r for r in client.get("/editor/publish/revisions").json()}
        assert revisions[first["id"]]["is_current"] is True
        assert revisions[second["id"]]["is_current"] is False

    def test_does_not_change_revision_published_at(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/editor/publish").json()
        make_venue(status="approved")
        client.post("/editor/publish")

        republished = client.post(f"/editor/publish/revisions/{first['id']}/republish").json()

        assert republished["published_at"] == first["published_at"]

    def test_does_not_change_snapshot_content(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved", name="Snapshot Should Not Change")
        first = client.post("/editor/publish").json()
        make_venue(status="approved")
        client.post("/editor/publish")

        client.post(f"/editor/publish/revisions/{first['id']}/republish")

        detail = client.get(f"/editor/publish/revisions/{first['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert "Snapshot Should Not Change" in venue_names

    def test_rejects_already_current_revision(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        revision = client.post("/editor/publish").json()

        response = client.post(f"/editor/publish/revisions/{revision['id']}/republish")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "already_current"

    def test_unknown_revision_returns_404(self, client):
        response = client.post("/editor/publish/revisions/999999999/republish")

        assert response.status_code == 404

    def test_published_venues_follows_the_republished_revision(
        self, client, make_venue, preserve_seed_state
    ):
        make_venue(status="approved", name="First Revision Venue")
        first = client.post("/editor/publish").json()
        make_venue(status="approved", name="Second Revision Venue")
        client.post("/editor/publish")

        client.post(f"/editor/publish/revisions/{first['id']}/republish")

        published_names = {v["name"] for v in client.get("/public/venues").json()}
        assert "First Revision Venue" in published_names

    def test_concurrent_republish_conflict_returns_409(self, client, make_venue, preserve_seed_state, monkeypatch):
        """Sprint 31 — same race as `TestPublish`'s equivalent test, on the
        republish path."""
        make_venue(status="approved")
        first = client.post("/editor/publish").json()
        make_venue(status="approved")
        client.post("/editor/publish")

        original_commit = Session.commit

        def _raise_once(self, *args, **kwargs):
            monkeypatch.setattr(Session, "commit", original_commit)
            raise IntegrityError("UPDATE ...", {}, Exception("uq_publish_revisions_is_current"))

        monkeypatch.setattr(Session, "commit", _raise_once)

        response = client.post(f"/editor/publish/revisions/{first['id']}/republish")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "concurrent_publish"
