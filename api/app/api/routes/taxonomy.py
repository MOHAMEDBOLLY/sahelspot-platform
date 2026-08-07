from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import CollectionOut, TagOut
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Collection, Tag
from app.db.session import get_db

# Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — the
# read-only catalog endpoints Studio's assignment pickers need. Phase 1 has
# no tag CRUD (see `Tag`'s docstring, app/db/models.py) and no collection
# CRUD either (Collections are assignment-only in this phase, per the
# approved plan) — both catalogs are seeded once by migration, not managed
# through this API yet. Mounted under /editor by app/api/router.py.
router = APIRouter(tags=["taxonomy"])


@router.get("/tags", response_model=list[TagOut])
def list_tags(
    category: str | None = Query(default=None, description="Exact category match — scopes the tag picker"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    query = db.query(Tag)
    if category:
        query = query.filter(Tag.category == category)
    return query.order_by(Tag.category, Tag.sort_order, Tag.label).all()


@router.get("/collections", response_model=list[CollectionOut])
def list_collections(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """Every collection, active or not — the Studio assignment picker
    itself decides whether to hide inactive ones; this endpoint doesn't
    filter, the same "don't duplicate a decision the caller should make"
    reasoning `list_venues` already follows for its own optional filters.
    """
    return db.query(Collection).order_by(Collection.sort_order, Collection.name).all()
