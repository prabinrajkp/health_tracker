// The facts the notification rules work from. deriveFacts is pure so it can be tested
// at any hour; buildFacts does the reading. Nothing here touches the network.
import { format, subDays, parseISO, startOfMonth, endOfMonth, isLastDayOfMonth, subMonths, getDay } from 'date-fns'
import db from './db'
import { weightsFromConfig, stepTargets } from './scoreMeta'
import { planOn } from './bodyGoal'
import { mealTimeOf } from './fasting'
import { toMinutes } from './nudgeTime'
import { computeWeeklySummary, getWeekBounds } from './weeklyInsights'
import { findPatterns } from './nudgePatterns'
import { currentIfThen } from './ifThen'
import { computeQuests } from './questEngine'
import { getThisWeekBadgeStates } from './badgeEngine'
import { getSleepTimerStart } from './sleepTimer'
import { getStreak, getWaterDay, getWaterGoal } from './localStore'
import { waterTotals } from './hydration'

export const DEFAULT_TIMES = { bed: '23:00', wake: '06:30', dinner: '20:00', lunch: '12:30', eveningLog: '22:00' }
const HISTORY_DAYS = 35
const USUAL_WINDOW = 14
const MIN_USUAL_DAYS = 4

// Bedtimes run past midnight, so times in the small hours count as after 24:00.
const asNight = (min) => (min != null && min < 12 * 60 ? min + 1440 : min)

function median(list) {
  if (!list.length) return null
  const s = [...list].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const hasMeal = (diet, type) => (diet?.meal_items || []).some(i => i.mealType === type)
const dinnerOf = (diet) => toMinutes(mealTimeOf(diet, 'dinner'))

const round1 = (n) => Math.round(n)
const avgOf  = (rows, key) => (rows.length ? rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length : 0)

function weekWrap(raw, now, weights) {
  const { start, end } = getWeekBounds(now)
  const { start: ps, end: pe } = getWeekBounds(subDays(parseISO(start), 1))
  const within = (rows, a, b) => rows.filter(r => r.date >= a && r.date <= b)
  const summary = computeWeeklySummary({
    scores: within(raw.scores, start, end), dietLogs: within(raw.diets, start, end),
    workoutLogs: within(raw.workouts, start, end), sleepLogs: within(raw.sleeps, start, end),
    prevScores: within(raw.scores, ps, pe), prevDietLogs: within(raw.diets, ps, pe),
    prevWorkoutLogs: within(raw.workouts, ps, pe), prevSleepLogs: within(raw.sleeps, ps, pe),
    weights,
  })
  return summary
}

/**
 * raw: { config, diets, workouts, sleeps, scores, sick, streak, timerStart, quests,
 *        nearBadges, waterMl, waterGoalMl }, each list covering recent days.
 */
export function deriveFacts(raw, now = new Date()) {
  const config  = raw.config || {}
  const today   = format(now, 'yyyy-MM-dd')
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
  const dayBefore = format(subDays(now, 2), 'yyyy-MM-dd')
  const weights = weightsFromConfig(config)
  const steps   = stepTargets(weights)
  const plan    = planOn(config, today)
  const sick    = new Set((raw.sick || []).map(s => s.date))

  const by = (rows) => Object.fromEntries((rows || []).map(r => [r.date, r]))
  const dietBy = by(raw.diets), workoutBy = by(raw.workouts), sleepBy = by(raw.sleeps), scoreBy = by(raw.scores)

  const last = (n) => Array.from({ length: n }, (_, i) => format(subDays(now, i + 1), 'yyyy-MM-dd')).filter(d => !sick.has(d))

  // The user's own times: Settings first, the last two weeks of logs as the habit
  const usualDays = last(USUAL_WINDOW)
  const dinners = usualDays.map(d => dinnerOf(dietBy[d])).filter(v => v != null)
  const beds    = usualDays.map(d => asNight(toMinutes(sleepBy[d]?.sleep_time))).filter(v => v != null)
  const wakes   = usualDays.map(d => toMinutes(sleepBy[d]?.wake_time)).filter(v => v != null)
  const usual = {
    dinner: dinners.length >= MIN_USUAL_DAYS ? median(dinners) : null,
    bed:    beds.length    >= MIN_USUAL_DAYS ? median(beds)    : null,
    wake:   wakes.length   >= MIN_USUAL_DAYS ? median(wakes)   : null,
  }
  const pick = (key, fallback, learned) => toMinutes(config[key]) ?? learned ?? toMinutes(fallback)
  const wake = pick('wake_time', DEFAULT_TIMES.wake, usual.wake)
  const times = {
    wake,
    bed:        asNight(pick('bed_time', DEFAULT_TIMES.bed, usual.bed)),
    dinner:     toMinutes(config.dinner_reminder_time) ?? toMinutes(DEFAULT_TIMES.dinner),
    lunch:      toMinutes(config.lunch_reminder_time)  ?? toMinutes(DEFAULT_TIMES.lunch),
    eveningLog: toMinutes(config.evening_log_time)     ?? toMinutes(DEFAULT_TIMES.eveningLog),
  }

  const dietToday = dietBy[today], workoutToday = workoutBy[today]
  const anyMealToday = (dietToday?.meal_items || []).length > 0

  const recent5 = last(5).filter(d => scoreBy[d])
  const breakfastMissed = recent5.filter(d => !hasMeal(dietBy[d], 'breakfast') && !dietBy[d]?.breakfast_logged).length
  const week = last(7)
  const lateDinners = week.filter(d => (dinnerOf(dietBy[d]) ?? 0) >= 21 * 60).length
  const stepDays = week.map(d => workoutBy[d]?.steps || 0).filter(v => v > 0)

  // Yesterday against the day before, for noticed progress and the morning review
  const a = scoreBy[yesterday], b = scoreBy[dayBefore]
  const diff = a && b ? {
    total:   round1((a.total_score || 0) - (b.total_score || 0)),
    diet:    round1((a.diet_score || 0) - (b.diet_score || 0)),
    workout: round1((a.workout_score || 0) - (b.workout_score || 0)),
    sleep:   round1((a.sleep_score || 0) - (b.sleep_score || 0)),
    score:   round1(a.total_score || 0),
  } : null

  // The week before the coming Monday: last week on a Monday, otherwise this one
  const lastWeek = weekWrap(raw, getDay(now) === 1 ? subDays(now, 1) : now, weights)
  const thisWeek = weekWrap(raw, now, weights)

  // This month against the last, for the month-end wrap
  const mStart = format(startOfMonth(now), 'yyyy-MM-dd'), mEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const prev = subMonths(now, 1)
  const pStart = format(startOfMonth(prev), 'yyyy-MM-dd'), pEnd = format(endOfMonth(prev), 'yyyy-MM-dd')
  const monthRows = (raw.scores || []).filter(s => s.date >= mStart && s.date <= mEnd)
  const prevRows  = (raw.scores || []).filter(s => s.date >= pStart && s.date <= pEnd)

  const patternDays = Array.from({ length: 28 }, (_, i) => format(subDays(now, 28 - i), 'yyyy-MM-dd')).map(date => {
    const diet = dietBy[date], sl = sleepBy[date], score = scoreBy[date], w = workoutBy[date]
    return {
      date, sick: sick.has(date),
      dinnerMin: dinnerOf(diet),
      bedMin: asNight(toMinutes(sl?.sleep_time)),
      breakfast: hasMeal(diet, 'breakfast'),
      walk: !!w?.post_dinner_walk,
      steps: w?.steps || 0,
      dietScore: score ? score.diet_score : null,
      sleepScore: score && sl?.sleep_time ? score.sleep_score : null,
      screenHours: sl?.screen_time_hours || 0,
      sleepHours: sl?.sleep_hours || 0,
    }
  })

  const weeklyQuest = (raw.quests?.weekly || [])
    .filter(q => !q.complete && q.progress >= 0.6)
    .sort((x, y) => y.progress - x.progress)[0] || null
  const badge = (raw.nearBadges || []).find(n => n.progress >= 0.8) || null

  return {
    now, today, dow: getDay(now),
    isLastDayOfMonth: isLastDayOfMonth(now),
    mode: ['quiet', 'standard', 'coach'].includes(config.notification_mode) ? config.notification_mode : 'standard',
    anchorsOn: config.reminders_on === 'true',
    plan, times, usual,
    penaltyDinner: Math.abs(weights.penalties?.dinner_after_9pm ?? 0),
    stepTarget: steps.full,
    points: { steps: weights.workout?.steps_8000 ?? 0, walk: weights.workout?.post_dinner_walk ?? 0, exercise: weights.workout?.exercise_session ?? 0 },
    logged: {
      dinner: hasMeal(dietToday, 'dinner') || !!dietToday?.meal_times?.dinner || !!dietToday?.dinner_time,
      dinnerMin: dinnerOf(dietToday),
      breakfast: hasMeal(dietToday, 'breakfast') || !!dietToday?.breakfast_logged,
      lunch: hasMeal(dietToday, 'lunch') || !!dietToday?.lunch_logged,
      anyMeal: anyMealToday,
      walk: !!workoutToday?.post_dinner_walk,
      exercise: !!workoutToday?.exercise_done,
      steps: workoutToday?.steps || 0,
    },
    timerRunning: !!raw.timerStart,
    sickToday: sick.has(today),
    sickYesterday: sick.has(yesterday),
    streak: raw.streak || 0,
    breakfastMissed, breakfastDays: recent5.length,
    lateDinners,
    avgSteps7: stepDays.length ? Math.round(stepDays.reduce((s, v) => s + v, 0) / stepDays.length) : 0,
    diff,
    lastWeekCost: lastWeek?.damage?.[0]?.text || null,
    weekWrap: thisWeek && thisWeek.daysLogged >= 4 ? {
      avg: thisWeek.avgScore, change: thisWeek.trend, days: thisWeek.daysLogged, cost: thisWeek.damage?.[0]?.text || null,
    } : null,
    monthWrap: monthRows.length >= 10 ? {
      avg: Math.round(avgOf(monthRows, 'total_score')), days: monthRows.length,
      change: prevRows.length >= 10 ? Math.round(avgOf(monthRows, 'total_score') - avgOf(prevRows, 'total_score')) : null,
    } : null,
    patterns: findPatterns(patternDays),
    quest: weeklyQuest, badge,
    ifThen: currentIfThen(config, now),
    drinks: { ml: raw.waterMl || 0, goalMl: raw.waterGoalMl || 0 },
  }
}

export async function buildFacts(now = new Date()) {
  const start = format(subDays(now, HISTORY_DAYS + 31), 'yyyy-MM-dd')
  const today = format(now, 'yyyy-MM-dd')
  const between = (table) => db[table].where('date').between(start, today, true, true).toArray()
  const [configRows, diets, workouts, sleeps, scores, sick, streak, quests, badgeStates, waterDay, waterGoal] = await Promise.all([
    db.tracker_config.toArray(), between('diet_logs'), between('workout_logs'), between('sleep_logs'), between('daily_scores'),
    db.sick_days.toArray(), getStreak().catch(() => ({ streak: 0 })), computeQuests().catch(() => null),
    getThisWeekBadgeStates().catch(() => ({ nearUnlock: [] })), getWaterDay(today).catch(() => null), getWaterGoal().catch(() => null),
  ])
  const config = {}
  configRows.forEach(r => { config[r.key] = r.value })
  const dietToday = diets.find(d => d.date === today)
  const totals = waterTotals(waterDay?.entries || [], dietToday)
  return deriveFacts({
    config, diets, workouts, sleeps, scores, sick, streak: streak.streak,
    timerStart: getSleepTimerStart(), quests, nearBadges: badgeStates.nearUnlock,
    waterMl: totals.totalMl, waterGoalMl: waterGoal?.targetMl || 0,
  }, now)
}
