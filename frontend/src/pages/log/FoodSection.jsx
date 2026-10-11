import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, Trash2, Timer, Flame, ChevronRight } from 'lucide-react'
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

// One meal as a plain group: a heading row, then its foods divided by hairlines.
// An empty meal is a single row, so four empty meals do not fill the screen.
function MealGroup({ mealType, diet, onItems, onTime, onAdd, latePenalty }) {
  const { Icon, label } = MEAL_META[mealType]
  const items = diet.meal_items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.mealType === mealType)
  const time  = diet.meal_times?.[mealType] || ''
  const late  = mealType === 'dinner' && time && Number(time.split(':')[0]) >= 21 && latePenalty > 0

  const remove = (idx) => onItems(diet.meal_items.filter((_, i) => i !== idx))
  const changePortion = (idx, delta) => onItems(diet.meal_items.map((item, i) =>
    i === idx ? { ...item, portions: Math.max(0.5, Math.round((item.portions + delta) * 2) / 2) } : item))

  return (
    <section>
      <div className="flex items-center gap-2.5 h-11">
        <Icon size={18} className="text-text-secondary shrink-0" />
        <h2 className="t-heading flex-1">
          {label}
          {items.length === 0 && <span className="text-sm font-normal text-text-muted"> · nothing yet</span>}
        </h2>
        {TIMED_MEALS.includes(mealType) && (items.length > 0 || time) && (
          <input type="time" aria-label={`${label} time`}
            className="bg-transparent text-sm text-text-secondary tabular-nums outline-none w-[7.25rem] shrink-0"
            value={time} onChange={e => onTime(mealType, e.target.value)} />
        )}
        <button onClick={() => onAdd(mealType)} aria-label={`Add to ${label}`}
          className="flex items-center gap-1 text-sm font-semibold text-brand-light pl-2 py-2 shrink-0 active:opacity-70">
          <Plus size={16} />Add
        </button>
      </div>

      {late && (
        <p className="text-sm text-danger pb-2">Dinner after 9 PM costs {latePenalty} pts. Correct the time if you ate earlier.</p>
      )}

      {items.length > 0 && (
        <div className="group-list border-t border-surface-border">
          {items.map(({ item, idx }) => {
            const pts    = Math.round(itemScore(item) * 10) / 10
            const isOver = item.idealPortions && item.portions > item.idealPortions
            return (
              <div key={idx} className="flex items-center gap-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-base text-text-primary truncate">{item.label}</p>
                  <p className="text-sm text-text-secondary">
                    {!TIMED_MEALS.includes(mealType) && item.time ? `${item.time} · ` : ''}
                    <span className={pts >= 0 ? 'text-success' : 'text-danger'}>{pts >= 0 ? '+' : ''}{pts} pts</span>
                    {isOver && <span className="text-warning"> · over the ideal {item.idealPortions}</span>}
                  </p>
                </div>
                <div className="flex items-center shrink-0 bg-surface-elevated rounded-full">
                  <button onClick={() => changePortion(idx, -0.5)} aria-label="Less"
                    className="w-9 h-9 flex items-center justify-center text-text-secondary"><Minus size={14} /></button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums text-text-primary">{item.portions}</span>
                  <button onClick={() => changePortion(idx, 0.5)} aria-label="More"
                    className="w-9 h-9 flex items-center justify-center text-text-secondary"><Plus size={14} /></button>
                </div>
                <button onClick={() => remove(idx)} aria-label={`Remove ${item.label}`}
                  className="w-9 h-9 text-text-muted flex items-center justify-center shrink-0"><Trash2 size={16} /></button>
              </div>
            )
          })}
        </div>
      )}
    </section>
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
  const targetH = fc.target_hours ?? 16, maxPts = fc.max_points ?? 10

  return (
    <section className="flex items-center gap-2.5 h-11">
      <Timer size={18} className="text-text-secondary shrink-0" />
      <h2 className="t-heading">Fasting</h2>
      {!win.lastDinner ? (
        <p className="text-sm text-text-muted flex-1 text-right">Starts when you log dinner</p>
      ) : (
        <p className="text-sm text-text-secondary flex-1 text-right tabular-nums">
          {fmtHours(win.hours)}
          {win.complete ? ' · complete' : win.nextFast ? ' · started' : ` of ${targetH}h`}
          {!win.nextFast && <span className="text-text-primary font-semibold"> · +{fastingPoints(win.hours, weights)}/{maxPts}</span>}
        </p>
      )}
    </section>
  )
}

function MacroRow({ label, value, range }) {
  const pct  = range.max > 0 ? Math.min((value / range.max) * 100, 100) : 0
  const over = value > range.max
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary w-14 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className={`h-full rounded-full transition-all ${over ? 'bg-warning' : 'bg-text-secondary'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm tabular-nums text-text-primary w-[7.5rem] text-right shrink-0 whitespace-nowrap">
        {value}<span className="text-text-muted"> / {range.min}–{range.max}g</span>
      </span>
    </div>
  )
}

// Calories eaten against the day's targets. The targets themselves (BMR,
// maintenance, macro ranges) used to live on the Weight page.
function CaloriesCard({ diet, dietetics, weights, onSetup }) {
  if (!dietetics) return (
    <button onClick={onSetup} className="w-full card flex items-center gap-3 text-left active:opacity-70 transition-opacity">
      <Flame size={18} className="text-text-secondary shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-base font-medium text-text-primary">Set up calorie targets</span>
        <span className="block text-sm text-text-secondary">Log a weight, then add your height and age</span>
      </span>
      <ChevronRight size={18} className="text-text-muted shrink-0" />
    </button>
  )

  const totals  = calcNutritionTotals(diet)
  const target  = dietetics.energy
  const left    = target - totals.kcal
  const pct     = Math.min((totals.kcal / target) * 100, 100)
  const score   = calcCalorieScore(diet, dietetics, weights)
  const partial = totals.hasData && totals.coverage < (weights.calories?.min_coverage ?? 0.7)

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2.5">
        <Flame size={18} className="text-text-secondary shrink-0" />
        <h2 className="t-heading flex-1">Calories</h2>
        {score != null && <span className="text-sm font-semibold text-success">+{score} pts</span>}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="flex items-baseline gap-1.5">
            <span className="t-number">{totals.kcal}</span>
            <span className="text-sm text-text-muted">/ {target} kcal</span>
          </p>
          <span className={`text-sm font-semibold tabular-nums ${left < 0 ? 'text-warning' : 'text-text-secondary'}`}>
            {left < 0 ? `${Math.abs(left)} over` : `${left} left`}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-surface-elevated">
          <div className={`h-full rounded-full transition-all ${left < 0 ? 'bg-warning' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-2.5">
        <MacroRow label="Protein" value={totals.protein} range={dietetics.proteins} />
        <MacroRow label="Carbs"   value={totals.carbs}   range={dietetics.carbs} />
        <MacroRow label="Fat"     value={totals.fat}     range={dietetics.fat} />
      </div>

      <p className="t-caption leading-relaxed">
        Maintenance {dietetics.maintenance} kcal · BMR {dietetics.bmr} kcal · fibre {dietetics.fibre.min}–{dietetics.fibre.max} g · BMI {dietetics.bmi}
      </p>

      {partial && (
        <p className="text-sm text-warning">
          Only {Math.round(totals.coverage * 100)}% of what you logged has calorie data, so calories are not scored yet.
          Add nutrition to your foods in Settings.
        </p>
      )}
    </section>
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
    <div className="space-y-6">
      <SectionScore label="Diet" pts={dietPts} max={max.diet} color={CATEGORY_COLORS.diet} />

      <div className="space-y-2">
        {[...MAIN_MEALS, ...extras].map(mt => (
          <MealGroup key={mt} mealType={mt} diet={diet} onItems={setItems} onTime={setTime} onAdd={openAdd} latePenalty={latePenalty} />
        ))}
        <FastingLine diet={diet} yesterdayDiet={yesterdayDiet} weights={weights} />
      </div>

      <CaloriesCard diet={diet} dietetics={dietetics} weights={weights} onSetup={() => navigate('/settings?section=body')} />

      <NoteField value={diet.notes} placeholder="Anything to note about today's food…"
        onChange={notes => update({ ...diet, notes }, TEXT_SAVE_MS)} />

      <AddMealFlow open={addOpen} presetCategory={addCategory}
        onClose={() => setAddOpen(false)} onLogged={handleMealLogged} />
    </div>
  )
}
