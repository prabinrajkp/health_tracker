export default function CheckItem({ label, checked, onChange, points, penalize = false, sublabel }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-2.5 border-b border-surface-border/40 last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium transition-colors ${checked ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
          {label}
        </span>
        {sublabel && <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      {points !== undefined && (
        <span className={`text-xs font-semibold shrink-0 tabular-nums px-2 py-0.5 rounded-full ${
          checked
            ? penalize ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'
            : 'bg-surface-elevated text-text-muted'
        }`}>
          {penalize ? '-' : '+'}{Math.abs(points)} pts
        </span>
      )}
    </label>
  )
}
