"""Shared test fixtures.

These tests run against a **disposable Postgres** chosen by
`TEST_DATABASE_URL` and validated by `tests/database_guard.py`, which the
root `api/conftest.py` invokes before this module's `from app...` imports
build the engine. They previously ran against the shared Supabase project;
that caused a production incident (publish metadata rewritten on hundreds
of live rows, and the public API left with no current revision), and the
guard now makes it impossible. See docs/TESTING.md.

A real Postgres is still required — not SQLite — because the models use
Postgres-specific types (JSONB, ARRAY, partial indexes) that SQLite
couldn't faithfully exercise.

The conventions below still apply *within* a run, so the same local
database can be reused across runs without a reset:

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
- Sprint 22 protects every mutation route behind `get_current_user`; Sprint
  23 moved that to a router-level gate covering reads too; Sprint 24 adds
  `require_permission(...)` on top of it. Rather than mint real Supabase
  tokens for every test, `_authenticated_by_default` (autouse) overrides
  `get_current_user` with a fixed test identity that holds `admin` — the
  role with every permission — so existing tests keep exercising route
  *behavior*, not the auth/permission gates. `test_auth.py` and
  `test_permissions.py` clear the override to test those gates themselves.

Because state is shared (not a fresh database per test), tests in this
suite must run serially, not with a parallel runner like pytest-xdist —
see docs/TESTING.md.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.auth.dependencies import CurrentUser, get_current_user
from app.db.models import ActivityLogEntry, AppUser, Destination, PublishRevision, Venue
from app.db.session import SessionLocal
from app.main import app

SEED_VENUE_ID = "v00001"
SEED_DESTINATION_ID = "marassi"

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_EMAIL = "test-editor@example.com"
TEST_USER_ROLE = "admin"


@pytest.fixture(autouse=True)
def _authenticated_by_default():
    """Every test is "logged in" as this fixed `admin` user unless it
    explicitly clears the override (see `test_auth.py`/`test_permissions.py`)
    — keeps the rest of the suite focused on route behavior, not on
    reproducing Supabase's token format or provisioning a role for every
    test that happens to call a protected route.
    """
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def as_role():
    """Overrides `get_current_user` with the standard test identity but a
    given role, for one test — same technique `test_media.py`/
    `test_permissions.py` each already define locally; shared here now
    that a third test file (Sprint 29) needs it too.
    """

    def _set(role: str) -> None:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=TEST_USER_ID, email=TEST_USER_EMAIL, role=role
        )

    yield _set

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email=TEST_USER_EMAIL, role=TEST_USER_ROLE
    )


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
            # Must be one of ck_destinations_region's 8 legal values
            # (PLATFORM_SPEC_v1.0_FROZEN.md §7.3) — arbitrary free text is
            # no longer accepted here.
            region=overrides.pop("region", "Marina"),
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
def make_app_user(db):
    """Factory for a test-isolated `app_users` row — same shape as
    `make_destination`/`make_venue`. Used only by real-JWT tests that need
    a specific role already provisioned (e.g. to test a `publisher`-only
    action), or that want to assert on the auto-provisioning path itself
    without leaking a row into the shared dev database afterward.
    """
    created_ids: list[str] = []

    def _make(**overrides) -> AppUser:
        user_id = overrides.pop("id", f"test-user-{uuid.uuid4().hex[:8]}")
        app_user = AppUser(
            id=user_id,
            email=overrides.pop("email", None),
            role=overrides.pop("role", "viewer"),
            **overrides,
        )
        db.add(app_user)
        db.commit()
        created_ids.append(user_id)
        return app_user

    yield _make

    for user_id in created_ids:
        db.query(AppUser).filter(AppUser.id == user_id).delete()
    db.commit()


@pytest.fixture()
def preserve_seed_state(db):
    """`publish()`/`republish()` operate on the whole dataset, so a test
    that calls either will incidentally stamp `last_published_at` on the
    real Sprint 4 seed row (it's `approved`, same as any test fixture).
    This snapshots and restores it, so the suite never leaves the
    database in a different state than it found it. Retained after the
    move to a disposable test database: a local database is still reused
    across runs, and both lookups below already tolerate the seed rows
    being absent entirely.
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

    Fix C — the watermark delete alone was not a complete undo. `publish()`
    does two things: it flips whatever revision is currently
    `is_current=True` to `False`, *and* it inserts a new current one.
    Deleting the new row undid only the second half, leaving the database
    with **zero** current revisions — which makes `get_current_revision()`
    return `None` and every `/public/*` route serve nothing. That is
    exactly the state the production incident left behind. So the pointer
    is now snapshotted alongside the watermarks and restored here.

    Order matters on the way back: the partial unique index
    `uq_publish_revisions_is_current` permits only one `True` row, so any
    other current revision is cleared *before* the original is restored.
    """
    revision_watermark = db.query(func.max(PublishRevision.id)).scalar() or 0
    activity_watermark = db.query(func.max(ActivityLogEntry.id)).scalar() or 0
    # `None` when nothing was published yet (e.g. a fresh CI database) —
    # there is then no pointer to restore, and the code below no-ops.
    current_revision_id = (
        db.query(PublishRevision.id).filter(PublishRevision.is_current.is_(True)).scalar()
    )

    yield

    db.query(PublishRevision).filter(PublishRevision.id > revision_watermark).delete()
    db.query(ActivityLogEntry).filter(ActivityLogEntry.id > activity_watermark).delete()

    if current_revision_id is not None:
        # Safe against the unique index: this can only ever match a
        # revision the test itself made current and that survived the
        # delete above (i.e. a `republish` of an older revision).
        db.query(PublishRevision).filter(
            PublishRevision.is_current.is_(True),
            PublishRevision.id != current_revision_id,
        ).update({"is_current": False}, synchronize_session=False)
        db.query(PublishRevision).filter(PublishRevision.id == current_revision_id).update(
            {"is_current": True}, synchronize_session=False
        )

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
