import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import TrackerConfig
from ..schemas import ConfigItem, ConfigItemOut
from ..services.scoring import DEFAULT_WEIGHTS

router = APIRouter(prefix="/config", tags=["config"])


def seed_defaults(db: Session):
    defaults = [
        ConfigItem(
            key="score_weights",
            value=json.dumps(DEFAULT_WEIGHTS),
            description="Scoring weights for all categories",
        ),
        ConfigItem(
            key="diet_breakfast_options",
            value=json.dumps(["Option A: 3 boiled eggs + 1 fruit", "Option B: 2 eggs + upma", "Option C: Omelette + dosa"]),
            description="Available breakfast options",
        ),
        ConfigItem(
            key="diet_dinner_options",
            value=json.dumps(["Option A: 2 chapathi + 3 eggs (egg masala)", "Option B: 2 wheat dosa + 3 eggs", "Option C: Egg bhurji + curd", "Option D: Soya + eggs + chapathi"]),
            description="Available dinner options",
        ),
        ConfigItem(
            key="workout_exercise_types",
            value=json.dumps(["Badminton", "Stairs", "Walking", "Gym", "Cycling", "Other"]),
            description="Available exercise types",
        ),
        ConfigItem(
            key="player_name",
            value="Player 1",
            description="Your display name",
        ),
        ConfigItem(
            key="target_weight",
            value="120",
            description="Target weight in kg",
        ),
        ConfigItem(
            key="current_weight",
            value="135",
            description="Starting/current weight in kg",
        ),
    ]
    for item in defaults:
        if not db.query(TrackerConfig).filter(TrackerConfig.key == item.key).first():
            db.add(TrackerConfig(**item.model_dump()))
    db.commit()


@router.get("/", response_model=List[ConfigItemOut])
def list_config(db: Session = Depends(get_db)):
    seed_defaults(db)
    return db.query(TrackerConfig).all()


@router.get("/{key}", response_model=ConfigItemOut)
def get_config(key: str, db: Session = Depends(get_db)):
    seed_defaults(db)
    row = db.query(TrackerConfig).filter(TrackerConfig.key == key).first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Config key not found")
    return row


@router.post("/", response_model=ConfigItemOut)
def upsert_config(payload: ConfigItem, db: Session = Depends(get_db)):
    existing = db.query(TrackerConfig).filter(TrackerConfig.key == payload.key).first()
    if existing:
        existing.value = payload.value
        if payload.description:
            existing.description = payload.description
        db.commit()
        db.refresh(existing)
        return existing
    row = TrackerConfig(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
