from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    BigInteger,
    Identity,
    Index,
    Integer,
    Numeric,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Shared by destinations and venues alike — see docs/DATABASE.md's "Editorial
# status" decision: this is deliberately one vocabulary, not two that happen
# to match today. Keeping a single constant makes that impossible to miss.
CONTENT_STATUSES = ("draft", "review", "approved", "archived")
VENUE_CATEGORIES = (
    "Restaurant",
    "Cafe",
    "Hotel",
    "Beach",
    "Nightlife",
    "Shopping",
    "Services",
    "Entertainment",
    "Other",
    "Resort",
    "Spa",
    "Beach Club",
    "Activity",
)

# PLATFORM_SPEC_v1.0_FROZEN.md §7.3 — a small, fixed, closed set, same
# CHECK-constraint treatment as VENUE_CATEGORIES/CONTENT_STATUSES above.
# Promote to a table only past the same trigger already named for
# VENUE_CATEGORIES: >20 values, or per-value metadata becomes a real
# requirement.
DESTINATION_REGIONS = (
    "Sidi Abdelrahman Area",
    "Marina",
    "New Alamein City",
    "Telal North Coast",
    "Ras El Hekma",
    "Fouka Bay",
    "Dabaa City",
    "Almaza Bay",
)

# Sprint 24 — a small, fixed, closed set, same reasoning as CONTENT_STATUSES/
# VENUE_CATEGORIES above: the role vocabulary is product-defined and rarely
# changing, so it's a CHECK-constrained text column, not a lookup table.
APP_USER_ROLES = ("viewer", "editor", "publisher", "admin")

# Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — a
# small, fixed, closed set cutting across every category (a QR-gated
# restaurant is exactly as valid as a QR-gated beach), same CHECK-constraint
# treatment as VENUE_CATEGORIES/CONTENT_STATUSES. Deliberately plain text
# values matching VENUE_CATEGORIES' own "Title Case, human-readable, no
# label-mapping layer needed" convention, not snake_case codes.
ACCESS_TYPES = (
    "Public",
    "Paid Entry",
    "QR Required",
    "Residents Only",
    "Hotel Guests Only",
)
RESERVATION_POLICIES = ("Required", "Recommended")


class Destination(Base):
    """A named compound/resort/development along the North Coast."""

    __tablename__ = "destinations"
    __table_args__ = (
        CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_destinations_status"),
        CheckConstraint(f"region IN {DESTINATION_REGIONS}", name="ck_destinations_region"),
        # PLATFORM_SPEC_v1.0_FROZEN.md §3.1 — workflow queries; the
        # destination side of the referential-closure publish join.
        Index("ix_destinations_status", "status"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    region: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    aliases: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    boundary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Sprint 29 — cover only, no gallery (explicitly out of scope). Same
    # column shape as venues.cover_image_url.
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # PLATFORM_SPEC_v1.0_FROZEN.md §5.1 — {"<locale>": {"name": ..., ...}}.
    # `name` remains the required, canonical, fallback value; see §5.2.
    translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # §4.2 — optimistic-concurrency version, paired with the ETag/If-Match
    # protocol §4.3 specifies. Incremented by the application on every
    # successful update, never set directly by a client.
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    venues: Mapped[list["Venue"]] = relationship(back_populates="destination")


class Venue(Base):
    """A specific place (restaurant, hotel, shop, activity, beach...) within a destination."""

    __tablename__ = "venues"
    __table_args__ = (
        CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_venues_status"),
        CheckConstraint(f"category IN {VENUE_CATEGORIES}", name="ck_venues_category"),
        UniqueConstraint("destination_id", "slug", name="uq_venues_destination_id_slug"),
        # PLATFORM_SPEC_v1.0_FROZEN.md §7.8 — key-presence only; deep
        # value-shape validation (e.g. publicAccess's 3-value enum) remains
        # the application layer's job, the same practical limit that
        # already applies to opening_hours.
        CheckConstraint(
            "beach_details IS NULL OR "
            "(category = 'Beach' AND beach_details ? 'type' AND beach_details ? 'publicAccess')",
            name="ck_venues_beach_details_shape",
        ),
        # Category/Tags/Access Type/Badges/Collections architecture (Phase 1)
        # — both independent of category, unlike beach_details above; a
        # paid-entry restaurant or a QR-gated nightlife venue are exactly as
        # valid as a QR-gated beach. See ACCESS_TYPES/RESERVATION_POLICIES.
        CheckConstraint(f"access_type IS NULL OR access_type IN {ACCESS_TYPES}", name="ck_venues_access_type"),
        CheckConstraint(
            f"reservation_policy IS NULL OR reservation_policy IN {RESERVATION_POLICIES}",
            name="ck_venues_reservation_policy",
        ),
        # PLATFORM_SPEC_v1.0_FROZEN.md §3.1 — destination-scoped venue
        # lists and FK join performance; category/status filters; the
        # composite serves the referential-closure publish query directly
        # ("approved venues for an approved destination").
        Index("ix_venues_destination_id", "destination_id"),
        Index("ix_venues_category", "category"),
        Index("ix_venues_status", "status"),
        Index("ix_venues_destination_id_status", "destination_id", "status"),
        Index("ix_venues_brand", "brand"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    destination_id: Mapped[str] = mapped_column(
        ForeignKey("destinations.id", ondelete="RESTRICT"), nullable=False
    )
    destination: Mapped["Destination"] = relationship(back_populates="venues")
    district: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    is_featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    maps_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    instagram_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    facebook_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    gallery_image_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    opening_hours: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # `none_as_null=True` — SQLAlchemy's JSONB otherwise binds a Python
    # `None` as the JSON `null` literal, not SQL NULL. That distinction is
    # invisible for every other JSONB column here, but ck_venues_beach_
    # details_shape's `beach_details IS NULL OR ...` specifically checks
    # for SQL NULL — without this flag, ordinary application code clearing
    # the field (e.g. switching a venue's category away from 'Beach') would
    # store JSON null and spuriously fail the constraint.
    beach_details: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True), nullable=True)
    # Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
    # a single venue-level property, not nested inside beach_details (that
    # JSONB column stays Beach-only and is kept temporarily for backward
    # compatibility; publicAccess is a narrower 3-value yes/no/unknown
    # concept, not the same thing as this 5-value Access Type). Reservation
    # Policy is informational/badge-only, never a filter (see Badges in the
    # architecture doc) — stored here rather than a lookup table for the
    # same "small, fixed, closed set" reasoning ACCESS_TYPES itself uses.
    access_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    reservation_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Brand Asset Propagation — free text, not a CHECK-constrained
    # vocabulary or a lookup table (see 0011_venue_brand.py's docstring for
    # why). Never inferred from `name`; only ever set explicitly by an
    # editor. Two venues are "the same brand" purely by this value
    # matching exactly (case-sensitive) — no fuzzy/normalized matching.
    brand: Mapped[str | None] = mapped_column(Text, nullable=True)
    # PLATFORM_SPEC_v1.0_FROZEN.md §5.1 — see Destination.translations above.
    translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # PLATFORM_SPEC_v1_FINAL.md §2.2 (Venue, Legacy-only) — preserves the
    # legacy geo-review object (status, reviewer, timestamp, history)
    # verbatim at migration time. Opaque: never validated or interpreted
    # by the platform, never part of any editing surface, not API-exposed.
    # Drop-eligible per PLATFORM_SPEC_v1.0_FROZEN.md §7.13's
    # pre-authorized condition, not before.
    legacy_geo: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # §4.2 — see Destination.version above.
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Tag(Base):
    """Category-scoped venue-characteristic vocabulary (Restaurant's
    'Seafood', Coffee's 'Specialty Coffee', ...) — the Tags layer of the
    Category -> Tags -> Access Type -> Badges -> Collections architecture.
    Deliberately a real table, not a CHECK-constrained string like
    VENUE_CATEGORIES: tags are expected to grow, and adding one must never
    require a migration (a data INSERT instead). Studio has no tag CRUD UI
    in Phase 1 (rows are seeded once, in migration 0014) — editors can only
    assign existing tags to venues; CRUD is future work if needed.

    `category` scopes a tag to the one venue category it applies to (a
    Restaurant tag should never be assignable to a Coffee venue) — both the
    DB CHECK constraint and the API's assignment validator enforce this, not
    just the Studio picker UI hiding the option.
    """

    __tablename__ = "tags"
    __table_args__ = (
        CheckConstraint(f"category IN {VENUE_CATEGORIES}", name="ck_tags_category"),
        UniqueConstraint("slug", name="uq_tags_slug"),
        Index("ix_tags_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class VenueTag(Base):
    """The venue<->tag many-to-many join. No payload columns of its own —
    membership is the only fact this table records. Multi-tag filtering
    (see app/api/routes/search.py) uses OR semantics — a venue matches if
    it carries *any* of the requested tags, not all of them.
    """

    __tablename__ = "venue_tags"
    __table_args__ = (Index("ix_venue_tags_tag_id", "tag_id"),)

    venue_id: Mapped[str] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="RESTRICT"), primary_key=True)


class Collection(Base):
    """A curated, cross-category grouping of venues (e.g. "Editor's
    Choice", "Best Sunset") — the Collections layer of the architecture.
    Deliberately distinct from both Category (structural, one per venue,
    stable) and Tags (category-scoped, objective characteristics):
    Collections are editorial curation, can span every category, and are
    explicitly ordered (see CollectionVenue.sort_order below). Unlike Tags,
    Collections are expected to get real Studio CRUD eventually (they're
    editorial content, not a fixed vocabulary) — just not in Phase 1
    (assignment-only per the approved plan); this shape doesn't need to
    change when that lands.

    "No QR" is deliberately NOT a row here — it's a computed discovery
    query (every venue whose access_type isn't 'QR Required'), never
    persisted, never assigned to. See app/api/routes/public.py.
    """

    __tablename__ = "collections"
    __table_args__ = (UniqueConstraint("slug", name="uq_collections_slug"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CollectionVenue(Base):
    """The collection<->venue many-to-many join. Unlike `VenueTag`, this
    one carries a real payload column (`sort_order`): collection membership
    is editorially ordered (a curated list has a deliberate sequence),
    unlike tag membership, which is an unordered set.
    """

    __tablename__ = "collection_venues"
    __table_args__ = (Index("ix_collection_venues_venue_id", "venue_id"),)

    collection_id: Mapped[str] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    venue_id: Mapped[str] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class Event(Base):
    """Events Module v1. Same shape as `Venue`/`Destination`: `status`
    shares `CONTENT_STATUSES` (one vocabulary, not a new one per entity —
    see that constant's own docstring), `version` is the same optimistic-
    concurrency column, cover-only media (no gallery — events don't need
    one for v1).

    `venue_id`/`destination_id` are both nullable and `ON DELETE SET
    NULL` — an event may stand alone, or reference either (or both), but
    neither reference is required, and deleting the venue/destination
    must never be blocked by an event pointing at it (unlike
    `Venue.destination_id`, which is a real ownership relationship).

    Upcoming/Live/Ended is deliberately not a stored column — it's fully
    derived from `start_date`/`end_date`/`start_time`/`end_time` at read
    time (see `app/domain/event_timing.py`), so it's never stale and
    never needs a background job to keep it correct.

    Deliberately excluded from v1 (see docs — Events Module v1 scope):
    recurring-event fields, artist fields, ticket-sync/automation fields,
    pricing fields, festival fields. Every one of these is additive later
    (a new nullable column or a new child table) — none require changing
    what's here.
    """

    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_events_status"),
        UniqueConstraint("slug", name="uq_events_slug"),
        # 0013_events_require_location.py — each of venue_id/destination_id
        # stays individually nullable, but at least one must be set; an
        # event with neither has no location at all, which isn't a valid
        # state to publish or display.
        CheckConstraint(
            "venue_id IS NOT NULL OR destination_id IS NOT NULL", name="ck_events_has_location"
        ),
        Index("ix_events_status", "status"),
        Index("ix_events_venue_id", "venue_id"),
        Index("ix_events_destination_id", "destination_id"),
        Index("ix_events_featured", "featured"),
        Index("ix_events_start_date", "start_date"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Nullable — a single-day event has no end_date; a multi-day event
    # (still not "festival support," just two dates on one row) sets it.
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue_id: Mapped[str | None] = mapped_column(
        ForeignKey("venues.id", ondelete="SET NULL"), nullable=True
    )
    venue: Mapped["Venue | None"] = relationship()
    destination_id: Mapped[str | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL"), nullable=True
    )
    destination: Mapped["Destination | None"] = relationship()
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # Ticketing — intentionally the simplest possible shape (three plain
    # columns, no provider table, no sync engine). `ticket_provider` is
    # free text, not a CHECK-constrained vocabulary: unlike
    # VENUE_CATEGORIES/CONTENT_STATUSES, there's no known-closed set of
    # providers today — same reasoning `Venue.brand` already gives for why
    # an open-ended value stays plain text instead of an enum.
    ticket_provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    ticket_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free text id from whatever ticket_provider issued it — opaque to
    # this platform, never parsed or validated, just stored for whenever
    # a future lookup/sync feature (out of v1 scope) needs to match back.
    external_event_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PublishRevision(Base):
    """An immutable, whole-dataset snapshot created each time content is published."""

    __tablename__ = "publish_revisions"
    __table_args__ = (
        Index(
            "uq_publish_revisions_is_current",
            "is_current",
            unique=True,
            postgresql_where=text("is_current"),
        ),
        # PLATFORM_SPEC_v1.0_FROZEN.md §3.1 — revision-history list
        # ordering (newest first). A plain ascending B-tree index also
        # serves `ORDER BY published_at DESC` via a backward index scan —
        # no separate descending index needed in Postgres.
        Index("ix_publish_revisions_published_at", "published_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    destination_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    venue_count: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ActivityLogEntry(Base):
    """A single recorded editorial action — Submit for Review, Approve,
    Publish, Republish, and any future workflow/publishing action. Purely
    an observability record: nothing in the codebase ever reads this table
    to decide behavior, and nothing here ever mutates `destinations`,
    `venues`, or `publish_revisions`. See app/activity/service.py for the
    one function that ever inserts a row here.
    """

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'system'"))
    # Python attribute deliberately not named `metadata` — that name is
    # reserved on every declarative model (it's `Base.metadata`, the
    # schema's MetaData instance). Mapped to the actual DB/JSON field name
    # "metadata" via the explicit column-name argument below.
    activity_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)


class AppUser(Base):
    """Sprint 24 — the one fact this application tracks about an
    authenticated identity beyond what Supabase already verifies: what
    role they hold here. Deliberately not named `users` — this table
    answers exactly one question (role), not a general user-profile
    concern. No relationship to `destinations`/`venues`/`publish_revisions`
    and no foreign key in or out: `id` is a Supabase auth user's UUID, an
    identity that lives outside this database, same reasoning
    `publish_revisions` already uses for having none. `email` is
    denormalized display data only — Supabase remains the source of truth
    for identity, this column is never read to make an authorization
    decision.
    """

    __tablename__ = "app_users"
    __table_args__ = (
        CheckConstraint(f"role IN {APP_USER_ROLES}", name="ck_app_users_role"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
