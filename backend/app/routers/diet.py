from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from ..database import get_db
from ..models import DietLog
from ..schemas import DietLogCreate, DietLogOut
from ..services.scoring import compute_and_save_daily_score

router = APIRouter(prefix="/diet", tags=["diet"])


@router.get("/{log_date}", response_model=DietLogOut)
def get_diet_log(log_date: date, db: Session = Depends(get_db)):
    row = db.query(DietLog).filter(DietLog.date == log_date).first()
    if not row:
        raise HTTPException(status_code=404, detail="No diet log for this date")
    return row


@router.post("/", response_model=DietLogOut)
def upsert_diet_log(payload: DietLogCreate, db: Session = Depends(get_db)):
    existing = db.query(DietLog).filter(DietLog.date == payload.date).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = DietLog(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
    compute_and_save_daily_score(db, payload.date)
    return row
