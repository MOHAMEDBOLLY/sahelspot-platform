from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.schemas import VenueOut, VenueUpdate
from app.db.models import Venue
from app.db.session import get_db
from app.validation.schemas import ValidationResult
from app.validation.venues import validate_venue
from app.workflow.transitions import require_status

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
    """Runs the canonical Editorial Readiness check (see docs/DATABASE.md)
    against the venue's currently persisted draft state. Read-only — this
    checks whether the row is fit to move from `draft` to `review`, it
    doesn't move it there itself. See submit_venue_for_review below for the
    action that actually performs that transition.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return validate_venue(venue)


@router.post("/{venue_id}/submit-for-review", response_model=VenueOut)
def submit_venue_for_review(venue_id: str, db: Session = Depends(get_db)):
    """Review — the first editorial state transition: `draft` -> `review`.
    This is an editorial *action* (it writes `status`), not a validation
    check — it reuses `validate_venue()` as a precondition rather than
    re-deciding readiness itself, so the two concepts stay separate (see
    docs/API.md's "Review Workflow" section). Not Approval or Publish:
    nothing here touches `publish_revisions`, and `review` is not a
    publishable state.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    require_status(venue, expected="draft", target="review")

    result = validate_venue(venue)
    if not result.ready_for_review:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "not_ready_for_review",
                "message": "Venue is not ready for review.",
                "errors": [error.model_dump() for error in result.errors],
            },
        )

    venue.status = "review"
    log_activity(db, action="submit_for_review", entity_type="venue", entity_id=venue.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/approve", response_model=VenueOut)
def approve_venue(venue_id: str, db: Session = Depends(get_db)):
    """Approval — the second editorial state transition: `review` ->
    `approved`. A human editorial decision, not a validation re-run:
    Editorial Readiness was already the prerequisite for entering `review`
    in the first place (Sprint 14), so it is never repeated here — the only
    precondition Approval enforces is the status guard itself, via the same
    `require_status` Review already uses. Not Publish: nothing here touches
    `publish_revisions` — `approved` only makes a venue *eligible* for the
    next publish, it doesn't publish it.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    require_status(venue, expected="review", target="approved")

    venue.status = "approved"
    log_activity(db, action="approve", entity_type="venue", entity_id=venue.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue
