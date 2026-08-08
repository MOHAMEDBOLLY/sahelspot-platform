import logging
import threading

from app.core.config import settings


class _ErrorCountingHandler(logging.Handler):
    """Counts ERROR+ log records since this process started — the source
    for `GET /system/logs`'s `api_errors` field. In-memory only, per
    worker process (same "per-worker, not shared" reality already
    documented for `system_health.py`'s uptime): resets on restart, which
    is the correct meaning for "errors since this instance came up," not a
    persistent audit log."""

    def __init__(self) -> None:
        super().__init__(level=logging.ERROR)
        self._count = 0
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        with self._lock:
            self._count += 1

    @property
    def count(self) -> int:
        with self._lock:
            return self._count


_error_counter = _ErrorCountingHandler()


def get_error_count() -> int:
    return _error_counter.count


def setup_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    logging.getLogger().addHandler(_error_counter)
