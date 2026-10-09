import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, X, Sparkles, Loader2, Star, Clock, Check, ChevronDown, Pencil, RotateCcw } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { MEAL_TYPES, MEAL_META, defaultCategoryForTime } from '../constants/mealMeta'
import { getDiet, saveDiet, getConfig } from '../api/client'
import {
  getFoods, saveFood, getFrequentMeals, getRecentMeals, getRecentFoods,
  getFavoriteFingerprints, toggleFavoriteMeal, suggestNextFoodsFor, getLearnedPortion,
  saveMeal, forceLogMeal, updateMeal, getYesterdayMeal, getMealNames, setMealName,
} from '../services/localStore'
import { searchFoods } from '../services/foodMatcher'
import { hasLlmKey, analyzeFoodWithAI } from '../services/llmApi'

const today = () => format(new Date(), 'yyyy-MM-dd')

function itemFromFood(food, mealType, portions, time) {
  return {
    foodId: food.id, label: food.label, mealType, portions,
    idealPortions: food.idealPortions || null,
    pointsPerPortion: food.category === 'bad' ? -(food.points || 0) : (food.points || 0),
    category: food.category,
    kcalPerPortion:    food.kcal    ?? null,
    proteinPerPortion: food.protein ?? null,
    carbsPerPortion:   food.carbs   ?? null,
    fatPerPortion:     food.fat     ?? null,
    time,
  }
}

function ptsLabel(item) {
  const pts = Math.round((item.pointsPerPortion || 0) * (item.portions || 1) * 10) / 10
  return `${pts >= 0 ? '+' : ''}${pts} pts`
}

// ── Header control: category is auto-guessed from time of day, but this stays
// one tap away always so a late breakfast or backdated entry is never blocked ──
function CategoryPicker({ category, open, onToggle, onSelect }) {
  const meta = MEAL_META[category]
  return (
    <div className="relative">
      <button onClick={onToggle}
        className="flex items-center gap-1 rounded-full pl-2.5 pr-2 py-1 bg-surface-elevated border border-surface-border text-xs font-semibold text-text-primary active:scale-[0.97] transition-transform">
        <span>{meta.icon}</span><span>{meta.label}</span><ChevronDown size={12} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-surface-border bg-surface-card shadow-lg py-1.5 z-10">
          {MEAL_TYPES.map(mt => (
            <button key={mt} onClick={() => onSelect(mt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated">
              <span>{MEAL_META[mt].icon}</span>
              <span className={mt === category ? 'font-semibold text-text-primary' : 'text-text-secondary'}>{MEAL_META[mt].label}</span>
              {mt === category && <Check size={13} className="ml-auto text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Custom name if the user has set one for this fingerprint, else a clean,
// capped food list — "Kerala Lunch" beats "Rice, Fish Curry, Thoran, Curd,
// Pickle" once a meal has more than a couple of items.
function mealDisplayName(meal, mealNames) {
  const custom = mealNames?.[meal.fingerprint]
  if (custom) return custom
  const labels = meal.foodItems.map(i => i.label)
  if (labels.length <= 3) return labels.join(', ')
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`
}

// ── Step: recommendations + search + AI fallback ────────────────────────────
function BrowseStep({
  category, foods, query, setQuery, results, aiLoading, aiConfigured, onAskAi,
  frequentMeals, recentMeals, recentFoods, favorites, yesterdayMeal, mealNames,
  onPickFood, onLogWholeMeal, onToggleFavorite, onRenameMeal, searchInputRef,
}) {
  const showRecs = !query
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (e, fingerprint) => {
    e.stopPropagation()
    setRenaming(fingerprint)
    setRenameValue(mealNames?.[fingerprint] || '')
  }
  const saveRename = (e) => {
    e.stopPropagation()
    onRenameMeal(renaming, renameValue)
    setRenaming(null)
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          ref={searchInputRef}
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={`Search food or meals…`}
          className="input pl-9"
        />
      </div>

      {showRecs && yesterdayMeal && (
        <button onClick={() => onLogWholeMeal(yesterdayMeal)}
          className="w-full text-left rounded-2xl px-4 py-3.5 border-2 border-brand/40 bg-brand/5 active:scale-[0.98] transition-transform">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand flex items-center gap-1"><RotateCcw size={11} /> Repeat Yesterday</p>
          <p className="text-sm font-semibold text-text-primary mt-1">{mealDisplayName(yesterdayMeal, mealNames)}</p>
          {yesterdayMeal.nutritionSummary?.kcal > 0 && <p className="text-xs text-text-muted mt-0.5">{yesterdayMeal.nutritionSummary.kcal} kcal</p>}
        </button>
      )}

      {showRecs && frequentMeals.length > 0 && (
        <div className="space-y-2">
          <p className="section-label flex items-center gap-1.5"><Star size={11} /> Frequently Logged Meals</p>
          {frequentMeals.map(({ fingerprint, count, latest }) => (
            <div key={fingerprint} onClick={() => renaming !== fingerprint && onLogWholeMeal(latest)}
              className="w-full text-left rounded-2xl px-4 py-3 border border-surface-border bg-surface-elevated active:scale-[0.98] transition-transform cursor-pointer">
              {renaming === fingerprint ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    placeholder="Name this meal (e.g. Kerala Lunch)" className="input flex-1 py-1.5 text-sm" />
                  <button onClick={saveRename} className="text-xs font-semibold text-brand px-1 shrink-0">Save</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{mealDisplayName(latest, mealNames)}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button onClick={(e) => startRename(e, fingerprint)}><Pencil size={12} className="text-text-muted" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(fingerprint) }}>
                        <Star size={14} className={favorites.includes(fingerprint) ? 'text-warning fill-current' : 'text-text-muted'} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Logged {count}× · one tap to log again</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showRecs && recentMeals.length > 0 && (
        <div className="space-y-2">
          <p className="section-label flex items-center gap-1.5"><Clock size={11} /> Recent Meals</p>
          {recentMeals.map(m => (
            <button key={m.id} onClick={() => onLogWholeMeal(m)}
              className="w-full text-left rounded-2xl px-4 py-3 border border-surface-border bg-surface-elevated active:scale-[0.98] transition-transform">
              <p className="text-sm font-semibold text-text-primary">{mealDisplayName(m, mealNames)}</p>
              <p className="text-xs text-text-muted mt-0.5">{format(new Date(m.timestamp), 'MMM d, h:mm a')}</p>
            </button>
          ))}
        </div>
      )}

      {showRecs && recentFoods.length > 0 && (
        <div className="space-y-2">
          <p className="section-label">Recent Foods</p>
          <div className="flex flex-wrap gap-2">
            {recentFoods.map(item => (
              <button key={item.foodId || item.label} onClick={() => onPickFood({ id: item.foodId, label: item.label, category: item.category, points: item.pointsPerPortion, idealPortions: item.idealPortions, kcal: item.kcalPerPortion, protein: item.proteinPerPortion, carbs: item.carbsPerPortion, fat: item.fatPerPortion })}
                className="pill-option">
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showRecs && (
        <div className="space-y-2">
          {results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">🍽️</p>
              <p className="text-sm text-text-muted">No matches in your food list</p>
            </div>
          )}
          {results.length > 0 && <p className="section-label">Closest matches</p>}
          {results.map(({ food }) => (
            <button key={food.id} onClick={() => onPickFood(food)}
              className="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3 border border-surface-border bg-surface-elevated active:scale-[0.98] transition-transform">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{food.label}</p>
              </div>
              <span className={`text-sm font-bold shrink-0 tabular-nums ${food.category === 'good' ? 'text-success' : 'text-danger'}`}>
                {food.category === 'good' ? '+' : '-'}{food.points} pts
              </span>
            </button>
          ))}

          {/* Always reachable — never gated behind match confidence, so a wrong
              or unwanted suggestion never traps the user with no way out. */}
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 text-center space-y-2">
            <p className="text-sm font-semibold text-text-primary">{results.length ? "Not what you're looking for?" : "Not in your food list yet?"}</p>
            <p className="text-xs text-text-muted">We'll find it for you</p>
            {aiLoading ? (
              <div className="flex items-center justify-center gap-2 text-xs text-brand py-2">
                <Loader2 size={14} className="animate-spin" /> Finding your food…
              </div>
            ) : (
              <button onClick={onAskAi} disabled={!aiConfigured}
                className="btn-primary w-full py-2.5 rounded-xl text-sm justify-center">
                <Sparkles size={14} /> Search further
              </button>
            )}
            {!aiConfigured && (
              <p className="text-xs text-text-muted">Add a free API key in Settings → AI Assistant to enable this</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step: build the meal (multi-item, portions, next-food suggestions) ─────
function BuilderStep({ category, items, onChangePortion, onRemove, onAddMore, suggestions, onAddSuggested, onFinish }) {
  const meta = MEAL_META[category]
  const total = items.reduce((s, i) => s + (i.kcalPerPortion || 0) * (i.portions || 1), 0)
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
        <p className="section-label">Meal Items ({items.length}){total > 0 ? ` · ${Math.round(total)} kcal` : ''}</p>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-surface-elevated">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{item.label}</p>
              <p className="text-xs text-text-muted">{ptsLabel(item)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onChangePortion(idx, -0.5)} className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center"><Minus size={11} /></button>
              <span className="w-9 text-center text-xs font-semibold tabular-nums text-text-primary">×{item.portions}</span>
              <button onClick={() => onChangePortion(idx, 0.5)} className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center"><Plus size={11} /></button>
            </div>
            <button onClick={() => onRemove(idx)} className="w-7 h-7 rounded-lg text-text-muted hover:text-danger flex items-center justify-center"><X size={13} /></button>
          </div>
        ))}

        {suggestions.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="section-label">Frequently added with this</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button key={s.label} onClick={() => onAddSuggested(s.label)} className="pill-option">
                  <Plus size={11} className="inline mr-1" />{s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={onAddMore} className="flex items-center gap-1.5 text-xs font-medium py-1" style={{ color: meta.color }}>
          <Plus size={13} />Add another item
        </button>
      </div>

      <div className="px-4 pt-4 pb-6 border-t border-surface-border shrink-0">
        <button onClick={onFinish} className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm" style={{ background: meta.color }}>
          Finish Meal
        </button>
      </div>
    </div>
  )
}

function DuplicateStep({ onUpdate, onLogAnyway }) {
  return (
    <div className="px-4 py-6 space-y-4 text-center">
      <p className="text-3xl">🤔</p>
      <p className="text-sm font-semibold text-text-primary">It looks like you recently logged a similar meal.</p>
      <div className="space-y-2 pt-2">
        <button onClick={onUpdate} className="btn-outline w-full py-3 rounded-xl text-sm justify-center">Update previous meal</button>
        <button onClick={onLogAnyway} className="btn-primary w-full py-3 rounded-xl text-sm justify-center">Log anyway</button>
      </div>
    </div>
  )
}

function ConfirmationStep({ category, nutrition, healthScore, onDone }) {
  const meta = MEAL_META[category]
  return (
    <div className="px-4 py-6 space-y-4 text-center">
      <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
        <Check size={28} className="text-success" />
      </div>
      <div>
        <p className="text-base font-bold text-text-primary">Meal Logged!</p>
        <p className="text-xs text-text-muted">Great choice</p>
      </div>
      {nutrition && (
        <div className="rounded-2xl bg-surface-elevated p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm"><span className="text-text-muted">Calories</span><span className="font-semibold text-text-primary">{nutrition.kcal} kcal</span></div>
          <div className="flex justify-between text-sm"><span className="text-text-muted">Protein</span><span className="font-semibold text-text-primary">{nutrition.protein} g</span></div>
          <div className="flex justify-between text-sm"><span className="text-text-muted">Carbs</span><span className="font-semibold text-text-primary">{nutrition.carbs} g</span></div>
          <div className="flex justify-between text-sm"><span className="text-text-muted">Fat</span><span className="font-semibold text-text-primary">{nutrition.fat} g</span></div>
          <div className="flex justify-between text-sm pt-2 border-t border-surface-border"><span className="text-text-muted">Health Score</span><span className="font-semibold" style={{ color: meta.color }}>{healthScore}/100</span></div>
        </div>
      )}
      <button onClick={onDone} className="btn-primary w-full py-3.5 rounded-2xl text-sm justify-center">Done</button>
    </div>
  )
}

// ── Main orchestrator ────────────────────────────────────────────────────────
export default function AddMealFlow({ open, presetCategory, onClose, onLogged }) {
  const [step, setStep] = useState('browse')
  const [category, setCategory] = useState(presetCategory || defaultCategoryForTime())
  const [catMenuOpen, setCatMenuOpen] = useState(false)
  const [foods, setFoods] = useState([])
  const [aiConfig, setAiConfig] = useState({})
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [frequentMeals, setFrequentMeals] = useState([])
  const [recentMeals, setRecentMeals] = useState([])
  const [recentFoods, setRecentFoods] = useState([])
  const [favorites, setFavorites] = useState([])
  const [mealNames, setMealNames] = useState({})
  const [yesterdayMeal, setYesterdayMeal] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [duplicateInfo, setDuplicateInfo] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const searchInputRef = useRef(null)

  // Focus the search input only once the sheet has actually opened onto the
  // browse step — never on mount, since BottomSheet keeps children mounted
  // permanently and just CSS-hides them, so a raw autoFocus here would pop
  // the phone's keyboard on every screen that renders this component.
  useEffect(() => {
    if (!open || step !== 'browse') return
    const t = setTimeout(() => searchInputRef.current?.focus(), 320)
    return () => clearTimeout(t)
  }, [open, step])

  // Defensively drop focus when the sheet closes so the keyboard doesn't
  // linger behind it.
  useEffect(() => {
    if (!open) searchInputRef.current?.blur()
  }, [open])

  // Reset + load base data whenever the sheet opens. Category is guessed from
  // the current time (or the preset from an Activity meal-section tap) but
  // stays changeable via the header chip — see CategoryPicker.
  useEffect(() => {
    if (!open) return
    setStep('browse')
    setCategory(presetCategory || defaultCategoryForTime())
    setCatMenuOpen(false)
    setQuery(''); setItems([]); setDuplicateInfo(null); setConfirmation(null)
    getFoods().then(setFoods)
    getConfig().then(rows => {
      const map = {}
      rows.forEach(r => { map[r.key] = r.value })
      setAiConfig({ openrouter_api_key: map.openrouter_api_key, groq_api_key: map.groq_api_key })
    })
  }, [open, presetCategory])

  // Load recommendations whenever we land on the browse step for a category
  useEffect(() => {
    if (step !== 'browse' || !category) return
    getFrequentMeals(category).then(setFrequentMeals)
    getRecentMeals(category).then(setRecentMeals)
    getRecentFoods(category).then(setRecentFoods)
    getFavoriteFingerprints().then(setFavorites)
    getMealNames().then(setMealNames)
    getYesterdayMeal(category).then(setYesterdayMeal)
  }, [step, category])

  // Recompute "frequently added with this" whenever the builder's item set changes
  useEffect(() => {
    if (step !== 'builder') return
    suggestNextFoodsFor(items).then(setSuggestions)
  }, [step, items])

  const results = useMemo(() => (query ? searchFoods(query, foods) : []), [query, foods])
  const aiConfigured = hasLlmKey(aiConfig)

  const changeCategory = (cat) => { setCategory(cat); setCatMenuOpen(false); setQuery('') }

  const renameMeal = async (fingerprint, name) => {
    const updated = await setMealName(fingerprint, name)
    setMealNames(updated)
  }

  const addPickedFood = async (food) => {
    const learned = await getLearnedPortion(food.id)
    const time = format(new Date(), 'HH:mm')
    setItems(prev => [...prev, itemFromFood(food, category, learned || 1, time)])
    setQuery('')
    setStep('builder')
  }

  const addSuggestedByLabel = async (label) => {
    const food = foods.find(f => f.label === label)
    if (!food) return
    await addPickedFood(food)
  }

  const logWholeMeal = async (mealOrTemplate) => {
    const time = format(new Date(), 'HH:mm')
    const newItems = mealOrTemplate.foodItems.map(i => ({ ...i, mealType: category, time }))
    setItems(newItems)
    await finish(newItems)
  }

  const askAi = async () => {
    if (!query.trim()) return
    setAiLoading(true)
    try {
      const result = await analyzeFoodWithAI(query.trim(), aiConfig)
      const saved = await saveFood({ label: result.name, category: result.category, points: result.points, idealPortions: result.idealPortions, kcal: result.kcal, protein: result.protein, carbs: result.carbs, fat: result.fat, source: 'ai', aliases: [] })
      setFoods(prev => [...prev, saved])
      toast.success(`Added "${saved.label}" — future searches won't need AI again`)
      await addPickedFood(saved)
    } catch (e) {
      toast.error(e.message || 'AI search failed')
    } finally {
      setAiLoading(false)
    }
  }

  const changePortion = (idx, delta) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, portions: Math.max(0.5, Math.round((it.portions + delta) * 2) / 2) } : it))
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const appendToTodayDiet = async (newItems) => {
    const diet = (await getDiet(today())) || { meal_items: [], meal_times: {}, notes: '', date: today() }
    await saveDiet({ ...diet, date: today(), meal_items: [...(diet.meal_items || []), ...newItems] })
  }

  const finish = async (finalItems = items) => {
    if (finalItems.length === 0) return toast.error('Add at least one food')
    const cat = category
    const result = await saveMeal({ category: cat, date: today(), foodItems: finalItems })
    if (!result.saved) {
      setDuplicateInfo(result.duplicate)
      setStep('duplicate')
      return
    }
    await appendToTodayDiet(finalItems)
    setConfirmation({ nutrition: result.meal.nutritionSummary, healthScore: result.meal.healthScore })
    setStep('confirmation')
    onLogged?.()
  }

  const resolveDuplicateLogAnyway = async () => {
    const cat = category
    const meal = await forceLogMeal({ category: cat, date: today(), foodItems: items })
    await appendToTodayDiet(items)
    setConfirmation({ nutrition: meal.nutritionSummary, healthScore: meal.healthScore })
    setStep('confirmation')
    onLogged?.()
  }

  const resolveDuplicateUpdate = async () => {
    // Corrects the historical record in place; today's diet log already has
    // the previous log's items, so we don't append again here.
    const meal = await updateMeal(duplicateInfo.previousMeal.id, items)
    setConfirmation({ nutrition: meal.nutritionSummary, healthScore: meal.healthScore })
    setStep('confirmation')
    onLogged?.()
  }

  const done = () => { onClose(); }

  const title = step === 'confirmation' ? null : `${MEAL_META[category].icon} ${MEAL_META[category].label}`

  return (
    <BottomSheet open={open} onClose={onClose} title={title} zIndex={80}
      headerRight={step === 'browse' ? (
        <CategoryPicker category={category} open={catMenuOpen} onToggle={() => setCatMenuOpen(o => !o)} onSelect={changeCategory} />
      ) : null}
    >
      {step === 'browse' && (
        <BrowseStep
          category={category} foods={foods} query={query} setQuery={setQuery} results={results}
          aiLoading={aiLoading} aiConfigured={aiConfigured} onAskAi={askAi}
          frequentMeals={frequentMeals} recentMeals={recentMeals} recentFoods={recentFoods} favorites={favorites}
          yesterdayMeal={yesterdayMeal} mealNames={mealNames}
          onPickFood={addPickedFood} onLogWholeMeal={logWholeMeal}
          onToggleFavorite={(fp) => toggleFavoriteMeal(fp).then(setFavorites)}
          onRenameMeal={renameMeal}
          searchInputRef={searchInputRef}
        />
      )}
      {step === 'builder' && (
        <BuilderStep
          category={category} items={items}
          onChangePortion={changePortion} onRemove={removeItem}
          onAddMore={() => setStep('browse')}
          suggestions={suggestions} onAddSuggested={addSuggestedByLabel}
          onFinish={() => finish()}
        />
      )}
      {step === 'duplicate' && <DuplicateStep onUpdate={resolveDuplicateUpdate} onLogAnyway={resolveDuplicateLogAnyway} />}
      {step === 'confirmation' && confirmation && (
        <ConfirmationStep category={category} nutrition={confirmation.nutrition} healthScore={confirmation.healthScore} onDone={done} />
      )}
    </BottomSheet>
  )
}
