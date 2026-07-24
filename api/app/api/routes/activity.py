from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import ActivityLogEntryOut
from app.db.models import ActivityLogEntry
from app.db.session import get_db

router = APIRouter(tags=["activity"])


@router.get("/activity", response_model=list[ActivityLogEntryOut])
def list_activity(db: Session = Depends(get_db)):
    """The Editorial Activity Log — observability only, newest first.
    Read-only: this route (and this whole feature) never writes anything;
    every entry it returns was created by `app/activity/service.py`'s
    `log_activity()`, called from within the workflow/publishing action it
    describes.
    """
    entries = db.query(ActivityLogEntry).order_by(ActivityLogEntry.timestamp.desc()).all()
    return [
        ActivityLogEntryOut(
            id=entry.id,
            timestamp=entry.timestamp,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            actor=entry.actor,
            metadata=entry.activity_metadata,
        )
        for entry in entries
    ]
