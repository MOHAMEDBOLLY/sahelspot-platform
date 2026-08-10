from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import (
    NoQrAreaCreate,
    NoQrAreaListOut,
    NoQrAreaOut,
    NoQrAreaUpdate,
    NoQrPlaceCreate,
    NoQrPlaceOut,
    NoQrPlaceUpdate,
)
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import NoQrArea, NoQrPlace
from app.db.session import get_db
from app.validation.no_qr import (
    validate_no_qr_area_name,
    validate_no_qr_area_type,
    validate_no_qr_place_identity,
    validate_no_qr_place_not_duplicate,
    validate_no_qr_place_venue,
)

# STUDIO — NO QR INDEPENDENT ENTITY (Phase 1) — mounted under /editor by
# app/api/router.py, same auth/permission shape as venues.py/events.py.
# Deliberately its own router, not folded into venues.py: a Walk/Mall is
# not a Venue (see NoQrArea's own docstring, api/app/db/models.py), so
# giving it Area semantics inside the Venue API would blur exactly the
# distinction this whole feature exists to establish. No workflow
# (draft/review/approved), no media, no bulk actions — none of those were
# asked for in Phase 1 and every one is additive later if needed.
#
# Two routers, both mounted here: `/no-qr-areas` for the Area resource
# (list/create/get/update/delete, plus creating a place under an area),
# and a top-level `/no-qr-places` for updating/deleting one place by its
# own id — a place's id is already globally unique, so `PATCH
# /no-qr-places/{id}` doesn't need its parent area in the path, matching
# the approved API structure.
router = APIRouter(prefix="/no-qr-areas", tags=["no-qr"])
places_router = APIRouter(prefix="/no-qr-places", tags=["no-qr"])


def _get_area_or_404(db: Session, area_id: int) -> NoQrArea:
    area = db.get(NoQrArea, area_id, options=[joinedload(NoQrArea.places).joinedload(NoQrPlace.venue)])
    if area is None:
        raise HTTPException(status_code=404, detail="No QR Area not found")
    return area


@router.get("", response_model=NoQrAreaListOut)
def list_no_qr_areas(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    areas = (
        db.query(NoQrArea)
        .options(joinedload(NoQrArea.places).joinedload(NoQrPlace.venue))
        .order_by(NoQrArea.name)
        .all()
    )
    return NoQrAreaListOut(items=[NoQrAreaOut.model_validate(area) for area in areas])


@router.post("", response_model=NoQrAreaOut, status_code=201)
def create_no_qr_area(
    payload: NoQrAreaCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    validate_no_qr_area_type(payload.type)
    validate_no_qr_area_name(payload.name)

    area = NoQrArea(name=payload.name.strip(), type=payload.type)
    db.add(area)
    db.commit()
    db.refresh(area)
    return NoQrAreaOut.model_validate(area)


@router.get("/{area_id}", response_model=NoQrAreaOut)
def get_no_qr_area(
    area_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    area = _get_area_or_404(db, area_id)
    return NoQrAreaOut.model_validate(area)


@router.patch("/{area_id}", response_model=NoQrAreaOut)
def update_no_qr_area(
    area_id: int,
    payload: NoQrAreaUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """`type` is not accepted here at all (see `NoQrAreaUpdate`'s own
    docstring) — only `name` can change after creation."""
    area = _get_area_or_404(db, area_id)
    validate_no_qr_area_name(payload.name)
    area.name = payload.name.strip()
    db.commit()
    db.refresh(area)
    return NoQrAreaOut.model_validate(area)


@router.delete("/{area_id}", status_code=204)
def delete_no_qr_area(
    area_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Deletes the Area and its places (`no_qr_places.area_id` is `ON
    DELETE CASCADE`) — never the linked Venues themselves, only the
    `NoQrPlace` rows referencing them. Not wired into the Phase 1 Studio
    UI (no delete button on the Area list yet), but implemented for API
    completeness/parity with Events, per the approved route structure.
    """
    area = db.get(NoQrArea, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="No QR Area not found")
    db.delete(area)
    db.commit()


@router.post("/{area_id}/places", response_model=NoQrPlaceOut, status_code=201)
def create_no_qr_place(
    area_id: int,
    payload: NoQrPlaceCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    _get_area_or_404(db, area_id)
    validate_no_qr_place_identity(payload.venue_id, payload.name)
    if payload.venue_id is not None:
        validate_no_qr_place_venue(db, payload.venue_id)
        validate_no_qr_place_not_duplicate(db, area_id, payload.venue_id)

    place = NoQrPlace(
        area_id=area_id,
        venue_id=payload.venue_id,
        name=payload.name.strip() if payload.name else None,
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return NoQrPlaceOut.model_validate(place)


@places_router.patch("/{place_id}", response_model=NoQrPlaceOut)
def update_no_qr_place(
    place_id: int,
    payload: NoQrPlaceUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    place = db.get(NoQrPlace, place_id)
    if place is None:
        raise HTTPException(status_code=404, detail="No QR Place not found")

    validate_no_qr_place_identity(payload.venue_id, payload.name)
    if payload.venue_id is not None:
        validate_no_qr_place_venue(db, payload.venue_id)
        validate_no_qr_place_not_duplicate(db, place.area_id, payload.venue_id, exclude_place_id=place_id)

    place.venue_id = payload.venue_id
    place.name = payload.name.strip() if payload.name else None
    db.commit()
    db.refresh(place)
    return NoQrPlaceOut.model_validate(place)


@places_router.delete("/{place_id}", status_code=204)
def delete_no_qr_place(
    place_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Removes the place from its Area only — never deletes the linked
    Venue, if any."""
    place = db.get(NoQrPlace, place_id)
    if place is None:
        raise HTTPException(status_code=404, detail="No QR Place not found")
    db.delete(place)
    db.commit()
