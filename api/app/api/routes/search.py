from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.public_cache import (
    client_has_current_revision,
    not_modified_response,
    set_public_cache_headers,
)
from app.api.routes.public import resolve_published_venue
from app.api.schemas import PublishedVenueOut
from app.db.session import get_db
from app.publishing.engine import get_current_revision, get_current_revision_id

# M7 (consumer Release 1) — search as its own capability, deliberately not
# `q`/`category` params bolted onto `GET /public/venues`: that endpoint's
# semantics (the full published list) stay exactly as they are, and this
# can grow to cover destinations/collections/events later as sibling
# routes here, without ever touching venues.py or public.py's list route.
# Mounted under /public by app/api/router.py — no auth, same as every
# other /public/* route.
router = APIRouter(prefix="/search", tags=["search"])


@router.get("/venues", response_model=list[PublishedVenueOut])
def search_published_venues(
    request: Request,
    response: Response,
    q: str | None = Query(default=None, description="Case-insensitive substring match on venue name"),
    category: str | None = Query(default=None, description="Exact category match"),
    destination: str | None = Query(default=None, description="Exact destination id match"),
    tags: str | None = Query(
        default=None,
        description=(
            "Comma-separated tag slugs. OR semantics — a venue matches if it "
            "carries ANY of the requested tags, not all of them (approved "
            "architecture decision, Category/Tags/Access Type/Badges/"
            "Collections Phase 1)."
        ),
    ),
    access_type: str | None = Query(
        default=None, alias="accessType", description="Exact Access Type match, e.g. 'Public', 'QR Required'"
    ),
    db: Session = Depends(get_db),
):
    """Reads *only* the current publish revision's frozen snapshot — same
    guarantee every `/public/*` route already has, via the same
    `get_current_revision()` helper. Since the public data source is a
    JSON snapshot, not a queryable table, filtering happens in memory over
    `revision.snapshot["venues"]`, not as a SQL query — a real
    implementation difference from `/editor/venues`'s `ILIKE`/DB-level
    search (Sprint 27), even though the filtering *intent* (case-
    insensitive name substring + exact category + exact destination +
    exact access type + any-of tags, all AND-combined with each other) is
    the same. Reuses `resolve_published_venue` (app/api/routes/public.py)
    for the destination-merge step rather than re-deriving it. `destination`
    matches `venue["destination_id"]` directly (the raw snapshot field, not
    the resolved `DestinationRef`) — same id Home's Explore Destinations
    cards already link with.
    """
    # H2 — the ETag is per-URL: one revision id validates every distinct
    # query-string combination, because a given revision yields a
    # deterministic result for a given query. Caches key on the full URL
    # (RFC 9111 §4.1), so distinct queries never collide with each other.
    revision_id = get_current_revision_id(db)
    if revision_id is None:
        return []
    if client_has_current_revision(request, revision_id):
        return not_modified_response(revision_id)

    revision = get_current_revision(db)
    if revision is None:
        return []
    set_public_cache_headers(response, revision_id)

    requested_tags = {tag.strip() for tag in tags.split(",") if tag.strip()} if tags else None

    destinations_by_id = {d["id"]: d for d in revision.snapshot.get("destinations", [])}
    results = []
    for venue in revision.snapshot.get("venues", []):
        if q and q.lower() not in venue["name"].lower():
            continue
        if category and venue["category"] != category:
            continue
        if destination and venue["destination_id"] != destination:
            continue
        if access_type and venue.get("access_type") != access_type:
            continue
        if requested_tags and not requested_tags.intersection(venue.get("tags") or []):
            continue
        resolved = resolve_published_venue(venue, destinations_by_id)
        if resolved is not None:
            results.append(resolved)
    return results
