"""PLATFORM_SPEC_v1.0_FROZEN.md §4 — optimistic locking via ETag/If-Match
for venues and destinations. Covers the full protocol: ETag present on
GET, 428 with no If-Match, 409 on a stale version (with current state and
version in the body), success increments version by exactly one.
"""


class TestVenueConcurrency:
    def test_get_returns_an_etag(self, client, make_venue):
        venue = make_venue()

        response = client.get(f"/editor/venues/{venue.id}")

        assert response.headers["etag"] == f'"{venue.version}"'

    def test_patch_without_if_match_is_428(self, client, make_venue):
        venue = make_venue()

        response = client.patch(f"/editor/venues/{venue.id}", json={"name": "New Name"})

        assert response.status_code == 428
        assert response.json()["detail"]["error"] == "precondition_required"

    def test_patch_with_stale_if_match_is_409_with_current_state(self, client, make_venue, db):
        venue = make_venue(name="Original")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "New Name"},
            headers={"If-Match": str(venue.version + 1)},
        )

        assert response.status_code == 409
        body = response.json()["detail"]
        assert body["error"] == "version_conflict"
        assert body["current"]["name"] == "Original"
        assert body["current"]["version"] == venue.version
        db.refresh(venue)
        assert venue.name == "Original"

    def test_patch_with_matching_if_match_succeeds_and_increments_version(self, client, make_venue, db):
        venue = make_venue()
        original_version = venue.version

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Updated"},
            headers={"If-Match": str(original_version)},
        )

        assert response.status_code == 200
        assert response.json()["version"] == original_version + 1
        db.refresh(venue)
        assert venue.version == original_version + 1

    def test_second_write_with_the_now_stale_version_is_rejected(self, client, make_venue):
        """Simulates two editors: the first PATCH succeeds and bumps the
        version; a second PATCH using the *original* (now stale) version
        must be rejected — this is the actual conflict the protocol exists
        to detect.
        """
        venue = make_venue()
        original_version = venue.version

        first = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Editor A's change"},
            headers={"If-Match": str(original_version)},
        )
        assert first.status_code == 200

        second = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Editor B's change"},
            headers={"If-Match": str(original_version)},
        )

        assert second.status_code == 409


class TestDestinationConcurrency:
    def test_get_returns_an_etag(self, client, make_destination):
        destination = make_destination()

        response = client.get(f"/editor/destinations/{destination.id}")

        assert response.headers["etag"] == f'"{destination.version}"'

    def test_patch_without_if_match_is_428(self, client, make_destination):
        destination = make_destination()

        response = client.patch(f"/editor/destinations/{destination.id}", json={"name": "New Name"})

        assert response.status_code == 428

    def test_patch_with_stale_if_match_is_409(self, client, make_destination):
        destination = make_destination()

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"name": "New Name"},
            headers={"If-Match": str(destination.version + 1)},
        )

        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "version_conflict"

    def test_patch_with_matching_if_match_succeeds(self, client, make_destination, db):
        destination = make_destination()
        original_version = destination.version

        response = client.patch(
            f"/editor/destinations/{destination.id}",
            json={"name": "Updated"},
            headers={"If-Match": str(original_version)},
        )

        assert response.status_code == 200
        assert response.json()["version"] == original_version + 1
