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

import logging
import re
import uuid
from pathlib import PurePosixPath

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB — a simple, generous-enough limit; not configurable per env yet

# H3 — the two network calls this module makes, and the only two seams
# that touch the network at all.
#
# They were previously the *synchronous* `httpx.put`/`httpx.delete`, called
# from `async def` upload routes. A synchronous network call inside a
# coroutine blocks the whole event loop for its duration: measured, a 2s
# storage stall delayed every concurrent request by 2091ms, and a 30s
# timeout stalls the entire API process (one worker, one loop). The
# `def` delete routes were never affected — FastAPI runs those in a
# threadpool — but they are converted too, so there is exactly one way
# this module talks to storage rather than two.
#
# Deliberately a client per call, not a shared module-level one: a shared
# `AsyncClient` needs application lifespan management, which is its own
# change with its own surface. Connection reuse is a follow-up, not part
# of removing the blocking.
#
# Timeout is unchanged at 30s, and there is deliberately still no retry —
# both were true before, and neither is what H3 is fixing.
_STORAGE_TIMEOUT = 30.0


async def _storage_put(url: str, *, content: bytes, headers: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=_STORAGE_TIMEOUT) as client:
        return await client.put(url, content=content, headers=headers)


async def _storage_delete(url: str, *, headers: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=_STORAGE_TIMEOUT) as client:
        return await client.delete(url, headers=headers)

# Sprint 31 — magic-byte signatures for the same three types
# `ALLOWED_CONTENT_TYPES` already allows. Trusting only the client-supplied
# `Content-Type` header let a mislabeled (or deliberately spoofed) upload
# through; sniffing the actual bytes closes that without adding a new
# dependency (e.g. `python-magic`) for three well-known signatures.
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _sniff_content_type(file_bytes: bytes) -> str | None:
    if file_bytes.startswith(_JPEG_SIGNATURE):
        return "image/jpeg"
    if file_bytes.startswith(_PNG_SIGNATURE):
        return "image/png"
    if file_bytes[0:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


# Sprint 31 — the client-supplied filename was previously concatenated into
# the storage object path unmodified. `PurePosixPath(...).name` drops any
# directory component (so `../../etc/passwd` or `a/b/c.jpg` can't steer the
# path), and the regex then restricts what's left to a safe, boring
# character set — same intent as werkzeug's `secure_filename`, just the
# few lines this codebase actually needs rather than a new dependency.
_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]")


def _sanitize_filename(filename: str) -> str:
    name = PurePosixPath(filename).name
    name = _UNSAFE_FILENAME_CHARS.sub("_", name).lstrip(".")
    return name or "upload"


def _file_too_large_error() -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "error": "file_too_large",
            "message": f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
        },
    )


def reject_if_declared_too_large(content_length_header: str | None) -> None:
    """Security hardening — early rejection based on the request's
    `Content-Length` header, called by route code *before* `await
    file.read()` buffers the upload. A multipart body's declared total
    includes some boundary/field overhead beyond the file's own bytes, so
    this can't be exact — it only rejects when the declared total already
    exceeds the limit, and does nothing when the header is absent (e.g.
    chunked transfer encoding) or unparseable. `upload_image()`'s own
    post-read size check below remains the authoritative one for
    whatever this can't catch; this is a fast-path addition, not a
    replacement for it.
    """
    if content_length_header is None:
        return
    try:
        content_length = int(content_length_header)
    except ValueError:
        return
    if content_length > MAX_UPLOAD_BYTES:
        raise _file_too_large_error()


async def upload_image(file_bytes: bytes, *, filename: str, content_type: str, folder: str) -> str:
    """Uploads to Supabase Storage under `{folder}/{uuid}-{filename}` and
    returns the bucket's public URL for it. Raises a structured
    `HTTPException` for every rejection case — unsupported type, too large,
    storage not configured, or the upload itself failing — so route code
    never has to duplicate these checks.

    H3 — `async` as of this change (see `_storage_put`). Every validation
    step below is unchanged and still runs before any network call, so
    rejection behaviour and status codes are exactly as they were.
    """
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise _file_too_large_error()

    # Sprint 31 — the declared `content_type` (from the client's
    # `Content-Type` header) is no longer trusted on its own: the file's
    # own bytes must actually be one of the allowed image types, and must
    # match what the client declared, or the upload is rejected.
    detected_type = _sniff_content_type(file_bytes)
    if (
        content_type not in ALLOWED_CONTENT_TYPES
        or detected_type is None
        or detected_type not in ALLOWED_CONTENT_TYPES
        or detected_type != content_type
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unsupported_media_type",
                "message": f"Only {', '.join(sorted(ALLOWED_CONTENT_TYPES))} images are supported.",
            },
        )

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Media storage is not configured.")

    safe_filename = _sanitize_filename(filename)
    object_path = f"{folder}/{uuid.uuid4().hex}-{safe_filename}"
    upload_url = f"{settings.supabase_url}/storage/v1/object/{settings.media_bucket}/{object_path}"

    # H3 — a storage-side *error status* was already a structured 502, but a
    # storage-side *transport failure* (unreachable, DNS, timeout) had no
    # handling at all and escaped as a generic 500. Both mean the same thing
    # to the caller — "the upload did not happen" — so both are now the same
    # 502, with identical body. Successful behaviour is untouched.
    try:
        response = await _storage_put(
            upload_url,
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": content_type,
            },
        )
    except httpx.HTTPError:
        logger.warning("Media upload failed to reach storage for %s", object_path)
        raise HTTPException(status_code=502, detail="Failed to upload media.") from None
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to upload media.")

    return f"{settings.supabase_url}/storage/v1/object/public/{settings.media_bucket}/{object_path}"


async def delete_image(url: str) -> None:
    """PLATFORM_SPEC_v1.0_FROZEN.md §9.2/§8.4 (`DELETE .../media`) —
    removes an image from Supabase Storage given the public URL
    `upload_image()` returned. Derives the object path by stripping the
    known public-URL prefix rather than requiring a caller to track paths
    separately — the URL is the only handle route code already has (it's
    what's stored in `cover_image_url`/`gallery_image_urls`).

    Idempotent by design at the HTTP level (Supabase's delete endpoint
    doesn't error on an already-missing object) — deleting a URL that
    doesn't resolve to a real object silently no-ops rather than raising,
    matching the legacy tool's own "deleting an already-missing file
    returns {ok: true, deleted: false}" precedent.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Media storage is not configured.")

    prefix = f"{settings.supabase_url}/storage/v1/object/public/{settings.media_bucket}/"
    if not url.startswith(prefix):
        # Not a URL this service ever produced (e.g. hand-pasted via the
        # PATCH path) — nothing in our bucket to delete; silently a no-op,
        # same reasoning as the "already missing" case above.
        return
    object_path = url[len(prefix) :]

    delete_url = f"{settings.supabase_url}/storage/v1/object/{settings.media_bucket}/{object_path}"
    # H3 — this function's documented contract is best-effort: deleting an
    # already-missing object is explicitly not an error. A transport failure
    # gets the same treatment (logged, not raised) rather than turning an
    # otherwise-successful media clear into a 500. A leaked storage object
    # is recoverable; failing the caller's write over it is not an
    # improvement. The response status is still deliberately not inspected —
    # that is the pre-existing best-effort behaviour, unchanged here.
    try:
        await _storage_delete(
            delete_url,
            headers={"Authorization": f"Bearer {settings.supabase_service_role_key}"},
        )
    except httpx.HTTPError:
        logger.warning("Media delete failed to reach storage for %s", object_path)
