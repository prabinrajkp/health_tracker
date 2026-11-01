import { describe, it, expect } from 'vitest'
import {
  stepKcal, exerciseKcal, walkKcal, estimateBurn, isDayComplete, computeNet,
  describeNet, fmtNet, fmtGoal, round10, summariseNet, suggestAddOns,
} from '../energy.js'

// The plan's worked example: 72 kg, 175 cm, lightly active, BMR 1729.
const dietetics = { bmr: 1729, pac: 1.375, heightCm: 175, weightKg: 72, netGoal: -500, goal: 'lose', burnOffset: 0 }
const gym = { steps: 9000, exercise_done: true, exercise_type: 'Gym', exercise_duration_minutes: 45 }
const meal = (mealType, kcal = 700, over = {}) => ({ mealType, portions: 1, kcalPerPortion: kcal, category: 'good', ...over })
const fullDay = { meal_items: [meal('breakfast'), meal('lunch'), meal('dinner')] }

describe('estimateBurn', () => {
  it('reproduces the worked example', () => {
    const b = estimateBurn({ dietetics, workout: gym })
    expect(Math.round(b.resting)).toBe(2075)
    expect(round10(b.steps)).toBe(200)
    expect(Math.round(b.exercise)).toBe(216)
    expect(round10(b.total)).toBe(2490)
  })
  it('sits between the old activity levels on that day', () => {
    const { total } = estimateBurn({ dietetics, workout: gym })
    expect(total).toBeGreaterThan(1729 * 1.375)
    expect(total).toBeLessThan(1729 * 1.55)
  })
  it('matches the sedentary figure on a day with few steps', () => {
    const b = estimateBurn({ dietetics, workout: { steps: 2500 } })
    expect(Math.round(b.total)).toBe(2075)
  })
  it('falls back on the activity level with no activity logged', () => {
    const b = estimateBurn({ dietetics, workout: null })
    expect(b.source).toBe('activity_level')
    expect(Math.round(b.total)).toBe(Math.round(1729 * 1.375))
  })
  it('does not count steps below the allowance as negative', () => {
    expect(stepKcal(1000, 175, 72)).toBe(0)
  })
  it('applies a correction from the scale check', () => {
    const b = estimateBurn({ dietetics: { ...dietetics, burnOffset: -150 }, workout: gym })
    expect(Math.round(b.total)).toBe(Math.round(estimateBurn({ dietetics, workout: gym }).total - 150))
  })
  it('scales only the resting part while the day is open', () => {
    const b = estimateBurn({ dietetics, workout: gym, fractionOfDay: 0.5 })
    expect(Math.round(b.resting)).toBe(1037)
    expect(round10(b.steps)).toBe(200)
  })
  it('lets device calories replace the steps and exercise estimates', () => {
    const b = estimateBurn({ dietetics, workout: { ...gym, active_kcal: 500 }, useDevice: true })
    expect(b.source).toBe('device')
    expect(b.steps).toBe(0)
    expect(Math.round(b.total)).toBe(2575)
  })
  it('ignores device calories unless turned on', () => {
    expect(estimateBurn({ dietetics, workout: { ...gym, active_kcal: 500 } }).source).toBe('logs')
  })
})

describe('double counting', () => {
  it('counts a walking session through steps when steps exist', () => {
    expect(exerciseKcal({ steps: 8000, exercise_done: true, exercise_type: 'Walking', exercise_duration_minutes: 30 }, 72)).toBe(0)
  })
  it('counts it from minutes when the day has no steps', () => {
    expect(exerciseKcal({ steps: 0, exercise_done: true, exercise_type: 'Walking', exercise_duration_minutes: 30 }, 72)).toBeCloseTo(100.8)
  })
  it('treats a post-dinner walk the same way', () => {
    expect(walkKcal({ steps: 8000, post_dinner_walk: true, post_dinner_walk_minutes: 20 }, 72)).toBe(0)
    expect(walkKcal({ steps: 0, post_dinner_walk: true, post_dinner_walk_minutes: 20 }, 72)).toBeCloseTo(67.2)
  })
  it('burns more on a hard session', () => {
    const base = { steps: 0, exercise_done: true, exercise_type: 'Badminton', exercise_duration_minutes: 60 }
    expect(exerciseKcal(base, 72)).toBeCloseTo(4.5 * 72)
    expect(exerciseKcal({ ...base, exercise_intensity: 'hard' }, 72)).toBeCloseTo(6 * 72)
  })
  it('handles an unknown or empty exercise type as Other', () => {
    expect(exerciseKcal({ exercise_done: true, exercise_type: '', exercise_duration_minutes: 60 }, 72)).toBeCloseTo(4 * 72)
  })
})

describe('computeNet', () => {
  const base = { dietetics, workout: gym, today: '2026-11-01' }
  it('reproduces the worked example', () => {
    const d = { meal_items: [meal('breakfast', 700), meal('lunch', 700), meal('dinner', 700)] }
    const n = computeNet({ ...base, diet: d, date: '2026-10-31' })
    expect(n.eaten).toBe(2100)
    expect(round10(n.net)).toBe(-390)
    expect(n.counts).toBe(true)
    expect(n.netGoal).toBe(-500)
  })
  it('gives no result without targets', () => {
    expect(computeNet({ ...base, dietetics: null, diet: fullDay, date: '2026-10-31' })).toBeNull()
  })
  it('never counts today while it is open, and scales resting burn', () => {
    const n = computeNet({ ...base, diet: fullDay, date: '2026-11-01', now: new Date('2026-11-01T12:00:00') })
    expect(n.open).toBe(true)
    expect(n.counts).toBe(false)
    expect(Math.round(n.burn.resting)).toBe(1037)
  })
  it('keeps sick days out of comparisons', () => {
    expect(computeNet({ ...base, diet: fullDay, date: '2026-10-31', sick: true }).counts).toBe(false)
  })
  it('keeps half-logged days out of comparisons', () => {
    const n = computeNet({ ...base, diet: { meal_items: [meal('lunch')] }, date: '2026-10-31' })
    expect(n.counts).toBe(false)
  })
})

describe('isDayComplete', () => {
  it('needs two main meals', () => {
    expect(isDayComplete({ meal_items: [meal('lunch'), meal('snacks')] })).toBe(false)
    expect(isDayComplete({ meal_items: [meal('lunch'), meal('dinner')] })).toBe(true)
  })
  it('needs most portions to carry calorie data', () => {
    expect(isDayComplete({ meal_items: [meal('lunch', null), meal('dinner', null), meal('breakfast')] })).toBe(false)
  })
  it('handles nothing logged', () => {
    expect(isDayComplete(null)).toBe(false)
  })
})

describe('wording', () => {
  it('describes net against the goal', () => {
    expect(describeNet(-390, -500)).toBe('On plan')
    expect(describeNet(-100, -500)).toBe('About 400 above plan')
    expect(describeNet(0, 275)).toBe('About 280 below plan')
  })
  it('formats signed figures with a real minus', () => {
    expect(fmtNet(-389)).toBe('~−390')
    expect(fmtNet(275)).toBe('~+280')
    expect(fmtNet(2)).toBe('~0')
    expect(fmtGoal(-500)).toBe('−500')
    expect(fmtGoal(275)).toBe('+275')
    expect(fmtGoal(0)).toBe('0')
  })
})

describe('summariseNet', () => {
  it('averages only days that count', () => {
    const s = summariseNet([
      { counts: true, net: -100, eaten: 2000, burned: 2100, netGoal: 0 },
      { counts: true, net: -300, eaten: 1800, burned: 2100, netGoal: 0 },
      { counts: false, net: -2000, eaten: 100, burned: 2100, netGoal: 0 },
    ])
    expect(s.days).toBe(2)
    expect(s.avgNet).toBe(-200)
  })
  it('returns null with nothing to average', () => {
    expect(summariseNet([])).toBeNull()
    expect(summariseNet([{ counts: false }])).toBeNull()
  })
})

describe('suggestAddOns', () => {
  it('offers foods already eaten, most often first, and no junk', () => {
    const logs = [
      { meal_items: [meal('lunch', 180, { label: 'Dal' }), meal('snacks', 500, { label: 'Chips', category: 'bad' })] },
      { meal_items: [meal('lunch', 180, { label: 'Dal' }), meal('snacks', 105, { label: 'Banana' })] },
      { meal_items: [meal('lunch', 20, { label: 'Pickle' })] },
    ]
    expect(suggestAddOns(logs).map(f => f.label)).toEqual(['Dal', 'Banana'])
  })
})
