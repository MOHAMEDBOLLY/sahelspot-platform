"""HTTP caching for the `/public/*` surface (audit H2).

The publish snapshot is immutable and identified by the current revision's
id, which makes that id an exact cache validator: same id ⇒ byte-identical
public data (see `get_current_revision_id`). Every `/public/*` response
therefore carries:

- `Cache-Control: public, max-age=60, stale-while-revalidate=300` — any
  browser, shared proxy, or CDN may serve it for a minute and serve it
  stale for five more while revalidating in the background.
- `ETag: "pub-rev-{id}"` — so a revalidation costs one index-only id
  lookup and returns `304` with no body, never loading the 321 KiB
  snapshot.

Deliberately NOT applied to `/editor/*`. Editors must always see fresh
draft state, and that surface already uses `ETag` for something entirely
different — the optimistic-concurrency row version (see
`app/api/concurrency.py`). The `pub-rev-` prefix keeps the two impossible
to confuse, in logs or in a client.

Two deliberate scoping decisions:

- **Negative responses are never cached.** A `404` carries no
  `Cache-Control`, so an unpublished venue that later publishes appears
  immediately rather than after a cache expiry.
- **The conditional check runs before the resource lookup** on detail
  routes, which is what lets a `304` skip the snapshot load entirely. A
  cache only ever sends `If-None-Match` for a URL it previously stored a
  `200` for, and snapshots are immutable, so a matching validator already
  proves the resource existed in this revision. A hand-crafted request
  presenting a borrowed ETag for a nonexistent id would get `304` rather
  than `404`; that response has no body and reveals nothing (it is
  identical for existing and nonexistent ids alike), so the trade is a
  strictly benign deviation in exchange for skipping the dominant cost of
  the request.

Cross-origin safety: Starlette's `CORSMiddleware` emits `Vary: Origin`
whenever `allow_origins` is an explicit list (verified — it is), so a
shared cache keys these responses per origin and cannot serve one
origin's `Access-Control-Allow-Origin` to another.
"""

from fastapi import Request, Response

# 60s fresh + 5min stale-while-revalidate. Small enough that a publish
# reaches the public site promptly; large enough that a CDN absorbs
# essentially all read traffic between publishes.
PUBLIC_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"


def revision_etag(revision_id: int) -> str:
    return f'"pub-rev-{revision_id}"'


def set_public_cache_headers(response: Response, revision_id: int) -> None:
    response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
    response.headers["ETag"] = revision_etag(revision_id)


def client_has_current_revision(request: Request, revision_id: int) -> bool:
    """True when the request's `If-None-Match` already names the current
    revision — i.e. the caller's cached copy is exact and `304` is the
    correct answer. Handles the header's comma-separated list form, weak
    (`W/`-prefixed) validators, and `*` (which per RFC 9110 matches any
    current representation).
    """
    if_none_match = request.headers.get("if-none-match")
    if if_none_match is None:
        return False
    current = revision_etag(revision_id)
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate == "*":
            return True
        if candidate.removeprefix("W/") == current:
            return True
    return False


def not_modified_response(revision_id: int) -> Response:
    """A `304` still carries the cache headers — per RFC 9110 §15.4.5 they
    refresh the stored response's freshness lifetime."""
    response = Response(status_code=304)
    set_public_cache_headers(response, revision_id)
    return response
