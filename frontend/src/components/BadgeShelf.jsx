import { useState } from 'react'
import { TIER_META } from '../services/badgeEngine'
import BadgeModal from './BadgeModal'

function ProgressRing({ progress, size, color }) {
  const r = (size - 5) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3.5}
        strokeDasharray={`${circ * progress} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

function BadgeCard({ badge, size = 'md', onTap }) {
  const t = TIER_META[badge.tier] || TIER_META.common
  const dim = size === 'sm' ? 52 : 68

  return (
    <button onClick={() => onTap?.(badge)}
      className="flex flex-col items-center shrink-0 active:scale-95 transition-transform"
      style={{ width: dim + 12, gap: 5 }}>
      <div className="relative" style={{ width: dim, height: dim }}>
        {/* Glow bg for unlocked */}
        {badge.unlocked && (
          <div className="absolute inset-0 rounded-[16px]"
            style={{ background: t.glow, animation: t.anim, borderRadius: 16 }} />
        )}
        {/* Card face */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            borderRadius: 16,
            border: `2px solid ${badge.unlocked ? t.color : 'rgba(255,255,255,0.09)'}`,
            background: badge.unlocked ? t.bg : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(8px)',
            boxShadow: badge.unlocked ? `0 4px 16px ${t.color}35` : 'none',
          }}>
          <span style={{ fontSize: size === 'sm' ? 22 : 28, filter: badge.unlocked ? 'none' : 'grayscale(1) brightness(0.35)' }}>
            {badge.emoji}
          </span>
        </div>
        {/* Progress ring */}
        {!badge.unlocked && badge.progress > 0.05 && (
          <ProgressRing progress={badge.progress} size={dim} color={t.color} />
        )}
        {/* Tier dot */}
        {badge.unlocked && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-base flex items-center justify-center text-[8px] font-black"
            style={{ background: t.color, color: '#000' }}>
            {badge.tier === 'legendary' ? '✦' : badge.tier === 'epic' ? '◆' : badge.tier === 'rare' ? '●' : '·'}
          </div>
        )}
        {/* Near-unlock pulse ring */}
        {!badge.unlocked && badge.progress >= 0.7 && (
          <div className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: `2px solid ${t.color}`, animation: 'badgePulse 1.5s ease-in-out infinite', borderRadius: 16 }} />
        )}
      </div>
      <p className="text-center leading-tight font-semibold max-w-full px-0.5 truncate"
        style={{ fontSize: size === 'sm' ? 9 : 10, color: badge.unlocked ? t.color : 'rgb(var(--c-text-muted))' }}>
        {badge.name}
      </p>
      {!badge.unlocked && badge.progress > 0.05 && (
        <p style={{ fontSize: 8 }} className="text-text-muted -mt-1">
          {Math.round(badge.progress * 100)}%
        </p>
      )}
    </button>
  )
}

export function BadgeShelfMini({ thisWeek, nearUnlock, onViewAll }) {
  const [modalBadge, setModalBadge] = useState(null)
  const show = [...(thisWeek || []).slice(0, 4), ...(nearUnlock || []).slice(0, 3 - Math.min((thisWeek || []).length, 4))]
  if (show.length === 0) return null

  return (
    <>
      <div className="card" style={{ background: 'rgba(124,58,237,0.05)', borderColor: 'rgba(124,58,237,0.2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-light mb-0.5">This Week</p>
            <h3 className="text-sm font-bold text-text-primary">Badge Progress</h3>
          </div>
          <button onClick={onViewAll}
            className="text-[10px] font-semibold text-text-muted px-2 py-1 rounded-lg bg-surface-elevated">
            View all →
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {show.map(b => <BadgeCard key={b.id} badge={b} size="sm" onTap={setModalBadge} />)}
          {nearUnlock?.length > 0 && nearUnlock[0] && !show.includes(nearUnlock[0]) && (
            <BadgeCard badge={nearUnlock[0]} size="sm" onTap={setModalBadge} />
          )}
        </div>
        {thisWeek?.length > 0 && (
          <p className="text-[10px] text-text-muted mt-2">
            🏅 {thisWeek.length} badge{thisWeek.length !== 1 ? 's' : ''} unlocked this week
          </p>
        )}
      </div>
      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </>
  )
}

export default function BadgeShelf({ badges, compact = false }) {
  const [modalBadge, setModalBadge] = useState(null)
  if (!badges?.length) return null

  const unlocked   = badges.filter(b => b.unlocked)
  const nearUnlock = badges.filter(b => !b.unlocked && b.progress >= 0.45)
  const locked     = badges.filter(b => !b.unlocked && b.progress < 0.45)
  const ordered    = [...unlocked, ...nearUnlock, ...locked]

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-primary">Badge Shelf</h2>
          <span className="text-xs text-text-muted">{unlocked.length}/{badges.length} unlocked</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {ordered.map(b => <BadgeCard key={b.id} badge={b} size={compact ? 'sm' : 'md'} onTap={setModalBadge} />)}
        </div>
      </div>
      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </>
  )
}
