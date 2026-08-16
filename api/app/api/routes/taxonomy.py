from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import TagOut
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Tag
from app.db.session import get_db

# Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — the
# read-only tag catalog endpoint Studio's assignment pickers need. No tag
# CRUD (see `Tag`'s docstring, app/db/models.py) — the catalog is seeded
# once by migration, not managed through this API. Mounted under /editor
# by app/api/router.py.
#
# HOME CURATION — `GET /collections` (and all Collection CRUD) moved to
# `app/api/routes/collections.py`: Collections stopped being a read-only
# catalog once real CRUD landed, so it no longer belongs alongside Tags
# here.
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
