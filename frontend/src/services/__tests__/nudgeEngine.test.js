import { describe, it, expect } from 'vitest'
import { planSlots, MIN_GAP_MS, ANCHORS, NUDGE_CAP } from '../nudgeEngine.js'
import { deriveFacts } from '../nudgeFacts.js'
import { DEFAULT_WEIGHTS } from '../db.js'

const NOW = new Date(2026, 10, 3, 9, 0)   // Tuesday 3 Nov 2026, 9 AM
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n, from = NOW) => ymd(new Date(from.getFullYear(), from.getMonth(), from.getDate() - n))

const raw = (over = {}) => ({
  config: { notification_mode: 'standard', reminders_on: 'true', score_weights: JSON.stringify(DEFAULT_WEIGHTS), ...(over.config || {}) },
  diets: [], workouts: [], sleeps: [], scores: [], sick: [], streak: 0, timerStart: null, quests: null, nearBadges: [],
  waterMl: 0, waterGoalMl: 0,
  ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'config')),
})
const plan = (over = {}, ctx = {}, now = NOW) => planSlots(deriveFacts(raw(over), now), ctx)
const on = (slots, date) => slots.filter(s => s.date === date)
const today = ymd(NOW)

describe('faults the plan set out to fix', () => {
  it('fault 1: dinner reminder is gone once dinner is logged', () => {
    const before = plan()
    expect(on(before, today).some(s => s.trigger === 'dinner')).toBe(true)
    const after = plan({ diets: [{ date: today, meal_items: [{ mealType: 'dinner', time: '19:00', label: 'x', portions: 1 }] }] })
    expect(on(after, today).some(s => s.trigger === 'dinner')).toBe(false)
  })
  it('fault 3: comeback is booked ahead, for days 3 and 7, and nothing later', () => {
    const slots = plan().filter(s => s.trigger === 'comeback')
    expect(slots.map(s => s.day)).toEqual([3, 7])
    expect(Math.max(...plan().map(s => s.day))).toBeLessThanOrEqual(7)
  })
  it('fault 4: the weekly wrap is booked ahead, with no app open on Sunday', () => {
    const wrap = plan().find(s => s.trigger === 'wrap_week')
    expect(new Date(wrap.at).getDay()).toBe(0)
    expect(wrap.body).toMatch(/Open Progress/)   // no totals it cannot know yet
  })
  it('fault 5: stopping the timer this morning does not cancel tonight', () => {
    const slots = plan({ sleeps: [{ date: today, sleep_time: '23:00', wake_time: '07:00', sleep_hours: 8 }] })
    expect(on(slots, today).some(s => s.trigger === 'bedtime')).toBe(true)
  })
  it('fault 5: a timer running tonight cancels tonight only', () => {
    const slots = plan({ timerStart: 1 })
    expect(on(slots, today).some(s => s.trigger === 'bedtime')).toBe(false)
    expect(on(slots, daysAgo(-1)).some(s => s.trigger === 'bedtime')).toBe(true)
  })
  it('fault 7: a sick day cancels everything, with one note next morning', () => {
    const slots = plan({ sick: [{ date: today }] })
    expect(slots).toHaveLength(1)
    expect(slots[0].trigger).toBe('sick_note')
    expect(slots[0].day).toBe(1)
    expect(plan({ sick: [{ date: today }] }, { sickNoteSent: true })).toHaveLength(0)
  })
  it('fault 8: uses the penalty and times from Settings', () => {
    const w = { ...DEFAULT_WEIGHTS, penalties: { ...DEFAULT_WEIGHTS.penalties, dinner_after_9pm: -7 } }
    const slots = plan({ config: { score_weights: JSON.stringify(w), bed_time: '22:15', dinner_reminder_time: '19:40' } })
    const dinner = slots.find(s => s.trigger === 'dinner'), bed = slots.find(s => s.trigger === 'bedtime')
    expect(dinner.body).toMatch(/7 points/)
    expect(dinner.at.getHours() * 60 + dinner.at.getMinutes()).toBe(19 * 60 + 40)
    expect(bed.at.getHours() * 60 + bed.at.getMinutes()).toBe(22 * 60 + 15)
  })
  it('never books a nudge to steps count that could go stale', () => {
    const workouts = Array.from({ length: 7 }, (_, i) => ({ date: daysAgo(i + 1), steps: 3000 }))
    const step = plan({ workouts, config: { notification_mode: 'coach' } }).find(s => s.trigger === 'steps')
    expect(step.body).not.toMatch(/3,000|3000/)
    expect(JSON.stringify(step.facts)).not.toMatch(/today/i)
  })
})

describe('anchors', () => {
  it('are left alone for anyone who never turned reminders on', () => {
    const slots = plan({ config: { reminders_on: '' } })
    expect(slots.some(s => ANCHORS.has(s.trigger))).toBe(false)
  })
  it('are booked a week ahead, so a closed app still reminds', () => {
    const beds = plan().filter(s => s.trigger === 'bedtime')
    expect(beds).toHaveLength(7)
  })
  it('Quiet has bedtime but no dinner', () => {
    const slots = plan({ config: { notification_mode: 'quiet' } })
    expect(slots.some(s => s.trigger === 'bedtime')).toBe(true)
    expect(slots.some(s => s.trigger === 'dinner')).toBe(false)
    expect(slots.some(s => s.trigger === 'comeback')).toBe(false)
    expect(slots.some(s => s.trigger === 'wrap_week')).toBe(true)
  })
})

// A week of habits that gives every kind of nudge something to say
const busy = () => {
  const diets = [], workouts = [], sleeps = [], scores = []
  for (let i = 1; i <= 28; i++) {
    const date = daysAgo(i)
    diets.push({ date, meal_items: [{ mealType: 'dinner', time: '21:10', label: 'x', portions: 1 }], meal_times: { dinner: '21:10' } })
    workouts.push({ date, steps: 3000 })
    sleeps.push({ date, sleep_time: '23:30', wake_time: '07:00', sleep_hours: 7 })
    scores.push({ date, total_score: 50, diet_score: 20, workout_score: 10, sleep_score: 20 })
  }
  return { diets, workouts, sleeps, scores, streak: 5 }
}

describe('budget and timing', () => {
  it.each(['standard', 'coach'])('holds the cap and the 2-hour gap on %s', (mode) => {
    const slots = on(plan({ ...busy(), config: { notification_mode: mode } }), today)
    const nudges = slots.filter(s => !ANCHORS.has(s.trigger))
    expect(nudges.length).toBeLessThanOrEqual(NUDGE_CAP[mode])
    expect(nudges.length).toBeGreaterThan(0)
    const times = slots.map(s => s.at.getTime()).sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MIN_GAP_MS)
  })
  it('keeps Standard to 3 a day, including what already went out', () => {
    const sentToday = [{ trigger: 'steps', at: NOW.getTime() - 3600000 }]
    const slots = on(plan(busy(), { sentToday }), today)
    expect(slots.filter(s => !ANCHORS.has(s.trigger))).toHaveLength(0)
  })
  it('keeps Coach to about 6 a day', () => {
    const slots = on(plan({ ...busy(), config: { notification_mode: 'coach' } }), today)
    expect(slots.length).toBeLessThanOrEqual(6)
  })
  it('stays quiet between bedtime and wake time', () => {
    const slots = plan({ ...busy(), config: { notification_mode: 'coach', bed_time: '22:00', wake_time: '07:00' } })
    for (const s of slots) {
      const min = s.at.getHours() * 60 + s.at.getMinutes()
      expect(min).toBeGreaterThanOrEqual(7 * 60)
      expect(min).toBeLessThanOrEqual(22 * 60)
    }
  })
  it('never books anything in the past', () => {
    const late = new Date(2026, 10, 3, 22, 30)
    for (const s of plan(busy(), {}, late)) expect(s.at.getTime()).toBeGreaterThan(late.getTime())
  })
  it('does not let one nudge always win: recent sends push it down', () => {
    const first = on(plan(busy()), today).filter(s => !ANCHORS.has(s.trigger))[0]
    const recent = [{ trigger: first.trigger, at: NOW.getTime() - 86400000 }, { trigger: first.trigger, at: NOW.getTime() - 2 * 86400000 }]
    const next = on(plan(busy(), { recent }), today).filter(s => !ANCHORS.has(s.trigger))[0]
    expect(next.trigger).not.toBe(first.trigger)
  })
  it('wrap takes the day\'s slot outside Coach', () => {
    const sunday = new Date(2026, 10, 8, 9, 0)
    const slots = on(plan({}, {}, sunday), ymd(sunday))
    expect(slots.some(s => s.trigger === 'wrap_week')).toBe(true)
    expect(slots.filter(s => !ANCHORS.has(s.trigger))).toHaveLength(1)
  })
})

describe('learning', () => {
  it('leaves out kinds that are off or resting', () => {
    const baseline = on(plan(busy()), today).filter(s => !ANCHORS.has(s.trigger))[0].trigger
    const off = on(plan(busy(), { rest: { off: new Set([baseline]) } }), today).map(s => s.trigger)
    const rested = on(plan(busy(), { rest: { rested: new Set([baseline]) } }), today).map(s => s.trigger)
    expect(off).not.toContain(baseline)
    expect(rested).not.toContain(baseline)
  })
  it('sends no nudges on alternate days when throttled', () => {
    const slots = plan(busy(), { rest: { throttled: true } })   // the 3rd is an odd day
    expect(on(slots, today).filter(s => !ANCHORS.has(s.trigger))).toHaveLength(0)
    expect(on(slots, daysAgo(-1)).filter(s => !ANCHORS.has(s.trigger)).length).toBeGreaterThan(0)
  })
})

describe('the other nudges', () => {
  it('moves dinner earlier for someone who eats late, and says when', () => {
    const slot = plan({ ...busy(), config: { notification_mode: 'coach', reminders_on: '' } }).find(s => s.trigger === 'dinner_window')
    expect(slot.body).toMatch(/9:10 PM/)
    const min = slot.at.getHours() * 60 + slot.at.getMinutes()
    expect(min).toBeLessThanOrEqual(20 * 60 + 45)
  })
  it('says the same on the dinner reminder, at the time the user chose', () => {
    const slots = plan({ ...busy(), config: { dinner_reminder_time: '19:30' } })
    const dinner = slots.find(s => s.trigger === 'dinner')
    expect(dinner.body).toMatch(/9:10 PM/)
    expect(dinner.at.getHours() * 60 + dinner.at.getMinutes()).toBe(19 * 60 + 30)
    expect(slots.some(s => s.trigger === 'dinner_window')).toBe(false)
  })
  it('moves an evening nudge earlier rather than dropping it', () => {
    const week = '2026-11-02'
    const config = { notification_mode: 'coach', if_then_plan: JSON.stringify({ week, cost: 'poor_sleep', text: 'If it is 10:30, I will put my phone away' }) }
    const slot = plan({ config }).find(s => s.trigger === 'if_then')
    expect(slot.at.getHours()).toBeLessThan(19)
  })
  it('guards a streak only when nothing is logged yet', () => {
    const coach = { notification_mode: 'coach' }
    expect(plan({ streak: 5, config: coach }).some(s => s.trigger === 'streak_guard')).toBe(true)
    expect(plan({ streak: 5, config: coach, diets: [{ date: today, meal_items: [{ mealType: 'lunch', label: 'x', portions: 1 }] }] }).some(s => s.trigger === 'streak_guard')).toBe(false)
    expect(plan({ streak: 2, config: coach }).some(s => s.trigger === 'streak_guard')).toBe(false)
  })
  it('welcomes back after a sick day instead of chasing', () => {
    const slots = plan({ sick: [{ date: daysAgo(1) }], config: { notification_mode: 'coach' } })
    expect(on(slots, today).find(s => s.trigger === 'fresh_start').title).toBe('Welcome back')
  })
  it('marks a Monday as a fresh start', () => {
    const monday = new Date(2026, 10, 2, 7, 0)
    expect(on(plan({ config: { notification_mode: 'coach' } }, {}, monday), ymd(monday)).some(s => s.trigger === 'fresh_start')).toBe(true)
  })
  it('names the biggest cost of the week just ending, whichever day it is planned', () => {
    const sunday = new Date(2026, 9, 25, 9, 0), monday = new Date(2026, 9, 26, 9, 0)
    const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
    const logs = {
      scores: week.map(date => ({ date, total_score: 50, diet_score: 20, workout_score: 10, sleep_score: 20 })),
      diets: week.map(date => ({ date, meal_items: [], meal_times: { dinner: '21:30' } })),
      config: { notification_mode: 'coach' },
    }
    for (const now of [sunday, monday]) {
      const slot = plan(logs, {}, now).find(s => s.trigger === 'fresh_start')
      expect(slot.body).toMatch(/late dinners/)
    }
  })
  it('notices a real improvement, and asks nothing', () => {
    const scores = [
      { date: daysAgo(2), total_score: 50, diet_score: 15, workout_score: 15, sleep_score: 15 },
      { date: daysAgo(1), total_score: 62, diet_score: 20, workout_score: 15, sleep_score: 22 },
    ]
    const slot = plan({ scores, config: { notification_mode: 'coach' } }).find(s => s.trigger === 'noticed_progress')
    expect(slot.body).toMatch(/Diet|Sleep/)
  })
  it('quotes back the plan picked for this week', () => {
    const week = '2026-11-02'
    const config = { notification_mode: 'coach', if_then_plan: JSON.stringify({ week, cost: 'poor_sleep', text: 'If it is 10:30, I will put my phone away' }) }
    expect(plan({ config }).find(s => s.trigger === 'if_then').body).toMatch(/10:30/)
    const stale = { notification_mode: 'coach', if_then_plan: JSON.stringify({ week: '2026-10-26', cost: 'poor_sleep', text: 'x' }) }
    expect(plan({ config: stale }).some(s => s.trigger === 'if_then')).toBe(false)
  })
  it('does not suggest a late-snack rule or fasting anywhere', () => {
    const slots = plan({ ...busy(), config: { notification_mode: 'coach' } })
    for (const s of slots) expect(`${s.title} ${s.body}`).not.toMatch(/snack|\bfast/i)
  })
  it('never sends the AI live or personal fields', () => {
    const slots = plan({ ...busy(), config: { notification_mode: 'coach', player_name: 'Asha' } })
    const sent = JSON.stringify(slots.filter(s => s.ai).map(s => s.facts))
    expect(sent).not.toMatch(/Asha|weight_kg|height|birth/i)
  })
})
