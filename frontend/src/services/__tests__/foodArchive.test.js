import { describe, it, expect } from 'vitest'
import { buildFoodUsage, foodStatus, splitFoods, ARCHIVE_AFTER_DAYS } from '../foodArchive'

const TODAY = '2026-10-12'
const log = (date, ...items) => ({ date, meal_items: items })
const item = (foodId, label) => ({ foodId, label, mealType: 'lunch', portions: 1 })

describe('buildFoodUsage', () => {
  it('keeps the most recent date each food was logged, by id and by name', () => {
    const usage = buildFoodUsage([
      log('2026-10-01', item('a', 'Dal'), item('b', 'Rice')),
      log('2026-10-09', item('a', 'Dal')),
      log('2026-09-20', item('a', 'Dal')),
    ])
    expect(usage.byId).toEqual({ a: '2026-10-09', b: '2026-10-01' })
    expect(usage.byLabel).toEqual({ dal: '2026-10-09', rice: '2026-10-01' })
  })

  it('copes with empty and malformed logs', () => {
    expect(buildFoodUsage([])).toEqual({ byId: {}, byLabel: {} })
    expect(buildFoodUsage([{ date: '2026-10-01' }, {}, null])).toEqual({ byId: {}, byLabel: {} })
  })
})

describe('foodStatus', () => {
  const usage = buildFoodUsage([
    log('2026-10-12', item('today', 'Idli')),
    log('2026-10-05', item('week', 'Fish curry')),      // exactly 7 days ago
    log('2026-10-04', item('eight', 'Pizza')),          // 8 days ago
    log('2026-09-01', { label: 'Old Upma' }),           // logged before foods had ids
  ])

  it('is active when logged today', () => {
    expect(foodStatus({ id: 'today', label: 'Idli' }, usage, TODAY)).toEqual({ lastUsed: TODAY, idleDays: 0, archived: false })
  })

  it('keeps a once-a-week food: 7 days idle is still active', () => {
    expect(ARCHIVE_AFTER_DAYS).toBe(7)
    expect(foodStatus({ id: 'week', label: 'Fish curry' }, usage, TODAY).archived).toBe(false)
  })

  it('archives on the 8th idle day', () => {
    expect(foodStatus({ id: 'eight', label: 'Pizza' }, usage, TODAY)).toMatchObject({ idleDays: 8, archived: true })
  })

  it('archives a food that has never been logged and has no dates', () => {
    expect(foodStatus({ id: 'never', label: 'Shawarma' }, usage, TODAY)).toEqual({ lastUsed: null, idleDays: null, archived: true })
  })

  it('gives a newly added food a full week before archiving it', () => {
    const fresh = { id: 'new', label: 'Quinoa', createdAt: '2026-10-10T08:00:00' }
    expect(foodStatus(fresh, usage, TODAY).archived).toBe(false)
    expect(foodStatus(fresh, usage, '2026-10-18').archived).toBe(true)
  })

  it('restoring a food keeps it for another week', () => {
    const restored = { id: 'eight', label: 'Pizza', revivedAt: '2026-10-11T21:00:00' }
    expect(foodStatus(restored, usage, TODAY)).toMatchObject({ lastUsed: '2026-10-04', archived: false })
    expect(foodStatus(restored, usage, '2026-10-19').archived).toBe(true)
  })

  it('matches by name when the logged item has no food id', () => {
    expect(foodStatus({ id: 'x', label: 'old upma' }, usage, '2026-09-05')).toMatchObject({ lastUsed: '2026-09-01', archived: false })
  })

  it('treats everything as archived-by-date only once usage is known', () => {
    // No usage yet (still loading) and no dates → reported archived; callers show the full list until usage loads
    expect(foodStatus({ id: 'a', label: 'Dal' }, null, TODAY).archived).toBe(true)
  })
})

describe('splitFoods', () => {
  it('keeps active foods in order and lists archived ones most recently used first', () => {
    const foods = [
      { id: '1', label: 'Zucchini' },                       // never logged
      { id: '2', label: 'Dal' },                            // active
      { id: '3', label: 'Pizza' },                          // archived, used Sep 28
      { id: '4', label: 'Apple' },                          // never logged
      { id: '5', label: 'Burger' },                         // archived, used Oct 1
      { id: '6', label: 'Egg' },                            // active
    ]
    const usage = buildFoodUsage([
      log('2026-10-11', item('2', 'Dal'), item('6', 'Egg')),
      log('2026-09-28', item('3', 'Pizza')),
      log('2026-10-01', item('5', 'Burger')),
    ])
    const { active, archived } = splitFoods(foods, usage, TODAY)
    expect(active.map(a => a.food.label)).toEqual(['Dal', 'Egg'])
    expect(archived.map(a => a.food.label)).toEqual(['Burger', 'Pizza', 'Apple', 'Zucchini'])
  })
})
