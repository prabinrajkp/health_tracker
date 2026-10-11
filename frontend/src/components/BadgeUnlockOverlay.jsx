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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95" onClick={onDismiss}>
      <div className="text-center px-8"
        style={{ animation: 'badgeUnlockScale 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>

        <p className="text-sm font-semibold text-white/70 mb-6">Badge earned</p>

        <div className="w-28 h-28 rounded-xl inline-flex items-center justify-center text-6xl mb-6"
          style={{ background: t.bg, border: `2px solid ${t.color}` }}>
          {badge.emoji}
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">{badge.name}</h1>
        <p className="text-sm text-white/70 capitalize mb-5">{t.label} · {badge.category}</p>

        <p className="text-base text-white/80 leading-relaxed max-w-[280px] mx-auto mb-8">{badge.lore}</p>

        <p className="text-sm text-white/60">
          {remaining > 1 ? `${remaining - 1} more badge${remaining > 2 ? 's' : ''} to see` : 'Tap to continue'}
        </p>
      </div>
    </div>
  )
}
