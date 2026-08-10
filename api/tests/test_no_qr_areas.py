"""STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). `no_qr_areas`/`no_qr_places`
via `/editor/no-qr-areas`/`/editor/no-qr-places`. Covers area creation/
validation, the "exactly one of venue_id/name" place identity invariant,
duplicate-venue-in-same-area rejection, and Venue delete behavior when a
place would otherwise be left with no identity.
"""

from app.db.models import NoQrArea, NoQrPlace


class TestCreateArea:
    def test_creates_a_walk(self, client, db):
        try:
            response = client.post("/editor/no-qr-areas", json={"name": "Marina Walk", "type": "Walk"})

            assert response.status_code == 201
            body = response.json()
            assert body["name"] == "Marina Walk"
            assert body["type"] == "Walk"
            assert body["places"] == []
        finally:
            db.query(NoQrArea).filter(NoQrArea.name == "Marina Walk").delete()
            db.commit()

    def test_creates_a_mall(self, client, db):
        try:
            response = client.post("/editor/no-qr-areas", json={"name": "Mporium", "type": "Mall"})

            assert response.status_code == 201
            assert response.json()["type"] == "Mall"
        finally:
            db.query(NoQrArea).filter(NoQrArea.name == "Mporium").delete()
            db.commit()

    def test_rejects_invalid_type(self, client):
        response = client.post("/editor/no-qr-areas", json={"name": "Somewhere", "type": "Plaza"})

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_no_qr_area_type"

    def test_rejects_blank_name(self, client):
        response = client.post("/editor/no-qr-areas", json={"name": "   ", "type": "Walk"})

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "invalid_no_qr_area_name"

    def test_does_not_require_venue_fields(self, client, db):
        """A Walk/Mall is not a Venue — no category, address, or any other
        Venue-shaped field is ever required or accepted here."""
        try:
            response = client.post("/editor/no-qr-areas", json={"name": "Marassi Walk", "type": "Walk"})
            assert response.status_code == 201
        finally:
            db.query(NoQrArea).filter(NoQrArea.name == "Marassi Walk").delete()
            db.commit()


class TestUpdateArea:
    def test_renames_area(self, client, db):
        area = NoQrArea(name="Old Name", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        try:
            response = client.patch(f"/editor/no-qr-areas/{area.id}", json={"name": "New Name"})

            assert response.status_code == 200
            assert response.json()["name"] == "New Name"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_type_is_not_accepted_on_update(self, client, db):
        """`NoQrAreaUpdate` has no `type` field at all — sending one is
        simply ignored by Pydantic (extra fields aren't forbidden), and
        the stored type never changes."""
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        try:
            response = client.patch(
                f"/editor/no-qr-areas/{area.id}", json={"name": "Marina Walk", "type": "Mall"}
            )

            assert response.status_code == 200
            assert response.json()["type"] == "Walk"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_unknown_area_returns_404(self, client):
        response = client.patch("/editor/no-qr-areas/999999999", json={"name": "X"})
        assert response.status_code == 404


class TestCreatePlace:
    def test_links_an_existing_venue(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue(name="Costa Coffee")
        try:
            response = client.post(f"/editor/no-qr-areas/{area.id}/places", json={"venue_id": venue.id})

            assert response.status_code == 201
            body = response.json()
            assert body["venue_id"] == venue.id
            assert body["name"] is None
            assert body["venue"]["name"] == "Costa Coffee"
        finally:
            db.query(NoQrPlace).filter(NoQrPlace.area_id == area.id).delete()
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_creates_a_standalone_place(self, client, db):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        try:
            response = client.post(
                f"/editor/no-qr-areas/{area.id}/places", json={"name": "New Seafood Spot"}
            )

            assert response.status_code == 201
            body = response.json()
            assert body["venue_id"] is None
            assert body["name"] == "New Seafood Spot"
            assert body["venue"] is None
        finally:
            db.query(NoQrPlace).filter(NoQrPlace.area_id == area.id).delete()
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_rejects_neither_venue_nor_name(self, client, db):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        try:
            response = client.post(f"/editor/no-qr-areas/{area.id}/places", json={})

            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_no_qr_place"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_rejects_both_venue_and_name(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue()
        try:
            response = client.post(
                f"/editor/no-qr-areas/{area.id}/places",
                json={"venue_id": venue.id, "name": "Something"},
            )

            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_no_qr_place"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_rejects_unknown_venue(self, client, db):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        try:
            response = client.post(
                f"/editor/no-qr-areas/{area.id}/places", json={"venue_id": "does-not-exist"}
            )

            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_no_qr_place"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_rejects_unknown_area(self, client, make_venue):
        venue = make_venue()
        response = client.post("/editor/no-qr-areas/999999999/places", json={"venue_id": venue.id})
        assert response.status_code == 404

    def test_rejects_duplicate_venue_in_same_area(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue(name="Costa Coffee")
        try:
            first = client.post(f"/editor/no-qr-areas/{area.id}/places", json={"venue_id": venue.id})
            assert first.status_code == 201

            second = client.post(f"/editor/no-qr-areas/{area.id}/places", json={"venue_id": venue.id})

            assert second.status_code == 409
            assert second.json()["detail"]["error"] == "duplicate_no_qr_place"
        finally:
            db.query(NoQrPlace).filter(NoQrPlace.area_id == area.id).delete()
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_same_venue_allowed_in_different_areas(self, client, db, make_venue):
        """The uniqueness rule is scoped to (area, venue), not venue alone
        — the same Costa Coffee could legitimately sit in two different
        Walks (e.g. it has two branches, or the data is still being
        cleaned up); nothing here should forbid that."""
        area_a = NoQrArea(name="Marina Walk", type="Walk")
        area_b = NoQrArea(name="Marassi Walk", type="Walk")
        db.add_all([area_a, area_b])
        db.commit()
        db.refresh(area_a)
        db.refresh(area_b)
        venue = make_venue(name="Costa Coffee")
        try:
            first = client.post(f"/editor/no-qr-areas/{area_a.id}/places", json={"venue_id": venue.id})
            second = client.post(f"/editor/no-qr-areas/{area_b.id}/places", json={"venue_id": venue.id})

            assert first.status_code == 201
            assert second.status_code == 201
        finally:
            db.query(NoQrPlace).filter(NoQrPlace.area_id.in_([area_a.id, area_b.id])).delete(
                synchronize_session=False
            )
            db.query(NoQrArea).filter(NoQrArea.id.in_([area_a.id, area_b.id])).delete(
                synchronize_session=False
            )
            db.commit()


class TestUpdatePlace:
    def test_renames_a_standalone_place(self, client, db):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        place = NoQrPlace(area_id=area.id, name="Old Name")
        db.add(place)
        db.commit()
        db.refresh(place)
        try:
            response = client.patch(f"/editor/no-qr-places/{place.id}", json={"name": "New Name"})

            assert response.status_code == 200
            assert response.json()["name"] == "New Name"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_rejects_becoming_identity_less(self, client, db):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        place = NoQrPlace(area_id=area.id, name="Some Place")
        db.add(place)
        db.commit()
        db.refresh(place)
        try:
            response = client.patch(f"/editor/no-qr-places/{place.id}", json={})

            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_no_qr_place"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()


class TestDeletePlace:
    def test_removes_place_without_touching_venue(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue(name="Costa Coffee")
        place = NoQrPlace(area_id=area.id, venue_id=venue.id)
        db.add(place)
        db.commit()
        db.refresh(place)
        try:
            response = client.delete(f"/editor/no-qr-places/{place.id}")

            assert response.status_code == 204
            db.expunge(place)
            assert db.query(NoQrPlace).filter(NoQrPlace.id == place.id).first() is None
            assert db.get(type(venue), venue.id) is not None
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()


class TestAreaDeleteCascades:
    def test_deleting_area_deletes_its_places_not_the_venue(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue(name="Costa Coffee")
        place = NoQrPlace(area_id=area.id, venue_id=venue.id)
        db.add(place)
        db.commit()
        place_id = place.id

        response = client.delete(f"/editor/no-qr-areas/{area.id}")

        assert response.status_code == 204
        db.expunge(place)
        assert db.query(NoQrPlace).filter(NoQrPlace.id == place_id).first() is None
        assert db.get(type(venue), venue.id) is not None


class TestVenueDeleteBehavior:
    def test_deleting_a_venue_that_is_a_places_sole_identity_is_blocked(self, client, db, make_venue):
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.commit()
        db.refresh(area)
        venue = make_venue(name="Costa Coffee")
        place = NoQrPlace(area_id=area.id, venue_id=venue.id)
        db.add(place)
        db.commit()
        try:
            response = client.delete(f"/editor/venues/{venue.id}")

            assert response.status_code == 409
            assert response.json()["detail"]["error"] == "venue_has_sole_no_qr_places"
        finally:
            db.query(NoQrPlace).filter(NoQrPlace.area_id == area.id).delete()
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_deleting_a_venue_with_no_no_qr_place_still_works(self, client, db, make_venue):
        venue = make_venue(name="Ordinary Restaurant")

        response = client.delete(f"/editor/venues/{venue.id}")

        assert response.status_code == 204
