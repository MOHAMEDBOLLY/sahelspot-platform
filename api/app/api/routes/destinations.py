from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.schemas import DestinationCreate, DestinationListOut, DestinationOut, DestinationUpdate
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Destination, Venue
from app.db.session import get_db
from app.media.service import upload_image

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
    if db.get(Destination, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "destination_already_exists", "message": f"'{payload.id}' already exists."},
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
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    return destination


@router.patch("/{destination_id}", response_model=DestinationOut)
def update_destination(
    destination_id: str,
    payload: DestinationUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
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

    db.delete(destination)
    db.commit()


@router.post("/{destination_id}/media", response_model=DestinationOut)
async def upload_destination_cover(
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
    """
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")

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
