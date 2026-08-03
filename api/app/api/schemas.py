from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.validation.schemas import ValidationResult


class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    region: str
    status: str
    aliases: list[str] | None = None
    boundary: dict | None = None
    notes: str | None = None
    cover_image_url: str | None = None
    translations: dict | None = None
    version: int
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DestinationListOut(BaseModel):
    """Sprint 29 — mirrors `VenueListOut` exactly: `GET /destinations` gains
    search + pagination, so the bare list response needs `total` too."""

    items: list[DestinationOut]
    total: int
    page: int
    page_size: int


class DestinationCreate(BaseModel):
    """Sprint 29 — the one field venues never needed an equivalent of:
    `id`. Destinations' primary key *is* the slug (see docs/DATABASE.md's
    Sprint 2.5 "Primary keys" decision) — there's no surrogate id to
    generate, so the caller supplies it directly, the same way it already
    exists as a plain, unelevated PK column. `status` isn't accepted here;
    every new destination starts `draft`, the same as how a row would
    begin its life in any of this schema's other editorial tables.

    Sprint 31 — `min_length`/`max_length` on the required fields: blank
    names/regions were previously accepted and persisted as-is; the caps
    just guard against an accidentally-pasted wall of text, not a real
    content limit.
    """

    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    region: str = Field(min_length=1, max_length=200)
    aliases: list[str] | None = None
    notes: str | None = Field(default=None, max_length=2000)


class DestinationUpdate(BaseModel):
    """Save Draft payload — same shape/intent as `VenueUpdate`: only the
    fields Edit Mode exposes as editable. `id`, `status`, `boundary`
    (a geometry blob with no editor built yet), and timestamps are
    structural or workflow-controlled and aren't part of this write path,
    exactly the same reasoning `VenueUpdate` already documents.

    `cover_image_url` (Sprint 29) is here only so clearing the cover can go
    through this same partial-update path — same reasoning `VenueUpdate`
    already gives for its own `cover_image_url`/`gallery_image_urls`.

    Sprint 31 — `name`/`region` get the same `min_length`/`max_length` caps
    as `DestinationCreate`, applied only when the field is actually sent
    (still optional/partial-update — `None` means "don't touch this field",
    unaffected by the length constraint).
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    region: str | None = Field(default=None, min_length=1, max_length=200)
    aliases: list[str] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    # PLATFORM_SPEC_v1.0_FROZEN.md §5 — i18n via a `translations` JSONB
    # column (EP4-T02), already readable on `DestinationOut` but missing
    # here as a writable field since Phase 2 added this schema — the one
    # write path this column never had until EP23.
    translations: dict | None = None
    cover_image_url: str | None = None
    # PLATFORM_SPEC_v1.0_FROZEN.md §7.3 — boundary is now writable through
    # this same path; shape-validated in the route (Polygon/MultiPolygon),
    # not here, since Pydantic's job is presence/type, not GeoJSON geometry
    # rules.
    boundary: dict | None = None


class DestinationRef(BaseModel):
    """A lightweight, resolved reference to a destination — id + display name only.
    Used when a venue points at a destination, so the frontend never has to look up
    a name for an id itself. See DestinationOut for the full destination record.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    destination: DestinationRef
    district: str | None = None
    category: str
    status: str
    is_featured: bool
    is_verified: bool
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    maps_url: str | None = None
    instagram_handle: str | None = None
    facebook_handle: str | None = None
    tiktok_handle: str | None = None
    short_description: str | None = None
    cover_image_url: str | None = None
    gallery_image_urls: list[str] | None = None
    opening_hours: dict | None = None
    beach_details: dict | None = None
    internal_notes: str | None = None
    source: str | None = None
    brand: str | None = None
    translations: dict | None = None
    version: int
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class VenueListOut(BaseModel):
    """Sprint 27 — `GET /venues`'s response shape, once search/filter/
    pagination existed to make a bare `list[VenueOut]` insufficient (the
    caller needs `total` to know if there's more than one page). `items`
    is exactly what the bare list used to return.
    """

    items: list[VenueOut]
    total: int
    page: int
    page_size: int


class VenueUpdate(BaseModel):
    """Save Draft payload — the fields Edit Mode currently exposes as editable
    (see datalab-next Sprint 9/10 sections). Everything else on a venue
    (id, slug, destination, status, timestamps, ...) is structural or
    workflow-controlled and isn't part of this write path.

    `cover_image_url`/`gallery_image_urls` were added in Sprint 25 — not to
    let an editor paste a raw URL (the upload endpoint is the real way
    those get set), but so removing a gallery image or clearing the cover
    can go through this same partial-update path instead of a dedicated
    "remove media" endpoint.

    Sprint 31 — `name` gets a `min_length`/`max_length` cap (same reasoning
    as `DestinationUpdate`'s: a blank name was previously accepted and
    persisted via Save Draft even though `validate_venue()` would flag it
    as not review-ready). `short_description`/`internal_notes` get the same
    `max_length` caps `venueValidation.ts` already enforces client-side —
    this is the backend catching up to a limit the frontend already had,
    not a new rule.
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    district: str | None = None
    is_featured: bool | None = None
    is_verified: bool | None = None
    short_description: str | None = Field(default=None, max_length=500)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    maps_url: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    instagram_handle: str | None = None
    facebook_handle: str | None = None
    tiktok_handle: str | None = None
    internal_notes: str | None = Field(default=None, max_length=2000)
    # Brand Asset Propagation — plain free text, never inferred from
    # `name`/anything else; only ever set by an explicit editor choice.
    brand: str | None = Field(default=None, max_length=200)
    cover_image_url: str | None = None
    gallery_image_urls: list[str] | None = None
    # PLATFORM_SPEC_v1.0_FROZEN.md §5 — same `translations` write-path gap
    # as `DestinationUpdate` above: readable on `VenueOut` since Phase 1,
    # never writable until EP23.
    translations: dict | None = None
    # PLATFORM_SPEC_v1.0_FROZEN.md §6.3/§7.8 — accepted here (in addition
    # to `category`) since setting a venue's category to 'Beach' and its
    # beach_details in the same Save Draft call is the common case. Shape
    # (both keys present, valid `publicAccess`) is validated in the route,
    # against the venue's resulting category — not here, since that check
    # needs the full picture of what's being set, not just this one field.
    beach_details: dict | None = None


class VenueCreate(BaseModel):
    """PLATFORM_SPEC_v1.0_FROZEN.md §8.2 (`POST /editor/venues`) — the one
    write path venues never had. `id`/`slug` are caller-supplied, same
    reasoning `DestinationCreate` already gives for why destinations'
    primary key isn't auto-generated: these are stable, human-legible
    identifiers, not surrogate keys. `status` isn't accepted — every new
    venue starts `draft`, same as `DestinationCreate`.
    """

    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    destination_id: str
    category: str
    district: str | None = None
    beach_details: dict | None = None


class RejectRequest(BaseModel):
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.4 — Reject (`review -> draft`) now
    requires a non-blank reason, logged to `activity_log.metadata` so the
    submitting editor can see why. Shared by venues and destinations —
    same shape, same reasoning `ValidationResult`/`FieldError` already
    give for one reusable contract rather than one per entity.
    """

    reason: str = Field(min_length=1, max_length=2000)


class SetCoverImageRequest(BaseModel):
    """Sprint 26 — promotes an existing gallery image to cover, without a
    re-upload. `url` must already be one of the venue's
    `gallery_image_urls`; see `POST /venues/{id}/media/set-cover`.
    """

    url: str


class BulkVenueIdsRequest(BaseModel):
    """Sprint 28 — the request body every bulk *action* endpoint (Validate,
    Submit for Review, Approve) shares: just the target ids. Capped at 100
    per request — a sane guard rail, same reasoning as `page_size`'s cap on
    `GET /venues` (Sprint 27), not a hint that more would need a queue.
    """

    venue_ids: list[str] = Field(min_length=1, max_length=100)


class BulkUpdateRequest(BaseModel):
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.6 — replaces the two single-field
    bulk endpoints (`PATCH bulk/category`, `PATCH bulk/destination`) with
    one: a venue-id list plus whichever of `category`/`destination_id` the
    caller wants to set, either or both in the same call. At least one of
    the two must be present — validated in the route, not here, since
    "both absent" needs a structured error, not a bare Pydantic 422.
    """

    venue_ids: list[str] = Field(min_length=1, max_length=100)
    category: str | None = None
    destination_id: str | None = None


class BulkResultItem(BaseModel):
    """One row of a bulk operation's outcome. `venue`/`validation` are
    populated only for the operations that produce them (mutations return
    `venue`; Validate returns `validation`) — both `None` means the item
    failed, with `error` explaining why. This is the one shape shared by
    every bulk endpoint (Validate, Submit for Review, Approve, category
    update, destination update) rather than a bespoke response per action.
    """

    venue_id: str
    success: bool
    error: str | None = None
    venue: VenueOut | None = None
    validation: ValidationResult | None = None


class BulkOperationResponse(BaseModel):
    results: list[BulkResultItem]
    succeeded: int
    failed: int


class PublishRevisionOut(BaseModel):
    """Metadata about a publish revision — not its full snapshot. Returned
    by the Publish action itself and by the revision-history list
    (Sprint 17); a future Rollback endpoint would reuse this same shape.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_current: bool
    published_at: datetime
    published_by: str | None = None
    label: str | None = None
    destination_count: int | None = None
    venue_count: int | None = None
    # PLATFORM_SPEC_v1.0_FROZEN.md §1.3 — 0 in the overwhelmingly common
    # case; the count of venues held out of *this* snapshot because their
    # destination wasn't also `approved` at publish time (§1's
    # referential-closure guarantee). Not persisted on `PublishRevision`
    # itself — computed once at publish time and attached to the response
    # object, since it describes an event, not a stored fact about the
    # revision row.
    excluded_venue_count: int = 0


class PublishRevisionDetail(PublishRevisionOut):
    """A single revision's full record, metadata plus its frozen snapshot —
    read-only, for inspection (Sprint 17's Revision Browser). Deliberately
    not used by anything that writes; Rollback (not built) would read the
    metadata here to decide *which* revision to restore, not this schema
    itself to perform the restore.
    """

    snapshot: dict


class PublishedVenueOut(BaseModel):
    """The public read shape — deliberately leaner than `VenueOut`: no
    `status` (everything here is implicitly published), no editorial-only
    fields (`internal_notes`, `source`, timestamps). Sourced entirely from
    a publish revision's frozen snapshot, never from the live `venues` table.
    """

    id: str
    name: str
    slug: str
    destination: DestinationRef
    district: str | None = None
    category: str
    is_featured: bool
    is_verified: bool
    latitude: str | None = None
    longitude: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    maps_url: str | None = None
    instagram_handle: str | None = None
    facebook_handle: str | None = None
    tiktok_handle: str | None = None
    short_description: str | None = None
    cover_image_url: str | None = None
    gallery_image_urls: list[str] | None = None
    opening_hours: dict | None = None
    beach_details: dict | None = None


class PublishedDestinationOut(BaseModel):
    """The public read shape for a destination — same relationship to
    `DestinationOut` that `PublishedVenueOut` has to `VenueOut`: no
    `status` (everything here is implicitly published), no editorial-only
    fields (`notes`, timestamps). Sourced entirely from a publish
    revision's frozen snapshot, never from the live `destinations` table.
    """

    id: str
    name: str
    region: str
    aliases: list[str] | None = None
    boundary: dict | None = None


class ActivityLogEntryOut(BaseModel):
    """A single editorial activity record — observability only. See
    app/activity/service.py for the one place these are ever created.
    """

    id: int
    timestamp: datetime
    action: str
    entity_type: str
    entity_id: str
    actor: str
    metadata: dict | None = None


class MeOut(BaseModel):
    """Sprint 24 — `GET /editor/me`'s response. Deliberately just enough
    for the frontend to know who's logged in and what they're allowed to
    do (via `role`) — not a user-profile shape. See
    `app/api/routes/me.py`.
    """

    id: str
    email: str | None = None
    role: str


class UserOut(BaseModel):
    """Sprint 32 — `GET /editor/users`'s response, and `PATCH
    /editor/users/{id}/role`'s. Unlike `MeOut` (which only ever describes
    the caller), this describes *any* `app_users` row — the one new thing
    User Role Management needs that "who am I" didn't. `created_at` is
    included so the frontend can show when a user first appeared (their
    first login, per `_provision_viewer`); `updated_at` isn't, since
    nothing about "when was this last edited" is part of this sprint's
    scope.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None = None
    role: str
    created_at: datetime


class DestinationStatsOut(BaseModel):
    """PLATFORM_SPEC_v1.0_FROZEN.md §2.1/§8.1 (`GET /editor/destinations/
    {id}/stats`) — replaces the legacy, stored `venueCount`/
    `verifiedCount`/`categoryBreakdown` fields with the same facts,
    computed live at request time (Principle 1.4 — computed, never
    stored; the legacy data already showed why: `seashell` claimed 13
    venues, actually had 10).
    """

    venue_count: int
    verified_count: int
    category_breakdown: dict[str, int]


class PlatformStatsOut(BaseModel):
    """PLATFORM_SPEC_v1.0_FROZEN.md §2.9 (`GET /editor/stats`) — the
    Dashboard's data source. Every field computed live from `venues`/
    `destinations`; no `stats` table or stored blob exists.
    """

    venues: int
    destinations: int
    categories: int
    with_cover: int
    with_instagram: int
    with_website: int
    with_phone: int
    pct_cover: float
    pct_instagram: float


class UserRoleUpdate(BaseModel):
    """Sprint 32 — the one field this endpoint ever changes. `role` is a
    plain `str`, validated against `APP_USER_ROLES` in the route itself
    (the same "validate against the fixed list, fail cleanly with a 422"
    pattern `bulk_update_category` already uses for `category` — not a
    `Permission`-style enum, since role names are already a CHECK-
    constrained plain-text column, not a typed vocabulary used in code the
    way `Permission` is).
    """

    role: str


class VenueRef(BaseModel):
    """Events Module v1 — the same lightweight resolved-reference shape
    `DestinationRef` already gives venues: id + display name only, so a
    caller never has to look up a venue's name for an id itself.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    slug: str
    status: str
    cover_image_url: str | None = None
    short_description: str | None = None
    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: VenueRef | None = None
    destination: DestinationRef | None = None
    featured: bool
    ticket_provider: str | None = None
    ticket_url: str | None = None
    external_event_id: str | None = None
    version: int
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Never a stored column — computed at response time by the route
    # (see `app/api/event_timing.py`). Optional only because a bare
    # `Event.model_validate(...)` (no route-level computation) wouldn't
    # otherwise populate it; every route that returns `EventOut` sets it.
    phase: str | None = None


class EventListOut(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int


class EventCreate(BaseModel):
    """`id`/`slug` are caller-supplied, same reasoning `DestinationCreate`
    already gives: no surrogate key, the caller picks a stable, human-
    legible identifier. Every new event starts `draft`, same as every
    other entity's creation path. `venue_id`/`destination_id` are both
    optional at creation, same as they are for the lifetime of the row.
    """

    id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue_id: str | None = None
    destination_id: str | None = None
    short_description: str | None = Field(default=None, max_length=500)
    ticket_provider: str | None = Field(default=None, max_length=200)
    ticket_url: str | None = None
    external_event_id: str | None = Field(default=None, max_length=200)


class EventUpdate(BaseModel):
    """Save Draft payload — same intent as `VenueUpdate`/`DestinationUpdate`:
    every field Edit Mode exposes as editable. `id`, `slug`, `status`, and
    timestamps are structural/workflow-controlled and aren't part of this
    write path, same reasoning as the other two entities.
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue_id: str | None = None
    destination_id: str | None = None
    short_description: str | None = Field(default=None, max_length=500)
    cover_image_url: str | None = None
    featured: bool | None = None
    ticket_provider: str | None = Field(default=None, max_length=200)
    ticket_url: str | None = None
    external_event_id: str | None = Field(default=None, max_length=200)


class BulkEventIdsRequest(BaseModel):
    """Same shape as `BulkVenueIdsRequest` — just the target ids, capped
    at 100 per request."""

    event_ids: list[str] = Field(min_length=1, max_length=100)


class EventBulkResultItem(BaseModel):
    """Same shape as `BulkResultItem`, for events — a distinct class
    (not a shared generic) since the id/entity field names differ
    (`event_id`/`event` vs. `venue_id`/`venue`), matching how this
    codebase already gives venues their own `BulkResultItem` rather than
    a generic parameterized one.
    """

    event_id: str
    success: bool
    error: str | None = None
    event: EventOut | None = None
    validation: ValidationResult | None = None


class EventBulkOperationResponse(BaseModel):
    results: list[EventBulkResultItem]
    succeeded: int
    failed: int


class PublishedEventOut(BaseModel):
    """The public read shape — same relationship to `EventOut` that
    `PublishedVenueOut` has to `VenueOut`: no `status` (everything here is
    implicitly published), no editorial-only fields. Sourced entirely from
    a publish revision's frozen snapshot, never the live `events` table.
    """

    id: str
    title: str
    slug: str
    cover_image_url: str | None = None
    short_description: str | None = None
    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: VenueRef | None = None
    destination: DestinationRef | None = None
    featured: bool
    ticket_provider: str | None = None
    ticket_url: str | None = None
    external_event_id: str | None = None
    phase: str | None = None
