"""Editorial Activity Log — cross-cutting observability infrastructure.

Deliberately its own package, independent of `app/validation/`,
`app/workflow/`, and `app/publishing/`: this is not a fourth workflow
concept, it's a record *about* the other three. It must never influence
what any of them do — nothing in this codebase reads `activity_log` to
make a decision, and this module never touches `destinations`, `venues`,
or `publish_revisions`. See docs/ARCHITECTURE.md's Sprint 19 entry for the
full reasoning.
"""

from sqlalchemy.orm import Session

from app.db.models import ActivityLogEntry


def log_activity(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    actor: str,
    metadata: dict | None = None,
) -> ActivityLogEntry:
    """The one place an activity entry is ever constructed — every
    workflow/publishing action calls this instead of building its own row,
    so the shape of an entry only has to be right once, not once per call
    site. `actor` is the authenticated caller's Supabase user id (see
    `app/auth/dependencies.py`) — every call site now has a real one via
    `get_current_user`, so there is no placeholder to fall back to.

    Deliberately does not commit. The caller is expected to `db.add()` this
    within the same transaction as the action it's recording and commit
    once — so an activity entry and the state change it describes are
    always persisted atomically together, never one without the other.
    """
    entry = ActivityLogEntry(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        activity_metadata=metadata,
        actor=actor,
    )
    db.add(entry)
    return entry
