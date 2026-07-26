import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)


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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "PATCH", "POST", "DELETE"],
    allow_headers=["*"],
)

app.include_router(api_router)
