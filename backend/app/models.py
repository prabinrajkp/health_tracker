from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Date
from sqlalchemy.sql import func
from .database import Base


class DietLog(Base):
    __tablename__ = "diet_logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    breakfast_logged = Column(Boolean, default=False)
    breakfast_option = Column(String(10))  # A, B, C
    breakfast_notes = Column(Text)
    lunch_logged = Column(Boolean, default=False)
    lunch_protein_first = Column(Boolean, default=False)
    lunch_notes = Column(Text)
    dinner_logged = Column(Boolean, default=False)
    dinner_time = Column(String(5))  # HH:MM
    dinner_option = Column(String(10))  # A, B, C, D
    no_post_dinner_snack = Column(Boolean, default=False)
    tea_sugar_reduced = Column(Boolean, default=False)
    water_intake_ok = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WorkoutLog(Base):
    __tablename__ = "workout_logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    steps = Column(Integer, default=0)
    post_dinner_walk = Column(Boolean, default=False)
    post_dinner_walk_minutes = Column(Integer, default=0)
    exercise_done = Column(Boolean, default=False)
    exercise_type = Column(String(50))  # badminton, stairs, walking, gym
    exercise_duration_minutes = Column(Integer, default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SleepLog(Base):
    __tablename__ = "sleep_logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    sleep_time = Column(String(5))   # HH:MM (24h)
    wake_time = Column(String(5))    # HH:MM (24h)
    sleep_hours = Column(Float, default=0)
    quality = Column(Integer, default=3)  # 1-5
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DailyScore(Base):
    __tablename__ = "daily_scores"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True, index=True)
    diet_score = Column(Float, default=0)
    workout_score = Column(Float, default=0)
    sleep_score = Column(Float, default=0)
    bonus_points = Column(Float, default=0)
    total_score = Column(Float, default=0)
    streak_days = Column(Integer, default=0)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())


class TrackerConfig(Base):
    __tablename__ = "tracker_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
