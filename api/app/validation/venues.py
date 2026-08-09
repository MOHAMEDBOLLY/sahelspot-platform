from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import ACCESS_TYPES, RESERVATION_POLICIES, VENUE_CATEGORIES, Tag, Venue

from .schemas import FieldError, ValidationResult, build_validation_result

# PLATFORM_SPEC_v1.0_FROZEN.md §6.3 — the values `ck_venues_beach_details_
# shape` (Phase 1, EP5) accepts for `publicAccess`. The DB constraint only
# enforces key *presence*; this is the application-layer value check the
# frozen spec's §7.8 explicitly leaves to this layer.
BEACH_PUBLIC_ACCESS_VALUES = ("yes", "no", "unknown")


def validate_beach_details_shape(category: str, beach_details: dict | None) -> None:
    """Raises a structured 422 for either half of the invariant `ck_venues_
    beach_details_shape` enforces at the DB level: a 'Beach' venue must
    have both keys with a legal `publicAccess` value; a non-'Beach' venue
    must not have `beach_details` populated at all. Called by both
    `POST /editor/venues` and `PATCH /editor/venues/{id}` so a malformed
    payload fails cleanly here rather than as a raw `IntegrityError`.
    """
    if category == "Beach":
        if not isinstance(beach_details, dict) or "type" not in beach_details or "publicAccess" not in beach_details:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "invalid_beach_details",
                    "message": "A Beach venue requires beach_details with 'type' and 'publicAccess'.",
                },
            )
        if beach_details["publicAccess"] not in BEACH_PUBLIC_ACCESS_VALUES:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "invalid_beach_details",
                    "message": f"publicAccess must be one of: {', '.join(BEACH_PUBLIC_ACCESS_VALUES)}.",
                },
            )
    elif beach_details is not None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_beach_details",
                "message": "beach_details may only be set when category is 'Beach'.",
            },
        )

def validate_access_type(access_type: str | None) -> None:
    """Same shape as `validate_beach_details_shape`: a structured 422 for
    an illegal value, so a typo/bad client fails cleanly here rather than
    as a raw `IntegrityError` from the DB CHECK constraint. `None` is
    always legal — an unclassified venue, not an error.
    """
    if access_type is not None and access_type not in ACCESS_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_access_type",
                "message": f"access_type must be one of: {', '.join(ACCESS_TYPES)}.",
            },
        )


def validate_reservation_policy(reservation_policy: str | None) -> None:
    """Same reasoning as `validate_access_type` above."""
    if reservation_policy is not None and reservation_policy not in RESERVATION_POLICIES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_reservation_policy",
                "message": f"reservation_policy must be one of: {', '.join(RESERVATION_POLICIES)}.",
            },
        )


def validate_parent_venue_id(db: Session, venue_id: str, parent_venue_id: str | None) -> None:
    """Studio Content Organization (Beaches + No QR) — a structured 422 for
    every half of the invariant the DB's self-referential FK alone can't
    give a clean error for: a venue can't be its own parent (the FK
    constraint wouldn't catch this — it's a valid row reference, just a
    nonsensical one), an unknown parent id fails here rather than as a raw
    `IntegrityError`, and — per product decision — only a venue that is
    itself an explicitly designated No QR place (`is_no_qr = true`) may be
    used as a parent (a normal Restaurant/Coffee/Hotel venue is never a
    Walk/Mall). `None` is always legal — no No QR context.
    """
    if parent_venue_id is None:
        return
    if parent_venue_id == venue_id:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_parent_venue", "message": "A venue cannot be its own parent."},
        )
    parent = db.get(Venue, parent_venue_id)
    if parent is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_parent_venue", "message": f"Parent venue '{parent_venue_id}' not found."},
        )
    if not parent.is_no_qr:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_parent_venue",
                "message": "Parent venue must itself be a designated No QR place (is_no_qr = true).",
            },
        )


def validate_no_qr_disable(db: Session, venue_id: str) -> None:
    """Studio Content Organization (Beaches + No QR) — a venue can't stop
    being a designated No QR place (`is_no_qr: true -> false`) while any
    other venue still has `parent_venue_id` pointing at it. Same structured-
    422 pattern as `validate_parent_venue_id` above, and deliberately the
    mirror image of its "parent must be `is_no_qr`" rule: that one stops a
    bad relationship from being *created*, this one stops a good
    relationship from being silently left *dangling*. Not an automatic
    cleanup — the editor must explicitly reassign or clear each child's
    `parent_venue_id` first; this only raises, it never touches another
    row.
    """
    has_children = db.query(Venue.id).filter(Venue.parent_venue_id == venue_id).first() is not None
    if has_children:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "venue_has_no_qr_children",
                "message": "Cannot disable No QR while this venue is assigned as a parent.",
            },
        )


def validate_tag_ids(db: Session, category: str, tag_ids: list[int]) -> None:
    """Every assigned tag must exist and must be scoped to the venue's
    *resulting* category (mirrors `validate_beach_details_shape`'s own
    "checked against the resulting category, not the pre-update one"
    reasoning) — a Coffee tag on a Restaurant venue is rejected here, not
    just hidden by the Studio picker UI.
    """
    if not tag_ids:
        return
    found = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    found_by_id = {tag.id: tag for tag in found}
    missing = [tag_id for tag_id in tag_ids if tag_id not in found_by_id]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_tag_ids", "message": f"Unknown tag id(s): {missing}."},
        )
    mismatched = [tag.id for tag in found if tag.category != category]
    if mismatched:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "tag_category_mismatch",
                "message": f"Tag id(s) {mismatched} do not belong to category '{category}'.",
            },
        )


# The observed range of all current venue coordinates (see docs/DATABASE.md's
# "Validation rules" section) — a sanity bound, not a hard DB constraint,
# which is exactly why it's enforced here rather than as a CHECK constraint.
LATITUDE_RANGE = (Decimal("30.6"), Decimal("31.1"))
LONGITUDE_RANGE = (Decimal("28.6"), Decimal("29.4"))


def validate_venue(venue: Venue) -> ValidationResult:
    """The canonical Editorial Readiness check described in docs/DATABASE.md
    — required fields present, category in the documented set, coordinates
    in range. Business rules live here and only here; nothing on the
    frontend duplicates this logic, it only mirrors the *shape* of the
    check for instant UX feedback.

    Still error-rules only as of Sprint 13 — no warnings/info producers
    exist yet, but the result they'd feed into (`build_validation_result`)
    is already in place.
    """
    errors: list[FieldError] = []

    if not venue.name or not venue.name.strip():
        errors.append(FieldError(field="name", message="Name is required."))

    if venue.category not in VENUE_CATEGORIES:
        errors.append(
            FieldError(
                field="category",
                message=f"Category must be one of: {', '.join(VENUE_CATEGORIES)}.",
            )
        )

    if venue.latitude is not None and not (LATITUDE_RANGE[0] <= venue.latitude <= LATITUDE_RANGE[1]):
        errors.append(
            FieldError(
                field="latitude",
                message=f"Latitude must be between {LATITUDE_RANGE[0]} and {LATITUDE_RANGE[1]}.",
            )
        )

    if venue.longitude is not None and not (LONGITUDE_RANGE[0] <= venue.longitude <= LONGITUDE_RANGE[1]):
        errors.append(
            FieldError(
                field="longitude",
                message=f"Longitude must be between {LONGITUDE_RANGE[0]} and {LONGITUDE_RANGE[1]}.",
            )
        )

    # Sprint 13: no warnings/info rules exist yet — errors alone still decide
    # validity and readiness (build_validation_result derives both).
    return build_validation_result(errors)
