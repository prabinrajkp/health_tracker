import { Capacitor, registerPlugin } from '@capacitor/core'
import { HealthConnect } from 'capacitor-health-connect'
import { saveWorkout, getWorkout } from '../api/client'
import { format } from 'date-fns'

const UsageStats = registerPlugin('UsageStats')

/**
 * Silently syncs today's steps from Health Connect (or sensor fallback).
 * Saves to workout_logs if a higher step count is found.
 * Safe to call at any time — never throws, never shows UI.
 */
// A step count the user typed in wins for the rest of that day; only an
// explicit Sync on the Log screen clears it.
const MANUAL_KEY = 'hq-steps-manual'
export const isStepsManualToday = () => {
  try { return localStorage.getItem(MANUAL_KEY) === format(new Date(), 'yyyy-MM-dd') } catch { return false }
}
export const setStepsManualToday = (on) => {
  try {
    if (on) localStorage.setItem(MANUAL_KEY, format(new Date(), 'yyyy-MM-dd'))
    else localStorage.removeItem(MANUAL_KEY)
  } catch {}
}

export async function syncStepsBackground() {
  if (!Capacitor.isNativePlatform()) return
  if (isStepsManualToday()) return

  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    const r = await HealthConnect.checkAvailability()
    if (r.availability === 'Available') {
      const perm = await HealthConnect.checkHealthPermissions({ read: ['Steps'], write: [] })
      if (perm.hasAllPermissions) {
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const end   = new Date(); end.setHours(23, 59, 59, 999)
        const result = await HealthConnect.readRecords({
          type: 'Steps',
          timeRangeFilter: { type: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
        })
        const byOrigin = {}
        for (const rec of result.records) {
          const o = rec.metadata?.dataOrigin ?? 'unknown'
          byOrigin[o] = (byOrigin[o] || 0) + (rec.count || 0)
        }
        const total = Object.values(byOrigin).length > 0 ? Math.max(...Object.values(byOrigin)) : 0
        if (total > 0) {
          const existing = await getWorkout(today)
          if (!existing || (existing.steps || 0) < total) {
            await saveWorkout({ ...(existing || {}), date: today, steps: total })
          }
          return
        }
      }
    }
    // Fallback: sensor
    const sr = await UsageStats.getTodaySteps()
    if (sr.available && sr.steps > 0) {
      const existing = await getWorkout(today)
      if (!existing || (existing.steps || 0) < sr.steps) {
        await saveWorkout({ ...(existing || {}), date: today, steps: sr.steps })
      }
    }
  } catch {
    // silent — background sync must never break the app
  }
}
