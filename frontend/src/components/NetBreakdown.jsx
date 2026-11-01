import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { describeNet, fmtKcal, fmtNet, fmtGoal } from '../services/energy'

const SOURCE_NOTE = {
  activity_level: 'No steps or exercise logged, so burn comes from your activity level.',
  device: 'Activity from Health Connect.',
}

// One line of net calories that opens to show how it was worked out. Burn figures
// are estimates, so they are rounded, marked with ~ and never coloured as failure.
export default function NetBreakdown({ net }) {
  const [open, setOpen] = useState(false)
  if (!net) return null
  const hasGoal = net.goal !== 'auto' || net.netGoal !== 0
  const rows = [
    ['Eaten', net.eaten.toLocaleString()],
    [net.burn.source === 'activity_level' ? 'Burned, from activity level' : 'Resting and daily life', fmtKcal(net.burn.resting)],
    ...(net.burn.steps > 0 ? [['Steps', fmtKcal(net.burn.steps)]] : []),
    ...(net.burn.exercise > 0 ? [[net.burn.source === 'device' ? 'Active calories' : 'Exercise', fmtKcal(net.burn.exercise)]] : []),
    ...(net.burn.adjust ? [['Your correction', fmtNet(net.burn.adjust)]] : []),
    ['Total burned', fmtKcal(net.burned)],
  ]
  const verdict = net.sick ? 'Sick day: not compared'
    : net.open ? null
    : net.counts ? describeNet(net.net, net.netGoal)
    : 'Too little logged to compare'

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 text-left py-1 active:opacity-70">
        <span className="flex-1 min-w-0 text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{net.open ? 'Net so far' : 'Net'} <span className="tabular-nums">{fmtNet(net.net)}</span></span>
          {hasGoal && <span className="tabular-nums"> · Goal {fmtGoal(net.netGoal)}</span>}
          {verdict && <span className="block">{verdict}</span>}
        </span>
        <ChevronDown size={16} className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pt-2 space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{label}</span>
              <span className="tabular-nums text-text-primary">{value}</span>
            </div>
          ))}
          <p className="t-caption leading-relaxed pt-1">
            {SOURCE_NOTE[net.burn.source] ? `${SOURCE_NOTE[net.burn.source]} ` : ''}
            Burn is an estimate. {net.open ? 'Resting burn is counted up to now. ' : ''}Your weight trend over a few weeks is the better guide.
          </p>
        </div>
      )}
    </div>
  )
}
