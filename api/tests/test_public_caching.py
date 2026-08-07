"""H2 — HTTP caching on the `/public/*` surface.

Covers all eight snapshot-backed public routes: they must carry
`Cache-Control` + a revision-keyed `ETag`, answer a matching
`If-None-Match` with `304`, treat a stale validator as a normal full
response, and never cache a negative result. The `/editor/*` surface must
be untouched — its `ETag` is the optimistic-concurrency row version, a
different protocol that happens to share a header name.
"""

import pytest

from app.api.public_cache import PUBLIC_CACHE_CONTROL

# Every public route keyed on the current publish revision. Detail routes
# are parametrized lazily (they need ids created per-test), so this list
# is the ones addressable with no setup.
PUBLIC_LIST_ROUTES = [
    "/public/venues",
    "/public/destinations",
    "/public/events",
    "/public/discover/no-qr",
    "/public/search/venues",
]


def _publish(client) -> int:
    response = client.post("/editor/publish")
    assert response.status_code == 200
    return response.json()["id"]


@pytest.fixture()
def published_venue(client, make_venue, preserve_seed_state):
    """An approved, published venue plus the revision id that published
    it — the precondition for every test in this module."""
    venue = make_venue(status="approved")
    revision_id = _publish(client)
    return venue, revision_id


class TestCacheHeaders:
    def test_every_public_list_route_carries_cache_control_and_etag(
        self, client, published_venue
    ):
        _, revision_id = published_venue
        expected = f'"pub-rev-{revision_id}"'

        for path in PUBLIC_LIST_ROUTES:
            response = client.get(path)
            assert response.status_code == 200, path
            assert response.headers.get("ETag") == expected, path
            assert response.headers.get("Cache-Control") == PUBLIC_CACHE_CONTROL, path

    def test_venue_detail_carries_cache_headers(self, client, published_venue):
        venue, revision_id = published_venue

        response = client.get(f"/public/venues/{venue.id}")

        assert response.status_code == 200
        assert response.headers["ETag"] == f'"pub-rev-{revision_id}"'
        assert response.headers["Cache-Control"] == PUBLIC_CACHE_CONTROL

    def test_404_is_never_cached(self, client, published_venue):
        """A venue that isn't published yet must appear as soon as it is,
        not after a cache expiry."""
        response = client.get("/public/venues/test-does-not-exist")

        assert response.status_code == 404
        assert "Cache-Control" not in response.headers
        assert "ETag" not in response.headers

    def test_no_cache_headers_before_anything_is_published(self, client):
        """The empty state is not cached either — the first publish should
        be visible immediately."""
        response = client.get("/public/venues")

        assert response.status_code == 200
        if response.json() == []:
            assert "Cache-Control" not in response.headers


class TestConditionalRequests:
    def test_matching_if_none_match_returns_304_with_no_body(self, client, published_venue):
        etag = client.get("/public/venues").headers["ETag"]

        response = client.get("/public/venues", headers={"If-None-Match": etag})

        assert response.status_code == 304
        assert response.content == b""
        # RFC 9110 §15.4.5 — a 304 refreshes the stored response's lifetime,
        # so it must re-carry both headers.
        assert response.headers["ETag"] == etag
        assert response.headers["Cache-Control"] == PUBLIC_CACHE_CONTROL

    def test_every_public_route_honours_a_matching_validator(self, client, published_venue):
        venue, revision_id = published_venue
        etag = f'"pub-rev-{revision_id}"'

        paths = PUBLIC_LIST_ROUTES + [
            f"/public/venues/{venue.id}",
            "/public/search/venues?q=test&category=Restaurant",
        ]
        for path in paths:
            response = client.get(path, headers={"If-None-Match": etag})
            assert response.status_code == 304, path

    def test_weak_validator_and_list_form_are_accepted(self, client, published_venue):
        _, revision_id = published_venue
        etag = f'"pub-rev-{revision_id}"'

        response = client.get(
            "/public/venues", headers={"If-None-Match": f'"pub-rev-0", W/{etag}'}
        )
        assert response.status_code == 304

    def test_star_matches_any_current_representation(self, client, published_venue):
        response = client.get("/public/venues", headers={"If-None-Match": "*"})
        assert response.status_code == 304

    def test_stale_validator_gets_a_full_response(self, client, published_venue):
        response = client.get("/public/venues", headers={"If-None-Match": '"pub-rev-0"'})

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_a_new_publish_invalidates_the_previous_etag(self, client, published_venue):
        old_etag = client.get("/public/venues").headers["ETag"]

        _publish(client)  # a second revision moves the is_current pointer

        response = client.get("/public/venues", headers={"If-None-Match": old_etag})
        assert response.status_code == 200
        assert response.headers["ETag"] != old_etag

    def test_search_etag_is_shared_across_queries_but_caches_key_on_url(
        self, client, published_venue
    ):
        """One revision validates every query. Distinct queries are
        distinct cache entries only because caches key on the full URL —
        this asserts the ETag half of that contract."""
        _, revision_id = published_venue
        expected = f'"pub-rev-{revision_id}"'

        for query in ["?q=a", "?category=Restaurant", "?tags=x", ""]:
            response = client.get(f"/public/search/venues{query}")
            assert response.status_code == 200
            assert response.headers["ETag"] == expected


class TestResponseBodiesAreUnchanged:
    """H2 must be transparent — the same bytes, plus headers."""

    def test_venue_list_payload_is_identical_with_and_without_caching_headers(
        self, client, published_venue
    ):
        first = client.get("/public/venues")
        second = client.get("/public/venues", headers={"If-None-Match": '"pub-rev-0"'})

        assert first.json() == second.json()

    def test_collections_route_still_returns_its_full_shape(self, client, published_venue):
        """Regression guard for the Phase 1 route — the conditional check
        must not change the 404 contract for an unknown slug."""
        response = client.get("/public/collections/definitely-not-a-collection")
        assert response.status_code == 404
        assert "Cache-Control" not in response.headers


class TestEditorSurfaceUntouched:
    def test_editor_venue_etag_is_still_the_concurrency_version(
        self, client, make_venue
    ):
        venue = make_venue()

        response = client.get(f"/editor/venues/{venue.id}")

        assert response.status_code == 200
        # A bare quoted integer, not "pub-rev-N".
        assert response.headers["ETag"] == f'"{venue.version}"'
        assert "Cache-Control" not in response.headers

    def test_editor_list_has_no_public_cache_headers(self, client):
        response = client.get("/editor/venues")

        assert response.status_code == 200
        assert "Cache-Control" not in response.headers
