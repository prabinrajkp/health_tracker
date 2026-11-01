import { useEffect, useMemo, useState } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { Scale, Minus, Plus, TrendingDown, TrendingUp, Target, ArrowLeft, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { getWeightEntry, getWeightEntries, saveWeightEntry, getConfig, saveConfig, saveGoalEntry } from '../api/client'
import { planOn, weightDirection, targetProgress, weightTone, weightPaceNote } from '../services/bodyGoal'
import useStore from '../store/useStore'
import { col } from '../services/theme'

const RANGES = [
  { id: 30,  label: '30d' },
  { id: 90,  label: '90d' },
  { id: 365, label: '1y' },
]

const TONE_TOKEN = { good: 'success', caution: 'warning' }

const WeightTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-sm">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      <p style={{ color: payload[0].color }}>{payload[0].value} kg</p>
    </div>
  )
}

// Neutral by default; a tone is only passed when the number is good or bad news.
function StatTile({ label, value, unit, tone, Icon }) {
  return (
    <div className="tile">
      <p className="t-caption flex items-center gap-1.5">{Icon && <Icon size={13} />}{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-0.5 ${tone ? `text-${tone}` : 'text-text-primary'}`}>
        {value}{unit && <span className="text-sm font-normal text-text-muted"> {unit}</span>}
      </p>
    </div>
  )
}

export default function Weight() {
  const navigate = useNavigate()
  const { fetchTodayScore } = useStore()
  const [now, setNow] = useState(() => new Date())
  const today     = format(now, 'yyyy-MM-dd')
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')

  const [date, setDate]       = useState(today)
  const [weight, setWeight]   = useState('')
  const [notes, setNotes]     = useState('')
  const [entries, setEntries] = useState([])
  const [config, setConfig]   = useState({})
  const [range, setRange]     = useState(30)
  const [saving, setSaving]   = useState(false)

  const reload = async () => {
    const [all, cfg] = await Promise.all([getWeightEntries(), getConfig()])
    setEntries(all)
    const map = {}
    cfg.forEach(c => { map[c.key] = c.value })
    setConfig(map)
  }

  useEffect(() => { reload().catch(console.error) }, [])

  useEffect(() => {
    getWeightEntry(date).then(rec => {
      setWeight(rec?.weight_kg != null ? String(rec.weight_kg) : '')
      setNotes(rec?.notes || '')
    }).catch(console.error)
  }, [date])

  // Keep "Today" honest if the page is left open past midnight.
  useEffect(() => {
    const timer = setInterval(() => {
      const fresh = new Date()
      if (format(fresh, 'yyyy-MM-dd') !== today) setNow(fresh)
    }, 60 * 1000)
    return () => clearInterval(timer)
  }, [today])

  const targetWeight = Number(config.target_weight) || null
  const plan         = planOn(config, today)
  const direction    = weightDirection(plan, { target: targetWeight, start: entries[0]?.weight_kg ?? null })

  const stats = useMemo(() => {
    if (!entries.length) return null
    const sorted  = entries
    const latest  = sorted[sorted.length - 1]
    const first   = sorted[0]

    const avgOf = (from, to) => {
      const slice = sorted.filter(e => e.date >= from && e.date <= to)
      if (!slice.length) return null
      return slice.reduce((s, e) => s + e.weight_kg, 0) / slice.length
    }

    const thisWeek = avgOf(format(subDays(now, 6), 'yyyy-MM-dd'), today)
    const lastWeek = avgOf(format(subDays(now, 13), 'yyyy-MM-dd'), format(subDays(now, 7), 'yyyy-MM-dd'))
    const fourWeeksAgo = avgOf(format(subDays(now, 34), 'yyyy-MM-dd'), format(subDays(now, 28), 'yyyy-MM-dd'))

    return {
      latest:     latest.weight_kg,
      sevenDayAvg: thisWeek != null ? Math.round(thisWeek * 10) / 10 : null,
      weekChange: thisWeek != null && lastWeek != null ? Math.round((thisWeek - lastWeek) * 10) / 10 : null,
      totalChange: Math.round((latest.weight_kg - first.weight_kg) * 10) / 10,
      target:     targetProgress(latest.weight_kg, targetWeight, direction),
      monthChange: thisWeek != null && fourWeeksAgo != null ? Math.round((thisWeek - fourWeeksAgo) * 10) / 10 : null,
      count:      sorted.length,
    }
  }, [entries, targetWeight, direction, today, now])

  const paceNote  = useMemo(() => weightPaceNote(entries, plan, now), [entries, plan?.goal, now])
  const askKeep   = plan && plan.goal !== 'keep' && stats?.target?.reached && config.target_reached_asked !== plan.from

  const answerReached = async (switchToKeep) => {
    await saveConfig({ key: 'target_reached_asked', value: plan.from })
    if (switchToKeep) {
      await saveGoalEntry({ ...plan, goal: 'keep', pace: null, fasting: true })
      await fetchTodayScore()
      toast.success('Goal changed to Keep')
    }
    await reload()
  }

  const chartData = useMemo(() => {
    const from = format(subDays(now, range), 'yyyy-MM-dd')
    return entries
      .filter(e => e.date >= from)
      .map(e => ({ label: format(parseISO(e.date), 'MMM d'), weight: e.weight_kg }))
  }, [entries, range, now])

  const bump = (delta) => {
    const base = parseFloat(weight) || stats?.latest || 70
    setWeight(String(Math.round((base + delta) * 10) / 10))
  }

  const handleSave = async () => {
    const value = parseFloat(weight)
    if (!value || value < 20 || value > 400) return toast.error('Enter a weight between 20 and 400 kg')
    setSaving(true)
    try {
      await saveWeightEntry({ date, weight_kg: Math.round(value * 10) / 10, notes })
      await reload()
      await fetchTodayScore()
      toast.success(`Weight saved — ${value} kg`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalTone  = stats ? weightTone(stats.totalChange, direction) : null
  const weekTone   = stats ? weightTone(stats.weekChange, direction) : null
  const monthTone  = stats ? weightTone(stats.monthChange, direction) : null
  const trendColor = col(TONE_TOKEN[totalTone] || 'text-secondary')
  const UpOrDown   = (change) => (change != null && change < 0 ? TrendingDown : TrendingUp)

  return (
    <div className="min-h-screen bg-surface-base pb-nav animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} aria-label="Back" className="icon-btn"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="t-title">Weight</h1>
          <p className="text-sm text-text-muted">{stats ? `Latest ${stats.latest} kg` : 'No entries yet'}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-6 space-y-6">

        {/* ── Log entry: the hero ── */}
        <section className="space-y-4">
          <div className="flex gap-1 bg-surface-elevated rounded-full p-1">
            {[
              { val: yesterday, label: 'Yesterday' },
              { val: today,     label: 'Today' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setDate(val)}
                className={`flex-1 py-2 rounded-full text-sm transition-colors ${date === val ? 'bg-surface-card text-text-primary font-semibold' : 'text-text-secondary font-medium'}`}>
                {label} · {format(parseISO(val), 'MMM d')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 py-2">
            <button onClick={() => bump(-0.1)} aria-label="0.1 kg less" className="icon-btn w-12 h-12 rounded-full"><Minus size={18} /></button>
            <div className="flex-1 text-center">
              <input
                type="number" step="0.1" inputMode="decimal" aria-label="Weight in kilograms"
                className="w-full bg-transparent text-center t-display outline-none"
                placeholder="—"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
              <p className="text-sm text-text-muted mt-1">kg</p>
            </div>
            <button onClick={() => bump(0.1)} aria-label="0.1 kg more" className="icon-btn w-12 h-12 rounded-full"><Plus size={18} /></button>
          </div>

          <input className="input" placeholder="Note (optional)"
            value={notes} onChange={e => setNotes(e.target.value)} />

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-4">
            {saving ? 'Saving…' : 'Save weight'}
          </button>
        </section>

        {askKeep && (
          <section className="card space-y-3">
            <p className="text-base font-semibold text-text-primary">You reached your target. Switch to keeping this weight?</p>
            <div className="flex gap-2">
              <button onClick={() => answerReached(true)} className="btn-primary flex-1">Switch to Keep</button>
              <button onClick={() => answerReached(false)} className="btn-ghost flex-1">Not now</button>
            </div>
          </section>
        )}

        {paceNote && (
          <p className="text-sm text-text-secondary flex items-start gap-2">
            <Info size={15} className="shrink-0 mt-0.5 text-text-muted" />{paceNote}
          </p>
        )}

        {/* ── Progress ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="7-day average" value={stats.sevenDayAvg ?? '—'} unit="kg" Icon={Scale} />
            <StatTile
              label="vs last week"
              value={stats.weekChange == null ? '—' : `${stats.weekChange > 0 ? '+' : ''}${stats.weekChange}`}
              unit="kg"
              tone={TONE_TOKEN[weekTone]}
              Icon={UpOrDown(stats.weekChange)}
            />
            <StatTile
              label="since start"
              value={`${stats.totalChange > 0 ? '+' : ''}${stats.totalChange}`}
              unit="kg" tone={TONE_TOKEN[totalTone]}
              Icon={UpOrDown(stats.totalChange)}
            />
            {direction === 'steady' ? (
              <StatTile
                label="vs 4 weeks ago"
                value={stats.monthChange == null ? '—' : `${stats.monthChange > 0 ? '+' : ''}${stats.monthChange}`}
                unit="kg" tone={TONE_TOKEN[monthTone]}
                Icon={UpOrDown(stats.monthChange)}
              />
            ) : (
              <StatTile
                label={stats.target?.reached ? 'target reached' : 'to target'}
                value={stats.target == null ? '—' : stats.target.left}
                unit={stats.target == null ? '' : 'kg'}
                Icon={Target}
              />
            )}
          </div>
        )}

        {/* ── Trend ─────────────────────────────────────────────────────── */}
        {chartData.length >= 2 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="t-heading">Trend</h2>
              <div className="flex gap-0.5 bg-surface-elevated rounded-full p-0.5">
                {RANGES.map(r => (
                  <button key={r.id} onClick={() => setRange(r.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      range === r.id ? 'bg-surface-card text-text-primary' : 'text-text-muted'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-surface-border))" vertical={false} />
                <XAxis dataKey="label" type="category"
                  tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<WeightTooltip />} />
                {targetWeight && (
                  <ReferenceLine y={targetWeight} stroke={col('text-muted')} strokeDasharray="4 2"
                    label={{ value: `target ${targetWeight}`, position: 'insideTopRight', fontSize: 12, fill: col('text-muted') }} />
                )}
                <Line dataKey="weight" stroke={trendColor} strokeWidth={2}
                  dot={{ r: 3, fill: trendColor, stroke: 'none' }} activeDot={{ r: 5 }}
                  type="monotone" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </section>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-text-secondary">Log a couple more days to see your trend.</p>
            <p className="text-xs text-text-muted mt-1">
              {stats ? `${stats.count} entr${stats.count === 1 ? 'y' : 'ies'} so far` : 'No entries yet'}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
