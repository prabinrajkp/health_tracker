// Local food search: exact/alias match first, then substring, then a lightweight
// fuzzy fallback — all before ever reaching the AI. No fuzzy-search dependency
// needed at this data scale (a personal food catalog, not a general corpus).

const norm = (s) => (s || '').trim().toLowerCase()

function bigrams(s) {
  const grams = []
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2))
  return grams
}

// Dice coefficient over character bigrams — cheap, dependency-free, and good
// enough to catch typos/partial words ("dosa" ~ "masala dosa").
function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const ga = bigrams(a), gb = bigrams(b)
  if (!ga.length || !gb.length) return a.includes(b) || b.includes(a) ? 0.5 : 0
  const setB = [...gb]
  let matches = 0
  for (const g of ga) {
    const idx = setB.indexOf(g)
    if (idx !== -1) { matches++; setB.splice(idx, 1) }
  }
  return (2 * matches) / (ga.length + gb.length)
}

function bestScoreFor(query, food) {
  const q = norm(query)
  const candidates = [food.label, ...(food.aliases || [])].map(norm).filter(Boolean)
  let best = 0
  for (const c of candidates) {
    if (c === q) return 1
    if (c.includes(q) || q.includes(c)) best = Math.max(best, 0.75 + 0.15 * (q.length / c.length))
    else best = Math.max(best, similarity(q, c))
  }
  return Math.min(best, 1)
}

export const CONFIDENCE_THRESHOLD = 0.45

export function searchFoods(query, foods, limit = 20) {
  const q = norm(query)
  if (!q) return []
  return foods
    .map(food => ({ food, confidence: bestScoreFor(q, food) }))
    .filter(r => r.confidence > 0.2)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
}

export function hasConfidentMatch(query, foods) {
  const results = searchFoods(query, foods, 1)
  return results.length > 0 && results[0].confidence >= CONFIDENCE_THRESHOLD
}
