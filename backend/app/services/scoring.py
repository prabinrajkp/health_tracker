import json
from datetime import date, timedelta
from sqlalchemy.orm import Session
from ..models import DietLog, WorkoutLog, SleepLog, DailyScore, TrackerConfig


DEFAULT_WEIGHTS = {
    "diet_max": 35,
    "workout_max": 35,
    "sleep_max": 30,
    "diet": {
        "breakfast": 5,
        "lunch": 5,
        "dinner_on_time": 8,
        "no_post_dinner_snack": 7,
        "protein_first": 5,
        "tea_sugar_reduced": 5,
    },
    "workout": {
        "steps_8000": 15,
        "steps_10000_bonus": 3,
        "post_dinner_walk": 10,
        "exercise_session": 10,
    },
    "sleep": {
        "sleep_before_1130": 10,
        "seven_plus_hours": 12,
        "wake_by_7": 8,
    },
    "bonus": {
        "all_rules_followed": 5,
        "perfect_score": 10,
    },
    "penalties": {
        "dinner_after_9pm": -5,
        "sleep_after_midnight": -8,
    },
}


def get_weights(db: Session) -> dict:
    row = db.query(TrackerConfig).filter(TrackerConfig.key == "score_weights").first()
    if row:
        return json.loads(row.value)
    return DEFAULT_WEIGHTS


def _parse_time(t: str) -> tuple[int, int]:
    """Return (hour, minute) from HH:MM string."""
    if not t:
        return (0, 0)
    parts = t.split(":")
    return int(parts[0]), int(parts[1])


def calc_diet_score(diet: DietLog | None, weights: dict) -> float:
    if not diet:
        return 0.0
    w = weights["diet"]
    score = 0.0

    if diet.breakfast_logged:
        score += w["breakfast"]
    if diet.lunch_logged:
        score += w["lunch"]
    if diet.lunch_protein_first:
        score += w["protein_first"]
    if diet.dinner_logged and diet.dinner_time:
        h, m = _parse_time(diet.dinner_time)
        if (h < 20) or (h == 20 and m <= 30):
            score += w["dinner_on_time"]
        elif h == 20 or (h == 21 and m == 0):
            score += w["dinner_on_time"] * 0.5
    if diet.no_post_dinner_snack:
        score += w["no_post_dinner_snack"]
    if diet.tea_sugar_reduced:
        score += w["tea_sugar_reduced"]

    return min(score, weights["diet_max"])


def calc_workout_score(workout: WorkoutLog | None, weights: dict) -> float:
    if not workout:
        return 0.0
    w = weights["workout"]
    score = 0.0

    if workout.steps >= 10000:
        score += w["steps_8000"] + w.get("steps_10000_bonus", 0)
    elif workout.steps >= 8000:
        score += w["steps_8000"]
    elif workout.steps >= 5000:
        score += w["steps_8000"] * 0.5

    if workout.post_dinner_walk and workout.post_dinner_walk_minutes >= 10:
        score += w["post_dinner_walk"]
    elif workout.post_dinner_walk:
        score += w["post_dinner_walk"] * 0.5

    if workout.exercise_done and workout.exercise_duration_minutes >= 45:
        score += w["exercise_session"]
    elif workout.exercise_done and workout.exercise_duration_minutes >= 20:
        score += w["exercise_session"] * 0.6

    return min(score, weights["workout_max"])


def calc_sleep_score(sleep: SleepLog | None, weights: dict) -> float:
    if not sleep:
        return 0.0
    w = weights["sleep"]
    score = 0.0

    if sleep.sleep_time:
        h, m = _parse_time(sleep.sleep_time)
        # Treat times like 22, 23 as evening; 0,1 as past midnight
        if h >= 22:  # 10 PM to 11:30 PM
            if (h == 23 and m <= 30) or h == 22:
                score += w["sleep_before_1130"]
            # 11:31 - 11:59 gets partial
            elif h == 23:
                score += w["sleep_before_1130"] * 0.5
        # after midnight: penalty handled separately

    if sleep.sleep_hours >= 7:
        score += w["seven_plus_hours"]
    elif sleep.sleep_hours >= 6:
        score += w["seven_plus_hours"] * 0.5

    if sleep.wake_time:
        h, m = _parse_time(sleep.wake_time)
        if h <= 7 or (h == 7 and m == 0):
            score += w["wake_by_7"]
        elif h == 7:
            score += w["wake_by_7"] * 0.5

    return min(score, weights["sleep_max"])


def calc_penalties(diet: DietLog | None, sleep: SleepLog | None, weights: dict) -> float:
    p = weights.get("penalties", {})
    penalty = 0.0

    if diet and diet.dinner_time:
        h, _ = _parse_time(diet.dinner_time)
        if h >= 21:
            penalty += p.get("dinner_after_9pm", 0)

    if sleep and sleep.sleep_time:
        h, _ = _parse_time(sleep.sleep_time)
        if h == 0 or h == 1:
            penalty += p.get("sleep_after_midnight", 0)

    return penalty


def get_streak(db: Session, target_date: date) -> int:
    streak = 0
    check = target_date - timedelta(days=1)
    while True:
        row = db.query(DailyScore).filter(DailyScore.date == check).first()
        if row and row.total_score >= 60:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return streak


def compute_and_save_daily_score(db: Session, target_date: date) -> DailyScore:
    weights = get_weights(db)

    diet = db.query(DietLog).filter(DietLog.date == target_date).first()
    workout = db.query(WorkoutLog).filter(WorkoutLog.date == target_date).first()
    sleep = db.query(SleepLog).filter(SleepLog.date == target_date).first()

    diet_score = calc_diet_score(diet, weights)
    workout_score = calc_workout_score(workout, weights)
    sleep_score = calc_sleep_score(sleep, weights)
    penalties = calc_penalties(diet, sleep, weights)

    subtotal = diet_score + workout_score + sleep_score + penalties
    bonus = 0.0
    bw = weights.get("bonus", {})

    max_possible = weights["diet_max"] + weights["workout_max"] + weights["sleep_max"]
    if subtotal >= max_possible:
        bonus += bw.get("perfect_score", 0)
    elif subtotal >= max_possible * 0.85:
        bonus += bw.get("all_rules_followed", 0)

    total = max(0.0, min(100.0, subtotal + bonus))
    streak = get_streak(db, target_date)

    existing = db.query(DailyScore).filter(DailyScore.date == target_date).first()
    if existing:
        existing.diet_score = diet_score
        existing.workout_score = workout_score
        existing.sleep_score = sleep_score
        existing.bonus_points = bonus
        existing.total_score = total
        existing.streak_days = streak
        db.commit()
        db.refresh(existing)
        return existing

    record = DailyScore(
        date=target_date,
        diet_score=diet_score,
        workout_score=workout_score,
        sleep_score=sleep_score,
        bonus_points=bonus,
        total_score=total,
        streak_days=streak,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
