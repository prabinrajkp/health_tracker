import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { col } from '../services/theme'
import { summariseNet, describeNet, fmtNet, fmtGoal, fmtKcal, round10 } from '../services/energy'

// A thin bar rounded at its data end, anchored square on the zero line. Recharts
// reports a negative height for values below zero, so both directions are handled.
function NetBar({ x, y, width, height, fill, payload }) {
  const value = payload?.net
  if (value == null) return null
  const top = Math.min(y, y + height), h = Math.abs(height)
  if (h === 0) return null
  const r = Math.min(4, h, width / 2)
  const path = value >= 0
    ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`
    : `M${x},${top} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + width - r} Q${x + width},${top + h} ${x + width},${top + h - r} V${top} Z`
  return <path d={path} fill={fill} />
}

function NetTooltip({ active, payload }) {
  if (!active || !payload?.length || payload[0].payload.net == null) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-sm">
      <p className="font-semibold text-text-primary mb-1">{d.day}</p>
      <p className="text-text-secondary tabular-nums">Eaten {d.eaten.toLocaleString()}</p>
      <p className="text-text-secondary tabular-nums">Burned {fmtKcal(d.burned)}</p>
      <p className="text-text-primary font-semibold tabular-nums">Net {fmtNet(d.net)}</p>
    </div>
  )
}

const AXIS_TICK = { fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }

function DaysTable({ days }) {
  return (
    <details>
      <summary className="text-sm font-semibold text-brand-light py-1 cursor-pointer">Show days</summary>
      <div className="pt-2 space-y-1.5">
        {days.map(d => (
          <div key={d.date} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{format(parseISO(d.date), 'EEE, MMM d')}</span>
            <span className="tabular-nums text-text-primary">
              {d.counts ? `${d.eaten.toLocaleString()} − ${fmtKcal(d.burned).slice(1)} = ${fmtNet(d.net).slice(1)}`
                : d.sick ? 'Sick day' : d.open ? 'Still open' : 'Not enough logged'}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

// Net calories across the week: the average, then one bar for each day that counts.
export function NetWeek({ days }) {
  if (!days?.length) return null
  const s = summariseNet(days)
  if (!s) return (
    <section className="space-y-1">
      <h2 className="t-heading">Net calories</h2>
      <p className="text-sm text-text-secondary">Log two main meals with calorie data on a day and it will show here.</p>
    </section>
  )
  const data = days.map(d => ({
    label: format(parseISO(d.date), 'EEE'), day: format(parseISO(d.date), 'EEE, MMM d'),
    net: d.counts ? round10(d.net) : null, eaten: d.eaten, burned: d.burned,
  }))
  const goal = Math.round(s.netGoal)
  const values = [...data.map(r => r.net ?? 0), goal, 0]
  const domain = [Math.min(...values) - 100, Math.max(...values) + 100]
  const ticks  = [...new Set([0, goal])]

  return (
    <section className="space-y-3">
      <div>
        <h2 className="t-heading">Net calories</h2>
        <p className="flex items-baseline gap-1.5 mt-1">
          <span className="t-number">{fmtNet(s.avgNet)}</span>
          <span className="text-sm text-text-muted">a day · Goal {fmtGoal(goal)}</span>
        </p>
        <p className="text-sm text-text-secondary">{describeNet(s.avgNet, goal)} · from {s.days} complete day{s.days === 1 ? '' : 's'}</p>
      </div>
      <div role="img" aria-label={`Net calories by day. Average ${fmtNet(s.avgNet)} against a goal of ${fmtGoal(goal)}.`}>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" type="category" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={domain} ticks={ticks} tickFormatter={fmtGoal} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<NetTooltip />} cursor={{ fill: 'rgb(var(--c-surface-elevated))' }} />
            <ReferenceLine y={0} stroke="rgb(var(--c-surface-border))" />
            <ReferenceLine y={goal} stroke={col('text-muted')} strokeDasharray="4 2"
              label={{ value: 'goal', position: goal < 0 ? 'insideTopRight' : 'insideBottomRight', fontSize: 12, fill: col('text-muted') }} />
            <Bar dataKey="net" fill={col('brand')} maxBarSize={14} shape={<NetBar />} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DaysTable days={days} />
    </section>
  )
}

const fmtKg = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} kg`

function ScaleCheck({ check, onApply }) {
  const navigate = useNavigate()
  if (!check) return null
  const { plan, suggestion } = check
  const corrected = plan && (plan.maintenanceOffset || plan.burnOffset)

  if (!check.ready) {
    const { need, have } = check
    return (
      <div className="tile space-y-1">
        <p className="t-caption">Expected vs actual</p>
        <p className="text-sm text-text-secondary">
          Compares your logs with your weight once there is enough data: {have.days} of {need.days} complete days,
          {' '}{have.weighIns} of {need.weighIns} weigh-ins, across {need.spanDays} days.
        </p>
        {corrected ? (
          <button onClick={() => onApply({ maintenanceOffset: 0, burnOffset: 0 })} className="text-sm font-semibold text-brand-light py-1">
            Back to the formula estimate
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="card space-y-2">
      <p className="text-xs font-semibold text-brand-light">Expected vs actual, last 4 weeks</p>
      <p className="text-base text-text-primary leading-relaxed">
        Your logs suggest {fmtKg(check.expectedKgPerWeek)} a week. Your weight changed {fmtKg(check.actualKgPerWeek)} a week.
      </p>
      {suggestion ? (
        <>
          <p className="text-sm text-text-secondary">
            Your working maintenance looks about {Math.abs(suggestion.change)} kcal {suggestion.change > 0 ? 'higher' : 'lower'} than the estimate
            {suggestion.limited ? ', so the correction is limited to 20% of the formula' : ''}.
            This also absorbs any habit in how you log.
          </p>
          {plan ? (
            <button onClick={() => onApply({ maintenanceOffset: suggestion.maintenanceOffset, burnOffset: suggestion.burnOffset })} className="btn-primary w-full">
              Use this figure
            </button>
          ) : (
            <button onClick={() => navigate('/settings?section=body')} className="btn-ghost w-full">Choose a body goal first</button>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary">Close enough that your estimate needs no change.</p>
      )}
      {corrected ? (
        <button onClick={() => onApply({ maintenanceOffset: 0, burnOffset: 0 })} className="text-sm font-semibold text-brand-light py-1">
          Back to the formula estimate
        </button>
      ) : null}
    </div>
  )
}

export function NetMonth({ days, check, onApply }) {
  const s = summariseNet(days || [])
  if (!s && !check) return null
  return (
    <section className="space-y-3">
      <h2 className="t-heading">Net calories</h2>
      {s ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Avg net', value: fmtNet(s.avgNet) },
            { label: 'Goal', value: fmtGoal(s.netGoal) },
            { label: 'Complete days', value: s.days },
          ].map(m => (
            <div key={m.label} className="tile">
              <p className="text-base font-semibold tabular-nums text-text-primary">{m.value}</p>
              <p className="t-caption leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">No complete days this month yet.</p>
      )}
      <ScaleCheck check={check} onApply={onApply} />
    </section>
  )
}
