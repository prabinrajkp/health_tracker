export default function ScoreRing({ score = 0, max = 100, size = 160, label, color = '#7c3aed' }) {
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(score / max, 1)
  const dash = pct * circ
  const isHigh = score >= 80
  const isLegendary = score >= 92

  const scoreColor =
    score >= 80 ? '#a78bfa' :
    score >= 60 ? '#22c55e' :
    score >= 40 ? '#f59e0b' :
    '#ef4444'

  const uid = `sr${size}${Math.round(score)}`

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer breathing glow for high scores */}
        {isHigh && (
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              borderRadius: '50%',
              boxShadow: isLegendary
                ? `0 0 30px ${color}70, 0 0 60px ${color}30`
                : `0 0 18px ${color}50, 0 0 36px ${color}20`,
              animation: 'breatheRing 3s ease-in-out infinite',
            }} />
        )}

        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={isHigh ? '3' : '1.5'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.7" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>

          {/* Track ring */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="rgb(var(--c-surface-elevated))"
            strokeWidth={isHigh ? 10 : 8}
          />

          {/* Filled arc */}
          {pct > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={isHigh ? `url(#grad-${uid})` : color}
              strokeWidth={isHigh ? 10 : 8}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              filter={isHigh ? `url(#glow-${uid})` : undefined}
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
            />
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <span
            className="font-black tabular-nums leading-none"
            style={{
              fontSize: size > 140 ? '2.4rem' : '1.6rem',
              color: scoreColor,
              textShadow: isHigh ? `0 0 16px ${color}60` : 'none',
            }}>
            {Math.round(score)}
          </span>
          <span className="text-xs text-text-muted font-semibold mt-0.5">/ {max}</span>
          {isLegendary && (
            <span className="text-[9px] font-black mt-0.5 uppercase tracking-widest" style={{ color }}>
              ✦ MAX ✦
            </span>
          )}
        </div>
      </div>
      {label && <span className="text-xs font-semibold text-text-secondary">{label}</span>}
    </div>
  )
}
