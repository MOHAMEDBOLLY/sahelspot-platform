from fastapi import HTTPException

from app.db.models import Venue

# Deliberately generic — not Venue-specific, and not tied to any one
# transition (Review, Approval, and any future one all call this). This is
# the "reusable transition infrastructure" the workflow architecture is
# meant to share: the one place that enforces "a row must currently be in
# `expected` status to move toward `target`," so that check and its 409
# shape exist exactly once, not once per endpoint.


def require_status(venue: Venue, *, expected: str, target: str) -> None:
    """Raises a structured 409 if `venue.status` isn't `expected`. Callers
    are still responsible for the actual `venue.status = target` assignment
    and any transition-specific preconditions (e.g. Review's Editorial
    Readiness gate) — this only centralizes the status-guard every
    transition needs, not the whole transition itself.
    """
    if venue.status != expected:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "invalid_transition",
                "message": (
                    f"Venue is in '{venue.status}' status; only a "
                    f"'{expected}' venue can move to '{target}'."
                ),
                "current_status": venue.status,
            },
        )
