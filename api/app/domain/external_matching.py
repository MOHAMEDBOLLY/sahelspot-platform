"""External Data Enrichment Workflow (Phase 1) — matching an external
record against existing Studio venues when no pre-built match overlay
is available for the source (see `external_ingest.normalize_match_
confidence` for the case where one *is* available, e.g. iSahel's own
`isahel_vs_studio_review.xlsx`).

Deliberately multi-signal, per the approved plan's "do not rely on name
similarity alone": an explicit venue id or Google Maps URL match is
`MATCH_CONFIRMED` outright; otherwise name/destination/category
agreement is scored and only ever reaches `MATCH_PROBABLE` at best —
never a false `MATCH_CONFIRMED` from name text alone.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.db.models import Venue


@dataclass
class MatchResult:
    venue_id: str | None
    match_status: str
    match_confidence: str | None


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def find_candidate_match(
    db: Session,
    *,
    explicit_venue_id: str | None,
    external_maps_url: str | None,
    external_name: str,
    external_destination: str | None,
    external_category: str | None,
) -> MatchResult:
    # Signal 1 — an explicit venue id from the research dataset itself is
    # as confirmed as a match can be.
    if explicit_venue_id:
        venue = db.get(Venue, explicit_venue_id)
        if venue is not None:
            return MatchResult(venue.id, "MATCH_CONFIRMED", "HIGH")

    # Signal 2 — an exact Google Maps URL match is just as confirmed; two
    # different venues never legitimately share one Maps listing.
    if external_maps_url:
        venue = db.query(Venue).filter(Venue.maps_url == external_maps_url).first()
        if venue is not None:
            return MatchResult(venue.id, "MATCH_CONFIRMED", "HIGH")

    # Signal 3 — no strong single signal. Score name/destination/category
    # agreement against every venue whose name contains (or is contained
    # by) the external name, case-insensitively — never a blind full-table
    # substring scan for matching purposes beyond that first filter.
    name_norm = _normalize(external_name)
    if not name_norm:
        return MatchResult(None, "NO_MATCH", None)

    candidates = db.query(Venue).filter(Venue.name.ilike(f"%{external_name}%")).limit(20).all()
    best: tuple[int, Venue] | None = None
    for venue in candidates:
        score = 0
        if _normalize(venue.name) == name_norm:
            score += 2
        elif name_norm in _normalize(venue.name) or _normalize(venue.name) in name_norm:
            score += 1
        if external_destination and venue.destination is not None:
            if _normalize(venue.destination.name) == _normalize(external_destination):
                score += 1
        if external_category and _normalize(venue.category) == _normalize(external_category):
            score += 1
        if best is None or score > best[0]:
            best = (score, venue)

    if best is None:
        return MatchResult(None, "NO_MATCH", None)

    score, venue = best
    if score >= 3:
        return MatchResult(venue.id, "MATCH_PROBABLE", "MEDIUM")
    if score >= 1:
        return MatchResult(venue.id, "REVIEW_REQUIRED", "LOW")
    return MatchResult(None, "NO_MATCH", None)
