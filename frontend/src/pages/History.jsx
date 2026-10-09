import { useEffect, useState, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, subDays, parseISO, addWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, BarChart2, X, Share2, TrendingUp, TrendingDown, Minus as MinusIcon, CheckCircle2, XCircle, Zap, Award } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Filesystem, Directory } from '@capacitor/filesystem'
import toast from 'react-hot-toast'
import { getMonthlyScores, getDiet, getWorkout, getSleep } from '../api/client'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import { DayDetailPanel } from '../components/DayDetail'
import db from '../services/db'
import { getWeekBounds, computeWeeklySummary } from '../services/weeklyInsights'
import { getBadgeStates } from '../services/badgeEngine'
import BadgeShelf from '../components/BadgeShelf'
import { computeMonthlyInsights } from '../services/monthlyInsights'
import { getMealAnalytics } from '../services/localStore'

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

export default function History() {
  // ── Tab state ────────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState('week')

  // ── Week state ───────────────────────────────────────────────────────────
  const [weekRef, setWeekRef]         = useState(new Date())
  const [weekSummary, setWeekSummary] = useState(null)
  const [weekRange, setWeekRange]     = useState(null)
  const [weekLoading, setWeekLoading] = useState(false)
  const [allBadges, setAllBadges]     = useState(null)

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
  const [monthBadges, setMonthBadges]         = useState(null)

  const LINE_METRICS = [
    { key: 'total',   color: '#FBBC04', label: 'Total',   max: 100 },
    { key: 'diet',    color: '#34A853', label: 'Diet',    max: 35 },
    { key: 'workout', color: '#1A73E8', label: 'Workout', max: 35 },
    { key: 'sleep',   color: '#a78bfa', label: 'Sleep',   max: 30 },
    { key: 'fasting', color: '#f97316', label: 'Fasting', max: 10 },
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
    setMonthBadges(null)

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
      getBadgeStates().then(all => {
        const mb = all.filter(b => b.unlocked && b.unlockedAt && b.unlockedAt >= mStart && b.unlockedAt <= mEnd)
        setMonthBadges(mb.length ? mb : null)
      }).catch(() => {})
    }).catch(() => {})
  }, [historyTab, year, month])

  // ── Week data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (historyTab !== 'week') return
    setWeekLoading(true)
    getBadgeStates().then(setAllBadges).catch(() => {})
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
      }))
    }).finally(() => setWeekLoading(false))
  }, [historyTab, weekRef])

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

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <div className="p-2 bg-warning/10 rounded-xl border border-warning/20">
          <BarChart2 size={16} className="text-warning" />
        </div>
        <h1 className="text-base font-semibold text-text-primary">History</h1>
      </div>

      {/* Tab toggle */}
      <div className="max-w-lg mx-auto px-4 pt-2 pb-0">
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {[['week', 'Weekly Executive'], ['month', 'Monthly Calendar']].map(([key, label]) => (
            <button key={key} onClick={() => setHistoryTab(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${historyTab === key ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── WEEK TAB ── */}
      {historyTab === 'week' && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {/* Week navigator */}
          <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-2xl px-4 py-3">
            <button onClick={() => setWeekRef(d => addWeeks(d, -1))}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">
                {weekRange ? `${format(new Date(weekRange.start + 'T00:00:00'), 'MMM d')} – ${format(new Date(weekRange.end + 'T00:00:00'), 'MMM d, yyyy')}` : '…'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">Week summary</p>
            </div>
            <button onClick={() => setWeekRef(d => addWeeks(d, 1))}
              disabled={weekRange && weekRange.end >= format(new Date(), 'yyyy-MM-dd')}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          {weekLoading && <div className="text-center py-12 text-text-muted text-sm">Analysing your week…</div>}

          {!weekLoading && !weekSummary && (
            <div className="card text-center py-10 space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-sm font-semibold text-text-primary">No data logged this week</p>
              <p className="text-xs text-text-muted">Log at least one day via Activity to see your weekly executive summary</p>
            </div>
          )}

          {!weekLoading && weekSummary && (() => {
            const s = weekSummary
            return (
              <>
                {/* ── Score card ── */}
                <div className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="section-label">Weekly Avg Score</p>
                      <div className="flex items-end gap-3 mt-2">
                        <p className="text-5xl font-bold tabular-nums" style={{ color: s.grade.color }}>{s.avgScore}</p>
                        <div className="pb-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold"
                            style={{ color: s.grade.color, borderColor: `${s.grade.color}40`, background: `${s.grade.color}12` }}>
                            {s.grade.letter} — {s.grade.label}
                          </div>
                          <div className="mt-1.5"><TrendBadge trend={s.trend} /></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-text-muted">Days logged</p>
                      <p className="text-2xl font-bold tabular-nums text-text-primary">{s.daysLogged}<span className="text-sm text-text-muted font-normal">/7</span></p>
                      <p className="text-xs text-text-muted mt-1">{s.metrics.idealDays} ideal days ≥70</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[
                      { label: 'Avg Steps', value: s.metrics.avgSteps >= 1000 ? `${(s.metrics.avgSteps/1000).toFixed(1)}k` : String(s.metrics.avgSteps), color: '#38bdf8' },
                      { label: 'Avg Sleep', value: `${s.metrics.avgSleep}h`, color: '#a78bfa' },
                      { label: 'Workouts', value: String(s.metrics.workoutSessions), color: '#22c55e' },
                      { label: 'Late 🍽️', value: String(s.metrics.lateDinnerDays), color: s.metrics.lateDinnerDays >= 3 ? '#ef4444' : s.metrics.lateDinnerDays > 0 ? '#f59e0b' : '#22c55e' },
                    ].map(m => (
                      <div key={m.label} className="bg-surface-elevated rounded-xl p-2.5 text-center">
                        <p className="text-base font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Badge Shelf ── */}
                {allBadges && (
                  <div className="card">
                    <BadgeShelf badges={allBadges} />
                  </div>
                )}

                {/* ── Biggest Wins ── */}
                {s.wins.length > 0 && (
                  <div className="card space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Award size={14} className="text-success" />
                      <h2 className="text-sm font-semibold text-text-primary">Biggest Wins</h2>
                    </div>
                    {s.wins.map((w, i) => (
                      <div key={i} className="flex items-start gap-2.5 py-1">
                        <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{w.text}</p>
                          <p className="text-xs text-text-muted">{w.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Biggest Damage ── */}
                {s.damage.length > 0 && (
                  <div className="card space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle size={14} className="text-danger" />
                      <h2 className="text-sm font-semibold text-text-primary">Biggest Damage</h2>
                    </div>
                    {s.damage.map((d, i) => (
                      <div key={i} className="flex items-start gap-2.5 py-1">
                        <XCircle size={15} className="text-danger shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{d.text}</p>
                          <p className="text-xs text-text-muted">{d.detail}</p>
                        </div>
                      </div>
                    ))}
                    {s.stackedFailures.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-surface-border">
                        <p className="text-xs text-warning font-medium">⚡ Stacked failure detected:</p>
                        {s.stackedFailures.map((f, i) => (
                          <p key={i} className="text-xs text-text-muted mt-0.5">{format(new Date(f.date + 'T00:00:00'), 'EEE MMM d')}: {f.label}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Strategic Fix ── */}
                <div className="card border-2" style={{ borderColor: '#a78bfa40', background: '#a78bfa08' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className="text-brand" />
                    <h2 className="text-sm font-semibold text-text-primary">Strategic Fix</h2>
                    <span className="text-xs text-text-muted ml-auto">Highest-impact action</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary leading-relaxed">👉 {s.strategicFix}</p>
                </div>

                {/* ── Best / Worst day ── */}
                {s.bestDay && s.worstDay && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '🏆 Best Day', day: s.bestDay, color: '#22c55e' },
                      { label: '📉 Worst Day', day: s.worstDay, color: '#ef4444' },
                    ].map(({ label, day, color }) => (
                      <div key={label} className="card text-center">
                        <p className="text-xs text-text-muted mb-1">{label}</p>
                        <p className="text-sm font-semibold text-text-primary">{format(new Date(day.date + 'T00:00:00'), 'EEE, MMM d')}</p>
                        <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{Math.round(day.total_score)}</p>
                        <p className="text-xs text-text-muted">pts</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Top junk foods ── */}
                {s.topJunk.length > 0 && (
                  <div className="card space-y-2">
                    <h2 className="text-sm font-semibold text-text-primary">Most Frequent Junk Foods</h2>
                    {s.topJunk.map(({ label, count }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">{label}</span>
                        <span className="text-xs font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full">×{count} this week</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── MONTH TAB ── */}
      {historyTab === 'month' && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {/* Month nav */}
          <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-2xl px-4 py-3">
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-text-primary">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Hero Performance Card */}
          {monthlyInsights ? (
            <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: monthlyInsights.identity.grad }}>
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-1.5 bg-black/25 px-3 py-1.5 rounded-full">
                  <span className="text-base leading-none">{monthlyInsights.identity.emoji}</span>
                  <span className="text-xs font-bold text-white">{monthlyInsights.identity.label}</span>
                </div>
                {monthlyInsights.trend !== null && (
                  <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${monthlyInsights.trend >= 0 ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'}`}>
                    {monthlyInsights.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {monthlyInsights.trend >= 0 ? '+' : ''}{monthlyInsights.trend} vs last month
                  </div>
                )}
              </div>

              <div className="flex items-end gap-3 mb-3">
                <p className="text-6xl font-black text-white tabular-nums leading-none">{monthlyInsights.avgScore}</p>
                <div className="pb-1.5">
                  <p className="text-2xl font-black leading-none" style={{ color: monthlyInsights.grade.color }}>{monthlyInsights.grade.letter}</p>
                  <p className="text-xs text-white/70 mt-0.5">{monthlyInsights.grade.label}</p>
                </div>
              </div>

              <p className="text-sm text-white/85 leading-relaxed mb-4">{monthlyInsights.narrative}</p>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Days', value: monthlyInsights.daysLogged },
                  { label: 'Sleep', value: `${monthlyInsights.stats.avgSleep}h` },
                  { label: 'Workouts', value: monthlyInsights.stats.workoutSessions },
                  { label: 'Junk Days', value: monthlyInsights.stats.junkFoodDays },
                ].map(m => (
                  <div key={m.label} className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-sm font-bold text-white tabular-nums">{m.value}</p>
                    <p className="text-[10px] text-white/60 mt-0.5 leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Avg Score', value: avg, color: '#34A853' },
                { label: 'Best Day',  value: best, color: '#FBBC04' },
                { label: 'Days Logged', value: logged, color: '#1A73E8' },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <p className="metric-value" style={{ color: m.color }}>{m.value}</p>
                  <p className="metric-label">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Meal Insights — deterministic, history-driven (see recommendationEngine.js) */}
          <MealInsightsCard />

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
                        <span className="text-[10px] font-medium text-text-secondary">{format(day, 'd')}</span>
                        {isBestDay ? (
                          <span className="text-[9px] leading-none">🏆</span>
                        ) : isExerciseDay ? (
                          <span className="text-[9px] leading-none">⚡</span>
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

          {/* Monthly badge shelf */}
          {monthBadges && monthBadges.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Award size={14} style={{ color: '#f59e0b' }} />
                <h2 className="text-sm font-semibold text-text-primary">Badges Earned This Month</h2>
              </div>
              <BadgeShelf badges={monthBadges} />
            </div>
          )}

          {/* Monthly Story Arc */}
          {monthlyInsights?.storyArc?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Monthly Story Arc</h2>
              <div className="space-y-2">
                {monthlyInsights.storyArc.map(w => (
                  <div key={w.week} className="flex items-center gap-3 bg-surface-elevated rounded-xl px-3 py-2.5">
                    <span className="text-xl shrink-0">{w.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-text-primary truncate">{w.theme}</p>
                        <p className="text-sm font-bold tabular-nums shrink-0" style={{ color: scoreColor(w.avg) }}>{w.avg}</p>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Wk {w.week}: {format(new Date(w.wsStr + 'T00:00:00'), 'MMM d')}–{format(new Date(w.weStr + 'T00:00:00'), 'MMM d')} · {w.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trajectory */}
          {monthlyInsights?.trajectory && (() => {
            const t = monthlyInsights.trajectory
            const up = t.halfTrend >= 0
            return (
              <div className="card border-2" style={{
                borderColor: up ? '#22c55e30' : '#ef444430',
                background:  up ? '#22c55e06' : '#ef444406',
              }}>
                <div className="flex items-center gap-2 mb-3">
                  {up ? <TrendingUp size={14} className="text-success" /> : <TrendingDown size={14} className="text-danger" />}
                  <h2 className="text-sm font-semibold text-text-primary">Trajectory</h2>
                  <span className="text-xs text-text-muted ml-auto">Half-month analysis</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-text-primary">{t.firstAvg}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">First Half</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-text-primary">{t.secondAvg}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Second Half</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: up ? '#22c55e' : '#ef4444' }}>{t.projected}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Next Month</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted text-center">
                  {up
                    ? `↗ +${t.halfTrend} pts second-half momentum → on track for ${t.projected} next month`
                    : `↘ ${t.halfTrend} pts second-half dip → projected ${t.projected} next month`}
                </p>
              </div>
            )
          })()}

          {/* Insight Intelligence */}
          {monthlyInsights && (monthlyInsights.positives.length > 0 || monthlyInsights.risks.length > 0) && (
            <div className={`grid gap-3 ${monthlyInsights.positives.length > 0 && monthlyInsights.risks.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {monthlyInsights.positives.length > 0 && (
                <div className="card space-y-2.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CheckCircle2 size={13} className="text-success shrink-0" />
                    <p className="text-xs font-semibold text-text-primary">Driving Scores Up</p>
                  </div>
                  {monthlyInsights.positives.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-sm shrink-0 mt-0.5">{p.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary leading-snug">{p.text}</p>
                        <p className="text-[10px] text-text-muted mt-0.5 leading-snug">{p.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {monthlyInsights.risks.length > 0 && (
                <div className="card space-y-2.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <XCircle size={13} className="text-danger shrink-0" />
                    <p className="text-xs font-semibold text-text-primary">Score Drags</p>
                  </div>
                  {monthlyInsights.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-sm shrink-0 mt-0.5">{r.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary leading-snug">{r.text}</p>
                        <p className="text-[10px] text-text-muted mt-0.5 leading-snug">{r.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Near-miss psychology */}
          {monthlyInsights?.nearMiss?.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} style={{ color: '#f59e0b' }} />
                <p className="text-xs font-semibold text-text-primary">Near Misses</p>
                <span className="text-xs text-text-muted">— you were this close</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {monthlyInsights.nearMiss.map((m, i) => (
                  <div key={i} className="bg-warning/10 border border-warning/25 rounded-full px-3 py-1.5">
                    <p className="text-xs font-medium text-warning">🎯 {m}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary">Monthly Breakdown</h2>
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
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(var(--c-surface-elevated))' }} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 9, fill: 'rgb(var(--c-text-muted))' }} />
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
                    <XAxis dataKey="label" type="category" tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis
                      domain={[0, activeLine.max]}
                      tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 10, fontFamily: 'Inter' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {prevTail.length > 0 && monthBoundaryLabel && (
                      <ReferenceLine x={monthBoundaryLabel} stroke="rgb(var(--c-surface-border))" strokeDasharray="4 2"
                        label={{ value: format(viewDate, 'MMM'), position: 'insideTopRight', fontSize: 9, fill: 'rgb(var(--c-text-muted))' }} />
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
                    <span className="text-xs text-text-muted">/ {activeLine.key === 'steps' ? '10k steps' : `${activeLine.max} pts`}</span>
                  </div>
                )}
                {prevTail.length > 0 && (
                  <span className="text-xs text-text-muted ml-auto opacity-60">Faded = prev month</span>
                )}
              </div>
            </div>
          )}
        </div>
      )} {/* end month tab */}
    </div>
  )
}
