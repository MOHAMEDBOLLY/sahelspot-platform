from fastapi import HTTPException

# PLATFORM_SPEC_v1.0_FROZEN.md §7.7 — venue/destination ids must never
# collide with a literal path segment registered ahead of `/{id}` (bulk
# operations, export, the future duplicate-detection endpoint, stats).
# Shared by both entities' create endpoints rather than duplicated, since
# it's the same constraint for the same reason.
RESERVED_PATH_SEGMENTS = frozenset({"bulk", "export", "duplicates", "stats"})


def check_reserved_id(entity_id: str) -> None:
    if entity_id in RESERVED_PATH_SEGMENTS:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "reserved_id",
                "message": f"'{entity_id}' is a reserved path segment and cannot be used as an id.",
            },
        )
