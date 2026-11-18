import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { getConfig, saveConfig } from '../api/client'
import { EXERCISE_BY_ID } from '../services/exerciseLibrary'
import { describeItem } from '../services/workoutItems'

// Settings → Your exercises: names the app learned (from you or the AI) and the
// routines you saved, each one tap to forget.
const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback } catch { return fallback } }

export default function ExerciseSettings() {
  const [learned, setLearned]   = useState({})
  const [routines, setRoutines] = useState([])

  useEffect(() => {
    getConfig().then(rows => {
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
      setLearned(parse(map.exercise_aliases, {}))
      setRoutines(parse(map.workout_routines, []))
    }).catch(() => {})
  }, [])

  const forget = async (name) => {
    const next = { ...learned }
    delete next[name]
    setLearned(next)
    await saveConfig({ key: 'exercise_aliases', value: JSON.stringify(next) })
    toast(`"${name}" will be matched afresh next time`)
  }

  const removeRoutine = async (name) => {
    const next = routines.filter(r => r.name !== name)
    setRoutines(next)
    await saveConfig({ key: 'workout_routines', value: JSON.stringify(next) })
  }

  const names = Object.entries(learned).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Calories for each exercise come from its activity level, the minutes and your weight. The AI only says which exercise a name means, and never sets a number.
      </p>

      <section>
        <h2 className="section-label">Names the app learned</h2>
        {names.length === 0 ? (
          <p className="text-sm text-text-secondary py-2">None yet. Names you match by hand or with AI appear here.</p>
        ) : (
          <div className="group-list">
            {names.map(([name, id]) => (
              <div key={name} className="flex items-center gap-3 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-base text-text-primary truncate">{name}</span>
                  <span className="block text-sm text-text-secondary">{EXERCISE_BY_ID[id]?.name || 'Unknown'}</span>
                </span>
                <button onClick={() => forget(name)} aria-label={`Forget ${name}`} className="icon-btn"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-label">Routines</h2>
        {routines.length === 0 ? (
          <p className="text-sm text-text-secondary py-2">None yet. Use "Save as a routine" under Log → Move.</p>
        ) : (
          <div className="group-list">
            {routines.map(r => (
              <div key={r.name} className="flex items-center gap-3 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-base text-text-primary">{r.name}</span>
                  <span className="block text-sm text-text-secondary truncate">
                    {r.items.map(i => [i.name, describeItem(i)].filter(Boolean).join(' ')).join(', ')}
                  </span>
                </span>
                <button onClick={() => removeRoutine(r.name)} aria-label={`Delete ${r.name}`} className="icon-btn"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
