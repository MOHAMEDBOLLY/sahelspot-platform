from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import DestinationRef, PublishedVenueOut, PublishRevisionOut
from app.db.session import get_db
from app.publishing.engine import get_current_revision, publish

router = APIRouter(tags=["publish"])


@router.post("/publish", response_model=PublishRevisionOut)
def publish_current_approved_content(db: Session = Depends(get_db)):
    """Publish — snapshots every `approved` destination/venue into a new,
    immutable publish revision and makes it current. Not a status change:
    nothing here touches `destinations.status`/`venues.status` (see
    docs/ARCHITECTURE.md#publishing-architecture). Previous revisions are
    never overwritten — the old current, if any, is simply superseded.
    """
    return publish(db)


@router.get("/published/venues", response_model=list[PublishedVenueOut])
def list_published_venues(db: Session = Depends(get_db)):
    """The public read path — reads *only* the current publish revision's
    frozen snapshot. There is no code path here that queries the draft
    `venues`/`destinations` tables, so draft, in-review, or approved-but-
    not-yet-published content can never appear here by construction, not
    by a filter that could be forgotten.
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
