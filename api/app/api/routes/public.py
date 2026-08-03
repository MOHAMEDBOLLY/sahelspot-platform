from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.event_timing import compute_event_phase
from app.api.schemas import (
    DestinationRef,
    PublishedDestinationOut,
    PublishedEventOut,
    PublishedVenueOut,
    VenueRef,
)
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


def resolve_published_venue(venue: dict, destinations_by_id: dict) -> dict | None:
    """Merges one snapshot venue with its resolved `destination` ref, or
    returns `None` if its destination isn't itself part of this snapshot
    (e.g. approved separately but its destination isn't — see
    docs/ROADMAP.md's Sprint 16 entry for why this is flagged as
    follow-up, not resolved here). The one place this resolution logic
    exists — `list_published_venues`, `get_published_venue` (M5), and
    `app/api/routes/search.py`'s `search_published_venues` (M7) all call
    this instead of each re-deriving it. Not underscore-prefixed: it has
    real consumers outside this module now, so it isn't private to it.
    """
    destination = destinations_by_id.get(venue["destination_id"])
    if destination is None:
        return None
    return {
        **venue,
        "destination": DestinationRef(id=destination["id"], name=destination["name"]),
    }


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
        resolved = resolve_published_venue(venue, destinations_by_id)
        if resolved is not None:
            published_venues.append(resolved)
    return published_venues


@router.get("/venues/{venue_id}", response_model=PublishedVenueOut)
def get_published_venue(venue_id: str, db: Session = Depends(get_db)):
    """M5 (consumer Release 1) — the single-venue lookup venue detail
    pages need, that `list_published_venues` alone can't serve. Same
    snapshot-only guarantee: reads the current revision, never the draft
    `venues` table. `404` covers every reason a public caller shouldn't
    see this id — it doesn't exist at all, it's draft/in-review and never
    approved, it was approved but never published, or (the list
    endpoint's one edge case) its destination isn't in this snapshot
    either — all indistinguishable to a public caller, deliberately (see
    docs/adr/0001-public-venue-urls.md for the URL scheme this endpoint
    commits to).
    """
    revision = get_current_revision(db)
    if revision is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue = next((v for v in revision.snapshot.get("venues", []) if v["id"] == venue_id), None)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    destinations_by_id = {d["id"]: d for d in revision.snapshot.get("destinations", [])}
    resolved = resolve_published_venue(venue, destinations_by_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    return resolved


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


def resolve_published_event(
    event: dict, venues_by_id: dict, destinations_by_id: dict
) -> dict:
    """Events Module v1 — resolves `venue_id`/`destination_id` into refs,
    same pattern `resolve_published_venue` established for a venue's
    `destination_id`. Unlike that function, a dangling reference here
    resolves to `None` rather than excluding the whole event: both
    relationships are optional by design (see `Event`'s docstring), so a
    venue/destination not being in this snapshot just means this
    particular event has one less related link, not that the event
    itself is unpublishable. Also computes `phase` (Upcoming/Live/Ended)
    from the snapshot's own stored date/time strings — never a stored
    snapshot field itself (see `app/api/event_timing.py`).
    """
    venue = venues_by_id.get(event["venue_id"])
    destination = destinations_by_id.get(event["destination_id"])
    phase = compute_event_phase(
        start_date=date.fromisoformat(event["start_date"]),
        end_date=date.fromisoformat(event["end_date"]) if event["end_date"] else None,
        start_time=time.fromisoformat(event["start_time"]) if event["start_time"] else None,
        end_time=time.fromisoformat(event["end_time"]) if event["end_time"] else None,
    )
    return {
        **event,
        "venue": VenueRef(id=venue["id"], name=venue["name"]) if venue else None,
        "destination": DestinationRef(id=destination["id"], name=destination["name"]) if destination else None,
        "phase": phase,
    }


@router.get("/events", response_model=list[PublishedEventOut])
def list_published_events(db: Session = Depends(get_db)):
    """Events Module v1 — same snapshot-only guarantee as every other
    `/public/*` route: reads only the current publish revision, never the
    draft `events` table, so draft/in-review/archived events can never
    appear here by construction."""
    revision = get_current_revision(db)
    if revision is None:
        return []

    venues_by_id = {v["id"]: v for v in revision.snapshot.get("venues", [])}
    destinations_by_id = {d["id"]: d for d in revision.snapshot.get("destinations", [])}
    return [
        resolve_published_event(e, venues_by_id, destinations_by_id)
        for e in revision.snapshot.get("events", [])
    ]


@router.get("/events/{event_slug}", response_model=PublishedEventOut)
def get_published_event(event_slug: str, db: Session = Depends(get_db)):
    """Single-event lookup for the Consumer detail page at `/events/{slug}`
    — looked up by `slug`, not `id` (unlike venues' `/public/venues/{id}`),
    per this module's own stable-public-slug requirement. Same `404`-
    covers-every-reason contract `get_published_venue` already gives
    (doesn't exist, draft/in-review, or approved but never published are
    all indistinguishable to a public caller)."""
    revision = get_current_revision(db)
    if revision is None:
        raise HTTPException(status_code=404, detail="Event not found")

    event = next((e for e in revision.snapshot.get("events", []) if e["slug"] == event_slug), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    venues_by_id = {v["id"]: v for v in revision.snapshot.get("venues", [])}
    destinations_by_id = {d["id"]: d for d in revision.snapshot.get("destinations", [])}
    return resolve_published_event(event, venues_by_id, destinations_by_id)
