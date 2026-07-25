from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    region: str
    status: str
    aliases: list[str] | None = None
    boundary: dict | None = None
    notes: str | None = None
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DestinationUpdate(BaseModel):
    """Save Draft payload — same shape/intent as `VenueUpdate`: only the
    fields Edit Mode exposes as editable. `id`, `status`, `boundary`
    (a geometry blob with no editor built yet), and timestamps are
    structural or workflow-controlled and aren't part of this write path,
    exactly the same reasoning `VenueUpdate` already documents.
    """

    name: str | None = None
    region: str | None = None
    aliases: list[str] | None = None
    notes: str | None = None


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
    """

    name: str | None = None
    category: str | None = None
    district: str | None = None
    is_featured: bool | None = None
    is_verified: bool | None = None
    short_description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    maps_url: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    instagram_handle: str | None = None
    facebook_handle: str | None = None
    tiktok_handle: str | None = None
    internal_notes: str | None = None
    cover_image_url: str | None = None
    gallery_image_urls: list[str] | None = None


class SetCoverImageRequest(BaseModel):
    """Sprint 26 — promotes an existing gallery image to cover, without a
    re-upload. `url` must already be one of the venue's
    `gallery_image_urls`; see `POST /venues/{id}/media/set-cover`.
    """

    url: str


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
