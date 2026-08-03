from datetime import date, datetime, time, timezone
from typing import Literal

EventPhase = Literal["upcoming", "live", "ended"]

# Events Module v1 — Upcoming/Live/Ended is deliberately never a stored
# column (see `app/db/models.py`'s `Event` docstring): it's derived here,
# on every read, from `start_date`/`end_date`/`start_time`/`end_time`.
# Shared by the editor (`EventOut`) and public (`PublishedEventOut`)
# response shapes — one function, not one per caller.


def compute_event_phase(
    *,
    start_date: date,
    end_date: date | None,
    start_time: time | None,
    end_time: time | None,
    now: datetime | None = None,
) -> EventPhase:
    """`end_date` defaults to `start_date` (a single-day event). A missing
    `start_time`/`end_time` is treated as "all day" — midnight and
    end-of-day respectively — so an event with dates but no times still
    gets a sensible phase instead of comparing `None`.
    """
    current = now or datetime.now(timezone.utc)
    effective_end_date = end_date or start_date

    starts_at = datetime.combine(start_date, start_time or time.min, tzinfo=timezone.utc)
    ends_at = datetime.combine(effective_end_date, end_time or time.max, tzinfo=timezone.utc)

    if current < starts_at:
        return "upcoming"
    if current > ends_at:
        return "ended"
    return "live"
