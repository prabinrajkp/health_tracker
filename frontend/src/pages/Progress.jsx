import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, subDays, parseISO, addWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown, BarChart2, X, Share2, TrendingUp, TrendingDown, Minus as MinusIcon, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Filesystem, Directory } from '@capacitor/filesystem'
import toast from 'react-hot-toast'
import { getMonthlyScores, getDiet, getWorkout, getSleep, getConfig } from '../api/client'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import { DayDetailPanel } from '../components/DayDetail'
import db from '../services/db'
import { getWeekBounds, computeWeeklySummary } from '../services/weeklyInsights'
import { computeMonthlyInsights } from '../services/monthlyInsights'
import { getMealAnalytics } from '../services/localStore'
import { weightsFromConfig, categoryMaxes } from '../services/scoreMeta'

// Deterministic, history-driven meal analytics (see recommendationEngine.js) —
// top foods/templates, diversity, and repetition over the last 30 days.
function MealInsightsCard() {
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    getMealAnalytics(30).then(setAnalytics).catch(() => {})
  }, [])

  if (!analytics || analytics.totalMeals === 0) return null

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🍽️</span>
        <h2 className="text-sm font-semibold text-text-primary flex-1">Meal Insights</h2>
        <span className="text-xs text-text-muted">last 30 days</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="metric-card">
          <p className="metric-value" style={{ color: '#22c55e' }}>{analytics.diversityScore}%</p>
          <p className="metric-label">Diversity</p>
        </div>
        <div className="metric-card">
          <p className="metric-value" style={{ color: '#38bdf8' }}>{analytics.weeklyRepetitionPct}%</p>
          <p className="metric-label">Repeat this wk</p>
        </div>
        <div className="metric-card">
          <p className="metric-value" style={{ color: '#f59e0b' }}>{analytics.avgCalories}</p>
          <p className="metric-label">Avg kcal/meal</p>
        </div>
      </div>

      {analytics.topFoods.length > 0 && (
        <div>
          <p className="section-label mb-1.5">Top Foods</p>
          <div className="flex flex-wrap gap-1.5">
            {analytics.topFoods.slice(0, 6).map(f => (
              <span key={f.label} className="pill-option" style={{ pointerEvents: 'none' }}>{f.label} · {f.count}×</span>
            ))}
          </div>
        </div>
      )}

      {analytics.topTemplates.length > 0 && (
        <div>
          <p className="section-label mb-1.5">Top Meal Templates</p>
          <div className="space-y-1.5">
            {analytics.topTemplates.slice(0, 3).map(t => (
              <div key={t.fingerprint} className="flex items-center justify-between text-xs">
                <span className="text-text-primary truncate flex-1">{t.foodItems.map(i => i.label).join(', ')}</span>
                <span className="text-text-muted shrink-0 ml-2">{t.timesUsed}× logged</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function scoreColor(s) {
  if (!s && s !== 0) return null
  if (s >= 80) return '#34A853'
  if (s >= 60) return '#FBBC04'
  if (s >= 40) return '#F29900'
  return '#EA4335'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isPrev = payload[0]?.payload?.isPrev
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-xs shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{isPrev ? label : `Day ${label}`}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="capitalize">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

const TABS = [['week', 'Week'], ['month', 'Month'], ['trends', 'Trends']]

export default function Progress() {
  // ── Tab state ────────────────────────────────────────────────────────────
  const [searchParams] = useSearchParams()
  const [historyTab, setHistoryTab] = useState(() => {
    const t = searchParams.get('tab')
    return TABS.some(([key]) => key === t) ? t : 'week'
  })
  const [whyOpen, setWhyOpen]           = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [lifetime, setLifetime]         = useState(null)
  const [maxes, setMaxes]               = useState(categoryMaxes())

  const [weights, setWeights]           = useState(null)

  useEffect(() => {
    getConfig().then(rows => {
      const w = weightsFromConfig(rows)
      setWeights(w)
      setMaxes(categoryMaxes(w))
    }).catch(() => {})
  }, [])

  // ── Lifetime stats (Trends) ──────────────────────────────────────────────
  useEffect(() => {
    if (historyTab !== 'trends' || lifetime) return
    Promise.all([
      db.daily_scores.orderBy('date').toArray(),
      db.workout_logs.toArray(),
      db.sleep_logs.toArray(),
    ]).then(([allScores, allWorkout, allSleep]) => {
      const dates = allScores.map(r => r.date)
      let best = dates.length ? 1 : 0, run = 1
      for (let i = 1; i < dates.length; i++) {
        const gap = Math.round((new Date(dates[i] + 'T00:00:00') - new Date(dates[i - 1] + 'T00:00:00')) / 86400000)
        run = gap === 1 ? run + 1 : 1
        if (run > best) best = run
      }
      const goodDays = allScores.filter(r => r.total_score >= 70).length
      setLifetime({
        days:      allScores.length,
        avg:       allScores.length ? Math.round(allScores.reduce((a, r) => a + r.total_score, 0) / allScores.length) : 0,
        steps:     allWorkout.reduce((a, w) => a + (w.steps || 0), 0),
        workouts:  allWorkout.filter(w => w.exercise_done).length,
        sleepH:    Math.round(allSleep.reduce((a, sl) => a + (sl.sleep_hours || 0), 0)),
        topDays:   allScores.filter(r => r.total_score >= 90).length,
        goodPct:   allScores.length >= 7 ? Math.round((goodDays / allScores.length) * 100) : null,
        bestStreak: best,
      })
    }).catch(() => {})
  }, [historyTab])

  // ── Week state ───────────────────────────────────────────────────────────
  const [weekRef, setWeekRef]         = useState(new Date())
  const [weekSummary, setWeekSummary] = useState(null)
  const [weekRange, setWeekRange]     = useState(null)
  const [weekLoading, setWeekLoading] = useState(false)

  // ── Month state ──────────────────────────────────────────────────────────
  const [viewDate, setViewDate] = useState(new Date())
  const [scores, setScores] = useState([])
  const [prevMonthScores, setPrevMonthScores] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayDetail, setDayDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [chartMode, setChartMode] = useState('line')
  const [selectedLine, setSelectedLine] = useState('total')
  const dayDetailRef = useRef(null)

  // ── Monthly insights state ───────────────────────────────────────────────
  const [monthlyInsights, setMonthlyInsights] = useState(null)

  const LINE_METRICS = [
    { key: 'total',   color: '#FBBC04', label: 'Total',   max: 100 },
    { key: 'diet',    color: '#34A853', label: 'Diet',    max: maxes.diet },
    { key: 'workout', color: '#1A73E8', label: 'Workout', max: maxes.workout },
    { key: 'sleep',   color: '#a78bfa', label: 'Sleep',   max: maxes.sleep },
    { key: 'fasting', color: '#f97316', label: 'Fasting', max: maxes.fasting },
    { key: 'steps',   color: '#06b6d4', label: 'Steps',   max: 15000 },
  ]
  const activeLine = LINE_METRICS.find(m => m.key === selectedLine) || LINE_METRICS[0]

  const handleShareDay = async () => {
    if (!dayDetailRef.current || !dayDetail) return
    try {
      const dataUrl = await toPng(dayDetailRef.current, { backgroundColor: '#1e293b', pixelRatio: 2 })
      const base64Data = dataUrl.split(',')[1]
      const fileName = `health-quest-${selectedDate}.png`

      if (typeof navigator.share === 'function') {
        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        const blob = new Blob([byteArray], { type: 'image/png' })
        const file = new File([blob], fileName, { type: 'image/png' })
        const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
        if (canShareFiles) {
          await navigator.share({ title: `Health Quest — ${format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy')}`, files: [file] })
          return
        }
      }

      await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Documents })
      toast.success('Image saved to Documents')
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Could not export image')
    }
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() + 1

  useEffect(() => {
    setLoading(true)
    setSelectedDate(null)
    setDayDetail(null)
    setPrevMonthScores([])
    setMonthlyInsights(null)

    const now = new Date()
    const viewingCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1)
    const prevYear  = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1

    const fetchCurr = getMonthlyScores(year, month)
    const fetchPrev = viewingCurrentMonth ? getMonthlyScores(prevYear, prevMonth) : Promise.resolve([])

    Promise.all([fetchCurr, fetchPrev])
      .then(([curr, prev]) => { setScores(curr); setPrevMonthScores(prev) })
      .finally(() => setLoading(false))
  }, [year, month])

  // ── Monthly insights fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (historyTab !== 'month') return
    const mStart = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
    const mEnd   = format(new Date(year, month, 0), 'yyyy-MM-dd')
    const prevYear  = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    const pmStart = format(new Date(prevYear, prevMonth - 1, 1), 'yyyy-MM-dd')
    const pmEnd   = format(new Date(prevYear, prevMonth, 0), 'yyyy-MM-dd')
    Promise.all([
      db.daily_scores.where('date').between(mStart, mEnd, true, true).toArray(),
      db.diet_logs.where('date').between(mStart, mEnd, true, true).toArray(),
      db.workout_logs.where('date').between(mStart, mEnd, true, true).toArray(),
      db.sleep_logs.where('date').between(mStart, mEnd, true, true).toArray(),
      db.daily_scores.where('date').between(pmStart, pmEnd, true, true).toArray(),
    ]).then(([s, d, w, sl, ps]) => {
      const ins = computeMonthlyInsights({ scores: s, prevScores: ps, dietLogs: d, workoutLogs: w, sleepLogs: sl, year, month })
      setMonthlyInsights(ins)
    }).catch(() => {})
  }, [historyTab, year, month])

  // ── Week data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (historyTab !== 'week') return
    setWeekLoading(true)
    setWhyOpen(false)
    const { start, end } = getWeekBounds(weekRef)
    const prevRef = addWeeks(weekRef, -1)
    const { start: ps, end: pe } = getWeekBounds(prevRef)
    setWeekRange({ start, end })
    Promise.all([
      db.daily_scores.where('date').between(start, end, true, true).toArray(),
      db.diet_logs.where('date').between(start, end, true, true).toArray(),
      db.workout_logs.where('date').between(start, end, true, true).toArray(),
      db.sleep_logs.where('date').between(start, end, true, true).toArray(),
      db.daily_scores.where('date').between(ps, pe, true, true).toArray(),
      db.diet_logs.where('date').between(ps, pe, true, true).toArray(),
      db.workout_logs.where('date').between(ps, pe, true, true).toArray(),
      db.sleep_logs.where('date').between(ps, pe, true, true).toArray(),
    ]).then(([scores, diet, workout, sleep, pScores, pDiet, pWorkout, pSleep]) => {
      setWeekSummary(computeWeeklySummary({
        scores, dietLogs: diet, workoutLogs: workout, sleepLogs: sleep,
        prevScores: pScores, prevDietLogs: pDiet, prevWorkoutLogs: pWorkout, prevSleepLogs: pSleep,
        weights,
      }))
    }).finally(() => setWeekLoading(false))
  }, [historyTab, weekRef, weights])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const pastScores = scores.filter(s => s.date <= todayStr)

  const scoreMap = {}
  pastScores.forEach(s => { scoreMap[s.date] = s })

  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const firstDay = startOfMonth(viewDate).getDay()

  const now2 = new Date()
  const isCurrentMonth = year === now2.getFullYear() && month === (now2.getMonth() + 1)

  const toChartEntry = (s, isPrev) => ({
    label:   isPrev ? format(parseISO(s.date), 'MMM d') : format(parseISO(s.date), 'd'),
    isPrev,
    total:   Math.round(s.total_score),
    diet:    Math.round(s.diet_score),
    workout: Math.round(s.workout_score),
    sleep:   Math.round(s.sleep_score),
    fasting: Math.round(s.fasting_score || 0),
    steps:   s.steps || 0,
  })

  const prevTail = isCurrentMonth
    ? prevMonthScores.filter(s => s.date <= todayStr).slice(-7).map(s => toChartEntry(s, true))
    : []

  const currChartData = pastScores.map(s => toChartEntry(s, false))
  const chartData     = [...prevTail, ...currChartData]

  const monthBoundaryLabel = currChartData.length > 0 ? currChartData[0].label : null

  const avg    = pastScores.length ? Math.round(pastScores.reduce((a, s) => a + s.total_score, 0) / pastScores.length) : 0
  const best   = pastScores.length ? Math.round(Math.max(...pastScores.map(s => s.total_score))) : 0
  const logged = pastScores.length

  const handleDayClick = async (dateKey) => {
    const s = scoreMap[dateKey]
    if (!s) return

    if (selectedDate === dateKey) {
      setSelectedDate(null)
      setDayDetail(null)
      return
    }

    setSelectedDate(dateKey)
    setDayDetail(null)
    setDetailLoading(true)
    try {
      const prevDay = format(subDays(parseISO(dateKey), 1), 'yyyy-MM-dd')
      const [diet, workout, sleep, yesterdayDiet] = await Promise.all([
        getDiet(dateKey).catch(() => null),
        getWorkout(dateKey).catch(() => null),
        getSleep(dateKey).catch(() => null),
        getDiet(prevDay).catch(() => null),
      ])
      setDayDetail({ score: s, diet, workout, sleep, yesterdayDiet })
    } finally {
      setDetailLoading(false)
    }
  }

  const TrendBadge = ({ trend }) => {
    if (trend === null) return null
    if (trend > 0)  return <span className="flex items-center gap-1 text-xs font-semibold text-success"><TrendingUp size={12} />+{trend} vs last week</span>
    if (trend < 0)  return <span className="flex items-center gap-1 text-xs font-semibold text-danger"><TrendingDown size={12} />{trend} vs last week</span>
    return <span className="flex items-center gap-1 text-xs font-semibold text-text-muted"><MinusIcon size={12} />Same as last week</span>
  }

  const monthNav = (
    <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-2xl px-4 py-3">
      <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Previous month"
        className="p-1.5 rounded-lg text-text-muted">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-semibold text-text-primary">{format(viewDate, 'MMMM yyyy')}</span>
      <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Next month"
        disabled={isCurrentMonth} className="p-1.5 rounded-lg text-text-muted disabled:opacity-30">
        <ChevronRight size={16} />
      </button>
    </div>
  )

  const fmtSteps = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <div className="p-2 bg-warning/10 rounded-xl border border-warning/20">
          <BarChart2 size={16} className="text-warning" />
        </div>
        <h1 className="text-base font-semibold text-text-primary">Progress</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-2 pb-0">
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setHistoryTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${historyTab === key ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── WEEK ── */}
      {historyTab === 'week' && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-2xl px-4 py-3">
            <button onClick={() => setWeekRef(d => addWeeks(d, -1))} aria-label="Previous week" className="p-1.5 rounded-lg text-text-muted">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-text-primary">
              {weekRange ? `${format(new Date(weekRange.start + 'T00:00:00'), 'MMM d')} – ${format(new Date(weekRange.end + 'T00:00:00'), 'MMM d, yyyy')}` : '…'}
            </p>
            <button onClick={() => setWeekRef(d => addWeeks(d, 1))} aria-label="Next week"
              disabled={weekRange && weekRange.end >= format(new Date(), 'yyyy-MM-dd')}
              className="p-1.5 rounded-lg text-text-muted disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          {weekLoading && <div className="text-center py-12 text-text-muted text-sm">Looking at your week…</div>}

          {!weekLoading && !weekSummary && (
            <div className="card text-center py-10 space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-sm font-semibold text-text-primary">Nothing logged this week</p>
              <p className="text-xs text-text-muted">Log at least one day to see your weekly summary</p>
            </div>
          )}

          {!weekLoading && weekSummary && (() => {
            const s = weekSummary
            const wins  = whyOpen ? s.wins   : s.wins.slice(0, 2)
            const costs = whyOpen ? s.damage : s.damage.slice(0, 2)
            const hasMore = s.wins.length > 2 || s.damage.length > 2 || s.stackedFailures.length > 0
              || s.topJunk.length > 0 || (s.bestDay && s.worstDay)
            return (
              <>
                {/* ── Score ── */}
                <div className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="section-label">Average score</p>
                      <div className="flex items-end gap-3 mt-2">
                        <p className="text-5xl font-bold tabular-nums" style={{ color: s.grade.color }}>{s.avgScore}</p>
                        <div className="pb-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ color: s.grade.color, background: `${s.grade.color}18` }}>
                            {s.grade.letter} · {s.grade.label}
                          </div>
                          <div className="mt-1.5"><TrendBadge trend={s.trend} /></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-text-muted">Days logged</p>
                      <p className="text-2xl font-bold tabular-nums text-text-primary">{s.daysLogged}<span className="text-sm text-text-muted font-normal">/7</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[
                      { label: 'Avg steps', value: s.metrics.avgSteps >= 1000 ? `${(s.metrics.avgSteps / 1000).toFixed(1)}k` : String(s.metrics.avgSteps) },
                      { label: 'Avg sleep', value: `${s.metrics.avgSleep}h` },
                      { label: 'Workouts',  value: String(s.metrics.workoutSessions) },
                      { label: 'Late dinners', value: String(s.metrics.lateDinnerDays) },
                    ].map(m => (
                      <div key={m.label} className="bg-surface-elevated rounded-xl p-2.5 text-center">
                        <p className="text-base font-bold tabular-nums text-text-primary">{m.value}</p>
                        <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── What to fix ── */}
                <div className="card border-2" style={{ borderColor: '#a78bfa40', background: '#a78bfa08' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-brand" />
                    <h2 className="text-sm font-semibold text-text-primary">What to fix</h2>
                    <span className="text-xs text-text-muted ml-auto">Highest impact</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary leading-relaxed">{s.strategicFix}</p>
                </div>

                {/* ── Why ── */}
                {(s.wins.length > 0 || s.damage.length > 0) && (
                  <div className="card space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Why</h2>

                    {wins.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{w.text}</p>
                          <p className="text-xs text-text-muted">{w.detail}</p>
                        </div>
                      </div>
                    ))}
                    {costs.map((d, i) => (
                      <div key={`c${i}`} className="flex items-start gap-2.5">
                        <XCircle size={15} className="text-danger shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{d.text}</p>
                          <p className="text-xs text-text-muted">{d.detail}</p>
                        </div>
                      </div>
                    ))}

                    {whyOpen && (
                      <div className="space-y-3 pt-3 border-t border-surface-border">
                        {s.stackedFailures.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-warning">Two things went wrong on the same day</p>
                            {s.stackedFailures.map((f, i) => (
                              <p key={i} className="text-xs text-text-muted mt-0.5">{format(new Date(f.date + 'T00:00:00'), 'EEE MMM d')}: {f.label}</p>
                            ))}
                          </div>
                        )}
                        {s.bestDay && s.worstDay && (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Best day', day: s.bestDay, color: '#22c55e' },
                              { label: 'Hardest day', day: s.worstDay, color: '#f97316' },
                            ].map(({ label, day, color }) => (
                              <div key={label} className="bg-surface-elevated rounded-xl p-3 text-center">
                                <p className="text-xs text-text-muted">{label}</p>
                                <p className="text-xl font-bold tabular-nums" style={{ color }}>{Math.round(day.total_score)}</p>
                                <p className="text-xs text-text-secondary">{format(new Date(day.date + 'T00:00:00'), 'EEE, MMM d')}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.topJunk.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-text-secondary">Most frequent junk foods</p>
                            {s.topJunk.map(({ label, count }) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">{label}</span>
                                <span className="text-xs font-semibold text-danger">×{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {hasMore && (
                      <button onClick={() => setWhyOpen(o => !o)}
                        className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-brand-light pt-1">
                        {whyOpen ? 'Show less' : 'Show more'}
                        <ChevronDown size={13} className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── MONTH ── */}
      {historyTab === 'month' && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {monthNav}

          {/* Calendar */}
          <div className="card">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              Calendar <span className="text-text-muted font-normal text-xs ml-1">— tap a day to see details</span>
            </h2>
            {loading ? (
              <div className="text-center py-8 text-text-muted text-sm">Loading…</div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-2">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-medium text-text-muted py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(day => {
                    const key = format(day, 'yyyy-MM-dd')
                    const s = scoreMap[key]
                    const color = s ? scoreColor(s.total_score) : null
                    const isSelected = selectedDate === key
                    const hasData = !!s
                    const isBestDay = monthlyInsights?.bestDate === key
                    const isExerciseDay = !isBestDay && !!monthlyInsights?.workoutMap[key]?.exercise_done

                    return (
                      <div
                        key={key}
                        onClick={() => handleDayClick(key)}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-center transition-all duration-150
                          ${hasData ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}
                          ${isSelected ? 'ring-2 ring-brand scale-95' : ''}
                          ${isToday(day) && !isSelected ? 'ring-2 ring-brand/60 ring-offset-1 ring-offset-surface-card' : ''}`}
                        style={{ background: color ? `${color}${s.total_score >= 80 ? '35' : '20'}` : 'rgb(var(--c-surface-elevated))' }}
                      >
                        <span className="text-[11px] font-medium text-text-secondary">{format(day, 'd')}</span>
                        {isBestDay ? (
                          <span className="text-[11px] leading-none">🏆</span>
                        ) : isExerciseDay ? (
                          <span className="text-[11px] leading-none">⚡</span>
                        ) : color ? (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {[['#34A853', '80+'], ['#FBBC04', '60+'], ['#F29900', '40+'], ['#EA4335', '<40']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                      <span className="text-xs text-text-muted">{l} pts</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 text-xs text-text-muted">🏆 best</div>
                  <div className="flex items-center gap-1 text-xs text-text-muted">⚡ exercise</div>
                </div>
              </>
            )}
          </div>

          {/* Day detail panel */}
          {selectedDate && (
            <div className="card animate-slide-up space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">
                  {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy')}
                </h2>
                <div className="flex gap-1">
                  {dayDetail && (
                    <button onClick={handleShareDay}
                      className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
                      title="Export as image">
                      <Share2 size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedDate(null); setDayDetail(null) }}
                    className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {detailLoading && (
                <div className="text-center py-6 text-text-muted text-sm">Loading…</div>
              )}

              {dayDetail && !detailLoading && (
                <div ref={dayDetailRef}>
                  <DayDetailPanel
                    score={dayDetail.score}
                    diet={dayDetail.diet}
                    workout={dayDetail.workout}
                    sleep={dayDetail.sleep}
                    yesterdayDiet={dayDetail.yesterdayDiet}
                    date={selectedDate}
                  />
                </div>
              )}
            </div>
          )}


          {/* ── Summary ── */}
          {monthlyInsights ? (
            <div className="card">
              <div className="flex items-end justify-between">
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-bold tabular-nums leading-none" style={{ color: monthlyInsights.grade.color }}>{monthlyInsights.avgScore}</p>
                  <div className="pb-0.5">
                    <p className="text-sm font-bold" style={{ color: monthlyInsights.grade.color }}>{monthlyInsights.grade.letter} · {monthlyInsights.grade.label}</p>
                    <p className="text-xs text-text-muted">average score</p>
                  </div>
                </div>
                {monthlyInsights.trend !== null && (
                  <span className={`flex items-center gap-1 text-xs font-semibold ${monthlyInsights.trend >= 0 ? 'text-success' : 'text-danger'}`}>
                    {monthlyInsights.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {monthlyInsights.trend >= 0 ? '+' : ''}{monthlyInsights.trend} vs last month
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">{monthlyInsights.narrative}</p>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Days', value: monthlyInsights.daysLogged },
                  { label: 'Avg sleep', value: `${monthlyInsights.stats.avgSleep}h` },
                  { label: 'Workouts', value: monthlyInsights.stats.workoutSessions },
                  { label: 'Junk days', value: monthlyInsights.stats.junkFoodDays },
                ].map(m => (
                  <div key={m.label} className="bg-surface-elevated rounded-xl p-2.5 text-center">
                    <p className="text-base font-bold text-text-primary tabular-nums">{m.value}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Avg score', value: avg },
                { label: 'Best day',  value: best },
                { label: 'Days logged', value: logged },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <p className="metric-value">{m.value}</p>
                  <p className="metric-label">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Month insights (collapsed) ── */}
          {monthlyInsights && (monthlyInsights.storyArc?.length > 0 || monthlyInsights.trajectory
            || monthlyInsights.positives.length > 0 || monthlyInsights.risks.length > 0 || monthlyInsights.nearMiss?.length > 0) && (
            <div className="card">
              <button onClick={() => setInsightsOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
                <span className="text-sm font-semibold text-text-primary flex-1">Month insights</span>
                <span className="text-xs text-text-muted">Week by week, what helped, what hurt</span>
                <ChevronDown size={15} className={`text-text-muted transition-transform ${insightsOpen ? 'rotate-180' : ''}`} />
              </button>

              {insightsOpen && (
                <div className="space-y-5 mt-4 pt-4 border-t border-surface-border">
                  {monthlyInsights.storyArc?.length > 0 && (
                    <div className="space-y-2">
                      <p className="section-label">Week by week</p>
                      {monthlyInsights.storyArc.map(w => (
                        <div key={w.week} className="flex items-center gap-3 bg-surface-elevated rounded-xl px-3 py-2.5">
                          <span className="text-xl shrink-0">{w.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">{w.theme}</p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {format(new Date(w.wsStr + 'T00:00:00'), 'MMM d')}–{format(new Date(w.weStr + 'T00:00:00'), 'MMM d')} · {w.note}
                            </p>
                          </div>
                          <p className="text-sm font-bold tabular-nums shrink-0" style={{ color: scoreColor(w.avg) }}>{w.avg}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {monthlyInsights.trajectory && (() => {
                    const t = monthlyInsights.trajectory
                    const up = t.halfTrend >= 0
                    return (
                      <div>
                        <p className="section-label mb-2">Direction</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[['First half', t.firstAvg], ['Second half', t.secondAvg], ['Next month (est.)', t.projected]].map(([label, value], i) => (
                            <div key={label} className="bg-surface-elevated rounded-xl p-2.5">
                              <p className="text-xl font-bold tabular-nums" style={{ color: i === 2 ? (up ? '#22c55e' : '#f97316') : 'rgb(var(--c-text-primary))' }}>{value}</p>
                              <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {monthlyInsights.positives.length > 0 && (
                    <div className="space-y-2">
                      <p className="section-label">What helped</p>
                      {monthlyInsights.positives.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-sm shrink-0 mt-0.5">{p.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary leading-snug">{p.text}</p>
                            <p className="text-xs text-text-muted mt-0.5 leading-snug">{p.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {monthlyInsights.risks.length > 0 && (
                    <div className="space-y-2">
                      <p className="section-label">What cost you points</p>
                      {monthlyInsights.risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-sm shrink-0 mt-0.5">{r.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary leading-snug">{r.text}</p>
                            <p className="text-xs text-text-muted mt-0.5 leading-snug">{r.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {monthlyInsights.nearMiss?.length > 0 && (
                    <div>
                      <p className="section-label mb-2">Almost there</p>
                      <div className="flex gap-2 flex-wrap">
                        {monthlyInsights.nearMiss.map((m, i) => (
                          <span key={i} className="bg-warning/10 border border-warning/25 rounded-full px-3 py-1.5 text-xs font-medium text-warning">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TRENDS ── */}
      {historyTab === 'trends' && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {monthNav}

          {/* Score chart for the viewed month */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary">Scores this month</h2>
                <div className="flex gap-0.5 bg-surface-elevated rounded-lg p-0.5">
                  <button
                    onClick={() => setChartMode('line')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === 'line' ? 'bg-surface-card text-text-primary' : 'text-text-muted'}`}
                  >Line</button>
                  <button
                    onClick={() => setChartMode('bar')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === 'bar' ? 'bg-surface-card text-text-primary' : 'text-text-muted'}`}
                  >Stacked</button>
                </div>
              </div>

              {chartMode === 'line' && (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {LINE_METRICS.map(({ key, color, label }) => (
                    <button key={key} onClick={() => setSelectedLine(key)}
                      className="py-1.5 rounded-xl border-2 text-xs font-semibold transition-all"
                      style={{
                        borderColor: selectedLine === key ? color : 'rgb(var(--c-surface-border))',
                        color: selectedLine === key ? color : 'rgb(var(--c-text-muted))',
                        background: selectedLine === key ? `${color}15` : 'transparent',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {chartMode === 'bar' && (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(var(--c-surface-elevated))' }} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--c-text-muted))' }} />
                    )}
                    <Bar dataKey="diet" stackId="a" fill="#34A853" radius={[0,0,0,0]}>
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                    <Bar dataKey="workout" stackId="a" fill="#1A73E8">
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                    <Bar dataKey="sleep" stackId="a" fill="#a78bfa" radius={[3,3,0,0]}>
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartMode === 'line' && (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-surface-border))" vertical={false} />
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis
                      domain={[0, activeLine.max]}
                      tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 11, fontFamily: 'Inter' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 11, fill: 'rgb(var(--c-text-muted))' }} />
                    )}
                    <Line
                      dataKey={selectedLine}
                      stroke={activeLine.color}
                      strokeWidth={2}
                      dot={({ cx, cy, payload }) => (
                        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3}
                          fill={activeLine.color} fillOpacity={payload.isPrev ? 0.4 : 1}
                          stroke="none" />
                      )}
                      activeDot={{ r: 5 }}
                      type="monotone"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              <div className="flex gap-3 mt-3 flex-wrap items-center">
                {chartMode === 'bar' ? (
                  [['#34A853', 'Diet'], ['#1A73E8', 'Workout'], ['#a78bfa', 'Sleep']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                      <span className="text-xs text-text-muted">{l}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: activeLine.color }} />
                    <span className="text-xs text-text-muted">{activeLine.label}</span>
                    <span className="text-xs text-text-muted">{activeLine.key === 'steps' ? 'per day' : `/ ${activeLine.max} pts`}</span>
                  </div>
                )}
                {prevTail.length > 0 && (
                  <span className="text-xs text-text-muted ml-auto opacity-60">Faded = prev month</span>
                )}
              </div>
            </div>
          )}

          {chartData.length === 0 && !loading && (
            <div className="card text-center py-8">
              <p className="text-sm text-text-secondary">No scores in this month yet</p>
            </div>
          )}

          {/* Meal Insights — deterministic, history-driven (see recommendationEngine.js) */}
          <MealInsightsCard />

          {lifetime && lifetime.days > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-text-primary mb-3">All time</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Days logged', lifetime.days],
                  ['Average score', lifetime.avg],
                  ['Total steps', fmtSteps(lifetime.steps)],
                  ['Exercise sessions', lifetime.workouts],
                  ['Hours slept', `${lifetime.sleepH}h`],
                  ['Days at 90+', lifetime.topDays],
                  ['Longest logging run', `${lifetime.bestStreak} days`],
                  ...(lifetime.goodPct !== null ? [['Days at 70+', `${lifetime.goodPct}%`]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="bg-surface-elevated rounded-xl px-3 py-2.5">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="text-lg font-bold tabular-nums text-text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
