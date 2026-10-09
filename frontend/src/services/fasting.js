// Live fasting-window helpers for the Food log. The score itself is computed in
// scoring.js (calcFastingScore); this only describes the window for display.

export function fmtHours(h) {
  if (!h || h <= 0) return '0 min'
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60), mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}min`
}

export function mealTimeOf(diet, mealType) {
  const times = (diet?.meal_items || []).filter(i => i.mealType === mealType).map(i => i.time).filter(Boolean)
  if (times.length) {
    const sorted = [...times].sort()
    return mealType === 'dinner' ? sorted[sorted.length - 1] : sorted[0]
  }
  if (mealType === 'dinner') return diet?.meal_times?.dinner || diet?.dinner_time || null
  return diet?.meal_times?.[mealType] || null
}

function hoursSince(hhmm, daysAgo = 0) {
  const [h, m] = hhmm.split(':').map(Number)
  const at = new Date()
  at.setDate(at.getDate() - daysAgo)
  at.setHours(h, m, 0, 0)
  return (Date.now() - at.getTime()) / 3600000
}

export function fastingWindow(todayDiet, yesterdayDiet) {
  const todayDinner = mealTimeOf(todayDiet, 'dinner')
  if (todayDinner) {
    const hours = hoursSince(todayDinner)
    if (hours >= 0) return { lastDinner: todayDinner, firstBf: null, hours, complete: false, nextFast: true }
  }
  const lastDinner = mealTimeOf(yesterdayDiet, 'dinner')
  if (!lastDinner) return { lastDinner: null, firstBf: null, hours: 0, complete: false, nextFast: false }

  const firstBf = mealTimeOf(todayDiet, 'breakfast')
  if (firstBf) {
    const [dh, dm] = lastDinner.split(':').map(Number), [bh, bm] = firstBf.split(':').map(Number)
    let d = dh * 60 + dm, b = bh * 60 + bm
    if (b <= d) b += 24 * 60
    return { lastDinner, firstBf, hours: (b - d) / 60, complete: true, nextFast: false }
  }
  return { lastDinner, firstBf: null, hours: Math.max(0, hoursSince(lastDinner, 1)), complete: false, nextFast: false }
}

export function fastingPoints(hours, weights) {
  const fc      = weights?.fasting || {}
  const minH    = fc.min_hours    ?? 12
  const targetH = fc.target_hours ?? 16
  const maxPts  = fc.max_points   ?? 10
  if (hours < minH) return 0
  if (hours >= targetH + 2) return maxPts
  const mid = (minH + targetH) / 2
  const k   = 6 / Math.max(targetH - minH, 1)
  return Math.round(maxPts / (1 + Math.exp(-k * (hours - mid))) * 10) / 10
}
