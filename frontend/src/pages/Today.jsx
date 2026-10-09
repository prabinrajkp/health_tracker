import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import { Flame, ChevronRight, AlertTriangle, Check } from 'lucide-react'
import useStore from '../store/useStore'
import BottomSheet from '../components/BottomSheet'
import AddMealFlow from '../components/AddMealFlow'
import { DayDetailPanel } from '../components/DayDetail'
import { getDiet, getWorkout, getSleep, getWeightEntry } from '../api/client'
import { computeNextAction } from '../services/nextAction'
import { gradeFor, weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../services/scoreMeta'

const PERFECT_KEY = 'hq-perfect-day'

function ScoreBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-text-secondary w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-text-primary w-12 text-right shrink-0">
        {Math.round(value)}<span className="text-text-muted font-normal">/{max}</span>
      </span>
    </div>
  )
}

function LogButton({ emoji, label, status, done, onClick }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl border border-surface-border bg-surface-card p-3 flex flex-col items-center gap-1 active:scale-[0.96] transition-transform">
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-xs font-semibold text-text-primary">{label}</span>
      <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${done ? 'text-success' : 'text-text-muted'}`}>
        {done && <Check size={11} strokeWidth={3} />}{status}
      </span>
    </button>
  )
}

export default function Today() {
  const { todayScore, streak, refreshAll, config } = useStore()
  const navigate = useNavigate()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const [logs, setLogs] = useState({ diet: null, workout: null, sleep: null, yesterdayDiet: null, weight: null })
  const [detailOpen, setDetailOpen]   = useState(false)
  const [mealCategory, setMealCategory] = useState(null)
  const [addMealOpen, setAddMealOpen] = useState(false)

  const loadLogs = async () => {
    const [diet, workout, sleep, yesterdayDiet, weight] = await Promise.all([
      getDiet(today), getWorkout(today), getSleep(today), getDiet(yesterday),
      getWeightEntry(today).catch(() => null),
    ])
    setLogs({ diet, workout, sleep, yesterdayDiet, weight })
  }

  useEffect(() => {
    refreshAll()
    loadLogs().catch(console.error)
  }, [])

  const weights = weightsFromConfig(config)
  const max     = categoryMaxes(weights)
  const score   = Math.round(todayScore?.total_score ?? 0)
  const grade   = gradeFor(score)

  const mealsLogged = ['breakfast', 'lunch', 'dinner']
    .filter(t => (logs.diet?.meal_items || []).some(i => i.mealType === t)).length
  const steps       = logs.workout?.steps || 0
  const moveDone    = (todayScore?.workout_score ?? 0) > 0
  const sleepDone   = !!logs.sleep?.sleep_time
  const weightDone  = !!logs.weight

  // Celebrate a complete day once, without taking up room on the screen.
  useEffect(() => {
    if (mealsLogged < 3 || !moveDone || !sleepDone) return
    try {
      if (localStorage.getItem(PERFECT_KEY) === today) return
      localStorage.setItem(PERFECT_KEY, today)
    } catch {}
    toast('Everything logged today — well done!', { icon: '🏆' })
  }, [mealsLogged, moveDone, sleepDone])

  const { next, penalties } = computeNextAction({
    diet: logs.diet, workout: logs.workout, sleep: logs.sleep, weights,
  })

  const openAddMeal = (category = null) => { setMealCategory(category); setAddMealOpen(true) }
  const runAction = (target) => {
    if (target.type === 'meal') openAddMeal(target.category)
    else navigate(`/log?tab=${target.tab}`)
  }
  const handleMealLogged = async () => {
    await refreshAll()
    await loadLogs()
  }

  const playerName = config?.player_name || ''

  return (
    <div className="min-h-screen bg-surface-base pb-32 animate-fade-in">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{format(new Date(), 'EEEE, MMM d')}</p>
          <h1 className="text-lg font-bold text-text-primary leading-tight mt-0.5">
            {playerName ? `Hi, ${playerName}` : 'Today'}
          </h1>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl border border-surface-border bg-surface-elevated"
            title="Day streak">
            <Flame size={14} className="text-orange-400" />
            <span className="text-sm font-bold text-text-primary">{streak}</span>
            <span className="text-[11px] text-text-muted">day{streak === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-3">

        {/* ── 1. Score ─────────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: grade.color }}>{score}</span>
              <span className="text-sm text-text-muted">/ 100</span>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
                style={{ color: grade.color, background: `${grade.color}18` }}>
                {grade.letter} · {grade.label}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <ScoreBar label="Diet"    value={todayScore?.diet_score ?? 0}    max={max.diet}    color={CATEGORY_COLORS.diet} />
            <ScoreBar label="Fasting" value={todayScore?.fasting_score ?? 0} max={max.fasting} color={CATEGORY_COLORS.fasting} />
            <ScoreBar label="Workout" value={todayScore?.workout_score ?? 0} max={max.workout} color={CATEGORY_COLORS.workout} />
            <ScoreBar label="Sleep"   value={todayScore?.sleep_score ?? 0}   max={max.sleep}   color={CATEGORY_COLORS.sleep} />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-warning font-semibold">
              {(todayScore?.bonus_points ?? 0) > 0 ? `+${Math.round(todayScore.bonus_points)} bonus pts` : ''}
            </span>
            <button onClick={() => setDetailOpen(true)}
              className="flex items-center gap-0.5 text-xs font-semibold text-brand-light active:opacity-70">
              Full detail <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* ── 2. Next ──────────────────────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          {next ? (
            <button onClick={() => runAction(next.target)}
              className="w-full flex items-center gap-3 p-4 text-left active:bg-surface-elevated transition-colors">
              <span className="text-2xl shrink-0">{next.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-light">Next</p>
                <p className="text-sm font-semibold text-text-primary leading-snug">
                  {next.label}
                  {next.impact > 0 && (
                    <span className="text-success"> → {next.upTo ? 'up to ' : ''}+{next.impact} pts</span>
                  )}
                </p>
                {next.note && <p className="text-xs text-text-muted mt-0.5">{next.note}</p>}
              </div>
              <ChevronRight size={16} className="text-text-muted shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4">
              <span className="text-2xl shrink-0">✅</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-success">Next</p>
                <p className="text-sm font-semibold text-text-primary">All done for today</p>
              </div>
            </div>
          )}
          {penalties.map(p => (
            <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 border-t border-surface-border bg-danger/5">
              <AlertTriangle size={13} className="text-danger shrink-0" />
              <p className="text-xs text-text-secondary">{p.label} cost <span className="font-semibold text-danger">{p.amount} pts</span></p>
            </div>
          ))}
        </div>

        {/* ── 3. Log ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          <LogButton emoji="🍽️" label="Meal" status={`${mealsLogged}/3`} done={mealsLogged === 3}
            onClick={() => openAddMeal()} />
          <LogButton emoji="👟" label="Move"
            status={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps > 0 ? String(steps) : '—'} done={moveDone}
            onClick={() => navigate('/log?tab=move')} />
          <LogButton emoji="🌙" label="Sleep" status={sleepDone ? 'Logged' : '—'} done={sleepDone}
            onClick={() => navigate('/log?tab=sleep')} />
          <LogButton emoji="⚖️" label="Weight" status={weightDone ? `${logs.weight.weight_kg} kg` : '—'} done={weightDone}
            onClick={() => navigate('/weight')} />
        </div>
      </div>

      <BottomSheet open={detailOpen} onClose={() => setDetailOpen(false)} title="Today in detail">
        <div className="px-4 py-4">
          {detailOpen && todayScore && (
            <DayDetailPanel score={todayScore} diet={logs.diet} workout={logs.workout} sleep={logs.sleep}
              yesterdayDiet={logs.yesterdayDiet} date={today} />
          )}
          {detailOpen && !todayScore && (
            <p className="text-sm text-text-muted text-center py-10">Nothing logged yet today</p>
          )}
        </div>
      </BottomSheet>

      <AddMealFlow open={addMealOpen} presetCategory={mealCategory}
        onClose={() => setAddMealOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
