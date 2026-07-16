from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import DestinationOut
from app.db.models import Destination
from app.db.session import get_db

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    return db.query(Destination).order_by(Destination.name).all()
