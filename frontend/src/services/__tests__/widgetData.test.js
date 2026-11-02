import { describe, it, expect } from 'vitest'
import { buildWidgetData, nextSteps } from '../widgetData'
import { computeNextAction } from '../nextAction'
import { DEFAULT_WEIGHTS } from '../db'

// A Wednesday, so the week has days behind and ahead of it
const at = (h, m = 0) => new Date(2026, 10, 4, h, m, 0)
const TODAY = '2026-11-04'
const meal = (mealType, kcal = 400) => ({ mealType, label: 'x', portions: 1, pointsPerPortion: 3, kcalPerPortion: kcal })
const adult = { height_cm: '175', birth_year: '1990', gender: 'male', activity_level: 'lightly_active' }
const goal = (g, extra = {}) => JSON.stringify([{ from: '2026-01-01', goal: g, pace: g === 'keep' ? null : 'steady', muscle: false, fasting: g !== 'gain', ...extra }])
const score = (total, extra = {}) => ({ date: TODAY, total_score: total, diet_score: 20, fasting_score: 5, workout_score: 10, sleep_score: 25, ...extra })
const weighIn = (date, kg) => ({ date, weight_kg: kg })

const pick = (list, clock) => list.filter(s => s.from <= clock).pop()

describe('next steps by time of day', () => {
  it('matches computeNextAction at every hour left today', () => {
    const logs = { diet: { meal_items: [meal('breakfast')] }, workout: { steps: 3000 }, sleep: null, weights: DEFAULT_WEIGHTS }
    const list = nextSteps(logs, at(7, 10))
    for (let h = 8; h <= 23; h++) {
      const want = computeNextAction({ ...logs, now: at(h) }).next
      expect(pick(list, `${String(h).padStart(2, '0')}:00`).label).toBe(want ? want.label : 'All done for today')
    }
  })

  it('starts at the time it was worked out, and only lists changes', () => {
    const list = nextSteps({ diet: null, workout: null, sleep: null, weights: DEFAULT_WEIGHTS }, at(8, 20))
    expect(list[0].from).toBe('08:20')
    for (let i = 1; i < list.length; i++) expect(list[i].label + list[i].sub).not.toBe(list[i - 1].label + list[i - 1].sub)
    expect(list.every(s => s.from >= '08:20' && s.from <= '23:30')).toBe(true)
  })

  it('moves on from lunch in the afternoon, with the app closed', () => {
    const list = nextSteps({ diet: { meal_items: [meal('breakfast')] }, workout: null, sleep: { sleep_time: '23:00' }, weights: DEFAULT_WEIGHTS }, at(12))
    expect(pick(list, '12:30').label).toBe('Log lunch')
    expect(pick(list, '19:00').label).not.toBe('Log lunch')
  })

  it('opens the exact action', () => {
    const [first] = nextSteps({ diet: null, workout: null, sleep: { sleep_time: '23:00' }, weights: DEFAULT_WEIGHTS }, at(9))
    expect(first.route).toBe('/?meal=breakfast')
  })
})

describe('widget data', () => {
  const base = (over = {}) => buildWidgetData({
    config: { ...adult, body_goal_history: goal('lose') },
    score: score(72), streak: 4,
    diet: { date: TODAY, meal_items: [meal('breakfast', 500), meal('lunch', 700)] },
    workout: { date: TODAY, steps: 4200 }, sleep: { date: TODAY, sleep_time: '23:10', sleep_hours: 7 },
    scores: [score(72), { date: '2026-11-02', total_score: 85 }, { date: '2026-11-03', total_score: 45 }],
    weights: [weighIn('2026-10-01', 82), weighIn('2026-11-03', 80.4)],
    waterEntries: [{ id: 'a', ml: 250 }, { id: 'b', ml: 250 }], waterGoalMl: 2400,
    ...over,
  }, at(13))

  it('is versioned and dated', () => {
    const d = base()
    expect(d.v).toBe(2)
    expect(d.date).toBe(TODAY)
  })

  it('arrives with the grade worked out, so the widget needs no scoring rules', () => {
    const { score: s } = base()
    expect(s).toMatchObject({ total: 72, letter: 'B', label: 'Great', tone: 'brand', nothingYet: false })
    expect(s.bars.map(b => b.key)).toEqual(['diet', 'fasting', 'workout', 'sleep'])
  })

  it('leaves the fasting bar out when fasting points are off', () => {
    const d = base({ config: { ...adult, body_goal_history: goal('gain') } })
    expect(d.score.bars.map(b => b.key)).toEqual(['diet', 'workout', 'sleep'])
  })

  it('says nothing is logged yet on an empty day', () => {
    expect(base({ score: null, diet: null }).score.nothingYet).toBe(true)
  })

  it('has no score, no next step and no drinks goal on a sick day', () => {
    const d = base({ sick: [TODAY] })
    expect(d.sick).toBe(true)
    expect(d.score).toBeNull()
    expect(d.next).toEqual([])
    expect(d.drinks.goalMl).toBe(0)
    expect(d.calories.state).toBe('sick')
    expect(d.goals.sick).toBe(true)
  })

  it('words calories for the body goal', () => {
    expect(base().calories.status).toMatch(/left$/)
    const gain = base({ config: { ...adult, body_goal_history: goal('gain') } }).calories
    expect(gain.goal).toBe('gain')
    expect(gain.status).toMatch(/to go$/)
    const over = base({ diet: { date: TODAY, meal_items: [meal('lunch', 4000)] } }).calories
    expect(over.status).toMatch(/over$/)
    expect(over.warn).toBe(true)
  })

  it('shows no calorie figures when they are hidden', () => {
    expect(base({ config: { ...adult, hide_calories: 'true' } }).calories).toEqual({ state: 'hidden' })
  })

  it('asks for set-up with no weigh-ins, and has no weight', () => {
    const d = base({ weights: [] })
    expect(d.calories.state).toBe('setup')
    expect(d.weight.latest).toBeNull()
  })

  it('keeps calorie targets off for under-18s', () => {
    expect(base({ config: { ...adult, birth_year: '2012' } }).calories.state).toBe('minor')
  })

  it('marks each day of the week, with sick days and days to come', () => {
    const d = base({ sick: ['2026-11-03'] })
    expect(d.week.start).toBe('2026-11-02')
    expect(d.week.days.map(x => x.state)).toEqual(['score', 'sick', 'score', 'future', 'future', 'future', 'future'])
    expect(d.week.days[0].tone).toBe('success')
  })

  it('gives the weight trend and direction from the body goal', () => {
    const { weight } = base()
    expect(weight.latest).toBe(80.4)
    expect(weight.direction).toBe('down')
    expect(weight.tone).toBe('success')
    expect(weight.trend).toEqual([80.4])
  })

  it('hands the widget the last few drinks, for its undo button', () => {
    const d = base()
    expect(d.drinks.ml).toBe(500)
    expect(d.drinks.entries).toEqual([{ id: 'a', ml: 250 }, { id: 'b', ml: 250 }])
  })

  it('gives a second list of steps for a timer the widget starts', () => {
    const d = base({ sleep: null })
    expect(d.nextNoSleep.length).toBeGreaterThan(0)
    expect(d.nextNoSleep.some(s => /sleep/i.test(s.label))).toBe(false)
    expect(base({ timerStart: at(12).getTime() }).nextNoSleep).toEqual([])
  })
})
