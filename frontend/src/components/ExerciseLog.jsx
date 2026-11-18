import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { Plus, Minus, Trash2, Sparkles, Loader2, RotateCcw, ChevronDown, AlertTriangle, BookmarkPlus } from 'lucide-react'
import { EXERCISES, EXERCISE_BY_ID, QUICK_ADD } from '../services/exerciseLibrary'
import {
  itemsFromText, makeItem, withEntry, itemsKcal, insideSession, describeItem, liftHistory, isNewBest, copyItems,
  normalise, countedMinutes,
} from '../services/workoutItems'
import { mapExercisesWithAI, hasLlmKey } from '../services/llmApi'
import { fmtKcal } from '../services/energy'

// The day's exercise as a list: type a whole workout in your own words, add a common
// one with one tap, or repeat an earlier session. Calories come from each exercise's
// METs, the minutes and your weight; the AI only names exercises the app doesn't know.
// See docs/workout_logging_plan.md.

const EFFORTS = [['normal', 'Normal'], ['hard', 'Hard']]
const PLACEHOLDER = 'bench 3x10 60kg, squats 3x8 80kg, 20 min cycling'

function NumberField({ label, value, onChange, step = 1, suffix }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="t-caption block mb-1">{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" inputMode="decimal" step={step} min="0" value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
          className="input py-2 px-3 text-center tabular-nums" />
        {suffix && <span className="text-sm text-text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

function LiftProgress({ history }) {
  if (!history.sessions.length) return null
  return (
    <div className="tile space-y-1">
      <p className="t-caption">Earlier sessions{history.best ? ` · best ${history.best.kg} kg × ${history.best.reps}` : ''}</p>
      {history.sessions.slice(0, 4).map((s, i) => (
        <p key={i} className="text-sm text-text-secondary tabular-nums flex justify-between">
          <span>{format(parseISO(s.date), 'EEE d MMM')}</span>
          <span>{s.sets} × {s.reps} · {s.kg} kg</span>
        </p>
      ))}
    </div>
  )
}

function ItemEditor({ item, onChange, onRemove, history, aiReady, onAskAi, asking }) {
  const entry = EXERCISE_BY_ID[item.library]
  const set = (patch) => onChange({ ...item, ...patch })
  return (
    <div className="pb-4 space-y-3">
      {!entry && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Which exercise is "{item.text || item.name}"? Pick the closest, so its calories can be worked out.</p>
          <select className="input" value="" onChange={e => e.target.value && onChange(withEntry(item, EXERCISE_BY_ID[e.target.value]))}>
            <option value="">Choose an exercise…</option>
            {EXERCISES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {aiReady && (
            <button onClick={onAskAi} disabled={asking} className="btn-ghost w-full">
              {asking ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}Ask AI which one it is
            </button>
          )}
        </div>
      )}
      {entry?.kind === 'strength' && (
        <div className="flex gap-2">
          <NumberField label="Sets" value={item.sets} onChange={v => set({ sets: v, ...(item.minutesEstimated ? { minutes: (v || 3) * 2 } : {}) })} />
          <NumberField label="Reps" value={item.reps} onChange={v => set({ reps: v })} />
          <NumberField label="Weight" value={item.kg} step={0.5} suffix="kg" onChange={v => set({ kg: v })} />
        </div>
      )}
      {entry && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary flex-1">Minutes{item.minutesEstimated ? ' (estimated)' : ''}</span>
          <button onClick={() => set({ minutes: Math.max(1, (item.minutes || 0) - 5), minutesEstimated: false })} aria-label="5 minutes less" className="icon-btn"><Minus size={16} /></button>
          <span className="w-10 text-center tabular-nums font-semibold text-text-primary">{Math.round(item.minutes || 0)}</span>
          <button onClick={() => set({ minutes: (item.minutes || 0) + 5, minutesEstimated: false })} aria-label="5 minutes more" className="icon-btn"><Plus size={16} /></button>
        </div>
      )}
      {entry && (
        <div className="flex gap-2">
          {EFFORTS.map(([id, label]) => (
            <button key={id} onClick={() => set({ effort: id })} className={item.effort === id ? 'pill-option-active' : 'pill-option'} style={{ minWidth: 72 }}>{label}</button>
          ))}
        </div>
      )}
      {entry?.kind === 'strength' && <LiftProgress history={history} />}
      <button onClick={onRemove} className="flex items-center gap-1.5 text-sm font-semibold text-danger py-1"><Trash2 size={15} />Remove</button>
    </div>
  )
}

/**
 * items:    today's workout_items
 * onChange: (items) => void, saves the list (and the summary fields worked out from it)
 * context:  { kg, heightCm, steps, hideCalories, config, earlier, points, done }
 * onLearn:  ({ [name]: libraryId }) => void, remembers matched names
 * onRoutines: (routines) => void, saves the routine list
 */
export default function ExerciseLog({ items, onChange, context, onLearn, onRoutines }) {
  const { kg, heightCm, steps, hideCalories, config = {}, earlier = [], points, done } = context
  const [text, setText] = useState('')
  const [open, setOpen] = useState(null)
  const [asking, setAsking] = useState(false)
  const [naming, setNaming] = useState(null)   // routine name being typed

  const learned = useMemo(() => { try { return JSON.parse(config.exercise_aliases || '{}') } catch { return {} } }, [config.exercise_aliases])
  const routines = useMemo(() => { try { return JSON.parse(config.workout_routines || '[]') } catch { return [] } }, [config.workout_routines])
  const aiReady = hasLlmKey(config)
  const kcal = itemsKcal(items, { kg, heightCm, steps })
  const kcalOf = Object.fromEntries(kcal.per.map(p => [p.id, p]))
  const totalMinutes = Math.round(items.reduce((s, i) => s + countedMinutes(i, items), 0))
  const lastWorkout = earlier.find(w => (w.workout_items || []).some(i => i.kind !== 'unknown'))

  // A heavier set, or more reps at the same weight, than any earlier session
  const announceBests = (next) => {
    for (const item of next) {
      if (item.kind !== 'strength' || !item.kg) continue
      const before = items.find(i => i.id === item.id)
      if (before && before.kg === item.kg && before.reps === item.reps) continue
      const { best } = liftHistory(earlier, item.library)
      if (isNewBest(item, best)) toast.success(`New best on ${item.name}: ${item.kg} kg × ${item.reps || 1}`)
    }
  }
  const save = (next) => { announceBests(next); onChange(next) }

  // Names the library doesn't know go to the AI once; what it matches is remembered
  const askAi = async (list) => {
    const unknown = [...new Set(list.filter(i => i.kind === 'unknown').map(i => i.text || i.name))]
    if (!unknown.length || !aiReady) return list
    setAsking(true)
    try {
      const found = await mapExercisesWithAI(unknown, EXERCISES, config)
      const remember = {}
      const next = list.map(i => {
        const hit = i.kind === 'unknown' && found[i.text || i.name]
        if (!hit) return i
        remember[normalise(i.text || i.name)] = hit.library
        return { ...withEntry(i, EXERCISE_BY_ID[hit.library]), effort: hit.effort }
      })
      if (Object.keys(remember).length) onLearn(remember)
      const left = next.filter(i => i.kind === 'unknown').length
      if (left) toast(`${left} still not recognised. Pick the closest from the list.`)
      return next
    } catch (e) {
      toast.error(e.message || 'AI lookup failed. Pick the exercise from the list.')
      return list
    } finally {
      setAsking(false)
    }
  }

  const addText = async () => {
    const added = itemsFromText(text, learned)
    if (!added.length) return
    setText('')
    const next = await askAi([...items, ...added])
    save(next)
    const unknown = next.find(i => i.kind === 'unknown')
    if (unknown) setOpen(unknown.id)
  }

  const quickAdd = (id) => {
    const item = makeItem({ name: '' }, EXERCISE_BY_ID[id])
    save([...items, item])
    setOpen(item.id)
  }

  const update = (next) => {
    // A name matched by hand is remembered, as the AI's are
    const before = items.find(i => i.id === next.id)
    if (before?.kind === 'unknown' && next.library) onLearn({ [normalise(before.text || before.name)]: next.library })
    save(items.map(i => (i.id === next.id ? next : i)))
  }

  const saveRoutine = () => {
    const name = (naming || '').trim()
    if (!name) return
    const template = items.filter(i => i.kind !== 'unknown').map(({ id, time, ...rest }) => rest)
    onRoutines([...routines.filter(r => r.name !== name), { name, items: template }])
    setNaming(null)
    toast.success(`Saved "${name}"`)
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="t-heading">Exercise</h2>
          <p className="text-sm text-text-secondary">45 minutes or more in total for full points</p>
        </div>
        <span className={`text-sm tabular-nums ${done ? 'text-success font-semibold' : 'text-text-muted'}`}>+{points} pts</span>
      </div>

      {items.length > 0 && (
        <div className="group-list">
          {items.map(item => {
            const entry = EXERCISE_BY_ID[item.library]
            const k = kcalOf[item.id]
            const note = !entry ? null
              : insideSession(item, items) ? 'Part of your session'
              : k?.stepsCounted > 0 && k.kcal < 1 ? 'Counted in your steps'
              : hideCalories ? null : `~${Math.round(k?.kcal || 0)} kcal`
            return (
              <div key={item.id}>
                <button onClick={() => setOpen(open === item.id ? null : item.id)} className="w-full flex items-center gap-3 py-3 text-left" aria-expanded={open === item.id}>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-base font-medium text-text-primary">
                      {!entry && <AlertTriangle size={15} className="text-warning shrink-0" />}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="block text-sm text-text-secondary tabular-nums">
                      {!entry ? 'Not recognised: tap to choose' : [describeItem(item), item.effort === 'hard' ? 'Hard' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {note && <span className="text-sm text-text-muted tabular-nums shrink-0">{note}</span>}
                  <ChevronDown size={16} className={`text-text-muted shrink-0 transition-transform ${open === item.id ? 'rotate-180' : ''}`} />
                </button>
                {open === item.id && (
                  <ItemEditor item={item} onChange={update} history={liftHistory(earlier, item.library)}
                    onRemove={() => { save(items.filter(i => i.id !== item.id)); setOpen(null) }}
                    aiReady={aiReady} asking={asking}
                    onAskAi={async () => save(await askAi(items))} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-sm text-text-secondary tabular-nums">
          Total {totalMinutes} min{!hideCalories && kg ? ` · about ${fmtKcal(kcal.total).slice(1)} kcal` : ''}
        </p>
      )}

      <div className="space-y-2">
        <label className="t-caption block" htmlFor="exercise-text">Describe your workout</label>
        <textarea id="exercise-text" rows={2} className="input resize-none" placeholder={PLACEHOLDER}
          value={text} onChange={e => setText(e.target.value)} />
        <button onClick={addText} disabled={!text.trim() || asking} className="btn-primary w-full">
          {asking ? <><Loader2 size={15} className="animate-spin" />Matching exercises…</> : <><Plus size={15} />Add</>}
        </button>
      </div>

      <div className="space-y-2">
        <p className="t-caption">Or one tap</p>
        <div className="flex gap-2 flex-wrap">
          {QUICK_ADD.map(id => (
            <button key={id} onClick={() => quickAdd(id)} className="pill-option" style={{ flex: '0 0 auto' }}>{EXERCISE_BY_ID[id].name.replace(' session', '').replace(' exercise', '')}</button>
          ))}
          {routines.map(r => (
            <button key={r.name} onClick={() => save([...items, ...copyItems(r.items)])} className="pill-option" style={{ flex: '0 0 auto' }}>{r.name}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {lastWorkout && (
          <button onClick={() => save([...items, ...copyItems(lastWorkout.workout_items)])} className="flex items-center gap-1.5 text-sm font-semibold text-brand-light py-1">
            <RotateCcw size={14} />Repeat {format(parseISO(lastWorkout.date), 'EEEE')}'s workout
          </button>
        )}
        {items.some(i => i.kind !== 'unknown') && naming == null && (
          <button onClick={() => setNaming('')} className="flex items-center gap-1.5 text-sm font-semibold text-brand-light py-1">
            <BookmarkPlus size={14} />Save as a routine
          </button>
        )}
      </div>
      {naming != null && (
        <div className="flex gap-2">
          <input autoFocus className="input flex-1" placeholder="Name, e.g. Push day" value={naming}
            onChange={e => setNaming(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveRoutine()} />
          <button onClick={saveRoutine} className="btn-primary px-4">Save</button>
          <button onClick={() => setNaming(null)} className="btn-ghost px-4">Cancel</button>
        </div>
      )}
    </section>
  )
}
