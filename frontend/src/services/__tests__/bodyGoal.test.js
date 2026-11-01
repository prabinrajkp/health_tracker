import { describe, it, expect } from 'vitest'
import {
  planOn, goalHistory, withGoalEntry, defaultPace, fastingCounts, weightDirection, targetProgress,
  weightTone, healthyRange, checkGoal, weightPaceNote, kgGainedOnGoal, steadySpanDays, STEADY_DAYS,
} from '../bodyGoal.js'

const config = (entries) => ({ body_goal_history: JSON.stringify(entries) })
const w = (date, weight_kg) => ({ date, weight_kg })

describe('goal history', () => {
  const entries = [
    { from: '2026-10-01', goal: 'lose', pace: 'standard' },
    { from: '2026-11-01', goal: 'gain', pace: 'slow', muscle: true },
  ]
  it('uses the goal in force on a date', () => {
    expect(planOn(config(entries), '2026-10-15').goal).toBe('lose')
    expect(planOn(config(entries), '2026-11-01').goal).toBe('gain')
  })
  it('means auto before the first entry, or with no entries', () => {
    expect(planOn(config(entries), '2026-09-30')).toBeNull()
    expect(planOn({}, '2026-11-01')).toBeNull()
    expect(planOn({ body_goal_history: 'not json' }, '2026-11-01')).toBeNull()
  })
  it('keeps one entry a day when the user changes their mind', () => {
    const once  = withGoalEntry(goalHistory(config(entries)), '2026-11-02', { goal: 'keep' })
    const twice = withGoalEntry(once, '2026-11-02', { goal: 'lose', pace: 'gentle' })
    expect(twice).toHaveLength(3)
    expect(twice[2].goal).toBe('lose')
  })
  it('turns fasting off by default for Gain only, and honours a choice to keep it', () => {
    expect(planOn(config([{ from: '2026-01-01', goal: 'gain' }]), '2026-02-01').fasting).toBe(false)
    expect(planOn(config([{ from: '2026-01-01', goal: 'lose' }]), '2026-02-01').fasting).toBe(true)
    expect(planOn(config([{ from: '2026-01-01', goal: 'gain', fasting: true }]), '2026-02-01').fasting).toBe(true)
    expect(fastingCounts(null)).toBe(true)
  })
  it('picks a first pace to suit the person', () => {
    expect(defaultPace('gain', { bmi: 17 })).toBe('steady')
    expect(defaultPace('gain', { bmi: 17, muscle: true })).toBe('slow')
    expect(defaultPace('gain', { bmi: 22 })).toBe('slow')
    expect(defaultPace('keep')).toBeNull()
  })
})

describe('the Weight screen', () => {
  it('does not call a 70 kg target reached at 60 kg', () => {
    const p = targetProgress(60, 70, weightDirection({ goal: 'gain' }))
    expect(p).toEqual({ left: 10, reached: false })
  })
  it('works out direction from the target while the goal is auto', () => {
    expect(weightDirection(null, { target: 70, start: 60 })).toBe('up')
    expect(weightDirection(null, { target: 60, start: 70 })).toBe('down')
    expect(weightDirection(null, {})).toBe('down')
  })
  it('reaches a target from either side', () => {
    expect(targetProgress(70, 70, 'up').reached).toBe(true)
    expect(targetProgress(71, 70, 'up').reached).toBe(true)
    expect(targetProgress(69.5, 70, 'down').reached).toBe(true)
    expect(targetProgress(72, 70, 'down')).toEqual({ left: 2, reached: false })
  })
  it('has no target on Keep, or with none set', () => {
    expect(targetProgress(70, 65, 'steady')).toBeNull()
    expect(targetProgress(70, null, 'down')).toBeNull()
  })
  it('colours progress by the goal', () => {
    expect(weightTone(1, 'up')).toBe('good')
    expect(weightTone(-1, 'up')).toBe('caution')
    expect(weightTone(-1, 'down')).toBe('good')
    expect(weightTone(1, 'down')).toBe('caution')
    expect(weightTone(0.5, 'steady')).toBe('good')
    expect(weightTone(3, 'steady')).toBeNull()
    expect(weightTone(0, 'up')).toBeNull()
  })
})

describe('guard rails', () => {
  it('gives the healthy range for a height', () => {
    expect(healthyRange(175)).toEqual({ min: 56.7, max: 70.4 })
  })
  it('does not allow losing below BMI 18.5', () => {
    expect(checkGoal({ goal: 'lose', bmi: 18 }).blocks).toHaveLength(1)
    expect(checkGoal({ goal: 'lose', bmi: 18.5 }).blocks).toHaveLength(0)
  })
  it('does not accept a Lose target below BMI 18.5', () => {
    expect(checkGoal({ goal: 'lose', bmi: 22, heightCm: 175, target: 50, current: 67 }).blocks).toHaveLength(1)
  })
  it('asks when the target is on the wrong side', () => {
    expect(checkGoal({ goal: 'gain', target: 60, current: 70 }).blocks).toHaveLength(1)
    expect(checkGoal({ goal: 'lose', target: 80, current: 70 }).blocks).toHaveLength(1)
    expect(checkGoal({ goal: 'gain', target: 80, current: 70 }).blocks).toHaveLength(0)
  })
  it('allows Gain above BMI 25, with a note', () => {
    const r = checkGoal({ goal: 'gain', bmi: 26 })
    expect(r.blocks).toHaveLength(0)
    expect(r.notes).toHaveLength(1)
  })
  it('notes that targets are for adults', () => {
    expect(checkGoal({ goal: 'keep', age: 16 }).notes).toHaveLength(1)
    expect(checkGoal({ goal: 'keep', age: 18 }).notes).toHaveLength(0)
  })
  it('says nothing when nothing is known', () => {
    expect(checkGoal({ goal: 'auto' })).toEqual({ blocks: [], notes: [] })
  })
})

describe('weightPaceNote', () => {
  const now = new Date('2026-11-01T12:00:00')
  const series = (a, b, c, d) => [w('2026-10-08', a), w('2026-10-15', b), w('2026-10-22', c), w('2026-10-29', d)]
  it('notes fast loss over three weeks', () => {
    expect(weightPaceNote(series(80, 78.5, 77, 75.5), { goal: 'lose' }, now)).toMatch(/slower pace/)
  })
  it('stays quiet at a normal pace', () => {
    expect(weightPaceNote(series(80, 79.6, 79.2, 78.8), { goal: 'lose' }, now)).toBeNull()
  })
  it('notes weight falling while gaining', () => {
    expect(weightPaceNote(series(60, 59.6, 59.2, 58.8), { goal: 'gain' }, now)).toMatch(/doctor/)
  })
  it('needs four weeks of weigh-ins, and a chosen goal', () => {
    expect(weightPaceNote([w('2026-10-29', 80)], { goal: 'lose' }, now)).toBeNull()
    expect(weightPaceNote(series(80, 78, 76, 74), null, now)).toBeNull()
  })
})

describe('goal badges', () => {
  it('counts kilos gained only while on the Gain goal', () => {
    const history = [{ from: '2026-06-01', goal: 'gain' }]
    const weights = [w('2026-05-01', 75), w('2026-05-20', 60), w('2026-06-10', 61), w('2026-07-01', 63)]
    expect(kgGainedOnGoal(weights, history)).toBe(3)
  })
  it('does not count weight regained before the goal began', () => {
    expect(kgGainedOnGoal([w('2026-05-01', 60), w('2026-05-20', 70)], [{ from: '2026-06-01', goal: 'gain' }])).toBe(0)
    expect(kgGainedOnGoal([w('2026-05-01', 60), w('2026-05-20', 70)], [])).toBe(0)
  })
  it('keeps the best gain after a later dip', () => {
    const weights = [w('2026-06-01', 60), w('2026-07-01', 65), w('2026-08-01', 62)]
    expect(kgGainedOnGoal(weights, [{ from: '2026-06-01', goal: 'gain' }])).toBe(5)
  })
  const steady = (n, every, val = () => 70) => Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 5, 1 + i * every))
    return w(d.toISOString().slice(0, 10), val(i))
  })
  const keep = [{ from: '2026-06-01', goal: 'keep' }]
  it('earns steady for 4 weeks with 8 weigh-ins', () => {
    expect(steadySpanDays(steady(9, 4), keep)).toBeGreaterThanOrEqual(STEADY_DAYS)
  })
  it('needs enough weigh-ins', () => {
    expect(steadySpanDays(steady(5, 7), keep)).toBeLessThan(STEADY_DAYS)
  })
  it('is broken by leaving the band', () => {
    expect(steadySpanDays(steady(9, 4, i => (i === 4 ? 75 : 70)), keep)).toBeLessThan(STEADY_DAYS)
  })
  it('does not count on any other goal', () => {
    expect(steadySpanDays(steady(9, 4), [{ from: '2026-06-01', goal: 'lose' }])).toBe(0)
  })
})
