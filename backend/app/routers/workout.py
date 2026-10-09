from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from ..database import get_db
from ..models import WorkoutLog
from ..schemas import WorkoutLogCreate, WorkoutLogOut
from ..services.scoring import compute_and_save_daily_score

router = APIRouter(prefix="/workout", tags=["workout"])


@router.get("/{log_date}", response_model=WorkoutLogOut)
def get_workout_log(log_date: date, db: Session = Depends(get_db)):
    row = db.query(WorkoutLog).filter(WorkoutLog.date == log_date).first()
    if not row:
        raise HTTPException(status_code=404, detail="No workout log for this date")
    return row


@router.post("/", response_model=WorkoutLogOut)
def upsert_workout_log(payload: WorkoutLogCreate, db: Session = Depends(get_db)):
    existing = db.query(WorkoutLog).filter(WorkoutLog.date == payload.date).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = WorkoutLog(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
    compute_and_save_daily_score(db, payload.date)
    return row
