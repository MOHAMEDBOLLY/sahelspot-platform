from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import PlatformStatsOut
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Destination, Venue
from app.db.session import get_db

# PLATFORM_SPEC_v1.0_FROZEN.md §2.9/§8.9 (`GET /editor/stats`) — the
# Dashboard's data source, computed live, no stored table. Its own file
# rather than folding into destinations.py/venues.py since it's
# platform-wide, not scoped to either entity.
router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=PlatformStatsOut)
def get_platform_stats(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    venue_count = db.query(Venue).count()
    destination_count = db.query(Destination).count()
    category_count = db.query(Venue.category).distinct().count()
    with_cover = db.query(Venue).filter(Venue.cover_image_url.isnot(None)).count()
    with_instagram = db.query(Venue).filter(Venue.instagram_handle.isnot(None)).count()
    with_website = db.query(Venue).filter(Venue.website.isnot(None)).count()
    with_phone = db.query(Venue).filter(Venue.phone.isnot(None)).count()

    pct_cover = round((with_cover / venue_count * 100), 1) if venue_count else 0.0
    pct_instagram = round((with_instagram / venue_count * 100), 1) if venue_count else 0.0

    return PlatformStatsOut(
        venues=venue_count,
        destinations=destination_count,
        categories=category_count,
        with_cover=with_cover,
        with_instagram=with_instagram,
        with_website=with_website,
        with_phone=with_phone,
        pct_cover=pct_cover,
        pct_instagram=pct_instagram,
    )
