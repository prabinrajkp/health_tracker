import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Flame, ChevronRight, AlertTriangle, Check, Utensils, Footprints, Moon, Scale, Dumbbell, PersonStanding, Play, Square, Plus, Undo2, Thermometer, Target,
} from 'lucide-react'
import useStore from '../store/useStore'
import BottomSheet from '../components/BottomSheet'
import AddMealFlow from '../components/AddMealFlow'
import { DayDetailPanel } from '../components/DayDetail'
import { getDiet, getWorkout, getSleep, getWeightEntry, isSickDay, markSickDays, unmarkSickDays, getMissedDays, getLatestWeight, saveConfig, saveGoalEntry } from '../api/client'
import { BODY_GOALS, UNDERWEIGHT_BMI, planOn, goalHistory, fastingCounts, defaultPace, defaultFasting } from '../services/bodyGoal'
import { computeBmi } from '../services/dietetics'
import { describeDays } from '../services/sickDays'
import { useWater } from '../hooks/useWater'
import { formatLitres } from '../services/hydration'
import WaterGlass from '../components/WaterGlass'
import DrinksSheet from '../components/DrinksSheet'
import { computeNextAction } from '../services/nextAction'
import { planNudges } from '../services/nudgePlanner'
import { gradeFor, weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../services/scoreMeta'
import { getSleepTimerStart, startSleepTimer, stopSleepTimer, hhmm, formatElapsed } from '../services/sleepTimer'
import { APPLIED_EVENT } from '../services/widgetInbox'

const PERFECT_KEY  = 'hq-perfect-day'
const UNWELL_KEY   = 'hq-still-unwell-dismissed'   // the date "Still unwell?" was answered
const CATCH_UP_KEY = 'hq-catch-up-dismissed'       // the start of the gap that was answered "No"

const readKey  = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const writeKey = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
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

// Drinks: a glass that fills, and one tap to add a glass. Tapping the card
// opens the Drinks sheet for everything else (bigger amounts, other drinks,
// removing an entry). Drinks logged in meals are already in the total.
function WaterCard({ water, onOpen }) {
  const { totals, targetMl, glassMl, entries, add, undoLast } = water
  const hasGoal = targetMl > 0
  const reached = hasGoal && totals.totalMl >= targetMl
  const glasses = Math.round((totals.totalMl / glassMl) * 10) / 10

  return (
    <section className="card flex items-center gap-3">
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
        aria-label="Open drinks">
        <WaterGlass fraction={hasGoal ? totals.totalMl / targetMl : 0} />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-text-secondary">Drinks</span>
          <span className="block text-base font-semibold text-text-primary tabular-nums">
            {hasGoal ? formatLitres(totals.totalMl).replace(' L', '') : formatLitres(totals.totalMl)}
            {hasGoal && <span className="font-normal text-text-muted"> of {formatLitres(targetMl)}</span>}
          </span>
          <span className={`block text-sm ${reached ? 'text-success font-semibold' : 'text-text-secondary'}`}>
            {reached ? 'Goal reached' : totals.totalMl === 0 ? 'Nothing logged yet'
              : totals.mealMl > 0 ? `${formatLitres(totals.mealMl)} from meals` : `${glasses} glass${glasses === 1 ? '' : 'es'}`}
          </span>
        </span>
      </button>
      {entries.length > 0 && (
        <button onClick={undoLast} aria-label="Undo last drink" className="icon-btn"><Undo2 size={17} /></button>
      )}
      <button onClick={() => add(glassMl, 'water')} aria-label={`Add a ${glassMl} mL glass of water`}
        className={`${reached ? 'btn-ghost' : 'btn-primary'} shrink-0 px-4`}>
        <Plus size={16} />Glass
      </button>
    </section>
  )
}

// The sleep timer as one button: start it at bedtime, stop it on waking.
// The full sleep screen (manual times, quality, notes) stays under Log → Sleep.
function SleepTimerButton({ startedAt, onStart, onStop, busy }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  if (startedAt) return (
    <button onClick={onStop} disabled={busy} className="btn-primary w-full py-4 justify-between">
      <span className="flex items-center gap-2"><Square size={16} />Wake up — stop timer</span>
      <span className="font-normal tabular-nums">{formatElapsed(elapsed)} since {hhmm(startedAt)}</span>
    </button>
  )
  return (
    <button onClick={onStart} className="btn-ghost w-full py-4">
      <Play size={16} />Going to sleep — start timer
    </button>
  )
}

// A question with two answers, in the Next card's place: "Still unwell?" and
// the catch-up prompt after days with nothing logged.
function AskCard({ title, yes, no, onYes, onNo }) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0">
          <Thermometer size={19} className="text-text-secondary" />
        </span>
        <p className="text-base font-semibold text-text-primary leading-snug">{title}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onYes} className="btn-primary flex-1">{yes}</button>
        <button onClick={onNo} className="btn-ghost flex-1">{no}</button>
      </div>
    </section>
  )
}

// Asked once of anyone who has not chosen a body goal. The app already knows what
// they picked at onboarding, so that answer is offered first.
function GoalAskCard({ suggested, onPick, onLater }) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0">
          <Target size={19} className="text-text-secondary" />
        </span>
        <p className="text-base font-semibold text-text-primary leading-snug">What's your body goal?</p>
      </div>
      <div className="flex gap-2">
        {BODY_GOALS.map(g => (
          <button key={g.id} onClick={() => onPick(g.id)}
            className={`flex-1 ${suggested === g.id ? 'btn-primary' : 'btn-ghost'} px-1`}>{g.id === 'keep' ? 'Keep' : g.id === 'lose' ? 'Lose' : 'Gain'}</button>
        ))}
      </div>
      <button onClick={onLater} className="w-full text-sm text-text-secondary py-1 active:opacity-70">Not now</button>
    </section>
  )
}

const suggestedGoal = (config) => {
  try {
    const picked = JSON.parse(config?.onboarding_goals || '[]')
    if (picked.includes('muscle_gain') && !picked.includes('fat_loss')) return 'gain'
    if (picked.includes('fat_loss') && !picked.includes('muscle_gain')) return 'lose'
  } catch {}
  return null
}

export default function Today() {
  const { todayScore, streak, refreshAll, config } = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const [logs, setLogs] = useState({ diet: null, workout: null, sleep: null, yesterdayDiet: null, weight: null })
  const water = useWater()
  const [detailOpen, setDetailOpen]     = useState(false)
  const [mealCategory, setMealCategory] = useState(null)
  const [addMealOpen, setAddMealOpen]   = useState(false)
  const [timerStart, setTimerStart]     = useState(getSleepTimerStart)
  const [stopping, setStopping]         = useState(false)
  const [drinksOpen, setDrinksOpen]     = useState(false)
  const [sickToday, setSickToday]         = useState(false)
  const [sickYesterday, setSickYesterday] = useState(false)
  const [missed, setMissed]               = useState({ days: [], gapStart: null })
  const [answered, setAnswered]           = useState({ unwell: readKey(UNWELL_KEY), catchUp: readKey(CATCH_UP_KEY) })

  const loadLogs = async () => {
    const [diet, workout, sleep, yesterdayDiet, weight] = await Promise.all([
      getDiet(today), getWorkout(today), getSleep(today), getDiet(yesterday),
      getWeightEntry(today).catch(() => null),
    ])
    setLogs({ diet, workout, sleep, yesterdayDiet, weight })
  }

  const loadSick = async () => {
    const [todaySick, yesterdaySick, gap] = await Promise.all([isSickDay(today), isSickDay(yesterday), getMissedDays()])
    setSickToday(todaySick)
    setSickYesterday(yesterdaySick)
    setMissed(gap)
  }

  // Marking changes the score, the streak and the drinks goal, so all three reload
  const refreshAfterSickChange = async () => {
    await refreshAll()
    await Promise.all([loadLogs(), loadSick(), water.reload()])
    planNudges().catch(() => {})
  }

  // One tap, no form or dialog: someone who is ill will not fill anything in,
  // and a mistaken tap is one Undo away.
  const markSick = async (dates, message) => {
    try {
      await markSickDays(dates)
      await refreshAfterSickChange()
      toast((t) => (
        <span className="flex items-center gap-3">
          <span>{message}</span>
          <button className="font-semibold text-brand-light shrink-0" onClick={async () => {
            toast.dismiss(t.id)
            await unmarkSickDays(dates)
            await refreshAfterSickChange()
          }}>Undo</button>
        </span>
      ), { duration: 6000 })
    } catch {
      toast.error('Could not mark that day')
    }
  }

  const markToday = () => markSick([today], todayScore && !nothingYet
    ? "Today's score is set aside. What you logged is kept."
    : 'Marked as a sick day')

  const feelingBetter = async () => {
    await unmarkSickDays([today])
    await refreshAfterSickChange()
  }

  const answerUnwell = () => { writeKey(UNWELL_KEY, today); setAnswered(a => ({ ...a, unwell: today })) }
  const answerCatchUp = () => { writeKey(CATCH_UP_KEY, missed.gapStart); setAnswered(a => ({ ...a, catchUp: missed.gapStart })) }

  const closeGoalAsk = () => saveConfig({ key: 'body_goal_asked', value: 'true' }).then(() => refreshAll()).catch(() => {})

  const pickGoal = async (goal) => {
    const latest = await getLatestWeight().catch(() => null)
    const bmi = latest ? computeBmi(Number(config.height_cm), latest.weight_kg) : null
    if (goal === 'lose' && bmi != null && bmi < UNDERWEIGHT_BMI) {
      toast(`Losing weight is not offered below BMI ${UNDERWEIGHT_BMI}. Keep or Gain would suit you better.`)
      return
    }
    await saveGoalEntry({ goal, pace: defaultPace(goal, { bmi }), muscle: false, fasting: defaultFasting(goal) })
    await saveConfig({ key: 'body_goal_asked', value: 'true' })
    await refreshAll()
    planNudges().catch(() => {})
    toast.success('Goal saved. You can change the pace in Settings.')
  }

  useEffect(() => {
    refreshAll()
    loadLogs().catch(console.error)
    loadSick().catch(console.error)
  }, [])

  // A drink, a night or a weight tapped on a home-screen widget was just written
  useEffect(() => {
    const reload = () => {
      setTimerStart(getSleepTimerStart())
      refreshAll()
      loadLogs().catch(console.error)
      water.reload().catch(console.error)
    }
    window.addEventListener(APPLIED_EVENT, reload)
    return () => window.removeEventListener(APPLIED_EVENT, reload)
  }, [water.reload])

  const weights = weightsFromConfig(config)
  const max     = categoryMaxes(weights)
  const plan    = planOn(config, today)
  const askGoal = !!config?.onboarding_complete && !goalHistory(config).length && config.body_goal_asked !== 'true'
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
    diet: logs.diet, workout: logs.workout, sleep: logs.sleep, weights, sleepTimerRunning: !!timerStart,
  })
  const NextIcon = next ? (ACTION_ICONS[next.icon] || ChevronRight) : Check

  const openAddMeal = (category = null) => { setMealCategory(category); setAddMealOpen(true) }

  // A dinner or breakfast notification opens Add Meal on that meal. The Quick log
  // widget asks for "now": Add Meal then picks the meal that fits the time of day.
  useEffect(() => {
    const meal = searchParams.get('meal')
    if (!meal) return
    openAddMeal(meal === 'now' ? null : meal)
    setSearchParams({}, { replace: true })
  }, [searchParams])

  const runAction = (target) => {
    if (target.type === 'meal') openAddMeal(target.category)
    else navigate(`/log?tab=${target.tab}`)
  }
  const handleMealLogged = async () => {
    await refreshAll()
    await loadLogs()
    await water.reload()   // a drink logged in the meal counts toward drinks
  }

  const handleStopTimer = async () => {
    setStopping(true)
    try {
      const saved = await stopSleepTimer()
      setTimerStart(null)
      if (saved) {
        await refreshAll()
        await loadLogs()
        planNudges().catch(() => {})
      }
    } finally {
      setStopping(false)
    }
  }

  const playerName = config?.player_name || ''

  return (
    <div className="min-h-screen bg-surface-base pb-nav flex flex-col animate-fade-in">
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-text-muted">
            {format(new Date(), 'EEEE, MMM d')}
            {!sickToday && (
              <> · <button onClick={markToday} className="font-medium text-text-secondary underline underline-offset-2 active:opacity-70">Not feeling well?</button></>
            )}
          </p>
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

        {/* ── Sick day: no score, no next step, no penalties ──────────────────── */}
        {sickToday ? (
          <section className="text-center py-5">
            <span className="w-14 h-14 rounded-full bg-surface-elevated inline-flex items-center justify-center mb-3">
              <Thermometer size={24} className="text-text-secondary" />
            </span>
            <h2 className="t-title">Sick day</h2>
            <p className="text-base text-text-secondary mt-1 max-w-[18rem] mx-auto">
              Rest up. Nothing to log today{streak > 0 ? `, and your ${streak}-day streak is safe` : ''}.
            </p>
            <button onClick={feelingBetter} className="text-sm font-semibold text-brand-light py-2 mt-1 active:opacity-70">
              I'm feeling better
            </button>
          </section>
        ) : (
          <>
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
              {fastingCounts(plan) && <ScoreBar label="Fasting" value={todayScore?.fasting_score ?? 0} max={max.fasting} color={CATEGORY_COLORS.fasting} />}
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

        {/* ── 2. Next, or a question about being unwell in its place ────────── */}
        {sickYesterday && answered.unwell !== today ? (
          <AskCard title="Still unwell?" yes="Yes, rest today too" no="I'm better"
            onYes={() => markSick([today], 'Marked as a sick day')} onNo={answerUnwell} />
        ) : missed.days.length > 0 && answered.catchUp !== missed.gapStart ? (
          <AskCard title={`Nothing logged on ${describeDays(missed.days)}. Were you unwell?`}
            yes={missed.days.length === 1 ? 'Mark as sick day' : 'Mark as sick days'} no="No"
            onYes={() => markSick(missed.days, missed.days.length === 1 ? 'Marked as a sick day' : `Marked ${missed.days.length} sick days`)}
            onNo={answerCatchUp} />
        ) : askGoal ? (
          <GoalAskCard suggested={suggestedGoal(config)} onPick={pickGoal} onLater={closeGoalAsk} />
        ) : (
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
        )}
          </>
        )}

        {/* ── 3. Drinks — the most frequent log of the day, one tap away ────── */}
        <WaterCard water={water} onOpen={() => setDrinksOpen(true)} />

        {/* ── 4. Sleep timer — one button, so it is never forgotten ────────── */}
        <SleepTimerButton startedAt={timerStart} busy={stopping}
          onStart={() => { setTimerStart(startSleepTimer()); planNudges().catch(() => {}) }} onStop={handleStopTimer} />

        {/* ── 5. Log — at the bottom, where the thumb is ───────────────────── */}
        <section className="mt-auto pb-3">
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

      <DrinksSheet open={drinksOpen} onClose={() => setDrinksOpen(false)} water={water} />

      <AddMealFlow open={addMealOpen} presetCategory={mealCategory}
        onClose={() => setAddMealOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
