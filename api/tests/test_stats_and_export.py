"""PLATFORM_SPEC_v1.0_FROZEN.md §2.9/§8.9 (GET /editor/stats) and §8.7
(export). Both computed/serialized live — no stored table for either.
"""


class TestPlatformStats:
    def test_computes_every_field_live(self, client, make_destination, make_venue):
        destination = make_destination()
        make_venue(
            destination=destination,
            category="Restaurant",
            cover_image_url="https://example.com/c.jpg",
            instagram_handle="handle",
        )
        make_venue(destination=destination, category="Cafe")

        response = client.get("/editor/stats")

        assert response.status_code == 200
        body = response.json()
        assert body["venues"] >= 2
        assert body["destinations"] >= 1
        assert isinstance(body["with_cover"], int)
        assert isinstance(body["pct_cover"], float)

    def test_viewer_can_view_stats(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/stats")

        assert response.status_code == 200


class TestVenueExport:
    def test_json_export_returns_every_venue(self, client, make_venue):
        venue = make_venue()

        response = client.get("/editor/venues/export?format=json")

        assert response.status_code == 200
        ids = {row["id"] for row in response.json()}
        assert venue.id in ids

    def test_csv_export_returns_csv(self, client, make_venue):
        make_venue()

        response = client.get("/editor/venues/export?format=csv")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert "id" in response.text.splitlines()[0]

    def test_viewer_can_export(self, client, as_role):
        as_role("viewer")

        response = client.get("/editor/venues/export?format=json")

        assert response.status_code == 200


class TestDestinationExport:
    def test_json_export_returns_every_destination(self, client, make_destination):
        destination = make_destination()

        response = client.get("/editor/destinations/export?format=json")

        assert response.status_code == 200
        ids = {row["id"] for row in response.json()}
        assert destination.id in ids

    def test_csv_export_returns_csv(self, client, make_destination):
        make_destination()

        response = client.get("/editor/destinations/export?format=csv")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
