/**
 * Local storage layer using Dexie (IndexedDB).
 * Used on Android (Capacitor) and as fallback on desktop when FastAPI is down.
 * Mirrors the FastAPI endpoint contract exactly so client.js can swap transparently.
 */
import { format, subDays, addDays, parseISO } from 'date-fns'
import db, { seedDefaults, DEFAULT_WEIGHTS } from './db'
import { computeScore } from './scoring'
import { dieteticsFromConfig } from './dietetics'
import { computeFingerprint } from './mealFingerprint'
import {
  computeHealthScore, computeNutritionSummary, rankFrequentMeals, rankRecentMeals,
  rankRecentFoods, suggestNextFoods, getFoodAssociations, detectMealEvolution,
  checkDuplicateMeal, buildTemplateFromMeals, scoreTemplates, computeAnalytics,
  learnedPortionFor,
} from './recommendationEngine'

const today = () => format(new Date(), 'yyyy-MM-dd')

// ── Weights helper ────────────────────────────────────────────────────────────
async function getWeights() {
  await seedDefaults()
  const row = await db.tracker_config.get('score_weights')
  try { return row ? JSON.parse(row.value) : DEFAULT_WEIGHTS } catch { return DEFAULT_WEIGHTS }
}

async function getCustomMealOptions() {
  const row = await db.tracker_config.get('custom_meal_options')
  try { return row ? JSON.parse(row.value) : [] } catch { return [] }
}

// ── Dietetics helper ──────────────────────────────────────────────────────────
// Body metrics plus the most recent weight on or before `date`. Returns null when
// metrics are incomplete, which makes the calorie component sit out entirely.
async function getDieteticsFor(date) {
  const rows = await db.tracker_config.toArray()
  const config = {}
  rows.forEach(r => { config[r.key] = r.value })

  const weight = await weightOnOrBefore(date)
  if (!weight) return null
  return dieteticsFromConfig(config, weight)
}

async function weightOnOrBefore(date) {
  const all = await db.weight_logs.toArray()
  const prior = all
    .filter(r => r.date <= date && r.weight_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  return prior.length ? prior[prior.length - 1].weight_kg : null
}

// ── Recompute and persist daily score ────────────────────────────────────────
async function recomputeScore(date) {
  if (date > today()) return null  // never create records for future dates
  const weights       = await getWeights()
  const customOptions = await getCustomMealOptions()
  const yesterdayDate = format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
  const diet          = await db.diet_logs.get({ date })                  || null
  const workout       = await db.workout_logs.get({ date })               || null
  // Sleep stored under wake-up date; same-day lookup only — no cross-day double-count
  const sleep         = await db.sleep_logs.get({ date }) || null
  const yesterdayDiet = await db.diet_logs.get({ date: yesterdayDate })   || null  // fasting window
  const streak        = await getStreakCount(date)
  const dietetics     = await getDieteticsFor(date)
  const { dietScore, fastingScore, workoutScore, sleepScore, calorieScore, bonus, total } =
    computeScore(diet, workout, sleep, weights, customOptions, yesterdayDiet, dietetics)

  const record = {
    date,
    diet_score: dietScore,
    fasting_score: fastingScore || 0,
    workout_score: workoutScore,
    sleep_score: sleepScore,
    calorie_score: calorieScore,
    bonus_points: bonus,
    total_score: total,
    streak_days: streak,
    steps: workout?.steps || 0,
    computed_at: new Date().toISOString(),
  }

  const existing = await db.daily_scores.get({ date })
  if (existing) {
    await db.daily_scores.update(existing.id, record)
  } else {
    try {
      await db.daily_scores.add(record)
    } catch (e) {
      // Two recomputeScore(date) calls can race (e.g. AddMealFlow's immediate
      // persist-on-Finish landing while an initial page-load score fetch is
      // still in flight) — both see no existing row and both try to add one.
      // The loser hits the unique &date constraint; fall back to updating
      // whatever the winner just inserted instead of surfacing a false error.
      if (e.name !== 'ConstraintError') throw e
      const row = await db.daily_scores.get({ date })
      if (row) await db.daily_scores.update(row.id, record)
    }
  }

  return record
}

async function getStreakCount(targetDate) {
  let streak = 0
  let check  = subDays(new Date(targetDate), 1)
  for (let i = 0; i < 365; i++) {
    const key = format(check, 'yyyy-MM-dd')
    const row = await db.daily_scores.get({ date: key })
    if (row && row.total_score >= 60) { streak++; check = subDays(check, 1) }
    else break
  }
  return streak
}

// ── Diet ──────────────────────────────────────────────────────────────────────
export async function getDiet(date) {
  await seedDefaults()
  return (await db.diet_logs.get({ date })) || null
}

export async function saveDiet(payload) {
  await seedDefaults()
  const existing = await db.diet_logs.get({ date: payload.date })
  const now = new Date().toISOString()
  if (existing) {
    await db.diet_logs.update(existing.id, { ...payload, updated_at: now })
    const row = await db.diet_logs.get(existing.id)
    await recomputeScore(payload.date)
    return row
  }
  const id = await db.diet_logs.add({ ...payload, created_at: now })
  await recomputeScore(payload.date)
  return db.diet_logs.get(id)
}

// ── Workout ───────────────────────────────────────────────────────────────────
export async function getWorkout(date) {
  await seedDefaults()
  return (await db.workout_logs.get({ date })) || null
}

export async function saveWorkout(payload) {
  await seedDefaults()
  const existing = await db.workout_logs.get({ date: payload.date })
  const now = new Date().toISOString()
  if (existing) {
    await db.workout_logs.update(existing.id, { ...payload, updated_at: now })
    const row = await db.workout_logs.get(existing.id)
    await recomputeScore(payload.date)
    return row
  }
  const id = await db.workout_logs.add({ ...payload, created_at: now })
  await recomputeScore(payload.date)
  return db.workout_logs.get(id)
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
export async function getSleep(date) {
  await seedDefaults()
  return (await db.sleep_logs.get({ date })) || null
}

export async function saveSleep(payload) {
  await seedDefaults()
  const existing = await db.sleep_logs.get({ date: payload.date })
  const now = new Date().toISOString()
  if (existing) {
    await db.sleep_logs.update(existing.id, { ...payload, updated_at: now })
    const row = await db.sleep_logs.get(existing.id)
    await recomputeScore(payload.date)  // sleep stored under wake-up date; same-day recompute
    return row
  }
  const id = await db.sleep_logs.add({ ...payload, created_at: now })
  await recomputeScore(payload.date)
  return db.sleep_logs.get(id)
}

// ── Weight ────────────────────────────────────────────────────────────────────
// NOTE: the private getWeights() above returns *scoring* weights — these are body
// weight readings, hence the different naming.
export async function getWeightEntry(date) {
  await seedDefaults()
  return (await db.weight_logs.get({ date })) || null
}

export async function getWeightEntries(start = null, end = null) {
  await seedDefaults()
  const all = await db.weight_logs.toArray()
  return all
    .filter(r => (!start || r.date >= start) && (!end || r.date <= end))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getLatestWeight() {
  const all = await getWeightEntries()
  return all.length ? all[all.length - 1] : null
}

export async function saveWeightEntry(payload) {
  await seedDefaults()
  const existing = await db.weight_logs.get({ date: payload.date })
  const now = new Date().toISOString()
  if (existing) await db.weight_logs.update(existing.id, { ...payload, updated_at: now })
  else          await db.weight_logs.add({ ...payload, created_at: now })

  // Keep the legacy current_weight config in step so Settings and Profile agree.
  const latest = await getLatestWeight()
  if (latest) {
    await saveConfig({ key: 'current_weight', value: String(latest.weight_kg) })
  }

  // Weight moves BMI, which moves the calorie target, which can move the score.
  await recomputeScore(payload.date)
  return db.weight_logs.get({ date: payload.date })
}

export async function deleteWeightEntry(date) {
  const existing = await db.weight_logs.get({ date })
  if (!existing) return
  await db.weight_logs.delete(existing.id)
  await recomputeScore(date)
}

// ── Scores ────────────────────────────────────────────────────────────────────
export async function getTodayScore() {
  return recomputeScore(today())
}

export async function getScoreForDate(date) {
  return recomputeScore(date)
}

export async function getMonthlyScores(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const all = await db.daily_scores.toArray()
  return all
    .filter(r => r.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getScoresRange(start, end) {
  const all = await db.daily_scores.toArray()
  return all
    .filter(r => r.date >= start && r.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getStreak() {
  const streak = await getStreakCount(today())
  return { streak, date: today() }
}

// ── Config ────────────────────────────────────────────────────────────────────
export async function getConfig() {
  await seedDefaults()
  return db.tracker_config.toArray()
}

export async function getConfigKey(key) {
  await seedDefaults()
  const row = await db.tracker_config.get(key)
  if (!row) throw new Error(`Config key not found: ${key}`)
  return row
}

export async function saveConfig(payload) {
  await seedDefaults()
  const existing = await db.tracker_config.get(payload.key)
  if (existing) {
    await db.tracker_config.update(payload.key, { value: payload.value, description: payload.description, updated_at: new Date().toISOString() })
    return db.tracker_config.get(payload.key)
  }
  await db.tracker_config.put({ ...payload, updated_at: new Date().toISOString() })
  return db.tracker_config.get(payload.key)
}

// ── Foods (the shared food catalog — same tracker_config blob Settings edits) ──
export async function getFoods() {
  await seedDefaults()
  return getCustomMealOptions()
}

export async function saveFood(food) {
  const current = await getCustomMealOptions()
  const id = food.id || Math.random().toString(36).slice(2, 10)
  const withId = { ...food, id }
  const idx = current.findIndex(f => f.id === id)
  const updated = idx === -1 ? [...current, withId] : current.map((f, i) => (i === idx ? withId : f))
  await saveConfig({ key: 'custom_meal_options', value: JSON.stringify(updated) })
  return withId
}

// ── Meals (immutable historical records — the new source of truth for
// recommendations/templates/analytics; diet_logs.meal_items stays untouched
// so existing scoring/quests/notifications keep working as-is) ─────────────
export async function getMealsForDate(date) {
  return db.meals.where('date').equals(date).toArray()
}

export async function getMealsInRange(start, end) {
  const all = await db.meals.toArray()
  return all.filter(m => m.date >= start && m.date <= end)
}

// Most recent meal logged for this category yesterday, if any — powers the
// one-tap "Repeat Yesterday" card so users don't have to scan Recent Meals.
export async function getYesterdayMeal(category, date = today()) {
  const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
  const meals = await getMealsForDate(yesterday)
  const matching = meals.filter(m => m.category === category).sort((a, b) => b.timestamp - a.timestamp)
  return matching[0] || null
}

async function getAllMeals() {
  return db.meals.toArray()
}

export async function saveMeal({ category, date, foodItems }) {
  const fingerprint = computeFingerprint(category, foodItems)
  const allMeals = await getAllMeals()

  const dup = checkDuplicateMeal(allMeals, category, foodItems)
  if (dup.isDuplicate) return { saved: false, duplicate: dup.previousMeal }

  const meal = {
    date, category, timestamp: Date.now(), foodItems, fingerprint,
    nutritionSummary: computeNutritionSummary(foodItems),
    healthScore: computeHealthScore(foodItems),
  }
  const id = await db.meals.add(meal)
  const saved = await db.meals.get(id)

  // Template learning: does this fingerprint now qualify as a recurring meal?
  const matching = [...allMeals, saved].filter(m => m.fingerprint === fingerprint)
  const template = buildTemplateFromMeals(fingerprint, category, matching)
  if (template) {
    const existing = await db.meal_templates.get(fingerprint)
    await db.meal_templates.put({ ...template, name: existing?.name || null })
  }

  return { saved: true, meal: saved }
}

// "Update previous meal" from the duplicate-detection prompt — corrects the
// existing record in place rather than creating a near-duplicate.
export async function updateMeal(mealId, foodItems) {
  const existing = await db.meals.get(mealId)
  if (!existing) return null
  const fingerprint = computeFingerprint(existing.category, foodItems)
  await db.meals.update(mealId, {
    foodItems, fingerprint,
    nutritionSummary: computeNutritionSummary(foodItems),
    healthScore: computeHealthScore(foodItems),
  })
  return db.meals.get(mealId)
}

export async function forceLogMeal({ category, date, foodItems }) {
  const fingerprint = computeFingerprint(category, foodItems)
  const meal = {
    date, category, timestamp: Date.now(), foodItems, fingerprint,
    nutritionSummary: computeNutritionSummary(foodItems),
    healthScore: computeHealthScore(foodItems),
  }
  const id = await db.meals.add(meal)
  const saved = await db.meals.get(id)
  const allMeals = await getAllMeals()
  const matching = allMeals.filter(m => m.fingerprint === fingerprint)
  const template = buildTemplateFromMeals(fingerprint, category, matching)
  if (template) {
    const existing = await db.meal_templates.get(fingerprint)
    await db.meal_templates.put({ ...template, name: existing?.name || null })
  }
  return saved
}

export async function getFrequentMeals(category, limit = 5) {
  return rankFrequentMeals(await getAllMeals(), category, limit)
}

export async function getRecentMeals(category, limit = 5) {
  return rankRecentMeals(await getAllMeals(), category, limit)
}

export async function getRecentFoods(category, limit = 10) {
  return rankRecentFoods(await getAllMeals(), category, limit)
}

export async function suggestNextFoodsFor(currentItems, limit = 6) {
  return suggestNextFoods(await getAllMeals(), currentItems, limit)
}

export async function getFoodAssociationsFor(foodLabel, limit = 5) {
  return getFoodAssociations(await getAllMeals(), foodLabel, limit)
}

export async function getMealEvolution(category, currentItems) {
  return detectMealEvolution(await getAllMeals(), category, currentItems)
}

export async function getLearnedPortion(foodId) {
  return learnedPortionFor(await getAllMeals(), foodId)
}

export async function getMealTemplates(category) {
  const all = await db.meal_templates.toArray()
  const filtered = category ? all.filter(t => t.category === category) : all
  return scoreTemplates(filtered)
}

// ── Favorite meals — user-pinned, always shown before recent meals ─────────
export async function getFavoriteFingerprints() {
  const row = await db.tracker_config.get('favorite_meal_fingerprints')
  try { return row?.value ? JSON.parse(row.value) : [] } catch { return [] }
}

export async function toggleFavoriteMeal(fingerprint) {
  const current = await getFavoriteFingerprints()
  const updated = current.includes(fingerprint)
    ? current.filter(f => f !== fingerprint)
    : [...current, fingerprint]
  await saveConfig({ key: 'favorite_meal_fingerprints', value: JSON.stringify(updated) })
  return updated
}

// ── Custom meal display names — lets a user rename "Rice, Fish Curry, Curd,
// Thoran" to "Kerala Lunch" without needing an AI to invent the name for them.
// Keyed by meal fingerprint, same pool used by favorites/templates/recent, so
// a name set once shows up everywhere that fingerprint appears. ─────────────
export async function getMealNames() {
  const row = await db.tracker_config.get('meal_display_names')
  try { return row?.value ? JSON.parse(row.value) : {} } catch { return {} }
}

export async function setMealName(fingerprint, name) {
  const current = await getMealNames()
  const updated = { ...current }
  if (name && name.trim()) updated[fingerprint] = name.trim()
  else delete updated[fingerprint]
  await saveConfig({ key: 'meal_display_names', value: JSON.stringify(updated) })
  return updated
}

export async function getMealAnalytics(days = 30) {
  const [meals, templates] = await Promise.all([getAllMeals(), db.meal_templates.toArray()])
  return computeAnalytics(meals, templates, days)
}

// ── One-time migration: restore sleep records to wake-up date (undo v7 mis-convention) ──
// v7 moved records from wake-up date to sleep-start date (yesterday). This was wrong.
// The correct convention is wake-up date so recomputeScore(date) finds sleep at `date` directly.
export async function migrateSleepDatesV8() {
  const V8_KEY = 'migration_v8_restore_sleep_dates'
  const done = await db.tracker_config.get(V8_KEY)
  if (done) return

  const v7done = await db.tracker_config.get('migration_v7_sleep_dates')
  if (v7done) {
    // v7 moved records back one day — undo by moving them forward one day
    const todayStr = today()
    const allSleep = await db.sleep_logs.toArray()
    for (const record of allSleep) {
      const newDate = format(addDays(parseISO(record.date), 1), 'yyyy-MM-dd')
      if (newDate > todayStr) continue  // skip future dates
      const conflict = await db.sleep_logs.get({ date: newDate })
      if (conflict) {
        await db.sleep_logs.delete(record.id)  // remove stale displaced record
        continue
      }
      await db.sleep_logs.update(record.id, { date: newDate })
    }
    // Recompute scores for all affected dates
    const affectedDates = new Set(
      allSleep.map(r => format(addDays(parseISO(r.date), 1), 'yyyy-MM-dd')).filter(d => d <= todayStr)
    )
    for (const date of affectedDates) await recomputeScore(date)
  }

  await db.tracker_config.put({
    key: V8_KEY,
    value: '1',
    description: 'Restored sleep records to wake-up date convention',
    updated_at: new Date().toISOString(),
  })
}

// ── One-time migration: move sleep records from wake-up date to sleep-start date ──
// Before this fix, sleep was saved under the wake-up date (today). The correct
// convention is sleep-start date (yesterday), so recomputeScore(today) finds it
// via yesterdayDate and awards points to the morning you actually wake up.
export async function migrateSleepDates() {
  const MIGRATION_KEY = 'migration_v7_sleep_dates'
  const done = await db.tracker_config.get(MIGRATION_KEY)
  if (done) return

  const todayStr = today()
  const allSleep = await db.sleep_logs.toArray()

  for (const record of allSleep) {
    const newDate = format(subDays(parseISO(record.date), 1), 'yyyy-MM-dd')
    // Skip if a record already exists at the target date
    const conflict = await db.sleep_logs.get({ date: newDate })
    if (conflict) continue
    await db.sleep_logs.update(record.id, { date: newDate })
  }

  // Recompute scores for every date that had a sleep record (old date = wake-up date)
  const affectedDates = new Set(allSleep.map(r => r.date).filter(d => d <= todayStr))
  for (const date of affectedDates) {
    await recomputeScore(date)
  }

  await db.tracker_config.put({
    key: MIGRATION_KEY,
    value: '1',
    description: 'Re-dated sleep records from wake-up date to sleep-start date for correct score attribution',
    updated_at: new Date().toISOString(),
  })
}

// ── One-time migration: backfill fasting_score & steps for all historical records ──
export async function migrateHistoricalScores() {
  const MIGRATION_KEY = 'migration_v6_scores'
  const done = await db.tracker_config.get(MIGRATION_KEY)
  if (done) return

  const todayStr = today()

  // Remove any future-date score records created by old saveSleep(nextDay) calls
  const allScores = await db.daily_scores.toArray()
  const futureIds = allScores.filter(r => r.date > todayStr).map(r => r.id)
  if (futureIds.length) await db.daily_scores.bulkDelete(futureIds)

  // Collect all past/present dates that need recomputing
  const [allDiet, allWorkout] = await Promise.all([
    db.diet_logs.toArray(),
    db.workout_logs.toArray(),
  ])

  const dates = new Set([
    ...allScores.filter(r => r.date <= todayStr).map(r => r.date),
    ...allDiet.filter(r => r.date <= todayStr).map(r => r.date),
    ...allWorkout.filter(r => r.date <= todayStr).map(r => r.date),
  ])

  for (const date of dates) {
    await recomputeScore(date)
  }

  await db.tracker_config.put({
    key: MIGRATION_KEY,
    value: '1',
    description: 'Backfilled fasting_score and steps; removed future-date score records',
    updated_at: new Date().toISOString(),
  })
}
