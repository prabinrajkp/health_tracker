from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class DietLogCreate(BaseModel):
    date: date
    breakfast_logged: bool = False
    breakfast_option: Optional[str] = None
    breakfast_notes: Optional[str] = None
    lunch_logged: bool = False
    lunch_protein_first: bool = False
    lunch_notes: Optional[str] = None
    dinner_logged: bool = False
    dinner_time: Optional[str] = None
    dinner_option: Optional[str] = None
    no_post_dinner_snack: bool = False
    tea_sugar_reduced: bool = False
    water_intake_ok: bool = False
    notes: Optional[str] = None


class DietLogOut(DietLogCreate):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkoutLogCreate(BaseModel):
    date: date
    steps: int = 0
    post_dinner_walk: bool = False
    post_dinner_walk_minutes: int = 0
    exercise_done: bool = False
    exercise_type: Optional[str] = None
    exercise_duration_minutes: int = 0
    notes: Optional[str] = None


class WorkoutLogOut(WorkoutLogCreate):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SleepLogCreate(BaseModel):
    date: date
    sleep_time: Optional[str] = None
    wake_time: Optional[str] = None
    sleep_hours: float = 0
    quality: int = Field(default=3, ge=1, le=5)
    notes: Optional[str] = None


class SleepLogOut(SleepLogCreate):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DailyScoreOut(BaseModel):
    date: date
    diet_score: float
    workout_score: float
    sleep_score: float
    bonus_points: float
    total_score: float
    streak_days: int
    computed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConfigItem(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


class ConfigItemOut(ConfigItem):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
