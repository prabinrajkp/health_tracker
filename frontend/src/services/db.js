import Dexie from 'dexie'

export const db = new Dexie('HealthQuestDB')

db.version(1).stores({
  diet_logs:     '++id, &date',
  workout_logs:  '++id, &date',
  sleep_logs:    '++id, &date',
  daily_scores:  '++id, &date',
  tracker_config: '&key',
})

db.version(2).stores({
  diet_logs:     '++id, &date',
  workout_logs:  '++id, &date',
  sleep_logs:    '++id, &date',
  daily_scores:  '++id, &date',
  tracker_config: '&key',
  badges:        '&badge_id, unlock_timestamp',
})

db.version(3).stores({
  diet_logs:     '++id, &date',
  workout_logs:  '++id, &date',
  sleep_logs:    '++id, &date',
  daily_scores:  '++id, &date',
  tracker_config: '&key',
  badges:        '&badge_id, unlock_timestamp',
  weight_logs:   '++id, &date',
})

// Meals-as-objects redesign (see meal_entry_optimization.md): immutable Meal
// records plus auto-learned Meal Templates, additive alongside the existing
// diet_logs.meal_items array (which stays the source of truth for scoring).
db.version(4).stores({
  diet_logs:     '++id, &date',
  workout_logs:  '++id, &date',
  sleep_logs:    '++id, &date',
  daily_scores:  '++id, &date',
  tracker_config: '&key',
  badges:        '&badge_id, unlock_timestamp',
  weight_logs:   '++id, &date',
  meals:         '++id, date, category, fingerprint, timestamp',
  meal_templates: '&fingerprint, category, recommendation_score, last_used',
})

export const DEFAULT_WEIGHTS = {
  diet_max: 35, workout_max: 35, sleep_max: 30,
  diet: {
    breakfast: 5, lunch: 5, dinner_on_time: 8,
    no_post_dinner_snack: 7,
  },
  workout: {
    steps_8000: 15, steps_10000_bonus: 3,
    post_dinner_walk: 10, exercise_session: 10,
    steps_half_threshold: 5000, steps_full_threshold: 8000,
    steps_bonus_start: 10000, steps_bonus_end: 18000,
  },
  sleep: { sleep_before_1130: 10, seven_plus_hours: 12, wake_by_7: 8 },
  bonus: { all_rules_followed: 5, perfect_score: 10 },
  penalties: { dinner_after_9pm: -5, sleep_after_midnight: -8 },
  fasting: { target_hours: 16, min_hours: 12, max_points: 10 },
  // Only applied on days with body metrics and enough food nutrition data.
  calories: { max_points: 10, tolerance: 0.10, zero_at: 0.35, min_coverage: 0.7 },
}

const DEFAULT_CONFIGS = [
  { key: 'score_weights', value: JSON.stringify(DEFAULT_WEIGHTS), description: 'Scoring weights' },
  { key: 'player_name',   value: '',  description: 'Display name' },
  { key: 'target_weight', value: '', description: 'Target weight (kg)' },
  { key: 'current_weight',value: '', description: 'Current weight (kg)' },
  { key: 'height_cm',     value: '', description: 'Height (cm)' },
  { key: 'birth_year',    value: '', description: 'Year of birth' },
  { key: 'gender',        value: '', description: 'Gender (male/female)' },
  { key: 'activity_level',value: '', description: 'Activity level for PAC multiplier' },
  { key: 'loss_rate',     value: 'standard', description: 'Target rate of weight loss' },
]

export async function seedDefaults() {
  for (const cfg of DEFAULT_CONFIGS) {
    const existing = await db.tracker_config.get(cfg.key)
    if (!existing) await db.tracker_config.put(cfg)
  }
}

export default db
