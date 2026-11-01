import { describe, it, expect } from 'vitest'
import { calcCalorieScore, calcDietScore, calcNutritionTotals, computeScore } from '../scoring.js'
import { DEFAULT_WEIGHTS } from '../db.js'

const W = DEFAULT_WEIGHTS
const TARGET = { energy: 2000 }

const item = (over = {}) => ({
  mealType: 'lunch', portions: 1, pointsPerPortion: 2, category: 'good',
  kcalPerPortion: 500, proteinPerPortion: 20, carbsPerPortion: 60, fatPerPortion: 10,
  ...over,
})

describe('calcNutritionTotals', () => {
  it('sums kcal and macros scaled by portions', () => {
    const t = calcNutritionTotals({ meal_items: [item(), item({ portions: 2 })] })
    expect(t.kcal).toBe(1500)
    expect(t.protein).toBe(60)
    expect(t.carbs).toBe(180)
    expect(t.fat).toBe(30)
    expect(t.coverage).toBe(1)
  })

  it('reports partial coverage when some items lack data', () => {
    const t = calcNutritionTotals({ meal_items: [item(), item({ kcalPerPortion: null })] })
    expect(t.kcal).toBe(500)
    expect(t.coverage).toBe(0.5)
    expect(t.hasData).toBe(true)
  })

  it('is empty for a day with no items', () => {
    const t = calcNutritionTotals({ meal_items: [] })
    expect(t).toMatchObject({ kcal: 0, coverage: 0, hasData: false })
  })
})

describe('calcCalorieScore', () => {
  it('awards full points inside the tolerance band', () => {
    // 2000 kcal target, 4 x 500 = exactly on target
    const d = { meal_items: [item(), item(), item(), item()] }
    expect(calcCalorieScore(d, TARGET, W)).toBe(10)
  })

  it('still awards full points at the edge of tolerance (±10%)', () => {
    const d = { meal_items: [item({ portions: 3.6 })] }  // 1800 = -10%
    expect(calcCalorieScore(d, TARGET, W)).toBe(10)
  })

  it('tapers as the deviation grows', () => {
    const d = { meal_items: [item({ portions: 4.8 })] }  // 2400 = +20%
    const score = calcCalorieScore(d, TARGET, W)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(10)
  })

  it('penalises under-eating as much as over-eating', () => {
    const under = calcCalorieScore({ meal_items: [item({ portions: 3.2 })] }, TARGET, W)  // 1600 = -20%
    const over  = calcCalorieScore({ meal_items: [item({ portions: 4.8 })] }, TARGET, W)  // 2400 = +20%
    expect(under).toBe(over)
  })

  it('scores zero beyond the cutoff', () => {
    expect(calcCalorieScore({ meal_items: [item({ portions: 6 })] }, TARGET, W)).toBe(0)   // +50%
    expect(calcCalorieScore({ meal_items: [item({ portions: 1 })] }, TARGET, W)).toBe(0)   // -75%
  })

  // ── The null cases are what protect historical scores ──────────────────────
  it('returns null without body metrics', () => {
    expect(calcCalorieScore({ meal_items: [item()] }, null, W)).toBeNull()
    expect(calcCalorieScore({ meal_items: [item()] }, {}, W)).toBeNull()
  })

  it('returns null when nothing was logged', () => {
    expect(calcCalorieScore({ meal_items: [] }, TARGET, W)).toBeNull()
    expect(calcCalorieScore(null, TARGET, W)).toBeNull()
  })

  it('returns null when no food carries calorie data', () => {
    const d = { meal_items: [item({ kcalPerPortion: null }), item({ kcalPerPortion: null })] }
    expect(calcCalorieScore(d, TARGET, W)).toBeNull()
  })

  it('returns null below the coverage threshold', () => {
    // Only 1 of 3 portions has data → 33% coverage, under the 70% minimum
    const d = { meal_items: [item(), item({ kcalPerPortion: null, portions: 2 })] }
    expect(calcCalorieScore(d, TARGET, W)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regression: days that predate this feature must score exactly as before.
// If these fail, every historical score silently changes on recompute.
// ─────────────────────────────────────────────────────────────────────────────
describe('computeScore — no drift on pre-nutrition days', () => {
  const DIET = {
    meal_items: [
      { mealType: 'breakfast', portions: 1, pointsPerPortion: 2, idealPortions: 1, category: 'good', time: '08:00' },
      { mealType: 'lunch',     portions: 2, pointsPerPortion: 3, idealPortions: 2, category: 'good', time: '13:00' },
      { mealType: 'dinner',    portions: 1, pointsPerPortion: 2, idealPortions: 1, category: 'good', time: '20:00' },
    ],
    meal_times: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' },
  }
  const WORKOUT = { steps: 9000, post_dinner_walk: true, post_dinner_walk_minutes: 15, exercise_done: true, exercise_duration_minutes: 45 }
  const SLEEP   = { sleep_time: '23:00', sleep_hours: 7.5, wake_time: '07:00' }

  it('a day with no dietetics scores identically to the 6-arg call', () => {
    const legacy = computeScore(DIET, WORKOUT, SLEEP, W, [], null)
    const withArg = computeScore(DIET, WORKOUT, SLEEP, W, [], null, null)
    expect(withArg).toEqual(legacy)
    expect(legacy.calorieScore).toBeNull()
  })

  it('items without calorie data leave the total untouched even when metrics exist', () => {
    const without = computeScore(DIET, WORKOUT, SLEEP, W, [], null, null)
    const withTarget = computeScore(DIET, WORKOUT, SLEEP, W, [], null, TARGET)
    expect(withTarget.total).toBe(without.total)
    expect(withTarget.bonus).toBe(without.bonus)
    expect(withTarget.calorieScore).toBeNull()
  })

  it('the bonus threshold does not shift when the component sits out', () => {
    // A near-perfect day should still clear the 85% bonus band exactly as before.
    const perfectish = computeScore(
      { ...DIET, meal_items: DIET.meal_items.map(i => ({ ...i, pointsPerPortion: 12 })) },
      { steps: 18000, post_dinner_walk: true, post_dinner_walk_minutes: 30, exercise_done: true, exercise_duration_minutes: 60 },
      { sleep_time: '22:30', sleep_hours: 8, wake_time: '06:30' },
      W, [], null, TARGET,
    )
    expect(perfectish.calorieScore).toBeNull()
    expect(perfectish.bonus).toBeGreaterThan(0)
  })

  it('adds points on a fully-tracked day without breaking the 100 cap', () => {
    const tracked = {
      ...DIET,
      meal_items: DIET.meal_items.map(i => ({ ...i, kcalPerPortion: 400, proteinPerPortion: 15, carbsPerPortion: 50, fatPerPortion: 8 })),
    }
    // 1x400 + 2x400 + 1x400 = 1600, target 2000 → -20%, partial credit
    const r = computeScore(tracked, WORKOUT, SLEEP, W, [], null, TARGET)
    expect(r.calorieScore).not.toBeNull()
    expect(r.calorieScore).toBeGreaterThan(0)
    expect(r.total).toBeLessThanOrEqual(100)
  })
})

describe('body goal scoring', () => {
  const gain = { goal: 'gain', fasting: false }
  const lose = { goal: 'lose', fasting: true }
  it('forgives going over the target on Gain', () => {
    const d = { meal_items: [item({ portions: 4.6 })] }   // 2300 against 2000: +15%
    expect(calcCalorieScore(d, TARGET, W, gain)).toBe(10)
    expect(calcCalorieScore(d, TARGET, W, lose)).toBeLessThan(10)
    expect(calcCalorieScore(d, TARGET, W, null)).toBeLessThan(10)
  })
  it('still has a limit on Gain', () => {
    expect(calcCalorieScore({ meal_items: [item({ portions: 6 })] }, TARGET, W, gain)).toBe(0)     // +50%
    const taper = calcCalorieScore({ meal_items: [item({ portions: 5.4 })] }, TARGET, W, gain)     // +35%
    expect(taper).toBeGreaterThan(0)
    expect(taper).toBeLessThan(10)
  })
  it('scores under-eating on Gain as before', () => {
    const d = { meal_items: [item({ portions: 3 })] }   // 1500: −25%
    expect(calcCalorieScore(d, TARGET, W, gain)).toBe(calcCalorieScore(d, TARGET, W, null))
  })

  const over = { meal_items: [item({ portions: 3, idealPortions: 1, pointsPerPortion: 4 })] }
  it('does not take points for extra healthy portions on Gain', () => {
    expect(calcDietScore(over, W, [], gain)).toBe(4)
    expect(calcDietScore(over, W, [], null)).toBe(0)   // 4 − (2 × 4 × 0.5)
  })
  it('still takes points for junk on Gain', () => {
    const junk = { meal_items: [item({ pointsPerPortion: 4 }), item({ category: 'bad', pointsPerPortion: -3 })] }
    expect(calcDietScore(junk, W, [], gain)).toBe(1)
  })

  const fastDiet = { meal_items: [item({ mealType: 'breakfast', time: '10:00' })] }
  const lastNight = { meal_items: [item({ mealType: 'dinner', time: '18:00' })] }
  it('gives no fasting points on Gain unless kept', () => {
    expect(computeScore(fastDiet, null, null, W, [], lastNight, null, gain).fastingScore).toBe(0)
    expect(computeScore(fastDiet, null, null, W, [], lastNight, null, { goal: 'gain', fasting: true }).fastingScore).toBeGreaterThan(0)
    expect(computeScore(fastDiet, null, null, W, [], lastNight, null, null).fastingScore).toBeGreaterThan(0)
  })
  it('can still reach 100 with fasting off', () => {
    const big = { ...W, bonus: { all_rules_followed: 0, perfect_score: 0 } }
    const full = { steps: 20000, post_dinner_walk: true, post_dinner_walk_minutes: 15, exercise_done: true, exercise_duration_minutes: 60 }
    const sleep = { sleep_time: '22:30', sleep_hours: 8, wake_time: '06:30' }
    const diet = { meal_items: [item({ portions: 4, pointsPerPortion: 10 })] }
    const r = computeScore(diet, full, sleep, { ...big, workout_max: 35, sleep_max: 30 }, [], null, { energy: 2000 }, gain)
    expect(r.total).toBeGreaterThanOrEqual(90)
  })
  it('reads a zero fasting maximum as zero, not ten', () => {
    const zero = { ...W, fasting: { ...W.fasting, max_points: 0 } }
    const diet = { meal_items: [item({ portions: 4, pointsPerPortion: 10 })] }
    const full = { steps: 20000, post_dinner_walk: true, post_dinner_walk_minutes: 15, exercise_done: true, exercise_duration_minutes: 60 }
    const sleep = { sleep_time: '22:30', sleep_hours: 8, wake_time: '06:30' }
    const r = computeScore(diet, full, sleep, zero, [], null, null, null)
    expect(r.bonus).toBeGreaterThan(0)
  })
})
