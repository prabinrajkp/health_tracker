import { format } from 'date-fns'

// Keeps the food list short without deleting anything.
//
// A food is ACTIVE while it has been logged, added or restored within the
// last ARCHIVE_AFTER_DAYS days; after that it is ARCHIVED. Nothing is stored
// as "archived" — the status is derived from the diet log every time, so:
//   · logging an archived food makes it active again with no extra step
//   · a food eaten on the same weekday every week never drops out (7 days idle
//     is still active; it archives on the 8th)
//   · Restore simply stamps `revivedAt`, which buys another full window

export const ARCHIVE_AFTER_DAYS = 7

const norm = (s) => (s || '').trim().toLowerCase()

// Accepts a 'yyyy-MM-dd' date or an ISO timestamp; returns the local date.
function dayOf(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd')
}

const daysBetween = (from, to) =>
  Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000)

const latest = (dates) => dates.filter(Boolean).sort().pop() || null

// The last date each food was logged, from every day's diet log. Items logged
// before foods had ids are matched by name.
export function buildFoodUsage(dietLogs = []) {
  const byId = {}, byLabel = {}
  for (const log of dietLogs) {
    if (!log?.date) continue
    for (const item of log.meal_items || []) {
      if (item.foodId && !(byId[item.foodId] >= log.date)) byId[item.foodId] = log.date
      const label = norm(item.label)
      if (label && !(byLabel[label] >= log.date)) byLabel[label] = log.date
    }
  }
  return { byId, byLabel }
}

export function foodStatus(food, usage, today) {
  const lastUsed   = latest([usage?.byId?.[food.id], usage?.byLabel?.[norm(food.label)]])
  const lastActive = latest([lastUsed, dayOf(food.createdAt), dayOf(food.revivedAt)])
  const idleDays   = lastActive ? daysBetween(lastActive, today) : null
  return {
    lastUsed,
    idleDays,
    // A food with no date at all predates this feature and has never been logged
    archived: idleDays === null || idleDays > ARCHIVE_AFTER_DAYS,
  }
}

// Splits the list for display. Active foods keep their order; archived foods
// are listed most recently used first, then never-used ones by name.
export function splitFoods(foods = [], usage, today) {
  const active = [], archived = []
  for (const food of foods) {
    const status = foodStatus(food, usage, today)
    ;(status.archived ? archived : active).push({ food, status })
  }
  archived.sort((a, b) =>
    (b.status.lastUsed || '').localeCompare(a.status.lastUsed || '') || a.food.label.localeCompare(b.food.label))
  return { active, archived }
}
