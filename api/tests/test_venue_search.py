"""Sprint 27 — Search & Filter Foundation.

`GET /editor/venues` reads from the same shared dev database every other
test in this suite does (see conftest.py), so every test here searches by
a unique, per-test name fragment (a random suffix) rather than asserting
on an unfiltered `total` — an unfiltered query would also match the real
Sprint 4 seed venue and any other test's leftover data, which would make
these assertions depend on what else happens to exist in the database.
"""

import uuid


def _unique_tag() -> str:
    return uuid.uuid4().hex[:8]


class TestSearch:
    def test_matches_a_substring_case_insensitively(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"The Smokery {tag}")

        response = client.get(f"/editor/venues?q={tag.upper()}")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == f"The Smokery {tag}"

    def test_no_match_returns_an_empty_result_not_an_error(self, client):
        response = client.get(f"/editor/venues?q=definitely-not-a-real-venue-{_unique_tag()}")

        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 0

    def test_matches_a_partial_substring_anywhere_in_the_name(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"Beach {tag} Club")

        response = client.get(f"/editor/venues?q={tag}")

        assert response.status_code == 200
        assert response.json()["total"] == 1


class TestFilters:
    def test_filters_by_destination_id(self, client, make_destination, make_venue):
        tag = _unique_tag()
        destination_a = make_destination(name=f"Dest A {tag}")
        destination_b = make_destination(name=f"Dest B {tag}")
        make_venue(name=f"Venue A {tag}", destination=destination_a)
        make_venue(name=f"Venue B {tag}", destination=destination_b)

        response = client.get(f"/editor/venues?q={tag}&destination_id={destination_a.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == f"Venue A {tag}"

    def test_filters_by_category(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"Restaurant {tag}", category="Restaurant")
        make_venue(name=f"Hotel {tag}", category="Hotel")

        response = client.get(f"/editor/venues?q={tag}&category=Hotel")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["category"] == "Hotel"

    def test_filters_by_status(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"Draft {tag}", status="draft")
        make_venue(name=f"Approved {tag}", status="approved")

        response = client.get(f"/editor/venues?q={tag}&status=approved")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["status"] == "approved"

    def test_unrecognized_filter_value_returns_empty_not_an_error(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"Venue {tag}")

        response = client.get(f"/editor/venues?q={tag}&category=NotARealCategory")

        assert response.status_code == 200
        assert response.json()["total"] == 0


class TestCombinedSearchAndFilters:
    def test_search_and_filter_combine_with_and_semantics(self, client, make_venue):
        tag = _unique_tag()
        make_venue(name=f"Marina Cafe {tag}", category="Cafe", status="approved")
        make_venue(name=f"Marina Hotel {tag}", category="Hotel", status="approved")
        make_venue(name=f"Marina Cafe {tag}", category="Cafe", status="draft")

        response = client.get(
            "/editor/venues",
            params={"q": f"Marina Cafe {tag}", "category": "Cafe", "status": "approved"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["category"] == "Cafe"
        assert body["items"][0]["status"] == "approved"


class TestPagination:
    def test_page_size_limits_the_returned_items_but_not_the_total(self, client, make_venue):
        tag = _unique_tag()
        for i in range(5):
            make_venue(name=f"Venue {tag} {i}")

        response = client.get(f"/editor/venues?q={tag}&page_size=2")

        assert response.status_code == 200
        body = response.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5
        assert body["page"] == 1
        assert body["page_size"] == 2

    def test_second_page_returns_the_remaining_items(self, client, make_venue):
        tag = _unique_tag()
        for i in range(3):
            make_venue(name=f"Venue {tag} {i}")

        first_page = client.get(f"/editor/venues?q={tag}&page=1&page_size=2").json()
        second_page = client.get(f"/editor/venues?q={tag}&page=2&page_size=2").json()

        assert len(first_page["items"]) == 2
        assert len(second_page["items"]) == 1
        first_ids = {item["id"] for item in first_page["items"]}
        second_ids = {item["id"] for item in second_page["items"]}
        assert first_ids.isdisjoint(second_ids)

    def test_page_beyond_available_results_returns_empty_items_with_correct_total(
        self, client, make_venue
    ):
        tag = _unique_tag()
        make_venue(name=f"Venue {tag}")

        response = client.get(f"/editor/venues?q={tag}&page=5&page_size=10")

        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 1

    def test_page_size_over_the_cap_is_rejected(self, client):
        response = client.get("/editor/venues?page_size=1000")

        assert response.status_code == 422

    def test_page_below_one_is_rejected(self, client):
        response = client.get("/editor/venues?page=0")

        assert response.status_code == 422


class TestPermission:
    def test_unauthenticated_request_is_still_rejected(self, client):
        from app.auth.dependencies import get_current_user
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides.pop(get_current_user, None)
        try:
            response = client.get("/editor/venues?q=anything")
        finally:
            from app.auth.dependencies import CurrentUser

            from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE

            fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
                id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
            )

        assert response.status_code == 401

    def test_viewer_can_search_and_filter(self, client, make_venue):
        from app.auth.dependencies import CurrentUser, get_current_user
        from app.main import app as fastapi_app

        tag = _unique_tag()
        make_venue(name=f"Venue {tag}")
        fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="test-viewer", email="viewer@example.com", role="viewer"
        )
        try:
            response = client.get(f"/editor/venues?q={tag}")
        finally:
            from .conftest import TEST_USER_EMAIL, TEST_USER_ID, TEST_USER_ROLE

            fastapi_app.dependency_overrides[get_current_user] = lambda: CurrentUser(
                id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
            )

        assert response.status_code == 200
        assert response.json()["total"] == 1
