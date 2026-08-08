import os
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, HTTPException

from app.api.routes.system import read_version
from app.core.logging import get_error_count

router = APIRouter()

# Same pattern as `system_health.py`'s `_process` — this worker's own
# process, used here for its start time (`last_restart`).
_process = psutil.Process(os.getpid())

_WARNING_ERROR_COUNT = 1
_CRITICAL_ERROR_COUNT = 10


def _status_for_errors(api_errors: int) -> str:
    if api_errors >= _CRITICAL_ERROR_COUNT:
        return "critical"
    if api_errors >= _WARNING_ERROR_COUNT:
        return "warning"
    return "healthy"


@router.get("/system/logs")
def system_logs() -> dict:
    api_errors = get_error_count()

    try:
        last_deploy = read_version().get("last_deployment")
    except HTTPException:
        last_deploy = None

    return {
        "api_errors": api_errors,
        # Nginx runs in a separate container with its own filesystem —
        # reading its error log would need either a Docker inspection
        # path or a shared volume, both explicitly out of scope for this
        # phase (same boundary Phase 2A drew around Docker monitoring).
        # Always `null`, never a guessed or fabricated count.
        "nginx_errors": None,
        "last_restart": datetime.fromtimestamp(_process.create_time(), tz=timezone.utc).isoformat(),
        "last_deploy": last_deploy,
        "status": _status_for_errors(api_errors),
    }
