const COMBOS = [
  {
    id: 'morning_engine',
    label: 'Morning Engine',
    icon: '⚡',
    color: '#f59e0b',
    check: (items) => items.filter(i => i.mealType === 'breakfast' && i.category === 'good').length >= 2,
    hint: (items) => {
      const n = items.filter(i => i.mealType === 'breakfast' && i.category === 'good').length
      if (n >= 2) return null
      return `Add ${2 - n} more good breakfast item${2 - n > 1 ? 's' : ''} → Morning Engine ⚡`
    },
  },
  {
    id: 'clean_fuel',
    label: 'Clean Fuel',
    icon: '🌿',
    color: '#22c55e',
    check: (items) => {
      const good = items.filter(i => i.category === 'good').length
      const bad  = items.filter(i => i.category === 'bad').length
      return good >= 3 && bad === 0
    },
    hint: (items) => {
      const bad = items.filter(i => i.category === 'bad').length
      if (bad > 0) return null
      const needed = Math.max(0, 3 - items.filter(i => i.category === 'good').length)
      if (needed === 0) return null
      return `Add ${needed} more clean item${needed > 1 ? 's' : ''} (no junk) → Clean Fuel 🌿`
    },
  },
  {
    id: 'bounce_back',
    label: 'Bounce Back',
    icon: '🔥',
    color: '#ef4444',
    check: (items) => {
      const mealOrder = ['breakfast', 'lunch', 'dinner', 'snacks']
      let foundBad = false, goodAfter = 0
      for (const meal of mealOrder) {
        const mi = items.filter(i => i.mealType === meal)
        if (!foundBad) {
          if (mi.some(i => i.category === 'bad')) foundBad = true
        } else {
          goodAfter += mi.filter(i => i.category === 'good').length
        }
      }
      return foundBad && goodAfter >= 2
    },
    hint: (items) => {
      if (!items.some(i => i.category === 'bad')) return null
      const mealOrder = ['breakfast', 'lunch', 'dinner', 'snacks']
      let foundBad = false, goodAfter = 0
      for (const meal of mealOrder) {
        const mi = items.filter(i => i.mealType === meal)
        if (!foundBad) {
          if (mi.some(i => i.category === 'bad')) foundBad = true
        } else {
          goodAfter += mi.filter(i => i.category === 'good').length
        }
      }
      if (!foundBad || goodAfter >= 2) return null
      const needed = 2 - goodAfter
      return `Add ${needed} good item${needed > 1 ? 's' : ''} after junk → Bounce Back 🔥`
    },
  },
  {
    id: 'discipline_chain',
    label: 'Discipline Chain',
    icon: '🎯',
    color: '#a78bfa',
    check: (items, times) => {
      const bf = times?.breakfast
      const dn = times?.dinner
      if (!bf || !dn) return false
      const [bh] = bf.split(':').map(Number)
      const [dh, dm] = dn.split(':').map(Number)
      return bh >= 7 && bh <= 9 && (dh < 20 || (dh === 20 && dm === 0))
    },
    hint: (items, times) => {
      const bf = times?.breakfast
      if (!bf) return 'Log breakfast 7–9 AM + dinner before 8 PM → Discipline Chain 🎯'
      const [bh] = bf.split(':').map(Number)
      if (bh < 7 || bh > 9) return 'Set breakfast time to 7–9 AM → Discipline Chain 🎯'
      const dn = times?.dinner
      if (!dn) return 'Log dinner before 8 PM → Discipline Chain 🎯'
      const [dh, dm] = dn.split(':').map(Number)
      return dh < 20 || (dh === 20 && dm === 0) ? null : 'Eat dinner before 8 PM → Discipline Chain 🎯'
    },
  },
  {
    id: 'recovery_sync',
    label: 'Recovery Sync',
    icon: '🌙',
    color: '#818cf8',
    check: (items, times) => {
      const dn = times?.dinner
      if (!dn) return false
      const [dh] = dn.split(':').map(Number)
      return dh < 20 && items.filter(i => i.mealType === 'dinner' && i.category === 'good').length >= 1
    },
    hint: (items, times) => {
      const dn = times?.dinner
      if (!dn) return 'Log dinner time + add a healthy dinner item → Recovery Sync 🌙'
      const [dh] = dn.split(':').map(Number)
      if (dh >= 20) return 'Eat dinner before 8 PM + healthy item → Recovery Sync 🌙'
      return items.filter(i => i.mealType === 'dinner' && i.category === 'good').length >= 1
        ? null
        : 'Add 1 healthy dinner item → Recovery Sync 🌙'
    },
  },
]

export function detectCombos(items, mealTimes) {
  if (!items?.length) return []
  return COMBOS.filter(c => c.check(items, mealTimes))
}

export function getMomentumState(streak) {
  if (streak >= 7) return { level: 4, label: 'Elite Momentum', icon: '💎', color: '#a78bfa' }
  if (streak >= 4) return { level: 3, label: 'High Momentum',  icon: '🔥', color: '#f59e0b' }
  if (streak >= 2) return { level: 2, label: 'Building',       icon: '⚡', color: '#22c55e' }
  return               { level: 1, label: 'Stable',             icon: '○',  color: '#64748b' }
}

export function getNextComboHint(items, mealTimes, activeCombos) {
  const activeIds = new Set((activeCombos || []).map(c => c.id))
  for (const combo of COMBOS) {
    if (activeIds.has(combo.id)) continue
    const h = combo.hint(items || [], mealTimes)
    if (h) return h
  }
  return null
}

export function getPerfectMealState(mealType, items) {
  const mi   = (items || []).filter(i => i.mealType === mealType)
  const good = mi.filter(i => i.category === 'good').length
  const bad  = mi.filter(i => i.category === 'bad').length
  if (good >= 2 && bad === 0) return { label: `Perfect ${mealType[0].toUpperCase() + mealType.slice(1)}`, color: '#22c55e' }
  return null
}

export function getDietRunState(items, combos, momentum) {
  if (!items?.length) return { label: 'Log your first meal', icon: '🍽️', color: '#64748b', glow: false }
  const good = items.filter(i => i.category === 'good').length
  const bad  = items.filter(i => i.category === 'bad').length
  if (combos.length >= 3 || momentum.level >= 4) return { label: 'Elite Run',      icon: '💎', color: '#a78bfa', glow: true  }
  if (combos.some(c => c.id === 'clean_fuel') || (good >= 4 && bad === 0))
    return { label: 'Clean Run',       icon: '🌿', color: '#22c55e', glow: true  }
  if (combos.some(c => c.id === 'bounce_back')) return { label: 'Recovery Active',  icon: '🔥', color: '#ef4444', glow: false }
  if (combos.length >= 1)  return { label: 'Combo Active',    icon: '⚡', color: '#f59e0b', glow: false }
  if (good > 0 && bad === 0) return { label: 'On Track',      icon: '✓',  color: '#22c55e', glow: false }
  if (bad > 0 && good > bad) return { label: 'Stay Strong',   icon: '💪', color: '#f59e0b', glow: false }
  return { label: 'Keep Going', icon: '→', color: '#64748b', glow: false }
}
