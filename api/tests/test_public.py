"""The /public/* namespace (Sprint 23) — snapshot-backed reads only.

`test_publishing.py` already exercises `/public/venues` thoroughly as part
of testing the Publish Engine itself. This file is narrower and more
direct: it exists specifically to prove the two things Sprint 23 asked to
be verified — the public API never reads draft tables, and the new
`/public/destinations` endpoint (the counterpart `/published/venues` never
had) behaves the same way its venues sibling does.
"""


class TestPublicDestinations:
    def test_reads_from_current_revision(self, client, make_destination, preserve_seed_state):
        destination = make_destination(status="approved", name="Public Destination Check")

        client.post("/editor/publish")

        published = client.get("/public/destinations").json()
        names = {d["name"] for d in published}
        assert destination.name in names

    def test_excludes_non_approved_destinations(self, client, make_destination, preserve_seed_state):
        make_destination(status="draft", name="Should Not Be Public")

        client.post("/editor/publish")

        published = client.get("/public/destinations").json()
        names = {d["name"] for d in published}
        assert "Should Not Be Public" not in names

    def test_response_omits_editorial_only_fields(self, client, make_destination, preserve_seed_state):
        make_destination(status="approved", name="Shape Check", notes="Internal admin note")

        client.post("/editor/publish")

        published = client.get("/public/destinations").json()
        entry = next(d for d in published if d["name"] == "Shape Check")
        # PublishedDestinationOut deliberately has no `status`/`notes` —
        # editorial-only fields, same reasoning as PublishedVenueOut.
        assert "status" not in entry
        assert "notes" not in entry


class TestDraftNeverLeaksPublicly:
    """A direct check, not just an absence-of-evidence one: a draft row
    that was never approved or published must not appear on either public
    endpoint, even after an unrelated publish has happened.
    """

    def test_draft_venue_and_destination_absent_from_public_reads(
        self, client, make_venue, make_destination, preserve_seed_state
    ):
        draft_destination = make_destination(status="draft", name="Draft Destination Leak Check")
        draft_venue = make_venue(status="draft", name="Draft Venue Leak Check")
        # Something has to actually be approved for /editor/publish to
        # produce a current revision at all.
        make_venue(status="approved")

        client.post("/editor/publish")

        public_venue_names = {v["name"] for v in client.get("/public/venues").json()}
        public_destination_names = {d["name"] for d in client.get("/public/destinations").json()}

        assert draft_venue.name not in public_venue_names
        assert draft_destination.name not in public_destination_names
