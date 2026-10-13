import { describe, it, expect } from 'vitest'
import {
  estimateWaterGoal, resolveWaterGoal, glassSize, waterTotals, goalMet, formatLitres, waterBadgeMetrics, mealDrinks,
  DEFAULT_GOAL_ML, DEFAULT_GLASS_ML,
} from '../hydration'

describe('estimateWaterGoal', () => {
  it('matches the worked example in docs/water_intake_logic.md for 70 kg', () => {
    // 70 × 27 = 1,890 → 1,900 · 70 × 30 = 2,100 · 70 × 32 = 2,240 → 2,250 (nearest 50 mL)
    expect(estimateWaterGoal(70)).toEqual({ targetMl: 2100, lowMl: 1900, highMl: 2250 })
  })

  it('rounds to the nearest 50 mL', () => {
    expect(estimateWaterGoal(101.3).targetMl).toBe(3050)   // 3,039
    expect(estimateWaterGoal(64.2).targetMl).toBe(1950)    // 1,926
  })

  it('gives no estimate without a usable weight', () => {
    for (const bad of [0, -5, NaN, Infinity, null, undefined, '70', true]) {
      expect(estimateWaterGoal(bad)).toBeNull()
    }
  })
})

describe('resolveWaterGoal', () => {
  it('estimates from weight by default', () => {
    expect(resolveWaterGoal({}, 80)).toMatchObject({ mode: 'auto', basis: 'weight', targetMl: 2400 })
  })

  it('falls back to the 2 L general guideline when no weight is logged', () => {
    expect(resolveWaterGoal({}, null)).toEqual({ mode: 'auto', basis: 'default', targetMl: DEFAULT_GOAL_ML })
  })

  it('uses the user\'s own goal when set, ignoring weight', () => {
    expect(resolveWaterGoal({ water_goal_mode: 'custom', water_goal_custom_ml: '1500' }, 100))
      .toEqual({ mode: 'custom', basis: 'custom', targetMl: 1500 })
  })

  it('ignores an unusable custom number and estimates instead', () => {
    expect(resolveWaterGoal({ water_goal_mode: 'custom', water_goal_custom_ml: '90000' }, 70).basis).toBe('weight')
    expect(resolveWaterGoal({ water_goal_mode: 'custom', water_goal_custom_ml: '' }, null).basis).toBe('default')
  })

  it('has no target at all when the goal is switched off', () => {
    expect(resolveWaterGoal({ water_goal_mode: 'off' }, 70)).toEqual({ mode: 'off', basis: 'off', targetMl: 0 })
  })
})

describe('glassSize and totals', () => {
  it('defaults to 250 mL and accepts a sensible custom size', () => {
    expect(glassSize({})).toBe(DEFAULT_GLASS_ML)
    expect(glassSize({ water_glass_ml: '300' })).toBe(300)
    expect(glassSize({ water_glass_ml: '5' })).toBe(DEFAULT_GLASS_ML)
  })

  it('counts every drink toward the total and reports water separately', () => {
    const entries = [{ ml: 250, kind: 'water' }, { ml: 500, kind: 'water' }, { ml: 150, kind: 'tea_coffee' }, { ml: 200, kind: 'milk' }]
    expect(waterTotals(entries)).toEqual({ totalMl: 1100, waterMl: 750, otherMl: 350, tappedMl: 1100, mealMl: 0 })
    expect(waterTotals([])).toEqual({ totalMl: 0, waterMl: 0, otherMl: 0, tappedMl: 0, mealMl: 0 })
  })

  it('formats litres without pointless decimals', () => {
    expect(formatLitres(1500)).toBe('1.5 L')
    expect(formatLitres(3000)).toBe('3.0 L')
    expect(formatLitres(1250)).toBe('1.25 L')
  })
})

describe('drinks logged in meals', () => {
  const diet = { meal_items: [
    { label: 'Coffee', mealType: 'breakfast', portions: 2, mlPerPortion: 150, time: '08:10' },
    { label: 'Idli', mealType: 'breakfast', portions: 3 },                       // food: no volume
    { label: 'Lemon juice', mealType: 'snacks', portions: 0.5, mlPerPortion: 200, time: '16:00' },
    { label: 'Tea', mealType: 'snacks', portions: 1, mlPerPortion: null },      // untagged
  ] }

  it('counts portions × mL for tagged items only', () => {
    expect(mealDrinks(diet)).toEqual([
      { label: 'Coffee', mealType: 'breakfast', time: '08:10', ml: 300 },
      { label: 'Lemon juice', mealType: 'snacks', time: '16:00', ml: 100 },
    ])
    expect(mealDrinks(null)).toEqual([])
    expect(mealDrinks({ meal_items: [] })).toEqual([])
  })

  it('adds meal drinks to tapped drinks without double storage', () => {
    const entries = [{ ml: 500, kind: 'water' }]
    expect(waterTotals(entries, diet)).toEqual({ totalMl: 900, waterMl: 500, otherMl: 400, tappedMl: 500, mealMl: 400 })
    expect(waterTotals([], diet).totalMl).toBe(400)
  })

  it('reaches the goal on meal drinks alone', () => {
    expect(goalMet({ date: '2026-10-14', goal_ml: 400, entries: [] }, diet)).toBe(true)
    expect(goalMet({ date: '2026-10-14', goal_ml: 401, entries: [] }, diet)).toBe(false)
  })

  it('counts a meal-only day for badges, including an early drink', () => {
    const days  = [{ date: '2026-10-14', goal_ml: 400, entries: [] }]
    const diets = [{ date: '2026-10-14', ...diet }]
    expect(waterBadgeMetrics(days, diets)).toMatchObject({ waterDaysLogged: 1, waterGoalDays: 1, waterEarlyDays: 1 })
    // without the diet log that day has nothing in it
    expect(waterBadgeMetrics(days, []).waterDaysLogged).toBe(0)
  })
})

describe('goalMet', () => {
  const day = (ml, goal) => ({ date: '2026-10-01', goal_ml: goal, entries: [{ ml, kind: 'water' }] })
  it('is met at or above the goal stored for that day', () => {
    expect(goalMet(day(2100, 2100))).toBe(true)
    expect(goalMet(day(2050, 2100))).toBe(false)
  })
  it('is never met on a day with no goal', () => {
    expect(goalMet(day(5000, 0))).toBe(false)
    expect(goalMet(null)).toBe(false)
  })
})

describe('waterBadgeMetrics', () => {
  const day = (date, ml, time = '10:00', goal = 2000) => ({ date, goal_ml: goal, entries: [{ ml, kind: 'water', time }] })

  it('counts goal days, the best run of consecutive days, and full weeks', () => {
    const days = [
      day('2026-10-05', 2000), day('2026-10-06', 2100), day('2026-10-07', 2000),   // Mon–Wed met
      day('2026-10-08', 900),                                                        // Thu missed
      day('2026-10-09', 2000), day('2026-10-10', 2000),                              // Fri–Sat met → 5 in the week
      day('2026-10-12', 2000, '07:30'),                                              // next Monday, early drink
    ]
    expect(waterBadgeMetrics(days)).toEqual({
      waterDaysLogged: 7, waterGoalDays: 6, waterBestStreak: 3,
      waterBestWeek: 5, waterFullWeeks: 1, waterEarlyDays: 1,
    })
  })

  it('does not reward drinking beyond the goal — one day is one day', () => {
    expect(waterBadgeMetrics([day('2026-10-05', 9000)]).waterGoalDays).toBe(1)
  })

  it('is all zeros with nothing logged', () => {
    expect(waterBadgeMetrics([])).toEqual({
      waterDaysLogged: 0, waterGoalDays: 0, waterBestStreak: 0, waterBestWeek: 0, waterFullWeeks: 0, waterEarlyDays: 0,
    })
  })
})
