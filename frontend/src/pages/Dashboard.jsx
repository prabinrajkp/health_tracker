import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { Flame, Zap, ChevronDown, ChevronUp, Sparkles, Bell, BarChart2, Scale, UtensilsCrossed } from 'lucide-react'
import useStore from '../store/useStore'
import ScoreRing from '../components/ScoreRing'
import StatBar from '../components/StatBar'
import { DayDetailPanel } from '../components/DayDetail'
import { getDiet, getWorkout, getSleep, getConfig, getWeightEntries } from '../api/client'
import { getThisWeekBadgeStates } from '../services/badgeEngine'
import { BadgeShelfMini } from '../components/BadgeShelf'
import AddMealFlow from '../components/AddMealFlow'

const RPG_TIERS = [
  { min: 91, emoji: '👑', title: 'Legend',      sub: 'Ascended',         color: '#a78bfa' },
  { min: 81, emoji: '🌟', title: 'Champion',    sub: 'Elite Warrior',    color: '#f59e0b' },
  { min: 71, emoji: '🦸', title: 'Hero',        sub: 'Seasoned Fighter', color: '#22c55e' },
  { min: 61, emoji: '⚔️', title: 'Warrior',    sub: 'Battle-Ready',     color: '#38bdf8' },
  { min: 41, emoji: '🛡️', title: 'Apprentice', sub: 'Training Hard',    color: '#f97316' },
  { min: 21, emoji: '🏃', title: 'Novice',      sub: 'Just Starting',    color: '#ef4444' },
  { min: 0,  emoji: '😴', title: 'Idle',        sub: 'Resting',          color: '#6b7280' },
]
function getChar(score) { return RPG_TIERS.find(t => score >= t.min) || RPG_TIERS[RPG_TIERS.length - 1] }

const GRADE = (s) => {
  if (s >= 90) return { letter: 'S', label: 'Outstanding',  color: '#a78bfa' }
  if (s >= 80) return { letter: 'A', label: 'Excellent',    color: '#22c55e' }
  if (s >= 70) return { letter: 'B', label: 'Great',        color: '#38bdf8' }
  if (s >= 60) return { letter: 'C', label: 'Good',         color: '#f59e0b' }
  if (s >= 40) return { letter: 'D', label: 'Keep pushing', color: '#f97316' }
  return              { letter: 'F', label: 'Needs work',   color: '#ef4444' }
}

const QUEST_CARDS = [
  { key: 'diet',    label: 'Diet',    description: 'Log meals',    to: '/activity?tab=diet',    emoji: '🥗', gradient: 'linear-gradient(135deg,#16a34a,#15803d)', shadow: 'rgba(22,163,74,0.45)' },
  { key: 'workout', label: 'Workout', description: 'Steps & more', to: '/activity?tab=workout', emoji: '⚡', gradient: 'linear-gradient(135deg,#0284c7,#0369a1)', shadow: 'rgba(2,132,199,0.45)' },
  { key: 'sleep',   label: 'Sleep',   description: 'Track sleep',  to: '/activity?tab=sleep',   emoji: '🌙', gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)', shadow: 'rgba(124,58,237,0.45)' },
]

function getTimeState() {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return 'morning'
  if (h >= 10 && h < 14) return 'midday'
  if (h >= 14 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}

function getTimeContext(timeState, playerName) {
  const name = playerName ? `, ${playerName}` : ''
  const ctx = {
    morning:   { greeting: `Rise & grind${name}!`,  emoji: '☀️' },
    midday:    { greeting: `Halfway there${name}!`,  emoji: '⚡' },
    afternoon: { greeting: `Stay locked in${name}!`, emoji: '🔥' },
    evening:   { greeting: `Final push${name}!`,     emoji: '🌆' },
    night:     { greeting: `Night mode${name}`,      emoji: '🌙' },
  }
  return ctx[timeState] || ctx.morning
}

function HeroStatBar({ label, value, max, color, icon }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">{icon} {label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{Math.round(value)}<span className="text-text-muted font-normal">/{max}</span></span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: pct > 75 ? `0 0 6px ${color}80` : 'none' }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { todayScore, streak, refreshAll, config } = useStore()
  const [logs, setLogs] = useState({ diet: null, workout: null, sleep: null, yesterdayDiet: null })
  const [penaltyWeights, setPenaltyWeights] = useState({})
  const [weights, setWeights] = useState({})
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const [heroExpanded, setHeroExpanded] = useState(false)
  const [scoreView, setScoreView] = useState('bars')
  const [ctaIndex, setCtaIndex] = useState(0)
  const [ctaVisible, setCtaVisible] = useState(true)
  const ctaTimerRef = useRef(null)
  const ctaTouchStartX = useRef(null)
  const [badgeData, setBadgeData] = useState(null)
  const [weightTrend, setWeightTrend] = useState(null)
  const [addMealOpen, setAddMealOpen] = useState(false)

  const playerName = config?.player_name || ''
  const timeState = getTimeState()
  const timeCtx = getTimeContext(timeState, playerName)

  useEffect(() => {
    refreshAll()
    getThisWeekBadgeStates().then(setBadgeData).catch(() => {})
    getWeightEntries().then(all => {
      if (!all.length) return setWeightTrend({ empty: true })
      const latest = all[all.length - 1]
      const monthAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      const baseline = all.find(e => e.date >= monthAgo) || all[0]
      setWeightTrend({
        latest: latest.weight_kg,
        change: Math.round((latest.weight_kg - baseline.weight_kg) * 10) / 10,
        loggedToday: latest.date === today,
      })
    }).catch(() => {})
    Promise.all([
      getDiet(today),
      getWorkout(today),
      getSleep(today),
      getConfig(),
      getDiet(yesterday),
    ]).then(([diet, workout, sleep, cfg, yesterdayDiet]) => {
      setLogs({ diet, workout, sleep, yesterdayDiet })
      const row = cfg?.find?.(c => c.key === 'score_weights')
      if (row) try {
        const w = JSON.parse(row.value)
        setWeights(w)
        setPenaltyWeights(w.penalties || {})
      } catch {}
    })
  }, [])

  const handleMealLogged = async () => {
    await refreshAll()
    const [diet, yesterdayDiet] = await Promise.all([getDiet(today), getDiet(yesterday)])
    setLogs(l => ({ ...l, diet, yesterdayDiet }))
  }

  const score = todayScore?.total_score ?? 0
  const grade = GRADE(score)
  const ch = getChar(score)
  const pct = Math.min(score, 100)
  const isHighScore = score >= 80
  const isLegendary = score >= 92

  // Perfect-day criteria: breakfast + lunch + dinner logged (snacks optional)
  const hasMeal = (type) => !!(logs.diet?.meal_items?.some(i => i.mealType === type))
  const questDone = {
    diet:    hasMeal('breakfast') && hasMeal('lunch') && hasMeal('dinner'),
    workout: (todayScore?.workout_score ?? 0) > 0,
    sleep:   !!(logs.sleep?.sleep_time),
  }
  const doneCount = Object.values(questDone).filter(Boolean).length
  const isPerfectDay = doneCount === 3

  const activePenalties = []
  const dinnerTime = logs.diet?.meal_times?.dinner || logs.diet?.dinner_time
  if (dinnerTime) {
    const [h] = dinnerTime.split(':').map(Number)
    if (h >= 21) activePenalties.push({ section: 'diet', label: 'Dinner after 9 PM', amount: penaltyWeights.dinner_after_9pm ?? -5 })
  }
  if (logs.sleep?.sleep_time) {
    const [h] = logs.sleep.sleep_time.split(':').map(Number)
    if (h === 0 || h === 1) activePenalties.push({ section: 'sleep', label: 'Sleep after midnight', amount: penaltyWeights.sleep_after_midnight ?? -8 })
  }

  const computeCTAs = () => {
    const items = []
    // Damage entries first
    for (const p of activePenalties) {
      items.push({ type: 'damage', label: p.label, impact: Math.abs(p.amount), emoji: '⚠️' })
    }
    // Opportunities
    const steps = logs.workout?.steps || 0
    const stepTarget = weights.workout?.steps_full_threshold ?? 8000
    const stepBase   = weights.workout?.steps_8000 ?? 15
    if (steps < stepTarget) {
      const rem = stepTarget - steps
      const pct = Math.round((steps / stepTarget) * 100)
      items.push({ type: 'opportunity', label: `${rem.toLocaleString()} more steps → unlock full workout pts`, sublabel: `${pct}% of daily step goal`, impact: stepBase, emoji: '👟' })
    }
    if (!logs.workout?.post_dinner_walk) items.push({ type: 'opportunity', label: 'Post-dinner walk → earn a bonus', sublabel: 'Short walk = +10 pts', impact: weights.workout?.post_dinner_walk ?? 10, emoji: '🚶' })
    if (!logs.workout?.exercise_done) items.push({ type: 'opportunity', label: 'Log an exercise session → power-up', sublabel: 'Gym, yoga, run — any activity counts', impact: weights.workout?.exercise_session ?? 10, emoji: '💪' })
    if (!logs.sleep?.sleep_time) {
      const label = (timeState === 'evening' || timeState === 'night')
        ? "Log sleep before midnight for full points"
        : "Log last night's sleep to earn pts"
      items.push({ type: 'opportunity', label, sublabel: 'Sleep logging = up to 30 pts', impact: weights.sleep_max ?? 30, emoji: '🌙' })
    }
    if (!hasMeal('breakfast')) items.push({ type: 'opportunity', label: 'Log breakfast to start your diet score', sublabel: 'Morning meals = strong foundation', impact: 6, emoji: '🌅' })
    if (!hasMeal('lunch'))     items.push({ type: 'opportunity', label: 'Log lunch to keep your diet streak', sublabel: 'Balanced lunch = steady energy', impact: 6, emoji: '☀️' })
    if (!hasMeal('dinner'))    items.push({ type: 'opportunity', label: 'Log dinner before 8:30 PM for bonus', sublabel: 'Early dinner avoids late-night penalty', impact: 6, emoji: '🍽️' })
    if (items.length === 0) items.push({ type: 'opportunity', label: 'All power-ups claimed — well done!', sublabel: 'Perfect execution today', impact: 0, emoji: '🏆' })
    return items
  }
  const ctas = computeCTAs()

  // Rotate CTA every 10 seconds with a fade transition
  useEffect(() => {
    if (ctas.length <= 1) return
    ctaTimerRef.current = setInterval(() => {
      setCtaVisible(false)
      setTimeout(() => {
        setCtaIndex(i => (i + 1) % ctas.length)
        setCtaVisible(true)
      }, 300)
    }, 10000)
    return () => clearInterval(ctaTimerRef.current)
  }, [ctas.length])

  const cta = ctas[Math.min(ctaIndex, ctas.length - 1)]

  const jumpCta = (i) => {
    clearInterval(ctaTimerRef.current)
    setCtaVisible(false)
    setTimeout(() => { setCtaIndex(i); setCtaVisible(true) }, 200)
  }
  const handleCtaSwipeStart = (e) => { ctaTouchStartX.current = e.touches[0].clientX }
  const handleCtaSwipeEnd = (e) => {
    if (ctaTouchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - ctaTouchStartX.current
    ctaTouchStartX.current = null
    if (Math.abs(dx) < 40) return
    const next = dx < 0
      ? Math.min(ctaIndex + 1, ctas.length - 1)
      : Math.max(ctaIndex - 1, 0)
    if (next !== ctaIndex) jumpCta(next)
  }

  return (
    <div className="min-h-screen bg-surface-base pb-32 animate-fade-in overflow-x-hidden">

      {/* ── Ambient orbs ─────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full"
          style={{ width: 280, height: 280, top: -60, right: -80, background: 'rgb(var(--c-brand))', filter: 'blur(80px)', opacity: 0.08, animation: 'floatOrb 8s ease-in-out infinite' }} />
        <div className="absolute rounded-full"
          style={{ width: 200, height: 200, top: '40%', left: -60, background: '#22c55e', filter: 'blur(70px)', opacity: 0.05, animation: 'floatOrb 11s ease-in-out infinite reverse' }} />
        {isHighScore && (
          <div className="absolute rounded-full"
            style={{ width: 160, height: 160, bottom: '20%', right: -40, background: '#f59e0b', filter: 'blur(60px)', opacity: 0.06, animation: 'floatOrb 9s ease-in-out infinite 2s' }} />
        )}
      </div>

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Compact header ────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
              {timeCtx.emoji} {format(new Date(), 'EEE, MMM d')}
            </p>
            <h1 className="text-lg font-bold text-text-primary leading-tight mt-0.5">{timeCtx.greeting}</h1>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl border border-surface-border bg-surface-elevated">
                <Flame size={12} className="text-orange-400" />
                <span className="text-sm font-bold text-text-primary">{streak}</span>
              </div>
            )}
            <div className="w-9 h-9 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center">
              <Bell size={15} className="text-text-muted" />
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 space-y-3">

          {/* ── PERFECT DAY banner ───────────────────────────────────────────── */}
          {isPerfectDay && (
            <div className="rounded-3xl p-3.5 flex items-center gap-3 animate-slide-up"
              style={{
                background: 'linear-gradient(135deg, rgba(251,188,4,0.15), rgba(124,58,237,0.15))',
                border: '1px solid rgba(251,188,4,0.4)',
                boxShadow: '0 4px 24px rgba(251,188,4,0.2)',
              }}>
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-sm font-black text-warning uppercase tracking-wider">Perfect Day!</p>
                <p className="text-xs text-text-muted">All 3 quests complete — you're unstoppable</p>
              </div>
              <Sparkles size={16} className="ml-auto text-warning opacity-70" />
            </div>
          )}

          {/* ── Hero RPG Card — expandable score inside ───────────────────── */}
          <div className="rounded-3xl relative overflow-hidden text-white"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-brand)) 0%, rgb(var(--c-brand-dark)) 100%)',
              boxShadow: isLegendary
                ? '0 8px 40px rgba(124,58,237,0.7), 0 0 80px rgba(124,58,237,0.25)'
                : isHighScore
                ? '0 6px 30px rgba(124,58,237,0.55)'
                : 'var(--shadow-glow)',
              animation: isHighScore ? 'heroPulse 4s ease-in-out infinite' : 'none',
            }}>
            {/* BG orbs inside card */}
            <div className="absolute rounded-full pointer-events-none"
              style={{ width: 120, height: 120, top: -30, right: -20, background: '#fff', filter: 'blur(40px)', opacity: 0.08 }} />
            <div className="absolute rounded-full pointer-events-none"
              style={{ width: 80, height: 80, top: 50, left: -10, background: '#fff', filter: 'blur(40px)', opacity: 0.06 }} />

            {/* Main hero row */}
            <div className="p-5 relative">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                    {ch.emoji}
                  </div>
                  {streak > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 bg-orange-400 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <span className="text-[9px] font-bold text-white">{streak}</span>
                      <Flame size={7} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-90">{ch.title}</span>
                    <span className="text-[10px] opacity-60">· {ch.sub}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold tabular-nums">{Math.round(score)}</span>
                    <span className="text-sm opacity-60">/ 100</span>
                    <span className="ml-auto text-sm font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>
                      {grade.letter}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: isLegendary ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'rgba(255,255,255,0.85)' }} />
                  </div>
                  <p className="text-[10px] opacity-60 mt-1">{grade.label}</p>
                </div>
              </div>

              {/* Status chips */}
              <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                {[
                  { label: 'Diet',    done: questDone.diet    },
                  { label: 'Workout', done: questDone.workout  },
                  { label: 'Sleep',   done: questDone.sleep   },
                ].map(({ label, done }) => (
                  <div key={label}
                    className="flex-1 flex items-center gap-1.5 rounded-xl px-2 py-1.5 justify-center text-[11px] font-semibold"
                    style={{ background: done ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', color: done ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                    {done ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setHeroExpanded(v => !v)}
                className="w-full mt-3 pt-3 flex items-center justify-center gap-1.5 transition-opacity active:opacity-70"
                style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="text-[10px] font-semibold text-white/50">
                  {heroExpanded ? 'Hide score' : 'View score breakdown'}
                </span>
                {heroExpanded
                  ? <ChevronUp size={11} className="text-white/50" />
                  : <ChevronDown size={11} className="text-white/50" />}
              </button>
            </div>

            {/* Expandable score breakdown — dark surface for readability */}
            {heroExpanded && (
              <div className="animate-slide-up rounded-b-3xl overflow-hidden"
                style={{ background: 'rgb(var(--c-surface-card))' }}>
                {/* Toggle */}
                <div className="flex gap-1 mx-4 mt-4 mb-4 bg-surface-elevated rounded-xl p-1">
                  {['bars', 'detail'].map(v => (
                    <button key={v} onClick={() => setScoreView(v)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${scoreView === v ? 'bg-brand text-white' : 'text-text-muted'}`}>
                      {v === 'bars' ? 'Score Bars' : 'Full Detail'}
                    </button>
                  ))}
                </div>

                {scoreView === 'bars' && (
                  <div className="px-4 pb-5">
                    <div className="flex justify-center mb-4">
                      <ScoreRing score={score} max={100} size={130} color={grade.color} />
                    </div>
                    <div className="space-y-3">
                      <HeroStatBar label="Diet"    value={todayScore?.diet_score ?? 0}    max={35} color="#22c55e" icon="🥗" />
                      {activePenalties.filter(p => p.section === 'diet').map(p => (
                        <p key={p.label} className="text-xs text-danger">⚠ {p.label}: {p.amount} pts</p>
                      ))}
                      <HeroStatBar label="Fasting" value={todayScore?.fasting_score ?? 0} max={10} color="#f97316" icon="⏱" />
                      <HeroStatBar label="Workout" value={todayScore?.workout_score ?? 0} max={35} color="#38bdf8" icon="⚡" />
                      <HeroStatBar label="Sleep"   value={todayScore?.sleep_score ?? 0}   max={30} color="#a78bfa" icon="🌙" />
                      {activePenalties.filter(p => p.section === 'sleep').map(p => (
                        <p key={p.label} className="text-xs text-danger">⚠ {p.label}: {p.amount} pts</p>
                      ))}
                      {todayScore?.bonus_points > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Zap size={12} className="text-warning" />
                          <span className="text-xs font-bold text-warning">+{todayScore.bonus_points} bonus pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {scoreView === 'detail' && todayScore && (
                  <div className="px-4 pb-5">
                    <DayDetailPanel
                      score={todayScore}
                      diet={logs.diet}
                      workout={logs.workout}
                      sleep={logs.sleep}
                      yesterdayDiet={logs.yesterdayDiet}
                      date={today}
                    />
                  </div>
                )}
                {scoreView === 'detail' && !todayScore && (
                  <p className="text-xs text-text-muted text-center py-8">No data logged yet today</p>
                )}
              </div>
            )}
          </div>

          {/* ── Rotating Power-Ups ───────────────────────────────────────────── */}
          {cta && (
            <div className="card"
              onTouchStart={handleCtaSwipeStart}
              onTouchEnd={handleCtaSwipeEnd}
              style={{
                background: cta.type === 'damage' ? 'rgba(234,67,53,0.06)' : 'rgba(124,58,237,0.06)',
                borderColor: cta.type === 'damage' ? 'rgba(234,67,53,0.25)' : 'rgba(124,58,237,0.25)',
                transition: 'border-color 0.3s',
                touchAction: 'pan-y',
              }}>
              <div className="flex items-start gap-3"
                style={{ opacity: ctaVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                <span className="text-xl shrink-0 mt-0.5">{cta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: cta.type === 'damage' ? '#ef4444' : 'rgb(var(--c-brand-light))' }}>
                    {cta.type === 'damage' ? 'Active damage' : 'Power-up available'}
                  </p>
                  <p className="text-sm font-semibold text-text-primary leading-snug">{cta.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{cta.sublabel || (cta.type === 'damage' ? `−${cta.impact} pts` : cta.impact > 0 ? `+${cta.impact} pts available` : '')}</p>
                </div>
              </div>
              {ctas.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(124,58,237,0.12)' }}>
                  {ctas.map((_, i) => (
                    <button key={i} onClick={() => jumpCta(i)}
                      className="rounded-full transition-all duration-300"
                      style={{ width: i === ctaIndex ? 16 : 6, height: 6, background: i === ctaIndex ? 'rgb(var(--c-brand))' : 'rgba(124,58,237,0.25)' }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Weekly Summary shortcut ──────────────────────────────────────── */}
          <button onClick={() => navigate('/history?tab=week')}
            className="w-full card flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            style={{ background: 'rgba(251,188,4,0.06)', borderColor: 'rgba(251,188,4,0.25)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(251,188,4,0.15)' }}>
              <BarChart2 size={16} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-warning uppercase tracking-wider">This Week</p>
              <p className="text-sm font-semibold text-text-primary leading-tight">View weekly executive summary</p>
            </div>
            <ChevronDown size={14} className="text-text-muted shrink-0 -rotate-90" />
          </button>

          {/* ── Weight shortcut ──────────────────────────────────────────────── */}
          {weightTrend && (
            <button onClick={() => navigate('/weight')}
              className="w-full card flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
              style={{ background: 'rgba(236,72,153,0.06)', borderColor: 'rgba(236,72,153,0.25)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(236,72,153,0.15)' }}>
                <Scale size={16} style={{ color: '#ec4899' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ec4899' }}>Weight</p>
                {weightTrend.empty ? (
                  <p className="text-sm font-semibold text-text-primary leading-tight">Log your first weigh-in</p>
                ) : (
                  <p className="text-sm font-semibold text-text-primary leading-tight">
                    {weightTrend.latest} kg
                    {weightTrend.change !== 0 && (
                      <span className={weightTrend.change < 0 ? 'text-success' : 'text-warning'}>
                        {' · '}{weightTrend.change > 0 ? '+' : ''}{weightTrend.change} kg this month
                      </span>
                    )}
                    {!weightTrend.loggedToday && <span className="text-text-muted"> · not logged today</span>}
                  </p>
                )}
              </div>
              <ChevronDown size={14} className="text-text-muted shrink-0 -rotate-90" />
            </button>
          )}

          {/* ── Mini Badge Shelf ─────────────────────────────────────────────── */}
          {badgeData && (badgeData.thisWeek.length > 0 || badgeData.nearUnlock.length > 0) && (
            <BadgeShelfMini
              thisWeek={badgeData.thisWeek}
              nearUnlock={badgeData.nearUnlock}
              onViewAll={() => navigate('/history?tab=week')}
            />
          )}

          {/* ── Daily Quest Cards ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold text-text-primary">Daily Quests</h2>
              <span className="badge badge-brand">{doneCount}/3 done</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUEST_CARDS.map(({ key, label, description, to, emoji, gradient, shadow }) => {
                const done = questDone[key]
                return (
                  <button key={key} onClick={() => navigate(to)}
                    className="rounded-2xl p-3 text-left relative overflow-hidden transition-transform active:scale-[0.96]"
                    style={{ background: gradient, boxShadow: done ? `0 4px 16px ${shadow}` : `0 2px 10px ${shadow}`, opacity: done ? 1 : 0.9 }}>
                    <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full pointer-events-none"
                      style={{ background: 'rgba(255,255,255,0.12)', filter: 'blur(10px)' }} />
                    <div className="text-xl mb-2">{emoji}</div>
                    <p className="text-xs font-bold text-white leading-tight mb-0.5">{label}</p>
                    <p className="text-[9px] text-white/60 leading-tight mb-2">{description}</p>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: done ? '100%' : '0%', background: 'rgba(255,255,255,0.85)' }} />
                    </div>
                    {done && (
                      <span className="absolute top-2 right-2 text-[10px] font-black text-white/90">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Home-only Add Meal FAB ─────────────────────────────────────────── */}
      <button onClick={() => setAddMealOpen(true)}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--c-brand)), rgb(var(--c-brand-dark)))',
          boxShadow: '0 6px 20px rgb(var(--c-brand) / 0.5)',
        }}>
        <UtensilsCrossed size={22} className="text-white" />
      </button>

      <AddMealFlow open={addMealOpen} onClose={() => setAddMealOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
