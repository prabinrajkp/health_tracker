import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Check } from 'lucide-react'
import { getBadgeStates, CATEGORY_META } from '../services/badgeEngine'
import { SUPER_BADGES } from '../services/superBadges'
import BadgeModal from '../components/BadgeModal'
import BadgeTile from '../components/BadgeTile'

const PREVIEW = 6   // one row per category until it is opened

// Every badge, grouped by category. Each category shows one row — earned first,
// then the closest to earning — and opens to show the rest.
export default function Badges() {
  const navigate = useNavigate()
  const [badges, setBadges] = useState(null)
  const [open, setOpen]     = useState({})
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
    <div className="min-h-screen bg-surface-base pb-nav animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} aria-label="Back" className="icon-btn"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="t-title">Badges</h1>
          <p className="text-sm text-text-muted">{unlockedIds.size} of {badges.length} earned</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-6 space-y-6">
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const list = badges.filter(b => b.category === cat)
          if (!list.length) return null
          const ordered = [...list].sort((a, b) => (b.unlocked - a.unlocked) || (b.progress - a.progress))
          const isOpen  = !!open[cat]
          const shown   = isOpen ? ordered : ordered.slice(0, PREVIEW)
          return (
            <section key={cat}>
              <button onClick={() => setOpen(o => ({ ...o, [cat]: !o[cat] }))}
                className="w-full flex items-center gap-2 h-11 text-left" aria-expanded={isOpen}>
                <h2 className="t-heading flex-1">{meta.label}</h2>
                <span className="text-sm text-text-muted tabular-nums">{list.filter(b => b.unlocked).length} of {list.length}</span>
                {list.length > PREVIEW && (
                  <ChevronDown size={18} className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              <div className="grid grid-cols-6 gap-x-1.5 gap-y-4">
                {shown.map(b => <BadgeTile key={b.id} badge={b} onTap={setModalBadge} size={46} />)}
              </div>
            </section>
          )
        })}

        <section>
          <div className="flex items-baseline justify-between h-11">
            <h2 className="t-heading">Combinations</h2>
            <span className="text-sm text-text-muted">{combos.filter(c => c.unlocked).length} of {combos.length}</span>
          </div>
          <div className="group-list">
            {combos.map(c => (
              <div key={c.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-base font-medium text-text-primary">{c.name}</p>
                  <span className={`text-sm shrink-0 ${c.unlocked ? 'text-success font-semibold' : 'text-text-muted'}`}>
                    {c.unlocked ? 'Earned' : `${c.have} of ${c.required.length}`}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-0.5">{c.description}</p>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {c.required.map((id, i) => {
                    const has = unlockedIds.has(id)
                    return (
                      <span key={id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${has ? 'bg-success/15 text-success font-semibold' : 'bg-surface-elevated text-text-secondary'}`}>
                        {has && <Check size={11} strokeWidth={3} />}{c.requireLabels[i]}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </div>
  )
}
