import { DEFAULT_WEIGHTS } from './db'

// One place for the things every screen needs to describe a score: the grade
// ladder and the category maximums. Maximums come from the user's settings so
// no screen prints a number the scoring engine doesn't agree with.

export function gradeFor(score) {
  if (score >= 90) return { letter: 'S', label: 'Outstanding',  color: '#a78bfa' }
  if (score >= 80) return { letter: 'A', label: 'Excellent',    color: '#22c55e' }
  if (score >= 70) return { letter: 'B', label: 'Great',        color: '#38bdf8' }
  if (score >= 60) return { letter: 'C', label: 'Good',         color: '#f59e0b' }
  if (score >= 40) return { letter: 'D', label: 'Below target', color: '#f97316' }
  return               { letter: 'F', label: 'Needs work',   color: '#ef4444' }
}

// Accepts the config as either the rows getConfig() returns or a {key: value} map.
export function weightsFromConfig(config) {
  let raw = null
  if (Array.isArray(config)) raw = config.find(c => c.key === 'score_weights')?.value
  else if (config) raw = config.score_weights
  if (!raw) return DEFAULT_WEIGHTS
  try {
    const w = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      ...DEFAULT_WEIGHTS, ...w,
      workout:   { ...DEFAULT_WEIGHTS.workout,   ...(w.workout || {}) },
      sleep:     { ...DEFAULT_WEIGHTS.sleep,     ...(w.sleep || {}) },
      penalties: { ...DEFAULT_WEIGHTS.penalties, ...(w.penalties || {}) },
      fasting:   { ...DEFAULT_WEIGHTS.fasting,   ...(w.fasting || {}) },
    }
  } catch {
    return DEFAULT_WEIGHTS
  }
}

export function categoryMaxes(weights) {
  weights = weights || DEFAULT_WEIGHTS
  return {
    diet:    weights.diet_max    || 35,
    fasting: weights.fasting?.max_points ?? 10,
    workout: weights.workout_max || 35,
    sleep:   weights.sleep_max   || 30,
  }
}

export function stepTargets(weights) {
  const w = (weights || DEFAULT_WEIGHTS).workout || {}
  return {
    half:       w.steps_half_threshold || 5000,
    full:       w.steps_full_threshold || 8000,
    bonusStart: w.steps_bonus_start    || 10000,
    bonusEnd:   w.steps_bonus_end      || 18000,
  }
}

export const CATEGORY_COLORS = {
  diet: '#22c55e', fasting: '#f97316', workout: '#38bdf8', sleep: '#a78bfa',
}
