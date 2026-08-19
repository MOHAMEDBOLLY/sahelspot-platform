"""The Publish Engine — snapshot creation only.

Deliberately its own package, separate from `app/validation/` (Editorial
Readiness) and `app/workflow/` (status transitions): Publishing is not a
status change, it is a whole-dataset snapshot operation. Mixing it into
either of those modules would blur a distinction docs/ARCHITECTURE.md is
explicit about — see "Publishing architecture" there.
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.activity.service import log_activity
from app.db.models import (
    Collection,
    CollectionVenue,
    Destination,
    Event,
    PublishRevision,
    Tag,
    Venue,
    VenueTag,
)

_CONCURRENT_PUBLISH_DETAIL = {
    "error": "concurrent_publish",
    "message": "Another publish is already in progress. Please try again.",
}


def _decimal_to_str(value: Decimal | None) -> str | None:
    return str(value) if value is not None else None


def _serialize_destination(destination: Destination) -> dict:
    """Only the fields a frozen, public-facing snapshot needs. `status` is
    omitted — every destination here is `approved` by construction (that's
    what qualified it for this snapshot), so repeating it would be dead
    weight. Editorial-only fields (`last_published_at`, timestamps) are
    admin concerns, not part of what the public reads.
    """
    return {
        "id": destination.id,
        "name": destination.name,
        "region": destination.region,
        "aliases": destination.aliases,
        "boundary": destination.boundary,
        "notes": destination.notes,
        "cover_image_url": destination.cover_image_url,
    }


def _serialize_venue(venue: Venue, tag_slugs: list[str]) -> dict:
    """Same reasoning as `_serialize_destination` — no `status`, no
    editorial-only fields (`internal_notes`, `source`, `last_published_at`,
    timestamps). Decimal columns are stringified since JSONB storage and
    the eventual JSON response both need a JSON-native type.

    Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
    `tag_slugs` is precomputed once for every venue being published (see
    `publish()` below), not queried per-venue here: a per-call query would
    turn an O(1) publish into an O(n) one for no reason, the same "batch
    the join, don't N+1 it" discipline the rest of this module already
    follows implicitly by working off pre-fetched lists. Collection
    membership is NOT embedded per-venue — it's embedded once, per
    collection, in `snapshot["collections"]` (see `_serialize_collections`)
    since a collection's curated order lives on the collection side, not
    the venue side.
    """
    return {
        "id": venue.id,
        "name": venue.name,
        "slug": venue.slug,
        "destination_id": venue.destination_id,
        "district": venue.district,
        "category": venue.category,
        "is_featured": venue.is_featured,
        "is_verified": venue.is_verified,
        "latitude": _decimal_to_str(venue.latitude),
        "longitude": _decimal_to_str(venue.longitude),
        "phone": venue.phone,
        "whatsapp": venue.whatsapp,
        "website": venue.website,
        "maps_url": venue.maps_url,
        "instagram_handle": venue.instagram_handle,
        "facebook_handle": venue.facebook_handle,
        "tiktok_handle": venue.tiktok_handle,
        # Booking CTA Fields (Phase 1) — same "plain pass-through" treatment
        # as every other contact/social field above.
        "reserve_your_spot_beach_url": venue.reserve_your_spot_beach_url,
        "reserve_your_table_url": venue.reserve_your_table_url,
        "reserve_your_spot_nightlife_url": venue.reserve_your_spot_nightlife_url,
        "short_description": venue.short_description,
        "cover_image_url": venue.cover_image_url,
        "gallery_image_urls": venue.gallery_image_urls,
        "opening_hours": venue.opening_hours,
        "beach_details": venue.beach_details,
        "access_type": venue.access_type,
        "reservation_policy": venue.reservation_policy,
        "tags": tag_slugs,
    }


def _serialize_collections(db: Session, published_venue_ids: set[str]) -> list[dict]:
    """Category/Tags/Access Type/Badges/Collections architecture (Phase 1)
    — only `is_active` collections are embedded (an inactive one shouldn't
    appear on the public site, same as an unapproved venue). Venue ids are
    filtered down to `published_venue_ids` — the same referential-closure
    discipline `publish()` already applies to venues-whose-destination-
    isn't-approved: a collection can reference a venue that isn't part of
    *this* snapshot (approved but not yet published, or since un-approved),
    and that venue is silently dropped from the collection's list rather
    than failing the whole publish. Each collection's `venue_ids` are
    already in curated `sort_order` — nothing downstream needs to re-sort.
    """
    collections = db.query(Collection).filter(Collection.is_active.is_(True)).order_by(Collection.sort_order).all()
    result = []
    for collection in collections:
        member_rows = (
            db.query(CollectionVenue.venue_id)
            .filter(CollectionVenue.collection_id == collection.id)
            .order_by(CollectionVenue.sort_order)
            .all()
        )
        venue_ids = [venue_id for (venue_id,) in member_rows if venue_id in published_venue_ids]
        result.append(
            {
                "id": collection.id,
                "slug": collection.slug,
                "name": collection.name,
                "description": collection.description,
                "venue_ids": venue_ids,
            }
        )
    return result


def _serialize_event(event: Event) -> dict:
    """Events Module v1 — same reasoning as `_serialize_venue`: no
    `status` (every event here is `approved` by construction), no
    editorial-only fields. `venue_id`/`destination_id` are carried as
    raw ids (resolved into refs at public-read time, same pattern
    `resolve_published_venue` already established for
    `venue.destination_id`) — both nullable, so `None` is a normal value,
    not a sign this event is missing anything.
    """
    return {
        "id": event.id,
        "title": event.title,
        "slug": event.slug,
        "cover_image_url": event.cover_image_url,
        "short_description": event.short_description,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "start_time": event.start_time.isoformat() if event.start_time else None,
        "end_time": event.end_time.isoformat() if event.end_time else None,
        "venue_id": event.venue_id,
        "destination_id": event.destination_id,
        "featured": event.featured,
        "ticket_provider": event.ticket_provider,
        "ticket_url": event.ticket_url,
        "external_event_id": event.external_event_id,
    }


def publish(db: Session, *, actor: str) -> PublishRevision:
    """Gathers every currently `approved` destination and venue, freezes
    them into a new immutable `publish_revisions` row, and atomically makes
    it the current one: the previous current revision (if any) is flipped
    to `is_current=False` in the same transaction as the new row's insert,
    so there is never a moment with zero or two current revisions — the
    partial unique index on `is_current` backs this at the database level
    too. Also stamps `last_published_at` on every published row (the field
    docs/DATABASE.md already designed for exactly this, unused until now).

    Never reads or writes `status` on any row — Approval already decided
    what's eligible; Publish only freezes it. That separation is the whole
    point: this function has no concept of "review" or "draft" at all.

    PLATFORM_SPEC_v1.0_FROZEN.md §1 — referential closure. An `approved`
    venue whose destination is *not* `approved` (drift: the destination
    was archived, or moved back to draft/review, after the venue was
    already approved — the approve-time gate in `app/api/routes/venues.py`
    only catches this at the moment of approval, not later) is excluded
    from this snapshot, not a reason to fail the whole publish. Every
    other destination and venue in the same snapshot is unaffected by one
    orphaned venue.
    """
    now = datetime.now(timezone.utc)

    destinations = (
        db.query(Destination)
        .filter(Destination.status == "approved")
        .order_by(Destination.name)
        .all()
    )
    approved_destination_ids = {d.id for d in destinations}

    all_approved_venues = (
        db.query(Venue)
        .filter(Venue.status == "approved")
        .order_by(Venue.name)
        .all()
    )
    venues = [v for v in all_approved_venues if v.destination_id in approved_destination_ids]
    excluded_venues = [v for v in all_approved_venues if v.destination_id not in approved_destination_ids]

    # Events Module v1 — no referential-closure exclusion: an event's
    # `venue_id`/`destination_id` are both optional by design (see
    # `Event`'s docstring), so an approved event whose linked venue/
    # destination isn't itself part of this snapshot still publishes —
    # its ref just resolves to `None` at public-read time (same "resolve,
    # don't hard-exclude" as `resolve_published_venue` gives a dangling
    # `destination_id`, just without the venue/destination case's
    # mandatory-relationship reason to exclude instead).
    events = db.query(Event).filter(Event.status == "approved").order_by(Event.start_date).all()

    # Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
    # one query for every venue-tag pairing being published, grouped in
    # Python, rather than a per-venue query inside `_serialize_venue` (see
    # that function's own docstring for why).
    published_venue_ids = {v.id for v in venues}
    tags_by_venue_id: dict[str, list[str]] = {v.id: [] for v in venues}
    if published_venue_ids:
        tag_rows = (
            db.query(VenueTag.venue_id, Tag.slug)
            .join(Tag, Tag.id == VenueTag.tag_id)
            .filter(VenueTag.venue_id.in_(published_venue_ids))
            .order_by(Tag.sort_order, Tag.slug)
            .all()
        )
        for venue_id, slug in tag_rows:
            tags_by_venue_id[venue_id].append(slug)

    snapshot = {
        "destinations": [_serialize_destination(d) for d in destinations],
        "venues": [_serialize_venue(v, tags_by_venue_id[v.id]) for v in venues],
        "events": [_serialize_event(e) for e in events],
        "collections": _serialize_collections(db, published_venue_ids),
    }

    # Flip the old current (if any) and insert the new one in the same
    # transaction — committed together, so the pointer move is atomic.
    db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).update(
        {"is_current": False}, synchronize_session=False
    )

    for destination in destinations:
        destination.last_published_at = now
    for venue in venues:
        venue.last_published_at = now
    for event in events:
        event.last_published_at = now

    revision = PublishRevision(
        snapshot=snapshot,
        is_current=True,
        published_at=now,
        destination_count=len(destinations),
        venue_count=len(venues),
    )
    db.add(revision)
    # Sprint 31 — this `flush()` (needed to assign `revision.id` for the
    # activity entry below) is what actually sends the new row's `INSERT`
    # to the database, so it's where the partial unique index on
    # `is_current` (see `PublishRevision`) would raise on a concurrent
    # publish — not the later `db.commit()`, which by then has nothing new
    # left to send. Both are guarded the same way so the loser gets a
    # clean 409 regardless of which of the two actually raises.
    try:
        db.flush()  # assigns revision.id, needed for the activity entry below
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_CONCURRENT_PUBLISH_DETAIL) from None
    log_activity(
        db,
        action="publish",
        entity_type="publish_revision",
        entity_id=str(revision.id),
        actor=actor,
        metadata={"destination_count": len(destinations), "venue_count": len(venues)},
    )
    # PLATFORM_SPEC_v1.0_FROZEN.md §1.3 — one activity entry per excluded
    # venue, so the drift is traceable via the existing Activity page with
    # no new UI surface required.
    for excluded_venue in excluded_venues:
        log_activity(
            db,
            action="publish_excluded_orphan_venue",
            entity_type="venue",
            entity_id=excluded_venue.id,
            actor=actor,
            metadata={
                "destination_id": excluded_venue.destination_id,
                "destination_status": excluded_venue.destination.status,
            },
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_CONCURRENT_PUBLISH_DETAIL) from None
    db.refresh(revision)
    # Not persisted — §1.3 specifies this as a response-level fact about
    # the publish event, not a stored column on the revision row (see
    # PublishRevisionOut.excluded_venue_count). Attached as a plain
    # instance attribute; FastAPI/Pydantic's from_attributes reads it like
    # any mapped column.
    revision.excluded_venue_count = len(excluded_venues)
    return revision


def get_current_revision(db: Session) -> PublishRevision | None:
    """The only lookup a public read path is ever allowed to use — no
    caller of this function should also query `Destination`/`Venue`
    directly to answer a public request; that would defeat the entire
    point of the snapshot (see docs/ARCHITECTURE.md#publishing-architecture).
    """
    return db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).one_or_none()


def get_current_revision_id(db: Session) -> int | None:
    """The current revision's id alone, without loading its `snapshot`.

    H2 — every `/public/*` route previously had to load the entire
    snapshot JSONB (321 KiB on production today) just to answer a request,
    including requests whose answer is "nothing changed." This is the
    cheap half of that lookup: an index-only read of one bigint, used to
    build the HTTP cache validator and to answer a matching
    `If-None-Match` with a `304` before the snapshot is ever touched.

    Snapshots are immutable and only the `is_current` pointer ever moves,
    so this id is an exact cache validator by construction: same id ⇒
    byte-identical public data.
    """
    return (
        db.query(PublishRevision.id).filter(PublishRevision.is_current.is_(True)).scalar()
    )


def republish(db: Session, revision_id: int, *, actor: str) -> PublishRevision:
    """Republish (Sprint 18) — makes an *existing* revision current again.
    Deliberately the inverse of the snapshot half of `publish()`: this
    function never builds a snapshot, never touches any row's data, and
    never reads `destinations`/`venues` at all. It only ever moves the
    `is_current` pointer, atomically, between two rows that already exist —
    the exact "Rollback" mechanism docs/API.md's Sprint 16/17 entries
    described as future work, built here on the same atomic pointer-flip
    pattern `publish()` already established.

    Raises a structured `404` if the revision doesn't exist, or `409` if
    it's already current (there is nothing to move — a redundant republish
    would be a no-op disguised as an action).
    """
    revision = db.get(PublishRevision, revision_id)
    if revision is None:
        raise HTTPException(status_code=404, detail="Publish revision not found")

    if revision.is_current:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "already_current",
                "message": f"Revision {revision_id} is already the current published revision.",
            },
        )

    # Flip the old current (if any) and the target revision in the same
    # transaction — committed together, so the pointer move is atomic. No
    # snapshot is read, built, or written anywhere in this function.
    db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).update(
        {"is_current": False}, synchronize_session=False
    )
    revision.is_current = True
    log_activity(
        db,
        action="republish",
        entity_type="publish_revision",
        entity_id=str(revision.id),
        actor=actor,
    )
    # Sprint 31 — same concurrent-publish guard as `publish()` above.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_CONCURRENT_PUBLISH_DETAIL) from None
    db.refresh(revision)
    return revision
