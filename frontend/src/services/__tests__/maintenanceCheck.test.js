import { describe, it, expect } from 'vitest'
import { format, addDays, parseISO } from 'date-fns'
import { checkMaintenance, weightSlope } from '../maintenanceCheck.js'

const start = '2026-10-01'
const dateAt = (i) => format(addDays(parseISO(start), i), 'yyyy-MM-dd')
const days = (n, net, over = {}) => Array.from({ length: n }, (_, i) => ({
  date: dateAt(i), counts: true, net, eaten: 2000, burned: 2000 - net, burn: { adjust: 0 }, formulaMaintenance: 2000 - net, ...over,
}))
// Weekly-ish weigh-ins following a steady change in kg per week
const weights = (kgPerWeek, n = 8, every = 3) => Array.from({ length: n }, (_, i) => ({
  date: dateAt(i * every), weight_kg: 70 + (kgPerWeek / 7) * i * every,
}))

describe('weightSlope', () => {
  it('finds the trend in kg a day', () => {
    expect(weightSlope(weights(0.7))).toBeCloseTo(0.1)
  })
  it('is not thrown by one heavy morning', () => {
    const w = weights(0)
    w[3] = { ...w[3], weight_kg: 72 }
    expect(Math.abs(weightSlope(w) * 7)).toBeLessThan(0.25)
  })
})

describe('checkMaintenance', () => {
  it('needs enough days, weigh-ins and time', () => {
    expect(checkMaintenance({ days: days(13, 0), weights: weights(0) }).ready).toBe(false)
    expect(checkMaintenance({ days: days(20, 0), weights: weights(0, 5) }).ready).toBe(false)
    expect(checkMaintenance({ days: days(20, 0), weights: weights(0, 8, 1) }).ready).toBe(false)
    expect(checkMaintenance({ days: days(20, 0), weights: weights(0) }).ready).toBe(true)
  })
  it('leaves out days that do not count, such as sick days', () => {
    const list = [...days(10, 0), ...days(10, -2000, { counts: false })]
    expect(checkMaintenance({ days: list, weights: weights(0) }).ready).toBe(false)
  })
  it('suggests nothing when logs and scale agree', () => {
    const r = checkMaintenance({ days: days(20, -550), weights: weights(-0.5) })
    expect(r.ready).toBe(true)
    expect(r.suggestion).toBeNull()
    expect(r.expectedKgPerWeek).toBe(-0.5)
    expect(r.actualKgPerWeek).toBe(-0.5)
  })
  it('finds a lower maintenance when weight falls slower than logged', () => {
    // Logs: −330 a day, about −0.3 kg a week. Scale: −0.1 kg a week, about −110 a day.
    const r = checkMaintenance({ days: days(20, -330), weights: weights(-0.1) })
    expect(r.suggestion.change).toBe(-220)
    expect(r.suggestion.burnOffset).toBe(-220)
    expect(r.workingMaintenance).toBe(2110)
  })
  it('finds a higher maintenance when weight falls faster than logged', () => {
    const r = checkMaintenance({ days: days(20, 0), weights: weights(-0.5) })
    expect(r.suggestion.change).toBeGreaterThan(0)
  })
  it('limits the correction to 20% of the formula', () => {
    const r = checkMaintenance({ days: days(20, 0, { formulaMaintenance: 2000 }), weights: weights(-3) })
    expect(r.suggestion.limited).toBe(true)
    expect(r.suggestion.maintenanceOffset).toBe(400)
    expect(Math.abs(r.suggestion.burnOffset)).toBeLessThanOrEqual(400)
  })
  it('builds on a correction already in force', () => {
    const r = checkMaintenance({ days: days(20, -330), weights: weights(-0.1), current: { burnOffset: -50, maintenanceOffset: -50 } })
    expect(r.suggestion.burnOffset).toBe(-270)
  })
})
