// Daily fluid goal and totals. Logic follows docs/water_intake_logic.md.
//
// The goal is an ESTIMATE of beverage intake for a healthy adult, not a
// clinical requirement: 27–32 mL per kg is the ICMR–NIN (2020) sedentary
// reference range and 30 mL/kg is this app's single-number fallback inside it.
// Everything here is plain arithmetic done on the phone — the app is offline,
// so nothing about water goes through a network call.

export const ML_PER_KG_LOW    = 27
export const ML_PER_KG_HIGH   = 32
export const ML_PER_KG_TARGET = 30
export const DEFAULT_GOAL_ML  = 2000   // ICMR–NIN 2024 general guideline, used when no weight is logged
export const DEFAULT_GLASS_ML = 250
export const GLASS_SIZES      = [150, 200, 250, 300, 350]
export const GOAL_LIMITS      = { min: 500, max: 6000 }

// What can be tapped in as a drink. Tea, coffee, milk and juice are logged
// as food in a meal and counted from there (see mealDrinks), so the only
// direct entries are water and a catch-all.
export const DRINK_KINDS = [
  { id: 'water', label: 'Water' },
  { id: 'other', label: 'Other drink' },
]
// Names for every kind ever stored, including the two retired in v4.34.
export const DRINK_KIND_LABELS = {
  water: 'Water', other: 'Other drink', tea_coffee: 'Tea / coffee', milk: 'Milk',
}

const round50 = (ml) => Math.round(ml / 50) * 50
const validWeight = (kg) => typeof kg === 'number' && Number.isFinite(kg) && kg > 0

// Weight-based estimate, or null when there is no usable weight.
export function estimateWaterGoal(weightKg) {
  if (!validWeight(weightKg)) return null
  return {
    targetMl: round50(weightKg * ML_PER_KG_TARGET),
    lowMl:    round50(weightKg * ML_PER_KG_LOW),
    highMl:   round50(weightKg * ML_PER_KG_HIGH),
  }
}

// The goal in force, from the user's settings and latest weight.
//   mode 'auto'    estimate from weight, or the 2 L general guideline without one
//   mode 'custom'  the user's own number (for example a clinician's advice)
//   mode 'off'     no goal at all — drinks can still be logged
export function resolveWaterGoal(config = {}, weightKg = null) {
  const mode = ['custom', 'off'].includes(config.water_goal_mode) ? config.water_goal_mode : 'auto'
  if (mode === 'off') return { mode, basis: 'off', targetMl: 0 }

  if (mode === 'custom') {
    const custom = Number(config.water_goal_custom_ml)
    if (Number.isFinite(custom) && custom >= GOAL_LIMITS.min && custom <= GOAL_LIMITS.max) {
      return { mode, basis: 'custom', targetMl: round50(custom) }
    }
  }

  const est = estimateWaterGoal(weightKg)
  if (est) return { mode: 'auto', basis: 'weight', ...est }
  return { mode: 'auto', basis: 'default', targetMl: DEFAULT_GOAL_ML }
}

export function glassSize(config = {}) {
  const ml = Number(config.water_glass_ml)
  return Number.isFinite(ml) && ml >= 50 && ml <= 1000 ? ml : DEFAULT_GLASS_ML
}

// Drinks logged as food in the day's meals. A meal item counts when it carries
// `mlPerPortion`, which is copied from the food when it is logged — so tagging
// a food later never rewrites days already logged.
export function mealDrinks(diet) {
  const out = []
  for (const item of diet?.meal_items || []) {
    const per = Number(item.mlPerPortion)
    if (!Number.isFinite(per) || per <= 0) continue
    const ml = Math.round(per * (Number(item.portions) || 1))
    if (ml > 0) out.push({ label: item.label, mealType: item.mealType, time: item.time || null, ml })
  }
  return out
}

// The day's total: drinks tapped in, plus drinks logged in meals. Nothing from
// meals is copied into the drinks log, so the two can never drift apart.
export function waterTotals(entries = [], diet = null) {
  let tappedMl = 0, waterMl = 0
  for (const e of entries || []) {
    const ml = Number(e.ml) || 0
    tappedMl += ml
    if (e.kind === 'water' || !e.kind) waterMl += ml
  }
  const mealMl  = mealDrinks(diet).reduce((sum, d) => sum + d.ml, 0)
  const totalMl = tappedMl + mealMl
  return { totalMl, waterMl, otherMl: totalMl - waterMl, tappedMl, mealMl }
}

// A day counts as "goal met" against the goal that was in force that day,
// which is stored on the day's record so later weight changes don't rewrite history.
export const goalMet = (day, diet = null) =>
  !!day && day.goal_ml > 0 && waterTotals(day.entries, diet).totalMl >= day.goal_ml

export const formatLitres = (ml) => {
  const l = ml / 1000
  return `${Number.isInteger(l * 10) ? l.toFixed(1) : l.toFixed(2)} L`
}

// Counts for the water badges, from every day's drinks record and diet log
// (any order). A day is "logged" if anything was drunk, tapped in or in a meal.
export function waterBadgeMetrics(days = [], dietLogs = []) {
  const dietByDate = Object.fromEntries((dietLogs || []).filter(d => d?.date).map(d => [d.date, d]))
  const logged = [...(days || [])]
    .filter(d => d?.date && ((d.entries || []).length > 0 || mealDrinks(dietByDate[d.date]).length > 0))
    .sort((a, b) => a.date.localeCompare(b.date))
  const metDates = logged.filter(d => goalMet(d, dietByDate[d.date])).map(d => d.date)

  let bestStreak = 0, run = 0, prev = null
  for (const date of metDates) {
    const gap = prev ? Math.round((new Date(date + 'T00:00:00') - new Date(prev + 'T00:00:00')) / 86400000) : null
    run = gap === 1 ? run + 1 : 1
    if (run > bestStreak) bestStreak = run
    prev = date
  }

  // Weeks (Monday start) with the goal met on five or more days
  const perWeek = {}
  for (const date of metDates) {
    const d = new Date(date + 'T00:00:00')
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`
    perWeek[key] = (perWeek[key] || 0) + 1
  }
  const counts = Object.values(perWeek)

  const before9 = (time) => !!time && Number(time.split(':')[0]) < 9
  const earlyDays = logged.filter(d =>
    (d.entries || []).some(e => before9(e.time)) || mealDrinks(dietByDate[d.date]).some(m => before9(m.time))).length

  return {
    waterDaysLogged: logged.length,
    waterGoalDays:   metDates.length,
    waterBestStreak: bestStreak,
    waterBestWeek:   counts.length ? Math.max(...counts) : 0,
    waterFullWeeks:  counts.filter(n => n >= 5).length,
    waterEarlyDays:  earlyDays,
  }
}
