import { useEffect, useState, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Save, Utensils, Dumbbell, Moon, X, Timer, Plus, Minus, Trash2,
  Play, Square, Clock, CheckCircle2, RefreshCw, ChevronDown, Flame,
} from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { HealthConnect } from 'capacitor-health-connect'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { getDiet, saveDiet, getWorkout, saveWorkout, getSleep, saveSleep, getConfig, getLatestWeight } from '../api/client'
import { scheduleSmartNotifications } from '../services/notificationEngine'
import { scheduleTrendNotifications } from '../services/trendNotificationEngine'
import { calcDietScore, calcWorkoutScore, calcSleepScore, calcNutritionTotals, calcCalorieScore } from '../services/scoring'
import { dieteticsFromConfig } from '../services/dietetics'
import { DEFAULT_WEIGHTS } from '../services/db'
import useStore from '../store/useStore'
import StatBar from '../components/StatBar'
import CheckItem from '../components/CheckItem'
import AddMealFlow from '../components/AddMealFlow'
import { MEAL_TYPES, MEAL_META } from '../constants/mealMeta'

const UsageStats = registerPlugin('UsageStats')

// ── Constants ──────────────────────────────────────────────────────────────────
const TIMER_KEY      = 'hq-sleep-timer-start'
const OVERAGE        = 0.5
const EXERCISE_TYPES = ['Badminton', 'Stairs', 'Walking', 'Gym', 'Cycling', 'Other']
const STEP_PRESETS        = [5000, 8000, 10000, 12000]
const WALK_DURATIONS      = [5, 10, 15, 20, 30]
const EXERCISE_DURATIONS  = [20, 30, 45, 60, 90]
const SLEEP_PRESETS = [
  { label: 'Perfect', sleep: '23:00', wake: '06:30' },
  { label: 'Target',  sleep: '23:30', wake: '07:00' },
  { label: 'Late',    sleep: '00:00', wake: '07:30' },
  { label: 'Weekend', sleep: '00:30', wake: '08:00' },
]
const QUALITY_META = {
  1: { label: 'Terrible', color: '#ef4444' },
  2: { label: 'Poor',     color: '#f97316' },
  3: { label: 'Okay',     color: '#f59e0b' },
  4: { label: 'Good',     color: '#38bdf8' },
  5: { label: 'Excellent',color: '#22c55e' },
}
const EMPTY_DIET    = { meal_items: [], meal_times: { breakfast: '', lunch: '', dinner: '' }, notes: '' }
const EMPTY_WORKOUT = { steps: 0, post_dinner_walk: false, post_dinner_walk_minutes: 0, exercise_done: false, exercise_type: '', exercise_duration_minutes: 0, notes: '' }
const EMPTY_SLEEP   = { sleep_time: '', wake_time: '', sleep_hours: 0, quality: 3, notes: '', screen_time_hours: 0 }

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtHours(h) {
  if (!h || h <= 0) return '0 min'
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60), mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}min`
}
function calcHours(st, wt) {
  if (!st || !wt) return 0
  const [sh, sm] = st.split(':').map(Number), [wh, wm] = wt.split(':').map(Number)
  let s = sh * 60 + sm, w = wh * 60 + wm
  if (w <= s) w += 24 * 60
  return Math.round(((w - s) / 60) * 10) / 10
}
function tsToHHMM(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatElapsed(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function itemScore(item) {
  const ppp = item.pointsPerPortion || 0, p = item.portions || 1, ip = item.idealPortions
  if (item.category === 'bad' || ppp < 0) return p * ppp
  if (ip && ip > 0) return Math.min(p, ip) * ppp - Math.max(0, p - ip) * ppp * OVERAGE
  return p * ppp
}

// ── Fasting ───────────────────────────────────────────────────────────────────
function extractDinnerTime(diet) {
  const items = (diet?.meal_items || []).filter(i => i.mealType === 'dinner').map(i => i.time).filter(Boolean)
  return items.length ? [...items].sort().pop() : (diet?.meal_times?.dinner || diet?.dinner_time || null)
}
function extractBreakfastTime(diet) {
  const items = (diet?.meal_items || []).filter(i => i.mealType === 'breakfast').map(i => i.time).filter(Boolean)
  return items.length ? [...items].sort()[0] : (diet?.meal_times?.breakfast || null)
}
function fastingHoursFromData(todayDiet, yesterdayDiet) {
  const todayDinner = extractDinnerTime(todayDiet)
  if (todayDinner) {
    const [dh, dm] = todayDinner.split(':').map(Number)
    const dinnerMs = new Date(); dinnerMs.setHours(dh, dm, 0, 0)
    if ((Date.now() - dinnerMs.getTime()) / 3600000 >= 0)
      return { lastDinner: todayDinner, firstBf: null, hours: (Date.now() - dinnerMs.getTime()) / 3600000, complete: false, nextFast: true }
  }
  const lastDinner = extractDinnerTime(yesterdayDiet)
  if (!lastDinner) return { lastDinner: null, hours: 0, complete: false, nextFast: false }
  const firstBf = extractBreakfastTime(todayDiet)
  if (firstBf) {
    const [dh, dm] = lastDinner.split(':').map(Number), [bh, bm] = firstBf.split(':').map(Number)
    let d = dh * 60 + dm, b = bh * 60 + bm
    if (b <= d) b += 24 * 60
    return { lastDinner, firstBf, hours: (b - d) / 60, complete: true, nextFast: false }
  }
  const [dh, dm] = lastDinner.split(':').map(Number)
  const dinnerMs = new Date(); dinnerMs.setDate(dinnerMs.getDate() - 1); dinnerMs.setHours(dh, dm, 0, 0)
  return { lastDinner, firstBf: null, hours: Math.max(0, (Date.now() - dinnerMs.getTime()) / 3600000), complete: false, nextFast: false }
}

// ── Small shared sub-components ───────────────────────────────────────────────
function PillSelector({ options, value, onChange, formatter }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={value === o ? 'pill-option-active' : 'pill-option'}
          style={{ flex: '0 0 auto', minWidth: 52 }}>
          {formatter ? formatter(o) : o}
        </button>
      ))}
    </div>
  )
}

function SleepStatus({ time, type }) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (type === 'sleep') {
    if (h === 0 || h === 1) return <p className="text-xs text-danger mt-1.5">⚠ After midnight — penalty applies</p>
    if (h === 23 && m > 30)  return <p className="text-xs text-warning mt-1.5">● Just past 11:30 — partial score</p>
    if (h >= 22)             return <p className="text-xs text-success mt-1.5">✓ On time — full points</p>
  }
  if (type === 'wake') {
    if (h < 8 || (h === 8 && m === 0)) return <p className="text-xs text-success mt-1.5">✓ Wake time on target</p>
    if (h === 8)                        return <p className="text-xs text-warning mt-1.5">● Slightly late — partial score</p>
    if (h === 9 && m === 0)             return <p className="text-xs text-warning mt-1.5">● 9 AM — quarter pts</p>
    return <p className="text-xs text-danger mt-1.5">⚠ Late wake-up — no points</p>
  }
  return null
}

// ── MealSection (used inside the diet log sheet) ──────────────────────────────
// Food adding itself now happens in the shared AddMealFlow (bottom sheet with
// recommendations/search/AI-fallback/meal-builder) — this just lists what's
// already logged for the section and opens that flow, preset to this category.
function MealSection({ mealType, time, onTimeChange, items, onItemsChange, containerRef, onAddFood }) {
  const { icon, label, color, hint } = MEAL_META[mealType]
  const isSnacks = mealType === 'snacks'

  const mealItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.mealType === mealType)

  const remove = (idx) => onItemsChange(items.filter((_, i) => i !== idx))
  const changePortion = (idx, delta) =>
    onItemsChange(items.map((item, i) =>
      i === idx ? { ...item, portions: Math.max(0.5, Math.round((item.portions + delta) * 2) / 2) } : item
    ))

  return (
    <div ref={containerRef} className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
          <p className="text-xs text-text-muted">{hint}</p>
        </div>
        {!isSnacks && mealType !== 'drink' && mealType !== 'other' && (
          <input type="time" className="input py-1 px-2 text-xs w-28 shrink-0"
            value={time || ''} onChange={e => onTimeChange(e.target.value)} />
        )}
      </div>

      <div className="space-y-1.5">
        {mealItems.map(({ item, idx }) => {
          const pts = Math.round(itemScore(item) * 10) / 10
          const isOver = item.idealPortions && item.portions > item.idealPortions
          return (
            <div key={idx}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isOver ? 'border border-warning/30' : ''}`}
              style={{ background: isOver ? '#f59e0b0d' : 'rgb(var(--c-surface-elevated))' }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text-primary block truncate">{item.label}</span>
                {(isSnacks || mealType === 'drink' || mealType === 'other') && item.time && <span className="text-xs text-text-muted">{item.time}</span>}
                {item.idealPortions && (
                  <span className="text-xs" style={{ color: isOver ? '#f59e0b' : '#64748b' }}>
                    {isOver ? `⚠ over ideal (${item.idealPortions})` : `ideal: ${item.idealPortions} portions`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => changePortion(idx, -0.5)} className="w-6 h-6 rounded-lg border border-surface-border text-text-muted flex items-center justify-center"><Minus size={10} /></button>
                <span className="w-10 text-center text-xs font-semibold tabular-nums text-text-primary">×{item.portions}</span>
                <button onClick={() => changePortion(idx, 0.5)} className="w-6 h-6 rounded-lg border border-surface-border text-text-muted flex items-center justify-center"><Plus size={10} /></button>
              </div>
              <span className={`text-xs font-semibold w-14 text-right shrink-0 ${pts >= 0 ? 'text-success' : 'text-danger'}`}>{pts >= 0 ? '+' : ''}{pts} pts</span>
              <button onClick={() => remove(idx)} className="w-6 h-6 rounded-lg text-text-muted hover:text-danger flex items-center justify-center"><Trash2 size={11} /></button>
            </div>
          )
        })}
      </div>

      <button onClick={() => onAddFood(mealType)} className="flex items-center gap-1.5 text-xs font-medium py-0.5" style={{ color }}>
        <Plus size={13} />Add food to {label.toLowerCase()}
      </button>
    </div>
  )
}

// ── FastingWidget (in diet log sheet) ────────────────────────────────────────
function FastingWidget({ todayDiet, yesterdayDiet, weights }) {
  const [liveH, setLiveH] = useState(0)
  const { lastDinner, firstBf, hours, complete, nextFast } = fastingHoursFromData(todayDiet, yesterdayDiet)

  useEffect(() => {
    if (!lastDinner || complete) return
    const tick = () => { const { hours: h } = fastingHoursFromData(todayDiet, yesterdayDiet); setLiveH(h) }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [lastDinner, complete])

  const fc       = weights?.fasting || {}
  const minH     = fc.min_hours    ?? 12
  const targetH  = fc.target_hours ?? 16
  const maxPts   = fc.max_points   ?? 10
  const displayH = complete ? hours : liveH
  const fastPts  = displayH < minH ? 0
    : displayH >= targetH + 2 ? maxPts
    : (() => {
        const mid = (minH + targetH) / 2
        const k   = 6 / Math.max(targetH - minH, 1)
        return Math.round(maxPts / (1 + Math.exp(-k * (displayH - mid))) * 10) / 10
      })()
  const pct   = Math.min(displayH / targetH, 1)
  const color = displayH >= targetH ? '#22c55e' : displayH >= minH ? '#f59e0b' : '#64748b'

  if (!lastDinner) return (
    <div className="card space-y-2">
      <div className="flex items-center gap-2"><Timer size={14} className="text-text-muted" /><h2 className="text-sm font-semibold text-text-primary">Intermittent Fasting</h2></div>
      <p className="text-xs text-text-muted">Log dinner with a time — tomorrow's fasting window will calculate automatically.</p>
    </div>
  )

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Timer size={14} style={{ color }} />
        <h2 className="text-sm font-semibold text-text-primary">Intermittent Fasting</h2>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${color}20`, color }}>
          {complete ? 'Complete' : 'In progress'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold tabular-nums" style={{ color }}>{fmtHours(displayH)}</p>
          <p className="text-xs text-text-muted">
            {complete ? `${lastDinner} → ${firstBf} · window complete`
              : nextFast ? `next fast started · dinner at ${lastDinner}`
              : `since last dinner (${lastDinner} yesterday)`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums" style={{ color: fastPts > 0 ? '#22c55e' : '#64748b' }}>+{fastPts}</p>
          <p className="text-xs text-text-muted">/ {maxPts} pts</p>
        </div>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct * 100}%`, backgroundColor: color }} /></div>
      <div className="flex justify-between text-xs text-text-muted"><span>Min: {minH}h</span><span>Target: {targetH}h</span></div>
    </div>
  )
}

// ── Calorie & macro tracking ───────────────────────────────────────────────────
function MacroRow({ label, value, range, color }) {
  const pct  = range.max > 0 ? Math.min((value / range.max) * 100, 100) : 0
  const over = value > range.max
  const left = range.max - value
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: over ? '#f97316' : 'rgb(var(--c-text-primary))' }}>
          {value}<span className="text-text-muted font-normal"> / {range.min}–{range.max} g</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${over ? '#f97316' : color})` }} />
      </div>
      <p className="text-xs mt-1" style={{ color: over ? '#f97316' : 'rgb(var(--c-text-muted))' }}>
        {over ? `${Math.abs(left)} g over` : `${left} g left`}
      </p>
    </div>
  )
}

function CalorieCard({ items, dietetics, weights }) {
  if (!dietetics) return null
  const totals = calcNutritionTotals({ meal_items: items })
  if (!totals.hasData) return null

  const target  = dietetics.energy
  const pct     = Math.min((totals.kcal / target) * 100, 100)
  const left    = target - totals.kcal
  const score   = calcCalorieScore({ meal_items: items }, dietetics, weights || {})
  const partial = totals.coverage < (weights?.calories?.min_coverage ?? 0.7)

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🔥</span>
        <h2 className="text-sm font-semibold text-text-primary flex-1">Calories</h2>
        {score != null && <span className="badge badge-brand">+{score} pts</span>}
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <p className="text-2xl font-bold tabular-nums text-text-primary">
            {totals.kcal}<span className="text-sm font-normal text-text-muted"> / {target} kcal</span>
          </p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: left < 0 ? '#f97316' : '#22c55e' }}>
            {left < 0 ? `${Math.abs(left)} over` : `${left} left`}
          </p>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-surface-elevated">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: left < 0
              ? 'linear-gradient(90deg,#f9731699,#f97316)'
              : 'linear-gradient(90deg,#22c55e99,#22c55e)' }} />
        </div>
      </div>

      <div className="space-y-2.5 pt-0.5">
        <MacroRow label="Protein" value={totals.protein} range={dietetics.proteins} color="#22c55e" />
        <MacroRow label="Carbs"   value={totals.carbs}   range={dietetics.carbs}    color="#38bdf8" />
        <MacroRow label="Fat"     value={totals.fat}     range={dietetics.fat}      color="#f59e0b" />
      </div>

      {partial && (
        <p className="text-xs text-warning border-t border-surface-border pt-2.5">
          Only {Math.round(totals.coverage * 100)}% of what you logged has calorie data — not enough
          to score yet. Add nutrition to your foods in Settings.
        </p>
      )}
    </div>
  )
}

// ── Summary Cards ─────────────────────────────────────────────────────────────
function DietSummaryCard({ form, yesterdayDiet, weights, onMealTap }) {
  const [liveH, setLiveH] = useState(0)
  const { lastDinner, hours, complete, nextFast } = fastingHoursFromData(form, yesterdayDiet)

  useEffect(() => {
    if (!lastDinner || complete) return
    const tick = () => { const { hours: h } = fastingHoursFromData(form, yesterdayDiet); setLiveH(h) }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [lastDinner, complete])

  const fc      = weights?.fasting || {}
  const targetH = fc.target_hours ?? 16
  const minH    = fc.min_hours ?? 12
  const displayH = complete ? hours : liveH
  const fastColor = displayH >= targetH ? '#22c55e' : displayH >= minH ? '#f59e0b' : '#64748b'

  return (
    <div className="card space-y-4">
      {/* Meal status grid */}
      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map(meal => {
          const meta = MEAL_META[meal]
          const mealItems = (form.meal_items || []).filter(i => i.mealType === meal)
          const hasItems = mealItems.length > 0
          const pts = Math.round(mealItems.reduce((s, i) => s + itemScore(i), 0) * 10) / 10
          return (
            <button key={meal} onClick={() => onMealTap?.(meal)}
              className="rounded-xl p-2.5 text-center transition-all active:scale-95 hover:brightness-110"
              style={{ background: hasItems ? `${meta.color}18` : 'rgb(var(--c-surface-elevated))' }}>
              <p className="text-base">{meta.icon}</p>
              <p className="text-[10px] font-medium text-text-muted mt-0.5">{meta.label}</p>
              {hasItems ? (
                <p className="text-xs font-semibold mt-0.5" style={{ color: pts >= 0 ? meta.color : '#ef4444' }}>
                  {mealItems.length} item{mealItems.length > 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-xs text-text-muted mt-0.5">+ add</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Fasting mini-row */}
      <div className="flex items-center gap-2 border-t border-surface-border pt-3">
        <Timer size={13} style={{ color: fastColor }} />
        {lastDinner ? (
          <>
            <span className="text-sm font-semibold tabular-nums" style={{ color: fastColor }}>{fmtHours(displayH)}</span>
            <span className="text-xs text-text-muted">
              {complete ? 'fast complete' : nextFast ? 'next fast started' : 'fasting in progress'}
            </span>
          </>
        ) : (
          <span className="text-xs text-text-muted">Log dinner with a time to track fasting</span>
        )}
      </div>
    </div>
  )
}

function WorkoutSummaryCard({ form, hcStatus, hcPermission, hcNoData, stepSource, stepSyncedAt, onSync, syncing }) {
  const stepColor = form.steps >= 10000 ? '#f59e0b' : form.steps >= 8000 ? '#22c55e' : form.steps >= 5000 ? '#f97316' : '#ef4444'
  const stepPct   = Math.min((form.steps / 10000) * 100, 100)
  const sourceLabel = stepSource === 'health_connect' ? 'Health Connect'
    : stepSource === 'sensor' ? 'Phone sensor'
    : stepSource === 'manual' ? 'Manual entry'
    : null

  return (
    <div className="card space-y-4">
      {/* Big step count */}
      <div className="text-center py-2">
        <p className="text-5xl font-bold tabular-nums" style={{ color: stepColor }}>{form.steps.toLocaleString()}</p>
        <p className="text-xs text-text-muted mt-1.5">steps today</p>
        {sourceLabel && (
          <p className="text-[10px] text-text-muted mt-0.5 opacity-70">
            {sourceLabel}{stepSyncedAt ? ` · ${tsToHHMM(stepSyncedAt)}` : ''}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-text-muted">
          <span>0</span><span style={{ color: stepColor }}>8,000 target</span><span>10,000+</span>
        </div>
        <div className="progress-track h-2"><div className="progress-fill" style={{ width: `${stepPct}%`, backgroundColor: stepColor }} /></div>
      </div>

      {/* Walk & Exercise chips */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: form.post_dinner_walk ? '#22c55e15' : 'rgb(var(--c-surface-elevated))' }}>
          <p className="text-base">🚶</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: form.post_dinner_walk ? '#22c55e' : 'rgb(var(--c-text-muted))' }}>
            {form.post_dinner_walk ? `Walk · ${form.post_dinner_walk_minutes}min` : 'Walk bonus ready'}
          </p>
        </div>
        <div className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: form.exercise_done ? '#38bdf815' : 'rgb(var(--c-surface-elevated))' }}>
          <p className="text-base">⚡</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: form.exercise_done ? '#38bdf8' : 'rgb(var(--c-text-muted))' }}>
            {form.exercise_done ? (form.exercise_type || 'Exercise done') : 'Exercise bonus ready'}
          </p>
        </div>
      </div>

      {hcStatus === 'Available' && hcPermission !== 'denied' && !hcNoData && (
        <button onClick={onSync} disabled={syncing}
          className="flex items-center justify-center gap-1.5 w-full text-xs px-3 py-2 rounded-xl bg-info/10 text-info border border-info/20 active:opacity-70">
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing steps…' : 'Sync from Health Connect'}
        </button>
      )}
      {hcStatus === 'Available' && hcPermission !== 'denied' && hcNoData && (
        <div className="space-y-2 p-3 rounded-xl border" style={{ background: '#f59e0b10', borderColor: '#f59e0b30' }}>
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-warning">No step source connected.</span>{' '}
            Health Connect is ready but no app is writing steps to it. Open Google Fit or Samsung Health, let it run for a minute, then sync.
          </p>
          <button onClick={onSync} disabled={syncing}
            className="flex items-center justify-center gap-1.5 w-full text-xs px-3 py-2 rounded-xl bg-info/10 text-info border border-info/20 active:opacity-70">
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Try Sync Again'}
          </button>
        </div>
      )}
      {hcStatus === 'Available' && hcPermission === 'denied' && (
        <div className="space-y-2 p-3 rounded-xl border" style={{ background: '#38bdf810', borderColor: '#38bdf830' }}>
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-info">Steps access not granted.</span>{' '}
            Connect Health Connect to auto-sync your step count.
          </p>
          <button onClick={onSync} disabled={syncing}
            className="flex items-center justify-center gap-1.5 w-full text-xs px-3 py-2 rounded-xl bg-info/10 text-info border border-info/20 active:opacity-70">
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Connecting…' : 'Connect Health Connect'}
          </button>
        </div>
      )}
      {hcStatus === 'NotInstalled' && (
        <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ background: '#38bdf810', borderColor: '#38bdf830' }}>
          <RefreshCw size={12} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-info">Health Connect not installed.</span>{' '}
            Install it from the Play Store to auto-sync steps.
            Samsung users: also connect Samsung Health → Settings → Connected Services → Health Connect.
          </p>
        </div>
      )}
    </div>
  )
}

function SleepSummaryCard({ form, timerStart, elapsed, weights }) {
  const today        = format(new Date(), 'yyyy-MM-dd')
  const sleepLogged  = !timerStart && !!form.sleep_time && form.sleep_hours > 0
  const effHours     = Math.max(0, (form.sleep_hours || 0) - (form.screen_time_hours || 0))
  const dispHours    = effHours > 0 ? effHours : (form.sleep_hours || 0)
  const hoursColor   = dispHours >= 7 ? '#22c55e' : dispHours >= 6 ? '#f59e0b' : dispHours > 0 ? '#ef4444' : '#64748b'
  const ew           = weights || DEFAULT_WEIGHTS
  const sleepPtsDisplay = (() => {
    const base = calcSleepScore(form, ew)
    let penalty = 0
    if (form.sleep_time) { const [h] = form.sleep_time.split(':').map(Number); if (h === 0 || h === 1) penalty = ew.penalties?.sleep_after_midnight || -8 }
    return Math.max(0, base + penalty)
  })()

  if (timerStart) return (
    <div className="card" style={{ background: 'linear-gradient(135deg, #a78bfa0a 0%, #7c3aed06 100%)' }}>
      <div className="text-center py-3">
        <p className="text-4xl font-bold tabular-nums mb-1" style={{ color: '#a78bfa' }}>{formatElapsed(elapsed)}</p>
        <p className="text-xs text-text-muted">Fell asleep at {tsToHHMM(timerStart)} · {format(new Date(timerStart), 'MMM d')}</p>
        <p className="text-xs text-text-muted mt-1 opacity-60">Screen time deducted automatically on wake-up</p>
      </div>
    </div>
  )

  if (sleepLogged) return (
    <div className="card border-2" style={{ borderColor: '#a78bfa40', background: 'linear-gradient(135deg, #a78bfa08 0%, #7c3aed05 100%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={15} style={{ color: '#22c55e' }} />
        <span className="text-sm font-semibold text-text-primary">
          {form.date === today ? "Tonight's Sleep" : "Last Night's Sleep"}
        </span>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#a78bfa20', color: '#a78bfa' }}>
          {sleepPtsDisplay} / {ew.sleep_max || 30} pts
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold tabular-nums" style={{ color: hoursColor }}>{fmtHours(form.sleep_hours)}</span>
        <span className="text-sm text-text-muted">total sleep</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-elevated rounded-xl px-3 py-2">
          <p className="text-xs text-text-muted">🌙 Fell asleep</p>
          <p className="text-sm font-semibold">{form.sleep_time}</p>
        </div>
        <div className="bg-surface-elevated rounded-xl px-3 py-2">
          <p className="text-xs text-text-muted">🌅 Woke up</p>
          <p className="text-sm font-semibold">{form.wake_time || '—'}</p>
        </div>
        {(form.screen_time_hours || 0) > 0 && (
          <>
            <div className="bg-surface-elevated rounded-xl px-3 py-2">
              <p className="text-xs text-text-muted">📱 Screen</p>
              <p className="text-sm font-semibold text-warning">{fmtHours(form.screen_time_hours)}</p>
            </div>
            <div className="bg-surface-elevated rounded-xl px-3 py-2">
              <p className="text-xs text-text-muted">😴 Effective</p>
              <p className="text-sm font-semibold" style={{ color: hoursColor }}>{fmtHours(effHours)}</p>
            </div>
          </>
        )}
      </div>
      <p className="text-xs mt-3 font-medium" style={{ color: dispHours >= 7 ? '#22c55e' : '#f97316' }}>
        {dispHours >= 7 ? '✓ 7+ hour target met' : `Need ${fmtHours(Math.max(0, 7 - dispHours))} more effective sleep`}
      </p>
    </div>
  )

  return (
    <div className="card">
      <div className="text-center py-8">
        <p className="text-4xl mb-3">😴</p>
        <p className="text-sm font-semibold text-text-primary">No sleep logged yet</p>
        <p className="text-xs text-text-muted mt-1">Start the timer at bedtime or enter times manually</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const { fetchTodayScore, streak } = useStore()
  const [searchParams] = useSearchParams()

  const [tab, setTab]           = useState(searchParams.get('tab') || 'diet')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTargetMeal, setSheetTargetMeal] = useState(null)
  const sheetScrollRef  = useRef(null)
  const mealSectionRefs = useRef({})
  const touchStartX     = useRef(null)

  const [addMealFlowOpen, setAddMealFlowOpen] = useState(false)
  const [addMealFlowCategory, setAddMealFlowCategory] = useState(null)
  const openAddMealFlow = (category) => { setAddMealFlowCategory(category); setAddMealFlowOpen(true) }
  const handleMealLogged = async () => {
    const data = await getDiet(today)
    if (data) setDietForm(f => ({ ...f, ...data, meal_items: data.meal_items || [], meal_times: data.meal_times || f.meal_times }))
    await fetchTodayScore()
  }

  const TABS = ['diet', 'workout', 'sleep']
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 60) return
    const idx = TABS.indexOf(tab)
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1])
    if (dx > 0 && idx > 0) setTab(TABS[idx - 1])
  }

  // Diet state
  const [dietForm, setDietForm]           = useState({ ...EMPTY_DIET, date: today })
  const [customOptions, setCustomOptions] = useState([])
  const [weights, setWeights]             = useState(null)
  const [yesterdayDiet, setYesterdayDiet] = useState(null)
  const [dietetics, setDietetics]         = useState(null)

  // Workout state
  const [workoutForm, setWorkoutForm] = useState({ ...EMPTY_WORKOUT, date: today })
  const [hcStatus, setHcStatus]       = useState(null)   // 'Available' | 'NotInstalled' | 'NotSupported'
  const [hcPermission, setHcPermission] = useState(null) // 'granted' | 'denied'
  const [stepSource, setStepSource]   = useState(null)   // 'health_connect' | 'sensor' | 'manual'
  const [stepSyncedAt, setStepSyncedAt] = useState(null) // timestamp ms
  const [syncingHC, setSyncingHC] = useState(false)
  const [hcNoData, setHcNoData]   = useState(false)  // HC connected+permitted but no app writing steps

  // Sleep state
  const [sleepForm, setSleepForm]         = useState({ ...EMPTY_SLEEP, date: today })
  const [timerStart, setTimerStart]       = useState(() => {
    const v = localStorage.getItem(TIMER_KEY)
    return v ? parseInt(v, 10) : null
  })
  const [elapsed, setElapsed]             = useState(0)
  const [manualSleepOpen, setManualSleepOpen] = useState(false)
  const intervalRef                       = useRef(null)

  const [saving, setSaving] = useState(false)

  // ── Load all data on mount ──
  useEffect(() => {
    getDiet(today).then(data => {
      if (data) setDietForm({
        ...EMPTY_DIET, ...data,
        meal_items: data.meal_items || [],
        meal_times: data.meal_times || { breakfast: '', lunch: '', dinner: data.dinner_time || '' },
        date: today,
      })
    })
    getDiet(yesterday).then(setYesterdayDiet)
    Promise.all([getConfig(), getLatestWeight()]).then(([items, latestWeight]) => {
      const map = {}
      items.forEach(i => { map[i.key] = i.value })
      if (map.custom_meal_options) { try { setCustomOptions(JSON.parse(map.custom_meal_options)) } catch {} }
      if (map.score_weights)       { try { setWeights(JSON.parse(map.score_weights)) } catch {} }
      setDietetics(latestWeight ? dieteticsFromConfig(map, latestWeight.weight_kg) : null)
    })
    getWorkout(today).then(existingData => {
      if (existingData) setWorkoutForm({ ...EMPTY_WORKOUT, ...existingData, date: today })
      if (Capacitor.isNativePlatform()) {
        HealthConnect.checkAvailability().then(async r => {
          setHcStatus(r.availability)
          if (r.availability === 'Available') {
            try {
              // checkHealthPermissions = silent check, no dialog (requestHealthPermissions launches an Activity)
              const perm = await HealthConnect.checkHealthPermissions({ read: ['Steps'], write: [] })
              if (!perm.hasAllPermissions) {
                setHcPermission('denied')
                try {
                  const sr = await UsageStats.getTodaySteps()
                  if (sr.available && sr.steps > 0) {
                    setWorkoutForm(f => ({ ...f, steps: sr.steps }))
                    setStepSource('sensor'); setStepSyncedAt(Date.now())
                    await saveWorkout({ ...(existingData || EMPTY_WORKOUT), date: today, steps: sr.steps })
                  }
                } catch {}
                return
              }
              setHcPermission('granted')
              const start = new Date(); start.setHours(0, 0, 0, 0)
              const end   = new Date(); end.setHours(23, 59, 59, 999)
              const result = await HealthConnect.readRecords({
                type: 'Steps',
                timeRangeFilter: { type: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
              })
              const byOrigin = {}
              for (const rec of result.records) { const o = rec.metadata?.dataOrigin ?? 'unknown'; byOrigin[o] = (byOrigin[o] || 0) + (rec.count || 0) }
              const total = Object.values(byOrigin).length > 0 ? Math.max(...Object.values(byOrigin)) : 0
              if (total > 0) {
                setHcNoData(false)
                setWorkoutForm(f => ({ ...f, steps: total }))
                setStepSource('health_connect'); setStepSyncedAt(Date.now())
                await saveWorkout({ ...(existingData || EMPTY_WORKOUT), date: today, steps: total })
              } else {
                // HC has no step data — no fitness app is writing to it on this device
                setHcNoData(true)
                try {
                  const sr = await UsageStats.getTodaySteps()
                  if (sr.available && sr.steps > 0) {
                    setWorkoutForm(f => ({ ...f, steps: sr.steps }))
                    setStepSource('sensor'); setStepSyncedAt(Date.now())
                    await saveWorkout({ ...(existingData || EMPTY_WORKOUT), date: today, steps: sr.steps })
                  }
                } catch {}
              }
            } catch (e) {
              console.error('HC auto-sync error', e)
            }
          } else {
            try {
              const sr = await UsageStats.getTodaySteps()
              if (sr.available && sr.steps > 0) {
                setWorkoutForm(f => ({ ...f, steps: sr.steps }))
                setStepSource('sensor'); setStepSyncedAt(Date.now())
                await saveWorkout({ ...(existingData || EMPTY_WORKOUT), date: today, steps: sr.steps })
              }
            } catch {}
          }
        }).catch(() => {})
      }
    })
    getSleep(today).then(data => {
      if (data) {
        setSleepForm({ ...EMPTY_SLEEP, ...data, date: today })
      } else if (!localStorage.getItem(TIMER_KEY)) {
        // Only fall back to yesterday's record if the timer is NOT running.
        // When the timer is running, stopTimer() will save to today — loading
        // yesterday's data here would cause manual saves to overwrite the wrong date.
        getSleep(yesterday).then(yd => {
          if (yd) setSleepForm({ ...EMPTY_SLEEP, ...yd, date: today })
        })
      }
    })
  }, [])

  // ── Scroll to target meal when sheet opens ──
  useEffect(() => {
    if (!sheetOpen || !sheetTargetMeal) return
    const el = mealSectionRefs.current[sheetTargetMeal]
    if (!el || !sheetScrollRef.current) return
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320)
  }, [sheetOpen, sheetTargetMeal])

  // ── Sleep timer interval ──
  useEffect(() => {
    if (timerStart) {
      const tick = () => setElapsed(Math.floor((Date.now() - timerStart) / 1000))
      tick(); intervalRef.current = setInterval(tick, 1000)
    } else {
      clearInterval(intervalRef.current); setElapsed(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerStart])

  // ── Sleep timer handlers ──
  const startTimer = () => {
    const now = Date.now()
    localStorage.setItem(TIMER_KEY, String(now))
    setTimerStart(now)
    toast.success('Sleep timer started. Open the app when you wake up to log effective sleep.')
  }

  const stopTimer = async () => {
    if (!timerStart) return
    const now = Date.now()
    let screenOnHours = 0
    if (Capacitor.isNativePlatform()) {
      try {
        const permResult = await UsageStats.hasPermission()
        if (permResult.granted) {
          const result = await UsageStats.getScreenOnTime({ startTime: timerStart, endTime: now })
          if (!result.needsPermission) screenOnHours = result.screenOnHours ?? 0
        }
        // No permission → screenOnHours stays 0; timer stops normally without screen-time deduction
      } catch {}
    }
    const sleepTime  = tsToHHMM(timerStart)
    const wakeTime   = tsToHHMM(now)
    const totalSecs  = Math.floor((now - timerStart) / 1000)
    const sleepHours = Math.round((totalSecs / 3600) * 10) / 10
    const logDate    = format(new Date(), 'yyyy-MM-dd')
    const effective  = Math.max(0, Math.round((sleepHours - screenOnHours) * 10) / 10)

    localStorage.removeItem(TIMER_KEY); setTimerStart(null)

    if (sleepHours < 1) {
      toast(`Timer cleared — only ${fmtHours(sleepHours)} elapsed, nothing saved.`, { icon: '⏱' }); return
    }
    const sleepData = { ...sleepForm, date: logDate, sleep_time: sleepTime, wake_time: wakeTime, sleep_hours: sleepHours, screen_time_hours: screenOnHours }
    setSleepForm(sleepData)
    try {
      await saveSleep(sleepData); await fetchTodayScore()
      scheduleSmartNotifications().catch(() => {})
      scheduleTrendNotifications().catch(() => {})
      toast.success(`Sleep saved — ${fmtHours(sleepHours)} total · ${fmtHours(screenOnHours)} screen · ${fmtHours(effective)} effective`)
    } catch { toast.error('Sleep recorded but save failed — tap Save to retry') }
  }

  // ── Health Connect sync ──
  const fetchFromHealthConnect = async () => {
    setSyncingHC(true)
    try {
      const perm = await HealthConnect.requestHealthPermissions({ read: ['Steps'], write: [] })
      if (!perm.hasAllPermissions) {
        setHcPermission('denied')
        try {
          const sr = await UsageStats.getTodaySteps()
          if (sr.available && sr.steps > 0) {
            setWorkoutForm(f => ({ ...f, steps: sr.steps }))
            setStepSource('sensor'); setStepSyncedAt(Date.now())
            toast.success(`${sr.steps.toLocaleString()} steps from phone sensor`)
          } else {
            toast.error('Steps permission not granted — grant it in Health Connect settings')
          }
        } catch { toast.error('Steps permission not granted — grant it in Health Connect settings') }
        return
      }
      setHcPermission('granted')
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end   = new Date(); end.setHours(23, 59, 59, 999)
      const result = await HealthConnect.readRecords({
        type: 'Steps',
        timeRangeFilter: { type: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      })
      const byOrigin = {}
      for (const rec of result.records) { const o = rec.metadata?.dataOrigin ?? 'unknown'; byOrigin[o] = (byOrigin[o] || 0) + (rec.count || 0) }
      const total = Object.values(byOrigin).length > 0 ? Math.max(...Object.values(byOrigin)) : 0
      if (total === 0) {
        setHcNoData(true)
        try {
          const sr = await UsageStats.getTodaySteps()
          if (sr.available && sr.steps > 0) {
            setWorkoutForm(f => ({ ...f, steps: sr.steps }))
            setStepSource('sensor'); setStepSyncedAt(Date.now())
            toast('No data in Health Connect — showing phone sensor steps', { icon: '📱' })
          } else {
            toast('No step data found. Open Google Fit or Samsung Health, let it run, then try again.', { icon: '💡' })
          }
        } catch { toast('No step data found in Health Connect', { icon: '📊' }) }
        return
      }
      if (total === workoutForm.steps) { toast('No new data found', { icon: '📊' }); return }
      setHcNoData(false)
      setWorkoutForm(f => ({ ...f, steps: total }))
      setStepSource('health_connect'); setStepSyncedAt(Date.now())
      toast.success(`Synced ${total.toLocaleString()} steps from Health Connect`)
    } catch { toast.error('Could not read Health Connect data') }
    finally { setSyncingHC(false) }
  }

  // ── Save handler ──
  const handleSave = async () => {
    setSaving(true)
    try {
      if (tab === 'diet') {
        const dinnerTime = dietForm.meal_times?.dinner || ''
        await saveDiet({ ...dietForm, dinner_time: dinnerTime })
        if (Capacitor.isNativePlatform() && dinnerTime) {
          try {
            const [h, m] = dinnerTime.split(':').map(Number)
            const dinnerMs = new Date(); dinnerMs.setHours(h, m, 0, 0)
            const walkAt = new Date(dinnerMs.getTime() + 35 * 60 * 1000)
            if (walkAt > new Date()) {
              await LocalNotifications.cancel({ notifications: [{ id: 6 }] })
              await LocalNotifications.schedule({ notifications: [{ id: 6, title: 'Post-dinner walk time!', body: 'A 10–15 min walk earns 10 pts and boosts digestion.', schedule: { at: walkAt } }] })
            }
          } catch {}
        }
        toast.success(`Diet saved — +${dietPts} pts`)
      } else if (tab === 'workout') {
        await saveWorkout(workoutForm)
        toast.success(`Workout saved — +${workoutPts} pts`)
      } else {
        await saveSleep({ ...sleepForm, date: today })
        toast.success(`Sleep saved — +${sleepPts} pts`)
      }
      await fetchTodayScore()
      scheduleSmartNotifications().catch(() => {})
      scheduleTrendNotifications().catch(() => {})
      if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      setSheetOpen(false)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Derived ──
  const w = weights || DEFAULT_WEIGHTS
  const dietPts = (() => {
    const base = calcDietScore(dietForm, w, customOptions)
    const dt = dietForm.meal_times?.dinner
    let penalty = 0
    if (dt) { const [h] = dt.split(':').map(Number); if (h >= 21) penalty = w.penalties?.dinner_after_9pm || -5 }
    return Math.max(0, base + penalty)
  })()
  const workoutPts = calcWorkoutScore(workoutForm, w)
  const sleepPts = (() => {
    const base = calcSleepScore(sleepForm, w)
    let penalty = 0
    if (sleepForm.sleep_time) {
      const [h] = sleepForm.sleep_time.split(':').map(Number)
      if (h === 0 || h === 1) penalty = w.penalties?.sleep_after_midnight || -8
    }
    return Math.max(0, base + penalty)
  })()
  const sleepLogged = !timerStart && !!sleepForm.sleep_time && sleepForm.sleep_hours > 0

  const TAB_CONFIG = {
    diet:    { label: 'Diet',    Icon: Utensils, color: '#22c55e', pts: dietPts,    max: w.diet_max    || 35 },
    workout: { label: 'Workout', Icon: Dumbbell, color: '#38bdf8', pts: workoutPts, max: w.workout_max || 35 },
    sleep:   { label: 'Sleep',   Icon: Moon,     color: '#a78bfa', pts: sleepPts,   max: w.sleep_max   || 30 },
  }
  const active     = TAB_CONFIG[tab]
  const ActiveIcon = active.Icon

  // Form setters
  const setDietTime  = (meal, val) => setDietForm(f => ({ ...f, meal_times: { ...f.meal_times, [meal]: val } }))
  const setDietItems = (items)     => setDietForm(f => ({ ...f, meal_items: items }))
  const setW         = (key, val)  => setWorkoutForm(f => ({ ...f, [key]: val }))
  const setSleep     = (key, val)  => setSleepForm(f => {
    const updated = { ...f, [key]: val }
    if (key === 'sleep_time' || key === 'wake_time')
      updated.sleep_hours = calcHours(key === 'sleep_time' ? val : updated.sleep_time, key === 'wake_time' ? val : updated.wake_time)
    return updated
  })
  const applyPreset = (p) => setSleepForm(f => ({ ...f, sleep_time: p.sleep, wake_time: p.wake, sleep_hours: calcHours(p.sleep, p.wake) }))

  const missionText = (() => {
    if (tab === 'diet') {
      if (active.pts === 0) return 'Log your meals to start earning XP'
      if (active.pts >= active.max) return 'Diet quest complete — max XP earned! 🏆'
      return `${active.max - active.pts} pts left — keep logging`
    }
    if (tab === 'workout') {
      const steps = workoutForm.steps || 0
      const target = 8000
      if (steps === 0) return 'Start moving to earn workout XP'
      if (steps >= 10000) return '10K+ steps — legendary effort! 🔥'
      if (steps >= target) return `Target hit! ${(10000 - steps).toLocaleString()} more for max`
      return `${(target - steps).toLocaleString()} steps to unlock full XP`
    }
    if (tab === 'sleep') {
      if (!sleepForm.sleep_time) return 'Log your sleep to earn recovery XP'
      if (active.pts >= active.max) return 'Sleep quest complete — full recovery! 🌟'
      return `${active.max - active.pts} pts left — optimize your sleep`
    }
    return ''
  })()

  const logCTA = tab === 'diet'    ? '🥗 Start Diet Quest'
               : tab === 'workout' ? '⚡ Power Up Workout'
               : sleepLogged       ? '🌙 Edit Sleep Log'
               :                    '🌙 Log Sleep Recovery'

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">

      {/* ── Sticky page-header strip ── */}
      <div className="page-header">
        <div className="p-2 rounded-xl border" style={{ background: `${active.color}15`, borderColor: `${active.color}30` }}>
          <ActiveIcon size={16} style={{ color: active.color }} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Activity</h1>
          <p className="text-xs text-text-muted">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-surface-elevated border border-surface-border">
            <Flame size={12} className="text-orange-400" />
            <span className="text-xs font-bold text-text-primary">{streak}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>

        {/* ── Hero Momentum Zone ── */}
        <div className="rounded-3xl p-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${active.color}1a, ${active.color}08)`, border: `1px solid ${active.color}30` }}>
          <div className="absolute -top-4 -right-8 w-28 h-28 rounded-full pointer-events-none"
            style={{ background: active.color, filter: 'blur(40px)', opacity: 0.12 }} />
          <div className="flex items-center gap-4 relative">
            <div className="shrink-0">
              <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl"
                style={{ background: `${active.color}20` }}>
                <span className="text-2xl">{tab === 'diet' ? '🥗' : tab === 'workout' ? '⚡' : '🌙'}</span>
                {active.pts >= active.max && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ background: active.color }}>✓</div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: active.color }}>
                {active.label} Quest
              </p>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-2xl font-black tabular-nums text-text-primary">{active.pts}</span>
                <span className="text-sm text-text-muted">/ {active.max} XP</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgb(var(--c-surface-elevated))' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((active.pts / active.max) * 100, 100)}%`, background: active.color, boxShadow: active.pts > 0 ? `0 0 6px ${active.color}80` : 'none' }} />
              </div>
              <p className="text-[10px] text-text-muted leading-tight">{missionText}</p>
            </div>
          </div>
        </div>

        {/* ── Tab toggle ── */}
        <div className="grid grid-cols-3 gap-1 bg-surface-elevated rounded-2xl p-1">
          {Object.entries(TAB_CONFIG).map(([key, { label, Icon, color }]) => {
            const isActive = tab === key
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive ? 'bg-surface-card shadow-sm' : ''}`}
                style={{ color: isActive ? color : 'rgb(var(--c-text-muted))' }}>
                <Icon size={13} strokeWidth={isActive ? 2.5 : 1.5} />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Summary card ── */}
        {tab === 'diet'    && <DietSummaryCard    form={dietForm}    yesterdayDiet={yesterdayDiet} weights={weights}
          onMealTap={meal => { setSheetTargetMeal(meal); setSheetOpen(true) }} />}
        {tab === 'diet'    && <CalorieCard items={dietForm.meal_items} dietetics={dietetics} weights={weights} />}
        {tab === 'workout' && <WorkoutSummaryCard form={workoutForm} hcStatus={hcStatus} hcPermission={hcPermission} hcNoData={hcNoData} stepSource={stepSource} stepSyncedAt={stepSyncedAt} onSync={fetchFromHealthConnect} syncing={syncingHC} />}
        {tab === 'sleep'   && <SleepSummaryCard   form={sleepForm}   timerStart={timerStart} elapsed={elapsed} weights={w} />}

        {/* ── Primary action button ── */}
        {tab === 'sleep' && timerStart ? (
          <button onClick={stopTimer}
            className="btn w-full text-white font-semibold text-sm py-4 rounded-2xl"
            style={{ background: '#22c55e' }}>
            <Square size={16} /> Wake Up — Stop Timer
          </button>
        ) : (
          <button onClick={() => setSheetOpen(true)}
            className="btn w-full font-semibold text-sm py-4 rounded-2xl"
            style={{ background: active.color, color: tab === 'workout' ? '#0f172a' : 'white', boxShadow: `0 4px 16px ${active.color}50` }}>
            {logCTA}
          </button>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${sheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSheetOpen(false); setSheetTargetMeal(null) }} />

        {/* Panel */}
        <div className={`absolute bottom-0 left-0 right-0 bg-surface-card rounded-t-3xl max-h-[88vh] flex flex-col transition-transform duration-300 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-surface-border" />
          </div>

          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border shrink-0">
            <div className="flex items-center gap-2">
              <ActiveIcon size={15} style={{ color: active.color }} />
              <h2 className="text-sm font-semibold text-text-primary">
                {tab === 'sleep' && sleepLogged ? 'Edit Sleep Log' : `Log ${active.label}`}
              </h2>
            </div>
            <button onClick={() => { setSheetOpen(false); setSheetTargetMeal(null) }}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Scrollable form content */}
          <div ref={sheetScrollRef} className="overflow-y-auto flex-1 px-4 py-4 space-y-3">

            {/* ── Diet form ── */}
            {tab === 'diet' && <>
              {MEAL_TYPES.map(mt => (
                <MealSection key={mt} mealType={mt}
                  time={dietForm.meal_times?.[mt]} onTimeChange={v => setDietTime(mt, v)}
                  items={dietForm.meal_items} onItemsChange={setDietItems}
                  onAddFood={openAddMealFlow}
                  containerRef={el => { mealSectionRefs.current[mt] = el }} />
              ))}
              <FastingWidget todayDiet={dietForm} yesterdayDiet={yesterdayDiet} weights={weights} />
              <div className="card">
                <label className="section-label block mb-2">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="Anything to note about today's diet..."
                  value={dietForm.notes || ''} onChange={e => setDietForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </>}

            {/* ── Workout form ── */}
            {tab === 'workout' && <>
              <div className="card space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">👟</span>
                  <h2 className="text-sm font-semibold text-text-primary">Daily Steps</h2>
                  <span className="badge ml-auto" style={{ background: '#22c55e20', color: '#22c55e' }}>
                    {workoutForm.steps >= 10000 ? '10K+ 🔥' : workoutForm.steps >= 8000 ? 'Target hit ✓' : workoutForm.steps > 0 ? `${Math.round(workoutForm.steps/80)}% there` : 'Start moving'}
                  </span>
                </div>
                <div className="bg-surface-base rounded-xl p-4 text-center">
                  <p className="text-4xl font-bold tabular-nums"
                    style={{ color: workoutForm.steps >= 10000 ? '#f59e0b' : workoutForm.steps >= 8000 ? '#22c55e' : '#ef4444' }}>
                    {workoutForm.steps.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted mt-1">steps today</p>
                </div>
                <input type="range" min={0} max={15000} step={100} value={workoutForm.steps}
                  onChange={e => { setW('steps', parseInt(e.target.value)); setStepSource('manual') }} className="w-full" />
                <input type="number" className="input text-center text-lg font-semibold"
                  placeholder="Type exact steps…" value={workoutForm.steps || ''}
                  onChange={e => { setW('steps', parseInt(e.target.value) || 0); setStepSource('manual') }} />
                <div>
                  <p className="section-label mb-2">Quick set</p>
                  <div className="flex gap-2">
                    {STEP_PRESETS.map(n => (
                      <button key={n} onClick={() => { setW('steps', n); setStepSource('manual') }}
                        className={workoutForm.steps === n ? 'pill-option-active' : 'pill-option'}>
                        {(n / 1000).toFixed(0)}K
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚶</span>
                  <h2 className="text-sm font-semibold text-text-primary">Post-dinner Walk</h2>
                  <span className="badge-success ml-auto">+10 pts</span>
                </div>
                <CheckItem label="Did post-dinner walk (10–15 min)" checked={workoutForm.post_dinner_walk}
                  onChange={v => setW('post_dinner_walk', v)} points={10} sublabel="Rule: 8:45 PM walk" />
                {workoutForm.post_dinner_walk && (
                  <div>
                    <p className="section-label mb-2">Duration</p>
                    <PillSelector options={WALK_DURATIONS} value={workoutForm.post_dinner_walk_minutes}
                      onChange={v => setW('post_dinner_walk_minutes', v)} formatter={v => `${v}m`} />
                  </div>
                )}
              </div>

              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <h2 className="text-sm font-semibold text-text-primary">Exercise Session</h2>
                </div>
                <CheckItem label="Did an exercise session" checked={workoutForm.exercise_done}
                  onChange={v => setW('exercise_done', v)} points={10} />
                {workoutForm.exercise_done && (
                  <div className="space-y-3">
                    <div>
                      <p className="section-label mb-2">Type</p>
                      <div className="grid grid-cols-3 gap-2">
                        {EXERCISE_TYPES.map(t => (
                          <button key={t} onClick={() => setW('exercise_type', t)}
                            className={workoutForm.exercise_type === t ? 'pill-option-active' : 'pill-option'}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="section-label mb-2">Duration</p>
                      <PillSelector options={EXERCISE_DURATIONS} value={workoutForm.exercise_duration_minutes}
                        onChange={v => setW('exercise_duration_minutes', v)} formatter={v => `${v}m`} />
                      {workoutForm.exercise_duration_minutes >= 45 && (
                        <p className="text-xs text-success bg-success/10 rounded-lg px-3 py-2 mt-2">Full session — maximum points</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <label className="section-label block mb-2">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="How was today's workout?"
                  value={workoutForm.notes || ''} onChange={e => setW('notes', e.target.value)} />
              </div>
            </>}

            {/* ── Sleep form ── */}
            {tab === 'sleep' && <>
              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: '#a78bfa' }} />
                  <h2 className="text-sm font-semibold text-text-primary">Sleep Timer</h2>
                  {timerStart && <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#a78bfa20', color: '#a78bfa' }}>Running</span>}
                </div>
                {timerStart ? (
                  <div className="space-y-3">
                    <div className="bg-surface-base rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold tabular-nums" style={{ color: '#a78bfa' }}>{formatElapsed(elapsed)}</p>
                      <p className="text-xs text-text-muted mt-1">Bed at {tsToHHMM(timerStart)} — {format(new Date(timerStart), 'MMM d')}</p>
                    </div>
                    <button onClick={stopTimer} className="btn w-full text-white" style={{ background: '#22c55e' }}>
                      <Square size={14} /> Wake Up — Stop Timer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted">Records your bed time and wake time. Effective sleep is auto-calculated; screen-on time is deducted if Usage Access is granted in settings.</p>
                    <button onClick={startTimer} className="btn w-full text-white" style={{ background: '#a78bfa' }}>
                      <Play size={14} />{sleepLogged ? 'Start New Sleep Session' : 'Go to Sleep — Start Timer'}
                    </button>
                  </div>
                )}
              </div>

              <div className="card">
                <button onClick={() => setManualSleepOpen(o => !o)}
                  className="w-full flex items-center gap-2 text-left">
                  <span className="text-sm font-semibold text-text-secondary flex-1">Manual time override</span>
                  <span className="text-xs text-text-muted">Use only if timer unavailable</span>
                  <ChevronDown size={14} className={`text-text-muted transition-transform ${manualSleepOpen ? 'rotate-180' : ''}`} />
                </button>
                {manualSleepOpen && (
                  <div className="space-y-4 mt-4 pt-4 border-t border-surface-border">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="section-label block mb-1.5">Fell asleep</label>
                        <input type="time" className="input" value={sleepForm.sleep_time || ''} onChange={e => setSleep('sleep_time', e.target.value)} />
                        <SleepStatus time={sleepForm.sleep_time} type="sleep" />
                      </div>
                      <div>
                        <label className="section-label block mb-1.5">Woke up</label>
                        <input type="time" className="input" value={sleepForm.wake_time || ''} onChange={e => setSleep('wake_time', e.target.value)} />
                        <SleepStatus time={sleepForm.wake_time} type="wake" />
                      </div>
                    </div>
                    <div>
                      <p className="section-label mb-2">Quick presets</p>
                      <div className="grid grid-cols-4 gap-2">
                        {SLEEP_PRESETS.map(p => (
                          <button key={p.label} onClick={() => applyPreset(p)} className="btn-outline text-xs py-2 px-0">{p.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><span>📱</span> Screen Time Deduction</h2>
                <p className="text-xs text-text-muted">Hours of phone/screen use deducted from effective sleep.</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSleep('screen_time_hours', Math.max(0, (sleepForm.screen_time_hours || 0) - 0.5))}
                    className="w-9 h-9 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg">−</button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold tabular-nums text-text-primary">{fmtHours(sleepForm.screen_time_hours || 0)}</p>
                    <p className="text-xs text-text-muted">screen time</p>
                  </div>
                  <button onClick={() => setSleep('screen_time_hours', Math.min(12, (sleepForm.screen_time_hours || 0) + 0.5))}
                    className="w-9 h-9 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg">+</button>
                </div>
              </div>

              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Sleep Quality</h2>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(q => {
                    const meta = QUALITY_META[q], isActive = sleepForm.quality === q
                    return (
                      <button key={q} onClick={() => setSleep('quality', q)}
                        className="flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150"
                        style={{ borderColor: isActive ? meta.color : '#334155', color: isActive ? meta.color : '#64748b', background: isActive ? `${meta.color}15` : 'transparent' }}>
                        {q}
                      </button>
                    )
                  })}
                </div>
                {QUALITY_META[sleepForm.quality] && (
                  <p className="text-sm text-center font-medium" style={{ color: QUALITY_META[sleepForm.quality].color }}>
                    {QUALITY_META[sleepForm.quality].label}
                  </p>
                )}
              </div>

              <div className="card">
                <label className="section-label block mb-2">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="How did you sleep? Any issues?"
                  value={sleepForm.notes || ''} onChange={e => setSleepForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </>}
          </div>

          {/* Pinned save button */}
          <div className="px-4 pt-4 pb-6 border-t border-surface-border bg-surface-card shrink-0">
            <button onClick={handleSave} disabled={saving}
              className="btn w-full font-semibold text-sm py-4 rounded-2xl"
              style={{ background: active.color, color: tab === 'workout' ? '#0f172a' : 'white', boxShadow: `0 4px 16px ${active.color}50` }}>
              <Save size={15} />
              {saving ? 'Saving…' : active.pts > 0 ? `Claim +${active.pts} XP →` : `Save ${active.label}`}
            </button>
          </div>

        </div>
      </div>

      <AddMealFlow
        open={addMealFlowOpen}
        presetCategory={addMealFlowCategory}
        onClose={() => setAddMealFlowOpen(false)}
        onLogged={handleMealLogged}
      />
    </div>
  )
}
