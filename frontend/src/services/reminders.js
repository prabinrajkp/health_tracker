import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { format } from 'date-fns'
import db from './db'
import { weightsFromConfig, stepTargets } from './scoreMeta'

// How much the app is allowed to notify. One setting governs all three sources:
// the fixed daily reminders below (IDs 1–26), the smart nudges (30–39) and the
// trend alerts (40–44).
//
//   quiet     bedtime only, plus the weekly / monthly wrap
//   standard  bedtime + dinner, plus one nudge a day   → at most 3 a day
//   coach     everything
export const NOTIFICATION_MODES = [
  { id: 'quiet',    label: 'Quiet',    desc: 'Bedtime reminder and the weekly summary only' },
  { id: 'standard', label: 'Standard', desc: 'Bedtime, dinner and one nudge — at most 3 a day' },
  { id: 'coach',    label: 'Coach',    desc: 'Every reminder, check-in and trend alert' },
]
export const DEFAULT_NOTIFICATION_MODE = 'standard'

const FIXED_IDS = [1, 2, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26]
const SLOT_KEY  = 'hq-notif-slot'

async function configMap() {
  const rows = await db.tracker_config.toArray()
  const map = {}
  rows.forEach(r => { map[r.key] = r.value })
  return map
}

export async function getNotificationMode() {
  try {
    const row = await db.tracker_config.get('notification_mode')
    return NOTIFICATION_MODES.some(m => m.id === row?.value) ? row.value : DEFAULT_NOTIFICATION_MODE
  } catch {
    return DEFAULT_NOTIFICATION_MODE
  }
}

const hm = (value, fallback) => (value || fallback).split(':').map(Number)

// (Re)schedules the repeating daily reminders for the current mode. Pass
// requestPermission when called from a user action; background callers must not
// trigger the system permission prompt.
export async function scheduleFixedReminders({ requestPermission = false } = {}) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const perm = requestPermission
      ? await LocalNotifications.requestPermissions()
      : await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return

    const cfg  = await configMap()
    const mode = NOTIFICATION_MODES.some(m => m.id === cfg.notification_mode) ? cfg.notification_mode : DEFAULT_NOTIFICATION_MODE

    await LocalNotifications.cancel({ notifications: FIXED_IDS.map(id => ({ id })) })

    const [bh, bm]   = hm(cfg.bed_time, '23:00')
    const [drh, drm] = hm(cfg.dinner_reminder_time, '20:00')
    const daily = (hour, minute) => ({ on: { hour, minute }, repeats: true })

    const notifications = [
      { id: 1, title: '🌙 Bedtime reminder', body: 'Start your sleep timer in Health Quest — good sleep = good score!', schedule: daily(bh, bm) },
    ]

    if (mode !== 'quiet') {
      notifications.push({ id: 23, title: '🍽️ Dinner reminder', body: 'Aim to eat dinner now — after 9 PM costs you points.', schedule: daily(drh, drm) })
    }

    if (mode === 'coach') {
      const [wh, wm]   = hm(cfg.wake_time, '06:30')
      const [lh, lm]   = hm(cfg.lunch_reminder_time, '12:30')
      const [elh, elm] = hm(cfg.evening_log_time, '22:00')
      let stepTimes = ['10:00', '14:00', '18:00']
      try { if (cfg.step_reminder_times) stepTimes = JSON.parse(cfg.step_reminder_times) } catch {}

      const t = stepTargets(weightsFromConfig(cfg))
      const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n))
      const STEP_MESSAGES = [
        { title: '🌅 Step check-in (1/3)', body: `Morning push — get moving! Target: ${k(t.full)} steps today · bonus from ${k(t.bonusStart)}` },
        { title: '🌞 Step check-in (2/3)', body: `Midday check — stay on track for ${k(t.full)} steps. You can do it!` },
        { title: '🌆 Step check-in (3/3)', body: `Evening sprint — push for ${k(t.full)} steps! Extra pts from ${k(t.bonusStart)} 🏃` },
      ]

      notifications.push(
        { id: 2, title: '☀️ Good morning!', body: 'Stop your sleep timer and start the day strong!', schedule: daily(wh, wm) },
        ...stepTimes.map((time, i) => {
          const [h, m] = time.split(':').map(Number)
          const msg = STEP_MESSAGES[i] || STEP_MESSAGES[2]
          return { id: 10 + i, title: msg.title, body: msg.body, schedule: daily(h, m) }
        }),
        { id: 20, title: '🥗 Lunch time!',        body: 'Log your lunch in Health Quest — protein first for max points!', schedule: daily(lh, lm) },
        { id: 21, title: '💧 Stay hydrated!',      body: 'Drink a glass of water — hydration keeps energy sharp.',         schedule: daily(11, 0) },
        { id: 22, title: '💧 Afternoon hydration', body: 'Another glass of water! Stay fuelled for the rest of the day.',  schedule: daily(15, 30) },
        { id: 24, title: '🚫 No late snacks!',     body: 'Avoid post-dinner snacking to protect your diet score.',         schedule: daily(21, 30) },
        { id: 25, title: '🚶 Post-dinner walk?',   body: 'A short walk after dinner earns bonus workout points!',          schedule: daily(drh, Math.min(59, drm + 40)) },
        { id: 26, title: '📋 Log your day!',       body: "Don't forget to record Sleep & Workout before midnight.",        schedule: daily(elh, elm) },
      )
    }

    await LocalNotifications.schedule({ notifications })
  } catch (e) {
    console.warn('[Reminders]', e)
  }
}

// One-time on upgrade: users who already had the old twelve-a-day reminders
// scheduled get them replaced by the set for their mode. Users who never turned
// reminders on are left alone.
export async function migrateFixedReminders() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const done = await db.tracker_config.get('reminders_schema')
    if (done?.value === '2') return
    const pending = await LocalNotifications.getPending()
    if ((pending?.notifications || []).some(n => FIXED_IDS.includes(n.id))) {
      await scheduleFixedReminders()
    }
    await db.tracker_config.put({ key: 'reminders_schema', value: '2' })
  } catch (e) {
    console.warn('[Reminders:migrate]', e)
  }
}

// Standard mode allows one nudge a day. The slot remembers which nudge took it
// so a reschedule later in the day cannot hand out a second one.
export function pickDailyNudge(candidates, now = new Date()) {
  const today = format(now, 'yyyy-MM-dd')
  let slot = null
  try { slot = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null') } catch {}

  if (slot?.date === today && slot.at <= now.getTime()) return null   // today's nudge already fired
  const pick = candidates[0] || null
  try {
    if (pick) localStorage.setItem(SLOT_KEY, JSON.stringify({ date: today, id: pick.id, at: new Date(pick.schedule.at).getTime() }))
    else if (slot?.date === today) localStorage.removeItem(SLOT_KEY)
  } catch {}
  return pick
}

// One-off reminder 35 minutes after the logged dinner time. Coach mode only —
// in the other modes it would push the day past its notification budget.
export async function schedulePostDinnerWalk(dinnerTime) {
  if (!Capacitor.isNativePlatform() || !dinnerTime) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 6 }] })
    if ((await getNotificationMode()) !== 'coach') return
    const [h, m] = dinnerTime.split(':').map(Number)
    const dinnerAt = new Date(); dinnerAt.setHours(h, m, 0, 0)
    const walkAt = new Date(dinnerAt.getTime() + 35 * 60 * 1000)
    if (walkAt <= new Date()) return
    await LocalNotifications.schedule({ notifications: [{
      id: 6, title: 'Post-dinner walk time!',
      body: 'A 10–15 min walk earns bonus points and helps digestion.',
      schedule: { at: walkAt },
    }] })
  } catch {}
}
