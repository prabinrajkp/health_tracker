import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Flame, ChevronRight, AlertTriangle, Check, Utensils, Footprints, Moon, Scale, Dumbbell, PersonStanding,
} from 'lucide-react'
import useStore from '../store/useStore'
import BottomSheet from '../components/BottomSheet'
import AddMealFlow from '../components/AddMealFlow'
import { DayDetailPanel } from '../components/DayDetail'
import { getDiet, getWorkout, getSleep, getWeightEntry, getScoresRange } from '../api/client'
import { computeNextAction } from '../services/nextAction'
import { gradeFor, weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../services/scoreMeta'
import { scoreColor } from '../services/theme'

const PERFECT_KEY = 'hq-perfect-day'
const ACTION_ICONS = { meal: Utensils, steps: Footprints, sleep: Moon, exercise: Dumbbell, walk: PersonStanding }

function ScoreBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm tabular-nums text-text-primary w-12 text-right shrink-0">
        {Math.round(value)}<span className="text-text-muted">/{max}</span>
      </span>
    </div>
  )
}

function LogButton({ Icon, label, status, done, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 rounded-xl bg-surface-card py-3 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
      style={{ border: '1px solid var(--card-border)' }}>
      <Icon size={22} strokeWidth={1.75} className="text-text-primary" />
      <span className="text-sm font-semibold text-text-primary leading-none">{label}</span>
      <span className={`text-xs flex items-center gap-0.5 leading-none ${done ? 'text-success font-semibold' : 'text-text-muted'}`}>
        {done && <Check size={11} strokeWidth={3} />}{status}
      </span>
    </button>
  )
}

// The last seven days at a glance; today is the last column.
function WeekStrip({ days, onOpen }) {
  return (
    <button onClick={onOpen} className="w-full card text-left active:opacity-70 transition-opacity">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Last 7 days</p>
        <ChevronRight size={16} className="text-text-muted" />
      </div>
      <div className="flex items-end gap-2 h-20">
        {days.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-xs tabular-nums text-text-secondary leading-none">{d.score != null ? d.score : ''}</span>
            <div className="w-2.5 rounded-full bg-surface-elevated flex items-end overflow-hidden" style={{ height: 40 }}>
              <div className="w-full rounded-full" style={{
                height: `${d.score != null ? Math.max(d.score, 6) : 0}%`,
                background: d.score != null ? scoreColor(d.score) : 'transparent',
              }} />
            </div>
            <span className={`text-xs leading-none ${d.today ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

export default function Today() {
  const { todayScore, streak, refreshAll, config } = useStore()
  const navigate = useNavigate()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const [logs, setLogs] = useState({ diet: null, workout: null, sleep: null, yesterdayDiet: null, weight: null })
  const [week, setWeek] = useState([])
  const [detailOpen, setDetailOpen]     = useState(false)
  const [mealCategory, setMealCategory] = useState(null)
  const [addMealOpen, setAddMealOpen]   = useState(false)

  const loadLogs = async () => {
    const [diet, workout, sleep, yesterdayDiet, weight, range] = await Promise.all([
      getDiet(today), getWorkout(today), getSleep(today), getDiet(yesterday),
      getWeightEntry(today).catch(() => null),
      getScoresRange(format(subDays(new Date(), 6), 'yyyy-MM-dd'), today).catch(() => []),
    ])
    setLogs({ diet, workout, sleep, yesterdayDiet, weight })
    const byDate = Object.fromEntries((range || []).map(r => [r.date, Math.round(r.total_score)]))
    setWeek(Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i), key = format(d, 'yyyy-MM-dd')
      return { date: key, label: format(d, 'EEEEE'), score: byDate[key] ?? null, today: key === today }
    }))
  }

  useEffect(() => {
    refreshAll()
    loadLogs().catch(console.error)
  }, [])

  const weights = weightsFromConfig(config)
  const max     = categoryMaxes(weights)
  const score   = Math.round(todayScore?.total_score ?? 0)
  const grade   = gradeFor(score)
  const nothingYet = !todayScore || (score === 0 && !(logs.diet?.meal_items?.length))

  const mealsLogged = ['breakfast', 'lunch', 'dinner']
    .filter(t => (logs.diet?.meal_items || []).some(i => i.mealType === t)).length
  const steps      = logs.workout?.steps || 0
  const moveDone   = (todayScore?.workout_score ?? 0) > 0
  const sleepDone  = !!logs.sleep?.sleep_time
  const weightDone = !!logs.weight

  // Celebrate a complete day once, without taking up room on the screen.
  useEffect(() => {
    if (mealsLogged < 3 || !moveDone || !sleepDone) return
    try {
      if (localStorage.getItem(PERFECT_KEY) === today) return
      localStorage.setItem(PERFECT_KEY, today)
    } catch {}
    toast.success('Everything logged today — well done!')
  }, [mealsLogged, moveDone, sleepDone])

  const { next, penalties } = computeNextAction({
    diet: logs.diet, workout: logs.workout, sleep: logs.sleep, weights,
  })
  const NextIcon = next ? (ACTION_ICONS[next.icon] || ChevronRight) : Check

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
    <div className="min-h-screen bg-surface-base pb-nav flex flex-col animate-fade-in">
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-text-muted">{format(new Date(), 'EEEE, MMM d')}</p>
          <h1 className="t-title mt-0.5">{playerName ? `Hi, ${playerName}` : 'Today'}</h1>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated" title="Day streak">
            <Flame size={15} className="text-warning" />
            <span className="text-sm font-semibold text-text-primary">{streak} day{streak === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg w-full mx-auto px-4 flex-1 flex flex-col gap-4">

        {/* ── 1. Score — the hero, so it gets no box ───────────────────────── */}
        <section className="pt-2">
          <div className="flex items-end justify-between">
            <p className="flex items-baseline gap-1.5">
              <span className="t-display">{score}</span>
              <span className="text-base text-text-muted">/ 100</span>
            </p>
            <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ color: grade.color, background: grade.bg }}>
              {grade.letter} · {grade.label}
            </span>
          </div>

          {nothingYet ? (
            <p className="text-sm text-text-secondary mt-4">
              Nothing logged yet today. Start with the step below, or use the buttons at the bottom.
            </p>
          ) : (
            <div className="space-y-2.5 mt-5">
              <ScoreBar label="Diet"    value={todayScore?.diet_score ?? 0}    max={max.diet}    color={CATEGORY_COLORS.diet} />
              <ScoreBar label="Fasting" value={todayScore?.fasting_score ?? 0} max={max.fasting} color={CATEGORY_COLORS.fasting} />
              <ScoreBar label="Workout" value={todayScore?.workout_score ?? 0} max={max.workout} color={CATEGORY_COLORS.workout} />
              <ScoreBar label="Sleep"   value={todayScore?.sleep_score ?? 0}   max={max.sleep}   color={CATEGORY_COLORS.sleep} />
            </div>
          )}

          {!nothingYet && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-text-secondary">
                {(todayScore?.bonus_points ?? 0) > 0 ? `Includes +${Math.round(todayScore.bonus_points)} bonus pts` : ''}
              </span>
              <button onClick={() => setDetailOpen(true)}
                className="flex items-center gap-0.5 text-sm font-semibold text-brand-light active:opacity-70 py-1">
                Full detail <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>

        {/* ── 2. Next ──────────────────────────────────────────────────────── */}
        <section className="card p-0 overflow-hidden">
          {next ? (
            <button onClick={() => runAction(next.target)}
              className="w-full flex items-center gap-3 p-4 text-left active:opacity-70 transition-opacity">
              <span className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
                <NextIcon size={19} className="text-brand-light" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-brand-light">Next</span>
                <span className="block text-base font-semibold text-text-primary leading-snug">{next.label}</span>
                <span className="block text-sm text-text-secondary">
                  {next.impact > 0 ? `${next.upTo ? 'Worth up to' : 'Worth'} ${next.impact} pts` : next.note}
                </span>
              </span>
              <ChevronRight size={18} className="text-text-muted shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4">
              <span className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                <Check size={19} className="text-success" />
              </span>
              <p className="text-base font-semibold text-text-primary">All done for today</p>
            </div>
          )}
          {penalties.map(p => (
            <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 border-t border-surface-border">
              <AlertTriangle size={14} className="text-danger shrink-0" />
              <p className="text-sm text-text-secondary">{p.label} cost <span className="font-semibold text-danger">{p.amount} pts</span></p>
            </div>
          ))}
        </section>

        {/* ── 3. The week, to fill the screen with something useful ────────── */}
        {week.some(d => d.score != null) && <WeekStrip days={week} onOpen={() => navigate('/progress')} />}

        {/* ── 4. Log — at the bottom, where the thumb is ───────────────────── */}
        <section className="mt-auto pb-4 pt-2">
          <p className="section-label mb-2">Log</p>
          <div className="flex gap-2">
            <LogButton Icon={Utensils} label="Meal" status={`${mealsLogged} of 3`} done={mealsLogged === 3}
              onClick={() => openAddMeal()} />
            <LogButton Icon={Footprints} label="Move"
              status={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps > 0 ? String(steps) : 'Not yet'} done={moveDone}
              onClick={() => navigate('/log?tab=move')} />
            <LogButton Icon={Moon} label="Sleep" status={sleepDone ? 'Logged' : 'Not yet'} done={sleepDone}
              onClick={() => navigate('/log?tab=sleep')} />
            <LogButton Icon={Scale} label="Weight" status={weightDone ? `${logs.weight.weight_kg} kg` : 'Not yet'} done={weightDone}
              onClick={() => navigate('/weight')} />
          </div>
        </section>
      </div>

      <BottomSheet open={detailOpen} onClose={() => setDetailOpen(false)} title="Today in detail">
        <div className="px-4 py-4">
          {detailOpen && todayScore && (
            <DayDetailPanel score={todayScore} diet={logs.diet} workout={logs.workout} sleep={logs.sleep}
              yesterdayDiet={logs.yesterdayDiet} date={today} />
          )}
        </div>
      </BottomSheet>

      <AddMealFlow open={addMealOpen} presetCategory={mealCategory}
        onClose={() => setAddMealOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
