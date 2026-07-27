"""M7 (consumer Release 1) — `GET /public/search/venues`, a dedicated
search endpoint deliberately separate from `GET /public/venues`'s own
list semantics. See `app/api/routes/search.py`'s module docstring for why.
"""

import uuid


def _unique_tag() -> str:
    return uuid.uuid4().hex[:8]


class TestSearchByName:
    def test_matches_a_substring_case_insensitively(self, client, make_venue, preserve_seed_state):
        tag = _unique_tag()
        venue = make_venue(status="approved", name=f"Marina Bay {tag}")

        client.post("/editor/publish")

        response = client.get(f"/public/search/venues?q={tag.upper()}")

        assert response.status_code == 200
        names = {v["name"] for v in response.json()}
        assert venue.name in names

    def test_no_match_returns_empty_list(self, client, make_venue, preserve_seed_state):
        make_venue(status="approved")
        client.post("/editor/publish")

        response = client.get(f"/public/search/venues?q=definitely-not-real-{_unique_tag()}")

        assert response.status_code == 200
        assert response.json() == []


class TestSearchByCategory:
    def test_matches_exact_category(self, client, make_venue, preserve_seed_state):
        tag = _unique_tag()
        venue = make_venue(status="approved", name=f"Cat Match {tag}", category="Cafe")
        make_venue(status="approved", name=f"Cat Not Match {tag}", category="Restaurant")

        client.post("/editor/publish")

        response = client.get("/public/search/venues?category=Cafe")

        names = {v["name"] for v in response.json()}
        assert venue.name in names
        assert f"Cat Not Match {tag}" not in names

    def test_unknown_category_returns_empty_list_not_an_error(
        self, client, make_venue, preserve_seed_state
    ):
        make_venue(status="approved")
        client.post("/editor/publish")

        response = client.get("/public/search/venues?category=NotARealCategory")

        assert response.status_code == 200
        assert response.json() == []


class TestSearchCombinesFiltersWithAnd:
    def test_q_and_category_both_must_match(self, client, make_venue, preserve_seed_state):
        tag = _unique_tag()
        # Matches q only (right category, wrong name).
        make_venue(status="approved", name=f"Combo {tag} Other Category", category="Restaurant")
        # Matches category only (right name, wrong category).
        make_venue(status="approved", name="Unrelated Name", category="Cafe")
        # Matches both.
        both_match = make_venue(status="approved", name=f"Combo {tag}", category="Cafe")

        client.post("/editor/publish")

        response = client.get(f"/public/search/venues?q={tag}&category=Cafe")

        names = {v["name"] for v in response.json()}
        assert names == {both_match.name}


class TestSearchWithNoParams:
    def test_returns_the_same_venues_as_the_list_endpoint(
        self, client, make_venue, preserve_seed_state
    ):
        make_venue(status="approved", name=f"No Params Check {_unique_tag()}")
        client.post("/editor/publish")

        search_ids = {v["id"] for v in client.get("/public/search/venues").json()}
        list_ids = {v["id"] for v in client.get("/public/venues").json()}

        assert search_ids == list_ids


class TestSearchSnapshotOnly:
    def test_draft_venue_never_appears_even_with_a_matching_name(
        self, client, make_venue, preserve_seed_state
    ):
        tag = _unique_tag()
        make_venue(status="approved")  # something has to be approved to publish at all
        draft_venue = make_venue(status="draft", name=f"Draft Search Leak {tag}")

        client.post("/editor/publish")

        response = client.get(f"/public/search/venues?q={tag}")

        names = {v["name"] for v in response.json()}
        assert draft_venue.name not in names

    def test_no_current_revision_returns_empty_list(self, client, monkeypatch):
        # `from ... import get_current_revision` binds the name directly
        # into search.py's own namespace, so the patch target is that
        # module's attribute, not app.publishing.engine's.
        monkeypatch.setattr("app.api.routes.search.get_current_revision", lambda db: None)

        response = client.get("/public/search/venues?q=anything")

        assert response.status_code == 200
        assert response.json() == []

    def test_draft_edit_after_publish_is_not_reflected(
        self, client, make_venue, db, preserve_seed_state
    ):
        venue = make_venue(status="approved", name="Original Search Name")
        client.post("/editor/publish")

        venue.name = "Edited After Publish"
        db.add(venue)
        db.commit()

        response = client.get("/public/search/venues?q=Original")

        names = {v["name"] for v in response.json()}
        assert "Original Search Name" in names


class TestSearchResponseShape:
    def test_result_includes_resolved_destination(self, client, make_venue, preserve_seed_state):
        venue = make_venue(status="approved", name=f"Shape Check {_unique_tag()}")
        client.post("/editor/publish")

        response = client.get("/public/search/venues?q=Shape")
        entry = next(v for v in response.json() if v["id"] == venue.id)

        assert entry["destination"]["id"] == venue.destination_id
        assert "status" not in entry


class TestExistingVenuesEndpointUnaffected:
    def test_list_venues_ignores_search_style_params(self, client, make_venue, preserve_seed_state):
        """`GET /public/venues` must not gain `q`/`category` behavior —
        unknown query params on that route are simply ignored, per
        FastAPI's default behavior, proving this endpoint's own contract
        wasn't touched by adding the new search route.
        """
        tag = _unique_tag()
        make_venue(status="approved", name=f"Untouched {tag}")
        make_venue(status="approved", name=f"Other {tag}", category="Cafe")

        client.post("/editor/publish")

        with_bogus_params = client.get(f"/public/venues?q={tag}&category=Cafe")
        without_params = client.get("/public/venues")

        assert with_bogus_params.status_code == 200
        assert {v["id"] for v in with_bogus_params.json()} == {
            v["id"] for v in without_params.json()
        }
