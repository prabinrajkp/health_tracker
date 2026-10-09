import { format } from 'date-fns'
import { X } from 'lucide-react'
import { TIER_META, CATEGORY_META, getEarnEvolutionTier } from '../services/badgeEngine'

export default function BadgeModal({ badge, onClose }) {
  if (!badge) return null
  const t = TIER_META[badge.tier] || TIER_META.common
  const cat = CATEGORY_META[badge.category] || {}
  const evo = badge.earnCount > 1 ? getEarnEvolutionTier(badge.earnCount) : null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
      <div
        className="bg-surface-card w-full max-w-lg rounded-t-3xl p-6 pb-10 animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ border: `1px solid ${t.color}30` }}>

        {/* Close */}
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1.5 rounded-xl text-text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Badge hero */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
            style={{
              background: `${t.color}20`,
              border: `2.5px solid ${t.color}`,
              boxShadow: badge.unlocked ? `0 0 32px ${t.color}60, 0 0 64px ${t.color}25` : 'none',
              filter: badge.unlocked ? 'none' : 'grayscale(0.8) opacity(0.5)',
              animation: badge.unlocked ? t.anim : 'none',
            }}>
            {badge.emoji}
          </div>

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                style={{ color: t.color, background: `${t.color}20` }}>
                {t.label}
              </span>
              <span className="text-[10px] text-text-muted">{cat.emoji} {cat.label}</span>
            </div>
            <h2 className="text-2xl font-black text-text-primary">{badge.name}</h2>
            {badge.unlocked && badge.unlockedAt && (
              <p className="text-xs text-text-muted">
                Unlocked {format(new Date(badge.unlockedAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>

        {/* Lore */}
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: `${t.color}0e`, border: `1px solid ${t.color}22` }}>
          <p className="text-sm text-text-secondary italic leading-relaxed">"{badge.lore}"</p>
        </div>

        {/* Criterion */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Unlock Condition</p>
          <p className="text-sm text-text-primary">{badge.criterion}</p>
        </div>

        {/* Progress bar if not unlocked */}
        {!badge.unlocked && badge.progress > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Progress</p>
              <p className="text-xs font-bold" style={{ color: t.color }}>
                {Math.round(badge.progress * 100)}%
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${badge.progress * 100}%`, background: `linear-gradient(90deg, ${t.color}80, ${t.color})` }} />
            </div>
            {badge.progress >= 0.7 && (
              <p className="text-xs font-semibold" style={{ color: t.color }}>
                Almost there — keep going!
              </p>
            )}
          </div>
        )}

        {badge.unlocked && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-success text-sm font-bold">✓ Badge Collected</span>
          </div>
        )}

        {/* Earn count + evolution tier */}
        {badge.unlocked && badge.earnCount > 1 && evo && (
          <div className="mt-3 rounded-2xl p-3 flex items-center gap-3"
            style={{ background: `${evo.color}12`, border: `1px solid ${evo.color}28` }}>
            <span className="text-xl">{evo.symbol}</span>
            <div>
              <p className="text-xs font-bold" style={{ color: evo.color }}>{evo.label} Tier — x{badge.earnCount} earned</p>
              <p className="text-[10px] text-text-muted mt-0.5">This badge represents a repeatable habit you've mastered.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
