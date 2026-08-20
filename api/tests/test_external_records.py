"""External Data Enrichment Workflow (Phase 1). Covers: loading detail
records into the staging layer (never `venues`), matching, Studio value
preserved by default, external value never applied without explicit
Apply, selected-field-only apply, category/destination conflict gating,
new-venue creation requiring explicit confirmation, no automatic image
import, no booking-URL apply path, review status transitions, and an
activity-log audit entry for every Apply.
"""

import io
import json

from app.db.models import ActivityLogEntry, ExternalDestinationMapping, ExternalRecord


def _upload_detail(client, source, rows):
    content = json.dumps(rows).encode("utf-8")
    return client.post(
        "/editor/external-records/load-detail",
        data={"source": source},
        files={"file": ("records.json", io.BytesIO(content), "application/json")},
    )


class TestLoadDetailRecords:
    def test_external_record_loads_into_staging_not_venues(self, client, db):
        rows = [
            {
                "source": "test-source",
                "source_url": "https://example.com",
                "name": "New Seafood Spot",
                "category": "Dining",
                "destination": "Nowhere",
                "description": "A place",
                "amenities": ["Outdoor", "Sea view"],
                "google_maps_url": "",
                "booking_type": "in-site request flow",
                "booking_url": "",
                "image_urls": ["https://example.com/1.jpg"],
                "review_status": "PENDING",
            }
        ]
        try:
            response = _upload_detail(client, "test-source", rows)

            assert response.status_code == 201
            body = response.json()
            assert body["created"] == 1
            assert body["updated"] == 0

            venues_response = client.get("/editor/venues", params={"q": "New Seafood Spot"})
            assert venues_response.json()["total"] == 0
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.source == "test-source").delete()
            db.commit()

    def test_matching_record_loads_and_classifies(self, client, db, make_venue):
        # Exercises the maps_url signal (an exact match is MATCH_CONFIRMED
        # on its own — never inferred from name text alone).
        venue = make_venue(
            name="Sachi", category="Restaurant", maps_url="https://maps.example.com/sachi-unique"
        )
        rows = [
            {
                "source": "test-source",
                "name": "Sachi",
                "category": "Restaurant",
                "destination": venue.destination.name,
                "google_maps_url": "https://maps.example.com/sachi-unique",
            }
        ]
        try:
            response = _upload_detail(client, "test-source", rows)
            assert response.status_code == 201

            list_response = client.get("/editor/external-records", params={"source": "test-source"})
            items = list_response.json()["items"]
            assert len(items) == 1
            assert items[0]["match_status"] == "MATCH_CONFIRMED"
            assert items[0]["matched_venue_id"] == venue.id
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.source == "test-source").delete()
            db.commit()

    def test_reload_updates_detail_without_resetting_review_state(self, client, db):
        rows = [{"source": "test-source", "name": "Place A", "destination": "X", "description": "v1"}]
        try:
            _upload_detail(client, "test-source", rows)
            record = db.query(ExternalRecord).filter(ExternalRecord.external_name == "Place A").one()
            record.review_status = "IN_REVIEW"
            db.commit()

            rows[0]["description"] = "v2"
            response = _upload_detail(client, "test-source", rows)

            assert response.json()["created"] == 0
            assert response.json()["updated"] == 1
            db.refresh(record)
            assert record.external_description == "v2"
            assert record.review_status == "IN_REVIEW"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.source == "test-source").delete()
            db.commit()


class TestReviewStatusChanges:
    def test_review_status_transitions(self, client, db):
        record = ExternalRecord(source="s", external_name="X", external_destination="D")
        db.add(record)
        db.commit()
        try:
            response = client.patch(
                f"/editor/external-records/{record.id}/review-status", json={"review_status": "IN_REVIEW"}
            )
            assert response.status_code == 200
            assert response.json()["review_status"] == "IN_REVIEW"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_invalid_review_status_rejected(self, client, db):
        record = ExternalRecord(source="s", external_name="X", external_destination="D")
        db.add(record)
        db.commit()
        try:
            response = client.patch(
                f"/editor/external-records/{record.id}/review-status", json={"review_status": "BOGUS"}
            )
            assert response.status_code == 422
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()


class TestApplySelectedFields:
    def test_studio_value_preserved_by_default(self, client, db, make_venue):
        venue = make_venue(short_description="Original Studio text")
        record = ExternalRecord(
            source="s",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_description="External suggestion",
        )
        db.add(record)
        db.commit()
        try:
            # Loading/reading a record never changes the venue.
            client.get(f"/editor/external-records/{record.id}")
            db.refresh(venue)
            assert venue.short_description == "Original Studio text"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_external_value_not_applied_without_approval(self, client, db, make_venue):
        venue = make_venue(short_description="Original")
        record = ExternalRecord(
            source="s", external_name=venue.name, matched_venue_id=venue.id, external_description="Suggested"
        )
        db.add(record)
        db.commit()
        try:
            # No apply call made at all.
            db.refresh(venue)
            assert venue.short_description == "Original"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_selected_field_applies_unselected_remains_unchanged(self, client, db, make_venue):
        venue = make_venue(short_description=None, maps_url="https://old-maps.example.com")
        record = ExternalRecord(
            source="s",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_description="New description",
            external_maps_url="https://new-maps.example.com",
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["description"]}
            )

            assert response.status_code == 200
            assert response.json()["fields_applied"] == ["description"]
            db.refresh(venue)
            assert venue.short_description == "New description"
            assert venue.maps_url == "https://old-maps.example.com"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_category_conflict_requires_explicit_approval(self, client, db, make_venue):
        venue = make_venue(category="Restaurant")
        record = ExternalRecord(
            source="s", external_name=venue.name, matched_venue_id=venue.id, external_category="Nightlife"
        )
        db.add(record)
        db.commit()
        try:
            rejected = client.post(f"/editor/external-records/{record.id}/apply", json={"fields": ["category"]})
            assert rejected.status_code == 409
            assert rejected.json()["detail"]["error"] == "category_conflict"
            db.refresh(venue)
            assert venue.category == "Restaurant"

            approved = client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["category"], "override_conflict": True},
            )
            assert approved.status_code == 200
            db.refresh(venue)
            assert venue.category == "Nightlife"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_destination_conflict_requires_explicit_approval(self, client, db, make_venue, make_destination):
        other_destination = make_destination(name="Somewhere Else")
        venue = make_venue()
        record = ExternalRecord(
            source="s",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_destination=other_destination.name,
        )
        db.add(record)
        db.commit()
        try:
            rejected = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["destination"]}
            )
            assert rejected.status_code == 409
            assert rejected.json()["detail"]["error"] == "destination_conflict"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_no_apply_path_for_booking_or_amenities(self, client, db, make_venue):
        """`booking_type`/`booking_url` explicitly have no Apply path in
        Phase 1 — a source's "Reserve" may be its own internal flow, not
        a direct venue URL. `amenities` has no approved Venue column to
        write onto. Both must be rejected as non-applicable fields."""
        venue = make_venue()
        record = ExternalRecord(
            source="s",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_booking_url="https://example.com/book",
            external_amenities=["Outdoor"],
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["booking_url"]}
            )
            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "invalid_apply_fields"

            response2 = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["amenities"]}
            )
            assert response2.status_code == 422
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_no_automatic_image_import(self, client, db, make_venue):
        venue = make_venue(cover_image_url=None, gallery_image_urls=None)
        record = ExternalRecord(
            source="s",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_image_urls=["https://example.com/a.jpg"],
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(f"/editor/external-records/{record.id}/apply", json={"fields": ["images"]})
            assert response.status_code == 422
            db.refresh(venue)
            assert venue.cover_image_url is None
            assert venue.gallery_image_urls is None
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_apply_requires_a_matched_venue(self, client, db):
        record = ExternalRecord(source="s", external_name="Unmatched", external_description="X")
        db.add(record)
        db.commit()
        try:
            response = client.post(f"/editor/external-records/{record.id}/apply", json={"fields": ["description"]})
            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "no_matched_venue"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()


class TestAuditTrail:
    def test_apply_creates_activity_log_entry(self, client, db, make_venue):
        venue = make_venue(short_description=None)
        record = ExternalRecord(
            source="s", external_name=venue.name, matched_venue_id=venue.id, external_description="New text"
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["description"]}
            )
            assert response.status_code == 200

            entry = (
                db.query(ActivityLogEntry)
                .filter(
                    ActivityLogEntry.action == "apply_external_record_fields",
                    ActivityLogEntry.entity_id == venue.id,
                )
                .order_by(ActivityLogEntry.id.desc())
                .first()
            )
            assert entry is not None
            assert entry.activity_metadata["fields_changed"]["description"]["previous"] is None
            assert entry.activity_metadata["fields_changed"]["description"]["new"] == "New text"
            assert entry.activity_metadata["external_record_id"] == record.id
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_no_change_means_no_audit_entry(self, client, db, make_venue):
        venue = make_venue(short_description="Same text")
        record = ExternalRecord(
            source="s", external_name=venue.name, matched_venue_id=venue.id, external_description="Same text"
        )
        db.add(record)
        db.commit()
        try:
            before = db.query(ActivityLogEntry).count()
            response = client.post(
                f"/editor/external-records/{record.id}/apply", json={"fields": ["description"]}
            )
            assert response.status_code == 200
            assert response.json()["fields_applied"] == []
            after = db.query(ActivityLogEntry).count()
            assert after == before
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()


class TestCreateVenue:
    def test_new_venue_requires_explicit_confirmation_payload(self, client, db, make_destination):
        destination = make_destination()
        record = ExternalRecord(source="s", external_name="Brand New Place", external_destination=destination.name)
        db.add(record)
        db.commit()
        venue_id = f"test-v-external-{record.id}"
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/create-venue",
                json={
                    "id": venue_id,
                    "name": "Brand New Place",
                    "slug": venue_id,
                    "category": "Restaurant",
                    "destination_id": destination.id,
                    "short_description": None,
                    "maps_url": None,
                },
            )

            assert response.status_code == 201
            assert response.json()["id"] == venue_id
            db.refresh(record)
            assert record.matched_venue_id == venue_id
            assert record.review_status == "APPROVED"
        finally:
            from app.db.models import Venue

            db.query(Venue).filter(Venue.id == venue_id).delete()
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_cannot_create_venue_for_already_matched_record(self, client, db, make_venue, make_destination):
        venue = make_venue()
        destination = make_destination()
        record = ExternalRecord(source="s", external_name="X", matched_venue_id=venue.id)
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/create-venue",
                json={
                    "id": "test-v-should-not-exist",
                    "name": "X",
                    "slug": "test-v-should-not-exist",
                    "category": "Restaurant",
                    "destination_id": destination.id,
                },
            )
            assert response.status_code == 409
            assert response.json()["detail"]["error"] == "already_matched"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()


class TestDestinationMapping:
    """Explicit, deterministic destination mapping — e.g. iSahel's "El
    Alamein" -> Studio's "New Alamein". Never fuzzy: only an explicit
    `ExternalDestinationMapping` row, or a literal name match, ever
    resolves a destination; anything else blocks Apply."""

    def test_resolves_only_through_the_explicit_mapping(self, client, db, make_venue, make_destination):
        new_alamein = make_destination(name="New Alamein")
        venue = make_venue(name="Some Beach")
        record = ExternalRecord(
            source="isahel", external_name=venue.name, matched_venue_id=venue.id, external_destination="El Alamein"
        )
        db.add(record)
        db.commit()
        mapping_id = None
        try:
            # Without a mapping, "El Alamein" doesn't literally match any
            # Studio destination name, so Apply must block.
            blocked = client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["destination"], "override_conflict": True},
            )
            assert blocked.status_code == 422
            assert blocked.json()["detail"]["error"] == "unresolvable_destination"

            create_mapping = client.post(
                "/editor/external-destination-mappings",
                json={"source": "isahel", "external_destination": "El Alamein", "studio_destination_id": new_alamein.id},
            )
            assert create_mapping.status_code == 201
            mapping_id = create_mapping.json()["id"]

            # The review view shows the mapping before Apply is attempted.
            detail = client.get(f"/editor/external-records/{record.id}")
            assert detail.json()["destination_mapping"]["id"] == new_alamein.id

            applied = client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["destination"], "override_conflict": True},
            )
            assert applied.status_code == 200
            db.refresh(venue)
            assert venue.destination_id == new_alamein.id
        finally:
            if mapping_id:
                db.query(ExternalDestinationMapping).filter(ExternalDestinationMapping.id == mapping_id).delete()
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_unknown_destination_still_fails_safely(self, client, db, make_venue):
        venue = make_venue()
        record = ExternalRecord(
            source="isahel",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_destination="Nowhere On Earth",
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["destination"], "override_conflict": True},
            )
            assert response.status_code == 422
            assert response.json()["detail"]["error"] == "unresolvable_destination"
            db.refresh(venue)
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_original_external_value_is_preserved(self, client, db, make_venue, make_destination):
        new_alamein = make_destination(name="New Alamein")
        venue = make_venue()
        record = ExternalRecord(
            source="isahel",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_destination="El Alamein",
            raw_row={"destination": "El Alamein"},
        )
        db.add(record)
        db.commit()
        mapping_id = None
        try:
            created = client.post(
                "/editor/external-destination-mappings",
                json={"source": "isahel", "external_destination": "El Alamein", "studio_destination_id": new_alamein.id},
            )
            mapping_id = created.json()["id"]

            client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["destination"], "override_conflict": True},
            )

            db.refresh(record)
            assert record.external_destination == "El Alamein"
            assert record.raw_row["destination"] == "El Alamein"
        finally:
            if mapping_id:
                db.query(ExternalDestinationMapping).filter(ExternalDestinationMapping.id == mapping_id).delete()
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_no_unrelated_destination_selected_by_similarity(self, client, db, make_venue, make_destination):
        """"Marina" and "Marina El Alamein" are textually similar but
        must never be silently conflated — with no mapping and no exact
        name match, Apply must block, not pick the closest-looking one."""
        make_destination(name="Marina")
        venue = make_venue()
        record = ExternalRecord(
            source="isahel",
            external_name=venue.name,
            matched_venue_id=venue.id,
            external_destination="Marina El Alamein",
        )
        db.add(record)
        db.commit()
        try:
            response = client.post(
                f"/editor/external-records/{record.id}/apply",
                json={"fields": ["destination"], "override_conflict": True},
            )
            assert response.status_code == 422
            db.refresh(venue)
            assert venue.destination.name != "Marina"
        finally:
            db.query(ExternalRecord).filter(ExternalRecord.id == record.id).delete()
            db.commit()

    def test_duplicate_mapping_rejected(self, client, db, make_destination):
        destination = make_destination(name="Somewhere")
        mapping = ExternalDestinationMapping(
            source="isahel", external_destination="Someplace", studio_destination_id=destination.id
        )
        db.add(mapping)
        db.commit()
        try:
            response = client.post(
                "/editor/external-destination-mappings",
                json={"source": "isahel", "external_destination": "Someplace", "studio_destination_id": destination.id},
            )
            assert response.status_code == 409
            assert response.json()["detail"]["error"] == "mapping_already_exists"
        finally:
            db.query(ExternalDestinationMapping).filter(ExternalDestinationMapping.id == mapping.id).delete()
            db.commit()

    def test_delete_mapping(self, client, db, make_destination):
        destination = make_destination()
        mapping = ExternalDestinationMapping(
            source="isahel", external_destination="Some Place", studio_destination_id=destination.id
        )
        db.add(mapping)
        db.commit()
        response = client.delete(f"/editor/external-destination-mappings/{mapping.id}")
        assert response.status_code == 204
        db.expunge(mapping)
        assert db.get(ExternalDestinationMapping, mapping.id) is None
