from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import NO_QR_AREA_TYPES, NoQrPlace, Venue


def validate_no_qr_area_type(area_type: str) -> None:
    """Structured 422 for `ck_no_qr_areas_type`'s vocabulary — same
    reasoning `validate_access_type` (api/app/validation/venues.py)
    already gives for every other small fixed-set field in this codebase.
    """
    if area_type not in NO_QR_AREA_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_no_qr_area_type",
                "message": f"type must be one of: {', '.join(NO_QR_AREA_TYPES)}.",
            },
        )


def validate_no_qr_area_name(name: str) -> None:
    """Structured 422 for `ck_no_qr_areas_name_not_blank` — a Walk/Mall
    needs a real name; nothing else about it is required (no address, no
    category — it isn't a Venue).
    """
    if not name or not name.strip():
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_no_qr_area_name", "message": "name is required."},
        )


def validate_no_qr_place_identity(venue_id: str | None, name: str | None) -> None:
    """Structured 422 for `ck_no_qr_places_identity` — exactly one of
    venue_id/name must identify a place. Neither means the place has no
    identity at all; both means an ambiguous double identity (the linked
    Venue is always the source of truth for its own name, so pairing a
    standalone name alongside a venue_id is never valid).
    """
    if venue_id is None and (name is None or not name.strip()):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_no_qr_place",
                "message": "Either venue_id or name is required.",
            },
        )
    if venue_id is not None and name is not None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_no_qr_place",
                "message": "A place cannot have both venue_id and a standalone name.",
            },
        )


def validate_no_qr_place_venue(db: Session, venue_id: str) -> None:
    """A referenced Venue must actually exist — same structured-422
    pattern `validate_parent_venue_id` already uses for an unknown id."""
    if db.get(Venue, venue_id) is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_no_qr_place", "message": f"Venue '{venue_id}' not found."},
        )


def validate_no_qr_place_not_duplicate(
    db: Session, area_id: int, venue_id: str, exclude_place_id: int | None = None
) -> None:
    """Mirrors `uq_no_qr_places_area_venue`'s own DB-level guarantee at
    the application layer, so a duplicate fails here with a clear
    message rather than a raw `IntegrityError`. `exclude_place_id` lets
    an update leave a place's own row out of the check (re-saving the
    same venue_id on the same place is not a duplicate).
    """
    query = db.query(NoQrPlace).filter(NoQrPlace.area_id == area_id, NoQrPlace.venue_id == venue_id)
    if exclude_place_id is not None:
        query = query.filter(NoQrPlace.id != exclude_place_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "duplicate_no_qr_place",
                "message": "This venue is already a place in this Area.",
            },
        )
