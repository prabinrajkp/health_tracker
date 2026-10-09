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

export function SectionScore({ label, pts, max, color }) {
  const pct = max > 0 ? Math.min((pts / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="text-xs font-semibold text-text-secondary shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-elevated">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
        {Math.round(pts * 10) / 10}<span className="text-text-muted font-normal"> / {max} pts</span>
      </span>
    </div>
  )
}

export function Toggle({ checked, onChange, label, sublabel, points }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 text-left">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {sublabel && <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      {points != null && (
        <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0 ${checked ? 'bg-success/15 text-success' : 'bg-surface-elevated text-text-muted'}`}>
          +{points} pts
        </span>
      )}
      <span className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
        style={{ background: checked ? '#22c55e' : 'rgb(var(--c-surface-border))' }}>
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
          style={{ flex: '0 0 auto', minWidth: 52 }}>
          {formatter ? formatter(o) : o}
        </button>
      ))}
    </div>
  )
}

export function NoteField({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  if (!open && !value) return (
    <button onClick={() => setOpen(true)} className="text-xs font-semibold text-text-muted px-1 py-1">+ Add note</button>
  )
  return (
    <div className="card">
      <label className="section-label block mb-2">Note</label>
      <textarea className="input resize-none" rows={2} placeholder={placeholder}
        value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
