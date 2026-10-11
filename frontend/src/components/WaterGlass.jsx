import { Check } from 'lucide-react'

// A glass that fills as drinks are logged. `fraction` is 0–1; at 1 it shows a
// tick and stays full — there is nothing more to see for drinking past the goal.
export default function WaterGlass({ fraction = 0, size = 56 }) {
  const f = Math.max(0, Math.min(fraction, 1))
  const w = size * 0.72, h = size
  // Inside of the glass in the 36×50 drawing: a tapered tumbler
  const top = 4, bottom = 46, inner = bottom - top
  const level = bottom - inner * f

  return (
    <div className="relative shrink-0" style={{ width: w, height: h }} role="img"
      aria-label={`${Math.round(f * 100)}% of today's drinks goal`}>
      <svg viewBox="0 0 36 50" width={w} height={h}>
        <defs>
          <clipPath id="hq-glass-shape">
            <path d="M5 4 H31 L28 44 Q28 46 26 46 H10 Q8 46 8 44 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#hq-glass-shape)">
          <rect x="0" y="0" width="36" height="50" fill="rgb(var(--c-surface-elevated))" />
          <rect x="0" width="36" height="50" fill="rgb(var(--c-water))"
            style={{ transform: `translateY(${level}px)`, transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        </g>
        <path d="M5 4 H31 L28 44 Q28 46 26 46 H10 Q8 46 8 44 Z" fill="none"
          stroke="rgb(var(--c-surface-muted))" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {f >= 1 && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check size={size * 0.34} strokeWidth={3} className="text-white" />
        </span>
      )}
    </div>
  )
}
