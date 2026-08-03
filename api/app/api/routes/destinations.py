import csv
import io
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.activity.service import log_activity
from app.api.concurrency import require_if_match, set_etag
from app.api.identifiers import check_reserved_id
from app.api.schemas import (
    DestinationCreate,
    DestinationListOut,
    DestinationOut,
    DestinationStatsOut,
    DestinationUpdate,
    RejectRequest,
)
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import DESTINATION_REGIONS, Destination, Event, Venue
from app.db.session import get_db
from app.media.service import reject_if_declared_too_large, upload_image
from app.validation.destinations import validate_destination
from app.workflow.transitions import require_status

# Editorial only — mounted under /editor by app/api/router.py, which also
# applies the router-level auth gate (see Sprint 23). As of Sprint 24,
# every route below also depends on `require_permission(Permission.X)` —
# no endpoint here needs the caller's identity for anything beyond that
# (no activity is logged for Save Draft, create, delete, or cover upload —
# all four are draft-content operations, not workflow transitions or
# publish events, same reasoning Sprint 19 gives for why Save Draft itself
# isn't logged), so unlike venues.py's workflow endpoints, nothing in this
# file declares a `user: CurrentUser = Depends(get_current_user)`
# parameter of its own.
router = APIRouter(prefix="/destinations", tags=["destinations"])

_VALID_BOUNDARY_TYPES = {"Polygon", "MultiPolygon"}


def _validate_boundary_shape(boundary: dict | None) -> None:
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.3 — `boundary` is now writable
    through `PATCH`; this checks it's at least a plausible GeoJSON
    `Polygon`/`MultiPolygon` (the two shapes §2.1 names), not a full
    geometry validator — deep coordinate-validity checking is out of
    scope, the same practical limit already applied to `beach_details`.
    """
    if boundary is None:
        return
    if boundary.get("type") not in _VALID_BOUNDARY_TYPES or "coordinates" not in boundary:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_boundary",
                "message": "boundary must be a GeoJSON Polygon or MultiPolygon with a 'coordinates' array.",
            },
        )


@router.get("", response_model=DestinationListOut)
def list_destinations(
    q: str | None = Query(default=None, description="Case-insensitive substring match on destination name"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """Sprint 29 — the same search + pagination shape Sprint 27 gave
    `GET /venues`: optional `q` (plain `ILIKE`, same reasoning as venues —
    no `tsvector`/GIN index, deferred until AI Search is scoped), `page`/
    `page_size` capped at 100. No `status` or other filter — destinations
    have no `category`/`destination` fields to filter by the way venues
    do, and no filter beyond `q` was in this sprint's scope.
    """
    query = db.query(Destination)
    if q:
        query = query.filter(Destination.name.ilike(f"%{q}%"))

    total = query.count()
    items = query.order_by(Destination.name).offset((page - 1) * page_size).limit(page_size).all()

    return DestinationListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/export")
def export_destinations(
    format: Literal["csv", "json"] = Query(default="json"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §8.7 — same rationale as venues'
    export. Registered before `/{destination_id}` for the same
    route-ordering reason (`export` is a reserved id, see
    `check_reserved_id`, and must never be swallowed by the path param).
    """
    destinations = db.query(Destination).order_by(Destination.name).all()
    rows = [DestinationOut.model_validate(d).model_dump(mode="json") for d in destinations]

    if format == "json":
        return rows

    buffer = io.StringIO()
    if rows:
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: (v if not isinstance(v, (dict, list)) else str(v)) for k, v in row.items()})
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=destinations.csv"},
    )


@router.post("", response_model=DestinationOut, status_code=201)
def create_destination(
    payload: DestinationCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Sprint 29 — the one write path venues never had an equivalent of:
    venues has no `POST /venues` at all (venues only ever arrive via seed/
    import), so this isn't "reuse the venue creation pattern," it's new.
    `id` is caller-supplied (the destination's slug, its actual primary
    key — see `DestinationCreate`'s docstring) and must not already exist;
    a duplicate is a `409`, the same status this codebase already uses for
    "this specific thing can't happen right now" (see `require_status`'s
    invalid-transition error). New destinations always start `draft`, same
    as any other row entering this schema's editorial lifecycle.
    """
    check_reserved_id(payload.id)

    if db.get(Destination, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "destination_already_exists", "message": f"'{payload.id}' already exists."},
        )
    if payload.region not in DESTINATION_REGIONS:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_region", "message": f"'{payload.region}' is not a recognized region."},
        )

    destination = Destination(
        id=payload.id,
        name=payload.name,
        region=payload.region,
        status="draft",
        aliases=payload.aliases,
        notes=payload.notes,
    )
    db.add(destination)
    db.commit()
    db.refresh(destination)
    return destination


@router.get("/{destination_id}", response_model=DestinationOut)
def get_destination(
    destination_id: str,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    set_etag(response, destination)
    return destination


@router.get("/{destination_id}/stats", response_model=DestinationStatsOut)
def get_destination_stats(
    destination_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §2.1/§8.1 — replaces the legacy stored
    `venueCount`/`verifiedCount`/`categoryBreakdown` with the same facts,
    computed live (Principle 1.4). Registered under `/{destination_id}/...`
    so it needs no route-ordering care relative to the bare `/{destination_id}`
    route above — a longer path never collides with a shorter one.
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    venues = db.query(Venue).filter(Venue.destination_id == destination_id).all()
    breakdown: dict[str, int] = {}
    verified_count = 0
    for venue in venues:
        breakdown[venue.category] = breakdown.get(venue.category, 0) + 1
        if venue.is_verified:
            verified_count += 1

    return DestinationStatsOut(
        venue_count=len(venues),
        verified_count=verified_count,
        category_breakdown=breakdown,
    )


@router.patch("/{destination_id}", response_model=DestinationOut)
def update_destination(
    destination_id: str,
    payload: DestinationUpdate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Save Draft: writes straight to the draft `destinations` row, no
    status change. Same pattern as `update_venue` in routes/venues.py.

    PLATFORM_SPEC_v1.0_FROZEN.md §4 — requires a matching `If-Match`
    before any write, same protocol as venues. §7.3 — `boundary` is now
    accepted and shape-checked. `region`, if sent, is checked against the
    same 8-value set the DB `CHECK` enforces, so a typo fails cleanly here.
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    require_if_match(request, destination, DestinationOut)

    updates = payload.model_dump(exclude_unset=True)
    if "boundary" in updates:
        _validate_boundary_shape(updates["boundary"])
    if "region" in updates and updates["region"] not in DESTINATION_REGIONS:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_region", "message": f"'{updates['region']}' is not a recognized region."},
        )

    for field, value in updates.items():
        setattr(destination, field, value)
    destination.version += 1

    db.commit()

    destination = db.get(Destination, destination_id)
    set_etag(response, destination)
    return destination


@router.delete("/{destination_id}", status_code=204)
def delete_destination(
    destination_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Sprint 29 — the first delete endpoint in this codebase. Deliberately
    not a cascade: `venues.destination_id` is already `NOT NULL ON DELETE
    RESTRICT` at the database level (docs/DATABASE.md), so a destination
    with venues attached can never be deleted out from under them, by
    construction. This route pre-checks that same condition itself — not
    because the database wouldn't catch it, but so the caller gets a
    clear, structured `409` instead of a raw `IntegrityError` (the same
    "pre-validate instead of letting a constraint violation surface as a
    500" reasoning already used for bulk category updates in Sprint 28).
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    venue_count = db.query(Venue).filter(Venue.destination_id == destination_id).count()
    if venue_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "destination_has_venues",
                "message": f"Cannot delete '{destination.name}' — it still has {venue_count} venue(s).",
            },
        )

    # Events Module v1 — same reasoning as `delete_venue`'s own guard:
    # `events.destination_id` is `ON DELETE SET NULL`, but
    # `ck_events_has_location` requires at least one of venue/destination,
    # so an event whose *only* location is this destination can't have
    # that FK silently nulled without violating the constraint.
    orphaned_event_count = (
        db.query(Event)
        .filter(Event.destination_id == destination_id, Event.venue_id.is_(None))
        .count()
    )
    if orphaned_event_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "destination_has_sole_events",
                "message": (
                    f"Cannot delete '{destination.name}' — {orphaned_event_count} event(s) have no "
                    "other location and would be left with none. Give them a venue first, or delete them."
                ),
            },
        )

    db.delete(destination)
    db.commit()


@router.post("/{destination_id}/media", response_model=DestinationOut)
async def upload_destination_cover(
    request: Request,
    destination_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Sprint 29 — cover only, no `slot` param the way venues' upload
    endpoint has one: destinations deliberately don't get a gallery (out
    of scope), so there's nothing to choose between. Reuses
    `app/media/service.py`'s `upload_image()` unchanged — the same
    function venues' upload endpoint calls, not a second implementation.

    Security hardening — see `upload_venue_media`'s equivalent comment;
    same early-rejection-by-Content-Length, same precedence (404 first,
    unchanged).
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    reject_if_declared_too_large(request.headers.get("content-length"))

    file_bytes = await file.read()
    url = upload_image(
        file_bytes,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        folder=f"destinations/{destination_id}",
    )

    destination.cover_image_url = url
    db.commit()
    db.refresh(destination)
    return destination


def _submit_destination_for_review_or_raise(db: Session, destination: Destination, actor: str) -> None:
    """PLATFORM_SPEC_v1.0_FROZEN.md §4/§8.1 — destination workflow parity
    with venues: `draft -> review`, gated by the same Editorial Readiness
    shape (`validate_destination`, §4.4), same structure as venues'
    `_submit_for_review_or_raise`.
    """
    require_status(destination, expected="draft", target="review")

    result = validate_destination(destination)
    if not result.ready_for_review:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "not_ready_for_review",
                "message": "Destination is not ready for review.",
                "errors": [error.model_dump() for error in result.errors],
            },
        )

    destination.status = "review"
    log_activity(db, action="submit_for_review", entity_type="destination", entity_id=destination.id, actor=actor)


@router.post("/{destination_id}/submit-for-review", response_model=DestinationOut)
def submit_destination_for_review(
    destination_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_SUBMIT_REVIEW)),
):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    _submit_destination_for_review_or_raise(db, destination, user.id)
    db.commit()

    destination = db.get(Destination, destination_id)
    return destination


@router.post("/{destination_id}/approve", response_model=DestinationOut)
def approve_destination(
    destination_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §4 — `review -> approved`. Unlike
    venues' Approve, there is no cross-entity gate here — a destination's
    approval doesn't depend on any other row's state; it is venues that
    depend on their destination (see `app/api/routes/venues.py`'s
    `_approve_or_raise`), not the reverse.
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    require_status(destination, expected="review", target="approved")
    destination.status = "approved"
    log_activity(db, action="approve", entity_type="destination", entity_id=destination.id, actor=user.id)
    db.commit()

    destination = db.get(Destination, destination_id)
    return destination


@router.post("/{destination_id}/reject", response_model=DestinationOut)
def reject_destination(
    destination_id: str,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.4 — same reason-required Reject as
    venues, applied to destinations.
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    require_status(destination, expected="review", target="draft")
    destination.status = "draft"
    log_activity(
        db,
        action="reject",
        entity_type="destination",
        entity_id=destination.id,
        actor=user.id,
        metadata={"reason": payload.reason},
    )
    db.commit()

    destination = db.get(Destination, destination_id)
    return destination
