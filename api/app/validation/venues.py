from decimal import Decimal

from fastapi import HTTPException

from app.db.models import VENUE_CATEGORIES, Venue

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
