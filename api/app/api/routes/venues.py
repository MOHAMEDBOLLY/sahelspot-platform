import csv
import io
import logging
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.concurrency import require_if_match, set_etag
from app.api.identifiers import check_reserved_id
from app.api.schemas import (
    BulkOperationResponse,
    BulkResultItem,
    BulkUpdateRequest,
    BulkVenueIdsRequest,
    RejectRequest,
    SetCoverImageRequest,
    VenueCreate,
    VenueListOut,
    VenueOut,
    VenueUpdate,
)
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import VENUE_CATEGORIES, Destination, Venue
from app.db.session import get_db
from app.media.service import delete_image, reject_if_declared_too_large, upload_image
from app.validation.schemas import ValidationResult
from app.validation.venues import validate_beach_details_shape, validate_venue
from app.workflow.transitions import require_status

# Editorial only — mounted under /editor by app/api/router.py, which also
# applies the router-level auth gate (see Sprint 23). As of Sprint 24,
# every route below also depends on `require_permission(Permission.X)` —
# the specific capability that route needs, never a role name (see
# `app/auth/permissions.py`). A `user: CurrentUser = Depends(get_current_user)`
# parameter appears only where the endpoint itself needs the identity (to
# attribute an activity log entry); FastAPI caches `get_current_user` per
# request, so declaring it alongside `require_permission(...)` never
# re-verifies the token.
router = APIRouter(prefix="/venues", tags=["venues"])
logger = logging.getLogger(__name__)


@router.get("", response_model=VenueListOut)
def list_venues(
    q: str | None = Query(default=None, description="Case-insensitive substring match on venue name"),
    destination_id: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """Sprint 27 — Search & Filter Foundation. All four query params are
    optional and combine with AND semantics (e.g. `q` + `category` narrows
    to both at once, not either). Deliberately plain `ILIKE` for `q`, not a
    `tsvector`/GIN index — docs/DATABASE.md already named that as deferred
    until AI Search is actually scoped, and nothing about this sprint
    changes that trigger; at this data volume a sequential scan is fine.
    An unrecognized `category`/`status` value isn't rejected — it just
    matches no rows, the same as any other filter value nothing has —
    rather than duplicating the `CHECK` constraint's own validation here.

    Response is paginated (`VenueListOut`, not a bare list) so the caller
    always knows `total`, keeping room for real pagination controls later
    without another response-shape change — but this sprint's frontend
    scope doesn't build page-by-page navigation, just search/filter, so it
    requests one generously-sized page rather than exposing page controls
    nobody asked for yet.
    """
    query = db.query(Venue).options(joinedload(Venue.destination))

    if q:
        query = query.filter(Venue.name.ilike(f"%{q}%"))
    if destination_id:
        query = query.filter(Venue.destination_id == destination_id)
    if category:
        query = query.filter(Venue.category == category)
    if status:
        query = query.filter(Venue.status == status)

    total = query.count()
    items = query.order_by(Venue.name).offset((page - 1) * page_size).limit(page_size).all()

    return VenueListOut(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=VenueOut, status_code=201)
def create_venue(
    payload: VenueCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §8.2 — the one write path venues never
    had. `id`/`slug` are caller-supplied (§8.2's own reasoning, mirroring
    `create_destination` below). Always starts `draft`. `category` is
    checked against the same 13-value set `validate_venue`/the DB `CHECK`
    both already enforce, so a typo fails cleanly here rather than as a
    raw integrity error; `beach_details` (if any) is checked against the
    same shape rule the DB constraint enforces (Phase 1, EP5).
    """
    check_reserved_id(payload.id)

    if db.get(Venue, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "venue_already_exists", "message": f"'{payload.id}' already exists."},
        )
    if db.get(Destination, payload.destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    if payload.category not in VENUE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_category", "message": f"'{payload.category}' is not a recognized category."},
        )
    validate_beach_details_shape(payload.category, payload.beach_details)

    venue = Venue(
        id=payload.id,
        name=payload.name,
        slug=payload.slug,
        destination_id=payload.destination_id,
        category=payload.category,
        district=payload.district,
        beach_details=payload.beach_details,
        status="draft",
    )
    db.add(venue)
    db.commit()

    venue = db.get(Venue, payload.id, options=[joinedload(Venue.destination)])
    return venue


@router.get("/export")
def export_venues(
    format: Literal["csv", "json"] = Query(default="json"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §8.7 — restores the legacy tool's
    Export capability, which has no equivalent in this platform today
    (write-only data is a regression, not a neutral gap). Registered here,
    before `/{venue_id}`, for the same route-ordering reason the bulk-*
    routes below are — `export` must never be swallowed by the
    `/{venue_id}` path parameter (see `check_reserved_id`, which also
    rejects `export` as a venue id at creation time).
    """
    venues = db.query(Venue).options(joinedload(Venue.destination)).order_by(Venue.name).all()
    rows = [VenueOut.model_validate(v).model_dump(mode="json") for v in venues]

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
        headers={"Content-Disposition": "attachment; filename=venues.csv"},
    )


# ---------------------------------------------------------------------------
# Bulk operations (Sprint 28)
#
# Deliberately registered here, immediately after `list_venues` and before
# `get_venue`/`update_venue`/etc. — not for readability, but because it's
# load-bearing: FastAPI/Starlette matches routes in registration order, and
# `/venues/{venue_id}` (below) would otherwise happily match a request to
# `/venues/bulk/validate` with `venue_id="bulk"` before this literal route
# ever got a chance to. Every bulk-* path below must stay registered above
# any `/venues/{venue_id}...` route for that reason.
#
# Each bulk endpoint reuses the *exact* function the single-item endpoint
# calls (`validate_venue()`, `_submit_for_review_or_raise()`,
# `_approve_or_raise()`) — none of the business logic below is
# reimplemented, only wrapped so one item's failure doesn't abort the rest
# of the batch. No background job, no queue: this is a synchronous loop
# over a capped (<=100) list of ids within a single request.
# ---------------------------------------------------------------------------


def _error_message(exc: HTTPException) -> str:
    """Every single-item action already raises `HTTPException` with either
    a plain string or a structured `{error, message, ...}` detail (see
    `_submit_for_review_or_raise`/`_approve_or_raise` below). Bulk results
    need one plain string per failed item — this is the one place that
    unwraps either shape, so no bulk handler duplicates that parsing.
    """
    if isinstance(exc.detail, dict):
        return exc.detail.get("message") or exc.detail.get("error") or str(exc.detail)
    return str(exc.detail)


@router.post("/bulk/validate", response_model=BulkOperationResponse)
def bulk_validate_venues(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Runs the same `validate_venue()` Editorial Readiness check
    `POST /venues/{id}/validate` uses, once per id. Read-only, like the
    single-item version — no venue is ever mutated here. `success` is
    `True` only when the venue was found *and* `ready_for_review` — a
    found-but-not-ready venue is a failed validation, not a successful
    check with a negative result, so the aggregate `succeeded`/`failed`
    counts (and the frontend's summary banner) reflect actual readiness.
    """
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        validation = validate_venue(venue)
        if validation.ready_for_review:
            results.append(BulkResultItem(venue_id=venue_id, success=True, validation=validation))
        else:
            results.append(
                BulkResultItem(
                    venue_id=venue_id,
                    success=False,
                    error="Venue is not ready for review.",
                    validation=validation,
                )
            )

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/submit-for-review", response_model=BulkOperationResponse)
def bulk_submit_venues_for_review(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_SUBMIT_REVIEW)),
):
    """Calls `_submit_for_review_or_raise()` — the same function
    `POST /venues/{id}/submit-for-review` calls — once per id. A venue
    that's not `draft`, or isn't ready per Editorial Readiness, fails as
    its own result row (same 409/422 reasoning as the single endpoint,
    just captured instead of returned as the whole request's status); it
    never stops the rest of the batch from being processed.
    """
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            _submit_for_review_or_raise(db, venue, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=_error_message(exc)))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/approve", response_model=BulkOperationResponse)
def bulk_approve_venues(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """Calls `_approve_or_raise()` — the same function
    `POST /venues/{id}/approve` calls — once per id. Same partial-failure
    handling as `bulk_submit_venues_for_review` above.
    """
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            _approve_or_raise(db, venue, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=_error_message(exc)))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/move-to-draft", response_model=BulkOperationResponse)
def bulk_move_venues_to_draft(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """Calls `_move_to_draft_or_raise()` — the same function
    `POST /venues/{id}/move-to-draft` calls — once per id. Same
    partial-failure handling as the other bulk-* endpoints above.
    """
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            _move_to_draft_or_raise(db, venue, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=_error_message(exc)))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/archive", response_model=BulkOperationResponse)
def bulk_archive_venues(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """Calls `_archive_or_raise()` — the same function
    `POST /venues/{id}/archive` calls — once per id."""
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            _archive_or_raise(db, venue, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=_error_message(exc)))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/restore", response_model=BulkOperationResponse)
def bulk_restore_venues(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """Calls `_restore_or_raise()` — the same function
    `POST /venues/{id}/restore` calls — once per id."""
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            _restore_or_raise(db, venue, user.id)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=_error_message(exc)))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.post("/bulk/delete", response_model=BulkOperationResponse)
def bulk_delete_venues(
    payload: BulkVenueIdsRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Same permission and the same permanent, non-cascading delete as
    `DELETE /venues/{id}` below — just looped over a capped id list, same
    partial-failure handling as every other bulk-* endpoint. A successful
    row's `venue` is `None` (the row no longer exists to return), matching
    how `BulkResultItem` already leaves fields unset for whichever fields
    an operation doesn't produce (see its docstring).
    """
    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        db.delete(venue)
        db.commit()
        results.append(BulkResultItem(venue_id=venue_id, success=True))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.patch("/bulk", response_model=BulkOperationResponse)
def bulk_update(
    payload: BulkUpdateRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.6 — replaces the two prior
    single-field endpoints (`bulk/category`, `bulk/destination`) with one:
    a venue-id list plus whichever of `category`/`destination_id` the
    caller wants to set, either or both in the same call. A bulk Save
    Draft, narrowed to these two fields — the same "set the attribute,
    commit" write `PATCH /venues/{id}` already does (see `update_venue`),
    just applied across many ids and not activity-logged, for the same
    reason Save Draft itself isn't (Sprint 19).

    Both fields are validated once, up front, exactly as the two prior
    endpoints each validated their own field — a typo/missing target
    should fail cleanly here, not as a raw integrity-constraint error.
    """
    if payload.category is None and payload.destination_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "no_fields_to_update",
                "message": "At least one of category or destination_id must be provided.",
            },
        )
    if payload.category is not None and payload.category not in VENUE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_category", "message": f"'{payload.category}' is not a recognized category."},
        )
    if payload.destination_id is not None and db.get(Destination, payload.destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            if payload.category is not None:
                venue.category = payload.category
            if payload.destination_id is not None:
                venue.destination_id = payload.destination_id
            db.commit()
        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                error = _error_message(exc)
            else:
                logger.exception("Unexpected error bulk-updating venue %s", venue_id)
                error = "Failed to update venue."
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=error))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(
    venue_id: str,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    set_etag(response, venue)
    return venue


@router.patch("/{venue_id}", response_model=VenueOut)
def update_venue(
    venue_id: str,
    payload: VenueUpdate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Save Draft: writes straight to the draft `venues` row, no status change.
    This is not Publish — nothing here touches `publish_revisions`.

    Also how Sprint 26 gallery **reordering** is done: `gallery_image_urls`
    is already a plain, order-preserving array (see docs/DATABASE.md's
    Sprint 2.5 "Images" decision), and was already made editable through
    this same payload in Sprint 25 — a reorder is just "set the array to
    this new order," which this endpoint already supports with no changes.
    No dedicated `/reorder` endpoint was added; that would duplicate a
    write path this one already provides.

    PLATFORM_SPEC_v1.0_FROZEN.md §4 — requires a matching `If-Match`
    (the venue's current `version`) before any write; a mismatch means
    someone else saved since this caller last read the venue. `version`
    increments by exactly one on a successful write, in the same
    transaction as the field updates. `beach_details`' shape (§7.8) is
    checked against the venue's *resulting* category — whichever of
    current/incoming is in effect after this payload is applied — since a
    single call may change both at once.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    require_if_match(request, venue, VenueOut)

    updates = payload.model_dump(exclude_unset=True)
    if "beach_details" in updates:
        resulting_category = updates.get("category", venue.category)
        validate_beach_details_shape(resulting_category, updates["beach_details"])

    for field, value in updates.items():
        setattr(venue, field, value)
    venue.version += 1

    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    set_etag(response, venue)
    return venue


@router.delete("/{venue_id}/media", response_model=VenueOut)
def delete_venue_media(
    venue_id: str,
    slot: Literal["cover", "gallery"] = Query(...),
    url: str | None = Query(default=None, description="Required when slot=gallery"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §8.4/§9.2 — the upload endpoints below
    had no counterpart to remove an image; this closes that gap. Cover:
    deletes the stored file and clears `cover_image_url`. Gallery: removes
    exactly the given `url` from `gallery_image_urls` and deletes that
    file — idempotent if `url` isn't present (matches the legacy tool's
    own "deleting an already-missing file is not an error" precedent).
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    if slot == "cover":
        if venue.cover_image_url:
            delete_image(venue.cover_image_url)
            venue.cover_image_url = None
    else:
        if not url:
            raise HTTPException(
                status_code=422,
                detail={"error": "url_required", "message": "url is required when slot=gallery."},
            )
        gallery = venue.gallery_image_urls or []
        if url in gallery:
            delete_image(url)
            venue.gallery_image_urls = [item for item in gallery if item != url]

    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/media", response_model=VenueOut)
async def upload_venue_media(
    request: Request,
    venue_id: str,
    slot: Literal["cover", "gallery"] = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Sprint 25 — Media Library Foundation. Uploads an image (via
    `app/media/service.py`, proxied through Supabase Storage) and
    immediately sets it on the venue: `cover_image_url` if `slot="cover"`,
    or appended to `gallery_image_urls` if `slot="gallery"`. Acts like Save
    Draft (writes straight to the draft row, no status change, not
    activity-logged — same reasoning Sprint 19 gave for why Save Draft
    itself isn't logged) rather than a separate draft/commit step, since
    an uploaded image is already a committed fact, not something to stage.

    Security hardening — `reject_if_declared_too_large` runs before the
    body is ever read, using the request's own `Content-Length` header, so
    an oversized upload is rejected without buffering it first. Kept
    after the 404 check, preserving the existing precedence (a
    nonexistent venue already 404s before any file handling, unchanged).
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    reject_if_declared_too_large(request.headers.get("content-length"))

    file_bytes = await file.read()
    url = upload_image(
        file_bytes,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        folder=f"venues/{venue_id}",
    )

    if slot == "cover":
        venue.cover_image_url = url
    else:
        # Reassigned, not appended in place — SQLAlchemy only detects a
        # change to an ARRAY column on assignment, not on in-place mutation
        # of the Python list object it's currently holding.
        venue.gallery_image_urls = (venue.gallery_image_urls or []) + [url]

    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/media/set-cover", response_model=VenueOut)
def set_cover_from_gallery(
    venue_id: str,
    payload: SetCoverImageRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Sprint 26 — promotes an existing gallery image to cover, without a
    re-upload or a call to `app/media/service.py` at all (no new file, so
    there's nothing to upload). `url` must already be in the venue's
    `gallery_image_urls` — this is a *promotion*, not "set cover to any
    arbitrary URL" (that's still possible via `PATCH`'s `cover_image_url`,
    unchanged since Sprint 25; this endpoint's own consistency guarantee is
    narrower and specific to "an image already in this venue's gallery").
    Deliberately leaves the image in the gallery too — cover is a
    designation, not an exclusive placement, so promoting doesn't require
    deciding whether to also remove it from the gallery.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    if payload.url not in (venue.gallery_image_urls or []):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "not_in_gallery",
                "message": "That image is not in this venue's gallery.",
            },
        )

    venue.cover_image_url = payload.url
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/validate", response_model=ValidationResult)
def validate_venue_route(
    venue_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
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


def _submit_for_review_or_raise(db: Session, venue: Venue, actor: str) -> None:
    """The entire `draft -> review` transition — status guard, Editorial
    Readiness check, status write, activity log — extracted so
    `submit_venue_for_review` (single) and `bulk_submit_venues_for_review`
    (Sprint 28) call the exact same logic instead of one reimplementing
    the other. Raises `HTTPException` (409 wrong status, 422 not ready) on
    rejection; does not commit — the caller decides when (single commits
    immediately, bulk commits per item so one failure can't roll back a
    sibling's already-applied change).
    """
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
    log_activity(db, action="submit_for_review", entity_type="venue", entity_id=venue.id, actor=actor)


@router.post("/{venue_id}/submit-for-review", response_model=VenueOut)
def submit_venue_for_review(
    venue_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_SUBMIT_REVIEW)),
):
    """Review — the first editorial state transition: `draft` -> `review`.
    This is an editorial *action* (it writes `status`), not a validation
    check — it reuses `validate_venue()` as a precondition rather than
    re-deciding readiness itself, so the two concepts stay separate (see
    docs/API.md's "Review Workflow" section). Not Approval or Publish:
    nothing here touches `publish_revisions`, and `review` is not a
    publishable state. `user` here is not a second auth check (the router
    already enforced that) — it's needed to attribute the activity entry.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    _submit_for_review_or_raise(db, venue, user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


def _approve_or_raise(db: Session, venue: Venue, actor: str) -> None:
    """The entire `review -> approved` transition, extracted for the same
    reason `_submit_for_review_or_raise` was: `approve_venue` (single) and
    `bulk_approve_venues` (Sprint 28) call this one function rather than
    duplicating the status guard + write + activity log.

    PLATFORM_SPEC_v1.0_FROZEN.md §1.2 — referential-closure prevention
    gate: a venue cannot be approved unless its destination is also
    `approved`. This is the common-case check; the publish engine's own
    filter (§1's actual closure guarantee) additionally catches drift that
    happens *after* this check passes (e.g. the destination is archived
    later).
    """
    require_status(venue, expected="review", target="approved")

    if venue.destination.status != "approved":
        raise HTTPException(
            status_code=422,
            detail={
                "error": "destination_not_approved",
                "message": (
                    f"Cannot approve this venue — its destination is "
                    f"'{venue.destination.status}', not 'approved'."
                ),
                "destination_status": venue.destination.status,
            },
        )

    venue.status = "approved"
    log_activity(db, action="approve", entity_type="venue", entity_id=venue.id, actor=actor)


@router.post("/{venue_id}/approve", response_model=VenueOut)
def approve_venue(
    venue_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """Approval — the second editorial state transition: `review` ->
    `approved`. A human editorial decision, not a validation re-run:
    Editorial Readiness was already the prerequisite for entering `review`
    in the first place (Sprint 14), so it is never repeated here — the only
    precondition Approval enforces is the status guard itself, via the same
    `require_status` Review already uses. Not Publish: nothing here touches
    `publish_revisions` — `approved` only makes a venue *eligible* for the
    next publish, it doesn't publish it. `user` is for activity attribution
    only — see `submit_venue_for_review` above.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    _approve_or_raise(db, venue, user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.post("/{venue_id}/reject", response_model=VenueOut)
def reject_venue(
    venue_id: str,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    """PLATFORM_SPEC_v1.0_FROZEN.md §7.4 — the `review -> draft` transition,
    now requiring a non-blank `reason` (enforced by `RejectRequest`'s own
    `min_length`), logged to `activity_log.metadata` so the submitting
    editor can see why. Same permission as Approve — both are the
    reviewer's decision on a submission, not the submitter's own.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    require_status(venue, expected="review", target="draft")

    venue.status = "draft"
    log_activity(
        db,
        action="reject",
        entity_type="venue",
        entity_id=venue.id,
        actor=user.id,
        metadata={"reason": payload.reason},
    )
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


# ---------------------------------------------------------------------------
# Venue Lifecycle Management — Draft/Approved/Archived, plus Delete
#
# Studio is otherwise frozen; this is the one gap the existing
# draft -> review -> approved workflow above never covered: an `approved`
# venue had no way back to `draft`, no way to retire it (`archived`) without
# deleting it outright, and no real delete at all. `archived` was already a
# legal value in `CONTENT_STATUSES`/the DB CHECK constraint (see
# `app/db/models.py`) — added when that shared vocabulary was defined,
# never wired to any transition until now. No migration needed.
#
# Same shape as every transition above: `require_status` guard, a private
# `_x_or_raise` helper shared by the single-item route and its bulk-*
# sibling, `log_activity`, caller commits. Gated behind
# `Permission.CONTENT_APPROVE` — the same bar Approve/Reject already use,
# since reversing an approval (back to Draft or to Archived) or restoring
# one is the same class of editorial decision, not a lesser one.
# ---------------------------------------------------------------------------


def _move_to_draft_or_raise(db: Session, venue: Venue, actor: str) -> None:
    """`approved -> draft` — an editor decided a live venue needs rework.
    Distinct from `reject_venue`'s `review -> draft` (that's a reviewer
    sending a submission back before it was ever approved); this is
    un-approving something already live.
    """
    require_status(venue, expected="approved", target="draft")
    venue.status = "draft"
    log_activity(db, action="move_to_draft", entity_type="venue", entity_id=venue.id, actor=actor)


@router.post("/{venue_id}/move-to-draft", response_model=VenueOut)
def move_venue_to_draft(
    venue_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    _move_to_draft_or_raise(db, venue, user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


def _archive_or_raise(db: Session, venue: Venue, actor: str) -> None:
    """`approved -> archived` — retires a venue from the Consumer Website
    (the publish engine only ever includes `approved` rows, see
    `app/publishing/engine.py`) without deleting it. Still fully editable
    in Studio, and reversible via Restore.
    """
    require_status(venue, expected="approved", target="archived")
    venue.status = "archived"
    log_activity(db, action="archive", entity_type="venue", entity_id=venue.id, actor=actor)


@router.post("/{venue_id}/archive", response_model=VenueOut)
def archive_venue(
    venue_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    _archive_or_raise(db, venue, user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


def _restore_or_raise(db: Session, venue: Venue, actor: str) -> None:
    """`archived -> approved` — the only way back out of Archived. Goes
    straight to `approved`, not through `review`/`draft` again: nothing
    about the venue's content changed while archived, so there's nothing
    new to re-review.
    """
    require_status(venue, expected="archived", target="approved")
    venue.status = "approved"
    log_activity(db, action="restore", entity_type="venue", entity_id=venue.id, actor=actor)


@router.post("/{venue_id}/restore", response_model=VenueOut)
def restore_venue(
    venue_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_APPROVE)),
):
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    _restore_or_raise(db, venue, user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


@router.delete("/{venue_id}", status_code=204)
def delete_venue(
    venue_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Permanent delete, any status — same permission, same non-cascading
    shape as `delete_destination` (`app/api/routes/destinations.py`), the
    first delete endpoint in this codebase. No soft-delete: `archived`
    already covers "hide without destroying," so Delete stays a real,
    irreversible `DELETE`, per the same "don't invent a second
    not-really-deleted state" reasoning `archived` itself was added for.
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    db.delete(venue)
    db.commit()
