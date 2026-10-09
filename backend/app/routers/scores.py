from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List
from ..database import get_db
from ..models import DailyScore
from ..schemas import DailyScoreOut
from ..services.scoring import compute_and_save_daily_score

router = APIRouter(prefix="/scores", tags=["scores"])


@router.get("/today", response_model=DailyScoreOut)
def get_today_score(db: Session = Depends(get_db)):
    today = date.today()
    score = compute_and_save_daily_score(db, today)
    return score


@router.get("/date/{score_date}", response_model=DailyScoreOut)
def get_score_for_date(score_date: date, db: Session = Depends(get_db)):
    score = compute_and_save_daily_score(db, score_date)
    return score


@router.get("/range", response_model=List[DailyScoreOut])
def get_scores_range(
    start: date = Query(...),
    end: date = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(DailyScore)
        .filter(DailyScore.date >= start, DailyScore.date <= end)
        .order_by(DailyScore.date)
        .all()
    )
    return rows


@router.get("/monthly/{year}/{month}", response_model=List[DailyScoreOut])
def get_monthly_scores(year: int, month: int, db: Session = Depends(get_db)):
    from calendar import monthrange
    _, last_day = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)
    rows = (
        db.query(DailyScore)
        .filter(DailyScore.date >= start, DailyScore.date <= end)
        .order_by(DailyScore.date)
        .all()
    )
    return rows


@router.get("/streak", response_model=dict)
def get_current_streak(db: Session = Depends(get_db)):
    today = date.today()
    streak = 0
    check = today
    while True:
        row = db.query(DailyScore).filter(DailyScore.date == check).first()
        if row and row.total_score >= 60:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return {"streak": streak, "date": today}
