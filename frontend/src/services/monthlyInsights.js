import { format, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns'
import { gradeFor } from './scoreMeta'

const IDENTITIES = [
  { key: 'momentum_elite',     label: 'Momentum Elite',     emoji: '👑', color: '#f59e0b',
    grad: 'linear-gradient(135deg,#92400e,#78350f,#451a03)',
    check: d => d.avgScore >= 75 && d.trend !== null && d.trend >= 5 },
  { key: 'peak_performer',     label: 'Peak Performer',     emoji: '✨', color: '#a78bfa',
    grad: 'linear-gradient(135deg,#4c1d95,#5b21b6,#2e1065)',
    check: d => d.avgScore >= 78 && d.daysLogged >= 18 },
  { key: 'rising_force',       label: 'Rising Force',       emoji: '🚀', color: '#38bdf8',
    grad: 'linear-gradient(135deg,#0c4a6e,#075985,#0369a1)',
    check: d => d.trend !== null && d.trend >= 8 },
  { key: 'discipline_builder', label: 'Discipline Builder', emoji: '🎯', color: '#22c55e',
    grad: 'linear-gradient(135deg,#14532d,#15803d,#166534)',
    check: d => d.daysLogged >= 22 },
  { key: 'recovery_master',    label: 'Recovery Master',    emoji: '🌙', color: '#818cf8',
    grad: 'linear-gradient(135deg,#312e81,#4338ca,#1e1b4b)',
    check: d => d.avgSleep >= 7.5 },
  { key: 'comeback_mode',      label: 'Comeback Mode',      emoji: '🦅', color: '#fb923c',
    grad: 'linear-gradient(135deg,#7c2d12,#9a3412,#431407)',
    check: d => d.trend !== null && d.trend <= -8 },
  { key: 'energy_stabilizer',  label: 'Energy Stabilizer',  emoji: '⚡', color: '#22d3ee',
    grad: 'linear-gradient(135deg,#164e63,#0e7490,#083344)',
    check: d => d.avgScore >= 58 && d.avgScore < 76 },
  { key: 'foundation_builder', label: 'Foundation Builder', emoji: '📋', color: '#94a3b8',
    grad: 'linear-gradient(135deg,#1e293b,#334155,#0f172a)',
    check: () => true },
]

function buildNarrative({ avgScore, trend, daysLogged, monthName, avgSleep, workoutSessions, junkFoodDays, lateDinnerDays }) {
  const parts = []
  if (trend !== null && trend > 5)
    parts.push(`Strong growth in ${monthName} — avg score up ${trend} pts vs last month.`)
  else if (trend !== null && trend < -5)
    parts.push(`${monthName} was challenging, with avg score down ${Math.abs(trend)} pts.`)
  else
    parts.push(`You stayed consistent in ${monthName} across ${daysLogged} logged days.`)

  if (avgSleep >= 7.2 && workoutSessions >= 4)
    parts.push('Sleep quality and workout consistency were your twin pillars.')
  else if (avgSleep >= 7.2)
    parts.push('Sleep quality was your biggest advantage this month.')
  else if (workoutSessions >= 4)
    parts.push(`${workoutSessions} workout sessions powered your activity score.`)
  else if (lateDinnerDays === 0 && daysLogged >= 10)
    parts.push('Zero late dinners protected your fasting window all month.')

  if (junkFoodDays >= 8)
    parts.push(`Junk food on ${junkFoodDays} days was the main score drag.`)
  else if (lateDinnerDays >= 8)
    parts.push(`Late dinners on ${lateDinnerDays} days pulled diet score down.`)

  return parts.slice(0, 2).join(' ')
}

function buildStoryArc({ pastScores, workoutMap, sleepMap, year, month }) {
  const monthStart   = new Date(year, month - 1, 1)
  const monthEnd     = new Date(year, month, 0)
  const today        = new Date()
  const effectiveEnd = monthEnd < today ? monthEnd : today
  const weekStarts   = eachWeekOfInterval({ start: monthStart, end: effectiveEnd }, { weekStartsOn: 1 })

  return weekStarts.map((ws, i) => {
    const we     = endOfWeek(ws, { weekStartsOn: 1 })
    const wsStr  = format(ws < monthStart ? monthStart : ws, 'yyyy-MM-dd')
    const weStr  = format(we > effectiveEnd ? effectiveEnd : we, 'yyyy-MM-dd')
    const wScores = pastScores.filter(s => s.date >= wsStr && s.date <= weStr)
    if (wScores.length === 0) return null

    const avg = Math.round(wScores.reduce((a, s) => a + s.total_score, 0) / wScores.length)
    const wDates = wScores.map(s => s.date)
    const workouts = wDates.filter(d => workoutMap[d]?.exercise_done).length
    const shours   = wDates.map(d => sleepMap[d]?.sleep_hours || 0).filter(h => h > 0)
    const avgSleepH = shours.length ? Math.round(shours.reduce((a, b) => a + b, 0) / shours.length * 10) / 10 : 0

    const [theme, emoji] =
      avg >= 80 ? ['Peak Performance', '🔥'] :
      avg >= 70 ? ['Strong Week', '💪'] :
      workouts >= 3 ? ['Active Week', '⚡'] :
      avgSleepH >= 7.5 ? ['Recovery Focus', '🌙'] :
      avg >= 55 ? ['Steady Progress', '📈'] :
      ['Building Phase', '🛠️']

    const note = workouts >= 3 ? `${workouts} workouts · ${wScores.length}d`
      : avgSleepH >= 7 ? `${avgSleepH}h avg sleep · ${wScores.length}d`
      : `${wScores.length} days logged`

    return { week: i + 1, wsStr, weStr, avg, theme, emoji, note, days: wScores.length }
  }).filter(Boolean)
}

function buildTrajectory({ pastScores, prevAvgScore }) {
  if (pastScores.length < 8) return null
  const sorted    = [...pastScores].sort((a, b) => a.date.localeCompare(b.date))
  const mid       = Math.floor(sorted.length / 2)
  const firstAvg  = Math.round(sorted.slice(0, mid).reduce((a, s) => a + s.total_score, 0) / mid)
  const secondAvg = Math.round(sorted.slice(mid).reduce((a, s) => a + s.total_score, 0) / (sorted.length - mid))
  const halfTrend = secondAvg - firstAvg
  const currentAvg = Math.round(sorted.reduce((a, s) => a + s.total_score, 0) / sorted.length)
  const projected  = Math.min(100, Math.max(0, Math.round(currentAvg + halfTrend * 0.65)))
  return { currentAvg, firstAvg, secondAvg, halfTrend, projected, prevAvgScore }
}

export function computeMonthlyInsights({ scores, prevScores, dietLogs, workoutLogs, sleepLogs, year, month }) {
  const today      = format(new Date(), 'yyyy-MM-dd')
  const pastScores = scores.filter(s => s.date <= today)
  if (pastScores.length === 0) return null

  const dietMap    = Object.fromEntries(dietLogs.map(d => [d.date, d]))
  const workoutMap = Object.fromEntries(workoutLogs.map(d => [d.date, d]))
  const sleepMap   = Object.fromEntries(sleepLogs.map(d => [d.date, d]))

  const dates      = pastScores.map(s => s.date)
  const daysLogged = dates.length
  const monthName  = format(new Date(year, month - 1, 1), 'MMMM')

  const avgScore     = Math.round(pastScores.reduce((a, s) => a + s.total_score, 0) / daysLogged)
  const prevAvgScore = prevScores?.length ? Math.round(prevScores.reduce((a, s) => a + s.total_score, 0) / prevScores.length) : null
  const trend        = prevAvgScore !== null ? avgScore - prevAvgScore : null

  const avgSteps    = Math.round(dates.reduce((a, d) => a + (workoutMap[d]?.steps || 0), 0) / daysLogged)
  const sleepHours  = dates.map(d => sleepMap[d]?.sleep_hours || 0).filter(h => h > 0)
  const avgSleep    = sleepHours.length ? Math.round(sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length * 10) / 10 : 0
  const workoutSessions = dates.filter(d => workoutMap[d]?.exercise_done).length
  const lateDinnerDays  = dates.filter(d => {
    const diet = dietMap[d]; if (!diet) return false
    const mt = diet.meal_times?.dinner || diet.dinner_time
    if (mt && Number(mt.split(':')[0]) >= 21) return true
    return (diet.meal_items || []).filter(i => i.mealType === 'dinner' && i.time).some(i => Number(i.time.split(':')[0]) >= 21)
  }).length
  const junkFoodDays  = dates.filter(d => (dietMap[d]?.meal_items || []).some(i => i.category === 'bad')).length
  const breakfastDays = dates.filter(d => (dietMap[d]?.meal_items || []).some(i => i.mealType === 'breakfast')).length

  const grade    = gradeFor(avgScore)
  const identityData = { avgScore, trend, avgSleep, workoutSessions, daysLogged }
  const identity = IDENTITIES.find(id => id.check(identityData)) || IDENTITIES[IDENTITIES.length - 1]
  const narrative = buildNarrative({ avgScore, trend, daysLogged, monthName, avgSleep, workoutSessions, junkFoodDays, lateDinnerDays })
  const storyArc  = buildStoryArc({ pastScores, workoutMap, sleepMap, year, month })
  const trajectory = buildTrajectory({ pastScores, prevAvgScore })

  const positives = []
  if (workoutSessions >= 4) positives.push({ icon: '💪', text: `${workoutSessions} workout sessions`, sub: 'Exercise bonus stacked consistently' })
  if (avgSleep >= 7.2) positives.push({ icon: '🌙', text: `${avgSleep}h avg sleep`, sub: 'Recovery scores above baseline' })
  if (lateDinnerDays === 0 && daysLogged >= 10) positives.push({ icon: '🍽️', text: 'Zero late dinners', sub: 'Full fasting window protected' })
  if (breakfastDays >= daysLogged * 0.8 && daysLogged >= 8) positives.push({ icon: '🌅', text: `Breakfast ${breakfastDays}/${daysLogged} days`, sub: 'Morning consistency is strong' })
  if (trend !== null && trend >= 5) positives.push({ icon: '📈', text: `+${trend} pts vs last month`, sub: 'Clear upward momentum' })

  const risks = []
  if (junkFoodDays >= 8) risks.push({ icon: '🚨', text: `Junk food ${junkFoodDays} days`, sub: 'The biggest cost to your diet score' })
  if (lateDinnerDays >= 6) risks.push({ icon: '⚠️', text: `${lateDinnerDays} late dinners`, sub: 'Each one costs points and shortens the fasting window' })
  if (avgSleep < 6.5 && sleepHours.length >= 5) risks.push({ icon: '😴', text: `Avg sleep ${avgSleep}h`, sub: '7+ hours earns the full sleep-duration points' })
  if (workoutSessions === 0 && daysLogged >= 10) risks.push({ icon: '🏃', text: 'No workout sessions', sub: 'Exercise points left unclaimed' })

  const nearMiss = []
  if (grade.letter !== 'S' && grade.letter !== 'A') {
    const targets = { F: 40, D: 60, C: 70, B: 80 }
    const target = targets[grade.letter]
    const gap = target - avgScore
    if (gap > 0 && gap <= 10) nearMiss.push(`${gap} more avg pts → ${grade.letter === 'D' ? 'C' : grade.letter === 'C' ? 'B' : 'A'}-tier month`)
  }
  if (workoutSessions < 4 && workoutSessions > 0) nearMiss.push(`${4 - workoutSessions} more workout${4 - workoutSessions > 1 ? 's' : ''} → Cardio Ignition badge`)

  const bestDate = pastScores.reduce((best, s) => s.total_score > (best?.total_score || 0) ? s : best, null)?.date

  return {
    avgScore, grade, trend, prevAvgScore, daysLogged,
    identity, narrative, storyArc, trajectory,
    positives: positives.slice(0, 3), risks: risks.slice(0, 3), nearMiss: nearMiss.slice(0, 2),
    stats: { avgSteps, avgSleep, workoutSessions, lateDinnerDays, junkFoodDays, breakfastDays },
    workoutMap, sleepMap, bestDate,
  }
}
