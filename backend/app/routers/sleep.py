from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from ..database import get_db
from ..models import SleepLog
from ..schemas import SleepLogCreate, SleepLogOut
from ..services.scoring import compute_and_save_daily_score

router = APIRouter(prefix="/sleep", tags=["sleep"])


@router.get("/{log_date}", response_model=SleepLogOut)
def get_sleep_log(log_date: date, db: Session = Depends(get_db)):
    row = db.query(SleepLog).filter(SleepLog.date == log_date).first()
    if not row:
        raise HTTPException(status_code=404, detail="No sleep log for this date")
    return row


@router.post("/", response_model=SleepLogOut)
def upsert_sleep_log(payload: SleepLogCreate, db: Session = Depends(get_db)):
    existing = db.query(SleepLog).filter(SleepLog.date == payload.date).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = SleepLog(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
    compute_and_save_daily_score(db, payload.date)
    return row
