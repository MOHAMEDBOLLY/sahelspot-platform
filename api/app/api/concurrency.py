from typing import Any

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel

# PLATFORM_SPEC_v1.0_FROZEN.md §4 — optimistic locking via ETag/If-Match,
# backed by each entity's `version` column (Phase 1, EP3). Shared by
# venues and destinations, the only two entities in scope per §4.1 — not
# bulk operations, not workflow transitions, not `app_users` (no real
# multi-editor contention there, per §4.1's own reasoning for scoping
# this narrowly rather than speculatively).


def set_etag(response: Response, entity: Any) -> None:
    """`GET` (and every mutating response) carries the row's current
    `version` as an ETag, so a client always has the value its next
    `If-Match` needs — no separate round-trip to "check the version"
    before an edit.
    """
    response.headers["ETag"] = f'"{entity.version}"'


def require_if_match(request: Request, entity: Any, out_schema: type[BaseModel]) -> None:
    """Raises `428` if `If-Match` is missing, `409` (with the entity's
    current state and version, per §4.3) if it doesn't match the entity's
    current `version`. Callers apply this before mutating `entity` — a
    match means the caller's last-read version is still current, so the
    write may proceed and increment `version` by one as part of the same
    transaction.
    """
    if_match = request.headers.get("if-match")
    if if_match is None:
        raise HTTPException(
            status_code=428,
            detail={
                "error": "precondition_required",
                "message": "An If-Match header is required to update this resource.",
            },
        )

    raw_version = if_match.strip().strip('"')
    try:
        expected_version = int(raw_version)
    except ValueError:
        raise HTTPException(
            status_code=428,
            detail={
                "error": "precondition_required",
                "message": "If-Match must be the resource's current version.",
            },
        ) from None

    if expected_version != entity.version:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "version_conflict",
                "message": (
                    f"This resource was changed by someone else since you loaded it "
                    f"(expected version {expected_version}, current version is {entity.version})."
                ),
                "current": out_schema.model_validate(entity).model_dump(mode="json"),
            },
        )
