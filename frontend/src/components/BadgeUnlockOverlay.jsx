import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { TIER_META } from '../services/badgeEngine'

export default function BadgeUnlockOverlay({ badge, remaining, onDismiss }) {
  const t = TIER_META[badge.tier] || TIER_META.common

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
      if (badge.tier === 'legendary' || badge.tier === 'epic') {
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}), 280)
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}), 560)
      }
    }
    const timer = setTimeout(onDismiss, 3800)
    return () => clearTimeout(timer)
  }, [badge.id])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onDismiss}
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
    >
      {/* ambient radial glow */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          width: 360, height: 360,
          background: `radial-gradient(circle, ${t.color}35 0%, transparent 70%)`,
          animation: 'badgeLegendaryAura 2s ease-in-out infinite',
        }} />

      <div className="text-center px-8 relative"
        style={{ animation: 'badgeUnlockScale 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>

        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-white/40 mb-8">
          Badge Unlocked
        </p>

        {/* Badge icon */}
        <div className="relative inline-flex mb-6">
          <div className="w-32 h-32 rounded-[28px] flex items-center justify-center text-7xl"
            style={{
              background: `${t.color}22`,
              border: `3px solid ${t.color}`,
              boxShadow: `0 0 40px ${t.color}70, 0 0 80px ${t.color}35, inset 0 0 24px ${t.color}15`,
              animation: t.anim,
            }}>
            {badge.emoji}
          </div>
        </div>

        {/* Name */}
        <h1 className="text-4xl font-black uppercase tracking-wider mb-3"
          style={{ color: t.color, textShadow: `0 0 20px ${t.color}80` }}>
          {badge.name}
        </h1>

        {/* Tier chip */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background: `${t.color}20`, border: `1px solid ${t.color}55` }}>
          <span className="text-sm font-bold" style={{ color: t.color }}>{t.label} Badge</span>
          <span className="text-xs text-white/40 capitalize">· {badge.category}</span>
        </div>

        {/* Lore */}
        <p className="text-sm text-white/55 italic leading-relaxed max-w-[260px] mx-auto mb-8">
          "{badge.lore}"
        </p>

        <p className="text-xs text-white/25">
          {remaining > 1 ? `${remaining - 1} more badge${remaining > 2 ? 's' : ''} to reveal` : 'Tap to continue'}
        </p>
      </div>
    </div>
  )
}
