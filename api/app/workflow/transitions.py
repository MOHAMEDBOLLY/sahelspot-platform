from typing import Protocol

from fastapi import HTTPException

# Deliberately generic — not Venue-specific, and not tied to any one
# transition (Review, Approval, and any future one all call this). This is
# the "reusable transition infrastructure" the workflow architecture is
# meant to share: the one place that enforces "a row must currently be in
# `expected` status to move toward `target`," so that check and its 409
# shape exist exactly once, not once per endpoint. PLATFORM_SPEC_v1.0_
# FROZEN.md §4/§7.4 extends this same shared vocabulary to destinations —
# the `Venue`-only type hint this module always had in practice (only
# `.status` is ever read) is widened to match, not redesigned.


class _HasStatus(Protocol):
    status: str


def require_status(entity: _HasStatus, *, expected: str, target: str) -> None:
    """Raises a structured 409 if `entity.status` isn't `expected`. Callers
    are still responsible for the actual `entity.status = target` assignment
    and any transition-specific preconditions (e.g. Review's Editorial
    Readiness gate) — this only centralizes the status-guard every
    transition needs, not the whole transition itself.
    """
    if entity.status != expected:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "invalid_transition",
                "message": (
                    f"Resource is in '{entity.status}' status; only a "
                    f"'{expected}' resource can move to '{target}'."
                ),
                "current_status": entity.status,
            },
        )
