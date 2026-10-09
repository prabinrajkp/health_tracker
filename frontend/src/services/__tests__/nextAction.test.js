import { describe, it, expect } from 'vitest'
import { computeNextAction, activePenalties } from '../nextAction'
import { DEFAULT_WEIGHTS } from '../db'

const at = (h, m = 0) => new Date(2026, 9, 9, h, m, 0)
const meal = (mealType) => ({ mealType, label: 'x', portions: 1, pointsPerPortion: 3 })

describe('computeNextAction', () => {
  it('asks for last night\'s sleep first thing in the morning', () => {
    const { next } = computeNextAction({ diet: null, workout: null, sleep: null, now: at(8) })
    expect(next.key).toBe('sleep')
    expect(next.target).toEqual({ type: 'log', tab: 'sleep' })
  })

  it('suggests the meal of the current window once sleep is logged', () => {
    const sleep = { sleep_time: '23:00', wake_time: '06:30' }
    expect(computeNextAction({ sleep, now: at(8) }).next.key).toBe('breakfast')
    expect(computeNextAction({ sleep, now: at(13) }).next.key).toBe('lunch')
    expect(computeNextAction({ sleep, now: at(19) }).next.target).toEqual({ type: 'meal', category: 'dinner' })
  })

  it('falls back to steps between meal windows, with the points they unlock', () => {
    const sleep = { sleep_time: '23:00' }
    const diet = { meal_items: [meal('breakfast'), meal('lunch')] }
    const workout = { steps: 6000, exercise_done: true, exercise_duration_minutes: 45 }
    const { next } = computeNextAction({ diet, workout, sleep, now: at(16) })
    expect(next.key).toBe('steps')
    expect(next.label).toBe('2,000 more steps')
    // 5,000–7,999 earns half the base points; reaching 8,000 earns the other half
    expect(next.impact).toBe(DEFAULT_WEIGHTS.workout.steps_8000 / 2)
  })

  it('uses the step thresholds from settings, not fixed numbers', () => {
    const weights = { ...DEFAULT_WEIGHTS, workout: { ...DEFAULT_WEIGHTS.workout, steps_half_threshold: 3000, steps_full_threshold: 6000 } }
    const { next } = computeNextAction({
      diet: { meal_items: [meal('breakfast'), meal('lunch')] },
      workout: { steps: 4000, exercise_done: true }, sleep: { sleep_time: '23:00' }, weights, now: at(16),
    })
    expect(next.label).toBe('2,000 more steps')
  })

  it('offers the post-dinner walk once dinner is logged', () => {
    const diet = { meal_items: [meal('breakfast'), meal('lunch'), meal('dinner')] }
    const workout = { steps: 12000, exercise_done: true }
    const { next } = computeNextAction({ diet, workout, sleep: { sleep_time: '23:00' }, now: at(20, 30) })
    expect(next.key).toBe('walk')
    expect(next.impact).toBe(DEFAULT_WEIGHTS.workout.post_dinner_walk)
  })

  it('returns nothing when the day is complete', () => {
    const diet = { meal_items: [meal('breakfast'), meal('lunch'), meal('dinner')] }
    const workout = { steps: 12000, exercise_done: true, post_dinner_walk: true }
    const { next } = computeNextAction({ diet, workout, sleep: { sleep_time: '23:00' }, now: at(21) })
    expect(next).toBeNull()
  })
})

describe('activePenalties', () => {
  it('reports late dinner and late sleep with the configured amounts', () => {
    const weights = { ...DEFAULT_WEIGHTS, penalties: { dinner_after_9pm: -7, sleep_after_midnight: -8 } }
    const out = activePenalties({
      diet: { meal_times: { dinner: '21:15' } }, sleep: { sleep_time: '00:40' }, weights,
    })
    expect(out).toEqual([
      { section: 'diet', label: 'Dinner after 9 PM', amount: 7 },
      { section: 'sleep', label: 'Sleep after midnight', amount: 8 },
    ])
  })

  it('reports nothing for an on-time day', () => {
    expect(activePenalties({ diet: { meal_times: { dinner: '20:00' } }, sleep: { sleep_time: '23:10' } })).toEqual([])
  })
})
