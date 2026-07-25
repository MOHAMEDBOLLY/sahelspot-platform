"""Media upload — Sprint 25's Media Library Foundation.

Deliberately small: this is a single function that accepts image bytes and
returns a public URL, proxied through Supabase Storage using the service
role key (never exposed to the frontend). No `media` table, no upload
history, no per-image metadata — `venues.cover_image_url`/
`gallery_image_urls` already exist for exactly this (see docs/DATABASE.md's
Sprint 2.5 "Images" decision); this module just gives the editor a real way
to fill them, instead of pasting a URL by hand. If a future need for
per-image captions, alt text, or independent reordering shows up, that
document already names the trigger to promote this into a real table —
not before.
"""

import uuid

import httpx
from fastapi import HTTPException

from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB — a simple, generous-enough limit; not configurable per env yet


def upload_image(file_bytes: bytes, *, filename: str, content_type: str, folder: str) -> str:
    """Uploads to Supabase Storage under `{folder}/{uuid}-{filename}` and
    returns the bucket's public URL for it. Raises a structured
    `HTTPException` for every rejection case — unsupported type, too large,
    storage not configured, or the upload itself failing — so route code
    never has to duplicate these checks.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unsupported_media_type",
                "message": f"Only {', '.join(sorted(ALLOWED_CONTENT_TYPES))} images are supported.",
            },
        )

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "file_too_large",
                "message": f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
            },
        )

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Media storage is not configured.")

    object_path = f"{folder}/{uuid.uuid4().hex}-{filename}"
    upload_url = f"{settings.supabase_url}/storage/v1/object/{settings.media_bucket}/{object_path}"

    response = httpx.put(
        upload_url,
        content=file_bytes,
        headers={
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": content_type,
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to upload media.")

    return f"{settings.supabase_url}/storage/v1/object/public/{settings.media_bucket}/{object_path}"
