import { useState, useEffect, useRef } from 'react'
import { saveConfig } from '../api/client'
import toast from 'react-hot-toast'

// ── Static data ────────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'fat_loss',        icon: '🔥', label: 'Fat Loss',        desc: 'Burn fat through diet & movement' },
  { id: 'muscle_gain',     icon: '💪', label: 'Muscle Gain',     desc: 'Build strength with protein & training' },
  { id: 'general_fitness', icon: '⚡', label: 'General Fitness', desc: 'Stay active and balanced' },
  { id: 'better_sleep',    icon: '🌙', label: 'Better Sleep',    desc: 'Improve rest and recovery' },
  { id: 'consistency',     icon: '📅', label: 'Consistency',     desc: 'Build lasting daily habits' },
  { id: 'energy',          icon: '✨', label: 'Energy Levels',   desc: 'Feel more energised every day' },
]

const GOAL_WEIGHTS = {
  fat_loss:        { diet_max: 40, workout_max: 30, sleep_max: 30 },
  muscle_gain:     { diet_max: 35, workout_max: 40, sleep_max: 25 },
  general_fitness: { diet_max: 35, workout_max: 35, sleep_max: 30 },
  better_sleep:    { diet_max: 28, workout_max: 22, sleep_max: 50 },
  consistency:     { diet_max: 35, workout_max: 35, sleep_max: 30 },
  energy:          { diet_max: 35, workout_max: 30, sleep_max: 35 },
}

const ACTIVITY_LEVELS = [
  { id: 'sedentary',         label: 'Sedentary',          desc: 'Mostly sitting / desk job' },
  { id: 'lightly_active',    label: 'Lightly active',     desc: 'Light walks, not structured' },
  { id: 'moderately_active', label: 'Moderately active',  desc: 'Exercise 3–4× per week' },
  { id: 'very_active',       label: 'Very active',        desc: 'Daily training or physical work' },
]

const ACTIVITY_STEPS = {
  sedentary:         { steps_half_threshold: 3000, steps_full_threshold: 6000,  steps_bonus_start: 8000,  steps_bonus_end: 15000 },
  lightly_active:    { steps_half_threshold: 5000, steps_full_threshold: 8000,  steps_bonus_start: 10000, steps_bonus_end: 18000 },
  moderately_active: { steps_half_threshold: 6000, steps_full_threshold: 10000, steps_bonus_start: 12000, steps_bonus_end: 20000 },
  very_active:       { steps_half_threshold: 7000, steps_full_threshold: 12000, steps_bonus_start: 15000, steps_bonus_end: 22000 },
}

const STRUGGLES = [
  { id: 'late_dinner',   label: 'Late-night eating',        icon: '🌙' },
  { id: 'skip_workout',  label: 'Skipping workouts',        icon: '🏃' },
  { id: 'junk_cravings', label: 'Snacking / junk cravings', icon: '🍕' },
  { id: 'poor_sleep',    label: 'Poor sleep',               icon: '😴' },
  { id: 'inconsistency', label: 'Inconsistency',            icon: '📉' },
]

const BASE_WEIGHTS = {
  diet: { breakfast: 5, lunch: 5, dinner_on_time: 8, no_post_dinner_snack: 7, protein_first: 5, tea_sugar_reduced: 5 },
  workout: { steps_8000: 15, steps_10000_bonus: 3, post_dinner_walk: 10, exercise_session: 10,
    steps_half_threshold: 5000, steps_full_threshold: 8000, steps_bonus_start: 10000, steps_bonus_end: 18000 },
  sleep: { sleep_before_1130: 10, seven_plus_hours: 12, wake_by_7: 8 },
  bonus: { all_rules_followed: 5, perfect_score: 10 },
  penalties: { dinner_after_9pm: -5, sleep_after_midnight: -8 },
  fasting: { target_hours: 16, min_hours: 12, max_points: 10 },
}

function buildWeights(goals, activityLevel, primaryStruggle) {
  const gw = goals.length > 0
    ? goals.map(g => GOAL_WEIGHTS[g] || GOAL_WEIGHTS.general_fitness)
    : [GOAL_WEIGHTS.general_fitness]

  const diet_max    = Math.round(gw.reduce((a, w) => a + w.diet_max, 0)    / gw.length)
  const workout_max = Math.round(gw.reduce((a, w) => a + w.workout_max, 0) / gw.length)
  const sleep_max   = Math.round(gw.reduce((a, w) => a + w.sleep_max, 0)   / gw.length)

  const steps = ACTIVITY_STEPS[activityLevel] || ACTIVITY_STEPS.lightly_active
  const penalties = { ...BASE_WEIGHTS.penalties }
  if (primaryStruggle === 'late_dinner') penalties.dinner_after_9pm = -7

  return { ...BASE_WEIGHTS, diet_max, workout_max, sleep_max, workout: { ...BASE_WEIGHTS.workout, ...steps }, penalties }
}

// ── Tutorial slides (exported for Settings reuse) ──────────────────────────────
const TUTORIAL_SLIDES = [
  {
    icon: '🏆',
    title: 'How the score works',
    bullets: [
      'Every day starts at 0 and builds to 100',
      'Diet, fasting, workout and sleep each add points',
      'Late dinner and sleeping after midnight take points off',
    ],
  },
  {
    icon: '➕',
    title: 'How to log',
    bullets: [
      'Today shows the one thing to do next — tap it',
      'Meals, steps, sleep and weight are one tap from Today',
      'Everything saves as you go — there is no Save button',
    ],
  },
  {
    icon: '📈',
    title: 'Where to see progress',
    bullets: [
      'Progress → Week gives you one thing to fix',
      'Progress → Month shows every day on a calendar',
      'Profile keeps your level, goals and badges',
    ],
  },
]

export function TutorialSlides({ onDone, doneLabel = 'Show me Today' }) {
  const [slide, setSlide] = useState(0)
  const startX = useRef(null)

  const goTo = (i) => setSlide(Math.max(0, Math.min(TUTORIAL_SLIDES.length - 1, i)))
  const isLast = slide === TUTORIAL_SLIDES.length - 1
  const s = TUTORIAL_SLIDES[slide]

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 text-center select-none"
        onTouchStart={e => { startX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (startX.current === null) return
          const dx = e.changedTouches[0].clientX - startX.current
          if (dx < -40) goTo(slide + 1)
          else if (dx > 40) goTo(slide - 1)
          startX.current = null
        }}
      >
        <div className="text-6xl mb-6">{s.icon}</div>
        <h2 className="text-xl font-bold text-text-primary mb-3">{s.title}</h2>
        {s.body && <p className="text-sm text-text-secondary leading-relaxed max-w-xs">{s.body}</p>}
        {s.bullets && (
          <ul className="text-left space-y-2 mt-1">
            {s.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-brand-light mt-0.5 shrink-0">•</span>{b}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-4">
        {TUTORIAL_SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-brand-light' : 'w-1.5 bg-surface-border'}`} />
        ))}
      </div>

      <div className="px-6 pb-8 flex gap-3">
        {slide > 0 && (
          <button onClick={() => goTo(slide - 1)}
            className="flex-1 py-3 rounded-2xl border border-surface-border text-sm font-semibold text-text-secondary">
            Back
          </button>
        )}
        {isLast ? (
          <button onClick={onDone}
            className="flex-1 py-3 rounded-2xl bg-brand text-white text-sm font-semibold">
            {doneLabel}
          </button>
        ) : (
          <button onClick={() => goTo(slide + 1)}
            className="flex-1 py-3 rounded-2xl bg-brand text-white text-sm font-semibold">
            Next
          </button>
        )}
      </div>
    </div>
  )
}

// ── ProgressBar ────────────────────────────────────────────────────────────────
function ProgressBar({ current, total }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-2">
      <div className="flex-1 bg-surface-elevated rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-brand transition-all duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>
      <span className="text-xs text-text-muted tabular-nums shrink-0">{current + 1}/{total}</span>
    </div>
  )
}

function OptionRow({ selected, onClick, label, desc, icon }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${selected ? 'border-brand bg-brand/10' : 'border-surface-border bg-surface-card'}`}>
      {icon && <span className="text-xl shrink-0">{icon}</span>}
      <div className="flex-1">
        <p className={`text-sm font-semibold ${selected ? 'text-brand-light' : 'text-text-primary'}`}>{label}</p>
        {desc && <p className="text-xs text-text-muted">{desc}</p>}
      </div>
      {selected && <span className="text-brand-light text-base shrink-0">✓</span>}
    </button>
  )
}

// ── Main Onboarding ────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }) {
  const [step, setStep]                   = useState(0)
  const [goals, setGoals]                 = useState([])
  const [activityLevel, setActivityLevel] = useState(null)
  const [primaryStruggle, setPrimaryStruggle] = useState(null)
  const [saving, setSaving]               = useState(false)

  const toggleGoal = (id) =>
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const canNext = () => {
    if (step === 1) return goals.length > 0
    if (step === 2) return !!activityLevel
    if (step === 3) return !!primaryStruggle
    return true
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      const weights = buildWeights(goals, activityLevel, primaryStruggle)
      await Promise.all([
        saveConfig({ key: 'onboarding_complete', value: 'true' }),
        saveConfig({ key: 'score_weights',        value: JSON.stringify(weights) }),
        saveConfig({ key: 'onboarding_goals',     value: JSON.stringify(goals) }),
        saveConfig({ key: 'onboarding_activity',  value: activityLevel || 'lightly_active' }),
        saveConfig({ key: 'onboarding_struggle',  value: primaryStruggle || 'inconsistency' }),
      ])
      onComplete()
    } catch {
      toast.error('Could not save — using defaults')
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    try { await saveConfig({ key: 'onboarding_complete', value: 'true' }) } catch {}
    onComplete()
  }

  const TOTAL = 4

  // ── Screen 0: Welcome ──────────────────────────────────────────────────────
  if (step === 0) return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-10">
        <img src="/logo.png" alt="Health Quest" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-6 shadow-lg" />
        <h1 className="text-2xl font-bold text-text-primary mb-1">Health Quest</h1>
        <p className="text-2xl font-bold text-brand-light mb-5">Track less. Improve faster.</p>
        <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
          Three quick questions, and your scoring is set up around your goals.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={() => setStep(1)}
          className="btn-primary w-full py-4 rounded-2xl text-sm font-semibold">
          Start setup
        </button>
        <button onClick={handleSkip}
          className="w-full py-3 text-sm text-text-muted">
          Skip — use default settings
        </button>
      </div>
    </div>
  )

  // ── Screen 1: Goals ────────────────────────────────────────────────────────
  if (step === 1) return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <ProgressBar current={0} total={TOTAL} />
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-1">What are you trying to improve?</h2>
          <p className="text-sm text-text-muted">Select one or more — your score weights adjust automatically</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(g => {
            const sel = goals.includes(g.id)
            return (
              <button key={g.id} onClick={() => toggleGoal(g.id)}
                className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${sel ? 'border-brand bg-brand/10' : 'border-surface-border bg-surface-card'}`}>
                <span className="text-3xl mb-2">{g.icon}</span>
                <span className={`text-sm font-semibold ${sel ? 'text-brand-light' : 'text-text-primary'}`}>{g.label}</span>
                <span className="text-xs text-text-muted mt-0.5 leading-tight">{g.desc}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-4 pb-8 pt-4">
        <button onClick={() => canNext() && setStep(2)} disabled={!canNext()}
          className={`btn-primary w-full py-4 rounded-2xl text-sm font-semibold ${!canNext() ? 'opacity-40' : ''}`}>
          Continue
        </button>
      </div>
    </div>
  )

  // ── Screen 2: Activity level ───────────────────────────────────────────────
  if (step === 2) return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <ProgressBar current={1} total={TOTAL} />
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-5 pb-2">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">How active are you now?</h2>
          <p className="text-sm text-text-muted">Sets a step target you can actually reach</p>
        </div>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map(a => (
            <OptionRow key={a.id} selected={activityLevel === a.id} onClick={() => setActivityLevel(a.id)} label={a.label} desc={a.desc} />
          ))}
        </div>
      </div>
      <div className="px-4 pb-8 pt-4 flex gap-3">
        <button onClick={() => setStep(1)}
          className="flex-1 py-3 rounded-2xl border border-surface-border text-sm font-semibold text-text-secondary">
          Back
        </button>
        <button onClick={() => canNext() && setStep(3)} disabled={!canNext()}
          className={`flex-1 btn-primary py-3 rounded-2xl text-sm font-semibold ${!canNext() ? 'opacity-40' : ''}`}>
          Continue
        </button>
      </div>
    </div>
  )

  // ── Screen 3: Main struggle ────────────────────────────────────────────────
  if (step === 3) return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <ProgressBar current={2} total={TOTAL} />
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-5 pb-2">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">What usually breaks your routine?</h2>
          <p className="text-sm text-text-muted">Pick the one that hits most often</p>
        </div>
        <div className="space-y-2">
          {STRUGGLES.map(s => (
            <OptionRow key={s.id} selected={primaryStruggle === s.id} onClick={() => setPrimaryStruggle(s.id)} label={s.label} icon={s.icon} />
          ))}
        </div>
      </div>
      <div className="px-4 pb-8 pt-4 flex gap-3">
        <button onClick={() => setStep(2)}
          className="flex-1 py-3 rounded-2xl border border-surface-border text-sm font-semibold text-text-secondary">
          Back
        </button>
        <button onClick={() => canNext() && setStep(4)} disabled={!canNext()}
          className={`flex-1 btn-primary py-3 rounded-2xl text-sm font-semibold ${!canNext() ? 'opacity-40' : ''}`}>
          Continue
        </button>
      </div>
    </div>
  )

  // ── Screen 4: Tutorial ─────────────────────────────────────────────────────
  if (step === 4) return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <ProgressBar current={3} total={TOTAL} />
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-text-primary mb-1">How Health Quest works</h2>
        <p className="text-sm text-text-muted">Three things to know</p>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <TutorialSlides
          onDone={handleComplete}
          doneLabel={saving ? 'Saving…' : 'Show me Today'}
        />
      </div>
    </div>
  )

  return null
}
