// What became of each notification, and what the app does about it. There are too few
// notifications for anything clever, so these are simple rules. See docs/ai_nudges_plan.md §7.
import { parseISO, addDays, format } from 'date-fns'
import { mealTimeOf } from './fasting'
import { toMinutes } from './nudgeTime'

export const ACTED_WINDOW_MS = 2 * 60 * 60 * 1000
const DAY_MS = 86400000
const RATING_OFF_COUNT = 2
const IGNORED_IN_A_ROW = 3
const REST_DAYS = 7
const EVIDENCE_REST_DAYS = 14
const THROTTLE_WINDOW_DAYS = 14
const THROTTLE_MIN_ROWS = 10
const THROTTLE_SHARE = 0.8

// These ask nothing, so not tapping them is not ignoring them
export const INFORMATIONAL = new Set(['evidence', 'noticed_progress', 'fresh_start', 'wrap_week', 'wrap_month', 'morning_review', 'near_win', 'if_then', 'sick_note'])

const inWindow = (minutes, row) => {
  if (minutes == null) return false
  const at = new Date(row.at)
  const start = at.getHours() * 60 + at.getMinutes()
  return minutes >= start && minutes <= start + ACTED_WINDOW_MS / 60000
}

/**
 * tapped, acted, ignored, or seen (informational and not tapped). null until the
 * two-hour window has passed. Acted is inferred, so it can be a coincidence.
 */
export function responseOf(row, logs, now = new Date()) {
  if (row.tapped_at) return 'tapped'
  if (now.getTime() - row.at < ACTED_WINDOW_MS) return null
  if (INFORMATIONAL.has(row.trigger)) return 'seen'

  const diet = logs.diets?.[row.date], workout = logs.workouts?.[row.date]
  const meal = (type) => (diet?.meal_items || []).some(i => i.mealType === type)
  let acted = false
  switch (row.trigger) {
    case 'dinner':
    case 'dinner_window': acted = inWindow(toMinutes(mealTimeOf(diet, 'dinner')), row); break
    case 'breakfast':     acted = meal('breakfast'); break
    case 'lunch_checkin': acted = meal('lunch'); break
    case 'steps':
    case 'walk':          acted = !!(workout?.post_dinner_walk || workout?.exercise_done); break
    case 'bedtime': {
      // Sleep rows are dated by wake-up day
      const night = logs.sleeps?.[format(addDays(parseISO(row.date), 1), 'yyyy-MM-dd')]
      acted = inWindow(toMinutes(night?.sleep_time), row)
        || inWindow((toMinutes(night?.sleep_time) ?? -1441) + 1440, row)
      break
    }
    case 'drinks_check':  acted = true; break    // nothing reliable to check, so never counted against it
    default:              acted = (diet?.meal_items || []).length > 0
  }
  return acted ? 'acted' : 'ignored'
}

const sent = (rows) => rows.filter(r => r.status === 'sent').sort((a, b) => a.at - b.at)

export function computeRest(rows, now = new Date(), off = []) {
  const nowMs = now.getTime()
  const list = sent(rows)
  const rested = new Set()
  const byTrigger = {}
  list.filter(r => r.response && r.response !== 'seen').forEach(r => { (byTrigger[r.trigger] ||= []).push(r) })
  for (const [trigger, items] of Object.entries(byTrigger)) {
    const last = items.slice(-IGNORED_IN_A_ROW)
    if (last.length === IGNORED_IN_A_ROW && last.every(r => r.response === 'ignored')
      && nowMs - last[last.length - 1].at < REST_DAYS * DAY_MS) rested.add(trigger)
  }
  // Bedtime and dinner are what the mode promises, so they are not rested for being ignored
  rested.delete('bedtime'); rested.delete('dinner')

  const restedEvidence = new Set(list
    .filter(r => r.trigger === 'evidence' && r.detail && nowMs - r.at < EVIDENCE_REST_DAYS * DAY_MS)
    .map(r => r.detail))

  const recent = list.filter(r => nowMs - r.at < THROTTLE_WINDOW_DAYS * DAY_MS && ['tapped', 'acted', 'ignored'].includes(r.response))
  const ignored = recent.filter(r => r.response === 'ignored').length
  const throttled = recent.length >= THROTTLE_MIN_ROWS && ignored / recent.length > THROTTLE_SHARE

  return { off: new Set(off), rested, restedEvidence, throttled }
}

export function shouldTurnOff(rows, trigger) {
  return rows.filter(r => r.trigger === trigger && r.rating === 'not_helpful').length >= RATING_OFF_COUNT
}

// About one day in five keeps the rule-written text, so the two can be compared
export function isHoldoutDay(date) {
  let h = 0
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h % 5 === 0
}

// Rule-written here means the comparison days only: slots the AI could have written
// and deliberately did not. Reminders it never rewords would skew the result.
export function compareSources(rows) {
  const out = {}
  for (const source of ['ai', 'rule']) {
    const items = sent(rows).filter(r => (source === 'ai' ? r.source === 'ai' : r.holdout))
    const answered = items.filter(r => ['tapped', 'acted', 'ignored'].includes(r.response))
    out[source] = {
      sent: items.length,
      tapped: items.filter(r => r.tapped_at).length,
      acted: answered.filter(r => r.response === 'acted').length,
      ignored: answered.filter(r => r.response === 'ignored').length,
    }
  }
  return out
}
