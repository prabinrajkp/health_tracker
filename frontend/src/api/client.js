/**
 * Storage router:
 *   - Capacitor native (Android APK) → IndexedDB via localStore (fully offline)
 *   - Browser (desktop dev) → FastAPI REST, with automatic fallback to localStore
 */
import { Capacitor } from '@capacitor/core'
import * as local from '../services/localStore'

const IS_NATIVE = Capacitor.isNativePlatform()
const API_BASE  = import.meta.env.VITE_API_URL || '/api'

// ── Raw fetch wrapper (desktop only) ─────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Thin API wrappers ─────────────────────────────────────────────────────────
const api = {
  // NOTE: no inner .catch() here — a rejected promise must propagate so
  // route()'s fallback below actually runs. Swallowing it here (as this used
  // to) made these three silently resolve to null on any API failure instead
  // of falling back to the local store, which only matters in desktop/browser
  // dev mode without the FastAPI backend running (native builds never call
  // `api` at all — see IS_NATIVE below).
  getDiet:          (date) => apiFetch(`/diet/${date}`),
  saveDiet:         (p)    => apiFetch('/diet/', { method: 'POST', body: JSON.stringify(p) }),
  getWorkout:       (date) => apiFetch(`/workout/${date}`),
  saveWorkout:      (p)    => apiFetch('/workout/', { method: 'POST', body: JSON.stringify(p) }),
  getSleep:         (date) => apiFetch(`/sleep/${date}`),
  saveSleep:        (p)    => apiFetch('/sleep/', { method: 'POST', body: JSON.stringify(p) }),
  getTodayScore:    ()     => apiFetch('/scores/today'),
  getScoreForDate:  (date) => apiFetch(`/scores/date/${date}`),
  getMonthlyScores: (y, m) => apiFetch(`/scores/monthly/${y}/${m}`),
  getScoresRange:   (s, e) => apiFetch(`/scores/range?start=${s}&end=${e}`),
  getStreak:        ()     => apiFetch('/scores/streak'),
  getConfig:        ()     => apiFetch('/config/'),
  getConfigKey:     (k)    => apiFetch(`/config/${k}`),
  saveConfig:       (p)    => apiFetch('/config/', { method: 'POST', body: JSON.stringify(p) }),
}

// ── Router: native → local, browser → api with fallback ──────────────────────
function route(apiCall, localCall) {
  if (IS_NATIVE) return localCall()
  return apiCall().catch(err => {
    console.warn('API unavailable, using local store:', err.message)
    return localCall()
  })
}

// ── Public API (same interface as before — no changes needed in pages) ────────
export const getDiet          = (date) => route(() => api.getDiet(date),          () => local.getDiet(date))
export const saveDiet         = (p)    => route(() => api.saveDiet(p),            () => local.saveDiet(p))
export const getWorkout       = (date) => route(() => api.getWorkout(date),       () => local.getWorkout(date))
export const saveWorkout      = (p)    => route(() => api.saveWorkout(p),         () => local.saveWorkout(p))
export const getSleep         = (date) => route(() => api.getSleep(date),         () => local.getSleep(date))
export const saveSleep        = (p)    => route(() => api.saveSleep(p),           () => local.saveSleep(p))
export const getTodayScore    = ()     => route(() => api.getTodayScore(),         () => local.getTodayScore())
export const getScoreForDate  = (date) => route(() => api.getScoreForDate(date),  () => local.getScoreForDate(date))
export const getMonthlyScores = (y, m) => route(() => api.getMonthlyScores(y, m),() => local.getMonthlyScores(y, m))
export const getScoresRange   = (s, e) => route(() => api.getScoresRange(s, e),  () => local.getScoresRange(s, e))
export const getStreak        = ()     => route(() => api.getStreak(),            () => local.getStreak())
export const getConfig        = ()     => route(() => api.getConfig(),            () => local.getConfig())
export const getConfigKey     = (k)    => route(() => api.getConfigKey(k),        () => local.getConfigKey(k))
export const saveConfig       = (p)    => route(() => api.saveConfig(p),          () => local.saveConfig(p))

// Weight has no REST endpoint — always local.
export const getWeightEntry    = (date) => local.getWeightEntry(date)
export const getWeightEntries  = (s, e) => local.getWeightEntries(s, e)
export const getLatestWeight   = ()     => local.getLatestWeight()
export const saveWeightEntry   = (p)    => local.saveWeightEntry(p)
export const deleteWeightEntry = (date) => local.deleteWeightEntry(date)
