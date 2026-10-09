import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Save, Dumbbell, RefreshCw } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { HealthConnect } from 'capacitor-health-connect'
import { getWorkout, saveWorkout } from '../api/client'
import useStore from '../store/useStore'
import CheckItem from '../components/CheckItem'
import StatBar from '../components/StatBar'

const EXERCISE_TYPES = ['Badminton', 'Stairs', 'Walking', 'Gym', 'Cycling', 'Other']
const STEP_PRESETS = [5000, 8000, 10000, 12000]
const WALK_DURATIONS = [5, 10, 15, 20, 30]
const EXERCISE_DURATIONS = [20, 30, 45, 60, 90]

const EMPTY = {
  steps: 0, post_dinner_walk: false, post_dinner_walk_minutes: 0,
  exercise_done: false, exercise_type: '', exercise_duration_minutes: 0, notes: '',
}

function calcPreviewScore(form) {
  let s = 0
  if (form.steps >= 10000) s += 18
  else if (form.steps >= 8000) s += 15
  else if (form.steps >= 5000) s += 8
  if (form.post_dinner_walk && form.post_dinner_walk_minutes >= 10) s += 10
  else if (form.post_dinner_walk) s += 5
  if (form.exercise_done && form.exercise_duration_minutes >= 45) s += 10
  else if (form.exercise_done && form.exercise_duration_minutes >= 20) s += 6
  return Math.min(s, 35)
}

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

export default function WorkoutLog() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { fetchTodayScore } = useStore()
  const [form, setForm] = useState({ ...EMPTY, date: today })
  const [saving, setSaving] = useState(false)
  const [hcAvailable, setHcAvailable] = useState(false)
  const [syncingHC, setSyncingHC] = useState(false)

  useEffect(() => {
    getWorkout(today).then(existingData => {
      if (existingData) setForm({ ...EMPTY, ...existingData, date: today })

      if (Capacitor.isNativePlatform()) {
        HealthConnect.checkAvailability()
          .then(async r => {
            if (r.availability !== 'Available') return
            setHcAvailable(true)
            try {
              const perm = await HealthConnect.requestHealthPermissions({ read: ['Steps'], write: [] })
              if (!perm.hasAllPermissions) return
              const start = new Date(); start.setHours(0, 0, 0, 0)
              const end = new Date(); end.setHours(23, 59, 59, 999)
              const result = await HealthConnect.readRecords({
                type: 'Steps',
                timeRangeFilter: { type: 'between', startTime: start, endTime: end },
              })
              const byOrigin = {}
              for (const r of result.records) {
                const origin = r.metadata?.dataOrigin ?? 'unknown'
                byOrigin[origin] = (byOrigin[origin] || 0) + (r.count || 0)
              }
              const total = Math.max(0, ...Object.values(byOrigin))
              if (total > 0) {
                setForm(f => ({ ...f, steps: total }))
                // Auto-save steps update silently
                const merged = { ...(existingData || EMPTY), date: today, steps: total }
                await saveWorkout(merged)
              }
            } catch { /* silent - user can manually sync */ }
          })
          .catch(() => {})
      }
    })
  }, [])

  const fetchFromHealthConnect = async () => {
    setSyncingHC(true)
    try {
      const perm = await HealthConnect.requestHealthPermissions({ read: ['Steps'], write: [] })
      if (!perm.hasAllPermissions) {
        toast.error('Steps permission not granted in Health Connect')
        return
      }
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const result = await HealthConnect.readRecords({
        type: 'Steps',
        timeRangeFilter: { type: 'between', startTime: start, endTime: end },
      })
      // Sum per data origin, then take the max to avoid double-counting
      // (multiple apps like Google Fit + phone pedometer each write the same steps)
      const byOrigin = {}
      for (const r of result.records) {
        const origin = r.metadata?.dataOrigin ?? 'unknown'
        byOrigin[origin] = (byOrigin[origin] || 0) + (r.count || 0)
      }
      const total = Math.max(0, ...Object.values(byOrigin))
      set('steps', total)
      toast.success(`Synced ${total.toLocaleString()} steps from Health Connect`)
    } catch {
      toast.error('Could not read Health Connect data')
    } finally {
      setSyncingHC(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveWorkout(form)
      await fetchTodayScore()
      toast.success(`Workout saved — +${calcPreviewScore(form)} pts`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const preview = calcPreviewScore(form)
  const stepPct = Math.min((form.steps / 10000) * 100, 100)
  const stepColor = form.steps >= 10000 ? '#f59e0b' : form.steps >= 8000 ? '#22c55e' : form.steps >= 5000 ? '#f97316' : '#ef4444'

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <div className="p-2 bg-info/10 rounded-xl border border-info/20">
          <Dumbbell size={16} className="text-info" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Workout Log</h1>
          <p className="text-xs text-text-muted">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-info tabular-nums">{preview}<span className="text-sm font-normal text-text-muted">/35</span></p>
          <p className="text-xs text-text-muted">pts today</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <StatBar label="Workout score" value={preview} max={35} color="#38bdf8" />

        {/* Steps */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">👟</span>
              <h2 className="text-sm font-semibold text-text-primary">Daily Steps</h2>
            </div>
            <div className="flex items-center gap-2">
              {hcAvailable && (
                <button
                  onClick={fetchFromHealthConnect}
                  disabled={syncingHC}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-info/10 text-info border border-info/20 active:opacity-70"
                >
                  <RefreshCw size={11} className={syncingHC ? 'animate-spin' : ''} />
                  {syncingHC ? 'Syncing…' : 'Health Connect'}
                </button>
              )}
              <span className="badge" style={{ background: `${stepColor}20`, color: stepColor }}>
                {form.steps >= 10000 ? '10K+ 🔥' : form.steps >= 8000 ? 'Target hit' : 'Below target'}
              </span>
            </div>
          </div>

          {/* Big step counter */}
          <div className="bg-surface-base rounded-xl p-4 text-center">
            <p className="text-4xl font-bold tabular-nums" style={{ color: stepColor }}>
              {form.steps.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted mt-1">steps today</p>
          </div>

          {/* Progress to 10K */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-muted">
              <span>0</span>
              <span style={{ color: stepColor }}>Target: 8,000</span>
              <span>10,000+</span>
            </div>
            <div className="progress-track h-2.5">
              <div className="progress-fill" style={{ width: `${stepPct}%`, backgroundColor: stepColor }} />
            </div>
          </div>

          {/* Slider */}
          <input type="range" min={0} max={15000} step={100} value={form.steps}
            onChange={e => set('steps', parseInt(e.target.value))} className="w-full" />

          {/* Manual input */}
          <input type="number" className="input text-center text-lg font-semibold"
            placeholder="Type exact steps…" value={form.steps || ''}
            onChange={e => set('steps', parseInt(e.target.value) || 0)} />

          {/* Presets */}
          <div>
            <p className="section-label mb-2">Quick set</p>
            <div className="flex gap-2">
              {STEP_PRESETS.map(n => (
                <button key={n} onClick={() => set('steps', n)}
                  className={form.steps === n ? 'pill-option-active' : 'pill-option'}>
                  {(n / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>

          {form.steps > 0 && form.steps < 8000 && (
            <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              {(8000 - form.steps).toLocaleString()} more steps to reach your target
            </p>
          )}
        </div>

        {/* Post-dinner walk */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🚶</span>
            <h2 className="text-sm font-semibold text-text-primary">Post-dinner Walk</h2>
            <span className="badge-success ml-auto">+10 pts</span>
          </div>
          <CheckItem label="Did post-dinner walk (10–15 min)" checked={form.post_dinner_walk} onChange={v => set('post_dinner_walk', v)} points={10} sublabel="Rule: 8:45 PM walk" />
          {form.post_dinner_walk && (
            <div>
              <p className="section-label mb-2">Duration</p>
              <PillSelector options={WALK_DURATIONS} value={form.post_dinner_walk_minutes}
                onChange={v => set('post_dinner_walk_minutes', v)} formatter={v => `${v}m`} />
            </div>
          )}
        </div>

        {/* Exercise */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <h2 className="text-sm font-semibold text-text-primary">Exercise Session</h2>
          </div>
          <CheckItem label="Did an exercise session" checked={form.exercise_done} onChange={v => set('exercise_done', v)} points={10} />
          {form.exercise_done && (
            <div className="space-y-3">
              <div>
                <p className="section-label mb-2">Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {EXERCISE_TYPES.map(t => (
                    <button key={t} onClick={() => set('exercise_type', t)}
                      className={form.exercise_type === t ? 'pill-option-active' : 'pill-option'}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label mb-2">Duration</p>
                <PillSelector options={EXERCISE_DURATIONS} value={form.exercise_duration_minutes}
                  onChange={v => set('exercise_duration_minutes', v)} formatter={v => `${v}m`} />
                {form.exercise_duration_minutes >= 45 && (
                  <p className="text-xs text-success bg-success/10 rounded-lg px-3 py-2 mt-2">Full session — maximum points</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card">
          <label className="section-label block mb-2">Notes</label>
          <textarea className="input resize-none" rows={2}
            placeholder="How was today's workout?" value={form.notes || ''}
            onChange={e => set('notes', e.target.value)} />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full" style={{ background: '#38bdf8', color: '#0f172a' }}>
          <Save size={15} />
          {saving ? 'Saving…' : `Save workout · +${preview} pts`}
        </button>
      </div>
    </div>
  )
}
