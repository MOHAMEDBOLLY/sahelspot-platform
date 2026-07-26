from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(title=settings.app_name, version=settings.app_version)

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
