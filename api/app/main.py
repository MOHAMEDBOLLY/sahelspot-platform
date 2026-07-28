import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

# Security hardening PR 1 — see `Settings.docs_enabled`'s docstring for
# why this is gated at all.
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)


# Security hardening PR 2 — conservative, zero-compatibility-risk response
# headers applied to every response, API included even though it only
# ever serves JSON: cheap, harmless insurance, and consistent with the
# same headers being added to the consumer app in this PR. Deliberately
# *not* Content-Security-Policy/HSTS/COOP/COEP/CORP — those need their own
# dedicated review, later.
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    # Stops browsers from MIME-sniffing a response into a different
    # content type than what's declared — irrelevant for JSON responses
    # specifically, but zero cost and standard practice regardless.
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Sends the full URL as a referrer only for same-origin requests;
    # cross-origin requests get the origin only, never the full path
    # (which could otherwise leak query strings to a third party).
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Explicitly denies browser features this app never uses — an
    # allowlist of nothing, not a restriction of something in use today.
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # This API is never meant to be framed by anything; DENY is simpler
    # and more broadly supported than CSP's frame-ancestors, which is
    # explicitly out of scope for this PR.
    response.headers["X-Frame-Options"] = "DENY"
    # PLATFORM_SPEC_v1.0_FROZEN.md §6.1 — the entire current, unversioned
    # surface is retroactively declared v1. Purely informational; no route
    # path changes. See §6.3 for how a future v2 would be introduced
    # without touching this header's meaning for existing clients.
    response.headers["API-Version"] = "v1"
    return response


# Sprint 31 — every unhandled exception (i.e. anything that isn't already
# an `HTTPException` FastAPI itself formats) previously reached the client
# as Starlette's bare default 500, with nothing logged server-side. This
# only adds visibility and a consistent JSON body — it does not change
# `HTTPException` behavior at all, since FastAPI's own handler for those
# still runs first and never reaches this one.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"error": "internal_server_error", "message": "An unexpected error occurred."}},
    )

# Allows Studio (Vite dev server locally, a real deployed origin in
# staging/production) to call this API from the browser. Origins come from
# `Settings.allowed_origins` (Sprint 30) — no wildcard, every deployed
# frontend origin must be listed explicitly.
#
# Security hardening PR 4 — `allow_headers` was previously `["*"]`. The
# headers either frontend ever actually sends are `Authorization` (every
# authenticated `datalab-next` request, via `authHeaders()` in its
# `apiClient.ts`), `Content-Type` (every JSON request body), and — as of
# PLATFORM_SPEC_v1.0_FROZEN.md §4's concurrency protocol — `If-Match` on
# `PATCH /editor/venues/{id}`/`PATCH /editor/destinations/{id}`. `consumer/`
# sends none of these (it only calls unauthenticated `/public/*` routes),
# so this list is already a superset of what it needs.
#
# `expose_headers=["ETag"]` — without this, a browser's `fetch()` cannot
# read the `ETag` response header at all (it isn't one of the small set
# of headers exposed to JS by default on a cross-origin response); the
# concurrency protocol is unusable from Studio without it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "PATCH", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "If-Match"],
    expose_headers=["ETag"],
)

app.include_router(api_router)
