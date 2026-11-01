/**
 * Dietetics — calorie and macronutrient targets.
 * Ported from py_abacus abacus/compute_dietetics.py, keeping its constants intact:
 * revised Harris-Benedict BMR, PAC multiplier, BMI-driven deficit, Indian-standard
 * macro splits (protein 10-15%, carbs 50-60%, fat 20-30% of energy).
 */

import { GAIN_PACES, ADULT_AGE, planOn, healthyRange } from './bodyGoal'

// Keys match the ids Onboarding already stores, so onboarding_activity prefills cleanly.
export const ACTIVITY_PAC = {
  sedentary:         1.2,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
  athlete:           1.9,
}

// Rate of loss (kg/week) → daily kcal deficit. 0.5 kg/wk reproduces py_abacus.
export const LOSS_RATES = [
  { id: 'gentle',     label: 'Gentle',     kgPerWeek: 0.25, deficit: 275 },
  { id: 'standard',   label: 'Standard',   kgPerWeek: 0.5,  deficit: 500 },
  { id: 'aggressive', label: 'Aggressive', kgPerWeek: 0.75, deficit: 825 },
]

export const DEFAULT_DEFICIT = 500

const isMale = (gender) => gender === 'm' || gender === 'male'

// g/kg of body weight, once a goal has been chosen. `auto` keeps the energy split below.
const PROTEIN_G_PER_KG = {
  default: { min: 0.83, max: 1.2 },   // the low end is the ICMR-NIN 2024 figure
  lose:    { min: 1.0,  max: 1.4 },
  muscle:  { min: 1.6,  max: 2.0 },
}

export function computeBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

// Mid-point of the healthy range under the BMI>23 overweight cut-off py_abacus uses.
export function idealWeight(heightCm) {
  if (!heightCm) return null
  const m = heightCm / 100
  return Math.round(22 * m * m * 10) / 10
}

export function computeBmr(age, gender, heightCm, weightKg) {
  if (!age || !heightCm || !weightKg) return null
  const bmr = isMale(gender)
    ? 66.5 + 13.75 * weightKg + 5.003 * heightCm - 6.755 * age
    : 655.1 + 9.563 * weightKg + 1.850 * heightCm - 4.676 * age
  return Math.round(bmr)
}

export function getPacLevel(pac) {
  if (pac <= 1.2)    return 'Sedentary'
  if (pac < 1.375)   return 'Light'
  if (pac < 1.55)    return 'Moderate'
  if (pac < 1.725)   return 'Heavy'
  return 'Very Heavy'
}

// The signed daily calories a chosen goal asks for: minus to lose, plus to gain.
export function goalKcal(plan) {
  if (plan?.goal === 'lose') return -(LOSS_RATES.find(r => r.id === plan.pace)?.deficit ?? DEFAULT_DEFICIT)
  if (plan?.goal === 'gain') return GAIN_PACES.find(r => r.id === plan.pace)?.surplus ?? GAIN_PACES[0].surplus
  return 0
}

/**
 * ccc = maintenance calories, ncc = target calories. With a chosen goal the target
 * follows it. Without one (`auto`) it follows BMI: deficit defaults to 500 kcal
 * (py_abacus) and the rate-of-loss picker overrides it.
 */
export function getCalorieDetails({ age, gender, heightCm, weightKg, pac, deficitKcal = DEFAULT_DEFICIT, plan = null }) {
  const bmr = computeBmr(age, gender, heightCm, weightKg)
  if (bmr === null || !pac) return null

  const bmi = computeBmi(heightCm, weightKg)
  const ccc = pac * bmr + (plan?.maintenanceOffset || 0)

  let ncc = ccc
  if (plan)            ncc = ccc + goalKcal(plan)
  else if (bmi > 23)   ncc = ccc - deficitKcal
  else if (bmi < 18.5) ncc = ccc + 500

  // Never prescribe below the safe floor.
  const floor = isMale(gender) ? 1500 : 1200
  if (ncc <= floor) ncc = floor

  return { pac, bmr, bmi, ccc: Math.round(ccc), ncc: Math.round(ncc) }
}

/**
 * Full target set for display. Returns null when body metrics are incomplete —
 * callers treat null as "targets unavailable" and skip anything that depends on them.
 */
export function computeDietetics({ age, gender, heightCm, weightKg, pac, deficitKcal = DEFAULT_DEFICIT, plan = null }) {
  const details = getCalorieDetails({ age, gender, heightCm, weightKg, pac, deficitKcal, plan })
  if (!details) return null

  const { bmr, bmi, ccc, ncc } = details
  const range = (minPct, maxPct, kcalPerGram) => ({
    min: Math.round((ncc * minPct) / kcalPerGram),
    max: Math.round((ncc * maxPct) / kcalPerGram),
  })

  // A chosen goal sets protein by body weight; fat stays a share of energy and
  // carbs take what is left. Without one, the original energy split stands.
  let proteins = range(0.10, 0.15, 4)
  let carbs    = range(0.50, 0.60, 4)
  const fat    = range(0.20, 0.30, 9)
  if (plan) {
    const g = plan.muscle ? PROTEIN_G_PER_KG.muscle : plan.goal === 'lose' ? PROTEIN_G_PER_KG.lose : PROTEIN_G_PER_KG.default
    proteins = { min: Math.round(g.min * weightKg), max: Math.round(g.max * weightKg) }
    carbs = {
      min: Math.max(0, Math.round((ncc - proteins.max * 4 - fat.max * 9) / 4)),
      max: Math.max(0, Math.round((ncc - proteins.min * 4 - fat.min * 9) / 4)),
    }
  }

  return {
    activity_level: getPacLevel(pac),
    ideal_weight:   idealWeight(heightCm),
    healthy_range:  healthyRange(heightCm),
    bmi,
    bmr,
    pac,
    heightCm,
    weightKg,
    maintenance:    ccc,
    energy:         ncc,
    netGoal:        ncc - ccc,      // what the day's net should come to
    goal:           plan?.goal ?? 'auto',
    burnOffset:     plan?.burnOffset || 0,
    proteins,
    carbs,
    fat,
    fibre:          isMale(gender) ? { min: 30, max: 50 } : { min: 25, max: 40 },
  }
}

/** Age from a birth year, as a whole number of years. */
export function ageFromBirthYear(birthYear, now = new Date()) {
  const y = Number(birthYear)
  if (!y || y < 1900) return null
  const age = now.getFullYear() - y
  return age > 0 && age < 120 ? age : null
}

/**
 * Builds the dietetics profile from stored config plus a weight reading.
 * `config` is the flat {key: value} map of tracker_config rows.
 */
export function dieteticsFromConfig(config, weightKg, date) {
  if (!config || !weightKg) return null
  const heightCm = Number(config.height_cm)
  const age      = ageFromBirthYear(config.birth_year)
  const gender   = config.gender
  if (!heightCm || !age || !gender) return null
  if (age < ADULT_AGE) return null   // the formula and BMI cut-offs are for adults

  const pac  = ACTIVITY_PAC[config.activity_level] ?? ACTIVITY_PAC.lightly_active
  const rate = LOSS_RATES.find(r => r.id === config.loss_rate)
  return computeDietetics({
    age, gender, heightCm, weightKg, pac,
    deficitKcal: rate ? rate.deficit : DEFAULT_DEFICIT,
    plan: planOn(config, date),
  })
}

export const isMinor = (config) => {
  const age = ageFromBirthYear(config?.birth_year)
  return age != null && age < ADULT_AGE
}
