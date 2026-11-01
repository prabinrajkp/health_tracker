import { describe, it, expect } from 'vitest'
import { findPatterns, MIN_DAYS_EACH_SIDE } from '../nudgePatterns.js'

const date = (i) => `2026-10-${String(i + 1).padStart(2, '0')}`
const base = (i, over) => ({ date: date(i), sick: false, dinnerMin: null, bedMin: null, breakfast: false, walk: false, steps: 0, dietScore: null, sleepScore: null, screenHours: 0, sleepHours: 0, ...over })

describe('findPatterns', () => {
  const breakfastDays = (n, gap = 10) => Array.from({ length: n * 2 }, (_, i) => base(i, { breakfast: i % 2 === 0, dietScore: i % 2 === 0 ? 20 + gap : 20 }))

  it('finds a clear pattern and says how many days it rests on', () => {
    const [p] = findPatterns(breakfastDays(6))
    expect(p.id).toBe('breakfast_diet')
    expect(p.facts).toMatchObject({ days_with_breakfast: 6, avg_diet_score_with: 30, avg_diet_score_without: 20 })
  })
  it('says nothing below the minimum days on either side', () => {
    expect(findPatterns(breakfastDays(MIN_DAYS_EACH_SIDE - 1))).toEqual([])
  })
  it('says nothing when the gap is too small to be worth saying', () => {
    expect(findPatterns(breakfastDays(8, 2))).toEqual([])
  })
  it('says nothing when the habit goes with the worse result', () => {
    expect(findPatterns(breakfastDays(8, -6))).toEqual([])
  })
  it('leaves sick days out of the count', () => {
    const days = breakfastDays(5).map((d, i) => (i < 2 ? { ...d, sick: true } : d))
    expect(findPatterns(days)).toEqual([])
  })
  it('never says "because"', () => {
    const days = Array.from({ length: 28 }, (_, i) => base(i, {
      breakfast: i % 2 === 0, dietScore: i % 2 === 0 ? 30 : 20,
      dinnerMin: i % 2 === 0 ? 19 * 60 : 21 * 60, sleepScore: i % 2 === 1 ? 28 : 18,
      walk: i % 2 === 0, bedMin: i % 2 === 1 ? 22 * 60 : 23 * 60 + 30, steps: i % 2 === 1 ? 9000 : 5000,
      screenHours: i % 2 === 1 ? 0 : 2, sleepHours: 7,
    }))
    const found = findPatterns(days)
    expect(found.length).toBeGreaterThan(1)
    for (const p of found) expect(`${p.title} ${p.body} ${p.purpose}`).not.toMatch(/because/i)
  })
})
