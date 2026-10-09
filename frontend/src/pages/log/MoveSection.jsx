import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Pencil } from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { HealthConnect } from 'capacitor-health-connect'
import { getWorkout, saveWorkout, getConfig } from '../../api/client'
import { calcWorkoutScore } from '../../services/scoring'
import { weightsFromConfig, categoryMaxes, stepTargets, CATEGORY_COLORS } from '../../services/scoreMeta'
import { isStepsManualToday, setStepsManualToday } from '../../services/stepSync'
import { useAutoSave, SectionScore, Toggle, PillSelector, NoteField, todayStr, TEXT_SAVE_MS } from './shared'

const UsageStats = registerPlugin('UsageStats')

const EXERCISE_TYPES     = ['Badminton', 'Stairs', 'Walking', 'Gym', 'Cycling', 'Other']
const WALK_DURATIONS     = [5, 10, 15, 20, 30]
const EXERCISE_DURATIONS = [20, 30, 45, 60, 90]
const EMPTY_WORKOUT = { steps: 0, post_dinner_walk: false, post_dinner_walk_minutes: 0, exercise_done: false, exercise_type: '', exercise_duration_minutes: 0, notes: '' }

const hhmm = (ts) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Today's steps from Health Connect, taking the largest single source so two
// apps writing the same walk are not added together.
async function readHealthConnectSteps() {
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
  const totals = Object.values(byOrigin)
  return totals.length ? Math.max(...totals) : 0
}

async function readSensorSteps() {
  try {
    const sr = await UsageStats.getTodaySteps()
    return sr.available && sr.steps > 0 ? sr.steps : 0
  } catch {
    return 0
  }
}

export default function MoveSection({ afterSave }) {
  const today = todayStr()

  const [form, setForm]       = useState({ ...EMPTY_WORKOUT, date: today })
  const [weights, setWeights] = useState(weightsFromConfig(null))
  const [editing, setEditing] = useState(false)
  const [hcStatus, setHcStatus]         = useState(null)   // 'Available' | 'NotInstalled' | 'NotSupported'
  const [hcPermission, setHcPermission] = useState(null)   // 'granted' | 'denied'
  const [hcNoData, setHcNoData]         = useState(false)  // connected and permitted, but nothing is writing steps
  const [source, setSource]     = useState(isStepsManualToday() ? 'manual' : null)
  const [syncedAt, setSyncedAt] = useState(null)
  const [syncing, setSyncing]   = useState(false)

  const { save } = useAutoSave(async (next) => {
    await saveWorkout({ ...next, date: today })
    await afterSave()
  })
  // The latest form lives in a ref as well, so a sync result arriving just
  // after a tap builds on that tap instead of on a stale render.
  const formRef = useRef(form)
  const commit = (next, delay = 0, persist = true) => {
    formRef.current = next
    setForm(next)
    if (persist) save(next, delay)
  }
  const update = (patch, delay = 0) => commit({ ...formRef.current, ...patch }, delay)

  // Applies a synced step count. A count the user typed in today is left alone.
  const applySynced = (steps, from) => {
    if (steps <= 0 || isStepsManualToday()) return false
    setSource(from); setSyncedAt(Date.now())
    if (formRef.current.steps !== steps) update({ steps })
    return true
  }

  useEffect(() => {
    getConfig().then(rows => setWeights(weightsFromConfig(rows))).catch(() => {})
    getWorkout(today).then(async (existing) => {
      if (existing) commit({ ...EMPTY_WORKOUT, ...existing, date: today }, 0, false)
      if (!Capacitor.isNativePlatform()) return
      try {
        const r = await HealthConnect.checkAvailability()
        setHcStatus(r.availability)
        if (r.availability === 'Available') {
          // Silent check — requestHealthPermissions would open a system screen
          const perm = await HealthConnect.checkHealthPermissions({ read: ['Steps'], write: [] })
          if (perm.hasAllPermissions) {
            setHcPermission('granted')
            const total = await readHealthConnectSteps()
            if (total > 0) { setHcNoData(false); applySynced(total, 'health_connect'); return }
            setHcNoData(true)
          } else {
            setHcPermission('denied')
          }
        }
        applySynced(await readSensorSteps(), 'sensor')
      } catch (e) {
        console.error('step auto-sync error', e)
      }
    }).catch(console.error)
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    setStepsManualToday(false)   // an explicit sync replaces a typed-in count
    try {
      const perm = await HealthConnect.requestHealthPermissions({ read: ['Steps'], write: [] })
      if (!perm.hasAllPermissions) {
        setHcPermission('denied')
        const sensor = await readSensorSteps()
        if (applySynced(sensor, 'sensor')) toast.success(`${sensor.toLocaleString()} steps from phone sensor`)
        else toast.error('Steps permission not granted — allow it in Health Connect settings')
        return
      }
      setHcPermission('granted')
      const total = await readHealthConnectSteps()
      if (total === 0) {
        setHcNoData(true)
        const sensor = await readSensorSteps()
        if (applySynced(sensor, 'sensor')) toast('No data in Health Connect — showing phone sensor steps', { icon: '📱' })
        else toast('No step data found. Open Google Fit or Samsung Health, let it run, then try again.', { icon: '💡' })
        return
      }
      setHcNoData(false)
      const changed = total !== form.steps
      applySynced(total, 'health_connect')
      toast.success(changed ? `Synced ${total.toLocaleString()} steps` : 'Steps are up to date')
    } catch {
      toast.error('Could not read Health Connect data')
    } finally {
      setSyncing(false)
    }
  }

  const setManualSteps = (value) => {
    setStepsManualToday(true)
    setSource('manual')
    update({ steps: Math.max(0, parseInt(value, 10) || 0) }, TEXT_SAVE_MS)
  }

  const max     = categoryMaxes(weights)
  const t       = stepTargets(weights)
  const w       = weights.workout || {}
  const pts     = calcWorkoutScore(form, weights)
  const steps   = form.steps || 0
  const color   = steps >= t.bonusStart ? '#f59e0b' : steps >= t.full ? '#22c55e' : steps >= t.half ? '#f97316' : '#ef4444'
  const barMax  = Math.max(t.bonusStart, 1)
  const stepMsg = steps >= t.bonusStart ? 'Bonus zone — every extra step adds points'
    : steps >= t.full ? `Target hit · ${(t.bonusStart - steps).toLocaleString()} more for the bonus`
    : `${(t.full - steps).toLocaleString()} to go for full points`
  const sourceLabel = { health_connect: 'Health Connect', sensor: 'Phone sensor', manual: 'Entered by you' }[source]
  const canSync = hcStatus === 'Available'

  return (
    <div className="space-y-3">
      <SectionScore label="Workout" pts={pts} max={max.workout} color={CATEGORY_COLORS.workout} />

      {/* ── Steps ── */}
      <div className="card space-y-4">
        <div className="text-center pt-1">
          <p className="text-5xl font-bold tabular-nums" style={{ color }}>{steps.toLocaleString()}</p>
          <p className="text-xs text-text-muted mt-1.5">
            steps today{sourceLabel ? ` · ${sourceLabel}` : ''}{syncedAt && source !== 'manual' ? ` · ${hhmm(syncedAt)}` : ''}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="progress-track h-2">
            <div className="progress-fill" style={{ width: `${Math.min((steps / barMax) * 100, 100)}%`, backgroundColor: color }} />
          </div>
          <div className="flex justify-between text-xs text-text-muted">
            <span>{stepMsg}</span>
            <span className="tabular-nums shrink-0 ml-2">{t.full.toLocaleString()} target</span>
          </div>
        </div>

        {editing && (
          <input type="number" inputMode="numeric" autoFocus className="input text-center text-lg font-semibold"
            placeholder="Type today's steps" value={steps || ''} onChange={e => setManualSteps(e.target.value)} />
        )}

        <div className="flex gap-2">
          {canSync && (
            <button onClick={syncNow} disabled={syncing} className="btn-ghost flex-1 text-xs py-2.5">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : hcPermission === 'denied' ? 'Connect Health Connect' : 'Sync'}
            </button>
          )}
          <button onClick={() => setEditing(e => !e)} className="btn-ghost flex-1 text-xs py-2.5">
            <Pencil size={13} />{editing ? 'Done' : 'Edit'}
          </button>
        </div>

        {source === 'manual' && canSync && (
          <p className="text-xs text-text-muted">Your typed count is kept for today. Tap Sync to replace it with the synced count.</p>
        )}
        {canSync && hcPermission === 'granted' && hcNoData && (
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-warning">No step source connected.</span>{' '}
            Health Connect is ready but no app is writing steps to it. Open Google Fit or Samsung Health, let it run for a minute, then sync.
          </p>
        )}
        {hcStatus === 'NotInstalled' && (
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-info">Health Connect not installed.</span>{' '}
            Install it from the Play Store to sync steps automatically. Samsung users: also connect
            Samsung Health → Settings → Connected Services → Health Connect.
          </p>
        )}
      </div>

      {/* ── Post-dinner walk ── */}
      <div className="card space-y-3">
        <Toggle label="Post-dinner walk" sublabel="10 minutes or more for full points" points={w.post_dinner_walk}
          checked={!!form.post_dinner_walk}
          onChange={on => update({ post_dinner_walk: on, post_dinner_walk_minutes: on ? (form.post_dinner_walk_minutes || 10) : 0 })} />
        {form.post_dinner_walk && (
          <PillSelector options={WALK_DURATIONS} value={form.post_dinner_walk_minutes}
            onChange={v => update({ post_dinner_walk_minutes: v })} formatter={v => `${v}m`} />
        )}
      </div>

      {/* ── Exercise ── */}
      <div className="card space-y-3">
        <Toggle label="Exercise session" sublabel="45 minutes or more for full points" points={w.exercise_session}
          checked={!!form.exercise_done}
          onChange={on => update({ exercise_done: on, exercise_duration_minutes: on ? (form.exercise_duration_minutes || 30) : 0 })} />
        {form.exercise_done && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {EXERCISE_TYPES.map(type => (
                <button key={type} onClick={() => update({ exercise_type: type })}
                  className={form.exercise_type === type ? 'pill-option-active' : 'pill-option'}>{type}</button>
              ))}
            </div>
            <PillSelector options={EXERCISE_DURATIONS} value={form.exercise_duration_minutes}
              onChange={v => update({ exercise_duration_minutes: v })} formatter={v => `${v}m`} />
          </>
        )}
      </div>

      <NoteField value={form.notes} placeholder="How was today's workout?"
        onChange={notes => update({ notes }, TEXT_SAVE_MS)} />
    </div>
  )
}
