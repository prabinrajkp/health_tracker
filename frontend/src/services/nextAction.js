import { calcWorkoutScore } from './scoring'
import { DEFAULT_WEIGHTS } from './db'
import { stepTargets } from './scoreMeta'

// Decides the single thing Today tells the user to do next, plus any penalties
// already applied. Pure: pass `now` in so it can be tested at any hour.
//
// Each action carries a `target` the screen can act on:
//   { type: 'meal', category }   → open Add Meal on that category
//   { type: 'log',  tab }        → open the Log tab on that section

const round1 = (n) => Math.round(n * 10) / 10

function hasMeal(diet, type) {
  return !!(diet?.meal_items || []).some(i => i.mealType === type)
}

export function activePenalties({ diet, sleep, weights = DEFAULT_WEIGHTS }) {
  const p = weights.penalties || {}
  const out = []
  const dinnerTime = diet?.meal_times?.dinner || diet?.dinner_time
  if (dinnerTime && Number(dinnerTime.split(':')[0]) >= 21 && p.dinner_after_9pm) {
    out.push({ section: 'diet', label: 'Dinner after 9 PM', amount: Math.abs(p.dinner_after_9pm) })
  }
  if (sleep?.sleep_time && Number(sleep.sleep_time.split(':')[0]) <= 5 && p.sleep_after_midnight) {
    out.push({ section: 'sleep', label: 'Sleep after midnight', amount: Math.abs(p.sleep_after_midnight) })
  }
  return out
}

function stepAction(workout, weights) {
  const steps = workout?.steps || 0
  const t = stepTargets(weights)
  const goal = steps < t.half ? t.half : steps < t.full ? t.full : steps < t.bonusStart ? t.bonusStart : null
  if (!goal) return null
  const gain = round1(calcWorkoutScore({ ...workout, steps: goal }, weights) - calcWorkoutScore({ ...workout, steps }, weights))
  if (gain <= 0) return null
  return {
    key: 'steps', emoji: '👟',
    label: `${(goal - steps).toLocaleString()} more steps`,
    impact: gain,
    target: { type: 'log', tab: 'move' },
  }
}

export function computeNextAction({ diet, workout, sleep, weights = DEFAULT_WEIGHTS, now = new Date() }) {
  const mins = now.getHours() * 60 + now.getMinutes()
  const w = weights.workout || {}
  const candidates = []

  // Last night's sleep is the first thing worth logging in the morning.
  if (!sleep?.sleep_time && mins < 12 * 60) {
    candidates.push({
      key: 'sleep', emoji: '🌙', label: "Log last night's sleep",
      impact: weights.sleep_max || 30, upTo: true, urgent: true,
      target: { type: 'log', tab: 'sleep' },
    })
  }

  // The meal whose window we are in.
  const mealWindow = mins < 11 * 60 ? 'breakfast' : mins < 15 * 60 + 30 ? 'lunch' : mins >= 18 * 60 ? 'dinner' : null
  if (mealWindow && !hasMeal(diet, mealWindow)) {
    candidates.push({
      key: mealWindow, emoji: mealWindow === 'breakfast' ? '🌅' : mealWindow === 'lunch' ? '☀️' : '🍽️',
      label: `Log ${mealWindow}`,
      note: mealWindow === 'dinner' ? 'Before 9 PM avoids the late-dinner penalty' : null,
      impact: null, urgent: true,
      target: { type: 'meal', category: mealWindow },
    })
  }

  const steps = stepAction(workout, weights)
  if (steps) candidates.push(steps)

  if (!workout?.exercise_done && w.exercise_session) {
    candidates.push({
      key: 'exercise', emoji: '💪', label: 'Log an exercise session',
      impact: w.exercise_session, target: { type: 'log', tab: 'move' },
    })
  }

  // Only suggested once dinner is in, or late enough that it plausibly is.
  if (!workout?.post_dinner_walk && w.post_dinner_walk && (hasMeal(diet, 'dinner') || mins >= 20 * 60)) {
    candidates.push({
      key: 'walk', emoji: '🚶', label: 'Take a post-dinner walk',
      impact: w.post_dinner_walk, urgent: hasMeal(diet, 'dinner'),
      target: { type: 'log', tab: 'move' },
    })
  }

  // Earlier meals that were skipped stay available, but never outrank the above.
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    if (meal !== mealWindow && !hasMeal(diet, meal) && (meal !== 'dinner' || mins >= 18 * 60)) {
      candidates.push({
        key: meal, emoji: '🍽️', label: `Log ${meal}`, impact: null, late: true,
        target: { type: 'meal', category: meal },
      })
    }
  }

  if (!sleep?.sleep_time && mins >= 22 * 60) {
    candidates.push({
      key: 'sleep_timer', emoji: '🌙', label: 'Start your sleep timer',
      note: 'Before 11:30 PM earns full bedtime points', impact: null, urgent: true,
      target: { type: 'log', tab: 'sleep' },
    })
  }

  const rank = (c) => (c.urgent ? 2 : c.late ? 0 : 1)
  candidates.sort((a, b) => rank(b) - rank(a) || (b.impact || 0) - (a.impact || 0))

  return {
    next: candidates[0] || null,
    penalties: activePenalties({ diet, sleep, weights }),
  }
}
