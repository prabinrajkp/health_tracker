import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'

export const todayStr     = () => format(new Date(), 'yyyy-MM-dd')
export const TEXT_SAVE_MS = 600   // debounce for typed fields; taps save at once

// Saves the latest value handed to it. Taps go through immediately, typing is
// debounced, and writes run one at a time so a quick second change can never
// land before the first (or race it to create the day's row twice).
export function useAutoSave(saveFn) {
  const fn      = useRef(saveFn)
  const pending = useRef(null)
  const timer   = useRef(null)
  const chain   = useRef(Promise.resolve())
  fn.current = saveFn

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    if (pending.current === null) return chain.current
    const value = pending.current
    pending.current = null
    chain.current = chain.current.then(() => fn.current(value)).catch(e => console.error('autosave failed', e))
    return chain.current
  }, [])

  const save = useCallback((value, delay = 0) => {
    pending.current = value
    clearTimeout(timer.current)
    if (delay > 0) timer.current = setTimeout(flush, delay)
    else flush()
  }, [flush])

  // Leaving the screen mid-typing still saves what was typed.
  useEffect(() => () => { flush() }, [flush])

  return { save, flush }
}

// The section's own score: a number with its bar, no box around it.
export function SectionScore({ label, pts, max, color }) {
  const pct = max > 0 ? Math.min((pts / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="flex items-baseline gap-1.5">
          <span className="t-number">{Math.round(pts * 10) / 10}</span>
          <span className="text-sm text-text-muted">/ {max} pts</span>
        </p>
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label, sublabel, points }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 text-left py-3.5">
      <span className="flex-1 min-w-0">
        <span className="block text-base font-medium text-text-primary">{label}</span>
        {sublabel && <span className="block text-sm text-text-secondary">{sublabel}</span>}
      </span>
      {points != null && (
        <span className={`text-sm tabular-nums shrink-0 ${checked ? 'text-success font-semibold' : 'text-text-muted'}`}>+{points} pts</span>
      )}
      <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-brand' : 'bg-surface-border'}`}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: checked ? 22 : 2 }} />
      </span>
    </button>
  )
}

export function PillSelector({ options, value, onChange, formatter }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={value === o ? 'pill-option-active' : 'pill-option'}
          style={{ flex: '0 0 auto', minWidth: 56 }}>
          {formatter ? formatter(o) : o}
        </button>
      ))}
    </div>
  )
}

export function NoteField({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  if (!open && !value) return (
    <button onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-light py-2">Add a note</button>
  )
  return (
    <div>
      <label className="section-label block mb-2">Note</label>
      <textarea className="input resize-none" rows={2} placeholder={placeholder}
        value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
