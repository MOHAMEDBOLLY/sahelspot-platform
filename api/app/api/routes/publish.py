from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import (
    DestinationRef,
    PublishedVenueOut,
    PublishRevisionDetail,
    PublishRevisionOut,
)
from app.db.models import PublishRevision
from app.db.session import get_db
from app.publishing.engine import get_current_revision, publish, republish

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


@router.get("/publish/revisions", response_model=list[PublishRevisionOut])
def list_publish_revisions(db: Session = Depends(get_db)):
    """Revision history — the Revision Browser's list (Sprint 17). Metadata
    only, newest first; this endpoint itself never restores a revision or
    changes `is_current` — see `publish_current_approved_content` and
    `republish_revision` for the only two code paths that do.
    """
    return db.query(PublishRevision).order_by(PublishRevision.id.desc()).all()


@router.get("/publish/revisions/{revision_id}", response_model=PublishRevisionDetail)
def get_publish_revision(revision_id: int, db: Session = Depends(get_db)):
    """A single revision's full record, including its snapshot — for
    inspection only. `404` if the revision doesn't exist. This endpoint
    itself is not a restore mechanism: it returns data, it never assigns
    `is_current`. See `republish_revision` below for the action that does.
    """
    revision = db.get(PublishRevision, revision_id)
    if revision is None:
        raise HTTPException(status_code=404, detail="Publish revision not found")
    return revision


@router.post("/publish/revisions/{revision_id}/republish", response_model=PublishRevisionOut)
def republish_revision(revision_id: int, db: Session = Depends(get_db)):
    """Republish (Sprint 18) — makes an existing revision current again.
    Never creates a new snapshot, never regenerates or edits any revision's
    data; only moves the `is_current` pointer, atomically, to a revision
    that already exists. `404` if the revision doesn't exist; `409` if it's
    already current. See `app/publishing/engine.py`'s `republish()` and
    docs/API.md's "Republish" section for why this is safer than any
    operation that would rewrite history.
    """
    return republish(db, revision_id)
