from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import DestinationOut, DestinationUpdate
from app.db.models import Destination
from app.db.session import get_db

# Editorial only — mounted under /editor by app/api/router.py, which also
# applies the router-level auth gate (see Sprint 23). No endpoint here
# needs the caller's identity for anything (no activity is logged for
# Save Draft), so unlike venues.py's workflow endpoints, nothing in this
# file declares a `user` parameter at all — the gate is enforced entirely
# one level up.
router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    return db.query(Destination).order_by(Destination.name).all()


@router.get("/{destination_id}", response_model=DestinationOut)
def get_destination(destination_id: str, db: Session = Depends(get_db)):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    return destination


@router.patch("/{destination_id}", response_model=DestinationOut)
def update_destination(destination_id: str, payload: DestinationUpdate, db: Session = Depends(get_db)):
    """Save Draft: writes straight to the draft `destinations` row, no
    status change. Same pattern as `update_venue` in routes/venues.py —
    Editorial Readiness, Review, Approval, and Publish for destinations are
    deliberately not part of this sprint; this is only the first write path,
    exactly as Save Draft was for venues in Sprint 11.
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(destination, field, value)

    db.commit()

    destination = db.get(Destination, destination_id)
    return destination
