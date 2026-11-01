import { describe, it, expect } from 'vitest'
import { responseOf, computeRest, shouldTurnOff, isHoldoutDay, compareSources } from '../nudgeLearning.js'

const NOW = new Date(2026, 10, 10, 12, 0)
const row = (over = {}) => ({ status: 'sent', trigger: 'steps', date: '2026-11-10', at: new Date(2026, 10, 10, 8, 0).getTime(), ...over })
const days = (n) => NOW.getTime() - n * 86400000

describe('responseOf', () => {
  it('waits out the two-hour window', () => {
    expect(responseOf(row({ at: NOW.getTime() - 3600000 }), {}, NOW)).toBeNull()
  })
  it('a tap counts straight away', () => expect(responseOf(row({ tapped_at: 1, at: NOW.getTime() }), {}, NOW)).toBe('tapped'))
  it('dinner logged within two hours counts as acted', () => {
    const r = row({ trigger: 'dinner', at: new Date(2026, 10, 10, 8, 0).getTime() })
    expect(responseOf(r, { diets: { '2026-11-10': { meal_items: [{ mealType: 'dinner', time: '09:00' }] } } }, NOW)).toBe('acted')
    expect(responseOf(r, { diets: { '2026-11-10': { meal_items: [{ mealType: 'dinner', time: '11:00' }] } } }, NOW)).toBe('ignored')
  })
  it('bedtime looks at the night that ends the next day, past midnight too', () => {
    const r = row({ trigger: 'bedtime', date: '2026-11-08', at: new Date(2026, 10, 8, 23, 0).getTime() })
    expect(responseOf(r, { sleeps: { '2026-11-09': { sleep_time: '23:30' } } }, NOW)).toBe('acted')
    expect(responseOf(r, { sleeps: { '2026-11-09': { sleep_time: '00:30' } } }, NOW)).toBe('acted')
    expect(responseOf(r, { sleeps: { '2026-11-09': { sleep_time: '03:00' } } }, NOW)).toBe('ignored')
    expect(responseOf(r, {}, NOW)).toBe('ignored')
  })
  it('does not call a nudge that asks nothing ignored', () => {
    expect(responseOf(row({ trigger: 'noticed_progress' }), {}, NOW)).toBe('seen')
  })
})

describe('computeRest', () => {
  const ignored = (n, trigger = 'steps') => Array.from({ length: n }, (_, i) => row({ trigger, at: days(i + 1), response: 'ignored' }))
  it('rests a kind after 3 ignored in a row', () => {
    expect(computeRest(ignored(3), NOW).rested.has('steps')).toBe(true)
    expect(computeRest(ignored(2), NOW).rested.has('steps')).toBe(false)
  })
  it('a response breaks the run', () => {
    const rows = [...ignored(3), row({ at: NOW.getTime(), response: 'acted' })]
    expect(computeRest(rows, NOW).rested.has('steps')).toBe(false)
  })
  it('the rest ends after 7 days', () => {
    const rows = [1, 2, 3].map(i => row({ at: days(7 + i), response: 'ignored' }))
    expect(computeRest(rows, NOW).rested.has('steps')).toBe(false)
  })
  it('never rests the reminders the mode promises', () => {
    expect(computeRest(ignored(3, 'bedtime'), NOW).rested.has('bedtime')).toBe(false)
  })
  it('rests a pattern for 14 days after showing it', () => {
    const r = row({ trigger: 'evidence', detail: 'walk_bed', at: days(5), response: 'seen' })
    expect(computeRest([r], NOW).restedEvidence.has('walk_bed')).toBe(true)
    expect(computeRest([{ ...r, at: days(15) }], NOW).restedEvidence.has('walk_bed')).toBe(false)
  })
  it('throttles when more than 80% are ignored over 14 days', () => {
    expect(computeRest(ignored(9), NOW).throttled).toBe(false)     // too few to say
    const mostly = [...ignored(9), row({ at: days(1), response: 'acted', trigger: 'walk' })]
    expect(computeRest(ignored(10), NOW).throttled).toBe(true)
    expect(computeRest(mostly, NOW).throttled).toBe(true)
    const healthy = [...ignored(8), row({ at: days(1), response: 'acted', trigger: 'walk' }), row({ at: days(1), response: 'tapped', trigger: 'walk' }), row({ at: days(2), response: 'acted', trigger: 'walk' })]
    expect(computeRest(healthy, NOW).throttled).toBe(false)
  })
  it('carries the turned-off list', () => expect(computeRest([], NOW, ['steps']).off.has('steps')).toBe(true))
})

describe('the rest', () => {
  it('turns a kind off at two "not helpful"', () => {
    const r = (rating) => ({ trigger: 'steps', rating })
    expect(shouldTurnOff([r('not_helpful')], 'steps')).toBe(false)
    expect(shouldTurnOff([r('not_helpful'), r('not_helpful')], 'steps')).toBe(true)
  })
  it('keeps rule-written text on about 1 day in 5', () => {
    const dates = Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
    const share = dates.filter(isHoldoutDay).length / dates.length
    expect(share).toBeGreaterThan(0.1)
    expect(share).toBeLessThan(0.3)
  })
  it('compares AI against rule-written', () => {
    const c = compareSources([
      row({ source: 'ai', response: 'acted' }), row({ source: 'ai', response: 'tapped', tapped_at: 1 }),
      row({ source: 'rule', holdout: true, response: 'ignored' }),
      row({ source: 'rule', trigger: 'bedtime', response: 'ignored' }),   // never rewordable, so not compared
    ])
    expect(c.ai).toMatchObject({ sent: 2, tapped: 1, acted: 1 })
    expect(c.rule).toMatchObject({ sent: 1, ignored: 1 })
  })
})
