// Everything the home-screen widgets show, worked out here so the widgets
// themselves hold no scoring rules. buildWidgetData is pure so it can be tested
// at any hour; collectWidgetData does the reading. The Android side draws from
// the published file and adds taps still waiting in its inbox.
//
// See docs/widgets_plan.md §5.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { format, subDays, addDays, parseISO } from 'date-fns'
import db from './db'
import { weightsFromConfig, categoryMaxes, gradeFor } from './scoreMeta'
import { scoreTone, getThemePreference } from './theme'
import { planOn, fastingCounts, weightDirection, targetProgress, weightTone } from './bodyGoal'
import { computeNextAction } from './nextAction'
import { computeWeeklySummary, getWeekBounds } from './weeklyInsights'
import { dieteticsFromConfig, isMinor, targetText } from './dietetics'
import { calcNutritionTotals } from './scoring'
import { computeNet, fmtNet } from './energy'
import { waterTotals, glassSize } from './hydration'
import { fmtHours } from './fasting'
import { computeQuests } from './questEngine'
import { computePrestige } from './prestigeEngine'
import { getSleepTimerStart, TIMER_EVENT } from './sleepTimer'
import { getStreak, getWaterGoal } from './localStore'

export const DATA_VERSION = 2
export const Widgets = registerPlugin('Widgets')

const MEALS = ['breakfast', 'lunch', 'dinner']
const SLOT_MIN = 30          // the next step is worked out for every half hour left today
const TREND_DAYS = 30
const UNDO_ENTRIES = 5
const NOTIFY_AHEAD_MS = 18 * 3600000

// The week's biggest cost, in the few words a widget has room for
const FIX_LABELS = {
  late_dinner: 'Earlier dinners', poor_sleep: 'Longer sleep', no_workout: 'A workout or two',
  no_breakfast: 'Breakfast', poor_steps: 'More steps', junk_food: 'Less junk food',
  inconsistent_wake: 'A steady wake time',
}
const WEIGHT_TONE = { good: 'success', caution: 'warning' }

const ymd = (d) => format(d, 'yyyy-MM-dd')
const hhmm = (d) => format(d, 'HH:mm')
const round1 = (n) => Math.round(n * 10) / 10
const hasMeal = (diet, type) => (diet?.meal_items || []).some(i => i.mealType === type)
const routeFor = (target) => (target?.type === 'meal' ? `/?meal=${target.category}` : `/log?tab=${target?.tab || 'food'}`)

function stepOf(next) {
  if (!next) return { label: 'All done for today', sub: '', route: '/', done: true }
  return {
    label: next.label,
    sub: next.impact > 0 ? `${next.upTo ? 'Worth up to' : 'Worth'} ${next.impact} pts` : (next.note || ''),
    route: routeFor(next.target),
  }
}

// The next step for each half hour left today, so "Log lunch" does not linger into
// the evening while the app stays closed. The widget picks by the clock.
export function nextSteps({ diet, workout, sleep, weights, timerRunning = false }, now = new Date()) {
  const out = []
  const end = ymd(now)
  for (let t = new Date(now); ymd(t) === end; ) {
    const step = stepOf(computeNextAction({ diet, workout, sleep, weights, now: t, sleepTimerRunning: timerRunning }).next)
    const prev = out[out.length - 1]
    if (!prev || prev.label !== step.label || prev.sub !== step.sub) out.push({ from: hhmm(t), ...step })
    const n = new Date(t)
    n.setSeconds(0, 0)
    n.setMinutes(Math.floor(n.getMinutes() / SLOT_MIN) * SLOT_MIN + SLOT_MIN)
    t = n
  }
  return out
}

function scoreSection({ score, diet, weights, plan }) {
  const max = categoryMaxes(weights)
  const total = Math.round(score?.total_score ?? 0)
  const grade = gradeFor(total)
  const bars = [
    { key: 'diet', label: 'Diet', value: score?.diet_score ?? 0, max: max.diet },
    fastingCounts(plan) && { key: 'fasting', label: 'Fasting', value: score?.fasting_score ?? 0, max: max.fasting },
    { key: 'workout', label: 'Workout', value: score?.workout_score ?? 0, max: max.workout },
    { key: 'sleep', label: 'Sleep', value: score?.sleep_score ?? 0, max: max.sleep },
  ].filter(Boolean).map(b => ({ ...b, value: Math.round(b.value) }))
  return {
    total, letter: grade.letter, label: grade.label, tone: grade.tone,
    nothingYet: !score || (total === 0 && !(diet?.meal_items?.length)),
    bars,
  }
}

function weekSection({ now, today, scores, diets, workouts, sleeps, sick, weights, plan }) {
  const { start, end } = getWeekBounds(now)
  const { start: ps, end: pe } = getWeekBounds(subDays(parseISO(start), 1))
  const within = (rows, a, b) => (rows || []).filter(r => r.date >= a && r.date <= b)
  const byDate = Object.fromEntries((scores || []).map(s => [s.date, s]))
  const summary = computeWeeklySummary({
    scores: within(scores, start, end), dietLogs: within(diets, start, end),
    workoutLogs: within(workouts, start, end), sleepLogs: within(sleeps, start, end),
    prevScores: within(scores, ps, pe), prevDietLogs: within(diets, ps, pe),
    prevWorkoutLogs: within(workouts, ps, pe), prevSleepLogs: within(sleeps, ps, pe),
    weights, fastingOn: fastingCounts(plan),
  })
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = ymd(addDays(parseISO(start), i))
    const row = byDate[date]
    const state = sick.has(date) ? 'sick' : date > today ? 'future' : row ? 'score' : 'empty'
    return { date, letter: 'MTWTFSS'[i], state, tone: state === 'score' ? scoreTone(row.total_score) : null }
  })
  return {
    start, days,
    avg: summary?.avgScore ?? null,
    change: summary?.trend ?? null,
    logged: summary?.daysLogged ?? 0,
    fix: FIX_LABELS[summary?.damage?.[0]?.key] || null,
  }
}

function caloriesSection({ config, diet, workout, sick, latestKg, today, now }) {
  if (config.hide_calories === 'true') return { state: 'hidden' }
  if (isMinor(config)) return { state: 'minor' }
  const dietetics = latestKg ? dieteticsFromConfig(config, latestKg, today) : null
  if (!dietetics) return { state: 'setup' }
  const totals = calcNutritionTotals(diet)
  const eaten = Math.round(totals.kcal)
  if (sick) return { state: 'sick', eaten }
  const target = Math.round(dietetics.energy)
  const left = target - eaten
  const status = targetText(left, dietetics.goal)
  const net = computeNet({ diet, workout, dietetics, date: today, today, now, sick, useDevice: config.use_device_calories === 'true' })
  return {
    state: 'ok', eaten, target, left, goal: dietetics.goal,
    status: status.text, warn: !!status.warn,
    net: net ? `Net ${fmtNet(net.net)}` : null,
    partial: totals.hasData && totals.coverage < 0.7,
  }
}

function goalsSection({ quests, prestige, streak, sick }) {
  const daily = quests?.daily || []
  const xpShare = prestige?.nextLevelXP ? prestige.currentXP / prestige.nextLevelXP : 0
  return {
    level: prestige?.level ?? null,
    xpShare: Math.max(0, Math.min(1, xpShare)),
    xpText: prestige ? `${prestige.currentXP} of ${prestige.nextLevelXP} XP` : '',
    streak, sick,
    done: daily.filter(q => q.complete).length,
    total: daily.length,
    // Unfinished first: a glance should show what is left
    today: [...daily].sort((a, b) => Number(a.complete) - Number(b.complete)).slice(0, 3)
      .map(q => ({ label: q.label, xp: q.xp, done: !!q.complete })),
  }
}

function weightSection({ weights: entries, config, plan, today, now }) {
  const sorted = (entries || []).filter(e => e.weight_kg > 0)
  if (!sorted.length) return { latest: null }
  const latest = sorted[sorted.length - 1]
  const target = Number(config.target_weight) || null
  const direction = weightDirection(plan, { target, start: sorted[0].weight_kg })
  const week = sorted.filter(e => e.date >= ymd(subDays(now, 6)) && e.date <= today)
  const progress = targetProgress(latest.weight_kg, target, direction)
  const tone = weightTone(round1(latest.weight_kg - sorted[0].weight_kg), direction)
  return {
    latest: latest.weight_kg, latestDate: latest.date,
    avg7: week.length ? round1(week.reduce((s, e) => s + e.weight_kg, 0) / week.length) : null,
    target, direction,
    toGo: progress && !progress.reached ? progress.left : null,
    reached: !!progress?.reached,
    tone: WEIGHT_TONE[tone] || null,
    trend: sorted.filter(e => e.date >= ymd(subDays(now, TREND_DAYS))).map(e => e.weight_kg),
  }
}

/**
 * raw: { config, theme, score, streak, diet, workout, sleep, sick (dates), scores, diets,
 *        workouts, sleeps (this week and last), quests, prestige, waterEntries, waterGoalMl,
 *        timerStart, lastSleep, weights, notifications, applied }
 */
export function buildWidgetData(raw, now = new Date()) {
  const config  = raw.config || {}
  const today   = ymd(now)
  const weights = weightsFromConfig(config)
  const plan    = planOn(config, today)
  const sick    = new Set(raw.sick || [])
  const sickToday = sick.has(today)
  const { diet = null, workout = null, sleep = null } = raw
  const timerRunning = !!raw.timerStart
  const weight = weightSection({ weights: raw.weights, config, plan, today, now })
  const steps = workout?.steps || 0
  const totals = waterTotals(raw.waterEntries || [], diet)

  return {
    v: DATA_VERSION, date: today, at: now.getTime(),
    theme: raw.theme || 'system',
    sick: sickToday,
    applied: raw.applied || [],
    streak: raw.streak || 0,
    score: sickToday ? null : scoreSection({ score: raw.score, diet, weights, plan }),
    // The second list is for a timer started or stopped on the widget: the app's
    // own sleep steps no longer apply until it hears about it
    next: sickToday ? [] : nextSteps({ diet, workout, sleep, weights, timerRunning }, now),
    nextNoSleep: sickToday || timerRunning ? [] : nextSteps({ diet, workout, sleep, weights, timerRunning: true }, now),
    week: weekSection({ now, today, scores: raw.scores, diets: raw.diets, workouts: raw.workouts, sleeps: raw.sleeps, sick, weights, plan }),
    calories: caloriesSection({ config, diet, workout, sick: sickToday, latestKg: weight.latest, today, now }),
    goals: goalsSection({ quests: raw.quests, prestige: raw.prestige, streak: raw.streak || 0, sick: sickToday }),
    drinks: {
      ml: totals.totalMl,
      goalMl: sickToday ? 0 : (raw.waterGoalMl || 0),
      glassMl: glassSize(config),
      entries: (raw.waterEntries || []).slice(-UNDO_ENTRIES).map(e => ({ id: e.id, ml: e.ml })),
    },
    sleep: {
      startedAt: raw.timerStart || null,
      lastDate: raw.lastSleep?.date || null,
      lastText: raw.lastSleep?.sleep_hours > 0 ? fmtHours(raw.lastSleep.sleep_hours) : null,
    },
    weight,
    quick: {
      meals: MEALS.filter(m => hasMeal(diet, m)).length,
      steps: steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps > 0 ? String(steps) : 'Not yet',
      moveDone: (raw.score?.workout_score ?? 0) > 0,
      sleepDone: !!sleep?.sleep_time,
    },
    notifications: raw.notifications || { onTimerStart: [], onTimerStop: [] },
  }
}

// ── Reading ───────────────────────────────────────────────────────────────────
// Read-only on purpose: a write here would set off another publish.
export async function collectWidgetData(now = new Date(), applied = []) {
  const today = ymd(now)
  const twoWeeksAgo = ymd(subDays(parseISO(getWeekBounds(now).start), 7))
  const between = (table) => db[table].where('date').between(twoWeeksAgo, today, true, true).toArray()
  const [configRows, scores, diets, workouts, sleeps, sickRows, streak, waterDay, waterGoal, weights, lastSleeps, pending, quests, prestige] = await Promise.all([
    db.tracker_config.toArray(), between('daily_scores'), between('diet_logs'), between('workout_logs'), between('sleep_logs'),
    db.sick_days.toArray(), getStreak().catch(() => ({ streak: 0 })),
    db.water_logs.get({ date: today }).catch(() => null), getWaterGoal(today).catch(() => null),
    db.weight_logs.toArray(),
    db.sleep_logs.orderBy('date').reverse().limit(7).toArray(),
    db.nudge_log.where('status').equals('pending').toArray().catch(() => []),
    computeQuests().catch(() => null), computePrestige().catch(() => null),
  ])
  const config = {}
  configRows.forEach(r => { config[r.key] = r.value })
  const on = (rows) => rows.find(r => r.date === today) || null
  const soon = pending.filter(r => r.at > now.getTime() && r.at < now.getTime() + NOTIFY_AHEAD_MS)
  return buildWidgetData({
    config, theme: getThemePreference(),
    score: on(scores), streak: streak.streak,
    diet: on(diets), workout: on(workouts), sleep: on(sleeps),
    sick: sickRows.map(r => r.date),
    scores, diets, workouts, sleeps, quests, prestige,
    waterEntries: waterDay?.entries || [], waterGoalMl: waterGoal?.targetMl || 0,
    timerStart: getSleepTimerStart(),
    lastSleep: lastSleeps.find(s => s.sleep_hours > 0) || null,
    weights: weights.sort((a, b) => a.date.localeCompare(b.date)),
    // The widget cancels these itself when its own timer button is pressed
    notifications: {
      onTimerStart: soon.filter(r => r.trigger === 'bedtime').map(r => r.notif_id),
      onTimerStop: pending.filter(r => r.trigger === 'wake_timer').map(r => r.notif_id),
    },
    applied,
  }, now)
}

// ── Publishing ────────────────────────────────────────────────────────────────
// One task at a time: a publish that read the data before the inbox was applied
// must not land after one that read it afterwards.
let queue = Promise.resolve()
let timer = null

export function runWidgetTask(task) {
  const next = queue.then(task)
  queue = next.catch(e => console.warn('[Widgets]', e))
  return next
}

// Writes the data file and removes the inbox items it already includes, in one call.
// Called inside a task already running, it publishes there and then.
export async function publishNow(applied = []) {
  const data = await collectWidgetData(new Date(), applied)
  await Widgets.publish({ data: JSON.stringify(data), applied })
  return data
}

export function publishWidgets() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null)
  return runWidgetTask(() => publishNow())
}

// After the app settles, not on every keystroke of a save
export function scheduleWidgetPublish(delayMs = 1500) {
  if (!Capacitor.isNativePlatform()) return
  clearTimeout(timer)
  timer = setTimeout(() => { publishWidgets().catch(() => {}) }, delayMs)
}

const WATCHED = ['diet_logs', 'workout_logs', 'sleep_logs', 'daily_scores', 'water_logs', 'weight_logs',
  'sick_days', 'tracker_config', 'badges', 'nudge_log']

let watching = false
// Anything saved anywhere in the app redraws the widgets, without each screen having to ask
export function watchWidgetData() {
  if (watching || !Capacitor.isNativePlatform()) return
  watching = true
  const changed = () => { scheduleWidgetPublish() }
  for (const name of WATCHED) {
    const table = db[name]
    if (!table) continue
    table.hook('creating', changed)
    table.hook('updating', changed)
    table.hook('deleting', changed)
  }
  window.addEventListener(TIMER_EVENT, changed)
}
