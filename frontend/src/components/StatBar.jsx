export default function StatBar({ label, value, max, color = '#6366f1', icon, sublabel }) {
  const pct = Math.min((value / max) * 100, 100)
  const isHigh = pct >= 75
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <span className="text-sm font-medium text-text-secondary">{label}</span>
          {sublabel && <span className="text-xs text-text-muted">{sublabel}</span>}
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {Math.round(value)}<span className="text-text-muted font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden bg-surface-elevated">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: isHigh ? `0 0 8px ${color}80` : 'none',
          }}
        />
      </div>
    </div>
  )
}
