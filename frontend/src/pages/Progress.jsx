import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, subDays, parseISO, addWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown, X, Share2, TrendingUp, TrendingDown, Minus as MinusIcon, CheckCircle2, XCircle, Trophy, Dumbbell } from 'lucide-react'
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
import { weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../services/scoreMeta'
import { col, scoreColor } from '../services/theme'

// Deterministic, history-driven meal analytics (see recommendationEngine.js) —
// top foods/templates, diversity, and repetition over the last 30 days.
function MealInsightsCard() {
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    getMealAnalytics(30).then(setAnalytics).catch(() => {})
  }, [])

  if (!analytics || analytics.totalMeals === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="t-heading">Meals</h2>
        <span className="text-sm text-text-muted">Last 30 days</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="metric-card">
          <p className="metric-value">{analytics.diversityScore}%</p>
          <p className="metric-label">Variety</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{analytics.weeklyRepetitionPct}%</p>
          <p className="metric-label">Repeats this week</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{analytics.avgCalories}</p>
          <p className="metric-label">Avg kcal a meal</p>
        </div>
      </div>

      {analytics.topFoods.length > 0 && (
        <div>
          <p className="section-label mb-2">Most eaten</p>
          <div className="flex flex-wrap gap-1.5">
            {analytics.topFoods.slice(0, 6).map(f => (
              <span key={f.label} className="pill-option" style={{ pointerEvents: 'none' }}>{f.label} · {f.count}×</span>
            ))}
          </div>
        </div>
      )}

      {analytics.topTemplates.length > 0 && (
        <div>
          <p className="section-label mb-2">Most repeated meals</p>
          <div className="space-y-1.5">
            {analytics.topTemplates.slice(0, 3).map(t => (
              <div key={t.fingerprint} className="flex items-center justify-between text-sm">
                <span className="text-text-primary truncate flex-1">{t.foodItems.map(i => i.label).join(', ')}</span>
                <span className="text-text-muted shrink-0 ml-2">{t.timesUsed}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isPrev = payload[0]?.payload?.isPrev
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-sm">
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
    { key: 'total',   color: col('brand'),            label: 'Total',   max: 100 },
    { key: 'diet',    color: CATEGORY_COLORS.diet,    label: 'Diet',    max: maxes.diet },
    { key: 'workout', color: CATEGORY_COLORS.workout, label: 'Workout', max: maxes.workout },
    { key: 'sleep',   color: CATEGORY_COLORS.sleep,   label: 'Sleep',   max: maxes.sleep },
    { key: 'fasting', color: CATEGORY_COLORS.fasting, label: 'Fasting', max: maxes.fasting },
    { key: 'steps',   color: col('text-secondary'),   label: 'Steps',   max: 15000 },
  ]
  const activeLine = LINE_METRICS.find(m => m.key === selectedLine) || LINE_METRICS[0]

  const handleShareDay = async () => {
    if (!dayDetailRef.current || !dayDetail) return
    try {
      // Exported on the current theme's card colour, with a little margin
      const cardBg = `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--c-surface-card').trim().replace(/ /g, ', ')})`
      const dataUrl = await toPng(dayDetailRef.current, { backgroundColor: cardBg, pixelRatio: 2, style: { padding: '16px' } })
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
    if (trend > 0)  return <span className="flex items-center gap-1 text-sm font-semibold text-success"><TrendingUp size={14} />+{trend} vs last week</span>
    if (trend < 0)  return <span className="flex items-center gap-1 text-sm font-semibold text-danger"><TrendingDown size={14} />{trend} vs last week</span>
    return <span className="flex items-center gap-1 text-sm font-semibold text-text-muted"><MinusIcon size={14} />Same as last week</span>
  }

  const monthNav = (
    <div className="flex items-center justify-between">
      <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Previous month"
        className="icon-btn">
        <ChevronLeft size={18} />
      </button>
      <span className="t-heading">{format(viewDate, 'MMMM yyyy')}</span>
      <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Next month"
        disabled={isCurrentMonth} className="icon-btn disabled:opacity-30">
        <ChevronRight size={18} />
      </button>
    </div>
  )

  const fmtSteps = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)

  return (
    <div className="min-h-screen bg-surface-base pb-nav animate-fade-in">
      <div className="page-header">
        <h1 className="t-title">Progress</h1>
      </div>

      <div className="max-w-lg mx-auto px-4">
        <div className="flex gap-1 bg-surface-elevated rounded-full p-1">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setHistoryTab(key)}
              className={`flex-1 py-2 rounded-full text-sm transition-colors ${historyTab === key ? 'bg-surface-card text-text-primary font-semibold' : 'text-text-secondary font-medium'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── WEEK ── */}
      {historyTab === 'week' && (
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-6">

          <div className="flex items-center justify-between">
            <button onClick={() => setWeekRef(d => addWeeks(d, -1))} aria-label="Previous week" className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <p className="t-heading">
              {weekRange ? `${format(new Date(weekRange.start + 'T00:00:00'), 'MMM d')} – ${format(new Date(weekRange.end + 'T00:00:00'), 'MMM d, yyyy')}` : '…'}
            </p>
            <button onClick={() => setWeekRef(d => addWeeks(d, 1))} aria-label="Next week"
              disabled={weekRange && weekRange.end >= format(new Date(), 'yyyy-MM-dd')}
              className="icon-btn disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>

          {weekLoading && <div className="text-center py-12 text-text-muted text-sm">Looking at your week…</div>}

          {!weekLoading && !weekSummary && (
            <div className="text-center py-12">
              <p className="t-heading">Nothing logged this week</p>
              <p className="text-sm text-text-secondary mt-1">Log at least one day to see your weekly summary.</p>
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
                {/* ── Score: the hero ── */}
                <section>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="flex items-baseline gap-1.5">
                        <span className="t-display">{s.avgScore}</span>
                        <span className="text-base text-text-muted">average</span>
                      </p>
                      <div className="mt-2"><TrendBadge trend={s.trend} /></div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ color: s.grade.color, background: s.grade.bg }}>
                      {s.grade.letter} · {s.grade.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[
                      { label: 'Days logged', value: `${s.daysLogged}/7` },
                      { label: 'Avg steps', value: s.metrics.avgSteps >= 1000 ? `${(s.metrics.avgSteps / 1000).toFixed(1)}k` : String(s.metrics.avgSteps) },
                      { label: 'Avg sleep', value: `${s.metrics.avgSleep}h` },
                      { label: 'Workouts',  value: String(s.metrics.workoutSessions) },
                    ].map(m => (
                      <div key={m.label} className="tile">
                        <p className="text-base font-semibold tabular-nums text-text-primary">{m.value}</p>
                        <p className="t-caption leading-tight">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── What to fix ── */}
                <section className="card">
                  <p className="text-xs font-semibold text-brand-light mb-1">What to fix this week</p>
                  <p className="text-base text-text-primary leading-relaxed">{s.strategicFix}</p>
                </section>

                {/* ── Why ── */}
                {(s.wins.length > 0 || s.damage.length > 0) && (
                  <section className="space-y-3">
                    <h2 className="t-heading">Why</h2>

                    {wins.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-2.5">
                        <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="text-base text-text-primary">{w.text}</p>
                          <p className="text-sm text-text-secondary">{w.detail}</p>
                        </div>
                      </div>
                    ))}
                    {costs.map((d, i) => (
                      <div key={`c${i}`} className="flex items-start gap-2.5">
                        <XCircle size={18} className="text-danger shrink-0 mt-0.5" />
                        <div>
                          <p className="text-base text-text-primary">{d.text}</p>
                          <p className="text-sm text-text-secondary">{d.detail}</p>
                        </div>
                      </div>
                    ))}

                    {whyOpen && (
                      <div className="space-y-3 pt-3 border-t border-surface-border">
                        {s.stackedFailures.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-text-primary">Two things went wrong on the same day</p>
                            {s.stackedFailures.map((f, i) => (
                              <p key={i} className="text-sm text-text-secondary mt-0.5">{format(new Date(f.date + 'T00:00:00'), 'EEE MMM d')}: {f.label}</p>
                            ))}
                          </div>
                        )}
                        {s.bestDay && s.worstDay && (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Best day', day: s.bestDay },
                              { label: 'Hardest day', day: s.worstDay },
                            ].map(({ label, day }) => (
                              <div key={label} className="tile">
                                <p className="t-caption">{label}</p>
                                <p className="text-xl font-semibold tabular-nums text-text-primary">{Math.round(day.total_score)}</p>
                                <p className="text-sm text-text-secondary">{format(new Date(day.date + 'T00:00:00'), 'EEE, MMM d')}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.topJunk.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold text-text-primary">Most frequent junk foods</p>
                            {s.topJunk.map(({ label, count }) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">{label}</span>
                                <span className="text-sm font-semibold text-danger tabular-nums">×{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {hasMore && (
                      <button onClick={() => setWhyOpen(o => !o)}
                        className="flex items-center gap-1 text-sm font-semibold text-brand-light py-1">
                        {whyOpen ? 'Show less' : 'Show more'}
                        <ChevronDown size={15} className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </section>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── MONTH ── */}
      {historyTab === 'month' && (
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-6">
          {monthNav}

          {/* Calendar — each logged day is a dot in its score colour */}
          <section>
            {loading ? (
              <div className="text-center py-8 text-text-muted text-sm">Loading…</div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-center text-xs text-text-muted py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(day => {
                    const key = format(day, 'yyyy-MM-dd')
                    const s = scoreMap[key]
                    const isSelected = selectedDate === key
                    const isBestDay = monthlyInsights?.bestDate === key
                    const isExerciseDay = !!monthlyInsights?.workoutMap[key]?.exercise_done
                    return (
                      <button key={key} onClick={() => handleDayClick(key)} disabled={!s}
                        aria-label={`${format(day, 'MMMM d')}${s ? `, score ${Math.round(s.total_score)}` : ', nothing logged'}`}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-colors
                          ${isSelected ? 'bg-brand/15' : s ? 'bg-surface-card' : ''}
                          ${isToday(day) ? 'ring-1 ring-brand' : ''}`}>
                        <span className={`text-sm tabular-nums leading-none ${s ? 'text-text-primary' : 'text-text-muted'} ${isToday(day) ? 'font-semibold' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        <span className="h-3 flex items-center">
                          {isBestDay ? <Trophy size={12} style={{ color: scoreColor(s.total_score) }} />
                            : s && isExerciseDay ? <Dumbbell size={12} style={{ color: scoreColor(s.total_score) }} />
                            : s ? <span className="w-2 h-2 rounded-full" style={{ background: scoreColor(s.total_score) }} />
                            : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 mt-3 flex-wrap text-xs text-text-muted">
                  {[[90, '80+'], [70, '60–79'], [50, '40–59'], [10, 'Under 40']].map(([v, l]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: scoreColor(v) }} />{l}
                    </span>
                  ))}
                  <span className="flex items-center gap-1"><Trophy size={12} />Best</span>
                  <span className="flex items-center gap-1"><Dumbbell size={12} />Exercise</span>
                </div>
              </>
            )}
          </section>

          {/* Day detail panel */}
          {selectedDate && (
            <div className="card animate-slide-up space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="t-heading">
                  {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy')}
                </h2>
                <div className="flex gap-1">
                  {dayDetail && (
                    <button onClick={handleShareDay}
                      className="icon-btn" aria-label="Share as image">
                      <Share2 size={17} />
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedDate(null); setDayDetail(null) }}
                    className="icon-btn" aria-label="Close">
                    <X size={17} />
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
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="t-number">{monthlyInsights.avgScore}</span>
                    <span className="text-sm text-text-muted">average</span>
                  </p>
                  {monthlyInsights.trend !== null && (
                    <span className={`flex items-center gap-1 text-sm font-semibold mt-1.5 ${monthlyInsights.trend >= 0 ? 'text-success' : 'text-danger'}`}>
                      {monthlyInsights.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {monthlyInsights.trend >= 0 ? '+' : ''}{monthlyInsights.trend} vs last month
                    </span>
                  )}
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ color: monthlyInsights.grade.color, background: monthlyInsights.grade.bg }}>
                  {monthlyInsights.grade.letter} · {monthlyInsights.grade.label}
                </span>
              </div>
              <p className="text-base text-text-secondary leading-relaxed mt-3">{monthlyInsights.narrative}</p>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Days', value: monthlyInsights.daysLogged },
                  { label: 'Avg sleep', value: `${monthlyInsights.stats.avgSleep}h` },
                  { label: 'Workouts', value: monthlyInsights.stats.workoutSessions },
                  { label: 'Junk days', value: monthlyInsights.stats.junkFoodDays },
                ].map(m => (
                  <div key={m.label} className="tile">
                    <p className="text-base font-semibold text-text-primary tabular-nums">{m.value}</p>
                    <p className="t-caption leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="grid grid-cols-3 gap-2">
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
            <section>
              <button onClick={() => setInsightsOpen(o => !o)} className="w-full flex items-center gap-2 text-left h-11" aria-expanded={insightsOpen}>
                <span className="t-heading flex-1">Month insights</span>
                <ChevronDown size={18} className={`text-text-muted transition-transform ${insightsOpen ? 'rotate-180' : ''}`} />
              </button>

              {insightsOpen && (
                <div className="space-y-6 pt-2">
                  {monthlyInsights.storyArc?.length > 0 && (
                    <div className="space-y-2">
                      <p className="section-label">Week by week</p>
                      {monthlyInsights.storyArc.map(w => (
                        <div key={w.week} className="flex items-center gap-3 tile">
                          <div className="flex-1 min-w-0">
                            <p className="text-base text-text-primary truncate">{w.theme}</p>
                            <p className="text-sm text-text-secondary">
                              {format(new Date(w.wsStr + 'T00:00:00'), 'MMM d')}–{format(new Date(w.weStr + 'T00:00:00'), 'MMM d')} · {w.note}
                            </p>
                          </div>
                          <p className="text-base font-semibold tabular-nums shrink-0 text-text-primary">{w.avg}</p>
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
                            <div key={label} className="tile">
                              <p className={`text-xl font-semibold tabular-nums ${i === 2 ? (up ? 'text-success' : 'text-warning') : 'text-text-primary'}`}>{value}</p>
                              <p className="t-caption leading-tight">{label}</p>
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
                          <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-base text-text-primary leading-snug">{p.text}</p>
                            <p className="text-sm text-text-secondary leading-snug">{p.sub}</p>
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
                          <XCircle size={18} className="text-danger shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-base text-text-primary leading-snug">{r.text}</p>
                            <p className="text-sm text-text-secondary leading-snug">{r.sub}</p>
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
                          <span key={i} className="bg-surface-elevated rounded-full px-3 py-1.5 text-sm text-text-primary">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── TRENDS ── */}
      {historyTab === 'trends' && (
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-6">
          {monthNav}

          {/* Score chart for the viewed month */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="t-heading">Scores this month</h2>
                <div className="flex gap-0.5 bg-surface-elevated rounded-full p-0.5">
                  <button
                    onClick={() => setChartMode('line')}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${chartMode === 'line' ? 'bg-surface-card text-text-primary font-semibold' : 'text-text-secondary'}`}
                  >Line</button>
                  <button
                    onClick={() => setChartMode('bar')}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${chartMode === 'bar' ? 'bg-surface-card text-text-primary font-semibold' : 'text-text-secondary'}`}
                  >Stacked</button>
                </div>
              </div>

              {chartMode === 'line' && (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {LINE_METRICS.map(({ key, label }) => (
                    <button key={key} onClick={() => setSelectedLine(key)}
                      className={selectedLine === key ? 'pill-option-active' : 'pill-option'}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {chartMode === 'bar' && (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(var(--c-surface-elevated))' }} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 12, fill: 'rgb(var(--c-text-muted))' }} />
                    )}
                    <Bar dataKey="diet" stackId="a" fill={CATEGORY_COLORS.diet} radius={[0,0,0,0]}>
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                    <Bar dataKey="workout" stackId="a" fill={CATEGORY_COLORS.workout}>
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                    <Bar dataKey="sleep" stackId="a" fill={CATEGORY_COLORS.sleep} radius={[3,3,0,0]}>
                      {chartData.map((e, i) => <Cell key={i} fillOpacity={e.isPrev ? 0.35 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartMode === 'line' && (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-surface-border))" vertical={false} />
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis
                      domain={[0, activeLine.max]}
                      tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12, fontFamily: 'Inter Variable' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 12, fill: 'rgb(var(--c-text-muted))' }} />
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
                  [[CATEGORY_COLORS.diet, 'Diet'], [CATEGORY_COLORS.workout, 'Workout'], [CATEGORY_COLORS.sleep, 'Sleep']].map(([c, l]) => (
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
            <p className="text-sm text-text-secondary text-center py-8">No scores in this month yet.</p>
          )}

          {/* Meal Insights — deterministic, history-driven (see recommendationEngine.js) */}
          <MealInsightsCard />

          {lifetime && lifetime.days > 0 && (
            <section>
              <h2 className="t-heading mb-3">All time</h2>
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
                  <div key={label} className="tile">
                    <p className="t-caption">{label}</p>
                    <p className="text-xl font-semibold tabular-nums text-text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
