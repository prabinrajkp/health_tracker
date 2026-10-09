import { format } from 'date-fns'
import db from './db'
import { getBadgeStates } from './badgeEngine'

const TIER_XP       = { common: 10, rare: 25, epic: 50, legendary: 100 }
const TIER_PRESTIGE = { common: 1,  rare: 3,  epic: 8,  legendary: 20  }

// XP required to REACH level N: sum(1..N) * 60
function xpForLevel(level) {
  return level <= 0 ? 0 : level * (level + 1) * 60
}

export function parseLevelFromXP(totalXP) {
  let level = 1
  while (xpForLevel(level) <= totalXP) level++
  const prevThreshold = xpForLevel(level - 1)
  const nextThreshold = xpForLevel(level)
  return {
    level: level - 1,
    currentXP: totalXP - prevThreshold,
    nextLevelXP: nextThreshold - prevThreshold,
    totalXP,
  }
}

export async function computePrestige() {
  const [allScores, badgeStates] = await Promise.all([
    db.daily_scores.orderBy('date').toArray(),
    getBadgeStates(),
  ])

  const scoreXP = allScores.reduce((s, r) => s + Math.round((r.total_score || 0) / 5), 0)
  const unlockedBadges = badgeStates.filter(b => b.unlocked)
  const badgeXP = unlockedBadges.reduce((s, b) => s + (TIER_XP[b.tier] || 10), 0)
  const totalXP = scoreXP + badgeXP

  const prestige = unlockedBadges.reduce((s, b) => s + (TIER_PRESTIGE[b.tier] || 1), 0)

  // Streak for prestige bonus
  const sorted = allScores.map(s => s.date)
  let maxStreak = sorted.length > 0 ? 1 : 0, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i]+'T00:00:00') - new Date(sorted[i-1]+'T00:00:00')) / 86400000)
    cur = diff === 1 ? cur + 1 : 1
    if (cur > maxStreak) maxStreak = cur
  }
  const streakPrestige = maxStreak >= 14 ? 30 : maxStreak >= 7 ? 15 : maxStreak >= 3 ? 5 : 0
  const totalPrestige = prestige + streakPrestige

  const levelData = parseLevelFromXP(totalXP)

  return {
    ...levelData,
    prestige: totalPrestige,
    maxStreak,
    totalDays: allScores.length,
    unlockedBadgeCount: unlockedBadges.length,
    legendaryCount: unlockedBadges.filter(b => b.tier === 'legendary').length,
    epicCount: unlockedBadges.filter(b => b.tier === 'epic').length,
  }
}

export function getAuraStyle(level = 1) {
  if (level >= 20) return { color: '#f59e0b', shadow: '0 0 32px #f59e0b90, 0 0 64px #f59e0b40', label: 'Legendary Aura' }
  if (level >= 15) return { color: '#a78bfa', shadow: '0 0 28px #a78bfa80, 0 0 56px #a78bfa35', label: 'Epic Aura' }
  if (level >= 10) return { color: '#22c55e', shadow: '0 0 20px #22c55e70, 0 0 40px #22c55e30', label: 'Rare Aura' }
  if (level >= 5)  return { color: '#38bdf8', shadow: '0 0 16px #38bdf860, 0 0 32px #38bdf825', label: 'Rising Aura' }
  return { color: '#94a3b8', shadow: '0 0 10px #94a3b840', label: 'Starter Aura' }
}

export function computeActiveTitle(prestige, badgeStates = []) {
  const unlocked = badgeStates.filter(b => b.unlocked)
  const hasLegendary = unlocked.some(b => b.tier === 'legendary')
  const hasEpic = unlocked.some(b => b.tier === 'epic')
  if (hasLegendary && prestige?.level >= 15) return 'Ascendant'
  if (hasLegendary && prestige?.level >= 10) return 'Legendary Cultivator'
  if (hasLegendary) return 'Badge Collector'
  if (hasEpic && prestige?.level >= 8)  return 'Elite Performer'
  if (hasEpic && prestige?.level >= 5)  return 'Rising Champion'
  if (prestige?.maxStreak >= 14)        return 'Discipline Titan'
  if (prestige?.maxStreak >= 7)         return 'Discipline Builder'
  if (prestige?.totalDays >= 20)        return 'Health Pioneer'
  if (prestige?.totalDays >= 5)         return 'Committed'
  return 'Newcomer'
}
