// Clock helpers shared by the notification rules.
export const toMinutes = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

export const fmtClock = (min) => {
  const total = ((min % 1440) + 1440) % 1440
  const h = Math.floor(total / 60), m = total % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`
}
