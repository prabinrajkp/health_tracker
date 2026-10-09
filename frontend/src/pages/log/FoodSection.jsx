import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, Trash2, Timer, Settings2 } from 'lucide-react'
import { getDiet, saveDiet, getConfig, getLatestWeight } from '../../api/client'
import { calcDietScore, calcNutritionTotals, calcCalorieScore } from '../../services/scoring'
import { dieteticsFromConfig } from '../../services/dietetics'
import { weightsFromConfig, categoryMaxes, CATEGORY_COLORS } from '../../services/scoreMeta'
import { fastingWindow, fastingPoints, fmtHours } from '../../services/fasting'
import { schedulePostDinnerWalk } from '../../services/reminders'
import { itemScore } from '../../components/DayDetail'
import AddMealFlow from '../../components/AddMealFlow'
import { MEAL_META } from '../../constants/mealMeta'
import { useAutoSave, SectionScore, NoteField, todayStr, TEXT_SAVE_MS } from './shared'

const MAIN_MEALS  = ['breakfast', 'lunch', 'dinner', 'snacks']
const EXTRA_MEALS = ['drink', 'other']          // shown only once something is logged under them
const TIMED_MEALS = ['breakfast', 'lunch', 'dinner']
const EMPTY_DIET  = { meal_items: [], meal_times: { breakfast: '', lunch: '', dinner: '' }, notes: '' }

function MealBlock({ mealType, diet, onItems, onTime, onAdd, latePenalty }) {
  const meta  = MEAL_META[mealType]
  const items = diet.meal_items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.mealType === mealType)
  const time  = diet.meal_times?.[mealType] || ''
  const late  = mealType === 'dinner' && time && Number(time.split(':')[0]) >= 21 && latePenalty > 0

  const remove = (idx) => onItems(diet.meal_items.filter((_, i) => i !== idx))
  const changePortion = (idx, delta) => onItems(diet.meal_items.map((item, i) =>
    i === idx ? { ...item, portions: Math.max(0.5, Math.round((item.portions + delta) * 2) / 2) } : item))

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{meta.icon}</span>
        <h2 className="text-sm font-semibold text-text-primary flex-1">{meta.label}</h2>
        {TIMED_MEALS.includes(mealType) && (items.length > 0 || time) && (
          <input type="time" aria-label={`${meta.label} time`} className="input py-1.5 px-2 text-xs w-[6.5rem] shrink-0"
            value={time} onChange={e => onTime(mealType, e.target.value)} />
        )}
        <button onClick={() => onAdd(mealType)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl shrink-0 active:scale-95 transition-transform"
          style={{ color: meta.color, background: `${meta.color}18` }}>
          <Plus size={13} />Add
        </button>
      </div>

      {late && (
        <p className="text-xs text-danger">Dinner after 9 PM costs {latePenalty} pts — correct the time if you ate earlier.</p>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-text-muted">Nothing logged yet</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(({ item, idx }) => {
            const pts    = Math.round(itemScore(item) * 10) / 10
            const isOver = item.idealPortions && item.portions > item.idealPortions
            return (
              <div key={idx} className={`flex items-center gap-2 rounded-xl px-3 py-2 bg-surface-elevated ${isOver ? 'border border-warning/30' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-primary block truncate">{item.label}</span>
                  <span className="text-xs text-text-muted">
                    {!TIMED_MEALS.includes(mealType) && item.time ? `${item.time} · ` : ''}
                    <span className={pts >= 0 ? 'text-success' : 'text-danger'}>{pts >= 0 ? '+' : ''}{pts} pts</span>
                    {isOver && <span className="text-warning"> · over ideal ({item.idealPortions})</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => changePortion(idx, -0.5)} aria-label="Less"
                    className="w-8 h-8 rounded-lg border border-surface-border text-text-muted flex items-center justify-center"><Minus size={12} /></button>
                  <span className="w-9 text-center text-xs font-semibold tabular-nums text-text-primary">×{item.portions}</span>
                  <button onClick={() => changePortion(idx, 0.5)} aria-label="More"
                    className="w-8 h-8 rounded-lg border border-surface-border text-text-muted flex items-center justify-center"><Plus size={12} /></button>
                </div>
                <button onClick={() => remove(idx)} aria-label="Remove"
                  className="w-8 h-8 rounded-lg text-text-muted flex items-center justify-center"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FastingLine({ diet, yesterdayDiet, weights }) {
  const [, tick] = useState(0)
  const win = fastingWindow(diet, yesterdayDiet)

  useEffect(() => {
    if (!win.lastDinner || win.complete) return
    const id = setInterval(() => tick(n => n + 1), 60000)
    return () => clearInterval(id)
  }, [win.lastDinner, win.complete])

  const fc      = weights.fasting || {}
  const minH    = fc.min_hours ?? 12, targetH = fc.target_hours ?? 16, maxPts = fc.max_points ?? 10
  const color   = win.hours >= targetH ? '#22c55e' : win.hours >= minH ? '#f59e0b' : 'rgb(var(--c-text-muted))'

  return (
    <div className="card py-3.5 flex items-center gap-2.5">
      <Timer size={15} style={{ color }} className="shrink-0" />
      {!win.lastDinner ? (
        <p className="text-xs text-text-muted">Fasting — log dinner and tomorrow's window is tracked automatically</p>
      ) : (
        <>
          <p className="text-sm flex-1 min-w-0">
            <span className="font-semibold tabular-nums" style={{ color }}>{fmtHours(win.hours)}</span>
            <span className="text-xs text-text-muted">
              {win.complete ? ` fast complete · ${win.lastDinner} → ${win.firstBf}`
                : win.nextFast ? ` · next fast started at ${win.lastDinner}`
                : ` fasting · target ${targetH}h`}
            </span>
          </p>
          {!win.nextFast && (
            <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
              +{fastingPoints(win.hours, weights)}<span className="text-text-muted font-normal"> / {maxPts} pts</span>
            </span>
          )}
        </>
      )}
    </div>
  )
}

function MacroRow({ label, value, range, color }) {
  const pct  = range.max > 0 ? Math.min((value / range.max) * 100, 100) : 0
  const over = value > range.max
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: over ? '#f97316' : 'rgb(var(--c-text-primary))' }}>
          {value}<span className="text-text-muted font-normal"> / {range.min}–{range.max} g</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? '#f97316' : color }} />
      </div>
    </div>
  )
}

// Calories eaten against the day's targets. The targets themselves (BMR,
// maintenance, macro ranges) used to live on the Weight page.
function CaloriesCard({ diet, dietetics, weights, onSetup }) {
  if (!dietetics) return (
    <button onClick={onSetup} className="w-full card flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand/10">
        <Settings2 size={16} className="text-brand-light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary leading-tight">Set up calorie targets</p>
        <p className="text-xs text-text-muted mt-0.5">Log a weight and add your height and age in Settings</p>
      </div>
    </button>
  )

  const totals  = calcNutritionTotals(diet)
  const target  = dietetics.energy
  const left    = target - totals.kcal
  const pct     = Math.min((totals.kcal / target) * 100, 100)
  const score   = calcCalorieScore(diet, dietetics, weights)
  const partial = totals.hasData && totals.coverage < (weights.calories?.min_coverage ?? 0.7)

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🔥</span>
        <h2 className="text-sm font-semibold text-text-primary flex-1">Calories</h2>
        {score != null && <span className="badge badge-brand">+{score} pts</span>}
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <p className="text-2xl font-bold tabular-nums text-text-primary">
            {totals.kcal}<span className="text-sm font-normal text-text-muted"> / {target} kcal</span>
          </p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: left < 0 ? '#f97316' : '#22c55e' }}>
            {left < 0 ? `${Math.abs(left)} over` : `${left} left`}
          </p>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-surface-elevated">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: left < 0 ? '#f97316' : '#22c55e' }} />
        </div>
      </div>

      <div className="space-y-2.5">
        <MacroRow label="Protein" value={totals.protein} range={dietetics.proteins} color="#22c55e" />
        <MacroRow label="Carbs"   value={totals.carbs}   range={dietetics.carbs}    color="#38bdf8" />
        <MacroRow label="Fat"     value={totals.fat}     range={dietetics.fat}      color="#f59e0b" />
      </div>

      <p className="text-xs text-text-muted border-t border-surface-border pt-2.5 leading-relaxed">
        Maintenance {dietetics.maintenance} kcal · BMR {dietetics.bmr} kcal · fibre {dietetics.fibre.min}–{dietetics.fibre.max} g · BMI {dietetics.bmi}
      </p>

      {partial && (
        <p className="text-xs text-warning">
          Only {Math.round(totals.coverage * 100)}% of what you logged has calorie data, so calories are not scored yet.
          Add nutrition to your foods in Settings.
        </p>
      )}
    </div>
  )
}

export default function FoodSection({ afterSave }) {
  const navigate  = useNavigate()
  const today     = todayStr()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const [diet, setDiet]                   = useState({ ...EMPTY_DIET, date: today })
  const [yesterdayDiet, setYesterdayDiet] = useState(null)
  const [weights, setWeights]             = useState(weightsFromConfig(null))
  const [customOptions, setCustomOptions] = useState([])
  const [dietetics, setDietetics]         = useState(null)
  const [addOpen, setAddOpen]             = useState(false)
  const [addCategory, setAddCategory]     = useState(null)

  const loadDiet = async () => {
    const data = await getDiet(today)
    setDiet({
      ...EMPTY_DIET, ...(data || {}),
      meal_items: data?.meal_items || [],
      meal_times: { ...EMPTY_DIET.meal_times, ...(data?.meal_times || {}), dinner: data?.meal_times?.dinner || data?.dinner_time || '' },
      date: today,
    })
  }

  useEffect(() => {
    loadDiet().catch(console.error)
    getDiet(yesterday).then(setYesterdayDiet).catch(() => {})
    Promise.all([getConfig(), getLatestWeight()]).then(([rows, latestWeight]) => {
      const map = {}
      rows.forEach(r => { map[r.key] = r.value })
      setWeights(weightsFromConfig(map))
      try { if (map.custom_meal_options) setCustomOptions(JSON.parse(map.custom_meal_options)) } catch {}
      setDietetics(latestWeight ? dieteticsFromConfig(map, latestWeight.weight_kg) : null)
    }).catch(console.error)
  }, [])

  const { save, flush } = useAutoSave(async (next) => {
    await saveDiet({ ...next, date: today, dinner_time: next.meal_times?.dinner || '' })
    await afterSave()
  })

  const update = (next, delay = 0) => { setDiet(next); save(next, delay) }
  const setItems = (meal_items) => update({ ...diet, meal_items })
  const setTime  = (meal, value) => {
    update({ ...diet, meal_times: { ...diet.meal_times, [meal]: value } })
    if (meal === 'dinner') schedulePostDinnerWalk(value)
  }

  // Add Meal writes to the day's log itself, so anything typed here is saved
  // first and the list is re-read afterwards rather than merged by hand.
  const openAdd = async (category) => {
    await flush()
    setAddCategory(category)
    setAddOpen(true)
  }
  const handleMealLogged = async () => {
    await loadDiet()
    await afterSave()
    const fresh = await getDiet(today)
    if (addCategory === 'dinner' && fresh?.meal_times?.dinner) schedulePostDinnerWalk(fresh.meal_times.dinner)
  }

  const max         = categoryMaxes(weights)
  const latePenalty = Math.abs(weights.penalties?.dinner_after_9pm || 0)
  const dinnerTime  = diet.meal_times?.dinner
  const penalty     = dinnerTime && Number(dinnerTime.split(':')[0]) >= 21 ? latePenalty : 0
  const dietPts     = Math.max(0, calcDietScore(diet, weights, customOptions) - penalty)
  const extras      = EXTRA_MEALS.filter(mt => diet.meal_items.some(i => i.mealType === mt))

  return (
    <div className="space-y-3">
      <SectionScore label="Diet" pts={dietPts} max={max.diet} color={CATEGORY_COLORS.diet} />

      {[...MAIN_MEALS, ...extras].map(mt => (
        <MealBlock key={mt} mealType={mt} diet={diet} onItems={setItems} onTime={setTime} onAdd={openAdd} latePenalty={latePenalty} />
      ))}

      <FastingLine diet={diet} yesterdayDiet={yesterdayDiet} weights={weights} />

      <CaloriesCard diet={diet} dietetics={dietetics} weights={weights} onSetup={() => navigate('/settings?section=body')} />

      <NoteField value={diet.notes} placeholder="Anything to note about today's food…"
        onChange={notes => update({ ...diet, notes }, TEXT_SAVE_MS)} />

      <AddMealFlow open={addOpen} presetCategory={addCategory}
        onClose={() => setAddOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
