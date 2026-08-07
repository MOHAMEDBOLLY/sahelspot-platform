import logging

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
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.concurrency import require_if_match, set_etag
from app.api.event_timing import compute_event_phase
from app.api.identifiers import check_reserved_id
from app.api.schemas import (
    BulkEventIdsRequest,
    EventBulkOperationResponse,
    EventBulkResultItem,
    EventCreate,
    EventListOut,
    EventOut,
    EventUpdate,
    RejectRequest,
)
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import Destination, Event, Venue
from app.db.session import get_db
from app.media.service import delete_image, reject_if_declared_too_large, upload_image
from app.validation.events import validate_event
from app.workflow.transitions import require_status

# Events Module v1 — mounted under /editor by app/api/router.py, exactly
# the same auth/permission shape as venues.py/destinations.py. Reuses the
# *exact* CRUD + editorial-workflow + bulk + media patterns those two
# files already established — no new architecture, per the task's own
# instruction. Deliberately smaller than venues.py: no gallery (cover
# only), no category/beach_details-style shape validation, no export —
# none of those were asked for and every one is additive later if needed.
router = APIRouter(prefix="/events", tags=["events"])
logger = logging.getLogger(__name__)


def _serialize_event(event: Event) -> EventOut:
    """The one place `EventOut.phase` gets computed — every route that
    returns an event goes through this, never constructs `EventOut`
    directly, so the derived phase can never be forgotten on one path and
    present on another.
    """
    out = EventOut.model_validate(event)
    out.phase = compute_event_phase(
        start_date=event.start_date,
        end_date=event.end_date,
        start_time=event.start_time,
        end_time=event.end_time,
    )
    return out


def _get_with_refs(db: Session, event_id: str) -> Event | None:
    return db.get(
        Event,
        event_id,
        options=[joinedload(Event.venue), joinedload(Event.destination)],
    )


@router.get("", response_model=EventListOut)
def list_events(
    q: str | None = Query(default=None, description="Case-insensitive substring match on event title"),
    status: str | None = Query(default=None),
    venue_id: str | None = Query(default=None),
    destination_id: str | None = Query(default=None),
    featured: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """Same filter/pagination shape as `list_venues`/`list_destinations`.
    An unrecognized `status` value just matches no rows, same reasoning
    as venues' own filters."""
    query = db.query(Event).options(joinedload(Event.venue), joinedload(Event.destination))

    if q:
        query = query.filter(Event.title.ilike(f"%{q}%"))
    if status:
        query = query.filter(Event.status == status)
    if venue_id:
        query = query.filter(Event.venue_id == venue_id)
    if destination_id:
        query = query.filter(Event.destination_id == destination_id)
    if featured is not None:
        query = query.filter(Event.featured == featured)

    total = query.count()
    items = (
        query.order_by(Event.start_date, Event.title)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return EventListOut(
        items=[_serialize_event(e) for e in items], total=total, page=page, page_size=page_size
    )


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """`id`/`slug` caller-supplied, same reasoning as `create_destination`.
    Always starts `draft`. `venue_id`/`destination_id`, if given, must
    reference real rows — same "fail cleanly with a 404 here rather than
    a raw FK-violation 500" reasoning `create_venue` already applies to
    `destination_id`. At least one of the two is required (see
    `ck_events_has_location`, 0013_events_require_location.py) — checked
    here first so a missing location fails with a clear 422, not a raw
    CHECK-constraint IntegrityError.
    """
    check_reserved_id(payload.id)

    if payload.venue_id is None and payload.destination_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "location_required",
                "message": "An event must reference a venue, a destination, or both.",
            },
        )
    if db.get(Event, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "event_already_exists", "message": f"'{payload.id}' already exists."},
        )
    if db.query(Event).filter(Event.slug == payload.slug).first() is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "slug_already_exists", "message": f"Slug '{payload.slug}' already exists."},
        )
    if payload.venue_id is not None and db.get(Venue, payload.venue_id) is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    if payload.destination_id is not None and db.get(Destination, payload.destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    event = Event(
        id=payload.id,
        title=payload.title,
        slug=payload.slug,
        status="draft",
        start_date=payload.start_date,
        end_date=payload.end_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        venue_id=payload.venue_id,
        destination_id=payload.destination_id,
        short_description=payload.short_description,
        ticket_provider=payload.ticket_provider,
        ticket_url=payload.ticket_url,
        external_event_id=payload.external_event_id,
    )
    db.add(event)
    db.commit()

    event = _get_with_refs(db, payload.id)
    return _serialize_event(event)


# ---------------------------------------------------------------------------
# Bulk operations (registered here, before any `/{event_id}...` route below)
#
# Same reason venues.py's bulk-* block is registered immediately after
# `list_venues`/`create_venue` and before `get_venue`/`update_venue`/etc.:
# FastAPI/Starlette matches routes in registration order, and a bare
# `/events/{event_id}` (or `/events/{event_id}/submit-for-review`, which
# has the exact same shape as `/events/bulk/submit-for-review`) would
# otherwise happily match a request to `/events/bulk/submit-for-review`
# with `event_id="bulk"` before this literal route ever got a chance to.
# Every bulk-* path below must stay registered above any
# `/events/{event_id}...` route for that reason.
#
# Each bulk endpoint calls the *exact* private helper the single-item
# endpoint calls (defined further down this file — plain function name
# resolution happens at call time, well after the whole module has
# finished importing, so the forward reference is safe) — none of the
# transition logic is reimplemented here, only wrapped so one item's
# failure doesn't abort the rest of the batch.
# ---------------------------------------------------------------------------


def _bulk_error_message(exc: HTTPException) -> str:
    if isinstance(exc.detail, dict):
        return exc.detail.get("message") or exc.detail.get("error") or str(exc.detail)
    return str(exc.detail)


@router.post("/bulk/submit-for-review", response_model=EventBulkOperationResponse)
def bulk_submit_events_for_review(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_SUBMIT_REVIEW)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        try:
            _submit_for_review_or_raise(db, event, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(EventBulkResultItem(event_id=event_id, success=False, error=_bulk_error_message(exc)))
            continue
        event = _get_with_refs(db, event_id)
        results.append(EventBulkResultItem(event_id=event_id, success=True, event=_serialize_event(event)))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/approve", response_model=EventBulkOperationResponse)
def bulk_approve_events(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        try:
            _approve_or_raise(db, event, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(EventBulkResultItem(event_id=event_id, success=False, error=_bulk_error_message(exc)))
            continue
        event = _get_with_refs(db, event_id)
        results.append(EventBulkResultItem(event_id=event_id, success=True, event=_serialize_event(event)))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/move-to-draft", response_model=EventBulkOperationResponse)
def bulk_move_events_to_draft(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        try:
            _move_to_draft_or_raise(db, event, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(EventBulkResultItem(event_id=event_id, success=False, error=_bulk_error_message(exc)))
            continue
        event = _get_with_refs(db, event_id)
        results.append(EventBulkResultItem(event_id=event_id, success=True, event=_serialize_event(event)))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/archive", response_model=EventBulkOperationResponse)
def bulk_archive_events(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        try:
            _archive_or_raise(db, event, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(EventBulkResultItem(event_id=event_id, success=False, error=_bulk_error_message(exc)))
            continue
        event = _get_with_refs(db, event_id)
        results.append(EventBulkResultItem(event_id=event_id, success=True, event=_serialize_event(event)))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/restore", response_model=EventBulkOperationResponse)
def bulk_restore_events(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        try:
            _restore_or_raise(db, event, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(EventBulkResultItem(event_id=event_id, success=False, error=_bulk_error_message(exc)))
            continue
        event = _get_with_refs(db, event_id)
        results.append(EventBulkResultItem(event_id=event_id, success=True, event=_serialize_event(event)))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/delete", response_model=EventBulkOperationResponse)
def bulk_delete_events(
    payload: BulkEventIdsRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    results: list[EventBulkResultItem] = []
    for event_id in payload.event_ids:
        event = db.get(Event, event_id)
        if event is None:
            results.append(EventBulkResultItem(event_id=event_id, success=False, error="Event not found"))
            continue
        db.delete(event)
        db.commit()
        results.append(EventBulkResultItem(event_id=event_id, success=True))

    succeeded = sum(1 for r in results if r.success)
    return EventBulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    event = _get_with_refs(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    set_etag(response, event)
    return _serialize_event(event)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Save Draft — same shape as `update_venue`/`update_destination`:
    writes straight to the draft row, `If-Match` required, no status
    change here. `venue_id`/`destination_id`'s *resulting* values (whichever
    of current/incoming is in effect after this payload) must not both be
    null — same "check the row's state after this call, not just what was
    sent" reasoning `update_venue`'s `beach_details` check already uses."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    require_if_match(request, event, EventOut)

    updates = payload.model_dump(exclude_unset=True)
    if "venue_id" in updates and updates["venue_id"] is not None:
        if db.get(Venue, updates["venue_id"]) is None:
            raise HTTPException(status_code=404, detail="Venue not found")
    if "destination_id" in updates and updates["destination_id"] is not None:
        if db.get(Destination, updates["destination_id"]) is None:
            raise HTTPException(status_code=404, detail="Destination not found")

    resulting_venue_id = updates.get("venue_id", event.venue_id)
    resulting_destination_id = updates.get("destination_id", event.destination_id)
    if resulting_venue_id is None and resulting_destination_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "location_required",
                "message": "An event must reference a venue, a destination, or both.",
            },
        )

    for field, value in updates.items():
        setattr(event, field, value)
    event.version += 1

    db.commit()

    event = _get_with_refs(db, event_id)
    set_etag(response, event)
    return _serialize_event(event)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Permanent delete, any status — same shape as `delete_destination`/
    the venue lifecycle's `delete_venue`. No dependent-row guard needed:
    nothing has a foreign key onto `events.id`."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()


@router.post("/{event_id}/validate", response_model=None)
def validate_event_route(
    event_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return validate_event(event)


def _submit_for_review_or_raise(db: Session, event: Event, actor: str) -> None:
    require_status(event, expected="draft", target="review")

    result = validate_event(event)
    if not result.ready_for_review:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "not_ready_for_review",
                "message": "Event is not ready for review.",
                "errors": [error.model_dump() for error in result.errors],
            },
        )

    event.status = "review"
    log_activity(db, action="submit_for_review", entity_type="event", entity_id=event.id, actor=actor)


@router.post("/{event_id}/submit-for-review", response_model=EventOut)
def submit_event_for_review(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_SUBMIT_REVIEW)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    _submit_for_review_or_raise(db, event, user.id)
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


def _approve_or_raise(db: Session, event: Event, actor: str) -> None:
    require_status(event, expected="review", target="approved")
    event.status = "approved"
    log_activity(db, action="approve", entity_type="event", entity_id=event.id, actor=actor)


@router.post("/{event_id}/approve", response_model=EventOut)
def approve_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    _approve_or_raise(db, event, user.id)
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


@router.post("/{event_id}/reject", response_model=EventOut)
def reject_event(
    event_id: str,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    require_status(event, expected="review", target="draft")

    event.status = "draft"
    log_activity(
        db,
        action="reject",
        entity_type="event",
        entity_id=event.id,
        actor=user.id,
        metadata={"reason": payload.reason},
    )
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


def _move_to_draft_or_raise(db: Session, event: Event, actor: str) -> None:
    require_status(event, expected="approved", target="draft")
    event.status = "draft"
    log_activity(db, action="move_to_draft", entity_type="event", entity_id=event.id, actor=actor)


@router.post("/{event_id}/move-to-draft", response_model=EventOut)
def move_event_to_draft(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    _move_to_draft_or_raise(db, event, user.id)
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


def _archive_or_raise(db: Session, event: Event, actor: str) -> None:
    require_status(event, expected="approved", target="archived")
    event.status = "archived"
    log_activity(db, action="archive", entity_type="event", entity_id=event.id, actor=actor)


@router.post("/{event_id}/archive", response_model=EventOut)
def archive_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    _archive_or_raise(db, event, user.id)
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


def _restore_or_raise(db: Session, event: Event, actor: str) -> None:
    require_status(event, expected="archived", target="approved")
    event.status = "approved"
    log_activity(db, action="restore", entity_type="event", entity_id=event.id, actor=actor)


@router.post("/{event_id}/restore", response_model=EventOut)
def restore_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    _restore_or_raise(db, event, user.id)
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


@router.post("/{event_id}/media", response_model=EventOut)
async def upload_event_media(
    request: Request,
    event_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Cover only — events have no gallery in v1 (see `Event`'s docstring).
    Same upload shape as `upload_venue_media`'s cover branch: uploads via
    `app/media/service.py`, sets `cover_image_url` immediately, acts like
    Save Draft (no status change, not activity-logged)."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    reject_if_declared_too_large(request.headers.get("content-length"))

    file_bytes = await file.read()
    url = await upload_image(
        file_bytes,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        folder=f"events/{event_id}",
    )
    event.cover_image_url = url
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)


@router.delete("/{event_id}/media", response_model=EventOut)
async def delete_event_media(
    event_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.cover_image_url:
        await delete_image(event.cover_image_url)
        event.cover_image_url = None
    db.commit()

    event = _get_with_refs(db, event_id)
    return _serialize_event(event)
