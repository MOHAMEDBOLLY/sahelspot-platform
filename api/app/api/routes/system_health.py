import logging
import os
import time
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.system import read_version
from app.db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter()

# Process start time, captured once at import — every worker process
# imports this module exactly once, at startup, so each worker reports its
# own real uptime rather than a value shared across workers.
_process = psutil.Process(os.getpid())


_SERVER_UNAVAILABLE = {
    "cpu_percent": None,
    "cpu_cores": None,
    "load_average": None,
    "memory": None,
    "disk": None,
}


def _server_health() -> dict:
    # `psutil`/`os.getloadavg()` calls are effectively infallible on a
    # normal Linux host, but this endpoint's whole contract is "never
    # throw" — a transient OS-level read failure degrades this section to
    # `None` fields exactly like `_database_health` already does for a
    # DB failure, instead of taking the endpoint down with it.
    try:
        load1, load5, load15 = os.getloadavg()
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "cpu_cores": psutil.cpu_count(logical=True),
            "load_average": {"1m": load1, "5m": load5, "15m": load15},
            "memory": {
                "used_percent": memory.percent,
                "used_gb": round(memory.used / (1024**3), 2),
                "total_gb": round(memory.total / (1024**3), 2),
            },
            "disk": {
                "used_percent": disk.percent,
                "used_gb": round(disk.used / (1024**3), 2),
                "total_gb": round(disk.total / (1024**3), 2),
            },
        }
    except (OSError, psutil.Error):
        logger.exception("Server health check failed")
        return dict(_SERVER_UNAVAILABLE)


def _database_health() -> dict:
    try:
        start = time.perf_counter()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            latency_ms = (time.perf_counter() - start) * 1000

            publish_revision = connection.execute(
                text("SELECT id FROM publish_revisions WHERE is_current LIMIT 1")
            ).scalar()
            schema_revision = connection.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).scalar()

        return {
            "status": "connected",
            "latency_ms": round(latency_ms, 2),
            "publish_revision": publish_revision,
            "schema_revision": schema_revision,
        }
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        return {
            "status": "disconnected",
            "latency_ms": None,
            "publish_revision": None,
            "schema_revision": None,
        }


def _worker_count() -> int:
    """Counts live worker processes under the uvicorn master — reflects
    whatever `--workers` value is actually running, without hardcoding the
    number `api/Dockerfile`'s CMD currently passes. Only trusts
    `parent.children()` once the parent itself is confirmed to be the
    uvicorn master (its own cmdline contains "uvicorn"); the worker
    subprocesses it spawns don't necessarily echo "uvicorn" in their own
    cmdline (fork vs. spawn differ by platform), but every direct child of
    a genuine uvicorn master is one of its request-handling workers.
    Without that guard, a plain `parent.children()` would count unrelated
    sibling processes whenever this isn't running under uvicorn's own
    multiprocess manager at all (e.g. launched directly, single-process,
    from a shell)."""
    try:
        parent = _process.parent()
        if parent is None or "uvicorn" not in " ".join(parent.cmdline()):
            return 1
        # Excludes multiprocessing's own housekeeping helper (spawned
        # alongside real workers under the "spawn" start method, not
        # present under "fork") — not a request-handling worker.
        workers = [p for p in parent.children() if "resource_tracker" not in " ".join(p.cmdline())]
        return max(len(workers), 1)
    except psutil.Error:
        return 1


def _format_uptime(seconds: float) -> str:
    total_minutes = int(seconds // 60)
    days, remainder_minutes = divmod(total_minutes, 24 * 60)
    hours, minutes = divmod(remainder_minutes, 60)
    if days > 0:
        return f"{days}d {hours}h"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _api_health() -> dict:
    # Reuses `GET /version`'s own reader (`version.json`, the single
    # source of truth from the Version Information phase) rather than a
    # second copy of that lookup — a failure there (missing/unreadable
    # file) surfaces as `HTTPException`, caught here and reported as
    # `None` for both fields instead of failing this endpoint.
    try:
        version_info = read_version()
        backend_version = version_info.get("backend_version")
        git_commit = version_info.get("git_commit")
    except HTTPException:
        backend_version = None
        git_commit = None

    uptime_seconds = round(time.time() - _process.create_time(), 2)

    return {
        "workers": _worker_count(),
        "uptime_seconds": uptime_seconds,
        "uptime": _format_uptime(uptime_seconds),
        "version": backend_version,
        "git_commit": git_commit,
    }


# Same server thresholds already used for the Studio dashboard's traffic
# lights (<80 healthy, 80-90 warning, >90 critical) — the source of truth
# for both stays this one file's response, not two independently-tuned
# copies of the same numbers.
def _status_for_percent(percent: float | None) -> str:
    if percent is None:
        return "critical"
    if percent > 90:
        return "critical"
    if percent >= 80:
        return "warning"
    return "healthy"


def _status_for_db_latency(latency_ms: float | None) -> str:
    if latency_ms is None:
        return "critical"
    if latency_ms > 300:
        return "critical"
    if latency_ms >= 100:
        return "warning"
    return "healthy"


_SEVERITY = {"healthy": 0, "warning": 1, "critical": 2}


def _overall_status(server: dict, database: dict) -> str:
    statuses = [
        _status_for_percent(server["cpu_percent"]),
        _status_for_percent(server["memory"]["used_percent"] if server["memory"] else None),
        _status_for_percent(server["disk"]["used_percent"] if server["disk"] else None),
        "critical" if database["status"] != "connected" else _status_for_db_latency(database["latency_ms"]),
    ]
    return max(statuses, key=lambda status: _SEVERITY[status])


@router.get("/system/health")
def system_health() -> dict:
    server = _server_health()
    database = _database_health()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": _overall_status(server, database),
        "server": server,
        "database": database,
        "api": _api_health(),
        # Docker monitoring is intentionally deferred (Phase 2A scope) —
        # no socket mount, no Docker SDK, no CLI inspection. Always this
        # literal shape; never a guessed or partially-filled value.
        "docker": {"available": False},
    }
