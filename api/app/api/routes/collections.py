from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.schemas import (
    CollectionCreate,
    CollectionMembershipCreate,
    CollectionMembershipUpdate,
    CollectionOut,
    CollectionUpdate,
)
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Collection, CollectionVenue, Venue
from app.db.session import get_db
from app.validation.collections import (
    validate_collection_id,
    validate_collection_name,
    validate_collection_venue_exists,
)

# HOME CURATION — mounted under /editor by app/api/router.py, same auth/
# permission shape as venues.py/events.py/no_qr.py. Extends the existing
# `Collection`/`CollectionVenue` tables (migration 0015) with real CRUD —
# no new schema, per the approved audit: those tables already had
# `is_active`/`sort_order` (section-level) and `CollectionVenue.sort_order`
# (per-venue ordering) sitting unused, specifically anticipating this.
# `GET /collections` moves here from taxonomy.py (which keeps only Tags),
# since Collections are no longer a read-only catalog.
router = APIRouter(prefix="/collections", tags=["collections"])


def _attach_venues(db: Session, collection: Collection) -> Collection:
    """`venues` isn't an ORM relationship on `Collection` (neither model
    declares any — same explicit-query style `_attach_taxonomy`
    (api/app/api/routes/venues.py) already uses for `Venue.tags`/
    `Venue.collections`). Attached here as a plain instance attribute,
    same pattern, so `CollectionOut`'s `from_attributes=True` can still
    read it. `models.py` is deliberately untouched — no relationship
    added there."""
    rows = (
        db.query(CollectionVenue, Venue)
        .join(Venue, Venue.id == CollectionVenue.venue_id)
        .filter(CollectionVenue.collection_id == collection.id)
        .order_by(CollectionVenue.sort_order)
        .all()
    )
    collection.venues = [
        {
            "venue_id": membership.venue_id,
            "sort_order": membership.sort_order,
            "venue": {"id": venue.id, "name": venue.name},
        }
        for membership, venue in rows
    ]
    return collection


def _get_collection_or_404(db: Session, collection_id: str) -> Collection:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _attach_venues(db, collection)


@router.get("", response_model=list[CollectionOut])
def list_collections(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    """Every collection, active or not — same "don't duplicate a decision
    the caller should make" reasoning the original read-only endpoint
    already had; Home Curation's own list screen decides what to show
    On/Off, this endpoint doesn't filter."""
    collections = db.query(Collection).order_by(Collection.sort_order, Collection.name).all()
    return [_attach_venues(db, c) for c in collections]


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    validate_collection_id(payload.id)
    validate_collection_name(payload.name)

    if db.get(Collection, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "collection_already_exists", "message": f"'{payload.id}' already exists."},
        )

    collection = Collection(
        id=payload.id,
        slug=payload.id,
        name=payload.name.strip(),
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return _attach_venues(db, collection)


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    return _get_collection_or_404(db, collection_id)


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """`id`/`slug` are not accepted here at all (see `CollectionUpdate`'s
    own docstring) — only name/description/is_active/sort_order change."""
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        validate_collection_name(updates["name"])
        updates["name"] = updates["name"].strip()
    for field, value in updates.items():
        setattr(collection, field, value)
    db.commit()
    db.refresh(collection)
    return _attach_venues(db, collection)


@router.delete("/{collection_id}", status_code=204)
def delete_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Deletes the Collection and its memberships (`collection_venues.
    collection_id` is `ON DELETE CASCADE`) — never the linked Venues
    themselves, only the `CollectionVenue` rows referencing them."""
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()


@router.post("/{collection_id}/venues", response_model=CollectionOut, status_code=201)
def add_collection_venue(
    collection_id: str,
    payload: CollectionMembershipCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Adding a venue already a member is idempotent — updates its
    `sort_order` if one was supplied, otherwise leaves it where it is,
    rather than raising a duplicate-membership error (the `(collection_id,
    venue_id)` composite PK makes a true duplicate row impossible either
    way)."""
    if db.get(Collection, collection_id) is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    validate_collection_venue_exists(db, payload.venue_id)

    existing = db.get(CollectionVenue, (collection_id, payload.venue_id))
    if existing is not None:
        if payload.sort_order is not None:
            existing.sort_order = payload.sort_order
            db.commit()
    else:
        sort_order = payload.sort_order
        if sort_order is None:
            max_sort_order = (
                db.query(func.max(CollectionVenue.sort_order))
                .filter(CollectionVenue.collection_id == collection_id)
                .scalar()
            )
            sort_order = (max_sort_order + 1) if max_sort_order is not None else 0
        db.add(CollectionVenue(collection_id=collection_id, venue_id=payload.venue_id, sort_order=sort_order))
        db.commit()

    return _get_collection_or_404(db, collection_id)


@router.patch("/{collection_id}/venues/{venue_id}", response_model=CollectionOut)
def update_collection_venue(
    collection_id: str,
    venue_id: str,
    payload: CollectionMembershipUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Reorder only — see `CollectionMembershipUpdate`'s own docstring."""
    if db.get(Collection, collection_id) is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    membership = db.get(CollectionVenue, (collection_id, venue_id))
    if membership is None:
        raise HTTPException(status_code=404, detail="This venue is not a member of this collection")
    membership.sort_order = payload.sort_order
    db.commit()
    return _get_collection_or_404(db, collection_id)


@router.delete("/{collection_id}/venues/{venue_id}", response_model=CollectionOut)
def remove_collection_venue(
    collection_id: str,
    venue_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Removes the membership only — never touches the Venue itself."""
    if db.get(Collection, collection_id) is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    membership = db.get(CollectionVenue, (collection_id, venue_id))
    if membership is None:
        raise HTTPException(status_code=404, detail="This venue is not a member of this collection")
    db.delete(membership)
    db.commit()
    return _get_collection_or_404(db, collection_id)
