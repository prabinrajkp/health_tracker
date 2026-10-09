import { describe, it, expect } from 'vitest'
import {
  computeBmr, computeBmi, idealWeight, getPacLevel,
  getCalorieDetails, computeDietetics, ageFromBirthYear, dieteticsFromConfig,
} from '../dietetics.js'

// Reference values computed by hand from py_abacus abacus/compute_dietetics.py

describe('computeBmr — revised Harris-Benedict', () => {
  it('male: 66.5 + 13.75w + 5.003h - 6.755a', () => {
    // 80 kg, 175 cm, 35 y → 66.5 + 1100 + 875.525 - 236.425 = 1805.6
    expect(computeBmr(35, 'male', 175, 80)).toBe(1806)
  })

  it('female: 655.1 + 9.563w + 1.850h - 4.676a', () => {
    // 65 kg, 162 cm, 30 y → 655.1 + 621.595 + 299.7 - 140.28 = 1436.115
    expect(computeBmr(30, 'female', 162, 65)).toBe(1436)
  })

  it("accepts 'm' as male, matching py_abacus", () => {
    expect(computeBmr(35, 'm', 175, 80)).toBe(computeBmr(35, 'male', 175, 80))
  })

  it('returns null on incomplete metrics', () => {
    expect(computeBmr(null, 'male', 175, 80)).toBeNull()
    expect(computeBmr(35, 'male', null, 80)).toBeNull()
    expect(computeBmr(35, 'male', 175, null)).toBeNull()
  })
})

describe('computeBmi / idealWeight', () => {
  it('bmi = kg / m^2', () => {
    expect(computeBmi(175, 80)).toBe(26.1)
    expect(computeBmi(162, 65)).toBe(24.8)
  })

  it('ideal weight sits at BMI 22', () => {
    expect(idealWeight(175)).toBe(67.4)   // 22 * 1.75^2 = 67.375
  })
})

describe('getPacLevel — py_abacus thresholds', () => {
  it('maps each band', () => {
    expect(getPacLevel(1.2)).toBe('Sedentary')
    expect(getPacLevel(1.3)).toBe('Light')
    expect(getPacLevel(1.375)).toBe('Moderate')
    expect(getPacLevel(1.55)).toBe('Heavy')
    expect(getPacLevel(1.725)).toBe('Very Heavy')
    expect(getPacLevel(1.9)).toBe('Very Heavy')
  })
})

describe('getCalorieDetails — BMI-driven adjustment', () => {
  const male = { age: 35, gender: 'male', heightCm: 175, weightKg: 80, pac: 1.375 }

  it('subtracts the deficit when BMI > 23', () => {
    const r = getCalorieDetails(male)
    expect(r.bmr).toBe(1806)
    expect(r.ccc).toBe(Math.round(1.375 * 1806))   // 2483
    expect(r.ncc).toBe(r.ccc - 500)                 // default py_abacus deficit
  })

  it('honours a custom deficit from the rate picker', () => {
    expect(getCalorieDetails({ ...male, deficitKcal: 275 }).ncc)
      .toBe(getCalorieDetails(male).ncc + 225)
  })

  it('adds 500 when BMI < 18.5', () => {
    // 50 kg at 175 cm → BMI 16.3
    const r = getCalorieDetails({ ...male, weightKg: 50 })
    expect(r.bmi).toBeLessThan(18.5)
    expect(r.ncc).toBe(r.ccc + 500)
  })

  it('leaves maintenance untouched in the healthy band', () => {
    // 65 kg at 175 cm → BMI 21.2
    const r = getCalorieDetails({ ...male, weightKg: 65 })
    expect(r.ncc).toBe(r.ccc)
  })

  it('floors at 1500 kcal for men', () => {
    const r = getCalorieDetails({ age: 70, gender: 'male', heightCm: 160, weightKg: 62, pac: 1.2 })
    expect(r.ncc).toBeGreaterThanOrEqual(1500)
  })

  it('floors at 1200 kcal for women', () => {
    const r = getCalorieDetails({ age: 70, gender: 'female', heightCm: 150, weightKg: 55, pac: 1.2 })
    expect(r.ncc).toBeGreaterThanOrEqual(1200)
  })

  it('returns null without a PAC or metrics', () => {
    expect(getCalorieDetails({ ...male, pac: null })).toBeNull()
    expect(getCalorieDetails({ ...male, heightCm: null })).toBeNull()
  })
})

describe('computeDietetics — Indian-standard macro splits', () => {
  const profile = { age: 35, gender: 'male', heightCm: 175, weightKg: 80, pac: 1.375 }

  it('splits protein 10-15%, carbs 50-60%, fat 20-30% of energy', () => {
    const d = computeDietetics(profile)
    const e = d.energy
    expect(d.proteins).toEqual({ min: Math.round(e * 0.10 / 4), max: Math.round(e * 0.15 / 4) })
    expect(d.carbs).toEqual({    min: Math.round(e * 0.50 / 4), max: Math.round(e * 0.60 / 4) })
    expect(d.fat).toEqual({      min: Math.round(e * 0.20 / 9), max: Math.round(e * 0.30 / 9) })
  })

  it('sets fibre by gender', () => {
    expect(computeDietetics(profile).fibre).toEqual({ min: 30, max: 50 })
    expect(computeDietetics({ ...profile, gender: 'female' }).fibre).toEqual({ min: 25, max: 40 })
  })

  it('reports the activity label and ideal weight', () => {
    const d = computeDietetics(profile)
    expect(d.activity_level).toBe('Moderate')
    expect(d.ideal_weight).toBe(67.4)
  })

  it('returns null on incomplete metrics', () => {
    expect(computeDietetics({ ...profile, heightCm: null })).toBeNull()
  })
})

describe('ageFromBirthYear', () => {
  const now = new Date('2026-07-27')
  it('computes whole years', () => {
    expect(ageFromBirthYear(1991, now)).toBe(35)
  })
  it('rejects nonsense', () => {
    expect(ageFromBirthYear('', now)).toBeNull()
    expect(ageFromBirthYear(1800, now)).toBeNull()
    expect(ageFromBirthYear(2030, now)).toBeNull()
  })
})

describe('dieteticsFromConfig', () => {
  const config = {
    height_cm: '175', birth_year: String(new Date().getFullYear() - 35),
    gender: 'male', activity_level: 'moderately_active', loss_rate: 'standard',
  }

  it('builds targets from stored config', () => {
    const d = dieteticsFromConfig(config, 80)
    expect(d.activity_level).toBe('Heavy')   // moderate → PAC 1.55 → "Heavy" band
    expect(d.energy).toBeGreaterThan(0)
  })

  it('returns null when metrics are missing or no weight is logged', () => {
    expect(dieteticsFromConfig({ ...config, height_cm: '' }, 80)).toBeNull()
    expect(dieteticsFromConfig({ ...config, gender: '' }, 80)).toBeNull()
    expect(dieteticsFromConfig(config, null)).toBeNull()
  })

  it('applies the chosen rate of loss', () => {
    const gentle   = dieteticsFromConfig({ ...config, loss_rate: 'gentle' }, 80)
    const standard = dieteticsFromConfig({ ...config, loss_rate: 'standard' }, 80)
    expect(gentle.energy).toBeGreaterThan(standard.energy)
  })
})
