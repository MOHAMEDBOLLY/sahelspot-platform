"""No QR Independent Entity — public read path.

`GET /public/discover/no-qr-areas`: the Consumer-facing projection of
`no_qr_areas`/`no_qr_places`, distinct from the legacy `/public/discover/
no-qr` (Venue `access_type`-based, unrelated model — not touched here).
Unlike every other `/public/*` route this is a live query, not a
publish-revision read — `NoQrArea` has no `status` column at all, so
there is nothing to publish/snapshot (see `NoQrArea`'s own docstring,
app/db/models.py).
"""

from app.db.models import NoQrArea, NoQrPlace


class TestEmptyDatabase:
    def test_returns_empty_list_with_no_areas(self, client):
        response = client.get("/public/discover/no-qr-areas")

        assert response.status_code == 200
        assert response.json() == []

    def test_requires_no_authentication(self, client):
        # No Authorization header at all — a 401/403 here would mean this
        # accidentally inherited an auth dependency.
        response = client.get("/public/discover/no-qr-areas")

        assert response.status_code == 200


class TestWalkAndMall:
    def test_one_walk_with_existing_venue_and_standalone_place(self, db, client, make_venue):
        venue = make_venue(name="Costa Coffee", status="approved")
        area = NoQrArea(name="Marina Walk", type="Walk")
        db.add(area)
        db.flush()
        db.add(NoQrPlace(area_id=area.id, venue_id=venue.id, name=None))
        db.add(NoQrPlace(area_id=area.id, venue_id=None, name="New Seafood Spot"))
        db.commit()

        try:
            response = client.get("/public/discover/no-qr-areas")
            assert response.status_code == 200
            body = response.json()

            entry = next(a for a in body if a["name"] == "Marina Walk")
            assert entry["type"] == "Walk"
            assert len(entry["places"]) == 2

            linked = next(p for p in entry["places"] if p["venue"] is not None)
            assert linked["venue"] == {"id": venue.id, "name": "Costa Coffee"}
            assert linked["name"] is None

            standalone = next(p for p in entry["places"] if p["venue"] is None)
            assert standalone["name"] == "New Seafood Spot"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_one_mall_with_existing_venue_and_standalone_place(self, db, client, make_venue):
        venue = make_venue(name="Mall Anchor Store", status="approved")
        area = NoQrArea(name="Mporium", type="Mall")
        db.add(area)
        db.flush()
        db.add(NoQrPlace(area_id=area.id, venue_id=venue.id, name=None))
        db.add(NoQrPlace(area_id=area.id, venue_id=None, name="Another Place"))
        db.commit()

        try:
            response = client.get("/public/discover/no-qr-areas")
            body = response.json()
            entry = next(a for a in body if a["name"] == "Mporium")
            assert entry["type"] == "Mall"
            assert len(entry["places"]) == 2
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()

    def test_walk_and_mall_remain_separate(self, db, client):
        walk = NoQrArea(name="Separation Walk", type="Walk")
        mall = NoQrArea(name="Separation Mall", type="Mall")
        db.add_all([walk, mall])
        db.commit()

        try:
            body = client.get("/public/discover/no-qr-areas").json()
            walk_entry = next(a for a in body if a["name"] == "Separation Walk")
            mall_entry = next(a for a in body if a["name"] == "Separation Mall")
            assert walk_entry["type"] == "Walk"
            assert mall_entry["type"] == "Mall"
        finally:
            db.query(NoQrArea).filter(NoQrArea.id.in_([walk.id, mall.id])).delete(
                synchronize_session=False
            )
            db.commit()

    def test_multiple_places_all_returned_under_the_correct_area(self, db, client, make_venue):
        area_a = NoQrArea(name="Area A", type="Walk")
        area_b = NoQrArea(name="Area B", type="Walk")
        db.add_all([area_a, area_b])
        db.flush()
        db.add(NoQrPlace(area_id=area_a.id, venue_id=None, name="A Place 1"))
        db.add(NoQrPlace(area_id=area_a.id, venue_id=None, name="A Place 2"))
        db.add(NoQrPlace(area_id=area_b.id, venue_id=None, name="B Place 1"))
        db.commit()

        try:
            body = client.get("/public/discover/no-qr-areas").json()
            entry_a = next(a for a in body if a["name"] == "Area A")
            entry_b = next(a for a in body if a["name"] == "Area B")
            assert {p["name"] for p in entry_a["places"]} == {"A Place 1", "A Place 2"}
            assert {p["name"] for p in entry_b["places"]} == {"B Place 1"}
        finally:
            db.query(NoQrArea).filter(NoQrArea.id.in_([area_a.id, area_b.id])).delete(
                synchronize_session=False
            )
            db.commit()

    def test_zero_place_area_is_still_returned(self, db, client):
        area = NoQrArea(name="Empty Walk", type="Walk")
        db.add(area)
        db.commit()

        try:
            body = client.get("/public/discover/no-qr-areas").json()
            entry = next(a for a in body if a["name"] == "Empty Walk")
            assert entry["places"] == []
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()


class TestNoFieldLeakage:
    def test_response_never_exposes_internal_or_legacy_fields(self, db, client, make_venue):
        venue = make_venue(name="Leakage Check Venue", status="approved")
        area = NoQrArea(name="Leakage Check Area", type="Walk")
        db.add(area)
        db.flush()
        db.add(NoQrPlace(area_id=area.id, venue_id=venue.id, name=None))
        db.commit()

        try:
            body = client.get("/public/discover/no-qr-areas").json()
            entry = next(a for a in body if a["name"] == "Leakage Check Area")

            assert "created_at" not in entry
            assert "updated_at" not in entry

            place = entry["places"][0]
            assert "area_id" not in place
            assert "venue_id" not in place
            assert "created_at" not in place
            assert "updated_at" not in place
            assert "is_no_qr" not in place
            assert "parent_venue_id" not in place
            assert "no_qr_type" not in place

            # The venue ref itself is the lean {id, name} shape — no
            # category, no legacy No QR fields riding along on it either.
            assert set(place["venue"].keys()) == {"id", "name"}
        finally:
            db.query(NoQrArea).filter(NoQrArea.id == area.id).delete()
            db.commit()


class TestMethodSafety:
    def test_post_is_not_allowed(self, client):
        response = client.post("/public/discover/no-qr-areas", json={"name": "x", "type": "Walk"})

        assert response.status_code == 405

    def test_delete_is_not_allowed(self, client):
        response = client.delete("/public/discover/no-qr-areas")

        assert response.status_code == 405
