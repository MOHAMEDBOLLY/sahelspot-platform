"""Publish (snapshot creation) and Republish (pointer-only restore).

publish() and republish() are whole-dataset operations, so every test here
requests `preserve_seed_state` — see tests/conftest.py for why.
"""


class TestPublish:
    def test_creates_current_revision_containing_approved_content(
        self, client, make_venue, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Publish Test Venue")

        response = client.post("/publish")

        assert response.status_code == 200
        body = response.json()
        assert body["is_current"] is True
        assert body["venue_count"] >= 1
        assert body["destination_count"] >= 1

        detail = client.get(f"/publish/revisions/{body['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert venue.name in venue_names

    def test_excludes_non_approved_venues_from_snapshot(self, client, make_venue, preserve_seed_state):
        make_venue(status="draft", name="Should Not Be Published")

        response = client.post("/publish")

        detail = client.get(f"/publish/revisions/{response.json()['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert "Should Not Be Published" not in venue_names

    def test_second_publish_supersedes_the_first(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/publish").json()

        make_venue(status="approved")
        second = client.post("/publish").json()

        assert second["is_current"] is True
        first_after = client.get(f"/publish/revisions/{first['id']}").json()
        assert first_after["is_current"] is False

    def test_does_not_change_venue_status(self, client, make_venue, db, preserve_seed_state):
        venue = make_venue(status="approved")

        client.post("/publish")

        db.refresh(venue)
        assert venue.status == "approved"

    def test_published_venues_endpoint_reads_current_revision(
        self, client, make_venue, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Published Read Check")

        client.post("/publish")

        published = client.get("/published/venues").json()
        names = {v["name"] for v in published}
        assert venue.name in names

    def test_draft_edit_after_publish_does_not_affect_published_snapshot(
        self, client, make_venue, db, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Original Name")
        client.post("/publish")

        venue.name = "Edited After Publish"
        db.add(venue)
        db.commit()

        published = client.get("/published/venues").json()
        names = {v["name"] for v in published}
        assert "Original Name" in names
        assert "Edited After Publish" not in names


class TestRepublish:
    def test_moves_current_pointer_to_target_revision(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/publish").json()
        make_venue(status="approved")
        second = client.post("/publish").json()
        assert second["is_current"] is True

        response = client.post(f"/publish/revisions/{first['id']}/republish")

        assert response.status_code == 200
        assert response.json()["is_current"] is True
        revisions = {r["id"]: r for r in client.get("/publish/revisions").json()}
        assert revisions[first["id"]]["is_current"] is True
        assert revisions[second["id"]]["is_current"] is False

    def test_does_not_change_revision_published_at(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        first = client.post("/publish").json()
        make_venue(status="approved")
        client.post("/publish")

        republished = client.post(f"/publish/revisions/{first['id']}/republish").json()

        assert republished["published_at"] == first["published_at"]

    def test_does_not_change_snapshot_content(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved", name="Snapshot Should Not Change")
        first = client.post("/publish").json()
        make_venue(status="approved")
        client.post("/publish")

        client.post(f"/publish/revisions/{first['id']}/republish")

        detail = client.get(f"/publish/revisions/{first['id']}").json()
        venue_names = {v["name"] for v in detail["snapshot"]["venues"]}
        assert "Snapshot Should Not Change" in venue_names

    def test_rejects_already_current_revision(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        revision = client.post("/publish").json()

        response = client.post(f"/publish/revisions/{revision['id']}/republish")

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "already_current"

    def test_unknown_revision_returns_404(self, client):
        response = client.post("/publish/revisions/999999999/republish")

        assert response.status_code == 404

    def test_published_venues_follows_the_republished_revision(
        self, client, make_venue, preserve_seed_state
    ):
        make_venue(status="approved", name="First Revision Venue")
        first = client.post("/publish").json()
        make_venue(status="approved", name="Second Revision Venue")
        client.post("/publish")

        client.post(f"/publish/revisions/{first['id']}/republish")

        published_names = {v["name"] for v in client.get("/published/venues").json()}
        assert "First Revision Venue" in published_names
