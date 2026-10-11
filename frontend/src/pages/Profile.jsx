import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Flame, ChevronRight, Check, Scale, Sunrise, Footprints, Salad, Dumbbell, CalendarCheck, TrendingUp, Target,
} from 'lucide-react'
import { computePrestige } from '../services/prestigeEngine'
import { computeQuests } from '../services/questEngine'
import { getBadgeStates } from '../services/badgeEngine'
import BadgeModal from '../components/BadgeModal'
import BadgeTile from '../components/BadgeTile'
import useStore from '../store/useStore'

const EARNED_PREVIEW = 10   // two rows of five; the rest are behind "See all"
const TIER_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }
const GOAL_ICONS = {
  weigh_in: Scale, breakfast: Sunrise, steps_8k: Footprints, no_junk: Salad, exercise: Dumbbell,
  weekly_workouts: Dumbbell, weekly_log: CalendarCheck, weekly_score: TrendingUp, weekly_breakfast: Sunrise,
}

function GoalRow({ goal }) {
  const Icon = GOAL_ICONS[goal.id] || Target
  const pct  = Math.round(goal.progress * 100)
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${goal.complete ? 'bg-success/15 text-success' : 'bg-surface-elevated text-text-secondary'}`}>
        {goal.complete ? <Check size={17} strokeWidth={2.5} /> : <Icon size={17} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-base text-text-primary truncate">{goal.label}</p>
        {goal.complete ? (
          <p className="text-sm text-text-secondary">{goal.desc.replace(/\s*✓$/, '')}</p>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
              <div className={`h-full rounded-full ${goal.failed ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm text-text-secondary tabular-nums shrink-0">{goal.desc}</span>
          </div>
        )}
      </div>
      <span className={`text-sm tabular-nums shrink-0 ${goal.complete ? 'text-success font-semibold' : 'text-text-muted'}`}>+{goal.xp} XP</span>
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
  const xpPct = level ? Math.round((level.currentXP / level.nextLevelXP) * 100) : 0

  const earned = badges.filter(b => b.unlocked)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4) || (b.unlockedAt || 0) - (a.unlockedAt || 0))
  // Hidden badges stay a surprise until they are at least half done
  const nextBadge = badges
    .filter(b => !b.unlocked && !(b.hidden && b.progress < 0.5))
    .sort((a, b) => b.progress - a.progress)[0]

  return (
    <div className="min-h-screen bg-surface-base pb-nav animate-fade-in">

      <div className="page-header">
        <h1 className="t-title flex-1">Profile</h1>
        <button onClick={() => navigate('/settings')} aria-label="Settings" className="icon-btn">
          <Settings size={18} />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-6 space-y-6">

        {/* ── 1. Who — the hero ── */}
        <section>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 bg-brand text-onbrand">
              {playerName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="t-title truncate">{playerName}</h2>
              <p className="text-sm text-text-secondary">Level {level?.level ?? 1}</p>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated shrink-0">
                <Flame size={15} className="text-warning" />
                <span className="text-sm font-semibold text-text-primary">{streak} day{streak === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="progress-track">
              <div className="progress-fill bg-brand" style={{ width: `${xpPct}%` }} />
            </div>
            <p className="text-sm text-text-secondary mt-2">
              {level?.currentXP ?? 0} of {level?.nextLevelXP ?? 0} XP to Level {(level?.level ?? 1) + 1}
            </p>
          </div>
        </section>

        {/* ── 2. Next badge ── */}
        {nextBadge && (
          <button onClick={() => setModalBadge(nextBadge)} className="w-full card text-left flex items-center gap-3 active:opacity-70 transition-opacity">
            <span className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-surface-elevated">
              {nextBadge.emoji}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-brand-light">Next badge · {Math.round(nextBadge.progress * 100)}%</span>
              <span className="block text-base font-semibold text-text-primary">{nextBadge.name}</span>
              <span className="block text-sm text-text-secondary">{nextBadge.criterion}</span>
              <span className="block progress-track mt-2">
                <span className="block progress-fill bg-brand" style={{ width: `${nextBadge.progress * 100}%` }} />
              </span>
            </span>
          </button>
        )}

        {/* ── 3. Goals — plain lists ── */}
        {goals && (
          <>
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="t-heading">Today's goals</h2>
                <span className="text-sm text-text-muted">{goals.daily.filter(g => g.complete).length} of {goals.daily.length}</span>
              </div>
              <div className="group-list">
                {goals.daily.map(g => <GoalRow key={g.id} goal={g} />)}
              </div>
            </section>
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="t-heading">This week's goals</h2>
                <span className="text-sm text-text-muted">{goals.weekly.filter(g => g.complete).length} of {goals.weekly.length}</span>
              </div>
              <div className="group-list">
                {goals.weekly.map(g => <GoalRow key={g.id} goal={g} />)}
              </div>
            </section>
          </>
        )}

        {/* ── 4. Badges ── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="t-heading">Badges</h2>
            <button onClick={() => navigate('/profile/badges')}
              className="flex items-center gap-0.5 text-sm font-semibold text-brand-light py-1">
              See all {earned.length} of {badges.length} <ChevronRight size={15} />
            </button>
          </div>
          {earned.length === 0 ? (
            <p className="text-sm text-text-secondary">No badges yet. Your first one comes with your first good day.</p>
          ) : (
            <div className="grid grid-cols-5 gap-x-2 gap-y-4">
              {earned.slice(0, EARNED_PREVIEW).map(b => <BadgeTile key={b.id} badge={b} onTap={setModalBadge} />)}
            </div>
          )}
        </section>
      </div>

      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </div>
  )
}
