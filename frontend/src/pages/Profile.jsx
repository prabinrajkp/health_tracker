import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Flame, ChevronRight, CheckCircle2 } from 'lucide-react'
import { computePrestige, getAuraStyle } from '../services/prestigeEngine'
import { computeQuests } from '../services/questEngine'
import { getBadgeStates, TIER_META } from '../services/badgeEngine'
import BadgeModal from '../components/BadgeModal'
import BadgeTile from '../components/BadgeTile'
import useStore from '../store/useStore'

const EARNED_PREVIEW = 8   // two rows of four; the rest are behind "See all"
const TIER_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

function GoalRow({ goal }) {
  const pct   = Math.round(goal.progress * 100)
  const color = goal.failed ? '#ef4444' : goal.complete ? '#22c55e' : '#a78bfa'
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-lg shrink-0 w-7 text-center">{goal.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-text-primary truncate">{goal.label}</p>
          <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color }}>
            {goal.complete && <CheckCircle2 size={12} />}+{goal.xp} XP
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
        <p className="text-xs text-text-muted mt-1">{goal.desc}</p>
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { streak, config, refreshAll } = useStore()

  const [level, setLevel]   = useState(null)
  const [badges, setBadges] = useState([])
  const [goals, setGoals]   = useState(null)
  const [modalBadge, setModalBadge] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshAll()
    Promise.all([computePrestige(), getBadgeStates(), computeQuests()])
      .then(([prestige, allBadges, quests]) => {
        setLevel(prestige)
        setBadges(allBadges)
        setGoals(quests)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <p className="text-sm text-text-muted">Loading your profile…</p>
    </div>
  )

  const playerName = config?.player_name || 'Player'
  const aura  = getAuraStyle(level?.level || 1)
  const xpPct = level ? Math.round((level.currentXP / level.nextLevelXP) * 100) : 0

  const earned = badges.filter(b => b.unlocked)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4) || (b.unlockedAt || 0) - (a.unlockedAt || 0))
  // Hidden badges stay a surprise until they are at least half done
  const nextBadge = badges
    .filter(b => !b.unlocked && !(b.hidden && b.progress < 0.5))
    .sort((a, b) => b.progress - a.progress)[0]
  const nextColor = nextBadge ? (TIER_META[nextBadge.tier] || TIER_META.common).color : null

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">

      <div className="page-header">
        <h1 className="text-base font-semibold text-text-primary flex-1">Profile</h1>
        <button onClick={() => navigate('/settings')} aria-label="Settings"
          className="w-10 h-10 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center active:scale-95 transition-transform">
          <Settings size={17} className="text-text-secondary" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">

        {/* ── 1. Who ── */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2 shrink-0"
              style={{ background: `${aura.color}20`, borderColor: `${aura.color}60`, color: aura.color }}>
              {playerName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-text-primary truncate">{playerName}</h2>
              <p className="text-sm font-semibold" style={{ color: aura.color }}>Level {level?.level ?? 1}</p>
            </div>
            {streak > 0 && (
              <div className="text-center shrink-0">
                <p className="flex items-center gap-1 text-xl font-bold text-text-primary tabular-nums">
                  <Flame size={16} className="text-orange-400" />{streak}
                </p>
                <p className="text-xs text-text-muted">day streak</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${xpPct}%`, background: aura.color }} />
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {level?.currentXP ?? 0} / {level?.nextLevelXP ?? 0} XP to Level {(level?.level ?? 1) + 1}
            </p>
          </div>
        </div>

        {/* ── 2. Next badge ── */}
        {nextBadge && (
          <button onClick={() => setModalBadge(nextBadge)} className="w-full card text-left active:scale-[0.98] transition-transform">
            <p className="section-label mb-3">Next badge</p>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border"
                style={{ borderColor: `${nextColor}60`, background: `${nextColor}12` }}>
                {nextBadge.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{nextBadge.name}</p>
                <p className="text-xs text-text-muted mt-0.5 leading-snug">{nextBadge.criterion}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${nextBadge.progress * 100}%`, background: nextColor }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: nextColor }}>{Math.round(nextBadge.progress * 100)}%</span>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* ── 3. Goals ── */}
        {goals && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="section-label">Today's goals</p>
              <span className="text-xs text-text-muted">{goals.daily.filter(g => g.complete).length}/{goals.daily.length} done</span>
            </div>
            <div className="divide-y divide-surface-border">
              {goals.daily.map(g => <GoalRow key={g.id} goal={g} />)}
            </div>

            <div className="flex items-center justify-between mt-4 mb-1">
              <p className="section-label">This week's goals</p>
              <span className="text-xs text-text-muted">{goals.weekly.filter(g => g.complete).length}/{goals.weekly.length} done</span>
            </div>
            <div className="divide-y divide-surface-border">
              {goals.weekly.map(g => <GoalRow key={g.id} goal={g} />)}
            </div>
          </div>
        )}

        {/* ── 4. Badges ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Badges</p>
            <button onClick={() => navigate('/profile/badges')}
              className="flex items-center gap-0.5 text-xs font-semibold text-brand-light">
              See all {earned.length}/{badges.length} <ChevronRight size={13} />
            </button>
          </div>
          {earned.length === 0 ? (
            <p className="text-sm text-text-muted">No badges yet — your first one comes with your first good day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {earned.slice(0, EARNED_PREVIEW).map(b => <BadgeTile key={b.id} badge={b} onTap={setModalBadge} />)}
            </div>
          )}
        </div>
      </div>

      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </div>
  )
}
