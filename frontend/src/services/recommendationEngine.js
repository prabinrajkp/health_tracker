// Deterministic, history-driven meal recommendations. No AI anywhere in this
// file — everything is computed from what the user has actually logged
// (the `meals` table). Pure functions; localStore.js owns all Dexie I/O and
// feeds data in, mirroring how services/scoring.js is fed diet/workout/sleep.
import { computeFingerprint } from './mealFingerprint'

const DAY_MS = 86400000
const TEMPLATE_MIN_OCCURRENCES = 3
const TEMPLATE_WINDOW_DAYS = 60
const TEMPLATE_STALE_DAYS = 180
const DUPLICATE_WINDOW_HOURS = 3

// ── Nutrition / health score ─────────────────────────────────────────────────
export function computeNutritionSummary(foodItems) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0
  for (const item of foodItems) {
    const p = item.portions || 1
    kcal    += p * (item.kcalPerPortion    ?? 0)
    protein += p * (item.proteinPerPortion ?? 0)
    carbs   += p * (item.carbsPerPortion   ?? 0)
    fat     += p * (item.fatPerPortion     ?? 0)
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
}

function itemPoints(item) {
  const ppp = item.pointsPerPortion || 0, p = item.portions || 1, ip = item.idealPortions
  if (item.category === 'bad' || ppp < 0) return p * ppp
  if (ip && ip > 0) return Math.min(p, ip) * ppp - Math.max(0, p - ip) * ppp * 0.5
  return p * ppp
}

// Maps a meal's raw point total onto a 0-100 "how healthy was this meal" scale.
// Heuristic, not a scientific score: centered at 50, ±10 per net point, per item averaged.
export function computeHealthScore(foodItems) {
  if (!foodItems.length) return 50
  const totalPts = foodItems.reduce((s, i) => s + itemPoints(i), 0)
  const perItem = totalPts / foodItems.length
  return Math.max(0, Math.min(100, Math.round(50 + perItem * 10)))
}

// ── Fingerprint-scoped helpers ───────────────────────────────────────────────
function mealsForCategory(meals, category) {
  return meals.filter(m => m.category === category)
}

function groupByFingerprint(meals) {
  const groups = new Map()
  for (const m of meals) {
    if (!groups.has(m.fingerprint)) groups.set(m.fingerprint, [])
    groups.get(m.fingerprint).push(m)
  }
  return groups
}

// ── Frequently Logged Meals ──────────────────────────────────────────────────
export function rankFrequentMeals(meals, category, limit = 5) {
  const groups = groupByFingerprint(mealsForCategory(meals, category))
  const ranked = [...groups.entries()]
    .map(([fingerprint, group]) => {
      const latest = group.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
      return { fingerprint, count: group.length, latest }
    })
    .filter(r => r.count >= 2)
    .sort((a, b) => b.count - a.count || b.latest.timestamp - a.latest.timestamp)
    .slice(0, limit)
  return ranked
}

// ── Recent Meals ─────────────────────────────────────────────────────────────
export function rankRecentMeals(meals, category, limit = 5) {
  const seen = new Set()
  const result = []
  const sorted = [...mealsForCategory(meals, category)].sort((a, b) => b.timestamp - a.timestamp)
  for (const m of sorted) {
    if (seen.has(m.fingerprint)) continue
    seen.add(m.fingerprint)
    result.push(m)
    if (result.length >= limit) break
  }
  return result
}

// ── Recent Foods ─────────────────────────────────────────────────────────────
export function rankRecentFoods(meals, category, limit = 10) {
  const seen = new Set()
  const result = []
  const sorted = [...mealsForCategory(meals, category)].sort((a, b) => b.timestamp - a.timestamp)
  for (const m of sorted) {
    for (const item of m.foodItems) {
      const key = item.foodId || item.label
      if (seen.has(key)) continue
      seen.add(key)
      result.push(item)
      if (result.length >= limit) return result
    }
  }
  return result
}

// ── Portion learning ─────────────────────────────────────────────────────────
// Most frequently selected portion count for a given food, across all history.
export function learnedPortionFor(meals, foodId) {
  const counts = new Map()
  for (const m of meals) {
    for (const item of m.foodItems) {
      if (item.foodId !== foodId) continue
      const key = item.portions
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  if (!counts.size) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// ── Food Association Mining ──────────────────────────────────────────────────
export function getFoodAssociations(meals, foodLabel, limit = 5) {
  const target = (foodLabel || '').toLowerCase()
  const containing = meals.filter(m => m.foodItems.some(i => i.label.toLowerCase() === target))
  if (!containing.length) return []
  const counts = new Map()
  for (const m of containing) {
    for (const item of m.foodItems) {
      if (item.label.toLowerCase() === target) continue
      counts.set(item.label, (counts.get(item.label) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: Math.round((count / containing.length) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// Suggests the next likely foods given what's already in the meal being built.
export function suggestNextFoods(meals, currentItems, limit = 6) {
  const already = new Set(currentItems.map(i => i.label.toLowerCase()))
  const scores = new Map()
  for (const item of currentItems) {
    for (const assoc of getFoodAssociations(meals, item.label, 10)) {
      if (already.has(assoc.label.toLowerCase())) continue
      scores.set(assoc.label, (scores.get(assoc.label) || 0) + assoc.count)
    }
  }
  return [...scores.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ── Meal Evolution (core vs. optional-addition foods) ───────────────────────
export function detectMealEvolution(meals, category, currentItems) {
  const currentLabels = new Set(currentItems.map(i => i.label.toLowerCase()))
  const candidates = mealsForCategory(meals, category).filter(m => {
    const labels = new Set(m.foodItems.map(i => i.label.toLowerCase()))
    const overlap = [...currentLabels].filter(l => labels.has(l)).length
    const union = new Set([...currentLabels, ...labels]).size
    return union > 0 && overlap / union >= 0.5
  })
  if (candidates.length < 2) return { core: [...currentLabels], optional: [] }

  const presenceCount = new Map()
  for (const m of candidates) {
    for (const label of new Set(m.foodItems.map(i => i.label.toLowerCase()))) {
      presenceCount.set(label, (presenceCount.get(label) || 0) + 1)
    }
  }
  const core = [], optional = []
  for (const [label, count] of presenceCount.entries()) {
    if (count / candidates.length >= 0.7) core.push(label)
    else optional.push(label)
  }
  return { core, optional }
}

// ── Duplicate Detection ──────────────────────────────────────────────────────
export function checkDuplicateMeal(meals, category, items, now = Date.now()) {
  const fingerprint = computeFingerprint(category, items)
  const cutoff = now - DUPLICATE_WINDOW_HOURS * 3600000
  const match = mealsForCategory(meals, category)
    .filter(m => m.fingerprint === fingerprint && m.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  return match ? { isDuplicate: true, previousMeal: match } : { isDuplicate: false, previousMeal: null }
}

// ── Meal Template creation/update ────────────────────────────────────────────
// Given all historical meals sharing a fingerprint, decide whether a template
// should exist and what it should look like now. Returns null if the
// ≥3-times-in-60-days threshold isn't met.
export function buildTemplateFromMeals(fingerprint, category, matchingMeals) {
  const windowCutoff = Date.now() - TEMPLATE_WINDOW_DAYS * DAY_MS
  const recent = matchingMeals.filter(m => m.timestamp >= windowCutoff)
  if (recent.length < TEMPLATE_MIN_OCCURRENCES) return null

  const sorted = [...matchingMeals].sort((a, b) => a.timestamp - b.timestamp)
  const latest = sorted[sorted.length - 1]
  const avg = (key) => Math.round(
    matchingMeals.reduce((s, m) => s + (m.nutritionSummary?.[key] || 0), 0) / matchingMeals.length
  )
  const learnedPortions = {}
  for (const item of latest.foodItems) {
    const counts = new Map()
    for (const m of matchingMeals) {
      const match = m.foodItems.find(i => i.foodId === item.foodId)
      if (match) counts.set(match.portions, (counts.get(match.portions) || 0) + 1)
    }
    learnedPortions[item.foodId] = counts.size
      ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : item.portions
  }

  return {
    fingerprint,
    category,
    foodItems: latest.foodItems,
    learnedPortions,
    timesUsed: matchingMeals.length,
    firstUsed: sorted[0].timestamp,
    lastUsed: latest.timestamp,
    avgCalories:    avg('kcal'),
    avgProtein:     avg('protein'),
    avgCarbs:       avg('carbs'),
    avgFat:         avg('fat'),
    avgHealthScore: Math.round(matchingMeals.reduce((s, m) => s + (m.healthScore || 50), 0) / matchingMeals.length),
  }
}

// ── Recommendation Scoring (40% frequency / 30% recency / 20% consistency / 10% diversity) ──
export function scoreTemplates(templates) {
  if (!templates.length) return []
  const maxUsed = Math.max(...templates.map(t => t.timesUsed))
  const now = Date.now()

  return templates
    .map(t => {
      const frequency   = maxUsed > 0 ? t.timesUsed / maxUsed : 0
      const daysSince   = (now - t.lastUsed) / DAY_MS
      const recency     = Math.max(0, 1 - daysSince / TEMPLATE_STALE_DAYS)
      const consistency = t.timesUsed > 0 ? Math.min(1, t.timesUsed / TEMPLATE_MIN_OCCURRENCES / 2) : 0
      // Diversity: templates shown very recently score slightly lower so the
      // list doesn't always surface the exact same top meal every single day.
      const diversity = daysSince < 1 ? 0.5 : 1
      const score = frequency * 0.4 + recency * 0.3 + consistency * 0.2 + diversity * 0.1
      return { ...t, recommendationScore: Math.round(score * 100) }
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
}

export function isTemplateStale(template) {
  return (Date.now() - template.lastUsed) / DAY_MS > TEMPLATE_STALE_DAYS
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export function computeAnalytics(meals, templates, days = 30) {
  const cutoff = Date.now() - days * DAY_MS
  const inRange = meals.filter(m => m.timestamp >= cutoff)

  const mostEatenByCategory = {}
  for (const cat of ['breakfast', 'lunch', 'dinner', 'snacks', 'drink', 'other']) {
    const catMeals = mealsForCategory(inRange, cat)
    if (!catMeals.length) continue
    const groups = groupByFingerprint(catMeals)
    const top = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    if (top) mostEatenByCategory[cat] = { label: top[1][0].foodItems.map(i => i.label).join(', '), count: top[1].length }
  }

  const foodCounts = new Map()
  for (const m of inRange) {
    for (const item of m.foodItems) foodCounts.set(item.label, (foodCounts.get(item.label) || 0) + 1)
  }
  const topFoods = [...foodCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topTemplates = scoreTemplates(templates).slice(0, 5)

  const uniqueFingerprints = new Set(inRange.map(m => m.fingerprint)).size
  const diversityScore = inRange.length ? Math.round((uniqueFingerprints / inRange.length) * 100) : 0

  const weekCutoff = Date.now() - 7 * DAY_MS
  const thisWeek = inRange.filter(m => m.timestamp >= weekCutoff)
  const priorFingerprints = new Set(inRange.filter(m => m.timestamp < weekCutoff).map(m => m.fingerprint))
  const repeatedThisWeek = thisWeek.filter(m => priorFingerprints.has(m.fingerprint)).length
  const weeklyRepetitionPct = thisWeek.length ? Math.round((repeatedThisWeek / thisWeek.length) * 100) : 0

  const avgCalories = inRange.length ? Math.round(inRange.reduce((s, m) => s + (m.nutritionSummary?.kcal || 0), 0) / inRange.length) : 0
  const avgProtein  = inRange.length ? Math.round(inRange.reduce((s, m) => s + (m.nutritionSummary?.protein || 0), 0) / inRange.length) : 0

  return {
    mostEatenByCategory, topFoods, topTemplates,
    mostRepeatedMeals: topTemplates,
    diversityScore, weeklyRepetitionPct,
    avgCalories, avgProtein,
    totalMeals: inRange.length,
  }
}
