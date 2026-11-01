// Compares what the logs say should have happened with what the scale did, and
// offers a corrected maintenance figure. See docs/body_goal_net_energy_plan.md §4.
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { round10 } from './energy'

const KCAL_PER_KG    = 7700
const MIN_SPAN_DAYS  = 21
const MIN_DAYS       = 14
const MIN_WEIGH_INS  = 6
const MIN_GAP_KCAL   = 150
const MAX_SHIFT      = 0.2     // of the formula, either way

// Least-squares slope in kg per day: one heavy morning should not move the answer.
export function weightSlope(entries) {
  const first = parseISO(entries[0].date)
  const pts = entries.map(e => ({ x: differenceInCalendarDays(parseISO(e.date), first), y: e.weight_kg }))
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return den ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den : 0
}

const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v))

/**
 * days:    computeNet results for the period, each with `formulaMaintenance` added
 * weights: [{ date, weight_kg }] in the same period, oldest first
 * current: the maintenanceOffset and burnOffset already in force
 *
 * Always says whether there is enough data (`ready`) and, when there is, the
 * expected and actual weekly change. `suggestion` is only set for a real gap.
 */
export function checkMaintenance({ days, weights, current = {} }) {
  const counted = days.filter(d => d.counts)
  const sorted  = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const span = sorted.length > 1 ? differenceInCalendarDays(parseISO(sorted[sorted.length - 1].date), parseISO(sorted[0].date)) : 0

  const need = { days: MIN_DAYS, weighIns: MIN_WEIGH_INS, spanDays: MIN_SPAN_DAYS }
  const have = { days: counted.length, weighIns: sorted.length, spanDays: span }
  if (counted.length < MIN_DAYS || sorted.length < MIN_WEIGH_INS || span < MIN_SPAN_DAYS) {
    return { ready: false, need, have }
  }

  const avg = (fn) => counted.reduce((s, d) => s + fn(d), 0) / counted.length
  const avgNet     = avg(d => d.net)
  const avgEaten   = avg(d => d.eaten)
  const avgFormula = avg(d => d.formulaMaintenance)
  const avgRawBurn = avg(d => d.burned - (d.burn?.adjust || 0))

  const slope        = weightSlope(sorted)
  const actualNet    = slope * KCAL_PER_KG
  const actualBurn   = avgEaten - actualNet   // the working maintenance
  const gap          = avgNet - actualNet     // above zero: logs predict more gain than happened

  const result = {
    ready: true, need, have,
    expectedKgPerWeek: Math.round((avgNet * 7 / KCAL_PER_KG) * 100) / 100,
    actualKgPerWeek:   Math.round(slope * 7 * 100) / 100,
    workingMaintenance: Math.round(actualBurn),
    suggestion: null,
  }
  if (Math.abs(gap) < MIN_GAP_KCAL) return result

  const formulaBase = avgFormula - (current.maintenanceOffset || 0)
  const limitM = formulaBase * MAX_SHIFT, limitB = avgRawBurn * MAX_SHIFT
  const maintenanceOffset = Math.round(clamp(actualBurn - formulaBase, limitM))
  const burnOffset        = Math.round(clamp((current.burnOffset || 0) + gap, limitB))

  result.suggestion = {
    change: round10(gap),      // positive: real maintenance looks higher than estimated
    maintenanceOffset,
    burnOffset,
    limited: Math.abs(actualBurn - formulaBase) > limitM,
  }
  return result
}
