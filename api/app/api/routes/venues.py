from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import VenueOut, VenueUpdate
from app.db.models import Venue
from app.db.session import get_db
from app.validation.schemas import ValidationResult
from app.validation.venues import validate_venue

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("", response_model=list[VenueOut])
def list_venues(db: Session = Depends(get_db)):
    return (
        db.query(Venue)
        .options(joinedload(Venue.destination))
        .order_by(Venue.name)
        .all()
    )


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(venue_id: str, db: Session = Depends(get_db)):
    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@router.patch("/{venue_id}", response_model=VenueOut)
def update_venue(venue_id: str, payload: VenueUpdate, db: Session = Depends(get_db)):
    """Save Draft: writes straight to the draft `venues` row, no status change.
    This is not Publish — nothing here touches `publish_revisions`.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(venue, field, value)

    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/validate", response_model=ValidationResult)
def validate_venue_route(venue_id: str, db: Session = Depends(get_db)):
    """Runs the canonical "Validate" gate (see docs/DATABASE.md) against the
    venue's currently persisted draft state. Read-only — this checks whether
    the row is fit to move from `draft` to `review`, it doesn't move it there
    itself (Review isn't built yet).
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return validate_venue(venue)
