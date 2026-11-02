import { describe, it, expect, vi } from 'vitest'
import { pendingItems, applyPending, applyItem } from '../widgetInbox'

// A stand-in for the database: drinks are kept by id, as localStore.addWaterEntry does
function fakeStore() {
  const s = {
    water: {}, timer: null, nights: [], weights: [],
    addWaterEntry: vi.fn(async (date, entry) => {
      const day = (s.water[date] ||= [])
      if (!day.some(e => e.id === entry.id)) day.push(entry)
    }),
    removeWaterEntry: vi.fn(async (date, id) => { s.water[date] = (s.water[date] || []).filter(e => e.id !== id) }),
    startSleepTimer: vi.fn((at, { quiet } = {}) => { if (!(quiet && s.timer)) s.timer = at; return s.timer }),
    stopSleepTimer: vi.fn(async ({ endAt, startedAt }) => { if (startedAt) s.nights.push({ startedAt, endAt }); s.timer = null }),
    getSleepTimerStart: () => s.timer,
    saveWeightEntry: vi.fn(async (p) => { s.weights.push(p) }),
  }
  return s
}
const water = (id, at, date = '2026-11-02', ml = 250) => ({ id, type: 'water', at, date, ml })

describe('widget inbox', () => {
  it('applies oldest first and skips what was already applied', () => {
    const items = [water('b', 20), water('a', 10), water('c', 30)]
    expect(pendingItems(items, new Set(['c'])).map(i => i.id)).toEqual(['a', 'b'])
  })

  it('logs a drink once when the same inbox is applied twice', async () => {
    const store = fakeStore()
    const items = [water('a', 1), water('b', 2), water('c', 3), water('d', 4), water('e', 5)]
    const applied = new Set()
    await applyPending(items, applied, store)
    await applyPending(items, applied, store)
    expect(store.water['2026-11-02']).toHaveLength(5)
  })

  it('loses nothing and adds nothing twice after a crash before the applied list was saved', async () => {
    const store = fakeStore()
    const items = [water('a', 1), water('b', 2)]
    await applyPending(items, new Set(), store)
    // The applied ids were never saved: everything runs again, and the ids keep it to one each
    await applyPending(items, new Set(), store)
    expect(store.water['2026-11-02'].map(e => e.id)).toEqual(['a', 'b'])
  })

  it('keeps each drink on the day it was tapped, even across midnight', async () => {
    const store = fakeStore()
    await applyPending([water('late', 1, '2026-11-01')], new Set(), store)
    expect(store.addWaterEntry).toHaveBeenCalledWith('2026-11-01', expect.objectContaining({ id: 'late', ml: 250 }))
  })

  it('saves the night with the times tapped, start then stop', async () => {
    const store = fakeStore()
    const items = [
      { id: 's2', type: 'sleep_stop', at: 2000, startedAt: 1000 },
      { id: 's1', type: 'sleep_start', at: 1000 },
    ]
    await applyPending(items, new Set(), store)
    expect(store.nights).toEqual([{ startedAt: 1000, endAt: 2000 }])
    expect(store.timer).toBeNull()
  })

  it('never moves a timer the app already started', async () => {
    const store = fakeStore()
    store.timer = 500
    await applyPending([{ id: 's1', type: 'sleep_start', at: 1000 }, { id: 's2', type: 'sleep_stop', at: 9000, startedAt: 1000 }], new Set(), store)
    expect(store.nights).toEqual([{ startedAt: 500, endAt: 9000 }])
  })

  it('skips an item it does not know, and carries on', async () => {
    const store = fakeStore()
    const applied = new Set()
    const done = await applyPending([{ id: 'x', type: 'from_a_newer_version', at: 1 }, water('a', 2)], applied, store)
    expect(done.map(i => i.id)).toEqual(['a'])
    expect(applied.has('x')).toBe(true)
  })

  it('carries on past an item that fails to save', async () => {
    const store = fakeStore()
    store.saveWeightEntry.mockRejectedValueOnce(new Error('disk full'))
    const applied = new Set()
    const done = await applyPending([{ id: 'w', type: 'weight', at: 1, date: '2026-11-02', kg: 72.4 }, water('a', 2)], applied, store)
    expect(done.map(i => i.id)).toEqual(['a'])
    expect(applied.has('w')).toBe(true)
  })

  it('checks a weight before saving it', async () => {
    const store = fakeStore()
    expect(await applyItem({ id: 'w', type: 'weight', at: 1, date: '2026-11-02', kg: 5 }, store)).toBe(false)
    expect(await applyItem({ id: 'w', type: 'weight', at: 1, date: '2026-11-02', kg: 72.44 }, store)).toBe(true)
    expect(store.weights).toEqual([{ date: '2026-11-02', weight_kg: 72.4 }])
  })

  it('removes a drink the app already saved when undone on the widget', async () => {
    const store = fakeStore()
    await applyPending([water('a', 1), { id: 'u', type: 'water_undo', at: 2, date: '2026-11-02', target: 'a', ml: 250 }], new Set(), store)
    expect(store.water['2026-11-02']).toEqual([])
  })
})
