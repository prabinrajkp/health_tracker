import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { format, subDays } from 'date-fns'
import db from './db'

// Smart notification IDs 30–39 (one-time daily, rescheduled on app open and after saves)
// Fixed repeating reminders use IDs 1–26 (managed in Settings.jsx)
const SMART_IDS = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39]

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayAt(hour, minute) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

function isTimeInFuture(hour, minute) {
  return todayAt(hour, minute) > new Date()
}

function isDinnerLogged(dietLog) {
  if (!dietLog) return false
  const mt = dietLog.meal_times?.dinner || dietLog.dinner_time
  if (mt) return true
  return (dietLog.meal_items || []).some(i => i.mealType === 'dinner')
}

function isSleepStarted(sleepLog) {
  return !!(sleepLog?.sleep_time)
}

function lateDinnerCount(dietLogs) {
  return dietLogs.filter(d => {
    const mt = d.meal_times?.dinner || d.dinner_time
    if (mt && Number(mt.split(':')[0]) >= 21) return true
    return (d.meal_items || [])
      .filter(i => i.mealType === 'dinner' && i.time)
      .some(i => Number(i.time.split(':')[0]) >= 21)
  }).length
}

// ── Main scheduling function ───────────────────────────────────────────────────
export async function scheduleSmartNotifications() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return

    const today     = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const dayBefore = format(subDays(new Date(), 2), 'yyyy-MM-dd')
    const weekStart = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const dayOfWeek = new Date().getDay() // 0 = Sunday

    // Cancel all existing smart notifications before rescheduling
    await LocalNotifications.cancel({ notifications: SMART_IDS.map(id => ({ id })) })

    // Read today's logs and recent history in parallel
    const [dietLog, workoutLog, sleepLog, todayScore, recentDiet, recentScores] = await Promise.all([
      db.diet_logs.where('date').equals(today).first(),
      db.workout_logs.where('date').equals(today).first(),
      db.sleep_logs.where('date').equals(today).first(),
      db.daily_scores.where('date').equals(today).first(),
      db.diet_logs.where('date').between(weekStart, today, true, false).toArray(),
      db.daily_scores.where('date').between(weekStart, today, true, false).toArray(),
    ])

    // Smart suppression: skip most nudges if today's score is already high
    const currentScore = todayScore?.total_score || 0
    const skipNudges = currentScore >= 80

    const notifications = []

    // ── 1. DINNER RISK (8:30 PM or 8:15 PM for repeat offenders) ──────────────
    if (!isDinnerLogged(dietLog) && !skipNudges) {
      const lateDinners = lateDinnerCount(recentDiet)
      const repeatOffender = lateDinners >= 3

      // Earlier alert for users who repeatedly miss dinner timing
      const alertH = 20
      const alertM = repeatOffender ? 15 : 30

      if (isTimeInFuture(alertH, alertM)) {
        notifications.push({
          id: 30,
          title: '⚠️ Dinner Risk',
          body: repeatOffender
            ? `You usually miss dinner timing — fix it today. ${60 - alertM} min before the 5-pt penalty.`
            : "You're 30 min from losing 5 pts — log dinner before 9 PM.",
          schedule: { at: todayAt(alertH, alertM), repeats: false, allowWhileIdle: true },
        })
      }
    }

    // ── 2. SLEEP RISK (11:15 PM) ───────────────────────────────────────────────
    if (!isSleepStarted(sleepLog) && isTimeInFuture(23, 15)) {
      notifications.push({
        id: 31,
        title: '😴 Sleep Risk',
        body: 'Late sleep = lower recovery score. Start your sleep timer now.',
        schedule: { at: todayAt(23, 15), repeats: false, allowWhileIdle: true },
      })
    }

    // ── 3. WORKOUT GAP (6 PM, steps < 4000) ───────────────────────────────────
    if (!skipNudges && isTimeInFuture(18, 0)) {
      const steps = workoutLog?.steps || 0
      if (steps < 4000) {
        notifications.push({
          id: 32,
          title: '🏃 Step Gap',
          body: steps > 0
            ? `Only ${steps.toLocaleString()} steps. A 20-min walk closes this.`
            : "You're behind on steps — a 20-min walk fixes this.",
          schedule: { at: todayAt(18, 0), repeats: false, allowWhileIdle: true },
        })
      }
    }

    // ── 4. RE-ENGAGEMENT (inactive 2+ days, morning nudge) ────────────────────
    const missedYesterday = !recentScores.find(s => s.date === yesterday)
    const missedDayBefore = !recentScores.find(s => s.date === dayBefore)
    if (missedYesterday && missedDayBefore && isTimeInFuture(10, 0)) {
      notifications.push({
        id: 33,
        title: '👋 Back on track?',
        body: 'You were doing well. Restart today — no pressure.',
        schedule: { at: todayAt(10, 0), repeats: false, allowWhileIdle: true },
      })
    }

    // ── 5. WEEKLY INSIGHT (Sunday 7 PM) ───────────────────────────────────────
    if (dayOfWeek === 0 && isTimeInFuture(19, 0)) {
      const weekLateDinners = lateDinnerCount(recentDiet)
      const weekAvgScore = recentScores.length > 0
        ? Math.round(recentScores.reduce((a, s) => a + s.total_score, 0) / recentScores.length)
        : 0

      let weekBody
      if (weekLateDinners >= 3) {
        weekBody = `This week: ${weekLateDinners} late dinners cost ~${weekLateDinners * 5} pts. Fix this → instant upgrade.`
      } else if (weekAvgScore > 0) {
        weekBody = `Weekly avg: ${weekAvgScore} pts. Open History → Weekly tab for your full breakdown.`
      } else {
        weekBody = 'Your weekly summary is ready. See what drove your score this week.'
      }

      notifications.push({
        id: 34,
        title: '📊 Weekly Insight',
        body: weekBody,
        schedule: { at: todayAt(19, 0), repeats: false, allowWhileIdle: true },
      })
    }

    // ── 6. BEHAVIOR-AWARE BREAKFAST NUDGE (9 AM, if habitual skipper) ─────────
    if (!skipNudges && isTimeInFuture(9, 0)) {
      const recentWithDiet = recentScores.slice(-5).map(s => s.date)
      const breakfastMissedCount = recentWithDiet.filter(d => {
        const dl = recentDiet.find(r => r.date === d)
        if (!dl) return false
        if (dl.breakfast_logged) return false
        return !(dl.meal_items || []).some(i => i.mealType === 'breakfast')
      }).length

      if (breakfastMissedCount >= 4) {
        notifications.push({
          id: 35,
          title: '🌅 Breakfast streak?',
          body: `You've missed breakfast ${breakfastMissedCount} of the last 5 days. Log it today — 5 pts and a better day.`,
          schedule: { at: todayAt(9, 0), repeats: false, allowWhileIdle: true },
        })
      }
    }

    // Frequency control: max 4 smart notifications per day, highest priority first
    // Priority order: sleep risk > dinner risk > workout gap > re-engagement > weekly > breakfast
    const priorityOrder = [31, 30, 32, 33, 34, 35]
    const sorted = notifications.sort(
      (a, b) => priorityOrder.indexOf(a.id) - priorityOrder.indexOf(b.id)
    ).slice(0, 4)

    if (sorted.length > 0) {
      await LocalNotifications.schedule({ notifications: sorted })
    }
  } catch (e) {
    // Never crash the app due to notification scheduling
    console.warn('[NotificationEngine]', e)
  }
}
