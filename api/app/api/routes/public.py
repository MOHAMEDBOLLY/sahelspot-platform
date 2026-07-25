from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import DestinationRef, PublishedDestinationOut, PublishedVenueOut
from app.db.session import get_db
from app.publishing.engine import get_current_revision

# The public API (Sprint 23) — every route here reads *only* the current
# publish revision's frozen snapshot, never the draft `destinations`/
# `venues` tables. This is a structural guarantee, not a convention: this
# file has no import of `app.db.models.Destination`/`Venue` at all, so a
# query against the draft tables can't be added here by accident without
# it being an obvious, reviewable new import. Mounted under /public by
# app/api/router.py, with no auth — this is the public-facing contract.
router = APIRouter(tags=["public"])


@router.get("/venues", response_model=list[PublishedVenueOut])
def list_published_venues(db: Session = Depends(get_db)):
    """The public read path for venues — reads *only* the current publish
    revision's frozen snapshot. There is no code path here that queries
    the draft `venues`/`destinations` tables, so draft, in-review, or
    approved-but-not-yet-published content can never appear here by
    construction, not by a filter that could be forgotten.
    """
    revision = get_current_revision(db)
    if revision is None:
        return []

    destinations_by_id = {d["id"]: d for d in revision.snapshot.get("destinations", [])}
    published_venues = []
    for venue in revision.snapshot.get("venues", []):
        destination = destinations_by_id.get(venue["destination_id"])
        # A venue whose destination isn't itself part of this snapshot
        # (e.g. approved separately but its destination isn't) has nothing
        # to resolve a display name from — skipped rather than crashing.
        # See docs/ROADMAP.md's Sprint 16 entry for why this is flagged as
        # follow-up, not resolved here.
        if destination is None:
            continue
        published_venues.append(
            {
                **venue,
                "destination": DestinationRef(id=destination["id"], name=destination["name"]),
            }
        )
    return published_venues


@router.get("/destinations", response_model=list[PublishedDestinationOut])
def list_published_destinations(db: Session = Depends(get_db)):
    """The public read path for destinations — added in Sprint 23 as the
    counterpart `GET /published/venues` never had (flagged as a gap in the
    Sprint 22 architecture review). Same shape of guarantee: reads only
    the current revision's frozen snapshot, never the draft `destinations`
    table.
    """
    revision = get_current_revision(db)
    if revision is None:
        return []
    return revision.snapshot.get("destinations", [])
