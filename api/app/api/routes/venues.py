from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import VenueOut
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
