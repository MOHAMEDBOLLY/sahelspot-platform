"""Studio Content Organization (Beaches + No QR) — `Venue.is_no_qr` /
`Venue.parent_venue_id` validation on `PATCH /editor/venues/{id}`.

Covers the full integrity surface: a parent must itself be `is_no_qr`
(`validate_parent_venue_id`), and a venue can't stop being `is_no_qr`
while another venue still points at it as a parent
(`validate_no_qr_disable`) — the two are mirror images of the same rule,
enforced at both ends of the relationship.
"""


class TestAssignParent:
    def test_parent_with_is_no_qr_true_is_allowed(self, client, make_venue):
        parent = make_venue(name="Zahra Walk", is_no_qr=True)
        child = make_venue(name="Restaurant A")

        response = client.patch(
            f"/editor/venues/{child.id}",
            json={"parent_venue_id": parent.id},
            headers={"If-Match": str(child.version)},
        )

        assert response.status_code == 200
        assert response.json()["parent_venue_id"] == parent.id

    def test_parent_with_is_no_qr_false_is_rejected(self, client, make_venue):
        # A normal venue — never designated a No QR place.
        not_a_parent = make_venue(name="Ordinary Restaurant")
        child = make_venue(name="Restaurant A")

        response = client.patch(
            f"/editor/venues/{child.id}",
            json={"parent_venue_id": not_a_parent.id},
            headers={"If-Match": str(child.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_parent_venue"

    def test_self_reference_is_rejected(self, client, make_venue):
        venue = make_venue(is_no_qr=True)

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"parent_venue_id": venue.id},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_parent_venue"
        assert "own parent" in response.json()["detail"]["message"]

    def test_nonexistent_parent_is_rejected(self, client, make_venue):
        venue = make_venue()

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"parent_venue_id": "does-not-exist"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_parent_venue"

    def test_clearing_parent_to_null_is_always_allowed(self, client, make_venue):
        parent = make_venue(name="Zahra Walk", is_no_qr=True)
        child = make_venue(name="Restaurant A", parent_venue_id=parent.id)

        response = client.patch(
            f"/editor/venues/{child.id}",
            json={"parent_venue_id": None},
            headers={"If-Match": str(child.version)},
        )

        assert response.status_code == 200
        assert response.json()["parent_venue_id"] is None


class TestDisableIsNoQr:
    def test_disable_while_children_exist_is_rejected(self, client, make_venue):
        parent = make_venue(name="Zahra Walk", is_no_qr=True)
        make_venue(name="Restaurant A", parent_venue_id=parent.id)

        response = client.patch(
            f"/editor/venues/{parent.id}",
            json={"is_no_qr": False},
            headers={"If-Match": str(parent.version)},
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "venue_has_no_qr_children"
        assert response.json()["detail"]["message"] == (
            "Cannot disable No QR while this venue is assigned as a parent."
        )

    def test_disable_with_no_children_is_allowed(self, client, make_venue):
        parent = make_venue(name="Standalone No QR Place", is_no_qr=True)

        response = client.patch(
            f"/editor/venues/{parent.id}",
            json={"is_no_qr": False},
            headers={"If-Match": str(parent.version)},
        )

        assert response.status_code == 200
        assert response.json()["is_no_qr"] is False

    def test_ordinary_venue_with_no_children_unaffected(self, client, make_venue):
        """A normal venue (is_no_qr already false, no children) can still
        be edited exactly as before — the new check never engages for it."""
        venue = make_venue(name="Ordinary Restaurant")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Renamed Restaurant"},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Renamed Restaurant"

    def test_enabling_is_no_qr_is_never_blocked(self, client, make_venue):
        """The guard only fires on true -> false; false -> true (or
        true -> true, a no-op resend) is always fine regardless of
        children, since nothing becomes dangling either way."""
        venue = make_venue(name="New Walk")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"is_no_qr": True},
            headers={"If-Match": str(venue.version)},
        )

        assert response.status_code == 200
        assert response.json()["is_no_qr"] is True

    def test_grandchild_via_second_parent_does_not_block_unrelated_venue(self, client, make_venue):
        """Only *this* venue's own children matter — a No QR venue with no
        children of its own can be disabled even while an unrelated No QR
        venue elsewhere has children."""
        busy_parent = make_venue(name="Stella Walk", is_no_qr=True)
        make_venue(name="Coffee B", parent_venue_id=busy_parent.id)
        idle_parent = make_venue(name="Empty Mall", is_no_qr=True)

        response = client.patch(
            f"/editor/venues/{idle_parent.id}",
            json={"is_no_qr": False},
            headers={"If-Match": str(idle_parent.version)},
        )

        assert response.status_code == 200
        assert response.json()["is_no_qr"] is False
