import logging
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.schemas import (
    BulkCategoryUpdateRequest,
    BulkDestinationUpdateRequest,
    BulkOperationResponse,
    BulkResultItem,
    BulkVenueIdsRequest,
    SetCoverImageRequest,
    VenueListOut,
    VenueOut,
    VenueUpdate,
)
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import VENUE_CATEGORIES, Destination, Venue
from app.db.session import get_db
from app.media.service import reject_if_declared_too_large, upload_image
from app.validation.schemas import ValidationResult
from app.validation.venues import validate_venue
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


@router.patch("/bulk/category", response_model=BulkOperationResponse)
def bulk_update_category(
    payload: BulkCategoryUpdateRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """A bulk Save Draft, narrowed to one field — the same "set the
    attribute, commit" write `PATCH /venues/{id}` already does for
    `category` (see `update_venue`), just applied across many ids. Not
    activity-logged, for the same reason Save Draft itself isn't (Sprint
    19): it's a draft-content edit, not a workflow transition or publish
    event. `category` is validated once, up front, against the same fixed
    list the database's own `CHECK` constraint enforces — this is a
    mutation (unlike Sprint 27's search filter, which lets an unknown value
    just match nothing), so a typo should fail cleanly here rather than as
    a raw integrity-constraint error.
    """
    if payload.category not in VENUE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_category", "message": f"'{payload.category}' is not a recognized category."},
        )

    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            venue.category = payload.category
            db.commit()
        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                error = _error_message(exc)
            else:
                logger.exception("Unexpected error updating category for venue %s", venue_id)
                error = "Failed to update category."
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=error))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.patch("/bulk/destination", response_model=BulkOperationResponse)
def bulk_update_destination(
    payload: BulkDestinationUpdateRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Same shape as `bulk_update_category` above — a bulk Save Draft
    narrowed to one field. `destination_id` isn't part of `VenueUpdate`
    (Sprint 9 deliberately excluded it from single-item editing, since it
    "would need a real destination picker"); a bulk reassignment is a
    distinct, explicitly-scoped capability this sprint adds, not a
    backdoor into making it a free-text field on the single-item form.
    The target destination is validated to exist once, up front — the
    same 404-on-missing pattern every other route in this codebase uses,
    just checked before the loop instead of per item, since it's the same
    destination for every venue in the batch.
    """
    if db.get(Destination, payload.destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    results: list[BulkResultItem] = []
    for venue_id in payload.venue_ids:
        venue = db.get(Venue, venue_id)
        if venue is None:
            results.append(BulkResultItem(venue_id=venue_id, success=False, error="Venue not found"))
            continue
        try:
            venue.destination_id = payload.destination_id
            db.commit()
        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                error = _error_message(exc)
            else:
                logger.exception("Unexpected error updating destination for venue %s", venue_id)
                error = "Failed to update destination."
            results.append(BulkResultItem(venue_id=venue_id, success=False, error=error))
            continue
        venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
        results.append(BulkResultItem(venue_id=venue_id, success=True, venue=venue))

    succeeded = sum(1 for result in results if result.success)
    return BulkOperationResponse(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(
    venue_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@router.patch("/{venue_id}", response_model=VenueOut)
def update_venue(
    venue_id: str,
    payload: VenueUpdate,
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
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(venue, field, value)

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
    """
    require_status(venue, expected="review", target="approved")

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
