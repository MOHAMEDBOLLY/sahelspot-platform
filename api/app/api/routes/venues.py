from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.schemas import SetCoverImageRequest, VenueListOut, VenueOut, VenueUpdate
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import Venue
from app.db.session import get_db
from app.media.service import upload_image
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
    """
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

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
    log_activity(db, action="submit_for_review", entity_type="venue", entity_id=venue.id, actor=user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue


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

    require_status(venue, expected="review", target="approved")

    venue.status = "approved"
    log_activity(db, action="approve", entity_type="venue", entity_id=venue.id, actor=user.id)
    db.commit()

    venue = db.get(Venue, venue_id, options=[joinedload(Venue.destination)])
    return venue
