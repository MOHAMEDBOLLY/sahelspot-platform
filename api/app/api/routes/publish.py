from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import PublishRevisionDetail, PublishRevisionOut
from app.auth.dependencies import CurrentUser, get_current_user
from app.db.models import PublishRevision
from app.db.session import get_db
from app.publishing.engine import publish, republish

# Editorial only — the *management* of publish revisions (create one,
# inspect history, restore an old one). The public-facing read of the
# current revision's snapshot (`GET /published/venues` before Sprint 23,
# now `GET /public/venues`/`GET /public/destinations`) lives in
# `public.py` instead — a different router, mounted with no auth, so it
# can never accidentally share this file's editorial gate or vice versa.
# Mounted under /editor by app/api/router.py.
router = APIRouter(tags=["publish"])


@router.post("/publish", response_model=PublishRevisionOut)
def publish_current_approved_content(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Publish — snapshots every `approved` destination/venue into a new,
    immutable publish revision and makes it current. Not a status change:
    nothing here touches `destinations.status`/`venues.status` (see
    docs/ARCHITECTURE.md#publishing-architecture). Previous revisions are
    never overwritten — the old current, if any, is simply superseded.
    `user` is for activity attribution, not a second auth check — the
    router already enforces that.
    """
    return publish(db, actor=user.id)


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
def republish_revision(
    revision_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Republish (Sprint 18) — makes an existing revision current again.
    Never creates a new snapshot, never regenerates or edits any revision's
    data; only moves the `is_current` pointer, atomically, to a revision
    that already exists. `404` if the revision doesn't exist; `409` if it's
    already current. See `app/publishing/engine.py`'s `republish()` and
    docs/API.md's "Republish" section for why this is safer than any
    operation that would rewrite history.
    """
    return republish(db, revision_id, actor=user.id)
