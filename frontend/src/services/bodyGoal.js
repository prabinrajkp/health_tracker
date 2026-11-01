// The body goal: what the user is trying to do with their weight, and from when.
// See docs/body_goal_net_energy_plan.md. Pure functions over the flat config map.
//
// Settings live in `body_goal_history`, one entry per change, so recalculating an
// old day uses the goal that was in force on that day. No entry means `auto`: the
// original BMI rule, kept exactly, for people who have not chosen yet.
import { format, subDays, parseISO, differenceInCalendarDays } from 'date-fns'

export const BODY_GOALS = [
  { id: 'lose', label: 'Lose weight',    desc: 'A steady calorie deficit' },
  { id: 'keep', label: 'Keep my weight', desc: 'Eat around maintenance' },
  { id: 'gain', label: 'Gain weight',    desc: 'A steady calorie surplus' },
]

export const GAIN_PACES = [
  { id: 'slow',   label: 'Slow',   kgPerWeek: 0.25, surplus: 275, desc: 'Suits building muscle' },
  { id: 'steady', label: 'Steady', kgPerWeek: 0.45, surplus: 500, desc: 'Suits being underweight' },
]

export const UNDERWEIGHT_BMI = 18.5
export const OVERWEIGHT_BMI  = 23     // the cut-off the calorie rule already uses
export const ADULT_AGE       = 18
const GAIN_NOTE_BMI = 25

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

// Accepts the config as a {key: value} map.
export function goalHistory(config) {
  const raw = config?.body_goal_history
  if (!raw) return []
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? [...list].sort((a, b) => a.from.localeCompare(b.from)) : []
  } catch {
    return []
  }
}

// Fasting points suit eating less often, so Gain starts with them off.
export const defaultFasting = (goal) => goal !== 'gain'

function normalise(entry) {
  return {
    goal:   entry.goal,
    pace:   entry.pace || null,
    muscle: !!entry.muscle,
    fasting: entry.fasting ?? defaultFasting(entry.goal),
    maintenanceOffset: Number(entry.maintenanceOffset) || 0,
    burnOffset:        Number(entry.burnOffset) || 0,
    from:   entry.from,
  }
}

// The plan in force on a date, or null while the goal is still `auto`.
export function planOn(config, date = todayStr()) {
  const list = goalHistory(config).filter(e => e.from <= date)
  return list.length ? normalise(list[list.length - 1]) : null
}

// One entry per day: changing your mind twice today leaves one change.
export function withGoalEntry(history, date, entry) {
  const others = history.filter(e => e.from !== date)
  return [...others, { ...entry, from: date }].sort((a, b) => a.from.localeCompare(b.from))
}

// A sensible first pace for the goal and body. Underweight people get the larger surplus.
export function defaultPace(goal, { bmi = null, muscle = false } = {}) {
  if (goal === 'lose') return 'standard'
  if (goal === 'gain') return bmi != null && bmi < UNDERWEIGHT_BMI && !muscle ? 'steady' : 'slow'
  return null
}

export const fastingCounts = (plan) => (plan ? plan.fasting : true)

// Which way the scale should move. For `auto` it is worked out from the target,
// so someone gaining without a chosen goal is not told they already arrived.
export function weightDirection(plan, { target = null, start = null } = {}) {
  if (plan?.goal === 'gain') return 'up'
  if (plan?.goal === 'lose') return 'down'
  if (plan?.goal === 'keep') return 'steady'
  if (target != null && start != null && target > start) return 'up'
  return 'down'
}

// Distance to the target weight. null when there is no target to reach.
export function targetProgress(current, target, direction) {
  if (!target || current == null || direction === 'steady') return null
  const left = direction === 'up' ? target - current : current - target
  return { left: Math.round(Math.max(0, left) * 10) / 10, reached: left <= 0 }
}

// good, caution or null (no judgement) for a change in weight.
export function weightTone(change, direction) {
  if (change == null || change === 0) return null
  if (direction === 'steady') return Math.abs(change) <= 1 ? 'good' : null
  const towards = direction === 'up' ? change > 0 : change < 0
  return towards ? 'good' : 'caution'
}

const m2 = (heightCm) => (heightCm / 100) ** 2

export function healthyRange(heightCm) {
  if (!heightCm) return null
  const r = (bmi) => Math.round(bmi * m2(heightCm) * 10) / 10
  return { min: r(UNDERWEIGHT_BMI), max: r(OVERWEIGHT_BMI) }
}

// Checks a chosen goal against the body it is for. `blocks` stop it being saved;
// `notes` are shown beside it. All inputs are optional: nothing known, nothing said.
export function checkGoal({ goal, bmi = null, age = null, target = null, current = null, heightCm = null }) {
  const blocks = [], notes = []

  if (age != null && age < ADULT_AGE) {
    notes.push('Calorie targets are for adults, so they are off. A doctor can help with weight goals at your age.')
  }
  if (goal === 'lose' && bmi != null && bmi < UNDERWEIGHT_BMI) {
    blocks.push(`Losing weight is not offered below BMI ${UNDERWEIGHT_BMI}. Keep or Gain would suit you better.`)
  }
  if (goal === 'lose' && target && heightCm && target / m2(heightCm) < UNDERWEIGHT_BMI) {
    blocks.push(`That target is below the healthy range for your height (BMI ${UNDERWEIGHT_BMI}). Choose a higher one.`)
  }
  if (target && current && target !== current) {
    if (goal === 'gain' && target < current) blocks.push('Your target is below your current weight, but your goal is to gain. Change one of them.')
    if (goal === 'lose' && target > current) blocks.push('Your target is above your current weight, but your goal is to lose. Change one of them.')
  }
  if (goal === 'gain' && bmi != null && bmi >= GAIN_NOTE_BMI) {
    notes.push('Your BMI is above 25, so a slow pace and Build muscle are the better fit.')
  }
  return { blocks, notes }
}

// Weekly averages, newest first. A week with no weigh-in ends the list.
function weeklyAverages(entries, now, weeks) {
  const out = []
  for (let i = 0; i < weeks; i++) {
    const to   = format(subDays(now, i * 7), 'yyyy-MM-dd')
    const from = format(subDays(now, i * 7 + 6), 'yyyy-MM-dd')
    const slice = entries.filter(e => e.date >= from && e.date <= to)
    if (!slice.length) break
    out.push(slice.reduce((s, e) => s + e.weight_kg, 0) / slice.length)
  }
  return out
}

// A calm note when three weeks of weigh-ins point somewhere worth mentioning.
export function weightPaceNote(entries, plan, now = new Date()) {
  if (!plan || plan.goal === 'keep') return null
  const w = weeklyAverages(entries, now, 4)   // newest first
  if (w.length < 4) return null
  const drops = [0, 1, 2].map(i => (w[i + 1] - w[i]) / w[i + 1])
  if (plan.goal === 'lose' && drops.every(d => d > 0.01)) {
    return 'You have lost more than 1% of your weight a week for three weeks. A slower pace is easier to keep up.'
  }
  if (plan.goal === 'gain' && drops.every(d => d > 0.001)) {
    return 'Your weight has been falling for three weeks while your goal is to gain. Check that you are eating to your target, and see a doctor if you cannot explain the loss.'
  }
  return null
}

// The stretches of time spent on one goal, as [{ from, to }] with `to` exclusive.
function periodsOn(history, goal) {
  return history
    .map((e, i) => ({ goal: e.goal, from: e.from, to: history[i + 1]?.from ?? '9999-12-31' }))
    .filter(p => p.goal === goal)
}

// Best kilos gained during time on the Gain goal, measured from the lowest weight
// at or after its start. Weight regained after dieting does not count.
export function kgGainedOnGoal(weightEntries, history) {
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  let best = 0
  for (const p of periodsOn(history, 'gain')) {
    let low = Infinity
    const before = sorted.filter(e => e.date < p.from).pop()
    if (before) low = before.weight_kg
    for (const e of sorted.filter(e => e.date >= p.from && e.date < p.to)) {
      best = Math.max(best, e.weight_kg - low)
      low = Math.min(low, e.weight_kg)
    }
  }
  return Math.round(best * 10) / 10
}

export const STEADY_DAYS = 28
const STEADY_MIN_WEIGH_INS = 8
const STEADY_RANGE_KG = 2      // within 1 kg either side

// Longest span on the Keep goal with weight staying inside the steady range.
export function steadySpanDays(weightEntries, history) {
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  let best = 0
  for (const p of periodsOn(history, 'keep')) {
    const inPeriod = sorted.filter(e => e.date >= p.from && e.date < p.to)
    for (let i = 0; i < inPeriod.length; i++) {
      let low = inPeriod[i].weight_kg, high = low, count = 0
      for (let j = i; j < inPeriod.length; j++) {
        low = Math.min(low, inPeriod[j].weight_kg)
        high = Math.max(high, inPeriod[j].weight_kg)
        if (high - low > STEADY_RANGE_KG) break
        count++
        const span = differenceInCalendarDays(parseISO(inPeriod[j].date), parseISO(inPeriod[i].date)) + 1
        // Too few weigh-ins cannot earn the full span, however long the gap between them
        best = Math.max(best, count >= STEADY_MIN_WEIGH_INS ? span : Math.min(span, STEADY_DAYS - 1))
      }
    }
  }
  return best
}
