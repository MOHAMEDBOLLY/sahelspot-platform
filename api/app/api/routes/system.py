import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter()

# Single source of truth for version info across Consumer, Studio, and the
# API — a manually-updated file, not generated at build/deploy time. Lives
# at the repo root of the `api/` Docker build context (see api/Dockerfile's
# `COPY . .`), one level up from this file.
VERSION_FILE = Path(__file__).resolve().parents[3] / "version.json"


@router.get("/")
def read_root() -> dict:
    return {"name": settings.app_name, "version": settings.app_version}


@router.get("/version")
def read_version() -> dict:
    try:
        with VERSION_FILE.open() as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed to read %s", VERSION_FILE)
        raise HTTPException(status_code=503, detail={"error": "version_unavailable"})


@router.get("/health")
def health_check() -> dict:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=503,
            detail={"status": "error", "database": "disconnected"},
        )
    return {"status": "ok", "database": "connected"}
