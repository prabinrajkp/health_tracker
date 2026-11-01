// Runs the notification plan: read the facts, let the rules decide, book everything
// with rule-written text at once, and only then, if switched on, ask the AI to reword.
// Booking first means a notification is safe before any network call starts.
//
// See docs/ai_nudges_plan.md §3.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { format, subDays } from 'date-fns'
import db from './db'
import { buildFacts } from './nudgeFacts'
import { planSlots, CHANNELS } from './nudgeEngine'
import { computeRest, responseOf, shouldTurnOff, isHoldoutDay } from './nudgeLearning'
import {
  buildPayload, buildPrompt, parseReply, shouldCallAi, copyKey, allowedNumbers,
  NUDGE_SCHEMA, BLOCKED, LINK_PATTERN, NUMBER_WORD_PATTERN, MAX_TITLE, MAX_BODY,
} from './nudgeWriter'
import { completeNudges, fetchFreeModels, setOpenRouterModels, hasLlmKey, nudgeRequests } from './llmApi'

const NudgeBackground = registerPlugin('NudgeBackground')

const BASE_ID  = 60       // 60–119 belong to the planner
const MAX_IDS  = 60
const OLD_IDS  = [1, 2, 6, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]
const PLAN_SCHEMA  = '3'
const KEEP_DAYS    = 90
const COPY_MAX_SLOTS = 8
const RECENT_MESSAGES = 5
const MODEL_REFRESH_MS = 7 * 86400000
const today = (now = new Date()) => format(now, 'yyyy-MM-dd')

async function configMap() {
  const rows = await db.tracker_config.toArray()
  const map = {}
  rows.forEach(r => { map[r.key] = r.value })
  return map
}
const setConfig = (key, value) => db.tracker_config.put({ key, value, updated_at: new Date().toISOString() })
const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback } catch { return fallback } }

// ── Upgrade from the old fixed reminders ──────────────────────────────────────
// Whoever had the repeating reminders on keeps them, now as one-shots that check
// first. Whoever never turned them on is left alone.
async function migrate(native) {
  const done = await db.tracker_config.get('reminders_schema')
  if (done?.value === PLAN_SCHEMA) return
  if (native) {
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }))
    if ((pending?.notifications || []).some(n => OLD_IDS.includes(n.id) && n.id < 30)) await setConfig('reminders_on', 'true')
    await LocalNotifications.cancel({ notifications: OLD_IDS.map(id => ({ id })) }).catch(() => {})
  }
  const mode = await db.tracker_config.get('notification_mode')
  if (mode?.value === 'coach') await setConfig('nudge_notice_coach', 'true')
  await setConfig('reminders_schema', PLAN_SCHEMA)
}

async function ensureChannels() {
  const channel = (id, name, description, visibility) => LocalNotifications.createChannel({ id, name, description, importance: 3, visibility })
  await Promise.all([
    channel(CHANNELS.reminders, 'Reminders', 'Bedtime and dinner', 1),
    // Personal figures should not show on a locked phone
    channel(CHANNELS.nudges, 'Nudges', 'Suggestions based on your own logs', 0),
    channel(CHANNELS.summaries, 'Summaries', 'Weekly and monthly wraps', 0),
  ]).catch(() => {})
}

// ── The record ────────────────────────────────────────────────────────────────
// A notification fires with the app closed, so "sent" is worked out afterwards: any
// booked row whose time has passed went out. What the user did comes from the logs.
async function settle(now) {
  const nowMs = now.getTime()
  await db.nudge_log.where('at').below(nowMs - KEEP_DAYS * 86400000).delete().catch(() => {})
  const rows = await db.nudge_log.toArray()
  const unanswered = rows.filter(r => (r.status === 'pending' && r.at <= nowMs) || (r.status === 'sent' && !r.response))
  if (unanswered.length) {
    const since = format(subDays(now, 10), 'yyyy-MM-dd')
    const [diets, workouts, sleeps] = await Promise.all(['diet_logs', 'workout_logs', 'sleep_logs'].map(t =>
      db[t].where('date').aboveOrEqual(since).toArray()))
    const by = (list) => Object.fromEntries(list.map(r => [r.date, r]))
    const logs = { diets: by(diets), workouts: by(workouts), sleeps: by(sleeps) }
    for (const r of unanswered) {
      r.status = 'sent'
      r.response = responseOf(r, logs, now)
      await db.nudge_log.update(r.id, { status: 'sent', response: r.response })
    }
  }
  return rows
}

const toNotification = (slot, id) => ({
  id, title: slot.title, body: slot.body, largeBody: slot.body,
  channelId: slot.channel,
  schedule: { at: slot.at, allowWhileIdle: true },
  extra: { key: slot.key, route: slot.route },
})

// ── Plan ──────────────────────────────────────────────────────────────────────
let queue = Promise.resolve()
let aiBusy = false

// Plans run one at a time: saves, resumes and timers can all ask at once.
export function planNudges(options = {}) {
  const next = queue.then(() => run(options))
  queue = next.catch(e => console.warn('[Nudges]', e))
  return next
}

async function run({ requestPermission = false, skipAi = false } = {}) {
  const native = Capacitor.isNativePlatform()
  if (native) {
    const perm = requestPermission ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return null
    await ensureChannels()
  }
  await migrate(native)

  const now = new Date()
  const rows = await settle(now)
  const nativeCopies = native ? await consumeNativeCopies() : {}
  const [facts, config] = await Promise.all([buildFacts(now), configMap()])

  const rest = computeRest(rows, now, parse(config.nudge_off, []))
  if (rest.throttled && config.nudge_notice_throttle !== today(now).slice(0, 7)) {
    await setConfig('nudge_notice_throttle_pending', 'true')
    await setConfig('nudge_notice_throttle', today(now).slice(0, 7))
  }
  const sent = rows.filter(r => r.status === 'sent')
  const threeDaysAgo = now.getTime() - 3 * 86400000
  const slots = planSlots(facts, {
    rest,
    sentToday: sent.filter(r => r.date === today(now)).map(r => ({ trigger: r.trigger, at: r.at })),
    recent: sent.filter(r => r.at > threeDaysAgo).map(r => ({ trigger: r.trigger, at: r.at })),
    sickNoteSent: sent.some(r => r.trigger === 'sick_note' && r.at > now.getTime() - 2 * 86400000),
  }).slice(0, MAX_IDS)

  // Wording the AI already wrote for these exact facts, except on comparison days
  const useAi = config.nudge_ai === 'true'
  const copy = parse(config.nudge_copy, {})
  for (const s of slots) {
    if (nativeCopies[s.key]) copy[copyKey(s)] = nativeCopies[s.key]
    const written = useAi && s.ai && !isHoldoutDay(s.date) ? copy[copyKey(s)] : null
    s.source = written ? 'ai' : 'rule'
    s.holdout = useAi && s.ai && isHoldoutDay(s.date)
    if (written) { s.title = written.title; s.body = written.body }
  }
  if (Object.keys(nativeCopies).length) await setConfig('nudge_copy', JSON.stringify(copy))

  if (native) {
    const ids = Array.from({ length: MAX_IDS }, (_, i) => ({ id: BASE_ID + i }))
    await LocalNotifications.cancel({ notifications: ids })
    if (slots.length) await LocalNotifications.schedule({ notifications: slots.map((s, i) => toNotification(s, BASE_ID + i)) })
  }

  await db.nudge_log.where('status').equals('pending').delete()
  await db.nudge_log.bulkAdd(slots.map((s, i) => ({
    key: s.key, date: s.date, trigger: s.trigger, detail: s.detail, at: s.at.getTime(),
    title: s.title, body: s.body, why: s.why, route: s.route,
    source: s.source, holdout: !!s.holdout, status: 'pending', notif_id: BASE_ID + i,
  })))
  await setConfig('nudge_last_plan', JSON.stringify({ at: now.getTime(), count: slots.length }))

  if (native) await syncBackground(slots, facts, config, copy, now)
  if (!skipAi) maybeWrite(slots, facts, config, copy, now).catch(e => console.warn('[Nudges:ai]', e))
  return slots
}

// ── AI wording ────────────────────────────────────────────────────────────────
const recentMessages = async () => {
  const rows = await db.nudge_log.where('status').equals('sent').toArray()
  return rows.sort((a, b) => b.at - a.at).slice(0, RECENT_MESSAGES).map(r => r.body)
}

const openSlots = (slots, copy) => slots
  .filter(s => s.ai && !s.holdout && !copy[copyKey(s)])
  .slice(0, COPY_MAX_SLOTS)

async function maybeWrite(slots, facts, config, copy, now) {
  if (aiBusy || config.nudge_ai !== 'true' || !hasLlmKey(config)) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const state = parse(config.nudge_ai_state, {})
  const dayState = state.date === today(now) ? state : { date: today(now), calls: 0, lastAt: 0 }
  const open = openSlots(slots, copy)
  if (!shouldCallAi(dayState, open.length, now)) return

  aiBusy = true
  try {
    const recent = await recentMessages()
    const prompt = buildPrompt(buildPayload(open, { plan: facts.plan, recentMessages: recent, now }))
    await setConfig('nudge_last_request', prompt)
    const next = { ...dayState, calls: dayState.calls + 1, lastAt: now.getTime() }
    try {
      const { text, provider, model } = await completeNudges(prompt, NUDGE_SCHEMA, config)
      const { copies, rejected } = parseReply(text, open, recent)
      const merged = {}
      for (const [key, value] of Object.entries(copy)) {
        if (key.slice(0, 10) >= format(subDays(now, 1), 'yyyy-MM-dd')) merged[key] = value
      }
      for (const s of open) if (copies[s.key]) merged[copyKey(s)] = copies[s.key]
      await setConfig('nudge_copy', JSON.stringify(merged))
      await setConfig('nudge_ai_state', JSON.stringify({ ...next, ok: true, provider, model, written: Object.keys(copies).length, rejected }))
      if (Object.keys(copies).length) planNudges({ skipAi: true }).catch(() => {})
    } catch (e) {
      // The rule-written text is already booked, so this only changes what Settings says
      await setConfig('nudge_ai_state', JSON.stringify({ ...next, ok: false, reason: e.reason || 'failed' }))
    }
  } finally {
    aiBusy = false
  }
}

// ── Background worker (Android only, off unless chosen) ───────────────────────
// Hands the native worker the prompt for anything still on rule text, so a failed or
// offline write can be finished with the app closed. Every check the worker applies
// comes from here, so the rules live in one place.
async function syncBackground(slots, facts, config, copy, now) {
  try {
    const enabled = config.nudge_background === 'true' && config.nudge_ai === 'true' && hasLlmKey(config)
    let bundle = null
    if (enabled) {
      const open = openSlots(slots, copy)
      if (open.length) {
        const prompt = buildPrompt(buildPayload(open, { plan: facts.plan, recentMessages: await recentMessages(), now }))
        bundle = {
          requests: nudgeRequests(prompt, NUDGE_SCHEMA, config).map(r => ({ url: r.url, keyName: r.keyName, body: JSON.stringify(r.body) })),
          keys: { groq: config.groq_api_key || '', openrouter: config.openrouter_api_key || '' },
          blocked: BLOCKED, link: LINK_PATTERN, numberWords: NUMBER_WORD_PATTERN, maxTitle: MAX_TITLE, maxBody: MAX_BODY,
          slots: open.map((s, i) => ({
            ref: `n${i + 1}`, notifId: BASE_ID + slots.indexOf(s), key: s.key, at: s.at.getTime(),
            channel: s.channel, route: s.route, allowed: allowedNumbers(s.facts),
          })),
        }
      }
    }
    await NudgeBackground.sync({ enabled, bundle: bundle ? JSON.stringify(bundle) : '' })
  } catch (e) {
    console.warn('[Nudges:background]', e)
  }
}

async function consumeNativeCopies() {
  try {
    const { copies } = await NudgeBackground.consumeCopies()
    const list = parse(copies, [])
    const out = {}
    for (const c of list) {
      out[c.key] = { title: c.title, body: c.body }
      const row = await db.nudge_log.where('key').equals(c.key).first()
      if (row) await db.nudge_log.update(row.id, { title: c.title, body: c.body, source: 'ai' })
    }
    return out
  } catch {
    return {}
  }
}

// A tap on a notification the worker posted itself arrives through the activity
export async function consumeNativeTap() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const tap = await NudgeBackground.consumeTap()
    return tap?.route ? tap : null
  } catch {
    return null
  }
}

// ── Model list ────────────────────────────────────────────────────────────────
// Free models come and go, so the list is refreshed at most once a week.
export async function refreshModelList() {
  const config = await configMap()
  const cached = parse(config.openrouter_models, null)
  if (cached?.ids?.length) setOpenRouterModels(cached.ids)
  if (!config.openrouter_api_key) return
  if (cached?.at && Date.now() - cached.at < MODEL_REFRESH_MS) return
  const ids = await fetchFreeModels()
  if (!ids.length) return
  setOpenRouterModels(ids)
  await setConfig('openrouter_models', JSON.stringify({ at: Date.now(), ids }))
}

// ── For the screens ───────────────────────────────────────────────────────────
export async function recordTap(key) {
  if (!key) return
  const row = await db.nudge_log.where('key').equals(key).first()
  if (row) await db.nudge_log.update(row.id, { status: 'sent', tapped_at: Date.now(), response: 'tapped' })
}

export async function recentNudges(days = 14, now = new Date()) {
  await settle(now)
  const since = now.getTime() - days * 86400000
  const rows = await db.nudge_log.where('status').equals('sent').toArray()
  return rows.filter(r => r.at >= since).sort((a, b) => b.at - a.at)
}

// Two "not helpful" on one kind turns that kind off. Returns whether it just did.
export async function rateNudge(id, rating) {
  await db.nudge_log.update(id, { rating })
  if (rating !== 'not_helpful') return false
  const row = await db.nudge_log.get(id)
  const rows = await db.nudge_log.where('trigger').equals(row.trigger).toArray()
  if (!shouldTurnOff(rows, row.trigger)) return false
  await setNudgeOff(row.trigger, true)
  return true
}

export async function setNudgeOff(trigger, off) {
  const config = await configMap()
  const list = new Set(parse(config.nudge_off, []))
  if (off) list.add(trigger)
  else {
    list.delete(trigger)
    // Turning it back on starts its count again, or one more tap would turn it off
    const rows = await db.nudge_log.where('trigger').equals(trigger).toArray()
    await Promise.all(rows.filter(r => r.rating === 'not_helpful').map(r => db.nudge_log.update(r.id, { rating: null })))
  }
  await setConfig('nudge_off', JSON.stringify([...list]))
  await planNudges({ skipAi: true })
}

// What would go to the AI: the last request made, or a sample from today's facts
export async function previewRequest() {
  const config = await configMap()
  if (config.nudge_last_request) return { sample: false, text: config.nudge_last_request }
  const now = new Date()
  const facts = await buildFacts(now)
  const slots = planSlots({ ...facts, anchorsOn: true }, {}).filter(s => s.ai).slice(0, COPY_MAX_SLOTS)
  return { sample: true, text: buildPrompt(buildPayload(slots, { plan: facts.plan, recentMessages: await recentMessages(), now })) }
}

// Things to say once, after an upgrade or a change the app made by itself
export async function takeNotices() {
  const config = await configMap()
  const out = []
  if (config.nudge_notice_coach === 'true') {
    out.push('Coach now sends about 6 well-timed notifications a day, down from about 20.')
    await db.tracker_config.delete('nudge_notice_coach')
  }
  if (config.nudge_notice_throttle_pending === 'true') {
    out.push('Most nudges were going unanswered, so they now come every other day.')
    await db.tracker_config.delete('nudge_notice_throttle_pending')
  }
  return out
}
