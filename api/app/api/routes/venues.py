from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import VenueOut, VenueUpdate
from app.db.models import Venue
from app.db.session import get_db

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
