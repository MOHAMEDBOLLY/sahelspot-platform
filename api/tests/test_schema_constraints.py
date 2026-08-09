"""Phase 1 (Schema & Database) — direct tests for every constraint, column,
and index PLATFORM_SPEC_v1.0_FROZEN.md requires. Each test corresponds to
one acceptance criterion in docs/IMPLEMENTATION_BACKLOG.md's EP1-EP7.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.models import VENUE_CATEGORIES, Destination, Venue


class TestCategoryTaxonomy:
    """EP1 — venues.category accepts exactly the frozen spec's 13 values."""

    def test_all_13_values_are_legal(self):
        assert len(VENUE_CATEGORIES) == 13

    def test_every_category_value_is_insertable(self, db, make_destination):
        destination = make_destination()
        for category in VENUE_CATEGORIES:
            tag = uuid.uuid4().hex[:8]
            venue = Venue(
                id=f"test-v-cat-{tag}",
                name="Category Test",
                slug=f"test-cat-{tag}",
                destination_id=destination.id,
                category=category,
                status="draft",
            )
            db.add(venue)
            db.commit()
            db.delete(venue)
            db.commit()

    def test_a_value_outside_the_13_is_rejected(self, db, make_destination):
        destination = make_destination()
        venue = Venue(
            id="test-v-bad-category",
            name="Bad Category",
            slug="test-bad-category",
            destination_id=destination.id,
            category="Not A Real Category",
            status="draft",
        )
        db.add(venue)
        try:
            with pytest.raises(IntegrityError):
                db.commit()
        finally:
            db.rollback()


class TestRegionEnforcement:
    """EP2 — destinations.region accepts exactly the frozen spec's 8 values."""

    def test_every_region_value_is_insertable(self, db, make_destination):
        for region in (
            "Sidi Abdelrahman Area",
            "Marina",
            "New Alamein City",
            "Telal North Coast",
            "Ras El Hekma",
            "Fouka Bay",
            "Dabaa City",
            "Almaza Bay",
        ):
            destination = make_destination(region=region)
            assert destination.region == region

    def test_a_value_outside_the_8_is_rejected(self, db):
        destination = Destination(
            id="test-dest-bad-region",
            name="Bad Region",
            region="Not A Real Region",
            status="draft",
        )
        db.add(destination)
        try:
            with pytest.raises(IntegrityError):
                db.commit()
        finally:
            db.rollback()


class TestConcurrencyVersionColumn:
    """EP3 — venues/destinations.version defaults to 1."""

    def test_venue_version_defaults_to_one(self, make_venue):
        assert make_venue().version == 1

    def test_destination_version_defaults_to_one(self, make_destination):
        assert make_destination().version == 1


class TestTranslationsColumn:
    """EP4 — venues/destinations.translations round-trips JSONB verbatim."""

    def test_venue_translations_round_trip(self, db, make_venue):
        venue = make_venue()
        venue.translations = {"ar": {"name": "أبراج العلمين الجديدة"}}
        db.commit()
        db.refresh(venue)
        assert venue.translations == {"ar": {"name": "أبراج العلمين الجديدة"}}

    def test_destination_translations_round_trip(self, db, make_destination):
        destination = make_destination()
        destination.translations = {"ar": {"name": "مارينا"}}
        db.commit()
        db.refresh(destination)
        assert destination.translations == {"ar": {"name": "مارينا"}}

    def test_venue_legacy_geo_round_trips_verbatim(self, db, make_venue):
        """The one Phase 1 gap correction: legacy_geo (§2.2/§7.13), added
        to this migration alongside translations after being found absent
        from the original Phase 1 backlog scope."""
        venue = make_venue()
        legacy_geo = {"status": "inside", "reviewed": True, "reviewedBy": "datalab-review"}
        venue.legacy_geo = legacy_geo
        db.commit()
        db.refresh(venue)
        assert venue.legacy_geo == legacy_geo


class TestBeachDetailsShape:
    """EP5 — beach_details' key-presence CHECK, per §7.8."""

    def test_beach_with_both_keys_is_accepted(self, make_venue):
        venue = make_venue(
            category="Beach Club", beach_details={"type": None, "publicAccess": "yes"}
        )
        assert venue.beach_details == {"type": None, "publicAccess": "yes"}

    def test_non_beach_with_null_details_is_accepted(self, make_venue):
        venue = make_venue(category="Restaurant", beach_details=None)
        assert venue.beach_details is None

    def test_beach_missing_a_key_is_rejected(self, db, make_destination):
        destination = make_destination()
        venue = Venue(
            id="test-v-beach-missing-key",
            name="Incomplete Beach",
            slug="test-beach-missing-key",
            destination_id=destination.id,
            category="Beach Club",
            status="draft",
            beach_details={"type": None},
        )
        db.add(venue)
        try:
            with pytest.raises(IntegrityError):
                db.commit()
        finally:
            db.rollback()

    def test_non_beach_with_populated_details_is_rejected(self, db, make_destination):
        destination = make_destination()
        venue = Venue(
            id="test-v-nonbeach-populated",
            name="Not A Beach",
            slug="test-nonbeach-populated",
            destination_id=destination.id,
            category="Restaurant",
            status="draft",
            beach_details={"type": None, "publicAccess": "yes"},
        )
        db.add(venue)
        try:
            with pytest.raises(IntegrityError):
                db.commit()
        finally:
            db.rollback()


class TestRequiredIndexes:
    """EP7 — every index PLATFORM_SPEC_v1.0_FROZEN.md §3.1 names actually
    exists (existence, not query-plan behavior — plan verification is a
    deployment-time check per docs/IMPLEMENTATION_BACKLOG.md's EP35)."""

    def test_every_named_index_exists(self, db):
        rows = db.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename IN ('venues', 'destinations', 'publish_revisions')"
            )
        ).fetchall()
        existing = {r[0] for r in rows}
        for expected in (
            "ix_venues_destination_id",
            "ix_venues_category",
            "ix_venues_status",
            "ix_venues_destination_id_status",
            "ix_destinations_status",
            "ix_publish_revisions_published_at",
            "ix_venues_name_trgm",
        ):
            assert expected in existing, f"missing index: {expected}"

    def test_pg_trgm_extension_is_enabled(self, db):
        rows = db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'")).fetchall()
        assert len(rows) == 1
