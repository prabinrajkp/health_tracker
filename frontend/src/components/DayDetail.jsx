/**
 * Shared day-detail sub-components used by both Today and Progress (any day).
 */
import { useEffect, useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { getConfig } from '../api/client'
import { generateHealthSummary } from '../services/llmApi'
import { weightsFromConfig, categoryMaxes, gradeFor, CATEGORY_COLORS } from '../services/scoreMeta'
import { col } from '../services/theme'

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
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
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
  const grade    = gradeFor(total)

  const radarData = [
    { subject: 'Diet',    value: Math.round((score.diet_score    / max.diet) * 100), fullMark: 100 },
    { subject: 'Workout', value: Math.round((score.workout_score / max.workout) * 100), fullMark: 100 },
    { subject: 'Sleep',   value: Math.round((score.sleep_score   / max.sleep) * 100), fullMark: 100 },
  ]

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-end justify-between">
        <p className="flex items-baseline gap-1.5">
          <span className="t-number">{total}</span>
          <span className="text-sm text-text-muted">/ 100</span>
        </p>
        <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ color: grade.color, background: grade.bg }}>
          {grade.letter} · {grade.label}
        </span>
      </div>

      {/* Radar */}
      <div>
        <p className="section-label mb-2">Balance</p>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="rgb(var(--c-surface-border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'rgb(var(--c-text-secondary))', fontSize: 11, fontFamily: 'Inter Variable' }}
            />
            <PolarRadiusAxis
              angle={90} domain={[0, 100]}
              tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11 }}
              tickCount={4} axisLine={false}
            />
            <Radar
              dataKey="value" stroke={col('brand')} fill={col('brand')} fillOpacity={0.25}
              strokeWidth={2} dot={{ fill: col('brand'), r: 3 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score breakdown */}
      <div className="space-y-3">
        <p className="section-label">Score breakdown</p>
        <StatBarSimple label="Diet"    value={score.diet_score    ?? 0} max={max.diet} color={CATEGORY_COLORS.diet} />
        {(score.fasting_score > 0) && (
          <StatBarSimple label="Fasting" value={score.fasting_score} max={max.fasting} color={CATEGORY_COLORS.fasting} />
        )}
        <StatBarSimple label="Workout" value={score.workout_score ?? 0} max={max.workout} color={CATEGORY_COLORS.workout} />
        <StatBarSimple label="Sleep"   value={score.sleep_score   ?? 0} max={max.sleep} color={CATEGORY_COLORS.sleep} />
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
            <Sparkles size={12} className="text-text-muted" />
            <p className="section-label">Health summary</p>
          </div>
          {hasAi && !summaryLoading && (summary || summaryError) && (
            <button onClick={runSummary} className="flex items-center gap-1 text-xs text-text-muted">
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
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-brand border border-brand/30 rounded-xl active:opacity-70 transition-all">
              <Sparkles size={15} />
              Generate health summary
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
