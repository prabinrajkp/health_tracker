function parseHM(timeStr) {
  if (!timeStr) return [0, 0]
  const parts = timeStr.split(':').map(Number)
  return [parts[0] || 0, parts[1] || 0]
}

// New meal_items scoring: proportional up to ideal, deduction above ideal
function calcMealItemsScore(diet) {
  const items = diet?.meal_items || []
  if (!items.length) return null  // null → fall through to legacy path
  // If no items carry point values (e.g. old default-seeded items), fall back to legacy
  if (items.every(i => !i.pointsPerPortion)) return null

  const OVERAGE = 0.5  // each portion over ideal costs 50% of pointsPerPortion
  let score = 0

  for (const item of items) {
    const ppp      = item.pointsPerPortion || 0
    const portions = item.portions || 1
    const ip       = item.idealPortions   // may be undefined for old items

    if (item.category === 'bad' || ppp < 0) {
      score += portions * ppp  // always negative, scales with portions
    } else if (ip && ip > 0) {
      score += Math.min(portions, ip) * ppp
      const over = Math.max(0, portions - ip)
      if (over > 0) score -= over * ppp * OVERAGE
    } else {
      score += portions * ppp  // no ideal limit → just multiply
    }
  }
  return score
}

/**
 * Totals the nutrition of a day's logged items.
 * `coverage` is the share of logged portions that carry calorie data — items
 * logged before nutrition existed, or foods never filled in, drag it down.
 */
export function calcNutritionTotals(diet) {
  const items = diet?.meal_items || []
  let kcal = 0, protein = 0, carbs = 0, fat = 0
  let withData = 0, totalPortions = 0

  for (const item of items) {
    const portions = item.portions || 1
    totalPortions += portions
    if (item.kcalPerPortion == null) continue
    withData += portions
    kcal    += portions * item.kcalPerPortion
    protein += portions * (item.proteinPerPortion || 0)
    carbs   += portions * (item.carbsPerPortion   || 0)
    fat     += portions * (item.fatPerPortion     || 0)
  }

  return {
    kcal:     Math.round(kcal),
    protein:  Math.round(protein),
    carbs:    Math.round(carbs),
    fat:      Math.round(fat),
    coverage: totalPortions > 0 ? withData / totalPortions : 0,
    hasData:  withData > 0,
  }
}

/**
 * Calorie adherence, 0..max_points. Returns null when the day cannot be judged —
 * no body metrics, nothing logged, or too few items carrying calorie data.
 * Null means the component is skipped entirely and the day scores exactly as it
 * did before this feature existed, which is what keeps old scores comparable.
 */
export function calcCalorieScore(diet, dietetics, weights) {
  const target = dietetics?.energy
  if (!target) return null

  const items = diet?.meal_items || []
  if (!items.length) return null

  const c        = weights?.calories || {}
  const maxPts   = c.max_points   ?? 10
  const tolerance = c.tolerance   ?? 0.10
  const zeroAt   = c.zero_at      ?? 0.35
  const minCover = c.min_coverage ?? 0.7

  const totals = calcNutritionTotals(diet)
  if (!totals.hasData || totals.coverage < minCover) return null

  // Deviation in either direction — under-eating is penalised like over-eating.
  const deviation = Math.abs(totals.kcal - target) / target
  if (deviation <= tolerance) return maxPts
  if (deviation >= zeroAt)    return 0

  const taper = 1 - (deviation - tolerance) / (zeroAt - tolerance)
  return Math.round(maxPts * taper * 10) / 10
}

export function calcDietScore(diet, weights, customOptions = []) {
  if (!diet) return 0

  const newScore = calcMealItemsScore(diet)
  if (newScore !== null) {
    return Math.min(Math.max(Math.round(newScore * 10) / 10, 0), weights.diet_max || 35)
  }

  // Legacy static-field scoring (backward compat for old records)
  const w = weights.diet || {}
  let score = 0
  if (diet.breakfast_logged)    score += w.breakfast || 0
  if (diet.lunch_logged)        score += w.lunch || 0
  if (diet.lunch_protein_first) score += w.protein_first || 0
  if (diet.dinner_logged && diet.dinner_time) {
    const [h, m] = parseHM(diet.dinner_time)
    if (h < 20 || (h === 20 && m <= 30))       score += w.dinner_on_time || 0
    else if (h === 20 || (h === 21 && m === 0)) score += (w.dinner_on_time || 0) * 0.5
  }
  if (diet.no_post_dinner_snack) score += w.no_post_dinner_snack || 0
  if (diet.tea_sugar_reduced)    score += w.tea_sugar_reduced || 0
  for (const id of (diet.custom_meals_eaten || [])) {
    const opt = customOptions.find(o => o.id === id)
    if (opt?.category === 'good') score += opt.points || 0
  }
  return Math.min(Math.max(score, 0), weights.diet_max || 35)
}

// Logistic fasting score: 0 at min_hours, max_points at target_hours
export function calcFastingScore(todayDiet, yesterdayDiet, weights) {
  if (!todayDiet || !yesterdayDiet) return 0
  const fc          = weights.fasting || {}
  const minHours    = fc.min_hours    ?? 12
  const targetHours = fc.target_hours ?? 16
  const maxPts      = fc.max_points   ?? 10

  // Last dinner time from yesterday (check meal_items.time first, then meal_times.dinner, then legacy dinner_time)
  const dinnerItems = (yesterdayDiet.meal_items || []).filter(i => i.mealType === 'dinner')
  const dinnerItemTimes = dinnerItems.map(i => i.time).filter(Boolean)
  const lastDinnerTime = dinnerItemTimes.length
    ? [...dinnerItemTimes].sort().pop()
    : (yesterdayDiet.meal_times?.dinner || yesterdayDiet.dinner_time || null)
  if (!lastDinnerTime) return 0

  // First breakfast time today
  const bfItems = (todayDiet.meal_items || []).filter(i => i.mealType === 'breakfast')
  const bfItemTimes = bfItems.map(i => i.time).filter(Boolean)
  const firstBfTime = bfItemTimes.length
    ? [...bfItemTimes].sort()[0]
    : (todayDiet.meal_times?.breakfast || null)
  if (!firstBfTime) return 0

  const [dh, dm] = parseHM(lastDinnerTime)
  const [bh, bm] = parseHM(firstBfTime)
  let dMin = dh * 60 + dm
  let bMin = bh * 60 + bm
  if (bMin <= dMin) bMin += 24 * 60  // cross midnight
  const hours = (bMin - dMin) / 60

  if (hours < minHours) return 0
  if (hours >= targetHours + 2) return maxPts

  const mid = (minHours + targetHours) / 2
  const k   = 6 / Math.max(targetHours - minHours, 1)
  const raw = maxPts / (1 + Math.exp(-k * (hours - mid)))
  return Math.round(raw * 10) / 10
}

export function calcWorkoutScore(workout, weights) {
  if (!workout) return 0
  const w = weights.workout || {}
  let score = 0

  // Steps: flat tiers up to 10k, then linear bonus from 10k→18k (+10 pts max)
  const base8k         = w.steps_8000              || 0
  const bonus10k       = w.steps_10000_bonus        || 0
  const cap10k         = base8k + bonus10k
  const extraMax       = 10
  const halfThreshold  = w.steps_half_threshold     || 5000
  const fullThreshold  = w.steps_full_threshold     || 8000
  const bonusStart     = w.steps_bonus_start        || 10000
  const bonusEnd       = w.steps_bonus_end          || 18000

  if (workout.steps >= bonusStart) {
    const extra = Math.min((workout.steps - bonusStart) / Math.max(bonusEnd - bonusStart, 1), 1) * extraMax
    score += Math.round((cap10k + extra) * 10) / 10
  } else if (workout.steps >= fullThreshold) {
    score += base8k
  } else if (workout.steps >= halfThreshold) {
    score += base8k * 0.5
  }

  if (workout.post_dinner_walk && workout.post_dinner_walk_minutes >= 10) score += w.post_dinner_walk || 0
  else if (workout.post_dinner_walk) score += (w.post_dinner_walk || 0) * 0.5
  if (workout.exercise_done && workout.exercise_duration_minutes >= 45)    score += w.exercise_session || 0
  else if (workout.exercise_done && workout.exercise_duration_minutes >= 20) score += (w.exercise_session || 0) * 0.6
  return Math.min(score, weights.workout_max || 35)
}

// Sleep score uses YESTERDAY's log (applied to today's morning score)
// Wake time is lenient: full pts up to 8 AM, half for 8-9 AM, nothing after 9 (no deduction)
export function calcSleepScore(sleep, weights) {
  if (!sleep) return 0
  const w = weights.sleep || {}
  let score = 0

  if (sleep.sleep_time) {
    const [h, m] = parseHM(sleep.sleep_time)
    if (h === 22 || (h === 23 && m <= 30)) score += w.sleep_before_1130 || 0
    else if (h === 23)                      score += (w.sleep_before_1130 || 0) * 0.5
    // after midnight → 0 pts (penalty applied separately)
  }

  const screenOff = sleep.screen_time_hours || 0
  const effective = Math.max(0, (sleep.sleep_hours || 0) - screenOff)
  const hrs = effective > 0 ? effective : (sleep.sleep_hours || 0)
  if (hrs >= 7)      score += w.seven_plus_hours || 0
  else if (hrs >= 6) score += (w.seven_plus_hours || 0) * 0.5
  else if (hrs >= 5) score += (w.seven_plus_hours || 0) * 0.2

  if (sleep.wake_time) {
    const [h, m] = parseHM(sleep.wake_time)
    if (h < 8)                   score += w.wake_by_7 || 0  // before 8:00 AM → full
    else if (h === 8 && m === 0) score += w.wake_by_7 || 0  // exactly 8:00 → full
    else if (h === 8)            score += (w.wake_by_7 || 0) * 0.5  // 8:01–8:59 → half
    else if (h === 9 && m === 0) score += (w.wake_by_7 || 0) * 0.25 // 9:00 → quarter
    // after 9 AM → 0 pts, no deduction
  }
  return Math.min(score, weights.sleep_max || 30)
}

export function calcPenalties(diet, sleep, weights, customOptions = []) {
  const p = weights.penalties || {}
  let penalty = 0

  const dinnerTime = diet?.meal_times?.dinner || diet?.dinner_time
  if (dinnerTime) {
    const [h] = parseHM(dinnerTime)
    if (h >= 21) penalty += (p.dinner_after_9pm || 0)  // stored as negative e.g. -5
  }
  if (sleep?.sleep_time) {
    const [h] = parseHM(sleep.sleep_time)
    if (h <= 5) penalty += (p.sleep_after_midnight || 0)  // midnight through 5:59am
  }
  // Legacy bad custom meals (new meal_items handles negatives inline)
  if (!diet?.meal_items?.length && diet?.custom_meals_eaten?.length && customOptions.length) {
    for (const id of diet.custom_meals_eaten) {
      const opt = customOptions.find(o => o.id === id)
      if (opt?.category === 'bad') penalty -= opt.points
    }
  }
  return penalty
}

// yesterdayDiet is required for fasting score calculation
// dietetics carries the day's calorie target; omit it to score exactly as before
export function computeScore(diet, workout, sleep, weights, customOptions = [], yesterdayDiet = null, dietetics = null) {
  const p = weights.penalties || {}

  // ── Diet score — meals only, dinner penalty folded in ────────────────────
  const mealScore = calcDietScore(diet, weights, customOptions)
  let dietPenalty = 0
  const dinnerTime = diet?.meal_times?.dinner || diet?.dinner_time
  if (dinnerTime) {
    const [h] = parseHM(dinnerTime)
    if (h >= 21) dietPenalty += (p.dinner_after_9pm || 0)
  }
  if (!diet?.meal_items?.length && diet?.custom_meals_eaten?.length && customOptions.length) {
    for (const id of (diet.custom_meals_eaten || [])) {
      const opt = customOptions.find(o => o.id === id)
      if (opt?.category === 'bad') dietPenalty -= opt.points
    }
  }
  const dietScore = Math.max(0, Math.min(mealScore, weights.diet_max || 35) + dietPenalty)

  // ── Fasting score — separate additive component ───────────────────────────
  const fastingScore = calcFastingScore(diet, yesterdayDiet, weights)

  // ── Workout score ─────────────────────────────────────────────────────────
  const workoutScore = calcWorkoutScore(workout, weights)

  // ── Sleep score (sleep-after-midnight penalty folded in) ──────────────────
  const rawSleep = calcSleepScore(sleep, weights)
  let sleepPenalty = 0
  if (sleep?.sleep_time) {
    const [h] = parseHM(sleep.sleep_time)
    if (h <= 5) sleepPenalty += (p.sleep_after_midnight || 0)  // midnight through 5:59am
  }
  const sleepScore = Math.max(0, rawSleep + sleepPenalty)

  // ── Calorie adherence — null on days it cannot be judged ──────────────────
  const calorieScore = calcCalorieScore(diet, dietetics, weights)

  // ── Bonus ─────────────────────────────────────────────────────────────────
  const subtotal    = dietScore + fastingScore + workoutScore + sleepScore + (calorieScore || 0)
  // The calorie allowance only counts toward the ceiling on days it actually
  // applied — otherwise the bonus threshold would shift and rewrite old scores.
  const maxPossible = (weights.diet_max || 35) + (weights.fasting?.max_points || 10) + (weights.workout_max || 35) + (weights.sleep_max || 30)
    + (calorieScore === null ? 0 : (weights.calories?.max_points ?? 10))
  const bw          = weights.bonus || {}
  let bonus = 0
  if (subtotal >= maxPossible)             bonus += bw.perfect_score || 0
  else if (subtotal >= maxPossible * 0.85) bonus += bw.all_rules_followed || 0
  const total = Math.max(0, Math.min(100, subtotal + bonus))
  return { dietScore, fastingScore, workoutScore, sleepScore, calorieScore, bonus, total }
}
