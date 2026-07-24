"""Shared test fixtures.

These tests run against the same Supabase Postgres database used for
manual development verification (see docs/TESTING.md for why — no local
Postgres/Docker is available in this environment, and the app's models use
Postgres-specific types (JSONB, ARRAY, partial indexes) that a SQLite
in-memory substitute couldn't faithfully exercise). Isolation is achieved
by convention instead of by a separate database:

- Every entity this suite creates uses a `test-`-prefixed id, so it can
  never collide with the real Sprint 4 seed data (`v00001`, `marassi`).
- Factory fixtures (`make_destination`, `make_venue`) track everything
  they create and delete it in teardown, regardless of test outcome.
- `publish()`/`republish()` are whole-dataset operations that will
  incidentally touch the real seed row's `last_published_at` — the
  `preserve_seed_state` fixture snapshots and restores it.
- `publish_revisions`/`activity_log` are global, append-only tables with
  no per-test owner; `_clean_global_tables` (autouse) waterlines their max
  id before each test and deletes anything created above it after.

Because state is shared (not a fresh database per test), tests in this
suite must run serially, not with a parallel runner like pytest-xdist —
see docs/TESTING.md.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.db.models import ActivityLogEntry, Destination, PublishRevision, Venue
from app.db.session import SessionLocal
from app.main import app

SEED_VENUE_ID = "v00001"
SEED_DESTINATION_ID = "marassi"


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def make_destination(db):
    """Factory for a test-isolated Destination. Call it with any column
    overrides; everything it creates is deleted in teardown. The pattern
    here (a factory closure that tracks and cleans up its own ids) is
    deliberately generic — a future `make_something_else` fixture for a
    new entity would follow the same shape.
    """
    created_ids: list[str] = []

    def _make(**overrides) -> Destination:
        destination_id = overrides.pop("id", f"test-dest-{uuid.uuid4().hex[:8]}")
        destination = Destination(
            id=destination_id,
            name=overrides.pop("name", "Test Destination"),
            region=overrides.pop("region", "Test Region"),
            status=overrides.pop("status", "approved"),
            **overrides,
        )
        db.add(destination)
        db.commit()
        created_ids.append(destination_id)
        return destination

    yield _make

    for destination_id in created_ids:
        db.query(Venue).filter(Venue.destination_id == destination_id).delete()
        db.query(Destination).filter(Destination.id == destination_id).delete()
    db.commit()


@pytest.fixture()
def make_venue(db, make_destination):
    """Factory for a test-isolated Venue. Defaults to `status='draft'` in
    a fresh test destination unless overridden — pass `destination=` to
    attach it to a specific one (e.g. the same destination as another
    venue in the same test).
    """
    created_ids: list[str] = []

    def _make(**overrides) -> Venue:
        destination = overrides.pop("destination", None) or make_destination()
        venue_id = overrides.pop("id", f"test-v-{uuid.uuid4().hex[:8]}")
        venue = Venue(
            id=venue_id,
            name=overrides.pop("name", "Test Venue"),
            slug=overrides.pop("slug", f"test-venue-{venue_id}"),
            destination_id=destination.id,
            category=overrides.pop("category", "Restaurant"),
            status=overrides.pop("status", "draft"),
            is_featured=overrides.pop("is_featured", False),
            is_verified=overrides.pop("is_verified", False),
            **overrides,
        )
        db.add(venue)
        db.commit()
        created_ids.append(venue_id)
        return venue

    yield _make

    for venue_id in created_ids:
        db.query(Venue).filter(Venue.id == venue_id).delete()
    db.commit()


@pytest.fixture()
def preserve_seed_state(db):
    """`publish()`/`republish()` operate on the whole dataset, so a test
    that calls either will incidentally stamp `last_published_at` on the
    real Sprint 4 seed row (it's `approved`, same as any test fixture).
    This snapshots and restores it, so the suite never leaves the shared
    dev database in a different state than it found it.
    """
    seed_venue = db.get(Venue, SEED_VENUE_ID)
    seed_destination = db.get(Destination, SEED_DESTINATION_ID)
    venue_last_published_at = seed_venue.last_published_at if seed_venue else None
    destination_last_published_at = seed_destination.last_published_at if seed_destination else None

    yield

    if seed_venue is not None:
        db.refresh(seed_venue)
        seed_venue.last_published_at = venue_last_published_at
    if seed_destination is not None:
        db.refresh(seed_destination)
        seed_destination.last_published_at = destination_last_published_at
    db.commit()


@pytest.fixture(autouse=True)
def _clean_global_tables(db):
    """Safety net for the two tables no single-entity fixture owns:
    `publish_revisions` and `activity_log`. Both are global and
    append-only, so no per-venue/destination teardown ever touches them —
    this waterlines their max id before every test and deletes anything
    created above it after, regardless of which test it was.
    """
    revision_watermark = db.query(func.max(PublishRevision.id)).scalar() or 0
    activity_watermark = db.query(func.max(ActivityLogEntry.id)).scalar() or 0

    yield

    db.query(PublishRevision).filter(PublishRevision.id > revision_watermark).delete()
    db.query(ActivityLogEntry).filter(ActivityLogEntry.id > activity_watermark).delete()
    db.commit()


def latest_activity(db, *, entity_type: str, entity_id: str, action: str | None = None):
    """Test helper, not a fixture — the most recent activity_log row for a
    given entity, optionally filtered by action."""
    query = db.query(ActivityLogEntry).filter(
        ActivityLogEntry.entity_type == entity_type,
        ActivityLogEntry.entity_id == entity_id,
    )
    if action is not None:
        query = query.filter(ActivityLogEntry.action == action)
    return query.order_by(ActivityLogEntry.id.desc()).first()
