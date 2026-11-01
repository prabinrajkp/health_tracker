import { describe, it, expect } from 'vitest'
import { isConsecutive, longestRun, toSickSet, activeDates, findMissedDays, describeDays } from '../sickDays'
import { waterBadgeMetrics } from '../hydration'

describe('isConsecutive', () => {
  it('is true for neighbouring days', () => {
    expect(isConsecutive('2026-11-01', '2026-11-02')).toBe(true)
    expect(isConsecutive('2026-10-31', '2026-11-01')).toBe(true)
  })

  it('is false across a missed day', () => {
    expect(isConsecutive('2026-11-01', '2026-11-03')).toBe(false)
  })

  it('carries across sick days, including several in a row', () => {
    expect(isConsecutive('2026-11-01', '2026-11-03', toSickSet(['2026-11-02']))).toBe(true)
    expect(isConsecutive('2026-11-01', '2026-11-05', toSickSet(['2026-11-02', '2026-11-03', '2026-11-04']))).toBe(true)
  })

  it('is false when only some of the gap was sick', () => {
    expect(isConsecutive('2026-11-01', '2026-11-04', toSickSet(['2026-11-02']))).toBe(false)
  })

  it('is false for the same day or the wrong order', () => {
    expect(isConsecutive('2026-11-02', '2026-11-02')).toBe(false)
    expect(isConsecutive('2026-11-03', '2026-11-02')).toBe(false)
  })
})

describe('longestRun', () => {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07']

  it('counts the longest unbroken run', () => {
    expect(longestRun(dates)).toBe(3)
    expect(longestRun([])).toBe(0)
    expect(longestRun(['2026-11-01'])).toBe(1)
  })

  it('pauses across sick days without counting them', () => {
    // 2 days, sick on the 3rd and 4th, then 3 more: a run of 5, not 7
    expect(longestRun(dates, toSickSet(['2026-11-03', '2026-11-04']))).toBe(5)
  })
})

describe('activeDates', () => {
  it('counts meals, sleep and exercise, but not synced steps', () => {
    const active = activeDates({
      dietLogs:    [{ date: 'a', meal_items: [{ label: 'Idli' }] }, { date: 'x', meal_items: [] }],
      sleepLogs:   [{ date: 'b', sleep_time: '23:00' }, { date: 'y', sleep_time: '' }],
      workoutLogs: [{ date: 'c', exercise_done: true }, { date: 'd', post_dinner_walk: true }, { date: 'z', steps: 9000 }],
    })
    expect([...active].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('findMissedDays', () => {
  const TODAY = '2026-11-05'   // a Thursday
  const active = (...d) => new Set(d)

  it('finds the empty days just before today', () => {
    expect(findMissedDays(TODAY, active('2026-11-02'))).toEqual({ days: ['2026-11-03', '2026-11-04'], gapStart: '2026-11-03' })
  })

  it('finds nothing when yesterday was logged', () => {
    expect(findMissedDays(TODAY, active('2026-11-04')).days).toEqual([])
  })

  it('offers nothing to someone who has never logged anything', () => {
    expect(findMissedDays(TODAY, active()).days).toEqual([])
    expect(findMissedDays(TODAY, active(TODAY)).days).toEqual([])
  })

  it('stops at a day already marked sick', () => {
    const r = findMissedDays(TODAY, active('2026-11-01'), toSickSet(['2026-11-03']))
    expect(r.days).toEqual(['2026-11-04'])
    expect(findMissedDays(TODAY, active('2026-11-01'), toSickSet(['2026-11-04'])).days).toEqual([])
  })

  it('offers at most 7 days, but remembers where the gap really began', () => {
    const r = findMissedDays(TODAY, active('2026-10-20'))
    expect(r.days).toHaveLength(7)
    expect(r.days[6]).toBe('2026-11-04')
    expect(r.gapStart).toBe('2026-10-21')
  })

  it('keeps the same gap start as the gap grows, so "No" stays answered', () => {
    const on = (today) => findMissedDays(today, active('2026-11-02')).gapStart
    expect(on('2026-11-05')).toBe(on('2026-11-08'))
  })
})

describe('describeDays', () => {
  it('reads naturally', () => {
    expect(describeDays(['2026-11-03'])).toBe('Tue')
    expect(describeDays(['2026-11-03', '2026-11-04'])).toBe('Tue and Wed')
    expect(describeDays(['2026-11-02', '2026-11-03', '2026-11-04'])).toBe('Mon to Wed')
    expect(describeDays(Array(7).fill('2026-11-03'))).toBe('the last 7 days')
    expect(describeDays([])).toBe('')
  })
})

describe('water badges on sick days', () => {
  const day = (date, ml = 2000, goal = 2000, time = '07:30') => ({ date, goal_ml: goal, entries: [{ ml, kind: 'water', time }] })

  it('carries the water streak across a sick day without counting it', () => {
    const days = [day('2026-11-02'), day('2026-11-03'), day('2026-11-04', 500, 0), day('2026-11-05')]
    const m = waterBadgeMetrics(days, [], toSickSet(['2026-11-04']))
    expect(m).toMatchObject({ waterDaysLogged: 3, waterGoalDays: 3, waterBestStreak: 3, waterEarlyDays: 3 })
  })

  it('breaks across an unmarked empty day, as before', () => {
    expect(waterBadgeMetrics([day('2026-11-02'), day('2026-11-04')]).waterBestStreak).toBe(1)
  })
})
