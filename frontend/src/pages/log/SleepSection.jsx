import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Play, Square, CheckCircle2, ChevronDown } from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getSleep, saveSleep, getConfig } from '../../api/client'
import { calcSleepScore } from '../../services/scoring'
import { weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../../services/scoreMeta'
import { checkAndFireAppreciation } from '../../services/trendNotificationEngine'
import { fmtHours } from '../../services/fasting'
import { useAutoSave, SectionScore, NoteField, todayStr, TEXT_SAVE_MS } from './shared'

const UsageStats = registerPlugin('UsageStats')

const TIMER_KEY = 'hq-sleep-timer-start'
const VIOLET    = CATEGORY_COLORS.sleep
const SLEEP_PRESETS = [
  { label: 'Perfect', sleep: '23:00', wake: '06:30' },
  { label: 'Target',  sleep: '23:30', wake: '07:00' },
  { label: 'Late',    sleep: '00:00', wake: '07:30' },
  { label: 'Weekend', sleep: '00:30', wake: '08:00' },
]
const QUALITY_META = {
  1: { label: 'Terrible',  color: '#ef4444' },
  2: { label: 'Poor',      color: '#f97316' },
  3: { label: 'Okay',      color: '#f59e0b' },
  4: { label: 'Good',      color: '#38bdf8' },
  5: { label: 'Excellent', color: '#22c55e' },
}
const EMPTY_SLEEP = { sleep_time: '', wake_time: '', sleep_hours: 0, quality: 3, notes: '', screen_time_hours: 0 }

function calcHours(st, wt) {
  if (!st || !wt) return 0
  const [sh, sm] = st.split(':').map(Number), [wh, wm] = wt.split(':').map(Number)
  let s = sh * 60 + sm, w = wh * 60 + wm
  if (w <= s) w += 24 * 60
  return Math.round(((w - s) / 60) * 10) / 10
}
const hhmm = (ts) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatElapsed(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TimeHint({ time, type }) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (type === 'sleep') {
    if (h <= 5)             return <p className="text-xs text-danger mt-1.5">After midnight — penalty applies</p>
    if (h === 23 && m > 30) return <p className="text-xs text-warning mt-1.5">Just past 11:30 — partial points</p>
    if (h >= 22)            return <p className="text-xs text-success mt-1.5">On time — full points</p>
    return null
  }
  if (h < 8 || (h === 8 && m === 0)) return <p className="text-xs text-success mt-1.5">Wake time on target</p>
  if (h === 8 || (h === 9 && m === 0)) return <p className="text-xs text-warning mt-1.5">A little late — partial points</p>
  return <p className="text-xs text-danger mt-1.5">Late wake-up — no points</p>
}

export default function SleepSection({ afterSave }) {
  const today = todayStr()

  const [form, setForm]       = useState({ ...EMPTY_SLEEP, date: today })
  const [weights, setWeights] = useState(weightsFromConfig(null))
  const [timerStart, setTimerStart] = useState(() => {
    const v = localStorage.getItem(TIMER_KEY)
    return v ? parseInt(v, 10) : null
  })
  const [elapsed, setElapsed]         = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const formRef = useRef(form)

  useEffect(() => {
    getConfig().then(rows => setWeights(weightsFromConfig(rows))).catch(() => {})
    getSleep(today).then(data => {
      if (!data) return
      const loaded = { ...EMPTY_SLEEP, ...data, date: today }
      formRef.current = loaded
      setForm(loaded)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!timerStart) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - timerStart) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timerStart])

  const { save } = useAutoSave(async (next) => {
    await saveSleep({ ...next, date: today })
    await afterSave()
  })

  // Nothing is written until there is a real night to record — otherwise
  // touching the quality buttons alone would create an empty sleep log.
  const update = (patch, delay = 0) => {
    const next = { ...formRef.current, ...patch }
    if ('sleep_time' in patch || 'wake_time' in patch) next.sleep_hours = calcHours(next.sleep_time, next.wake_time)
    formRef.current = next
    setForm(next)
    if (next.sleep_time && next.wake_time) save(next, delay)
  }

  const startTimer = () => {
    const now = Date.now()
    localStorage.setItem(TIMER_KEY, String(now))
    setTimerStart(now)
    toast.success('Sleep timer started. Open the app when you wake up.')
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
        // Without Usage Access the timer still stops; screen time just isn't deducted
      } catch {}
    }
    const sleepHours = Math.round(((now - timerStart) / 3600000) * 10) / 10
    const effective  = Math.max(0, Math.round((sleepHours - screenOnHours) * 10) / 10)
    const logDate    = format(new Date(), 'yyyy-MM-dd')

    localStorage.removeItem(TIMER_KEY)
    setTimerStart(null)

    if (sleepHours < 1) {
      toast(`Timer cleared — only ${fmtHours(sleepHours)} elapsed, nothing saved.`, { icon: '⏱' })
      return
    }
    const next = {
      ...formRef.current, date: logDate,
      sleep_time: hhmm(timerStart), wake_time: hhmm(now),
      sleep_hours: sleepHours, screen_time_hours: screenOnHours,
    }
    formRef.current = next
    setForm(next)
    try {
      await saveSleep(next)
      await afterSave()
      checkAndFireAppreciation(logDate).catch(() => {})
      toast.success(`Sleep saved — ${fmtHours(sleepHours)} total · ${fmtHours(screenOnHours)} screen · ${fmtHours(effective)} effective`)
    } catch {
      toast.error('Could not save your sleep — open Edit details and re-enter the times')
    }
  }

  const max      = categoryMaxes(weights)
  const logged   = !timerStart && !!form.sleep_time && form.sleep_hours > 0
  const screenH  = form.screen_time_hours || 0
  const effHours = Math.max(0, (form.sleep_hours || 0) - screenH)
  const dispH    = effHours > 0 ? effHours : (form.sleep_hours || 0)
  const hoursColor = dispH >= 7 ? '#22c55e' : dispH >= 6 ? '#f59e0b' : dispH > 0 ? '#ef4444' : 'rgb(var(--c-text-muted))'
  const lateSleep  = form.sleep_time && Number(form.sleep_time.split(':')[0]) <= 5
  const pts = Math.max(0, calcSleepScore(form, weights) + (lateSleep ? (weights.penalties?.sleep_after_midnight || 0) : 0))

  return (
    <div className="space-y-3">
      <SectionScore label="Sleep" pts={pts} max={max.sleep} color={VIOLET} />

      {/* ── Status ── */}
      {timerStart ? (
        <div className="card text-center py-6">
          <p className="text-4xl font-bold tabular-nums mb-1" style={{ color: VIOLET }}>{formatElapsed(elapsed)}</p>
          <p className="text-xs text-text-muted">Fell asleep at {hhmm(timerStart)} · {format(new Date(timerStart), 'MMM d')}</p>
          <p className="text-xs text-text-muted mt-1">Screen time is deducted automatically when you wake up</p>
        </div>
      ) : logged ? (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-success" />
            <span className="text-sm font-semibold text-text-primary">Last night</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums" style={{ color: hoursColor }}>{fmtHours(form.sleep_hours)}</span>
            <span className="text-sm text-text-muted">total sleep</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['🌙 Fell asleep', form.sleep_time],
              ['🌅 Woke up', form.wake_time || '—'],
              ...(screenH > 0 ? [['📱 Screen time', fmtHours(screenH)], ['😴 Effective', fmtHours(effHours)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="bg-surface-elevated rounded-xl px-3 py-2">
                <p className="text-xs text-text-muted">{label}</p>
                <p className="text-sm font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium" style={{ color: dispH >= 7 ? '#22c55e' : '#f97316' }}>
            {dispH >= 7 ? '7+ hour target met' : `${fmtHours(Math.max(0, 7 - dispH))} short of the 7-hour target`}
          </p>
        </div>
      ) : (
        <div className="card text-center py-7">
          <p className="text-4xl mb-2">😴</p>
          <p className="text-sm font-semibold text-text-primary">No sleep logged for today</p>
          <p className="text-xs text-text-muted mt-1">Start the timer at bedtime, or enter the times under Edit details</p>
        </div>
      )}

      {/* ── One primary action ── */}
      {timerStart ? (
        <button onClick={stopTimer} className="btn w-full text-white font-semibold text-sm py-4 rounded-2xl" style={{ background: '#22c55e' }}>
          <Square size={16} /> Wake up — stop timer
        </button>
      ) : (
        <button onClick={startTimer} className="btn w-full text-white font-semibold text-sm py-4 rounded-2xl" style={{ background: VIOLET }}>
          <Play size={16} /> {logged ? 'Start a new sleep timer' : 'Going to sleep — start timer'}
        </button>
      )}

      {/* ── Everything else ── */}
      {!timerStart && (
        <div className="card">
          <button onClick={() => setDetailsOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
            <span className="text-sm font-semibold text-text-primary flex-1">Edit details</span>
            <span className="text-xs text-text-muted">Times, screen time, quality</span>
            <ChevronDown size={15} className={`text-text-muted transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>

          {detailsOpen && (
            <div className="space-y-5 mt-4 pt-4 border-t border-surface-border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="section-label block mb-1.5">Fell asleep</label>
                  <input type="time" className="input" value={form.sleep_time || ''} onChange={e => update({ sleep_time: e.target.value })} />
                  <TimeHint time={form.sleep_time} type="sleep" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Woke up</label>
                  <input type="time" className="input" value={form.wake_time || ''} onChange={e => update({ wake_time: e.target.value })} />
                  <TimeHint time={form.wake_time} type="wake" />
                </div>
              </div>

              <div>
                <p className="section-label mb-2">Quick fill</p>
                <div className="grid grid-cols-4 gap-2">
                  {SLEEP_PRESETS.map(p => (
                    <button key={p.label} onClick={() => update({ sleep_time: p.sleep, wake_time: p.wake })}
                      className="btn-outline text-xs py-2 px-0">{p.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="section-label mb-1">Screen time during the night</p>
                <p className="text-xs text-text-muted mb-2">Deducted from your sleep to give effective hours</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => update({ screen_time_hours: Math.max(0, screenH - 0.5) })} aria-label="Less screen time"
                    className="w-10 h-10 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg">−</button>
                  <p className="flex-1 text-center text-xl font-bold tabular-nums text-text-primary">{fmtHours(screenH)}</p>
                  <button onClick={() => update({ screen_time_hours: Math.min(12, screenH + 0.5) })} aria-label="More screen time"
                    className="w-10 h-10 rounded-xl border border-surface-border bg-surface-elevated text-text-secondary flex items-center justify-center text-lg">+</button>
                </div>
              </div>

              <div>
                <p className="section-label mb-2">Sleep quality{QUALITY_META[form.quality] ? ` · ${QUALITY_META[form.quality].label}` : ''}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(q => {
                    const meta = QUALITY_META[q], on = form.quality === q
                    return (
                      <button key={q} onClick={() => update({ quality: q })}
                        className="flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all"
                        style={{
                          borderColor: on ? meta.color : 'rgb(var(--c-surface-border))',
                          color: on ? meta.color : 'rgb(var(--c-text-muted))',
                          background: on ? `${meta.color}15` : 'transparent',
                        }}>
                        {q}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!(form.sleep_time && form.wake_time) && (
                <p className="text-xs text-text-muted">Enter both times to save this night.</p>
              )}
            </div>
          )}
        </div>
      )}

      {logged && (
        <NoteField value={form.notes} placeholder="How did you sleep?"
          onChange={notes => update({ notes }, TEXT_SAVE_MS)} />
      )}
    </div>
  )
}
