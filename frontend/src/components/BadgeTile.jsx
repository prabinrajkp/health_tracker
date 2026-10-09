import { TIER_META } from '../services/badgeEngine'

// One badge, used on Profile and on the all-badges page. Rarity shows only as
// the tile's colour and repeat earns only as a ×N count — no extra labels.
export default function BadgeTile({ badge, onTap }) {
  const t   = TIER_META[badge.tier] || TIER_META.common
  const dim = 60
  const mystery = badge.hidden && !badge.unlocked && badge.progress < 0.5

  if (mystery) return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="rounded-2xl flex items-center justify-center border border-surface-border bg-surface-elevated text-text-muted text-xl"
        style={{ width: dim, height: dim }}>?</div>
      <p className="text-[11px] text-text-muted">Hidden</p>
    </div>
  )

  const r = (dim - 5) / 2, circ = 2 * Math.PI * r
  return (
    <button onClick={() => onTap?.(badge)} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform min-w-0">
      <div className="relative" style={{ width: dim, height: dim }}>
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
          style={{
            border: `1.5px solid ${badge.unlocked ? t.color : 'rgb(var(--c-surface-border))'}`,
            background: badge.unlocked ? t.bg : 'rgb(var(--c-surface-elevated))',
          }}>
          <span style={{ fontSize: 26, filter: badge.unlocked ? 'none' : 'grayscale(1) opacity(0.35)' }}>{badge.emoji}</span>
        </div>
        {!badge.unlocked && badge.progress > 0.05 && (
          <svg width={dim} height={dim} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={t.color} strokeWidth={3}
              strokeDasharray={`${circ * badge.progress} ${circ}`} strokeLinecap="round" />
          </svg>
        )}
        {badge.unlocked && badge.earnCount > 1 && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none"
            style={{ background: t.color, color: '#000' }}>×{badge.earnCount}</span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-center leading-tight w-full truncate"
        style={{ color: badge.unlocked ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-muted))' }}>
        {badge.name}
      </p>
    </button>
  )
}
