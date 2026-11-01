import { addDays, format, parseISO, subDays } from 'date-fns'

// A sick day is set aside: no score, no XP, and streaks pause instead of
// breaking. Everything here is pure so streak rules can be tested on their own.
// See docs/sick_days_plan.md.

export const CATCH_UP_MAX_DAYS = 7   // how far back the "were you unwell?" prompt looks

const key = (d) => format(d, 'yyyy-MM-dd')

export const toSickSet = (rows = []) => new Set(rows.map(r => (typeof r === 'string' ? r : r?.date)).filter(Boolean))

// True when `later` follows `earlier` with nothing but sick days in between,
// so a streak carries across. Sick days themselves add nothing to the count.
export function isConsecutive(earlier, later, sickSet = new Set()) {
  let d = addDays(parseISO(earlier), 1)
  const end = parseISO(later)
  if (d > end) return false
  while (d < end) {
    if (!sickSet.has(key(d))) return false
    d = addDays(d, 1)
  }
  return true
}

// The longest run of consecutive dates. Dates must be sorted ascending.
export function longestRun(dates = [], sickSet = new Set()) {
  let best = dates.length ? 1 : 0, run = 1
  for (let i = 1; i < dates.length; i++) {
    run = isConsecutive(dates[i - 1], dates[i], sickSet) ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

// A day counts as logged by hand if it has a meal, a night's sleep or exercise.
// Steps alone do not count, because they sync by themselves.
export function activeDates({ dietLogs = [], sleepLogs = [], workoutLogs = [] } = {}) {
  const active = new Set()
  for (const d of dietLogs)    if ((d?.meal_items || []).length > 0) active.add(d.date)
  for (const s of sleepLogs)   if (s?.sleep_time) active.add(s.date)
  for (const w of workoutLogs) if (w?.exercise_done || w?.post_dinner_walk) active.add(w.date)
  return active
}

// The unbroken run of empty days just before today, for the catch-up prompt.
// Nothing is offered to someone who has never logged anything, or for days
// already marked sick. `gapStart` identifies the gap, so answering "No" once
// keeps holding as the same gap grows, even past the 7-day limit.
export function findMissedDays(today, active, sickSet = new Set(), maxDays = CATCH_UP_MAX_DAYS) {
  const earlier = [...active].filter(d => d < today).sort()
  if (earlier.length === 0) return { days: [], gapStart: null }

  const stopAt = earlier[earlier.length - 1]   // the last day with anything logged
  const days = []
  let gapStart = null
  for (let d = subDays(parseISO(today), 1); key(d) > stopAt; d = subDays(d, 1)) {
    const date = key(d)
    if (sickSet.has(date)) break
    gapStart = date
    if (days.length < maxDays) days.unshift(date)
  }
  return { days, gapStart }
}

// "Tue", "Tue and Wed", "Mon to Thu" — the days are always consecutive.
export function describeDays(days = []) {
  const name = (d) => format(parseISO(d), 'EEE')
  if (days.length === 0) return ''
  if (days.length === 1) return name(days[0])
  if (days.length === 2) return `${name(days[0])} and ${name(days[1])}`
  if (days.length >= 7)  return 'the last 7 days'
  return `${name(days[0])} to ${name(days[days.length - 1])}`
}
