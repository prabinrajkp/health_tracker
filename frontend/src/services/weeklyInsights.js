import { startOfWeek, endOfWeek, format, addWeeks } from 'date-fns'
import { stepTargets, gradeFor } from './scoreMeta'

// ── Week boundary helpers ────────────────────────────────────────────────────
export function getWeekBounds(refDate) {
  const start = startOfWeek(refDate, { weekStartsOn: 1 })
  const end   = endOfWeek(refDate,   { weekStartsOn: 1 })
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
}

export function shiftWeek(refDate, delta) {
  return addWeeks(refDate, delta)
}

// ── Low-level helpers ────────────────────────────────────────────────────────
function safeAvg(arr) {
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
}

function isLateDinner(dietLog) {
  if (!dietLog) return false
  const mt = dietLog.meal_times?.dinner || dietLog.dinner_time
  if (mt && Number(mt.split(':')[0]) >= 21) return true
  return (dietLog.meal_items || [])
    .filter(i => i.mealType === 'dinner' && i.time)
    .some(i => Number(i.time.split(':')[0]) >= 21)
}

function hasBreakfast(dietLog) {
  if (!dietLog) return false
  if (dietLog.breakfast_logged) return true
  return (dietLog.meal_items || []).some(i => i.mealType === 'breakfast')
}

function hasLunch(dietLog) {
  if (!dietLog) return false
  if (dietLog.lunch_logged) return true
  return (dietLog.meal_items || []).some(i => i.mealType === 'lunch')
}

function junkCount(dietLog) {
  if (!dietLog) return 0
  return (dietLog.meal_items || []).filter(i => i.category === 'bad').length
}

function topJunkFoods(dietLogs) {
  const freq = {}
  for (const d of dietLogs) {
    for (const item of (d.meal_items || []).filter(i => i.category === 'bad')) {
      freq[item.label] = (freq[item.label] || 0) + 1
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => ({ label, count }))
}

// ── Strategic fix map ────────────────────────────────────────────────────────
const FIX_MAP = {
  late_dinner:       'Move dinner before 8:45 PM — it removes your most frequent penalty and protects your fasting window',
  poor_sleep:        'Lock your sleep window to 11 PM → 7 AM — a steady seven hours earns the full sleep-duration points',
  no_workout:        'Schedule 30-min activity on your two lowest-score days — even a brisk walk earns full exercise points',
  no_breakfast:      'Log breakfast 5 out of 7 days — it adds diet points and starts the day well',
  poor_steps:        'Take a 15-min post-dinner walk — it adds steps, earns the walk points, and helps your fasting window',
  junk_food:         'Swap one junk food item per day with a logged healthy option — each swap turns lost points into earned ones',
  inconsistent_wake: 'Fix your wake time to ±30 min — a steady wake time does the most for sleep quality and score',
  no_logged_days:    'Log at least 5 days this week — the app can only surface insights from data you give it',
}

// ── Main analysis function ───────────────────────────────────────────────────
export function computeWeeklySummary({
  scores, dietLogs, workoutLogs, sleepLogs,
  prevScores, prevDietLogs, prevWorkoutLogs, prevSleepLogs,
  weights,
}) {
  // Step targets and the late-dinner cost follow the user's scoring settings
  const stepT      = stepTargets(weights)
  const dinnerCost = Math.abs(weights?.penalties?.dinner_after_9pm ?? 5)

  const today = format(new Date(), 'yyyy-MM-dd')
  const pastScores = (scores || []).filter(s => s.date <= today)

  if (pastScores.length === 0) return null

  // Build lookup maps
  const byDate  = key => arr => Object.fromEntries((arr || []).map(r => [r.date, r]))
  const dietMap     = byDate()(dietLogs)
  const workoutMap  = byDate()(workoutLogs)
  const sleepMap    = byDate()(sleepLogs)
  const prevDietMap    = byDate()(prevDietLogs)
  const prevWorkoutMap = byDate()(prevWorkoutLogs)
  const prevSleepMap   = byDate()(prevSleepLogs)

  const dates = pastScores.map(s => s.date)

  // ── Current week metrics ─────────────────────────────────────────────────
  const avgScore   = Math.round(safeAvg(pastScores.map(s => s.total_score)))
  const grade      = gradeFor(avgScore)
  const daysLogged = pastScores.length

  const stepsList       = dates.map(d => workoutMap[d]?.steps || pastScores.find(s => s.date === d)?.steps || 0)
  const sleepHoursList  = dates.map(d => sleepMap[d]?.sleep_hours || 0).filter(h => h > 0)
  const avgSteps        = Math.round(safeAvg(stepsList))
  const avgSleep        = Math.round(safeAvg(sleepHoursList) * 10) / 10
  const totalSteps      = stepsList.reduce((a, b) => a + b, 0)

  const lateDinnerDays   = dates.filter(d => isLateDinner(dietMap[d])).length
  const breakfastDays    = dates.filter(d => hasBreakfast(dietMap[d])).length
  const lunchDays        = dates.filter(d => hasLunch(dietMap[d])).length
  const junkFoodDays     = dates.filter(d => junkCount(dietMap[d]) > 0).length
  const totalJunkItems   = dates.reduce((acc, d) => acc + junkCount(dietMap[d]), 0)
  const workoutSessions  = dates.filter(d => workoutMap[d]?.exercise_done).length
  const walkDays         = dates.filter(d => workoutMap[d]?.post_dinner_walk).length
  const idealDays        = pastScores.filter(s => s.total_score >= 70).length
  const poorSleepDays    = dates.filter(d => {
    const h = sleepMap[d]?.sleep_hours || 0
    return h > 0 && h < 7
  }).length
  const noSleepLogged    = dates.filter(d => !sleepMap[d]?.sleep_time).length
  const lowStepDays      = dates.filter(d => (workoutMap[d]?.steps || 0) < stepT.half).length
  const noBreakfastDays  = daysLogged - breakfastDays
  const topJunk          = topJunkFoods(dietLogs || [])

  // Wake-time consistency (≤1 hr variance = consistent)
  const wakeTimes = dates.map(d => sleepMap[d]?.wake_time).filter(Boolean)
  let wakeConsistent = true
  if (wakeTimes.length >= 3) {
    const mins = wakeTimes.map(t => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]))
    const avg  = safeAvg(mins)
    wakeConsistent = mins.every(m => Math.abs(m - avg) <= 60)
  }

  // Best / worst day
  const sortedScores = [...pastScores].sort((a, b) => b.total_score - a.total_score)
  const bestDay  = sortedScores[0]  || null
  const worstDay = sortedScores[sortedScores.length - 1] || null

  // ── Previous week metrics ────────────────────────────────────────────────
  const prevPast          = (prevScores || []).filter(s => s.date <= today)
  const prevDates         = prevPast.map(s => s.date)
  const prevAvgScore      = Math.round(safeAvg(prevPast.map(s => s.total_score)))
  const trend             = prevPast.length > 0 ? avgScore - prevAvgScore : null
  const prevAvgSteps      = Math.round(safeAvg(prevDates.map(d => prevWorkoutMap[d]?.steps || prevPast.find(s => s.date === d)?.steps || 0)))
  const prevSessions      = prevDates.filter(d => prevWorkoutMap[d]?.exercise_done).length
  const prevLateDinners   = prevDates.filter(d => isLateDinner(prevDietMap[d])).length
  const prevBreakfastDays = prevDates.filter(d => hasBreakfast(prevDietMap[d])).length
  const prevAvgSleep      = Math.round(safeAvg(prevDates.map(d => prevSleepMap[d]?.sleep_hours || 0).filter(h => h > 0)) * 10) / 10

  // ── Wins ─────────────────────────────────────────────────────────────────
  const wins = []

  if (breakfastDays >= 5)
    wins.push({ text: `Breakfast logged ${breakfastDays}/${daysLogged} days`, detail: 'Consistent morning nutrition' })
  else if (prevBreakfastDays < breakfastDays && breakfastDays >= 3)
    wins.push({ text: `Breakfast improved: ${breakfastDays} days (was ${prevBreakfastDays})`, detail: 'Upward trend' })

  if (workoutSessions >= 3)
    wins.push({ text: `${workoutSessions} workout session${workoutSessions !== 1 ? 's' : ''} completed`, detail: workoutSessions > prevSessions ? `Up from ${prevSessions} last week` : 'Strong active week' })
  else if (workoutSessions > prevSessions && workoutSessions > 0)
    wins.push({ text: `Workout sessions up: ${workoutSessions} vs ${prevSessions} last week`, detail: 'Positive momentum' })

  if (avgSteps >= stepT.full)
    wins.push({ text: `Avg ${avgSteps.toLocaleString()} steps/day`, detail: 'Consistently at or above step goal' })
  else if (avgSteps > prevAvgSteps + 500 && avgSteps > 0)
    wins.push({ text: `Steps up +${(avgSteps - prevAvgSteps).toLocaleString()} vs last week`, detail: `Averaging ${avgSteps.toLocaleString()} steps` })

  if (avgSleep >= 7)
    wins.push({ text: `Avg sleep ${avgSleep}h — on target`, detail: '7+ hours consistently maintained' })
  else if (prevAvgSleep > 0 && avgSleep > prevAvgSleep + 0.3)
    wins.push({ text: `Sleep improved by +${(avgSleep - prevAvgSleep).toFixed(1)}h avg`, detail: `Now averaging ${avgSleep}h` })

  if (lateDinnerDays === 0 && daysLogged >= 3)
    wins.push({ text: 'Zero late dinners all week', detail: 'No late-dinner cost, and your fasting window stayed intact' })
  else if (prevLateDinners >= 3 && lateDinnerDays < prevLateDinners)
    wins.push({ text: `Late dinners down: ${lateDinnerDays} (was ${prevLateDinners} last week)`, detail: 'Dinner timing improving' })

  if (junkFoodDays === 0 && daysLogged >= 3)
    wins.push({ text: 'No junk food logged all week', detail: 'Clean diet — no negative-point foods' })

  if (walkDays >= 3)
    wins.push({ text: `Post-dinner walk on ${walkDays} days`, detail: 'Steps + walk bonus stacking well' })

  if (idealDays >= 5)
    wins.push({ text: `${idealDays} ideal days (score ≥70)`, detail: 'Dominant performance week' })

  if (trend !== null && trend >= 5)
    wins.push({ text: `Weekly score up ${trend} pts vs last week`, detail: `${prevAvgScore} → ${avgScore}` })

  // ── Damage ───────────────────────────────────────────────────────────────
  const damage = []

  if (lateDinnerDays >= 3)
    damage.push({ key: 'late_dinner', text: `${lateDinnerDays} late dinners (after 9 PM)`, detail: dinnerCost ? `Each one cost ${dinnerCost} pts` : 'Each one shortens your fasting window' })

  if (poorSleepDays >= 3)
    damage.push({ key: 'poor_sleep', text: `Sleep <7h on ${poorSleepDays} days`, detail: 'Short nights miss the sleep-duration points' })

  if (junkFoodDays >= 3)
    damage.push({ key: 'junk_food', text: `Junk food on ${junkFoodDays} days (${totalJunkItems} items total)`,
      detail: topJunk.length ? `Most often: ${topJunk[0].label} (×${topJunk[0].count})` : 'These foods take points off your diet score' })

  if (noBreakfastDays >= 3)
    damage.push({ key: 'no_breakfast', text: `Breakfast missed ${noBreakfastDays} days`, detail: 'Breakfast points left unclaimed' })

  if (lowStepDays >= 3)
    damage.push({ key: 'poor_steps', text: `Steps below ${stepT.half.toLocaleString()} on ${lowStepDays} days`, detail: 'Too few for any step points' })

  if (workoutSessions === 0 && daysLogged >= 4)
    damage.push({ key: 'no_workout', text: 'No workout sessions this week', detail: 'Exercise points left unclaimed' })

  if (!wakeConsistent && wakeTimes.length >= 3)
    damage.push({ key: 'inconsistent_wake', text: 'Inconsistent wake times (>1h variance)', detail: 'A steadier wake time helps sleep quality and score' })

  // ── Root cause detection ─────────────────────────────────────────────────
  // For each bad day (score <60), record which failure events were present
  const badDays = pastScores.filter(s => s.total_score < 60)
  const causeFreq = {}
  const bumpCause = key => { causeFreq[key] = (causeFreq[key] || 0) + 1 }

  for (const s of badDays) {
    const d = s.date
    if (isLateDinner(dietMap[d]))                                       bumpCause('late_dinner')
    if (!workoutMap[d]?.exercise_done)                                  bumpCause('no_workout')
    const sh = sleepMap[d]?.sleep_hours || 0
    if (sh > 0 && sh < 7)                                               bumpCause('poor_sleep')
    if (!hasBreakfast(dietMap[d]))                                      bumpCause('no_breakfast')
    if ((workoutMap[d]?.steps || 0) < stepT.half)                             bumpCause('poor_steps')
    if (junkCount(dietMap[d]) > 0)                                      bumpCause('junk_food')
  }
  // Also weight aggregate damage keys
  for (const { key } of damage) bumpCause(key)

  const topCause = Object.entries(causeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const strategicFix = FIX_MAP[topCause] || (
    damage.length > 0 ? FIX_MAP[damage[0].key] : 'Keep doing what you are doing — this was a strong week'
  )

  // ── Stacked failure detection ────────────────────────────────────────────
  const stackedFailures = []
  for (const d of dates) {
    const late = isLateDinner(dietMap[d])
    const sh   = sleepMap[d]?.sleep_hours || 0
    const poorSleep = sh > 0 && sh < 7
    if (late && poorSleep)
      stackedFailures.push({ date: d, label: 'Late dinner and short sleep' })
  }

  return {
    avgScore, grade, trend, prevAvgScore, daysLogged,
    wins, damage, strategicFix,
    bestDay, worstDay, stackedFailures, topJunk,
    metrics: {
      avgSteps, avgSleep, totalSteps, workoutSessions, walkDays,
      lateDinnerDays, junkFoodDays, totalJunkItems,
      breakfastDays, lunchDays, idealDays, poorSleepDays, lowStepDays,
    },
  }
}
