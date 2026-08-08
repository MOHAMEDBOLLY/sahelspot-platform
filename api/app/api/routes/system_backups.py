import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()

# The same default `scripts/backup_db.sh` writes to when `BACKUP_DIR` is
# unset (see that script's own default: `$SCRIPT_DIR/../backups`, i.e.
# `api/backups/`) — read-only here, this endpoint never creates, moves,
# renames, or deletes anything in it.
BACKUP_DIR = Path(__file__).resolve().parents[3] / "backups"
BACKUP_GLOB = "sahelspot_backup_*.sql.gz"

# No documented backup cadence exists (RUNBOOK.md: "whatever regular
# schedule your team decides on") — these are a reasonable default for a
# daily-backup expectation, not a value read from anywhere.
_WARNING_AGE_HOURS = 24
_CRITICAL_AGE_HOURS = 72

_UNAVAILABLE = {
    "last_backup": None,
    "backup_size": None,
    "backup_location": str(BACKUP_DIR),
    "backup_age": None,
    "status": "warning",
}


def _human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _human_age(age_seconds: float) -> str:
    minutes = int(age_seconds // 60)
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h"
    days = hours // 24
    return f"{days}d"


def _status_for_age(age_hours: float) -> str:
    if age_hours > _CRITICAL_AGE_HOURS:
        return "critical"
    if age_hours > _WARNING_AGE_HOURS:
        return "warning"
    return "healthy"


@router.get("/system/backups")
def system_backups() -> dict:
    if not BACKUP_DIR.is_dir():
        return _UNAVAILABLE

    try:
        backups = sorted(BACKUP_DIR.glob(BACKUP_GLOB), key=lambda p: p.stat().st_mtime)
    except OSError:
        logger.exception("Failed to list %s", BACKUP_DIR)
        return _UNAVAILABLE

    if not backups:
        return _UNAVAILABLE

    newest = backups[-1]
    try:
        stat = newest.stat()
    except OSError:
        logger.exception("Failed to stat %s", newest)
        return _UNAVAILABLE

    age_seconds = time.time() - stat.st_mtime

    return {
        "last_backup": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "backup_size": _human_size(stat.st_size),
        "backup_location": str(BACKUP_DIR),
        "backup_age": _human_age(age_seconds),
        "status": _status_for_age(age_seconds / 3600),
    }
