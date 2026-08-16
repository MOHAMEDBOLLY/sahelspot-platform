"""HOME CURATION. Collection CRUD + CollectionVenue membership via
`/editor/collections`. Covers section creation/validation, venue
membership (add/reorder/remove), duplicate handling, invalid venue
rejection, and that the existing Venue-editor assignment path
(`collection_ids` on `PATCH /editor/venues/{id}`) keeps working
independently.
"""

from app.db.models import Collection, CollectionVenue


class TestCreateCollection:
    def test_creates_a_collection(self, client, db):
        try:
            response = client.post(
                "/editor/collections", json={"id": "test-section", "name": "Test Section"}
            )

            assert response.status_code == 201
            body = response.json()
            assert body["id"] == "test-section"
            assert body["slug"] == "test-section"
            assert body["name"] == "Test Section"
            assert body["is_active"] is True
            assert body["venues"] == []
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_rejects_blank_name(self, client, db):
        try:
            response = client.post("/editor/collections", json={"id": "test-section", "name": "   "})
            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_collection_name"
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_rejects_duplicate_id(self, client, db):
        collection = Collection(id="test-dup", slug="test-dup", name="Existing", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.post("/editor/collections", json={"id": "test-dup", "name": "New"})
            assert response.status_code == 409
            assert response.json()["detail"]["error"] == "collection_already_exists"
        finally:
            db.query(Collection).filter(Collection.id == "test-dup").delete()
            db.commit()

    def test_defaults_is_active_true(self, client, db):
        try:
            response = client.post("/editor/collections", json={"id": "test-section", "name": "X"})
            assert response.json()["is_active"] is True
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()


class TestUpdateCollection:
    def test_renames_collection(self, client, db):
        collection = Collection(id="test-section", slug="test-section", name="Old", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.patch("/editor/collections/test-section", json={"name": "New Name"})
            assert response.status_code == 200
            assert response.json()["name"] == "New Name"
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_toggles_is_active(self, client, db):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.patch("/editor/collections/test-section", json={"is_active": False})
            assert response.status_code == 200
            assert response.json()["is_active"] is False
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_reorders_via_sort_order(self, client, db):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.patch("/editor/collections/test-section", json={"sort_order": 5})
            assert response.status_code == 200
            assert response.json()["sort_order"] == 5
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_type_id_not_accepted(self, client, db):
        """No `id`/`slug` field exists on `CollectionUpdate` at all —
        confirms it can't be changed after creation."""
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.patch("/editor/collections/test-section", json={"name": "X", "id": "hacked"})
            assert response.status_code == 200
            assert response.json()["id"] == "test-section"
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_unknown_collection_returns_404(self, client):
        response = client.patch("/editor/collections/does-not-exist", json={"name": "X"})
        assert response.status_code == 404


class TestDeleteCollection:
    def test_deletes_collection_and_memberships_not_venue(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="Test Venue")
        venue_id = venue.id
        db.add(CollectionVenue(collection_id="test-section", venue_id=venue_id, sort_order=0))
        db.commit()

        response = client.delete("/editor/collections/test-section")

        assert response.status_code == 204
        db.expunge_all()
        assert db.get(Collection, "test-section") is None
        assert db.get(type(venue), venue_id) is not None

    def test_unknown_collection_returns_404(self, client):
        response = client.delete("/editor/collections/does-not-exist")
        assert response.status_code == 404


class TestAddCollectionVenue:
    def test_adds_a_venue(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="Baia Beach House")
        try:
            response = client.post(
                "/editor/collections/test-section/venues", json={"venue_id": venue.id}
            )

            assert response.status_code == 201
            body = response.json()
            assert len(body["venues"]) == 1
            assert body["venues"][0]["venue_id"] == venue.id
            assert body["venues"][0]["venue"]["name"] == "Baia Beach House"
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "test-section").delete()
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_appends_sort_order_when_omitted(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        v1 = make_venue(name="V1")
        v2 = make_venue(name="V2")
        try:
            client.post("/editor/collections/test-section/venues", json={"venue_id": v1.id})
            response = client.post("/editor/collections/test-section/venues", json={"venue_id": v2.id})

            venues = response.json()["venues"]
            assert [v["venue_id"] for v in venues] == [v1.id, v2.id]
            assert venues[1]["sort_order"] == 1
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "test-section").delete()
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_adding_same_venue_twice_is_idempotent_not_duplicated(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="Costa Coffee")
        try:
            first = client.post("/editor/collections/test-section/venues", json={"venue_id": venue.id})
            second = client.post("/editor/collections/test-section/venues", json={"venue_id": venue.id})

            assert first.status_code == 201
            assert second.status_code == 201
            assert len(second.json()["venues"]) == 1
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "test-section").delete()
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_rejects_unknown_venue(self, client, db):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        try:
            response = client.post(
                "/editor/collections/test-section/venues", json={"venue_id": "does-not-exist"}
            )
            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_venue_id"
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_rejects_unknown_collection(self, client, make_venue):
        venue = make_venue()
        response = client.post(
            "/editor/collections/does-not-exist/venues", json={"venue_id": venue.id}
        )
        assert response.status_code == 404

    def test_same_venue_allowed_in_different_collections(self, client, db, make_venue):
        c1 = Collection(id="test-c1", slug="test-c1", name="C1", is_active=True, sort_order=0)
        c2 = Collection(id="test-c2", slug="test-c2", name="C2", is_active=True, sort_order=1)
        db.add_all([c1, c2])
        db.commit()
        venue = make_venue(name="Shared Venue")
        try:
            r1 = client.post("/editor/collections/test-c1/venues", json={"venue_id": venue.id})
            r2 = client.post("/editor/collections/test-c2/venues", json={"venue_id": venue.id})
            assert r1.status_code == 201
            assert r2.status_code == 201
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id.in_(["test-c1", "test-c2"])).delete(
                synchronize_session=False
            )
            db.query(Collection).filter(Collection.id.in_(["test-c1", "test-c2"])).delete(
                synchronize_session=False
            )
            db.commit()


class TestUpdateCollectionVenue:
    def test_reorders_membership(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="V1")
        db.add(CollectionVenue(collection_id="test-section", venue_id=venue.id, sort_order=0))
        db.commit()
        try:
            response = client.patch(
                f"/editor/collections/test-section/venues/{venue.id}", json={"sort_order": 3}
            )
            assert response.status_code == 200
            assert response.json()["venues"][0]["sort_order"] == 3
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "test-section").delete()
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()

    def test_unknown_membership_returns_404(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue()
        try:
            response = client.patch(
                f"/editor/collections/test-section/venues/{venue.id}", json={"sort_order": 1}
            )
            assert response.status_code == 404
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()


class TestRemoveCollectionVenue:
    def test_removes_membership_without_touching_venue(self, client, db, make_venue):
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="V1")
        venue_id = venue.id
        db.add(CollectionVenue(collection_id="test-section", venue_id=venue_id, sort_order=0))
        db.commit()
        try:
            response = client.delete(f"/editor/collections/test-section/venues/{venue_id}")

            assert response.status_code == 200
            assert response.json()["venues"] == []
            db.expunge_all()
            assert db.get(type(venue), venue_id) is not None
        finally:
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()


class TestVenueEditorAssignmentStillWorks:
    def test_collection_ids_on_venue_update_still_works(self, client, db, make_venue):
        """The pre-existing assignment path on `PATCH /editor/venues/{id}`
        (via `collection_ids`) must keep working independently of the new
        Collection-side CRUD — confirms Home Curation didn't break it."""
        collection = Collection(id="test-section", slug="test-section", name="X", is_active=True, sort_order=0)
        db.add(collection)
        db.commit()
        venue = make_venue(name="V1")
        try:
            response = client.patch(
                f"/editor/venues/{venue.id}",
                json={"collection_ids": ["test-section"]},
                headers={"If-Match": str(venue.version)},
            )
            assert response.status_code == 200
            assert response.json()["collections"] == ["test-section"]
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "test-section").delete()
            db.query(Collection).filter(Collection.id == "test-section").delete()
            db.commit()
