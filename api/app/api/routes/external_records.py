from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.activity.service import log_activity
from app.api.schemas import (
    ExternalDestinationMappingCreate,
    ExternalDestinationMappingOut,
    ExternalRecordApplyRequest,
    ExternalRecordApplyResult,
    ExternalRecordCreateVenueRequest,
    ExternalRecordListOut,
    ExternalRecordLoadResult,
    ExternalRecordMatchLoadResult,
    ExternalRecordMatchUpdate,
    ExternalRecordOut,
    ExternalRecordReviewStatusUpdate,
    ExternalRecordSummary,
    VenueOut,
)
from app.auth.dependencies import CurrentUser
from app.auth.permissions import Permission, require_permission
from app.db.models import Destination, ExternalDestinationMapping, ExternalRecord, Venue
from app.db.session import get_db
from app.domain.external_ingest import (
    normalize_match_confidence,
    parse_detail_rows,
    parse_match_rows_csv,
    parse_match_rows_xlsx,
)
from app.domain.external_matching import find_candidate_match
from app.validation.external_records import (
    APPLICABLE_FIELDS,
    check_conflict,
    find_destination_mapping,
    resolve_destination,
    validate_apply_fields,
    validate_category_value,
    validate_match_confidence,
    validate_match_status,
    validate_matched_venue,
    validate_review_status,
)

# External Data Enrichment Workflow (Phase 1) — mounted under /editor by
# app/api/router.py, same auth/permission shape as every other router
# here. Deliberately NO bulk-write endpoint that blindly imports rows
# into `venues` — every write path here (apply, create-venue) requires
# one explicit, per-record operator action; loading a file only ever
# populates the separate `external_records` staging table.
router = APIRouter(prefix="/external-records", tags=["external-records"])


def _get_record_or_404(db: Session, record_id: int) -> ExternalRecord:
    record = db.get(ExternalRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="External record not found")
    return record


def _serialize(db: Session, record: ExternalRecord) -> ExternalRecord:
    """`matched_venue` isn't an ORM relationship (same explicit-query
    style `_attach_taxonomy`/`collections._attach_venues` already use in
    this codebase) — attached as a plain instance attribute so
    `ExternalRecordOut.from_attributes` can still read it."""
    if record.matched_venue_id:
        venue = db.get(Venue, record.matched_venue_id)
        record.matched_venue = {"id": venue.id, "name": venue.name} if venue else None
    else:
        record.matched_venue = None

    record.destination_mapping = None
    if record.external_destination:
        mapping = find_destination_mapping(db, record.source, record.external_destination)
        if mapping is not None:
            destination = db.get(Destination, mapping.studio_destination_id)
            if destination is not None:
                record.destination_mapping = {"id": destination.id, "name": destination.name}
    return record


@router.post("/load-detail", response_model=ExternalRecordLoadResult, status_code=201)
def load_detail_records(
    source: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Loads one source's full detail records into the review staging
    layer only — never touches `venues`. Idempotent per (source,
    external_name, external_destination): re-loading the same file
    updates the existing staging row's detail fields rather than
    creating a duplicate, but never touches that row's match/review
    state (an operator's prior classification is never silently reset
    by a re-load). A best-effort match is attempted for genuinely new
    rows only, via the multi-signal fallback matcher — never a name-only
    guess, and never a `MATCH_CONFIRMED` from this path alone (that only
    ever comes from an explicit venue id or exact Maps URL match, or a
    pre-built match overlay applied afterward via `/load-matches`).
    """
    content = file.file.read()
    rows = parse_detail_rows(content, file.filename or "")

    created = 0
    updated = 0
    for row in rows:
        row_source = row.get("source") or source
        existing = (
            db.query(ExternalRecord)
            .filter(
                ExternalRecord.source == row_source,
                ExternalRecord.external_name == row["external_name"],
                ExternalRecord.external_destination == row.get("external_destination"),
            )
            .first()
        )
        if existing is not None:
            for field in (
                "source_url",
                "external_category",
                "external_description",
                "external_amenities",
                "external_maps_url",
                "external_booking_type",
                "external_booking_url",
                "external_image_urls",
                "source_review_status",
                "raw_row",
            ):
                setattr(existing, field, row.get(field))
            updated += 1
            continue

        match = find_candidate_match(
            db,
            explicit_venue_id=None,
            external_maps_url=row.get("external_maps_url"),
            external_name=row["external_name"],
            external_destination=row.get("external_destination"),
            external_category=row.get("external_category"),
        )
        record = ExternalRecord(
            source=row_source,
            source_url=row.get("source_url"),
            external_name=row["external_name"],
            external_category=row.get("external_category"),
            external_destination=row.get("external_destination"),
            external_description=row.get("external_description"),
            external_amenities=row.get("external_amenities") or [],
            external_maps_url=row.get("external_maps_url"),
            external_booking_type=row.get("external_booking_type"),
            external_booking_url=row.get("external_booking_url"),
            external_image_urls=row.get("external_image_urls") or [],
            source_review_status=row.get("source_review_status"),
            raw_row=row.get("raw_row"),
            matched_venue_id=match.venue_id,
            match_status=match.match_status,
            match_confidence=match.match_confidence,
        )
        db.add(record)
        created += 1

    db.commit()
    return ExternalRecordLoadResult(created=created, updated=updated, source=source)


@router.post("/load-matches", response_model=ExternalRecordMatchLoadResult)
def load_match_overlay(
    source: str = Form(default=""),
    file: UploadFile = File(...),
    sheet_name: str = Form(default="All Review"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Applies a pre-built matching overlay (e.g. a research team's own
    candidate-match spreadsheet) on top of already-loaded detail records
    for the given source, matched by external name. Only ever updates
    match classification fields on an existing staging row — never
    creates a row, never touches `venues`. Accepts `.csv` or `.xlsx`
    (parsed with the stdlib only, see `external_ingest.py`)."""
    content = file.file.read()
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx"):
        rows = parse_match_rows_xlsx(content, sheet_name=sheet_name)
    else:
        rows = parse_match_rows_csv(content)

    def _get(row: dict, *keys: str) -> str | None:
        for key in keys:
            if row.get(key):
                return row[key]
        return None

    matched = 0
    unmatched = 0
    for row in rows:
        name = _get(row, "iSahel_name", "external_name", "name")
        if not name:
            unmatched += 1
            continue
        # A single overlay file may legitimately span every source at
        # once (this is exactly the shape of the real review workbook) —
        # each row's own source column takes precedence; the form
        # parameter is only a fallback for an overlay that doesn't carry
        # one at all.
        row_source = _get(row, "iSahel_source", "external_source", "source") or source
        record = (
            db.query(ExternalRecord)
            .filter(ExternalRecord.source == row_source, ExternalRecord.external_name == name)
            .first()
        )
        if record is None:
            unmatched += 1
            continue

        candidate_venue_id = _get(row, "studio_candidate_1_id", "candidate_venue_id", "matched_venue_id")
        confidence_label = _get(row, "match_confidence", "confidence")
        match_status, match_confidence = normalize_match_confidence(confidence_label)

        if candidate_venue_id and db.get(Venue, candidate_venue_id) is not None:
            record.matched_venue_id = candidate_venue_id
        record.match_status = match_status
        record.match_confidence = match_confidence
        # Preserve the overlay's own candidate/notes columns for the
        # review UI without inventing new typed columns for them.
        record.raw_row = {**(record.raw_row or {}), "match_overlay": row}
        matched += 1

    db.commit()
    return ExternalRecordMatchLoadResult(matched=matched, unmatched=unmatched)


@router.get("", response_model=ExternalRecordListOut)
def list_external_records(
    source: str | None = None,
    category: str | None = None,
    destination: str | None = None,
    match_status: str | None = None,
    match_confidence: str | None = None,
    review_status: str | None = None,
    has_description: bool | None = None,
    has_amenities: bool | None = None,
    has_booking: bool | None = None,
    missing_studio_data: bool | None = Query(
        default=None,
        description="Matched to a Venue that has no short_description set yet",
    ),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    query = db.query(ExternalRecord)
    if source:
        query = query.filter(ExternalRecord.source == source)
    if category:
        query = query.filter(ExternalRecord.external_category == category)
    if destination:
        query = query.filter(ExternalRecord.external_destination == destination)
    if match_status:
        query = query.filter(ExternalRecord.match_status == match_status)
    if match_confidence:
        query = query.filter(ExternalRecord.match_confidence == match_confidence)
    if review_status:
        query = query.filter(ExternalRecord.review_status == review_status)
    if has_description is not None:
        query = (
            query.filter(ExternalRecord.external_description.isnot(None))
            if has_description
            else query.filter(ExternalRecord.external_description.is_(None))
        )
    if has_amenities is not None:
        query = (
            query.filter(ExternalRecord.external_amenities != [])
            if has_amenities
            else query.filter(ExternalRecord.external_amenities == [])
        )
    if has_booking is not None:
        if has_booking:
            query = query.filter(
                ExternalRecord.external_booking_url.isnot(None), ExternalRecord.external_booking_url != ""
            )
        else:
            query = query.filter(
                ExternalRecord.external_booking_url.is_(None) | (ExternalRecord.external_booking_url == "")
            )

    all_matching = query.all()
    if missing_studio_data:
        filtered = []
        for record in all_matching:
            venue = db.get(Venue, record.matched_venue_id) if record.matched_venue_id else None
            if venue is not None and not venue.short_description:
                filtered.append(record)
        all_matching = filtered

    for record in all_matching:
        _serialize(db, record)

    # Summary counters are computed over the *unfiltered* full set — the
    # dashboard reports the whole dataset's shape, not whatever the
    # current filter happens to show.
    everything = db.query(ExternalRecord).all()
    by_match_status: dict[str, int] = {}
    by_review_status: dict[str, int] = {}
    for record in everything:
        by_match_status[record.match_status] = by_match_status.get(record.match_status, 0) + 1
        by_review_status[record.review_status] = by_review_status.get(record.review_status, 0) + 1

    return ExternalRecordListOut(
        items=all_matching,
        total=len(all_matching),
        summary=ExternalRecordSummary(
            total=len(everything), by_match_status=by_match_status, by_review_status=by_review_status
        ),
    )


@router.get("/{record_id}", response_model=ExternalRecordOut)
def get_external_record(
    record_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    record = _get_record_or_404(db, record_id)
    return _serialize(db, record)


@router.patch("/{record_id}/match", response_model=ExternalRecordOut)
def override_match(
    record_id: int,
    payload: ExternalRecordMatchUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """The operator always has final say over the automated/loaded match
    classification — this never re-runs matching logic, it just records
    the operator's own decision."""
    record = _get_record_or_404(db, record_id)
    validate_match_status(payload.match_status)
    validate_match_confidence(payload.match_confidence)
    if payload.matched_venue_id is not None and db.get(Venue, payload.matched_venue_id) is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_venue_id", "message": f"Venue '{payload.matched_venue_id}' not found."},
        )
    record.match_status = payload.match_status
    record.match_confidence = payload.match_confidence
    record.matched_venue_id = payload.matched_venue_id
    db.commit()
    db.refresh(record)
    return _serialize(db, record)


@router.patch("/{record_id}/review-status", response_model=ExternalRecordOut)
def update_review_status(
    record_id: int,
    payload: ExternalRecordReviewStatusUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    record = _get_record_or_404(db, record_id)
    validate_review_status(payload.review_status)
    record.review_status = payload.review_status
    db.commit()
    db.refresh(record)
    return _serialize(db, record)


@router.post("/{record_id}/apply", response_model=ExternalRecordApplyResult)
def apply_external_fields(
    record_id: int,
    payload: ExternalRecordApplyRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """Applies exactly the selected fields — never "apply everything".
    Every changed field is recorded in the existing activity log
    (`log_activity`), previous and new value both, so the change remains
    auditable/reversible by inspection even without a dedicated undo
    system (per the approved plan: reuse existing patterns, no new
    heavy audit framework)."""
    record = _get_record_or_404(db, record_id)
    validate_apply_fields(payload.fields)
    venue = validate_matched_venue(db, record.matched_venue_id)

    fields_changed: dict[str, dict[str, str | None]] = {}

    for field in payload.fields:
        if field == "description":
            previous = venue.short_description
            new = record.external_description
            if previous != new:
                venue.short_description = new
                fields_changed["description"] = {"previous": previous, "new": new}

        elif field == "maps_url":
            previous = venue.maps_url
            new = record.external_maps_url
            if previous != new:
                venue.maps_url = new
                fields_changed["maps_url"] = {"previous": previous, "new": new}

        elif field == "category":
            new = record.external_category
            if new is None:
                continue
            check_conflict("category", venue.category, new, payload.override_conflict)
            validate_category_value(new)
            previous = venue.category
            if previous != new:
                venue.category = new
                fields_changed["category"] = {"previous": previous, "new": new}

        elif field == "destination":
            new_name = record.external_destination
            if new_name is None:
                continue
            current_destination = db.get(Destination, venue.destination_id)
            current_name = current_destination.name if current_destination else None
            check_conflict("destination", current_name, new_name, payload.override_conflict)
            resolution = resolve_destination(db, record.source, new_name)
            if venue.destination_id != resolution.destination.id:
                fields_changed["destination"] = {
                    "previous": current_name,
                    "new": resolution.destination.name,
                    "via_mapping": resolution.via_mapping,
                }
                venue.destination_id = resolution.destination.id

    if fields_changed:
        venue.version += 1
        log_activity(
            db,
            action="apply_external_record_fields",
            entity_type="venue",
            entity_id=venue.id,
            actor=user.id,
            metadata={
                "external_record_id": record.id,
                "source": record.source,
                "fields_changed": fields_changed,
            },
        )
        # PARTIALLY_APPLIED unless every applicable field this record
        # actually carries an external value for has now been applied —
        # a simple, conservative heuristic, never assumed "fully done"
        # just because *a* field was applied.
        remaining = [
            f
            for f in APPLICABLE_FIELDS
            if getattr(record, f"external_{f}" if f != "destination" else "external_destination", None)
        ]
        record.review_status = "APPROVED" if set(remaining) <= set(payload.fields) else "PARTIALLY_APPLIED"

    db.commit()
    db.refresh(venue)
    db.refresh(record)
    return ExternalRecordApplyResult(
        record=_serialize(db, record), venue=venue, fields_applied=list(fields_changed.keys())
    )


@router.post("/{record_id}/create-venue", response_model=VenueOut, status_code=201)
def create_venue_from_record(
    record_id: int,
    payload: ExternalRecordCreateVenueRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """The one path that creates a real Venue from an external record —
    only ever reachable by an explicit operator confirmation of every
    field (see `ExternalRecordCreateVenueRequest`'s own docstring), never
    automatically, and never for a record that already has a matched
    Venue (that's what Apply is for)."""
    record = _get_record_or_404(db, record_id)
    if record.matched_venue_id is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "already_matched",
                "message": "This record is already matched to a Venue — use Apply, not Create Venue.",
            },
        )
    if db.get(Venue, payload.id) is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "venue_already_exists", "message": f"'{payload.id}' already exists."},
        )
    validate_category_value(payload.category)
    if db.get(Destination, payload.destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")

    venue = Venue(
        id=payload.id,
        name=payload.name,
        slug=payload.slug,
        destination_id=payload.destination_id,
        category=payload.category,
        district=None,
        short_description=payload.short_description,
        maps_url=payload.maps_url,
        status="draft",
    )
    db.add(venue)
    # The new Venue must actually be INSERTed before this row's FK to it
    # is set — SQLAlchemy's flush ordering only follows declared
    # `relationship()`s, and neither model declares one to the other
    # (matching this codebase's existing "no relationship, explicit
    # query" style), so an unordered flush would issue the UPDATE first
    # and violate the FK. An explicit flush here settles that ordering.
    db.flush()
    record.matched_venue_id = payload.id
    record.match_status = "MATCH_CONFIRMED"
    record.match_confidence = "HIGH"
    record.review_status = "APPROVED"
    log_activity(
        db,
        action="create_venue_from_external_record",
        entity_type="venue",
        entity_id=venue.id,
        actor=user.id,
        metadata={"external_record_id": record.id, "source": record.source},
    )
    db.commit()

    venue = db.get(Venue, payload.id, options=[joinedload(Venue.destination)])
    venue.tags = []
    venue.collections = []
    return venue


# External Data Enrichment Workflow — Destination Mapping. A dedicated,
# tiny sub-resource, not folded into the record endpoints above: a
# mapping is reusable across every record that shares the same (source,
# external_destination) pair, not a property of one record.
mappings_router = APIRouter(prefix="/external-destination-mappings", tags=["external-records"])


def _serialize_mapping(db: Session, mapping: ExternalDestinationMapping) -> ExternalDestinationMapping:
    destination = db.get(Destination, mapping.studio_destination_id)
    mapping.studio_destination = {"id": destination.id, "name": destination.name} if destination else None
    return mapping


@mappings_router.get("", response_model=list[ExternalDestinationMappingOut])
def list_destination_mappings(
    source: str | None = None,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_VIEW)),
):
    query = db.query(ExternalDestinationMapping)
    if source:
        query = query.filter(ExternalDestinationMapping.source == source)
    mappings = query.order_by(ExternalDestinationMapping.source, ExternalDestinationMapping.external_destination).all()
    return [_serialize_mapping(db, m) for m in mappings]


@mappings_router.post("", response_model=ExternalDestinationMappingOut, status_code=201)
def create_destination_mapping(
    payload: ExternalDestinationMappingCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    """The only way a mapping is ever created — an explicit operator
    action, never inferred. Rejects a second mapping for the same
    (source, external_destination) pair (deterministic: exactly one
    mapping per pair) rather than silently overwriting the first."""
    if db.get(Destination, payload.studio_destination_id) is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    existing = (
        db.query(ExternalDestinationMapping)
        .filter(
            ExternalDestinationMapping.source == payload.source,
            ExternalDestinationMapping.external_destination == payload.external_destination,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "mapping_already_exists",
                "message": (
                    f"A mapping for source '{payload.source}' / '{payload.external_destination}' already "
                    "exists — remove it first to change it."
                ),
            },
        )
    mapping = ExternalDestinationMapping(
        source=payload.source,
        external_destination=payload.external_destination,
        studio_destination_id=payload.studio_destination_id,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return _serialize_mapping(db, mapping)


@mappings_router.delete("/{mapping_id}", status_code=204)
def delete_destination_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.CONTENT_EDIT)),
):
    mapping = db.get(ExternalDestinationMapping, mapping_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
