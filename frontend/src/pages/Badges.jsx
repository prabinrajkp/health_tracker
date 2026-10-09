import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { getBadgeStates, CATEGORY_META } from '../services/badgeEngine'
import { SUPER_BADGES } from '../services/superBadges'
import BadgeModal from '../components/BadgeModal'
import BadgeTile from '../components/BadgeTile'

// Every badge, grouped by category. Profile only shows the earned ones.
export default function Badges() {
  const navigate = useNavigate()
  const [badges, setBadges] = useState(null)
  const [modalBadge, setModalBadge] = useState(null)

  useEffect(() => { getBadgeStates().then(setBadges).catch(() => setBadges([])) }, [])

  if (!badges) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <p className="text-sm text-text-muted">Loading badges…</p>
    </div>
  )

  const unlockedIds = new Set(badges.filter(b => b.unlocked).map(b => b.id))
  const combos = SUPER_BADGES.map(sb => ({
    ...sb,
    have: sb.required.filter(id => unlockedIds.has(id)).length,
    unlocked: sb.required.every(id => unlockedIds.has(id)),
  }))

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="w-10 h-10 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center shrink-0">
          <ArrowLeft size={17} className="text-text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Badges</h1>
          <p className="text-xs text-text-muted">{unlockedIds.size} of {badges.length} earned</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const list = badges.filter(b => b.category === cat)
          if (!list.length) return null
          // Earned first, then closest to earning
          const ordered = [...list].sort((a, b) => (b.unlocked - a.unlocked) || (b.progress - a.progress))
          return (
            <div key={cat} className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">{meta.emoji}</span>
                <h2 className="text-sm font-semibold text-text-primary flex-1">{meta.label}</h2>
                <span className="text-xs text-text-muted">{list.filter(b => b.unlocked).length}/{list.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                {ordered.map(b => <BadgeTile key={b.id} badge={b} onTap={setModalBadge} />)}
              </div>
            </div>
          )
        })}

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🔱</span>
            <h2 className="text-sm font-semibold text-text-primary flex-1">Combinations</h2>
            <span className="text-xs text-text-muted">{combos.filter(c => c.unlocked).length}/{combos.length}</span>
          </div>
          <p className="text-xs text-text-muted mb-3">Earned by holding all three badges in the set.</p>
          <div className="space-y-3">
            {combos.map(c => (
              <div key={c.id} className="flex items-start gap-3 bg-surface-elevated rounded-2xl p-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 bg-surface-card">
                  {c.unlocked ? c.emoji : <Lock size={16} className="text-text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                    <span className={`text-xs font-semibold shrink-0 ${c.unlocked ? 'text-success' : 'text-text-muted'}`}>
                      {c.unlocked ? 'Earned' : `${c.have}/${c.required.length}`}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 leading-snug">{c.description}</p>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {c.required.map((id, i) => {
                      const has = unlockedIds.has(id)
                      return (
                        <span key={id} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${has ? 'bg-success/15 text-success' : 'bg-surface-card text-text-muted'}`}>
                          {has ? '✓ ' : ''}{c.requireLabels[i]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </div>
  )
}
