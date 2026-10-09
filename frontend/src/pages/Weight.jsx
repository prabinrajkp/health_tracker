import { useEffect, useMemo, useState } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { Save, Scale, Minus, Plus, TrendingDown, TrendingUp, Target, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { getWeightEntry, getWeightEntries, saveWeightEntry, getConfig } from '../api/client'
import useStore from '../store/useStore'

const RANGES = [
  { id: 30,  label: '30d' },
  { id: 90,  label: '90d' },
  { id: 365, label: '1y' },
]

const WeightTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-xs shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      <p style={{ color: payload[0].color }}>{payload[0].value} kg</p>
    </div>
  )
}

function StatTile({ label, value, unit, color, Icon }) {
  return (
    <div className="bg-surface-elevated rounded-2xl p-3 flex flex-col gap-1.5"
      style={{ boxShadow: `0 2px 12px ${color}20` }}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} style={{ color }} />}
        <p className="text-xs text-text-muted">{label}</p>
      </div>
      <p className="text-xl font-black tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="text-xs font-semibold text-text-muted ml-0.5">{unit}</span>}
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

    return {
      latest:     latest.weight_kg,
      sevenDayAvg: thisWeek != null ? Math.round(thisWeek * 10) / 10 : null,
      weekChange: thisWeek != null && lastWeek != null ? Math.round((thisWeek - lastWeek) * 10) / 10 : null,
      totalChange: Math.round((latest.weight_kg - first.weight_kg) * 10) / 10,
      toTarget:   targetWeight ? Math.round((latest.weight_kg - targetWeight) * 10) / 10 : null,
      count:      sorted.length,
    }
  }, [entries, targetWeight, today, now])

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

  const losing = stats?.totalChange != null && stats.totalChange < 0
  const trendColor = losing ? '#22c55e' : '#f97316'

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="w-10 h-10 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center shrink-0">
          <ArrowLeft size={17} className="text-text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Weight</h1>
          <p className="text-xs text-text-muted">{format(now, 'EEEE, MMM d')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-text-primary tabular-nums">
            {stats ? stats.latest : '—'}<span className="text-sm font-normal text-text-muted"> kg</span>
          </p>
          <p className="text-xs text-text-muted">latest</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* ── Log entry ─────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <div>
            <p className="section-label mb-2">Which day?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: yesterday, label: 'Yesterday' },
                { val: today,     label: 'Today' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => setDate(val)}
                  className="py-2.5 rounded-xl border-2 transition-all text-left px-3"
                  style={date === val
                    ? { borderColor: 'rgb(var(--c-brand))', background: 'rgb(var(--c-brand) / 0.1)' }
                    : { borderColor: 'rgb(var(--c-surface-border))', background: 'rgb(var(--c-surface-elevated))' }}>
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted">{format(parseISO(val), 'EEE, MMM d')}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Weight</p>
            <div className="bg-surface-base rounded-xl p-4 flex items-center gap-4">
              <button onClick={() => bump(-0.1)}
                className="w-10 h-10 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center shrink-0">
                <Minus size={14} className="text-text-secondary" />
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number" step="0.1" inputMode="decimal"
                  className="w-full bg-transparent text-center text-4xl font-bold tabular-nums text-text-primary outline-none"
                  placeholder="—"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                />
                <p className="text-xs text-text-muted mt-0.5">kg</p>
              </div>
              <button onClick={() => bump(0.1)}
                className="w-10 h-10 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center shrink-0">
                <Plus size={14} className="text-text-secondary" />
              </button>
            </div>
          </div>

          <input className="input" placeholder="Note (optional) — e.g. after workout"
            value={notes} onChange={e => setNotes(e.target.value)} />

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            <Save size={15} />{saving ? 'Saving…' : 'Save weight'}
          </button>
        </div>

        {/* ── Progress ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="7-day average" value={stats.sevenDayAvg ?? '—'} unit="kg" color="#38bdf8" Icon={Scale} />
            <StatTile
              label="vs last week"
              value={stats.weekChange == null ? '—' : `${stats.weekChange > 0 ? '+' : ''}${stats.weekChange}`}
              unit="kg"
              color={stats.weekChange != null && stats.weekChange < 0 ? '#22c55e' : '#f97316'}
              Icon={stats.weekChange != null && stats.weekChange < 0 ? TrendingDown : TrendingUp}
            />
            <StatTile
              label="since start"
              value={`${stats.totalChange > 0 ? '+' : ''}${stats.totalChange}`}
              unit="kg" color={trendColor}
              Icon={losing ? TrendingDown : TrendingUp}
            />
            <StatTile
              label={stats.toTarget != null && stats.toTarget <= 0 ? 'target reached' : 'to target'}
              value={stats.toTarget == null ? '—' : Math.abs(stats.toTarget)}
              unit={stats.toTarget == null ? '' : 'kg'}
              color="#a78bfa" Icon={Target}
            />
          </div>
        )}

        {/* ── Trend ─────────────────────────────────────────────────────── */}
        {chartData.length >= 2 ? (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Trend</p>
              <div className="flex gap-0.5 bg-surface-elevated rounded-lg p-0.5">
                {RANGES.map(r => (
                  <button key={r.id} onClick={() => setRange(r.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
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
                  tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<WeightTooltip />} />
                {targetWeight && (
                  <ReferenceLine y={targetWeight} stroke="#a78bfa" strokeDasharray="4 2"
                    label={{ value: `target ${targetWeight}`, position: 'insideTopRight', fontSize: 11, fill: '#a78bfa' }} />
                )}
                <Line dataKey="weight" stroke={trendColor} strokeWidth={2}
                  dot={{ r: 3, fill: trendColor, stroke: 'none' }} activeDot={{ r: 5 }}
                  type="monotone" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="card text-center py-6">
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
