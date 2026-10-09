/**
 * Trend-aware notification engine
 *
 * Notification IDs 40–55 (separate from smart-nudge IDs 30–39)
 *
 * What fires and when
 * ───────────────────
 * ID 40  After-dinner review (9:30 PM)   — today's score vs yesterday; fires if today is trending
 *                                           worse in ≥1 section or overall. Tells you what dropped
 *                                           and the single most impactful fix for tonight.
 *
 * ID 41  Morning briefing (9:00 AM)      — yesterday's final score vs day-before. Fires only if
 *                                           yesterday was worse. Shows exactly what fell and gives
 *                                           one concrete action for today.
 *
 * ID 42  Sleep-timer appreciation        — fires ~10 s after the sleep timer stops IF yesterday
 *                                           improved vs the day before in ≥2 sections (or +6 pts
 *                                           total). Celebrates what went right and motivates
 *                                           repeating it today. Called directly from stopTimer,
 *                                           not from the batch scheduler.
 *
 * ID 43  Weekly wrap (Sunday 8 PM)       — this week's avg vs last week. Both improvement and
 *                                           decline variants. Skipped if < 4 days of data.
 *
 * ID 44  Monthly wrap (last day, 8 PM)   — this month's avg vs last month. Both variants.
 *                                           Skipped if < 10 days logged in the month.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { format, subDays, startOfMonth, isLastDayOfMonth } from 'date-fns'
import db from './db'
import { getNotificationMode } from './reminders'

const TREND_IDS = [40, 41, 42, 43, 44]

// ── Time helpers ──────────────────────────────────────────────────────────────

function todayAt(hour, minute) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

function isInFuture(hour, minute) {
  return todayAt(hour, minute) > new Date()
}

// ── Score diff ────────────────────────────────────────────────────────────────

function diff(a, b) {
  if (!a || !b) return null
  return {
    total:   Math.round((a.total_score   || 0) - (b.total_score   || 0)),
    diet:    Math.round((a.diet_score    || 0) - (b.diet_score    || 0)),
    workout: Math.round((a.workout_score || 0) - (b.workout_score || 0)),
    sleep:   Math.round((a.sleep_score   || 0) - (b.sleep_score   || 0)),
  }
}

const LABELS = { diet: 'Diet', workout: 'Workout', sleep: 'Sleep' }

// Best single tip for each declined section
const TIPS = {
  diet:    'Log dinner before 8:30 PM and avoid post-dinner snacks.',
  workout: 'A 20-min evening walk alone adds back ~10 pts.',
  sleep:   'Start the sleep timer before 11:30 PM for full timing points.',
}

// Motivators cycled by day-of-week
const MOTIVATORS = [
  'Momentum is building — protect it tonight.',
  'One great day follows another. Lock in the routine.',
  'Consistency beats perfection. Do it again today.',
  "You're in the zone — keep showing up.",
  'Same actions, same results. Stay the course.',
  'Progress compounds. Another strong day matters.',
  "You proved you can do it. Prove it again today.",
]

// ── Decline notification builder ─────────────────────────────────────────────

/**
 * Returns {id, title, body} or null if no meaningful decline.
 * d       = scoreDiff(current, previous)
 * refWord = "today" | "yesterday" (appears in the title)
 */
function buildDecline(id, d, refWord) {
  if (!d) return null

  const dropped = Object.entries({ diet: d.diet, workout: d.workout, sleep: d.sleep })
    .filter(([, v]) => v <= -3)
    .sort(([, a], [, b]) => a - b) // most negative first

  // Suppress if total drop is small and no section fell enough
  if (dropped.length === 0 && d.total > -6) return null

  const sectionNames = dropped.map(([k]) => LABELS[k])
  const changes      = dropped.map(([k, v]) => `${LABELS[k]} −${Math.abs(v)}`).join(' · ')
  const primaryTip   = dropped.length > 0 ? TIPS[dropped[0][0]] : 'Keep logs early and aim for bed by 11 PM.'

  const title = dropped.length > 0
    ? `📉 ${sectionNames.join(' & ')} down ${refWord}`
    : `📉 Score dropped ${refWord} (−${Math.abs(d.total)} pts)`

  const body = changes
    ? `${changes}. ${primaryTip}`
    : `${Math.abs(d.total)} pts below the previous day. ${primaryTip}`

  return { id, title, body }
}

// ── Appreciation notification builder ────────────────────────────────────────

/**
 * Returns {id, title, body} or null if not enough improvement.
 * score = the current/yesterday score record for the total display.
 */
function buildAppreciation(id, d, score) {
  if (!d) return null

  const improved = Object.entries({ diet: d.diet, workout: d.workout, sleep: d.sleep })
    .filter(([, v]) => v >= 3)
    .sort(([, a], [, b]) => b - a) // most positive first

  if (improved.length < 2 && d.total < 6) return null

  const gains     = improved.map(([k, v]) => `${LABELS[k]} +${v}`).join(' · ')
  const total     = Math.round(score?.total_score || 0)
  const motivator = MOTIVATORS[new Date().getDay()]

  return {
    id,
    title: `🚀 Better than yesterday! (${total} pts)`,
    body:  gains ? `${gains}. ${motivator}` : `Up ${d.total} pts overall. ${motivator}`,
  }
}

// ── Weekly summary builder ────────────────────────────────────────────────────

async function buildWeeklySummary() {
  const now          = new Date()
  const thisWeekEnd  = format(now, 'yyyy-MM-dd')
  const thisWeekStart= format(subDays(now, 6), 'yyyy-MM-dd')
  const lastWeekEnd  = format(subDays(now, 7),  'yyyy-MM-dd')
  const lastWeekStart= format(subDays(now, 13), 'yyyy-MM-dd')

  const [thisWeek, lastWeek] = await Promise.all([
    db.daily_scores.where('date').between(thisWeekStart, thisWeekEnd, true, true).toArray(),
    db.daily_scores.where('date').between(lastWeekStart, lastWeekEnd, true, true).toArray(),
  ])

  if (thisWeek.length < 4 || lastWeek.length < 4) return null

  const avgOf   = (rows, key) => Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length)
  const thisAvg = avgOf(thisWeek, 'total_score')
  const lastAvg = avgOf(lastWeek, 'total_score')
  const delta   = thisAvg - lastAvg

  const sectionDeltas = {
    diet:    avgOf(thisWeek, 'diet_score')    - avgOf(lastWeek, 'diet_score'),
    workout: avgOf(thisWeek, 'workout_score') - avgOf(lastWeek, 'workout_score'),
    sleep:   avgOf(thisWeek, 'sleep_score')   - avgOf(lastWeek, 'sleep_score'),
  }

  if (delta >= 3) {
    const [bestKey, bestVal] = Object.entries(sectionDeltas).sort(([,a],[,b]) => b - a)[0]
    return {
      title: `📈 Strong week — avg ${thisAvg} pts (+${delta} vs last week)`,
      body:  `Best area: ${LABELS[bestKey]} +${bestVal} pts/day. Keep this pattern next week.`,
    }
  }

  if (delta <= -3) {
    const [worstKey, worstVal] = Object.entries(sectionDeltas).sort(([,a],[,b]) => a - b)[0]
    return {
      title: `📉 Tougher week — avg ${thisAvg} pts (−${Math.abs(delta)} vs last week)`,
      body:  `Biggest drop: ${LABELS[worstKey]} −${Math.abs(worstVal)} pts/day. ${TIPS[worstKey]}`,
    }
  }

  // Flat week
  const arrow = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'
  return {
    title: `📊 Week wrap — avg ${thisAvg} pts (${arrow} vs last week)`,
    body:  'Consistent week. Review your best day in Progress and repeat those habits.',
  }
}

// ── Monthly summary builder ───────────────────────────────────────────────────

async function buildMonthlySummary() {
  const now            = new Date()
  const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const thisMonthEnd   = format(now, 'yyyy-MM-dd')

  const lastMonthLastDay  = subDays(startOfMonth(now), 1)
  const lastMonthStart    = format(startOfMonth(lastMonthLastDay), 'yyyy-MM-dd')
  const lastMonthEnd      = format(lastMonthLastDay, 'yyyy-MM-dd')

  const [thisMonth, lastMonth] = await Promise.all([
    db.daily_scores.where('date').between(thisMonthStart, thisMonthEnd, true, true).toArray(),
    db.daily_scores.where('date').between(lastMonthStart, lastMonthEnd, true, true).toArray(),
  ])

  if (thisMonth.length < 10) return null   // not enough data for a meaningful summary

  const avgOf      = (rows, key) => Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length)
  const thisAvg    = avgOf(thisMonth, 'total_score')
  const monthName  = format(now, 'MMMM')

  if (lastMonth.length < 10) {
    // First month with enough data — no comparison, just celebrate logging
    const best = Math.round(Math.max(...thisMonth.map(r => r.total_score || 0)))
    return {
      title: `🗓️ ${monthName} summary — avg ${thisAvg} pts`,
      body:  `${thisMonth.length} days logged · best day ${best} pts. Open Progress for your full breakdown.`,
    }
  }

  const lastAvg  = avgOf(lastMonth, 'total_score')
  const delta    = thisAvg - lastAvg
  const prevName = format(lastMonthLastDay, 'MMMM')

  if (delta >= 3) {
    return {
      title: `🏆 ${monthName} was your best yet — avg ${thisAvg} pts (+${delta} vs ${prevName})`,
      body:  `${thisMonth.length} days logged. Aim for ${thisAvg + 3}+ next month.`,
    }
  }

  if (delta <= -3) {
    const sectionDeltas = {
      diet:    avgOf(thisMonth, 'diet_score')    - avgOf(lastMonth, 'diet_score'),
      workout: avgOf(thisMonth, 'workout_score') - avgOf(lastMonth, 'workout_score'),
      sleep:   avgOf(thisMonth, 'sleep_score')   - avgOf(lastMonth, 'sleep_score'),
    }
    const [worstKey, worstVal] = Object.entries(sectionDeltas).sort(([,a],[,b]) => a - b)[0]
    return {
      title: `📉 ${monthName} dipped — avg ${thisAvg} pts (−${Math.abs(delta)} vs ${prevName})`,
      body:  `Biggest drop: ${LABELS[worstKey]} −${Math.abs(worstVal)} pts/day. ${TIPS[worstKey]} Target ${prevName}'s ${lastAvg}+ next month.`,
    }
  }

  const arrow = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'
  return {
    title: `📊 ${monthName} wrap — avg ${thisAvg} pts (${arrow} vs ${prevName})`,
    body:  `Consistent month. Push for ${thisAvg + 5}+ in ${format(new Date(now.getFullYear(), now.getMonth() + 1, 1), 'MMMM')}.`,
  }
}

// ── Main batch scheduler ──────────────────────────────────────────────────────
// Call this from the same places as scheduleSmartNotifications (app open + after saves).

export async function scheduleTrendNotifications() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return

    // Cancel all trend IDs before rescheduling (except ID 42 which is fired on-demand)
    await LocalNotifications.cancel({ notifications: [40, 41, 43, 44].map(id => ({ id })) })

    const now        = new Date()
    const today      = format(now, 'yyyy-MM-dd')
    const yesterday  = format(subDays(now, 1), 'yyyy-MM-dd')
    const dayBefore  = format(subDays(now, 2), 'yyyy-MM-dd')
    const dayOfWeek  = now.getDay() // 0 = Sunday

    const [todayScore, yesterdayScore, dayBeforeScore] = await Promise.all([
      db.daily_scores.where('date').equals(today).first(),
      db.daily_scores.where('date').equals(yesterday).first(),
      db.daily_scores.where('date').equals(dayBefore).first(),
    ])

    const notifications = []

    // Daily trend alerts are Coach-only; the weekly and monthly wraps go to everyone.
    const mode  = await getNotificationMode()
    const coach = mode === 'coach'

    // ── ID 40: After-dinner review (9:30 PM) — today vs yesterday ─────────────
    if (coach && isInFuture(21, 30) && todayScore && yesterdayScore) {
      const d = diff(todayScore, yesterdayScore)
      const n = buildDecline(40, d, 'today')
      if (n) notifications.push({ ...n, schedule: { at: todayAt(21, 30), repeats: false, allowWhileIdle: true } })
    }

    // ── ID 41: Morning briefing (9 AM) — yesterday vs day-before ──────────────
    if (coach && isInFuture(9, 0) && yesterdayScore && dayBeforeScore) {
      const d = diff(yesterdayScore, dayBeforeScore)
      const n = buildDecline(41, d, 'yesterday')
      if (n) {
        // Enrich body with "yesterday scored X"
        const score = Math.round(yesterdayScore.total_score || 0)
        n.title = `📊 Yesterday: ${score} pts — what dropped`
        notifications.push({ ...n, schedule: { at: todayAt(9, 0), repeats: false, allowWhileIdle: true } })
      }
    }

    // ── ID 44: Monthly wrap (last day of month 8 PM) ──────────────────────────
    let monthlyScheduled = false
    if (isLastDayOfMonth(now) && isInFuture(20, 0)) {
      const monthly = await buildMonthlySummary()
      if (monthly) {
        notifications.push({ id: 44, ...monthly, schedule: { at: todayAt(20, 0), repeats: false, allowWhileIdle: true } })
        monthlyScheduled = true
      }
    }

    // ── ID 43: Weekly wrap (Sunday 8 PM) ──────────────────────────────────────
    // Outside Coach mode the monthly wrap replaces it when both land on one day.
    if (dayOfWeek === 0 && isInFuture(20, 0) && (coach || !monthlyScheduled)) {
      const weekly = await buildWeeklySummary()
      if (weekly) notifications.push({ id: 43, ...weekly, schedule: { at: todayAt(20, 0), repeats: false, allowWhileIdle: true } })
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch (e) {
    console.warn('[TrendNotifEngine]', e)
  }
}

// ── On-demand appreciation (called directly from the sleep timer's stop handler) ──────────
// logDate = the wake-up date whose score was just finalized (e.g. "2026-05-19").
// Compares logDate's score vs logDate-1. Fires in ~10 s if it was a better day.

export async function checkAndFireAppreciation(logDate) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return
    if ((await getNotificationMode()) !== 'coach') return

    const prevDate = format(subDays(new Date(logDate), 1), 'yyyy-MM-dd')
    const [current, previous] = await Promise.all([
      db.daily_scores.where('date').equals(logDate).first(),
      db.daily_scores.where('date').equals(prevDate).first(),
    ])

    if (!current || !previous) return

    const d = diff(current, previous)
    const n = buildAppreciation(42, d, current)
    if (!n) return

    // Cancel any pending ID 42, then fire 10 s from now so it arrives after the
    // "Sleep saved" toast is already visible.
    await LocalNotifications.cancel({ notifications: [{ id: 42 }] })
    const fireAt = new Date(Date.now() + 10_000)
    await LocalNotifications.schedule({
      notifications: [{ ...n, schedule: { at: fireAt, repeats: false, allowWhileIdle: true } }],
    })
  } catch (e) {
    console.warn('[TrendNotifEngine:appreciation]', e)
  }
}
