from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import (
    EXTERNAL_REVIEW_STATUSES,
    MATCH_CONFIDENCES,
    MATCH_STATUSES,
    VENUE_CATEGORIES,
    Destination,
    ExternalDestinationMapping,
    Venue,
)

# External Data Enrichment Workflow (Phase 1) — the only fields an
# operator may selectively "Apply" from an external record onto a real
# Venue. Deliberately NOT `amenities` (no approved Venue column exists
# for it — per the approved plan, external data never gets written onto
# a field that isn't an actual Studio field) and NOT booking info (the
# explicit safety rule: an external "Reserve" action may be that
# source's own internal request flow, never assumed to be a direct
# bookable URL — there is no Apply path for it in Phase 1 at all, by
# design, not by omission).
APPLICABLE_FIELDS = ("description", "maps_url", "category", "destination")

# Fields whose current Venue value differs meaningfully from the
# external suggestion and therefore require an explicit
# `override_conflict=true` before Apply proceeds — same "category/
# destination are high-impact, never silently changed" rule the plan
# calls out by name.
CONFLICT_GATED_FIELDS = ("category", "destination")


def validate_match_status(value: str) -> None:
    if value not in MATCH_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_match_status", "message": f"match_status must be one of: {', '.join(MATCH_STATUSES)}."},
        )


def validate_match_confidence(value: str | None) -> None:
    if value is not None and value not in MATCH_CONFIDENCES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_match_confidence",
                "message": f"match_confidence must be one of: {', '.join(MATCH_CONFIDENCES)}.",
            },
        )


def validate_review_status(value: str) -> None:
    if value not in EXTERNAL_REVIEW_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_review_status",
                "message": f"review_status must be one of: {', '.join(EXTERNAL_REVIEW_STATUSES)}.",
            },
        )


def validate_apply_fields(fields: list[str]) -> None:
    if not fields:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_apply_fields", "message": "At least one field must be selected to apply."},
        )
    unknown = [f for f in fields if f not in APPLICABLE_FIELDS]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_apply_fields",
                "message": f"Unknown or non-applicable field(s): {unknown}. Applicable fields: {list(APPLICABLE_FIELDS)}.",
            },
        )


def validate_matched_venue(db: Session, venue_id: str | None) -> Venue:
    """An Apply always targets an already-matched Venue — creating one is
    a separate, explicit action (`create_venue_from_record`)."""
    if venue_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "no_matched_venue",
                "message": "This record has no matched Venue to apply fields to. Create a new Venue instead.",
            },
        )
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "no_matched_venue", "message": f"Matched Venue '{venue_id}' no longer exists."},
        )
    return venue


def validate_category_value(category: str) -> None:
    if category not in VENUE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_category",
                "message": f"'{category}' is not a recognized Studio category — cannot apply automatically.",
            },
        )


@dataclass
class DestinationResolution:
    destination: Destination
    via_mapping: bool


def find_destination_mapping(db: Session, source: str, external_destination: str) -> ExternalDestinationMapping | None:
    """Read-only lookup used by both resolution (below) and by the
    review UI, which needs to show "normalized via approved mapping"
    *before* Apply is ever attempted, not only at apply time."""
    return (
        db.query(ExternalDestinationMapping)
        .filter(
            ExternalDestinationMapping.source == source,
            ExternalDestinationMapping.external_destination == external_destination,
        )
        .first()
    )


def resolve_destination(db: Session, source: str, external_destination: str) -> DestinationResolution:
    """Two deterministic paths only, in order — never fuzzy, never
    guessed, never invents a Destination row, and never mutates
    `external_destination` (the record's own value, and its `raw_row`,
    are untouched regardless of which path resolves it):

    1. An explicit, operator-approved mapping for this exact (source,
       external_destination) pair (`ExternalDestinationMapping`) — e.g.
       iSahel's "El Alamein" -> Studio's "New Alamein".
    2. A literal, case-insensitive `Destination.name` match — the
       external value already *is* the Studio name, nothing to map.

    If neither applies, Apply blocks with a clear 422 rather than
    guessing which Destination was probably meant."""
    mapping = find_destination_mapping(db, source, external_destination)
    if mapping is not None:
        destination = db.get(Destination, mapping.studio_destination_id)
        if destination is not None:
            return DestinationResolution(destination, via_mapping=True)

    destination = db.query(Destination).filter(Destination.name.ilike(external_destination)).first()
    if destination is not None:
        return DestinationResolution(destination, via_mapping=False)

    raise HTTPException(
        status_code=422,
        detail={
            "error": "unresolvable_destination",
            "message": (
                f"No Studio destination found matching '{external_destination}', and no approved mapping "
                "exists for it — create one first, or apply this manually instead."
            ),
        },
    )


def check_conflict(field: str, current_value: str | None, external_value: str | None, override_conflict: bool) -> None:
    """`category`/`destination` are high-impact — if the Venue already
    has a different value than the external suggestion, Apply is
    rejected unless the operator explicitly set `override_conflict`.
    An empty current value is never a conflict (this is exactly the
    "Suggested" low-risk case the plan describes)."""
    if field not in CONFLICT_GATED_FIELDS:
        return
    if not current_value:
        return
    if current_value.strip().lower() == (external_value or "").strip().lower():
        return
    if not override_conflict:
        raise HTTPException(
            status_code=409,
            detail={
                "error": f"{field}_conflict",
                "message": (
                    f"Studio {field} ('{current_value}') differs from the external suggestion "
                    f"('{external_value}'). Set override_conflict=true to apply anyway."
                ),
            },
        )
