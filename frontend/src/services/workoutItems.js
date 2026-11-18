// A day's exercise as a list: parsing free text, matching names to the exercise
// library, estimating time, and working out calories. The AI never supplies a number;
// it only maps a name the library does not know to one it does.
//
// The old single-session fields (exercise_done, exercise_type, exercise_duration_minutes,
// exercise_intensity) are worked out from the list on every save, so scoring, badges,
// insights, nudges, widgets and exports read the day as before.
// See docs/workout_logging_plan.md.
import { EXERCISES, EXERCISE_BY_ID, LEGACY_TO_ID } from './exerciseLibrary'

const MIN_PER_SET       = 2      // a set and its rest
const DEFAULT_SETS      = 3
const DEFAULT_MINUTES   = { session: 45, strength: 6, steps: 30, cardio: 30, sport: 45, flexibility: 30 }
const STEP_ALLOWANCE    = 2500   // as in energy.js: steps the resting base already covers
const STEP_LENGTH       = 0.414
const WALK_KMH          = 4.8
const WALK_NET_MET      = 2.8
const LB_TO_KG          = 0.4536
const MILE_TO_KM        = 1.609

export const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ── Matching a name to the library ───────────────────────────────────────────
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

const NAMES = EXERCISES.flatMap(e => [e.name, ...e.aliases].map(n => ({ n: normalise(n), id: e.id })))

/**
 * The library entry a name means, or null. Learned names (from the user or the AI)
 * come first, then names and aliases, then the longest one contained in the text,
 * then a near miss for typos.
 */
export function matchExercise(name, learned = {}) {
  const n = normalise(name)
  if (!n) return null
  if (learned[n] && EXERCISE_BY_ID[learned[n]]) return EXERCISE_BY_ID[learned[n]]
  const exact = NAMES.find(x => x.n === n)
  if (exact) return EXERCISE_BY_ID[exact.id]
  const padded = ` ${n} `
  const inside = NAMES.filter(x => padded.includes(` ${x.n} `)).sort((a, b) => b.n.length - a.n.length)[0]
  if (inside) return EXERCISE_BY_ID[inside.id]
  if (n.length >= 4) {
    const near = NAMES.find(x => x.n.length >= 4 && editDistance(n, x.n) <= (n.length >= 7 ? 2 : 1))
    if (near) return EXERCISE_BY_ID[near.id]
  }
  return null
}

// ── Reading free text ────────────────────────────────────────────────────────
const HARD  = /\b(hard|intense|vigorous|heavy|fast|sprints?|competitive|max)\b/
const EASY  = /\b(easy|light|slow|gentle|casual)\b/
const num   = (s) => parseFloat(s)

/** One piece of text, such as "bench 3x10 5kg" or "spin class 45", into its parts. */
export function parseChunk(raw) {
  let s = ` ${String(raw).toLowerCase()} `
  const out = { raw: String(raw).trim() }
  const take = (re, fn) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' ') } return !!m }

  take(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/, m => { out.minutes = (out.minutes || 0) + num(m[1]) * 60 })
  take(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes|mn)\b/, m => { out.minutes = (out.minutes || 0) + num(m[1]) })
  take(/(\d+)\s*[x×*]\s*(\d+)(?:\s*[x×*@]\s*(\d+(?:\.\d+)?))?/, m => {
    out.sets = num(m[1]); out.reps = num(m[2])
    if (m[3]) out.kg = num(m[3])
  })
  take(/(\d+)\s*sets?\s*(?:of\s*|x\s*)?(\d+)?/, m => { out.sets = num(m[1]); if (m[2]) out.reps = num(m[2]) })
  take(/(\d+)\s*(?:reps?|times)\b/, m => { out.reps = num(m[1]) })
  take(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos)\b/, m => { out.kg = num(m[1]) })
  take(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/, m => { out.kg = Math.round(num(m[1]) * LB_TO_KG * 10) / 10 })
  take(/@\s*(\d+(?:\.\d+)?)/, m => { if (out.kg == null) out.kg = num(m[1]) })
  take(/(\d+(?:\.\d+)?)\s*(?:km|kms|k)\b/, m => { out.km = num(m[1]) })
  take(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/, m => { out.km = Math.round(num(m[1]) * MILE_TO_KM * 10) / 10 })
  take(/(\d+)\s*(?:m|meters|metres)\b/, m => { out.km = num(m[1]) / 1000 })
  if (HARD.test(s)) out.effort = 'hard'
  else if (EASY.test(s)) out.effort = 'normal'

  // A number left over with nothing else: minutes for "spin class 45", reps for
  // "10 pushups". Which one is decided once the exercise is known.
  if (out.minutes == null && out.sets == null && out.reps == null && out.km == null) {
    take(/\b(\d{1,3})\b/, m => { out.bare = num(m[1]) })
  }
  out.name = s.replace(/\b(sets?|reps?|of|at|for|x|with|did|done|today|session|and)\b/g, ' ')
    .replace(/\d+(?:\.\d+)?/g, ' ').replace(HARD, ' ').replace(EASY, ' ')
    .replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  return out
}

/**
 * A whole line, such as "gym 50 min: bench 3x10 5kg, squats 3x8 40kg, 20 min cycling",
 * into parts. A heading with a time before a colon is the session the rest belongs to.
 */
export function parseWorkoutText(text) {
  const src = String(text || '').trim()
  if (!src) return []
  const out = []
  let body = src
  const head = src.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/)
  if (head && /\d/.test(head[1])) {
    const session = parseChunk(head[1])
    if (!session.name) session.name = 'gym'
    out.push({ ...session, heading: true })
    body = head[2]
  }
  for (const piece of body.split(/[,;\n+&]|\band\b|\bthen\b/)) {
    if (!piece.trim()) continue
    const chunk = parseChunk(piece)
    if (chunk.name || chunk.minutes) out.push(chunk)
  }
  return out
}

// ── Items ────────────────────────────────────────────────────────────────────
const titleCase = (s) => s.replace(/\b\w/, c => c.toUpperCase())
const newId = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const clock = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function estimateMinutes(item, entry) {
  if (item.minutes > 0 && !item.minutesEstimated) return { minutes: item.minutes, estimated: false }
  if (entry?.kind === 'strength') return { minutes: (item.sets || DEFAULT_SETS) * MIN_PER_SET, estimated: true }
  if (item.km > 0 && entry?.kmh) return { minutes: Math.round((item.km / entry.kmh) * 60), estimated: true }
  return { minutes: DEFAULT_MINUTES[entry?.kind] || 30, estimated: true }
}

/** A parsed piece and its library entry (or none, for a name still to be matched) as a saved item. */
export function makeItem(parsed, entry, now = new Date()) {
  if (parsed.bare != null) {
    parsed = { ...parsed }
    if (entry?.kind === 'strength') parsed.reps = parsed.bare
    else if (parsed.bare >= 5 && parsed.bare <= 300) parsed.minutes = parsed.bare
  }
  const base = {
    id: newId(),
    name: entry ? entry.name : titleCase(parsed.name || 'Exercise'),
    text: parsed.name || '',
    library: entry?.id || null,
    kind: entry?.kind || 'unknown',
    effort: parsed.effort || 'normal',
    time: clock(now),
  }
  for (const k of ['sets', 'reps', 'kg', 'km']) if (parsed[k] != null) base[k] = parsed[k]
  // Kept until the exercise is known, to become reps or minutes then
  if (!entry && parsed.bare != null) base.bare = parsed.bare
  const t = estimateMinutes({ minutes: parsed.minutes, km: parsed.km, sets: parsed.sets }, entry)
  base.minutes = t.minutes
  base.minutesEstimated = t.estimated
  return base
}

/** Re-matches an item after its library entry was chosen, keeping what was typed. */
export function withEntry(item, entry) {
  const next = { ...item }
  if (next.bare != null) {
    if (entry.kind === 'strength') next.reps = next.bare
    else if (next.bare >= 5 && next.bare <= 300) { next.minutes = next.bare; next.minutesEstimated = false }
    delete next.bare
  }
  const t = estimateMinutes(next, entry)
  return { ...next, library: entry.id, kind: entry.kind, name: entry.name, minutes: t.minutes, minutesEstimated: t.estimated }
}

/** Free text into items, matched against the library and what was learned. */
export function itemsFromText(text, learned = {}, now = new Date()) {
  return parseWorkoutText(text).map(p => {
    const entry = matchExercise(p.name, learned) || (p.heading ? EXERCISE_BY_ID.gym : null)
    return makeItem(p, entry, now)
  })
}

// A lift with only an estimated time inside a day that has a whole session is part
// of that session: its time and calories are already in the session's.
const hasSession = (items) => items.some(i => i.kind === 'session')
export const insideSession = (item, items) => item.kind === 'strength' && item.minutesEstimated && hasSession(items)
export const countedMinutes = (item, items) => (insideSession(item, items) || item.kind === 'unknown' ? 0 : item.minutes || 0)

/**
 * Each item's calories, net of the resting burn the base covers: (MET − 1) × kg × hours.
 * Walking, running, hiking and stairs also show up as steps, so the part the step
 * counter already counted is taken off, out of the day's steps above the allowance.
 */
export function itemsKcal(items, { kg, heightCm = 170, steps = 0 } = {}) {
  let pool = Math.max(0, (steps || 0) - STEP_ALLOWANCE)
  const per = (items || []).map(item => {
    const entry = EXERCISE_BY_ID[item.library]
    const minutes = countedMinutes(item, items)
    if (!entry || !kg || !minutes) return { id: item.id, kcal: 0, stepsCounted: 0 }
    const met = entry.mets[item.effort] ?? entry.mets.normal
    let kcal = (met - 1) * kg * (minutes / 60)
    let stepsCounted = 0
    if (entry.kind === 'steps' && pool > 0 && entry.cadence) {
      stepsCounted = Math.min(pool, entry.cadence * minutes)
      pool -= stepsCounted
      const km = (stepsCounted * STEP_LENGTH * heightCm) / 100000
      kcal = Math.max(0, kcal - (km / WALK_KMH) * WALK_NET_MET * kg)
    }
    return { id: item.id, kcal, stepsCounted }
  })
  return { total: per.reduce((s, p) => s + p.kcal, 0), per }
}

/** The old single-session fields, worked out from the list. */
export function summarise(items = []) {
  const list = items.filter(i => i.kind !== 'unknown')
  if (!list.length) return { exercise_done: false, exercise_type: '', exercise_duration_minutes: 0, exercise_intensity: 'normal' }
  const total = list.reduce((s, i) => s + countedMinutes(i, list), 0)
  const main = [...list].sort((a, b) => countedMinutes(b, list) - countedMinutes(a, list))[0]
  const hard = list.filter(i => i.effort === 'hard').reduce((s, i) => s + countedMinutes(i, list), 0)
  return {
    exercise_done: true,
    exercise_type: EXERCISE_BY_ID[main.library]?.legacy || 'Other',
    exercise_duration_minutes: Math.round(total),
    exercise_intensity: total > 0 && hard * 2 > total ? 'hard' : 'normal',
  }
}

/** A day's items, including a day logged before the list existed, read as one item. */
export function itemsOf(workout) {
  if (Array.isArray(workout?.workout_items)) return workout.workout_items
  if (!workout?.exercise_done) return []
  const entry = EXERCISE_BY_ID[LEGACY_TO_ID[workout.exercise_type] || 'other']
  return [{
    id: 'legacy', name: entry.name, library: entry.id, kind: entry.kind,
    minutes: workout.exercise_duration_minutes || 0, minutesEstimated: false,
    effort: workout.exercise_intensity || 'normal',
  }]
}

/** One line for an item: "3 × 10 · 5 kg · ~6 min". */
export function describeItem(item) {
  const parts = []
  if (item.sets && item.reps) parts.push(`${item.sets} × ${item.reps}`)
  else if (item.sets) parts.push(`${item.sets} sets`)
  else if (item.reps) parts.push(`${item.reps} reps`)
  if (item.kg) parts.push(`${item.kg} kg`)
  if (item.km) parts.push(`${item.km} km`)
  if (item.minutes) parts.push(`${item.minutesEstimated ? '~' : ''}${Math.round(item.minutes)} min`)
  return parts.join(' · ')
}

// ── Lifting progress ─────────────────────────────────────────────────────────
// Each past session of one lift: the date, the heaviest set and the weight moved.
export function liftHistory(logs = [], library) {
  const out = []
  for (const log of logs) {
    for (const item of log.workout_items || []) {
      if (item.library !== library || !item.kg) continue
      out.push({ date: log.date, sets: item.sets || 1, reps: item.reps || 0, kg: item.kg,
        volume: (item.sets || 1) * (item.reps || 0) * item.kg })
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || b.kg - a.kg)
  const best = [...out].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0] || null
  return { sessions: out, last: out[0] || null, best }
}

/** Whether a new set beats every earlier one: heavier, or the same weight for more reps. */
export const isNewBest = (item, best) =>
  !!item?.kg && !!best && (item.kg > best.kg || (item.kg === best.kg && (item.reps || 0) > best.reps))

/** Items to log again, with fresh ids and times. */
export const copyItems = (items = [], now = new Date()) =>
  items.filter(i => i.kind !== 'unknown').map(i => ({ ...i, id: newId(), time: clock(now) }))
