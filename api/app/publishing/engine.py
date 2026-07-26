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
from app.db.models import Destination, PublishRevision, Venue

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
    }


def _serialize_venue(venue: Venue) -> dict:
    """Same reasoning as `_serialize_destination` — no `status`, no
    editorial-only fields (`internal_notes`, `source`, `last_published_at`,
    timestamps). Decimal columns are stringified since JSONB storage and
    the eventual JSON response both need a JSON-native type.
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
        "short_description": venue.short_description,
        "cover_image_url": venue.cover_image_url,
        "gallery_image_urls": venue.gallery_image_urls,
        "opening_hours": venue.opening_hours,
        "beach_details": venue.beach_details,
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
    """
    now = datetime.now(timezone.utc)

    destinations = (
        db.query(Destination)
        .filter(Destination.status == "approved")
        .order_by(Destination.name)
        .all()
    )
    venues = (
        db.query(Venue)
        .filter(Venue.status == "approved")
        .order_by(Venue.name)
        .all()
    )

    snapshot = {
        "destinations": [_serialize_destination(d) for d in destinations],
        "venues": [_serialize_venue(v) for v in venues],
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_CONCURRENT_PUBLISH_DETAIL) from None
    db.refresh(revision)
    return revision


def get_current_revision(db: Session) -> PublishRevision | None:
    """The only lookup a public read path is ever allowed to use — no
    caller of this function should also query `Destination`/`Venue`
    directly to answer a public request; that would defeat the entire
    point of the snapshot (see docs/ARCHITECTURE.md#publishing-architecture).
    """
    return db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).one_or_none()


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
