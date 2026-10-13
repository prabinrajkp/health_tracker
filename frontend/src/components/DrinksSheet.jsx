import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Utensils } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { DRINK_KINDS, DRINK_KIND_LABELS, formatLitres } from '../services/hydration'
import { MEAL_META } from '../constants/mealMeta'

// The full drinks control, opened on demand from the Today card or the Drinks
// row on the Food log. Most drinks are one tap on those; this is for a bigger
// amount, something other than water, or removing a mistake.
//
// `water` is the caller's useWater() instance, so the sheet and whatever
// opened it always show the same numbers.
export default function DrinksSheet({ open, onClose, water }) {
  const navigate = useNavigate()
  const { entries, fromMeals, totals, goal, targetMl, glassMl, add, remove } = water
  const [kind, setKind] = useState('water')
  const hasGoal = targetMl > 0
  const pct     = hasGoal ? Math.min((totals.totalMl / targetMl) * 100, 100) : 0
  const tapped  = [...entries].reverse()

  const go = (path) => { onClose(); navigate(path) }

  return (
    <BottomSheet open={open} onClose={onClose} title="Drinks">
      <div className="px-4 py-4 space-y-5">

        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="t-number">{formatLitres(totals.totalMl)}</span>
            {hasGoal && <span className="text-sm text-text-muted">of {formatLitres(targetMl)}</span>}
          </p>
          {hasGoal && (
            <div className="progress-track mt-2">
              <div className="progress-fill" style={{ width: `${pct}%`, background: 'rgb(var(--c-water))' }} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-1 bg-surface-elevated rounded-full p-1" role="radiogroup" aria-label="Type of drink">
            {DRINK_KINDS.map(k => (
              <button key={k.id} onClick={() => setKind(k.id)} role="radio" aria-checked={kind === k.id}
                className={`flex-1 py-2 rounded-full text-sm transition-colors ${kind === k.id ? 'bg-surface-card text-text-primary font-semibold' : 'text-text-secondary font-medium'}`}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[[glassMl, 'Glass'], [500, null], [1000, null]].map(([ml, name]) => (
              <button key={`${ml}-${name}`} onClick={() => add(ml, kind)} className="btn-ghost flex-1 flex-col gap-0 py-2.5"
                aria-label={`Add ${ml} mL of ${DRINK_KIND_LABELS[kind].toLowerCase()}`}>
                <span className="flex items-center gap-1"><Plus size={14} />{name || (ml >= 1000 ? `${ml / 1000} L` : `${ml} mL`)}</span>
                {name && <span className="text-xs font-normal text-text-muted">{ml} mL</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Counted automatically — shown so nobody logs the same coffee twice */}
        {fromMeals.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="section-label">From your meals</h3>
              <span className="text-sm text-text-muted tabular-nums">{formatLitres(totals.mealMl)}</span>
            </div>
            <div className="group-list">
              {fromMeals.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Utensils size={16} className="text-text-muted shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-base text-text-primary truncate">{d.label}</span>
                    <span className="block text-sm text-text-secondary">{MEAL_META[d.mealType]?.label || 'Meal'}{d.time ? ` · ${d.time}` : ''}</span>
                  </span>
                  <span className="text-sm text-text-secondary tabular-nums">{d.ml} mL</span>
                </div>
              ))}
            </div>
            <p className="t-caption mt-1">
              Already counted, so there is no need to add these again.{' '}
              <button onClick={() => go('/log?tab=food')} className="font-semibold text-brand-light">Edit in Food</button>
            </p>
          </section>
        )}

        {tapped.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="section-label">Added here</h3>
              <span className="text-sm text-text-muted tabular-nums">{formatLitres(totals.tappedMl)}</span>
            </div>
            <div className="group-list">
              {tapped.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-sm text-text-muted tabular-nums w-12 shrink-0">{e.time}</span>
                  <span className="text-base text-text-primary flex-1">{DRINK_KIND_LABELS[e.kind] || 'Water'}</span>
                  <span className="text-sm text-text-secondary tabular-nums">{e.ml} mL</span>
                  <button onClick={() => remove(e.id)} aria-label={`Remove ${e.ml} mL at ${e.time}`}
                    className="w-9 h-9 text-text-muted flex items-center justify-center shrink-0"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="t-caption pb-2">
          {goal?.basis === 'off' ? 'No daily goal is set. ' : 'The goal is an estimate, not a requirement. '}
          <button onClick={() => go('/settings?section=water')} className="font-semibold text-brand-light">About this goal</button>
        </p>
      </div>
    </BottomSheet>
  )
}
