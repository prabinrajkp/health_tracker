import { useEffect, useState, useRef } from 'react'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import { Save, Moon, Play, Square, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getSleep, saveSleep } from '../api/client'
import { checkAndFireAppreciation } from '../services/trendNotificationEngine'
import useStore from '../store/useStore'
import StatBar from '../components/StatBar'

const UsageStats = registerPlugin('UsageStats')

const TIMER_KEY = 'hq-sleep-timer-start'

const EMPTY = { sleep_time: '', wake_time: '', sleep_hours: 0, quality: 3, notes: '', screen_time_hours: 0 }

const QUALITY_META = {
  1: { label: 'Terrible', color: '#ef4444' },
  2: { label: 'Poor',     color: '#f97316' },
  3: { label: 'Okay',     color: '#f59e0b' },
  4: { label: 'Good',     color: '#38bdf8' },
  5: { label: 'Excellent',color: '#22c55e' },
}

const PRESETS = [
  { label: 'Perfect', sleep: '23:00', wake: '06:30' },
  { label: 'Target',  sleep: '23:30', wake: '07:00' },
  { label: 'Late',    sleep: '00:00', wake: '07:30' },
  { label: 'Weekend', sleep: '00:30', wake: '08:00' },
]

function calcHours(st, wt) {
  if (!st || !wt) return 0
  const [sh, sm] = st.split(':').map(Number)
  const [wh, wm] = wt.split(':').map(Number)
  let s = sh * 60 + sm, w = wh * 60 + wm
  if (w <= s) w += 24 * 60
  return Math.round(((w - s) / 60) * 10) / 10
}

function tsToHHMM(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtHours(h) {
  if (!h || h <= 0) return '0 min'
  const totalMin = Math.round(h * 60)
  const hrs  = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}min`
}

function calcPreviewScore(form) {
  let s = 0
  if (form.sleep_time) {
    const [h, m] = form.sleep_time.split(':').map(Number)
    if (h >= 22 && (h < 23 || (h === 23 && m <= 30))) s += 10
    else if (h === 23) s += 5
    else if (h === 0 || h === 1) s -= 8
  }
  const effective = Math.max(0, (form.sleep_hours || 0) - (form.screen_time_hours || 0))
  const hrs = effective > 0 ? effective : (form.sleep_hours || 0)
  if (hrs >= 7) s += 12
  else if (hrs >= 6) s += 6
  else if (hrs >= 5) s += 2
  if (form.wake_time) {
    const [h, m] = form.wake_time.split(':').map(Number)
    if (h < 8 || (h === 8 && m === 0)) s += 8
    else if (h === 8) s += 4
    else if (h === 9 && m === 0) s += 2
  }
  return Math.max(0, Math.min(s, 30))
}

function SleepStatus({ time, type }) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (type === 'sleep') {
    if (h >= 2 && h < 18)    return <p className="text-xs text-danger mt-1.5">⚠ Very late — no timing points</p>
    if (h === 0 || h === 1)  return <p className="text-xs text-danger mt-1.5">⚠ After midnight — penalty applies</p>
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

export default function SleepLog() {
  const [now, setNow] = useState(() => new Date())
  const today     = format(now, 'yyyy-MM-dd')
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
  const { fetchTodayScore } = useStore()

  // Refresh today/yesterday at midnight so the date picker never shows a stale date
  useEffect(() => {
    const msUntilMidnight = () => {
      const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m - n
    }
    let t = setTimeout(function tick() {
      setNow(new Date())
      t = setTimeout(tick, msUntilMidnight())
    }, msUntilMidnight())
    return () => clearTimeout(t)
  }, [])

  // scoreDate = the day whose score this sleep affects (= wake-up date = storage date)
  const [scoreDate, setScoreDate] = useState(today)
  const [form, setForm] = useState({ ...EMPTY, date: today })
  const [saving, setSaving] = useState(false)
  const [timerStart, setTimerStart] = useState(() => {
    const v = localStorage.getItem(TIMER_KEY)
    return v ? parseInt(v, 10) : null
  })
  const [elapsed, setElapsed] = useState(0)
  const [needsUsagePerm, setNeedsUsagePerm] = useState(false)
  const intervalRef = useRef(null)

  // Load sleep record for the selected score date; clears form when switching dates
  useEffect(() => {
    getSleep(scoreDate).then(data => {
      setForm(data ? { ...EMPTY, ...data, date: scoreDate } : { ...EMPTY, date: scoreDate })
    })
  }, [scoreDate])

  // Live timer tick
  useEffect(() => {
    if (timerStart) {
      const tick = () => setElapsed(Math.floor((Date.now() - timerStart) / 1000))
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else {
      clearInterval(intervalRef.current)
      setElapsed(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerStart])

  const startTimer = () => {
    const now = Date.now()
    localStorage.setItem(TIMER_KEY, String(now))
    setTimerStart(now)
    setNeedsUsagePerm(false)
    toast.success('Sleep timer started. Open the app when you wake up to log effective sleep.')
  }

  const stopTimer = async () => {
    if (!timerStart) return
    const now = Date.now()
    let screenOnHours = 0

    if (Capacitor.isNativePlatform()) {
      try {
        const permResult = await UsageStats.hasPermission()
        if (!permResult.granted) {
          setNeedsUsagePerm(true)
          toast('Grant "Usage Access" to Health Quest in the next screen, then come back and stop the timer.', {
            icon: '📱', duration: 6000,
          })
          await UsageStats.requestPermission()
          return
        }
        setNeedsUsagePerm(false)
        const result = await UsageStats.getScreenOnTime({ startTime: timerStart, endTime: now })
        if (!result.needsPermission) screenOnHours = result.screenOnHours ?? 0
      } catch { /* web preview — fall through */ }
    }

    const sleepTime  = tsToHHMM(timerStart)
    const wakeTime   = tsToHHMM(now)
    const totalSecs  = Math.floor((now - timerStart) / 1000)
    const sleepHours = Math.round((totalSecs / 3600) * 10) / 10
    // Store under wake-up date (today) — recomputeScore uses same-date lookup
    const logDate    = format(new Date(now), 'yyyy-MM-dd')
    const effective  = Math.max(0, Math.round((sleepHours - screenOnHours) * 10) / 10)

    localStorage.removeItem(TIMER_KEY)
    setTimerStart(null)

    // Only save if at least 1 hour was logged — prevents accidental taps from polluting the record
    if (sleepHours < 1) {
      toast(`Timer cleared — only ${fmtHours(sleepHours)} elapsed, nothing saved.`, { icon: '⏱' })
      return
    }

    // Build complete record preserving any quality/notes already entered in the form
    const sleepData = { ...form, date: logDate, sleep_time: sleepTime, wake_time: wakeTime, sleep_hours: sleepHours, screen_time_hours: screenOnHours }
    setForm(sleepData)

    try {
      await saveSleep(sleepData)
      // Set scoreDate AFTER save so the useEffect re-fetch finds the record in DB instead
      // of racing against the write and resetting the form to empty (which would cause the
      // user to see 0 pts and overwrite correct data if they tap Save Sleep).
      setScoreDate(logDate)
      await fetchTodayScore()
      toast.success(`Sleep saved — ${fmtHours(sleepHours)} total · ${fmtHours(screenOnHours)} screen · ${fmtHours(effective)} effective`)
      // Fire appreciation notification ~10 s later if yesterday was better than the day before
      checkAndFireAppreciation(logDate).catch(() => {})
    } catch {
      toast.error('Sleep recorded but save failed — tap Save Sleep to retry')
    }
  }

  const set = (key, val) => setForm(f => {
    const updated = { ...f, [key]: val }
    if (key === 'sleep_time' || key === 'wake_time') {
      updated.sleep_hours = calcHours(
        key === 'sleep_time' ? val : updated.sleep_time,
        key === 'wake_time'  ? val : updated.wake_time,
      )
    }
    return updated
  })

  const applyPreset = (p) => setForm(f => ({ ...f, sleep_time: p.sleep, wake_time: p.wake, sleep_hours: calcHours(p.sleep, p.wake) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // scoreDate is the wake-up date and the storage date — no conversion needed
      const saveForm = { ...form, date: scoreDate }
      await saveSleep(saveForm)
      await fetchTodayScore()
      toast.success(`Sleep saved for ${scoreDate === today ? 'today' : 'yesterday'} — +${calcPreviewScore(saveForm)} pts`)
    } catch (e) {
      console.error('Sleep save error:', e)
      toast.error('Failed to save sleep')
    } finally {
      setSaving(false)
    }
  }

  const preview        = calcPreviewScore(form)
  const effectiveHours = Math.max(0, (form.sleep_hours || 0) - (form.screen_time_hours || 0))
  const displayHours   = effectiveHours > 0 ? effectiveHours : (form.sleep_hours || 0)
  const hoursColor     = displayHours >= 7 ? '#22c55e' : displayHours >= 6 ? '#f59e0b' : displayHours > 0 ? '#ef4444' : '#475569'
  const qualMeta       = QUALITY_META[form.quality]

  // Sleep has been logged when times are present and timer is not running
  const sleepLogged = !timerStart && !!form.sleep_time && form.sleep_hours > 0

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <div className="p-2 rounded-xl border" style={{ background: '#a78bfa15', borderColor: '#a78bfa30' }}>
          <Moon size={16} style={{ color: '#a78bfa' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Sleep Log</h1>
          <p className="text-xs text-text-muted">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums" style={{ color: '#a78bfa' }}>
            {preview}<span className="text-sm font-normal text-text-muted">/30</span>
          </p>
          <p className="text-xs text-text-muted">pts today</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <StatBar label="Sleep score" value={preview} max={30} color="#a78bfa" />

        {/* ── Dedicated Sleep Summary Card — always visible when sleep is logged ── */}
        {sleepLogged && (
          <div className="card border-2" style={{ borderColor: '#a78bfa50', background: 'linear-gradient(135deg, #a78bfa08 0%, #7c3aed05 100%)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                <h2 className="text-sm font-semibold text-text-primary">
                  {scoreDate === today ? "Today's Sleep Score" : "Yesterday's Sleep Score"}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: '#a78bfa20', color: '#a78bfa' }}>
                +{preview} / 30 pts
              </div>
            </div>

            {/* Main sleep duration — hero number */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold tabular-nums" style={{ color: hoursColor }}>
                {fmtHours(form.sleep_hours)}
              </span>
              <span className="text-sm text-text-muted">total sleep</span>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
                <p className="text-xs text-text-muted mb-0.5">🌙 Fell asleep</p>
                <p className="text-sm font-semibold text-text-primary tabular-nums">{form.sleep_time}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
                <p className="text-xs text-text-muted mb-0.5">🌅 Woke up</p>
                <p className="text-sm font-semibold text-text-primary tabular-nums">{form.wake_time || '—'}</p>
              </div>

              {(form.screen_time_hours || 0) > 0 ? (
                <>
                  <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
                    <p className="text-xs text-text-muted mb-0.5">📱 Screen time</p>
                    <p className="text-sm font-semibold text-warning tabular-nums">{fmtHours(form.screen_time_hours)}</p>
                  </div>
                  <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
                    <p className="text-xs text-text-muted mb-0.5">😴 Effective sleep</p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: hoursColor }}>{fmtHours(effectiveHours)}</p>
                  </div>
                </>
              ) : (
                <div className="bg-surface-elevated rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-xs text-text-muted mb-0.5">😴 Effective sleep</p>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: hoursColor }}>{fmtHours(form.sleep_hours)} (no screen deduction)</p>
                </div>
              )}
            </div>

            {/* Target badge */}
            <div className="flex items-center gap-2 text-xs">
              {displayHours >= 7
                ? <span className="text-success font-medium">✓ 7+ hour target met</span>
                : <span style={{ color: '#f97316' }} className="font-medium">Need {fmtHours(Math.max(0, 7 - displayHours))} more effective sleep</span>
              }
            </div>
          </div>
        )}

        {/* ── Sleep Timer ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold text-text-primary">Sleep Timer</h2>
            {timerStart && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#a78bfa20', color: '#a78bfa' }}>
                Running
              </span>
            )}
          </div>

          {needsUsagePerm && (
            <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ background: '#f59e0b15', borderColor: '#f59e0b40' }}>
              <ShieldAlert size={14} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
              <p className="text-xs" style={{ color: '#f59e0b' }}>
                Grant <strong>Usage Access</strong> to Health Quest in Settings, then come back and tap "Wake Up" again to calculate effective sleep from screen-off data.
              </p>
            </div>
          )}

          {timerStart ? (
            <div className="space-y-3">
              <div className="bg-surface-base rounded-xl p-4 text-center">
                <p className="text-3xl font-bold tabular-nums" style={{ color: '#a78bfa' }}>
                  {formatElapsed(elapsed)}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Bed at {tsToHHMM(timerStart)} — {format(new Date(timerStart), 'MMM d')}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Effective sleep = total time − screen-on time (auto-detected on wake)
                </p>
              </div>
              <button onClick={stopTimer} className="btn w-full text-white" style={{ background: '#22c55e' }}>
                <Square size={14} />
                Wake Up — Stop Timer
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                {sleepLogged
                  ? 'Sleep already logged above. Start a new timer to log another session.'
                  : 'Records your bed time. When you wake up, effective sleep is calculated by subtracting screen-on time from Android\'s usage stats.'}
              </p>
              <button onClick={startTimer} className="btn w-full text-white" style={{ background: '#a78bfa' }}>
                <Play size={14} />
                {sleepLogged ? 'Start New Sleep Session' : 'Go to Sleep — Start Timer'}
              </button>
            </div>
          )}
        </div>

        {/* ── Sleep & Wake Times (manual entry / adjustment) ── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span>🌙</span> Sleep &amp; Wake Times
            <span className="text-xs text-text-muted font-normal ml-1">— edit or enter manually</span>
          </h2>

          {/* Date selector — which day's score does this sleep affect? */}
          <div>
            <p className="section-label mb-2">Woke up on</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: yesterday, label: 'Yesterday', sub: format(new Date(yesterday), 'EEE, MMM d') },
                { val: today,     label: 'Today',     sub: format(new Date(today),     'EEE, MMM d') },
              ].map(({ val, label, sub }) => {
                const active = scoreDate === val
                return (
                  <button key={val} onClick={() => setScoreDate(val)}
                    className="rounded-xl border-2 py-2.5 px-3 text-left transition-all duration-150"
                    style={{
                      borderColor: active ? '#a78bfa' : '#334155',
                      background:  active ? '#a78bfa15' : 'transparent',
                    }}>
                    <p className="text-xs font-bold" style={{ color: active ? '#a78bfa' : '#94a3b8' }}>{label}</p>
                    <p className="text-[11px]" style={{ color: active ? '#c4b5fd' : '#475569' }}>{sub}</p>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">Score for the selected day will be updated.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="section-label block mb-1.5">Fell asleep</label>
              <input type="time" className="input" value={form.sleep_time || ''} onChange={e => set('sleep_time', e.target.value)} />
              <SleepStatus time={form.sleep_time} type="sleep" />
            </div>
            <div>
              <label className="section-label block mb-1.5">Woke up</label>
              <input type="time" className="input" value={form.wake_time || ''} onChange={e => set('wake_time', e.target.value)} />
              <SleepStatus time={form.wake_time} type="wake" />
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Quick presets</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} className="btn-outline text-xs py-2 px-0">{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Screen Time Deduction ── */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span>📱</span> Screen Time Deduction
          </h2>
          <p className="text-xs text-text-muted">Hours of phone/screen use that reduced effective sleep quality.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => set('screen_time_hours', Math.max(0, (form.screen_time_hours || 0) - 0.5))}
              className="w-9 h-9 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg"
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold tabular-nums text-text-primary">{fmtHours(form.screen_time_hours || 0)}</p>
              <p className="text-xs text-text-muted">screen time</p>
            </div>
            <button
              onClick={() => set('screen_time_hours', Math.min(12, (form.screen_time_hours || 0) + 0.5))}
              className="w-9 h-9 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg"
            >+</button>
          </div>
        </div>

        {/* ── Sleep Quality ── */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Sleep Quality</h2>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(q => {
              const meta   = QUALITY_META[q]
              const active = form.quality === q
              return (
                <button key={q} onClick={() => set('quality', q)}
                  className="flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150"
                  style={{
                    borderColor: active ? meta.color : '#334155',
                    color:       active ? meta.color : '#64748b',
                    background:  active ? `${meta.color}15` : 'transparent',
                  }}>
                  {q}
                </button>
              )
            })}
          </div>
          {qualMeta && <p className="text-sm text-center font-medium" style={{ color: qualMeta.color }}>{qualMeta.label}</p>}
        </div>

        {/* ── Notes ── */}
        <div className="card">
          <label className="section-label block mb-2">Notes</label>
          <textarea className="input resize-none" rows={2}
            placeholder="How did you sleep? Any issues?" value={form.notes || ''}
            onChange={e => set('notes', e.target.value)} />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn w-full text-white" style={{ background: '#a78bfa' }}>
          <Save size={15} />
          {saving ? 'Saving…' : `Save sleep · +${preview} pts`}
        </button>
      </div>
    </div>
  )
}
