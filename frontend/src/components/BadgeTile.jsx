import { TIER_META } from '../services/badgeEngine'

// One badge, used on Profile and on the all-badges page. Rarity shows only as
// the tile's colour and repeat earns only as a ×N count. The emoji is the
// badge's artwork, which is why it stays an emoji here.
export default function BadgeTile({ badge, onTap, size = 52 }) {
  const t = TIER_META[badge.tier] || TIER_META.common
  const mystery = badge.hidden && !badge.unlocked && badge.progress < 0.5

  if (mystery) return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="rounded-xl flex items-center justify-center bg-surface-elevated text-text-muted text-xl"
        style={{ width: size, height: size }}>?</div>
      <p className="text-xs text-text-muted">Hidden</p>
    </div>
  )

  const r = (size - 4) / 2, circ = 2 * Math.PI * r
  return (
    <button onClick={() => onTap?.(badge)} className="flex flex-col items-center gap-1.5 min-w-0 active:opacity-70 transition-opacity">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-xl flex items-center justify-center"
          style={{
            border: badge.unlocked ? `1.5px solid ${t.color}` : '1.5px solid transparent',
            background: badge.unlocked ? t.bg : 'rgb(var(--c-surface-elevated))',
          }}>
          <span style={{ fontSize: size * 0.46, filter: badge.unlocked ? 'none' : 'grayscale(1) opacity(0.4)' }}>{badge.emoji}</span>
        </div>
        {!badge.unlocked && badge.progress > 0.05 && (
          <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-brand))" strokeWidth={2.5}
              strokeDasharray={`${circ * badge.progress} ${circ}`} strokeLinecap="round" />
          </svg>
        )}
        {badge.unlocked && badge.earnCount > 1 && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold leading-none bg-text-primary text-surface-base">
            ×{badge.earnCount}
          </span>
        )}
      </div>
      <p className={`text-xs text-center leading-tight w-full truncate ${badge.unlocked ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
        {badge.name}
      </p>
    </button>
  )
}
