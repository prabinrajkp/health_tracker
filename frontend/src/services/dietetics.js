/**
 * Dietetics — calorie and macronutrient targets.
 * Ported from py_abacus abacus/compute_dietetics.py, keeping its constants intact:
 * revised Harris-Benedict BMR, PAC multiplier, BMI-driven deficit, Indian-standard
 * macro splits (protein 10-15%, carbs 50-60%, fat 20-30% of energy).
 */

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

/**
 * ccc = maintenance calories, ncc = target calories after the BMI-driven adjustment.
 * Deficit defaults to 500 kcal (py_abacus); the rate-of-loss picker overrides it.
 */
export function getCalorieDetails({ age, gender, heightCm, weightKg, pac, deficitKcal = DEFAULT_DEFICIT }) {
  const bmr = computeBmr(age, gender, heightCm, weightKg)
  if (bmr === null || !pac) return null

  const bmi = computeBmi(heightCm, weightKg)
  const ccc = pac * bmr

  let ncc = ccc
  if (bmi > 23)        ncc = ccc - deficitKcal
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
export function computeDietetics({ age, gender, heightCm, weightKg, pac, deficitKcal = DEFAULT_DEFICIT }) {
  const details = getCalorieDetails({ age, gender, heightCm, weightKg, pac, deficitKcal })
  if (!details) return null

  const { bmr, bmi, ccc, ncc } = details
  const range = (minPct, maxPct, kcalPerGram) => ({
    min: Math.round((ncc * minPct) / kcalPerGram),
    max: Math.round((ncc * maxPct) / kcalPerGram),
  })

  return {
    activity_level: getPacLevel(pac),
    ideal_weight:   idealWeight(heightCm),
    bmi,
    bmr,
    maintenance:    ccc,
    energy:         ncc,
    proteins:       range(0.10, 0.15, 4),
    carbs:          range(0.50, 0.60, 4),
    fat:            range(0.20, 0.30, 9),
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
export function dieteticsFromConfig(config, weightKg) {
  if (!config || !weightKg) return null
  const heightCm = Number(config.height_cm)
  const age      = ageFromBirthYear(config.birth_year)
  const gender   = config.gender
  if (!heightCm || !age || !gender) return null

  const pac  = ACTIVITY_PAC[config.activity_level] ?? ACTIVITY_PAC.lightly_active
  const rate = LOSS_RATES.find(r => r.id === config.loss_rate)
  return computeDietetics({
    age, gender, heightCm, weightKg, pac,
    deficitKcal: rate ? rate.deficit : DEFAULT_DEFICIT,
  })
}
