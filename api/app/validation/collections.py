from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import Venue


def validate_collection_name(name: str) -> None:
    """Structured 422 — same "required, non-blank" pattern every other
    entity's name/title field already gets (`validate_no_qr_area_name`,
    `EventCreate.title`'s `min_length=1`)."""
    if not name or not name.strip():
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_collection_name", "message": "name is required."},
        )


def validate_collection_id(collection_id: str) -> None:
    """`Collection.id` doubles as its slug (migration 0015's own
    convention, same as `Destination`) — caller-supplied, same reasoning
    `VenueCreate`/`EventCreate`/`DestinationCreate` already give for why
    these aren't surrogate keys."""
    if not collection_id or not collection_id.strip():
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_collection_id", "message": "id is required."},
        )


def validate_collection_venue_exists(db: Session, venue_id: str) -> None:
    """A referenced Venue must actually exist — same structured-422
    pattern `validate_no_qr_place_venue` already uses for an unknown id.
    Never silently accepted."""
    if db.get(Venue, venue_id) is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_venue_id", "message": f"Venue '{venue_id}' not found."},
        )
