"""Consumer Home Curation Integration V2 — `GET /public/collections`.

Runs against the disposable test database only (see tests/conftest.py);
never against production. Migration 0023 already seeds `best-beaches`
(sort_order 7), `food-picks` (8), `nightlife` (9) as active, empty
collections, so every test here starts from that real baseline rather than
fabricating collections from scratch — the same state production is
actually in.
"""

from app.db.models import Collection, CollectionVenue


def _publish(client) -> int:
    response = client.post("/editor/publish")
    assert response.status_code == 200
    return response.json()["id"]


class TestListPublishedHomeCollections:
    def test_seeded_sections_with_no_venues_come_back_empty_in_seed_order(
        self, client, db, preserve_seed_state
    ):
        _publish(client)

        response = client.get("/public/collections")
        assert response.status_code == 200
        body = response.json()

        slugs = [c["slug"] for c in body]
        assert slugs == ["best-beaches", "food-picks", "nightlife"]
        assert all(c["venues"] == [] for c in body)
        # 0-based position among Home Curation collections only — not the
        # raw DB sort_order (7/8/9).
        assert [c["sort_order"] for c in body] == [0, 1, 2]

    def test_venue_order_within_a_section_is_preserved(
        self, client, db, make_venue, preserve_seed_state
    ):
        v1 = make_venue(status="approved", name="First")
        v2 = make_venue(status="approved", name="Second")
        try:
            client.post("/editor/collections/best-beaches/venues", json={"venue_id": v1.id})
            client.post("/editor/collections/best-beaches/venues", json={"venue_id": v2.id})
            _publish(client)

            body = client.get("/public/collections").json()
            best_beaches = next(c for c in body if c["slug"] == "best-beaches")
            assert [v["id"] for v in best_beaches["venues"]] == [v1.id, v2.id]

            # Reorder — Second first, First second — and confirm the public
            # response follows CollectionVenue.sort_order, not insertion order.
            client.patch(
                f"/editor/collections/best-beaches/venues/{v1.id}", json={"sort_order": 5}
            )
            _publish(client)
            body = client.get("/public/collections").json()
            best_beaches = next(c for c in body if c["slug"] == "best-beaches")
            assert [v["id"] for v in best_beaches["venues"]] == [v2.id, v1.id]
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "best-beaches").delete()
            db.commit()

    def test_section_order_follows_collection_sort_order_and_reacts_to_reorder(
        self, client, db, preserve_seed_state
    ):
        _publish(client)
        body = client.get("/public/collections").json()
        assert [c["slug"] for c in body] == ["best-beaches", "food-picks", "nightlife"]

        try:
            # Studio: reorder — Nightlife, Best Beaches, Food Picks.
            client.patch("/editor/collections/nightlife", json={"sort_order": 6})
            _publish(client)
            body = client.get("/public/collections").json()
            assert [c["slug"] for c in body] == ["nightlife", "best-beaches", "food-picks"]
        finally:
            # Restore.
            client.patch("/editor/collections/nightlife", json={"sort_order": 9})
            _publish(client)
            body = client.get("/public/collections").json()
            assert [c["slug"] for c in body] == ["best-beaches", "food-picks", "nightlife"]

    def test_inactive_section_is_excluded(self, client, db, preserve_seed_state):
        try:
            client.patch("/editor/collections/nightlife", json={"is_active": False})
            _publish(client)
            body = client.get("/public/collections").json()
            assert [c["slug"] for c in body] == ["best-beaches", "food-picks"]
        finally:
            client.patch("/editor/collections/nightlife", json={"is_active": True})
            _publish(client)

    def test_unpublished_venue_is_excluded_from_its_section(
        self, client, db, make_venue, preserve_seed_state
    ):
        draft_venue = make_venue(status="draft", name="Not Published")
        try:
            client.post("/editor/collections/food-picks/venues", json={"venue_id": draft_venue.id})
            _publish(client)
            body = client.get("/public/collections").json()
            food_picks = next(c for c in body if c["slug"] == "food-picks")
            assert food_picks["venues"] == []
        finally:
            db.query(CollectionVenue).filter(CollectionVenue.collection_id == "food-picks").delete()
            db.commit()

    def test_non_home_curation_collections_never_appear(self, client, preserve_seed_state):
        _publish(client)
        body = client.get("/public/collections").json()
        slugs = {c["slug"] for c in body}
        # Seeded by migration 0015, unrelated to Home Curation.
        assert "editors-choice" not in slugs
        assert "trending" not in slugs

    def test_single_slug_endpoint_still_works_unchanged(self, client, preserve_seed_state):
        _publish(client)
        response = client.get("/public/collections/best-beaches")
        assert response.status_code == 200
        assert response.json()["slug"] == "best-beaches"
        # The single-slug shape is untouched — no `sort_order` leaks into it.
        assert "sort_order" not in response.json()

    def test_no_current_revision_returns_empty_list_not_404(self, client, db):
        from app.db.models import PublishRevision

        current = db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).first()
        if current is not None:
            db.query(PublishRevision).filter(PublishRevision.id == current.id).update(
                {"is_current": False}
            )
            db.commit()
        try:
            response = client.get("/public/collections")
            assert response.status_code == 200
            assert response.json() == []
        finally:
            if current is not None:
                db.query(PublishRevision).filter(PublishRevision.id == current.id).update(
                    {"is_current": True}
                )
                db.commit()
