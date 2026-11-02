import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getSleep, saveSleep } from '../api/client'
import { fmtHours } from './fasting'

// The sleep timer, shared by the Today button and the Log → Sleep screen so
// both start and stop the same timer and save the night the same way.

const UsageStats = registerPlugin('UsageStats')
const TIMER_KEY  = 'hq-sleep-timer-start'
const EMPTY_SLEEP = { sleep_time: '', wake_time: '', sleep_hours: 0, quality: 3, notes: '', screen_time_hours: 0 }

export const hhmm = (ts) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatElapsed(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getSleepTimerStart() {
  try {
    const v = localStorage.getItem(TIMER_KEY)
    return v ? parseInt(v, 10) : null
  } catch { return null }
}

// Home-screen widgets show the timer, so they redraw whenever it changes
const changed = () => { try { window.dispatchEvent(new Event(TIMER_EVENT)) } catch {} }
export const TIMER_EVENT = 'hq-sleep-timer'

// `at` and `quiet` are for a start tapped on the widget and handed over later.
// That never moves a timer already running.
export function startSleepTimer(at = Date.now(), { quiet = false } = {}) {
  const running = getSleepTimerStart()
  if (quiet && running) return running
  localStorage.setItem(TIMER_KEY, String(at))
  if (!quiet) toast.success('Sleep timer started. Open the app when you wake up.')
  changed()
  return at
}

// Stops the timer and saves the night under the wake-up date. Screen-on time
// during the night is deducted when Usage Access is granted. Returns the saved
// record, or null when nothing was saved (under an hour, or the save failed).
// A stop tapped on the widget passes its own times, so the night is saved as
// it happened however late the app is opened.
export async function stopSleepTimer({ endAt = Date.now(), startedAt = getSleepTimerStart() } = {}) {
  if (!startedAt) return null
  const now = endAt

  let screenOnHours = 0
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await UsageStats.hasPermission()
      if (perm.granted) {
        const result = await UsageStats.getScreenOnTime({ startTime: startedAt, endTime: now })
        if (!result.needsPermission) screenOnHours = result.screenOnHours ?? 0
      }
      // Without Usage Access the timer still stops; screen time just isn't deducted
    } catch {}
  }

  const sleepHours = Math.round(((now - startedAt) / 3600000) * 10) / 10
  const effective  = Math.max(0, Math.round((sleepHours - screenOnHours) * 10) / 10)
  const logDate    = format(new Date(now), 'yyyy-MM-dd')

  localStorage.removeItem(TIMER_KEY)
  changed()

  if (sleepHours < 1) {
    toast(`Timer cleared — only ${fmtHours(sleepHours)} elapsed, nothing saved.`)
    return null
  }

  try {
    // Keep the quality rating and note if the night was already partly entered
    const existing = await getSleep(logDate).catch(() => null)
    const record = {
      ...EMPTY_SLEEP, ...(existing || {}), date: logDate,
      sleep_time: hhmm(startedAt), wake_time: hhmm(now),
      sleep_hours: sleepHours, screen_time_hours: screenOnHours,
    }
    await saveSleep(record)
    toast.success(`Sleep saved — ${fmtHours(sleepHours)} total · ${fmtHours(screenOnHours)} screen · ${fmtHours(effective)} effective`)
    return record
  } catch {
    toast.error('Could not save your sleep — enter the times under Log → Sleep')
    return null
  }
}
