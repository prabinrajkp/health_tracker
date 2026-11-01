// Calories burned and net calories, built from what was logged. Every figure here
// is an estimate: it is shown as information and never touches the score.
// See docs/body_goal_net_energy_plan.md §3.
import { calcNutritionTotals } from './scoring'

// METs from the 2024 Adult Compendium of Physical Activities (code in brackets).
export const EXERCISE_METS = {
  Badminton: { normal: 5.5, hard: 7.0 },   // 15030, 15020
  Gym:       { normal: 5.0, hard: 6.0 },   // 02061, 02050
  Cycling:   { normal: 6.8, hard: 8.0 },   // 01020, 01030
  Stairs:    { normal: 6.8, hard: 9.3 },   // 17131, 17134
  Other:     { normal: 5.0, hard: 6.0 },
  Walking:   { normal: 3.8, hard: 4.8 },   // 17190, 17200
}
export const INTENSITIES = ['normal', 'hard']

const BASE_MULTIPLIER = 1.2     // the existing sedentary multiplier: rest, digestion, ordinary moving around
const STEP_ALLOWANCE  = 2500    // steps the base already covers
const STEP_LENGTH     = 0.414   // × height
const WALK_KMH        = 4.8
const WALK_NET_MET    = 2.8     // moderate walking (3.8), less the resting 1 the base already holds

const MAIN_MEALS = ['breakfast', 'lunch', 'dinner']
const MIN_MAIN_MEALS = 2
const MIN_COVERAGE   = 0.7

export const round10 = (n) => Math.round(n / 10) * 10

export function stepKcal(steps, heightCm, kg) {
  const counted = Math.max(0, (steps || 0) - STEP_ALLOWANCE)
  const km = (counted * STEP_LENGTH * heightCm) / 100000
  return (km / WALK_KMH) * WALK_NET_MET * kg
}

const hasSteps = (workout) => (workout?.steps || 0) > 0

// A session's burn, net of the resting energy the base already covers. Walking is
// counted through steps, so it only adds here when the day has no steps at all.
export function exerciseKcal(workout, kg) {
  if (!workout?.exercise_done || !workout.exercise_duration_minutes || !kg) return 0
  const type = workout.exercise_type || 'Other'
  if (type === 'Walking' && hasSteps(workout)) return 0
  const mets = EXERCISE_METS[type] || EXERCISE_METS.Other
  const met  = mets[workout.exercise_intensity] ?? mets.normal
  return (met - 1) * kg * (workout.exercise_duration_minutes / 60)
}

export function walkKcal(workout, kg) {
  if (!workout?.post_dinner_walk || hasSteps(workout) || !kg) return 0
  return WALK_NET_MET * kg * ((workout.post_dinner_walk_minutes || 0) / 60)
}

const hasActivity = (workout) =>
  hasSteps(workout) || !!workout?.exercise_done || !!workout?.post_dinner_walk

/**
 * The day's burn. `fractionOfDay` scales the resting part for a day still under
 * way, so the morning's figure is a burn so far and not a whole day's. A device's
 * active calories, when the user turned that on, replace the steps and exercise
 * estimates rather than adding to them.
 */
export function estimateBurn({ dietetics, workout, fractionOfDay = 1, useDevice = false }) {
  const { bmr, pac, heightCm, weightKg, burnOffset = 0 } = dietetics
  const adjust = burnOffset * fractionOfDay

  if (useDevice && workout?.active_kcal > 0) {
    const resting = bmr * BASE_MULTIPLIER * fractionOfDay
    return { source: 'device', resting, steps: 0, exercise: workout.active_kcal, adjust, total: resting + workout.active_kcal + adjust }
  }
  // Nothing logged is not the same as nothing burned, so fall back on the setting
  if (!hasActivity(workout)) {
    const resting = bmr * pac * fractionOfDay
    return { source: 'activity_level', resting, steps: 0, exercise: 0, adjust, total: resting + adjust }
  }
  const resting  = bmr * BASE_MULTIPLIER * fractionOfDay
  const steps    = stepKcal(workout.steps, heightCm, weightKg)
  const exercise = exerciseKcal(workout, weightKg) + walkKcal(workout, weightKg)
  return { source: 'logs', resting, steps, exercise, adjust, total: resting + steps + exercise + adjust }
}

// Complete enough to compare: two main meals, and most portions carry calorie data.
export function isDayComplete(diet) {
  const items = diet?.meal_items || []
  const meals = MAIN_MEALS.filter(m => items.some(i => i.mealType === m)).length
  return meals >= MIN_MAIN_MEALS && calcNutritionTotals(diet).coverage >= MIN_COVERAGE
}

const minutesIntoDay = (now) => now.getHours() * 60 + now.getMinutes()

// One day's net. Returns null when calorie targets are not set up.
export function computeNet({ diet, workout, dietetics, date, now = new Date(), sick = false, useDevice = false, today }) {
  if (!dietetics) return null
  const open = date != null && date === today
  const fractionOfDay = open ? Math.max(minutesIntoDay(now), 1) / 1440 : 1
  const burn   = estimateBurn({ dietetics, workout, fractionOfDay, useDevice })
  const eaten  = calcNutritionTotals(diet).kcal
  return {
    date,
    eaten,
    burn,
    burned: burn.total,
    net: eaten - burn.total,
    netGoal: dietetics.netGoal,
    goal: dietetics.goal,
    open,
    sick,
    // Whether this day may be compared and averaged at all
    counts: !sick && !open && isDayComplete(diet),
  }
}

const ON_PLAN_KCAL = 150

// Plain words for a net figure against the goal. Never a judgement on one day.
export function describeNet(net, netGoal) {
  const gap = net - netGoal
  if (Math.abs(gap) < ON_PLAN_KCAL) return 'On plan'
  return gap > 0 ? `About ${round10(gap)} above plan` : `About ${round10(-gap)} below plan`
}

export const fmtKcal = (n) => `~${round10(n).toLocaleString()}`
export const fmtNet  = (n) => {
  const r = round10(n)
  return `~${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString()}`
}
export const fmtGoal = (n) => {
  const r = Math.round(n)
  return r === 0 ? '0' : `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString()}`
}

// Averages over the days that count. null until there is something to average.
export function summariseNet(days) {
  const counted = days.filter(d => d?.counts)
  if (!counted.length) return null
  const avg = (key) => counted.reduce((s, d) => s + d[key], 0) / counted.length
  return { days: counted.length, avgNet: avg('net'), avgEaten: avg('eaten'), avgBurned: avg('burned'), netGoal: avg('netGoal') }
}

// Foods the user already eats that could close a calorie gap, most often eaten
// first. Junk food and very small portions are left out.
const MIN_ADD_ON_KCAL = 60
export function suggestAddOns(dietLogs, limit = 3) {
  const seen = new Map()
  for (const d of dietLogs) {
    for (const i of d.meal_items || []) {
      if (i.category === 'bad' || (i.kcalPerPortion || 0) < MIN_ADD_ON_KCAL) continue
      const row = seen.get(i.label) || { label: i.label, kcal: Math.round(i.kcalPerPortion), count: 0 }
      row.count++
      seen.set(i.label, row)
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, limit)
}
