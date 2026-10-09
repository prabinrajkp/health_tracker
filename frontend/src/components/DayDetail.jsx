/**
 * Shared day-detail sub-components used by both Today and Progress (any day).
 */
import { useEffect, useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react'
import { getConfig } from '../api/client'
import { generateHealthSummary } from '../services/llmApi'
import { weightsFromConfig, categoryMaxes } from '../services/scoreMeta'

export const MEAL_COLORS = {
  breakfast: '#f59e0b',
  lunch: '#22c55e',
  dinner: '#a78bfa',
  snacks: '#f97316',
}

export function fmtHours(h) {
  if (!h || h <= 0) return '0 min'
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}min`
}

export function calcFastingHours(diet, yesterdayDiet) {
  if (!diet || !yesterdayDiet) return null
  const dinnerItems = (yesterdayDiet.meal_items || []).filter(i => i.mealType === 'dinner')
  const dinnerTimes = dinnerItems.map(i => i.time).filter(Boolean)
  const lastDinner  = dinnerTimes.length
    ? [...dinnerTimes].sort().pop()
    : (yesterdayDiet.meal_times?.dinner || yesterdayDiet.dinner_time || null)
  if (!lastDinner) return null
  const bfItems = (diet.meal_items || []).filter(i => i.mealType === 'breakfast')
  const bfTimes = bfItems.map(i => i.time).filter(Boolean)
  const firstBf = bfTimes.length ? [...bfTimes].sort()[0] : (diet.meal_times?.breakfast || null)
  if (!firstBf) return null
  const [dh, dm] = lastDinner.split(':').map(Number)
  const [bh, bm] = firstBf.split(':').map(Number)
  let d = dh * 60 + dm, b = bh * 60 + bm
  if (b <= d) b += 24 * 60
  return Math.round(((b - d) / 60) * 10) / 10
}

export function itemScore(item) {
  const ppp = item.pointsPerPortion || 0
  const p   = item.portions || 1
  const ip  = item.idealPortions
  if (item.category === 'bad' || ppp < 0) return p * ppp
  if (ip && ip > 0) return Math.min(p, ip) * ppp - Math.max(0, p - ip) * ppp * 0.5
  return p * ppp
}

function StatBarSimple({ label, value, max, color }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {Math.round(value)}<span className="text-text-muted font-normal">/{max}</span>
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function scoreColor(s) {
  if (s >= 80) return '#34A853'
  if (s >= 60) return '#FBBC04'
  if (s >= 40) return '#F29900'
  return '#EA4335'
}

function scoreGrade(s) {
  if (s >= 90) return { letter: 'S', label: 'Outstanding' }
  if (s >= 80) return { letter: 'A', label: 'Excellent' }
  if (s >= 70) return { letter: 'B', label: 'Great' }
  if (s >= 60) return { letter: 'C', label: 'Good' }
  if (s >= 40) return { letter: 'D', label: 'Below target' }
  return { letter: 'F', label: 'Needs work' }
}

export function DayComments({ diet, workout, sleep, yesterdayDiet }) {
  const comments = []

  const mt = diet?.meal_times || {}
  if (mt.breakfast) comments.push({ icon: '🌅', label: 'Breakfast', text: `at ${mt.breakfast}` })
  if (mt.lunch)     comments.push({ icon: '☀️', label: 'Lunch',     text: `at ${mt.lunch}` })
  if (mt.dinner)    comments.push({ icon: '🌙', label: 'Dinner',    text: `at ${mt.dinner}` })

  if (diet?.breakfast_notes) comments.push({ icon: '🌅', label: 'Breakfast notes', text: diet.breakfast_notes })
  if (diet?.lunch_notes)     comments.push({ icon: '☀️', label: 'Lunch notes',     text: diet.lunch_notes })
  if (diet?.notes)           comments.push({ icon: '🥗', label: 'Diet notes',      text: diet.notes })

  if (workout) {
    if (workout.exercise_type) comments.push({ icon: '⚡', label: 'Exercise', text: `${workout.exercise_type}${workout.exercise_duration_minutes ? ` — ${workout.exercise_duration_minutes} min` : ''}` })
    if (workout.notes) comments.push({ icon: '💪', label: 'Workout notes', text: workout.notes })
  }
  if (sleep) {
    if (sleep.sleep_time) comments.push({ icon: '🌙', label: 'Fell asleep', text: `at ${sleep.sleep_time}` })
    if (sleep.wake_time)  comments.push({ icon: '🌅', label: 'Woke up',    text: `at ${sleep.wake_time}` })
    if (sleep.sleep_hours > 0) {
      const screenH   = sleep.screen_time_hours || 0
      const effective = Math.max(0, sleep.sleep_hours - screenH)
      comments.push({ icon: '😴', label: 'Total sleep', text: fmtHours(sleep.sleep_hours) })
      if (screenH > 0) {
        comments.push({ icon: '📱', label: 'Screen time', text: `${fmtHours(screenH)} deducted — effective: ${fmtHours(effective)}` })
      }
    }
    const qualityLabel = { 1: 'Terrible', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent' }
    if (sleep.quality) comments.push({ icon: '⭐', label: 'Sleep quality', text: qualityLabel[sleep.quality] || '' })
    if (sleep.notes) comments.push({ icon: '💤', label: 'Sleep notes', text: sleep.notes })
  }

  const fastH = calcFastingHours(diet, yesterdayDiet)
  if (fastH !== null) comments.push({ icon: '⏱', label: 'Fasting window', text: fmtHours(fastH) })

  const mealItems = diet?.meal_items || []
  const mealGroups = ['breakfast', 'lunch', 'dinner', 'snacks']
    .map(t => ({ type: t, items: mealItems.filter(i => i.mealType === t) }))
    .filter(g => g.items.length > 0)

  const hasContent = comments.length > 0 || mealGroups.length > 0

  if (!hasContent) return (
    <p className="text-xs text-text-muted text-center py-2">No notes recorded for this day</p>
  )

  return (
    <div className="space-y-3">
      {comments.map((c, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="shrink-0 mt-0.5">{c.icon}</span>
          <div>
            <span className="text-text-muted font-medium">{c.label}: </span>
            <span className="text-text-secondary">{c.text}</span>
          </div>
        </div>
      ))}

      {mealGroups.length > 0 && (
        <div className="border-t border-surface-border pt-2 space-y-2">
          <p className="text-xs font-semibold text-text-muted">Foods logged</p>
          {mealGroups.map(({ type, items }) => (
            <div key={type}>
              <p className="text-xs font-semibold mb-1 capitalize" style={{ color: MEAL_COLORS[type] }}>
                {type}
              </p>
              {items.map((item, i) => {
                const pts    = Math.round(itemScore(item) * 10) / 10
                const isOver = item.idealPortions && item.portions > item.idealPortions
                return (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-text-secondary truncate">
                        {item.label} ×{item.portions}
                        {isOver && <span className="text-warning ml-1">(over ideal)</span>}
                      </span>
                      {item.time && (
                        <span className="text-text-muted shrink-0">· {item.time}</span>
                      )}
                    </div>
                    <span className={`shrink-0 ml-2 font-semibold ${pts >= 0 ? 'text-success' : 'text-danger'}`}>
                      {pts >= 0 ? '+' : ''}{pts} pts
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Renders the LLM's markdown output (### headings, **bold**, - bullets).
function SummaryMarkdown({ text }) {
  const lines = text.trim().split('\n')
  const boldify = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/)
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p
    )
  }
  return (
    <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return null
        if (line.startsWith('### ')) return (
          <p key={i} className="text-sm font-bold text-text-primary">{boldify(line.slice(4))}</p>
        )
        if (line.startsWith('- ')) return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 mt-0.5">•</span>
            <p>{boldify(line.slice(2))}</p>
          </div>
        )
        return <p key={i}>{boldify(line)}</p>
      })}
    </div>
  )
}

/**
 * Full rich day view: radar + score breakdown + AI health summary.
 * Used on Today and on Progress → Month (selected day).
 */
export function DayDetailPanel({ score, diet, workout, sleep, yesterdayDiet, date }) {
  if (!score) return null

  const cacheKey = `hq_summary_${date || 'unknown'}`

  const [aiConfig, setAiConfig]      = useState(null)
  const [summary, setSummary]        = useState(() => {
    try { return localStorage.getItem(cacheKey) || '' } catch { return '' }
  })
  const [summaryLoading, setLoading] = useState(false)
  const [summaryError, setError]     = useState('')
  const [max, setMax]                = useState(categoryMaxes())

  useEffect(() => {
    getConfig().then(rows => {
      const map = {}
      rows?.forEach?.(r => { map[r.key] = r.value })
      setMax(categoryMaxes(weightsFromConfig(map)))
      if (map.openrouter_api_key || map.groq_api_key) {
        setAiConfig({ openrouter_api_key: map.openrouter_api_key, groq_api_key: map.groq_api_key })
      }
    }).catch(() => {})
  }, [])

  const runSummary = () => {
    if (!aiConfig) return
    setLoading(true)
    setError('')
    generateHealthSummary({ score, diet, workout, sleep, yesterdayDiet }, aiConfig)
      .then(text => {
        setSummary(text)
        try { localStorage.setItem(cacheKey, text) } catch {}
      })
      .catch(e => setError(e.message || 'Failed to generate summary'))
      .finally(() => setLoading(false))
  }

  const hasAi = !!aiConfig

  const total    = Math.round(score.total_score ?? 0)
  const color    = scoreColor(total)
  const grade    = scoreGrade(total)

  const radarData = [
    { subject: 'Diet',    value: Math.round((score.diet_score    / max.diet) * 100), fullMark: 100 },
    { subject: 'Workout', value: Math.round((score.workout_score / max.workout) * 100), fullMark: 100 },
    { subject: 'Sleep',   value: Math.round((score.sleep_score   / max.sleep) * 100), fullMark: 100 },
  ]

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center justify-between bg-surface-elevated rounded-xl px-4 py-3">
        <div>
          <p className="text-3xl font-bold tabular-nums" style={{ color }}>{total}</p>
          <p className="text-xs text-text-muted">out of 100 pts</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color }}>{grade.letter}</div>
          <div className="text-xs text-text-muted">{grade.label}</div>
        </div>
      </div>

      {/* Radar */}
      <div>
        <p className="section-label mb-2">Performance Radar</p>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="rgb(var(--c-surface-border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 11, fontFamily: 'Inter' }}
            />
            <PolarRadiusAxis
              angle={90} domain={[0, 100]}
              tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11 }}
              tickCount={4} axisLine={false}
            />
            <Radar
              dataKey="value" stroke="#1A73E8" fill="#1A73E8" fillOpacity={0.25}
              strokeWidth={2} dot={{ fill: '#1A73E8', r: 3 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score breakdown */}
      <div className="space-y-3">
        <p className="section-label">Score Breakdown</p>
        <StatBarSimple label="Diet"    value={score.diet_score    ?? 0} max={max.diet} color="#34A853" />
        {(score.fasting_score > 0) && (
          <StatBarSimple label="Fasting" value={score.fasting_score} max={max.fasting} color="#f97316" />
        )}
        <StatBarSimple label="Workout" value={score.workout_score ?? 0} max={max.workout} color="#1A73E8" />
        <StatBarSimple label="Sleep"   value={score.sleep_score   ?? 0} max={max.sleep} color="#a78bfa" />
        {(score.bonus_points ?? 0) > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Bonus</span>
            <span className="text-warning font-semibold">+{Math.round(score.bonus_points)} pts</span>
          </div>
        )}
      </div>

      {/* AI Health Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <BrainCircuit size={12} className="text-text-muted" />
            <p className="section-label">Health Summary</p>
          </div>
          {hasAi && !summaryLoading && (summary || summaryError) && (
            <button onClick={runSummary} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
              <RefreshCw size={11} />Regenerate
            </button>
          )}
        </div>
        <div className="bg-surface-elevated rounded-xl p-3">
          {summaryLoading && (
            <div className="flex items-center gap-2 text-xs text-text-muted py-2">
              <Loader2 size={14} className="animate-spin" />
              Generating your health brief…
            </div>
          )}
          {!summaryLoading && summaryError && (
            <div className="space-y-2">
              <p className="text-xs text-danger">{summaryError}</p>
              <button onClick={runSummary} className="text-xs text-brand underline">Try again</button>
            </div>
          )}
          {!summaryLoading && summary && <SummaryMarkdown text={summary} />}
          {!summaryLoading && !summary && !summaryError && !hasAi && (
            <p className="text-xs text-text-muted text-center py-2">
              Add a free API key in <strong>Settings → AI assistant</strong> to enable health coaching summaries
            </p>
          )}
          {!summaryLoading && !summary && !summaryError && hasAi && (
            <button onClick={runSummary}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-brand border border-brand/30 rounded-xl hover:bg-brand/5 active:scale-[0.98] transition-all">
              <BrainCircuit size={15} />
              Generate Health Summary
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
