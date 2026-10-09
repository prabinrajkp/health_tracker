import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  User, Star, Zap, Award, Shield, Target, TrendingUp, Clock, Footprints,
  Moon, Dumbbell, ChevronRight, Settings, Lock, CheckCircle2, Calendar,
  Sun, Flame, BarChart2, Sparkles, HeartPulse, Scale,
} from 'lucide-react'
import { computePrestige, getAuraStyle, computeActiveTitle } from '../services/prestigeEngine'
import { computeQuests } from '../services/questEngine'
import { getBadgeStates, TIER_META, CATEGORY_META, getEarnEvolutionTier } from '../services/badgeEngine'
import { computeMonthlyInsights } from '../services/monthlyInsights'
import BadgeModal from '../components/BadgeModal'
import db from '../services/db'
import { getConfig } from '../api/client'
import useStore from '../store/useStore'

// ── Super Badge definitions ───────────────────────────────────────────────────
const SUPER_BADGES = [
  {
    id: 'total_balance_core',
    name: 'Total Balance Core',
    emoji: '⚖️',
    required: ['step_beast', 'sleep_guardian', 'clean_fuel'],
    requireLabels: ['Step Beast', 'Sleep Guardian', 'Clean Fuel'],
    description: 'Master all three pillars: fitness, sleep, and clean nutrition in one journey.',
    prestige: 50,
    grad: 'linear-gradient(135deg,#1e3a5f,#1a4a3a,#3d1f00)',
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '🔱',
    required: ['week_warrior', 'cardio_ignition', 'night_discipline'],
    requireLabels: ['Week Warrior', 'Cardio Ignition', 'Night Discipline'],
    description: '7-day streak, cardio dominance, and disciplined sleep — the trinity of iron.',
    prestige: 50,
    grad: 'linear-gradient(135deg,#3d1a1a,#1a1a3d,#1a3d2a)',
  },
  {
    id: 'phoenix_rising',
    name: 'Phoenix Rising',
    emoji: '🦅',
    required: ['bounce_back', 'phoenix_week', 'titan_protocol'],
    requireLabels: ['Bounce Back', 'Phoenix Week', 'Titan Protocol'],
    description: 'Fall, recover, and hit the summit. The rarest comeback achievable.',
    prestige: 60,
    grad: 'linear-gradient(135deg,#3d1a00,#1a0d3d,#3d2800)',
  },
]

// ── Quest progress bar ────────────────────────────────────────────────────────
function QuestBar({ quest }) {
  const pct = Math.round(quest.progress * 100)
  const barColor = quest.failed ? '#ef4444' : quest.complete ? '#22c55e' : '#a78bfa'
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg shrink-0 w-7 text-center">{quest.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-semibold text-text-primary truncate">{quest.label}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {quest.complete && <CheckCircle2 size={11} className="text-success" />}
            <span className="text-[10px] font-bold" style={{ color: barColor }}>+{quest.xp} XP</span>
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <p className="text-[10px] text-text-muted mt-0.5">{quest.desc}</p>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-surface-elevated rounded-2xl p-3 flex flex-col gap-1.5"
      style={{ boxShadow: `0 2px 12px ${color}20` }}>
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color }} />
        <p className="text-[10px] text-text-muted font-medium">{label}</p>
      </div>
      <p className="text-xl font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted leading-tight">{sub}</p>}
    </div>
  )
}

// ── Timeline milestone ────────────────────────────────────────────────────────
function TimelineItem({ emoji, title, date, desc, last }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-2xl bg-surface-elevated flex items-center justify-center text-base shrink-0"
          style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
          {emoji}
        </div>
        {!last && <div className="w-0.5 flex-1 mt-1 mb-0 bg-surface-elevated" style={{ minHeight: 16 }} />}
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <p className="text-xs font-bold text-text-primary">{title}</p>
        <p className="text-[10px] text-text-muted mt-0.5">{date}</p>
        {desc && <p className="text-[10px] text-text-muted mt-0.5">{desc}</p>}
      </div>
    </div>
  )
}

// ── Main Profile ──────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()
  const { theme } = useStore()

  const [pData,      setPData]      = useState(null)
  const [badges,     setBadges]     = useState([])
  const [quests,     setQuests]     = useState(null)
  const [lifetime,   setLifetime]   = useState(null)
  const [timeline,   setTimeline]   = useState([])
  const [monthSnap,  setMonthSnap]  = useState(null)
  const [playerName, setPlayerName] = useState('Player')
  const [modalBadge, setModalBadge] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function loadAll() {
      const now = new Date()
      const year = now.getFullYear(), month = now.getMonth() + 1
      const mStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const mEnd   = format(endOfMonth(now),   'yyyy-MM-dd')
      const prevYear  = month === 1 ? year - 1 : year
      const prevMonth = month === 1 ? 12 : month - 1
      const pmStart = format(new Date(prevYear, prevMonth - 1, 1), 'yyyy-MM-dd')
      const pmEnd   = format(new Date(prevYear, prevMonth,     0), 'yyyy-MM-dd')

      const [prestige, allBadges, quests_, config, allScores, allWorkout, allSleep,
        mScores, mDiet, mWorkout, mSleep, pmScores,
      ] = await Promise.all([
        computePrestige(),
        getBadgeStates(),
        computeQuests(),
        getConfig(),
        db.daily_scores.orderBy('date').toArray(),
        db.workout_logs.toArray(),
        db.sleep_logs.toArray(),
        db.daily_scores.where('date').between(mStart, mEnd, true, true).toArray(),
        db.diet_logs.where('date').between(mStart, mEnd, true, true).toArray(),
        db.workout_logs.where('date').between(mStart, mEnd, true, true).toArray(),
        db.sleep_logs.where('date').between(mStart, mEnd, true, true).toArray(),
        db.daily_scores.where('date').between(pmStart, pmEnd, true, true).toArray(),
      ])

      setPData(prestige)
      setBadges(allBadges)
      setQuests(quests_)

      const cfgMap = {}
      config.forEach(c => { cfgMap[c.key] = c.value })
      setPlayerName(cfgMap.player_name || 'Player')

      // Lifetime stats
      const totalSteps    = allWorkout.reduce((s, w) => s + (w.steps || 0), 0)
      const totalWorkouts = allWorkout.filter(w => w.exercise_done).length
      const totalSleepH   = allSleep.reduce((s, sl) => s + (sl.sleep_hours || 0), 0)
      const eliteDays     = allScores.filter(s => s.total_score >= 90).length
      const goodDays      = allScores.filter(s => s.total_score >= 70).length
      const avgScore      = allScores.length
        ? Math.round(allScores.reduce((s, r) => s + r.total_score, 0) / allScores.length)
        : 0

      setLifetime({
        totalDays: allScores.length, totalSteps, totalWorkouts,
        totalSleepH: Math.round(totalSleepH), eliteDays, goodDays, avgScore,
        consistencyPct: allScores.length >= 7
          ? Math.round((goodDays / allScores.length) * 100)
          : null,
      })

      // Journey timeline
      const milestones = []
      if (allScores.length > 0) {
        const first = allScores[0]
        milestones.push({ emoji: '🚀', title: 'First Log', date: format(new Date(first.date + 'T00:00:00'), 'MMM d, yyyy'), desc: `Score: ${Math.round(first.total_score)}` })
      }
      const badgeRecords = await db.badges.where('unlock_timestamp').above(0).toArray()
      if (badgeRecords.length > 0) {
        const first = badgeRecords.reduce((a, b) => a.unlock_timestamp < b.unlock_timestamp ? a : b)
        const bDef  = allBadges.find(b => b.id === first.badge_id)
        if (bDef) milestones.push({ emoji: bDef.emoji, title: `First Badge: ${bDef.name}`, date: format(new Date(first.unlock_timestamp), 'MMM d, yyyy'), desc: bDef.lore })
      }
      if (prestige?.maxStreak >= 7) {
        milestones.push({ emoji: '⚔️', title: `${prestige.maxStreak}-Day Streak`, date: 'Best ever', desc: `${prestige.maxStreak} consecutive days logged` })
      }
      const best90 = allScores.find(s => s.total_score >= 90)
      if (best90) milestones.push({ emoji: '👑', title: 'First 90+ Score', date: format(new Date(best90.date + 'T00:00:00'), 'MMM d, yyyy'), desc: `Score: ${Math.round(best90.total_score)}` })
      const legendaryBadge = allBadges.filter(b => b.unlocked && b.tier === 'legendary')[0]
      if (legendaryBadge) milestones.push({ emoji: legendaryBadge.emoji, title: `Legendary: ${legendaryBadge.name}`, date: legendaryBadge.unlockedAt ? format(new Date(legendaryBadge.unlockedAt), 'MMM d, yyyy') : 'Unlocked', desc: legendaryBadge.lore })

      setTimeline(milestones.slice(0, 5))

      // Monthly snapshot
      const snap = computeMonthlyInsights({ scores: mScores, prevScores: pmScores, dietLogs: mDiet, workoutLogs: mWorkout, sleepLogs: mSleep, year, month })
      setMonthSnap(snap)
    }

    loadAll().catch(console.error).finally(() => setLoading(false))
  }, [])

  const aura = getAuraStyle(pData?.level || 1)
  const title = computeActiveTitle(pData, badges)
  const xpPct = pData ? Math.round((pData.currentXP / pData.nextLevelXP) * 100) : 0

  const unlockedBadges = badges.filter(b => b.unlocked)
  const featuredBadges = [...unlockedBadges]
    .sort((a, b) => {
      const order = { legendary: 0, epic: 1, rare: 2, common: 3 }
      return (order[a.tier] ?? 4) - (order[b.tier] ?? 4)
    })
    .slice(0, 5)

  const categoryKeys = Object.keys(CATEGORY_META)
  const badgesByCategory = {}
  categoryKeys.forEach(cat => {
    badgesByCategory[cat] = badges.filter(b => b.category === cat)
  })

  const unlockedIds = new Set(unlockedBadges.map(b => b.id))
  const superBadgesWithState = SUPER_BADGES.map(sb => ({
    ...sb,
    unlocked: sb.required.every(id => unlockedIds.has(id)),
    progress: sb.required.filter(id => unlockedIds.has(id)).length / sb.required.length,
    completedCount: sb.required.filter(id => unlockedIds.has(id)).length,
  }))

  const SETTINGS_MENU = [
    { key: 'profile',    label: 'Player Profile',      icon: User,          color: '#a78bfa', desc: playerName || 'Set your name' },
    { key: 'weight',     label: 'Weight Log',           icon: Scale,         color: '#ec4899', desc: 'Track your weight journey', to: '/weight' },
    { key: 'body',       label: 'Body & Goal',          icon: HeartPulse,    color: '#ec4899', desc: 'Calorie & macro targets' },
    { key: 'appearance', label: 'Appearance',           icon: Sun,           color: '#f59e0b', desc: `${theme === 'dark' ? 'Dark' : 'Light'} theme` },
    { key: 'weights',    label: 'Scoring Weights',      icon: BarChart2,     color: '#FBBC04', desc: 'Category max points' },
    { key: 'foods',      label: 'Custom Foods',         icon: Sparkles,      color: '#f97316', desc: 'Add your own meal options' },
    { key: 'reminders',  label: 'Reminders',            icon: Clock,         color: '#38bdf8', desc: 'Smart notification schedule' },
    { key: 'export',     label: 'Data Export & Import', icon: Award,         color: '#22c55e', desc: 'Excel · JSON backup' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-4xl animate-pulse">✦</div>
        <p className="text-sm text-text-muted">Loading your profile…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">

      {/* ── 1. Hero Section ── */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg,rgb(var(--c-surface-card)),rgb(var(--c-surface-elevated)) 60%,rgb(var(--c-surface-card)))' }}>
        <div className="max-w-lg mx-auto px-4 pt-10 pb-8">

          {/* Avatar + aura */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative mb-4">
              {/* Outer aura ring */}
              <div className="absolute inset-0 rounded-full"
                style={{ boxShadow: aura.shadow, animation: 'auraBreath 3s ease-in-out infinite', borderRadius: '50%' }} />
              {/* Avatar circle */}
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black border-2"
                style={{
                  background: `linear-gradient(135deg,${aura.color}30,${aura.color}10)`,
                  borderColor: `${aura.color}60`,
                  boxShadow: `0 0 0 4px ${aura.color}20`,
                  color: aura.color,
                }}>
                {playerName ? playerName[0].toUpperCase() : '?'}
              </div>
              {/* Level badge */}
              <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-xl text-xs font-black border"
                style={{
                  background: `${aura.color}25`,
                  borderColor: `${aura.color}50`,
                  color: aura.color,
                  backdropFilter: 'blur(8px)',
                }}>
                Lv {pData?.level ?? 1}
              </div>
            </div>

            <h1 className="text-2xl font-black text-text-primary tracking-tight">{playerName}</h1>

            {/* Active title */}
            <div className="mt-1.5 mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated border"
              style={{ borderColor: `${aura.color}40` }}>
              <Star size={11} style={{ color: aura.color }} />
              <span className="text-xs font-bold" style={{ color: aura.color }}>{title}</span>
            </div>

            {/* XP bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-text-muted mb-1.5">
                <span>{pData?.currentXP ?? 0} XP</span>
                <span>Level {(pData?.level ?? 1) + 1} at {pData ? pData.currentXP + pData.nextLevelXP - pData.currentXP : 0} XP</span>
              </div>
              <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${xpPct}%`, background: `linear-gradient(90deg,${aura.color}90,${aura.color})` }} />
              </div>
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>Lv {pData?.level ?? 1}</span>
                <span>Lv {(pData?.level ?? 1) + 1}</span>
              </div>
            </div>
          </div>

          {/* Prestige + stats row */}
          <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
            {[
              { label: 'Prestige',  value: pData?.prestige ?? 0,          color: '#f59e0b' },
              { label: 'Badges',    value: pData?.unlockedBadgeCount ?? 0, color: '#a78bfa' },
              { label: 'Streak',    value: pData?.maxStreak ?? 0,          color: '#22c55e' },
              { label: 'Days',      value: pData?.totalDays ?? 0,          color: '#38bdf8' },
            ].map(m => (
              <div key={m.label} className="bg-black/20 rounded-2xl p-2.5 text-center">
                <p className="text-lg font-black tabular-nums" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[9px] text-white/50 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-5 pt-5">

        {/* ── 3. Super Badge Vault ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} style={{ color: '#f59e0b' }} />
            <h2 className="text-sm font-bold text-text-primary">Super Badge Vault</h2>
            <span className="text-[10px] text-text-muted ml-auto">Rare combos</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {superBadgesWithState.map(sb => (
              <div key={sb.id} className="shrink-0 w-52 rounded-2xl overflow-hidden relative"
                style={{ background: sb.unlocked ? sb.grad : 'rgb(var(--c-surface-elevated))', border: `1.5px solid ${sb.unlocked ? '#f59e0b50' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="p-3.5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-3xl"
                      style={{ filter: sb.unlocked ? 'none' : 'grayscale(1) brightness(0.3)' }}>
                      {sb.unlocked ? sb.emoji : '🔒'}
                    </div>
                    {sb.unlocked ? (
                      <div className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#f59e0b25', color: '#f59e0b' }}>UNLOCKED</div>
                    ) : (
                      <div className="text-[9px] font-semibold text-text-muted">{sb.completedCount}/{sb.required.length}</div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white mb-1"
                    style={{ color: sb.unlocked ? '#fff' : 'rgb(var(--c-text-muted))' }}>
                    {sb.name}
                  </p>
                  <p className="text-[10px] leading-snug mb-2.5"
                    style={{ color: sb.unlocked ? 'rgba(255,255,255,0.7)' : 'rgb(var(--c-text-muted))' }}>
                    {sb.description}
                  </p>
                  {/* Required badges */}
                  <div className="flex gap-1 flex-wrap">
                    {sb.required.map((reqId, i) => {
                      const has = unlockedIds.has(reqId)
                      return (
                        <span key={reqId} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: has ? '#22c55e20' : 'rgba(255,255,255,0.06)',
                            color: has ? '#22c55e' : 'rgb(var(--c-text-muted))',
                            border: `1px solid ${has ? '#22c55e40' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {has ? '✓ ' : ''}{sb.requireLabels[i]}
                        </span>
                      )
                    })}
                  </div>
                  {/* Progress bar for locked */}
                  {!sb.unlocked && (
                    <div className="mt-2.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${sb.progress * 100}%`, background: '#f59e0b' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. Featured Badges ── */}
        {featuredBadges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award size={14} className="text-brand-light" />
              <h2 className="text-sm font-bold text-text-primary">Your Best</h2>
              <span className="text-[10px] text-text-muted ml-auto">Top unlocked</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {featuredBadges.map(b => {
                const t = TIER_META[b.tier] || TIER_META.common
                const evo = b.earnCount > 1 ? getEarnEvolutionTier(b.earnCount) : null
                return (
                  <button key={b.id} onClick={() => setModalBadge(b)}
                    className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: t.bg,
                        border: `2px solid ${evo?.color || t.color}60`,
                        boxShadow: `0 4px 20px ${evo?.color || t.color}40`,
                        animation: t.anim,
                      }}>
                      <span className="text-2xl">{b.emoji}</span>
                      {b.earnCount > 1 && (
                        <div className="absolute -top-2.5 -left-1.5 px-2 py-0.5 rounded-full text-[9px] font-black leading-none border"
                          style={{ background: evo?.color || t.color, color: '#000', borderColor: `${evo?.color || t.color}80` }}>
                          ×{b.earnCount}
                        </div>
                      )}
                      <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-surface-base flex items-center justify-center text-[8px] font-black"
                        style={{ background: evo?.color || t.color, color: '#000' }}>
                        {evo?.symbol || (b.tier === 'legendary' ? '✦' : b.tier === 'epic' ? '◆' : b.tier === 'rare' ? '●' : '·')}
                      </div>
                    </div>
                    <p className="text-[9px] font-semibold text-center max-w-[68px] leading-tight truncate" style={{ color: evo?.color || t.color }}>{b.name}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 5. Badge Inventory Shelves ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-brand-light" />
            <h2 className="text-sm font-bold text-text-primary">Badge Inventory</h2>
            <span className="text-[10px] text-text-muted ml-auto">{unlockedBadges.length}/{badges.length} unlocked</span>
          </div>
          <div className="space-y-4">
            {categoryKeys.map(cat => {
              const catBadges = badgesByCategory[cat]
              if (!catBadges?.length) return null
              const meta = CATEGORY_META[cat]
              const catUnlocked = catBadges.filter(b => b.unlocked).length
              return (
                <div key={cat} className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">{meta.emoji}</span>
                    <p className="text-xs font-bold text-text-primary">{meta.label}</p>
                    <span className="text-[10px] text-text-muted ml-auto">{catUnlocked}/{catBadges.length}</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {catBadges.map(b => {
                      const t = TIER_META[b.tier] || TIER_META.common
                      const dim = 56
                      const isHidden = b.hidden && !b.unlocked && b.progress < 0.5
                      const evo = b.unlocked && b.earnCount > 0 ? getEarnEvolutionTier(b.earnCount) : null

                      if (isHidden) return (
                        <div key={b.id} className="shrink-0 flex flex-col items-center gap-1" style={{ width: dim + 8 }}>
                          <div className="relative" style={{ width: dim, height: dim }}>
                            <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                              style={{ border: '1.5px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                              <span style={{ fontSize: 20, opacity: 0.15 }}>?</span>
                            </div>
                          </div>
                          <p className="font-semibold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>???</p>
                        </div>
                      )

                      return (
                        <button key={b.id} onClick={() => setModalBadge(b)}
                          className="shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                          style={{ width: dim + 8 }}>
                          <div className="relative" style={{ width: dim, height: dim }}>
                            {b.unlocked && (
                              <div className="absolute inset-0 rounded-2xl" style={{ background: t.glow, animation: t.anim }} />
                            )}
                            <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                              style={{
                                border: `1.5px solid ${b.unlocked ? (evo?.color || t.color) : 'rgba(255,255,255,0.09)'}`,
                                background: b.unlocked ? t.bg : 'rgba(255,255,255,0.04)',
                              }}>
                              <span style={{ fontSize: 22, filter: b.unlocked ? 'none' : 'grayscale(1) brightness(0.3)' }}>{b.emoji}</span>
                            </div>
                            {!b.unlocked && b.progress > 0.05 && (() => {
                              const r = (dim - 5) / 2
                              const circ = 2 * Math.PI * r
                              return (
                                <svg width={dim} height={dim} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
                                  <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={t.color} strokeWidth={3}
                                    strokeDasharray={`${circ * b.progress} ${circ}`} strokeLinecap="round" />
                                </svg>
                              )
                            })()}
                            {/* Corner indicator */}
                            {b.unlocked && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-card flex items-center justify-center text-[7px] font-black"
                                style={{ background: evo?.color || t.color, color: '#000' }}>
                                {evo?.symbol || '✓'}
                              </div>
                            )}
                          </div>
                          <p className="text-center leading-tight max-w-full px-0.5 truncate font-semibold"
                            style={{ fontSize: 9, color: b.unlocked ? (evo?.color || t.color) : 'rgb(var(--c-text-muted))' }}>
                            {b.name}
                          </p>
                          {b.unlocked && b.earnCount > 1 && (
                            <div className="flex items-center justify-center mt-0.5">
                              <span className="px-1.5 py-0.5 rounded-full font-black leading-none"
                                style={{ fontSize: 9, background: `${evo?.color || t.color}28`, color: evo?.color || t.color, border: `1px solid ${evo?.color || t.color}55` }}>
                                ×{b.earnCount}
                              </span>
                            </div>
                          )}
                          {b.unlocked && evo && (
                            <p className="text-center font-bold" style={{ fontSize: 7, color: evo.color, marginTop: b.earnCount > 1 ? 1 : 2 }}>{evo.label}</p>
                          )}
                          {!b.unlocked && b.progress > 0.05 && (
                            <p style={{ fontSize: 8 }} className="text-text-muted -mt-0.5">{Math.round(b.progress * 100)}%</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Super Badge Quest — nearest super badge progress ── */}
        {(() => {
          const nearest = superBadgesWithState.filter(sb => !sb.unlocked).sort((a, b) => b.progress - a.progress)[0]
          if (!nearest) return null
          return (
            <div className="rounded-2xl p-4 relative overflow-hidden"
              style={{ border: '1.5px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: '#f59e0b08', filter: 'blur(24px)', transform: 'translate(30%,-30%)' }} />
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">🔱</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-warning">Super Quest</p>
                <span className="ml-auto text-[10px] font-bold text-warning/70">{nearest.completedCount}/{nearest.required.length} components</span>
              </div>
              <p className="text-sm font-bold text-text-primary mb-1">{nearest.name}</p>
              <p className="text-[10px] text-text-muted mb-3 leading-snug">{nearest.description}</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {nearest.required.map((reqId, i) => {
                  const has = unlockedIds.has(reqId)
                  return (
                    <span key={reqId} className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        background: has ? '#22c55e15' : 'rgba(255,255,255,0.05)',
                        color: has ? '#22c55e' : 'rgb(var(--c-text-muted))',
                        border: `1px solid ${has ? '#22c55e30' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {has ? '✓ ' : '○ '}{nearest.requireLabels[i]}
                    </span>
                  )
                })}
              </div>
              <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${nearest.progress * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />
              </div>
              <p className="text-[10px] font-bold mt-1.5" style={{ color: '#f59e0b' }}>+{nearest.prestige} Prestige on unlock</p>
            </div>
          )
        })()}

        {/* ── 6. Active Quests ── */}
        {quests && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} style={{ color: '#22c55e' }} />
              <h2 className="text-sm font-bold text-text-primary">Active Quests</h2>
            </div>
            <div className="card mb-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Sun size={12} style={{ color: '#f59e0b' }} />
                <p className="text-xs font-bold text-text-primary">Daily Quests</p>
                <span className="text-[10px] text-text-muted ml-auto">
                  {quests.daily.filter(q => q.complete).length}/{quests.daily.length} done
                </span>
              </div>
              <div className="divide-y divide-surface-border">
                {quests.daily.map(q => <QuestBar key={q.id} quest={q} />)}
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar size={12} style={{ color: '#38bdf8' }} />
                <p className="text-xs font-bold text-text-primary">Weekly Quests</p>
                <span className="text-[10px] text-text-muted ml-auto">
                  {quests.weekly.filter(q => q.complete).length}/{quests.weekly.length} done
                </span>
              </div>
              <div className="divide-y divide-surface-border">
                {quests.weekly.map(q => <QuestBar key={q.id} quest={q} />)}
              </div>
            </div>
          </div>
        )}

        {/* ── 7. Lifetime Stats ── */}
        {lifetime && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} style={{ color: '#f97316' }} />
              <h2 className="text-sm font-bold text-text-primary">Lifetime Stats</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard icon={Calendar}  label="Days Logged"    value={lifetime.totalDays}                           color="#38bdf8"  sub="Total logged days" />
              <StatCard icon={TrendingUp} label="Avg Score"     value={lifetime.avgScore}                            color="#FBBC04"  sub="All-time average" />
              <StatCard icon={Footprints} label="Total Steps"   value={lifetime.totalSteps >= 1e6 ? `${(lifetime.totalSteps/1e6).toFixed(1)}M` : lifetime.totalSteps >= 1000 ? `${(lifetime.totalSteps/1000).toFixed(0)}k` : String(lifetime.totalSteps)} color="#22c55e"  sub="Steps logged ever" />
              <StatCard icon={Dumbbell}  label="Workouts"       value={lifetime.totalWorkouts}                       color="#a78bfa"  sub="Exercise sessions" />
              <StatCard icon={Moon}      label="Sleep Hours"    value={`${lifetime.totalSleepH}h`}                   color="#818cf8"  sub="Total rest logged" />
              <StatCard icon={Star}      label="Elite Days"     value={lifetime.eliteDays}                           color="#f59e0b"  sub="Score ≥90 days" />
              {lifetime.consistencyPct !== null && (
                <StatCard icon={Shield} label="Consistency"    value={`${lifetime.consistencyPct}%`}                color="#22c55e"  sub="Days ≥70 pts" />
              )}
              <StatCard icon={Zap}      label="Best Streak"    value={`${pData?.maxStreak ?? 0}d`}                  color="#f97316"  sub="Consecutive days" />
            </div>
          </div>
        )}

        {/* ── 8. Journey Timeline ── */}
        {timeline.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-brand-light" />
              <h2 className="text-sm font-bold text-text-primary">Journey Timeline</h2>
            </div>
            <div className="card">
              {timeline.map((m, i) => (
                <TimelineItem key={i} {...m} last={i === timeline.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── 9. Monthly Snapshot ── */}
        {monthSnap && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={14} className="text-warning" />
              <h2 className="text-sm font-bold text-text-primary">This Month</h2>
              <button onClick={() => navigate('/history?tab=month')}
                className="text-[10px] font-semibold text-text-muted ml-auto px-2 py-1 rounded-lg bg-surface-elevated">
                Full view →
              </button>
            </div>
            <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: monthSnap.identity.grad }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{monthSnap.identity.emoji}</span>
                <span className="text-xs font-bold text-white">{monthSnap.identity.label}</span>
                {monthSnap.trend !== null && (
                  <span className="ml-auto text-xs font-bold" style={{ color: monthSnap.trend >= 0 ? '#86efac' : '#fca5a5' }}>
                    {monthSnap.trend >= 0 ? '+' : ''}{monthSnap.trend} vs last
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-black text-white tabular-nums">{monthSnap.avgScore}</span>
                <span className="text-xl font-black pb-0.5" style={{ color: monthSnap.grade.color }}>{monthSnap.grade.letter}</span>
                <span className="text-xs text-white/70 pb-0.5">{monthSnap.grade.label}</span>
              </div>
              <p className="text-xs text-white/75 mb-3 leading-relaxed">{monthSnap.narrative}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { l: 'Days', v: monthSnap.daysLogged },
                  { l: 'Sleep', v: `${monthSnap.stats.avgSleep}h` },
                  { l: 'Work', v: monthSnap.stats.workoutSessions },
                  { l: 'Junk', v: monthSnap.stats.junkFoodDays },
                ].map(m => (
                  <div key={m.l} className="bg-black/20 rounded-xl p-1.5 text-center">
                    <p className="text-sm font-bold text-white tabular-nums">{m.v}</p>
                    <p className="text-[9px] text-white/50">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 10. Settings Center ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings size={14} className="text-text-muted" />
            <h2 className="text-sm font-bold text-text-primary">Settings</h2>
          </div>
          <div className="card space-y-0 divide-y divide-surface-border">
            {SETTINGS_MENU.map(({ key, label, icon: Icon, color, desc, to }) => (
              <button key={key} onClick={() => navigate(to || `/settings?section=${key}`)}
                className="list-row w-full text-left py-3.5 hover:bg-surface-elevated/50 transition-colors active:opacity-70">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}18` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted truncate mt-0.5">{desc}</p>
                </div>
                <ChevronRight size={15} className="text-text-muted shrink-0" />
              </button>
            ))}
            <button onClick={() => navigate('/settings')}
              className="list-row w-full text-left py-3.5 hover:bg-surface-elevated/50 transition-colors active:opacity-70">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#94a3b818' }}>
                <Settings size={16} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">All Settings</p>
                <p className="text-xs text-text-muted mt-0.5">Scoring rules, advanced, data</p>
              </div>
              <ChevronRight size={15} className="text-text-muted shrink-0" />
            </button>
          </div>
        </div>

      </div>

      {/* Badge modal */}
      {modalBadge && <BadgeModal badge={modalBadge} onClose={() => setModalBadge(null)} />}
    </div>
  )
}
