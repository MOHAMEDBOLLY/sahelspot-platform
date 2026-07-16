import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
def read_root() -> dict:
    return {"name": settings.app_name, "version": settings.app_version}


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
