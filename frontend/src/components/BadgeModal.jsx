import { format } from 'date-fns'
import { X, Check } from 'lucide-react'
import { TIER_META, CATEGORY_META } from '../services/badgeEngine'

export default function BadgeModal({ badge, onClose }) {
  if (!badge) return null
  const t   = TIER_META[badge.tier] || TIER_META.common
  const cat = CATEGORY_META[badge.category] || {}

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface-card w-full max-w-lg rounded-t-xl p-5 pb-8 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="icon-btn"><X size={18} /></button>
        </div>

        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl"
            style={{
              background: badge.unlocked ? t.bg : 'rgb(var(--c-surface-elevated))',
              border: badge.unlocked ? `2px solid ${t.color}` : '2px solid transparent',
              filter: badge.unlocked ? 'none' : 'grayscale(0.8) opacity(0.6)',
            }}>
            {badge.emoji}
          </div>
          <div>
            <h2 className="t-title">{badge.name}</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {t.label} · {cat.label}
              {badge.unlocked && badge.unlockedAt ? ` · earned ${format(new Date(badge.unlockedAt), 'MMM d, yyyy')}` : ''}
            </p>
          </div>
        </div>

        <p className="text-base text-text-secondary leading-relaxed text-center mb-5">{badge.lore}</p>

        <div className="tile">
          <p className="t-caption">How to earn it</p>
          <p className="text-base text-text-primary">{badge.criterion}</p>
        </div>

        {!badge.unlocked && badge.progress > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-text-secondary">Progress</span>
              <span className="font-semibold text-text-primary tabular-nums">{Math.round(badge.progress * 100)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill bg-brand" style={{ width: `${badge.progress * 100}%` }} />
            </div>
          </div>
        )}

        {badge.unlocked && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-success mt-4">
            <Check size={15} strokeWidth={3} />
            {badge.earnCount > 1 ? `Earned ${badge.earnCount} times` : 'Earned'}
          </p>
        )}
      </div>
    </div>
  )
}
