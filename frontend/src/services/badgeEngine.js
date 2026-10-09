import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import db from './db'

export const TIER_META = {
  common:    { color: '#94a3b8', glow: '#94a3b840', bg: '#94a3b812', label: 'Common',    anim: 'none' },
  rare:      { color: '#38bdf8', glow: '#38bdf850', bg: '#38bdf810', label: 'Rare',      anim: 'badgePulse 2.5s ease-in-out infinite' },
  epic:      { color: '#a78bfa', glow: '#a78bfa55', bg: '#a78bfa12', label: 'Epic',      anim: 'badgeEpicShimmer 3s ease-in-out infinite' },
  legendary: { color: '#f59e0b', glow: '#f59e0b65', bg: '#f59e0b12', label: 'Legendary', anim: 'badgeLegendaryAura 2.5s ease-in-out infinite' },
}

export const CATEGORY_META = {
  consistency: { label: 'Consistency', emoji: '🎯' },
  nutrition:   { label: 'Nutrition',   emoji: '🥗' },
  fitness:     { label: 'Fitness',     emoji: '💪' },
  sleep:       { label: 'Sleep',       emoji: '🌙' },
  comeback:    { label: 'Comeback',    emoji: '🦅' },
  elite:       { label: 'Elite',       emoji: '👑' },
}

export const BADGES = [
  // ── Consistency (18) ────────────────────────────────────────────────────
  { id: 'daily_logger',
    name: 'First Effort',      emoji: '📋', category: 'consistency', tier: 'common',
    lore: 'Your first real day. The body remembers every rep, every choice.',
    criterion: 'Score ≥50 on at least 1 day',
    check: d => ({ unlocked: d.qualityDays >= 1, progress: Math.min(d.qualityDays, 1) }) },

  { id: 'first_week',
    name: 'Active Week',       emoji: '📅', category: 'consistency', tier: 'common',
    lore: 'Seven quality days in the bank. The habit begins.',
    criterion: 'Score ≥50 on 7+ total days',
    check: d => ({ unlocked: d.qualityDays >= 7, progress: Math.min(d.qualityDays / 7, 1) }) },

  { id: 'fortnight_logger',
    name: 'Active Fortnight',  emoji: '🗓️', category: 'consistency', tier: 'common',
    lore: 'Fourteen quality days. You are building something real.',
    criterion: 'Score ≥50 on 14+ total days',
    check: d => ({ unlocked: d.qualityDays >= 14, progress: Math.min(d.qualityDays / 14, 1) }) },

  { id: 'thirty_club',
    name: 'Thirty Strong',     emoji: '🌟', category: 'consistency', tier: 'rare',
    lore: 'Thirty quality days of real effort. Your habits are hardening into identity.',
    criterion: 'Score ≥50 on 30+ total days',
    check: d => ({ unlocked: d.qualityDays >= 30, progress: Math.min(d.qualityDays / 30, 1) }) },

  { id: 'iron_logger',
    name: 'Iron Effort',       emoji: '🔩', category: 'consistency', tier: 'rare',
    lore: 'Sixty quality days of output. Iron will, iron habit.',
    criterion: 'Score ≥50 on 60+ total days',
    check: d => ({ unlocked: d.qualityDays >= 60, progress: Math.min(d.qualityDays / 60, 1) }) },

  { id: 'century_club',
    name: 'Century Club',      emoji: '💯', category: 'consistency', tier: 'epic',
    lore: 'One hundred quality days. You have crossed into the territory of true habit.',
    criterion: 'Score ≥50 on 100+ total days',
    check: d => ({ unlocked: d.qualityDays >= 100, progress: Math.min(d.qualityDays / 100, 1) }) },

  { id: 'double_century',
    name: 'Double Century',    emoji: '🏰', category: 'consistency', tier: 'legendary', hidden: true,
    lore: 'Two hundred quality days. Most people quit before this. You did not.',
    criterion: 'Score ≥50 on 200+ total days',
    check: d => ({ unlocked: d.qualityDays >= 200, progress: Math.min(d.qualityDays / 200, 1) }) },

  { id: 'year_of_health',
    name: 'Year of Health',    emoji: '🎆', category: 'consistency', tier: 'legendary', hidden: true,
    lore: 'Three hundred sixty-five quality days. A full year of your life, optimised.',
    criterion: 'Score ≥50 on 365+ total days',
    check: d => ({ unlocked: d.qualityDays >= 365, progress: Math.min(d.qualityDays / 365, 1) }) },

  { id: 'streak_starter',
    name: 'Streak Starter',    emoji: '🔥', category: 'consistency', tier: 'rare',
    lore: 'Three consecutive quality days — the foundation of all real habits.',
    criterion: '3-day quality streak (score ≥50 each day)',
    check: d => ({ unlocked: d.maxQualityStreak >= 3, progress: Math.min(d.maxQualityStreak / 3, 1) }) },

  { id: 'week_warrior',
    name: 'Week Warrior',      emoji: '⚔️', category: 'consistency', tier: 'epic',
    lore: 'Seven consecutive quality days. You are no longer just trying.',
    criterion: 'Score ≥50 for 7 consecutive days',
    check: d => ({ unlocked: d.maxQualityStreak >= 7, progress: Math.min(d.maxQualityStreak / 7, 1) }) },

  { id: 'streak_legend',
    name: 'Streak Legend',     emoji: '🌊', category: 'consistency', tier: 'rare',
    lore: 'Twenty-one consecutive quality days. Your streak is a force of nature.',
    criterion: '21-day quality streak (score ≥50 each day)',
    check: d => ({ unlocked: d.maxQualityStreak >= 21, progress: Math.min(d.maxQualityStreak / 21, 1) }) },

  { id: 'month_master',
    name: 'Month Master',      emoji: '🗺️', category: 'consistency', tier: 'epic',
    lore: 'Thirty quality days without pause. This is mastery of self.',
    criterion: '30-day quality streak (score ≥50 each day)',
    check: d => ({ unlocked: d.maxQualityStreak >= 30, progress: Math.min(d.maxQualityStreak / 30, 1) }) },

  { id: 'hyper_consistent',
    name: 'Hyper Consistent',  emoji: '⚡', category: 'consistency', tier: 'legendary', hidden: true,
    lore: 'Fourteen consecutive quality days. This is rare. This is powerful.',
    criterion: '14-day quality streak (score ≥50 each day)',
    check: d => ({ unlocked: d.maxQualityStreak >= 14, progress: Math.min(d.maxQualityStreak / 14, 1) }) },

  { id: 'iron_streak',
    name: 'Iron Streak',       emoji: '⚙️', category: 'consistency', tier: 'legendary', hidden: true,
    lore: 'Sixty quality days. Unbroken. You are not tracking health — you are health.',
    criterion: '60-day quality streak (score ≥50 each day)',
    check: d => ({ unlocked: d.maxQualityStreak >= 60, progress: Math.min(d.maxQualityStreak / 60, 1) }) },

  { id: 'perfect_week',
    name: 'Perfect Week',      emoji: '🏆', category: 'consistency', tier: 'epic',
    lore: 'Five golden days in a single week. This is what mastery looks like.',
    criterion: 'Score ≥70 on 5+ days in a single week',
    check: d => ({ unlocked: d.bestWeekIdealDays >= 5, progress: Math.min(d.bestWeekIdealDays / 5, 1) }) },

  { id: 'consistency_king',
    name: 'Consistency King',  emoji: '🎖️', category: 'consistency', tier: 'rare',
    lore: 'Three perfect weeks. Royalty is earned through repetition.',
    criterion: 'Perfect week (5+ ideal days) achieved 3+ times',
    check: d => ({ unlocked: d.weekPerfectCount >= 3, progress: Math.min(d.weekPerfectCount / 3, 1) }) },

  { id: 'perfect_month_run',
    name: 'Perfect Month',     emoji: '🌙', category: 'consistency', tier: 'epic',
    lore: 'Four perfect weeks. You have achieved something most cannot.',
    criterion: 'Perfect week achieved 4+ times',
    check: d => ({ unlocked: d.weekPerfectCount >= 4, progress: Math.min(d.weekPerfectCount / 4, 1) }) },

  { id: 'consistency_deity',
    name: 'Consistency Deity', emoji: '🌌', category: 'consistency', tier: 'legendary', hidden: true,
    lore: 'Eight perfect weeks. You have transcended routine — this is your nature.',
    criterion: 'Perfect week achieved 8+ times',
    check: d => ({ unlocked: d.weekPerfectCount >= 8, progress: Math.min(d.weekPerfectCount / 8, 1) }) },

  // ── Nutrition (13) ────────────────────────────────────────────────────────
  { id: 'breakfast_habit',
    name: 'Breakfast Habit',   emoji: '🌄', category: 'nutrition', tier: 'common',
    lore: 'Three mornings of fuel. Your metabolic engine is warming.',
    criterion: 'Log breakfast on 3+ days in a single week',
    check: d => ({ unlocked: d.bestBreakfastWeek >= 3, progress: Math.min(d.bestBreakfastWeek / 3, 1) }) },

  { id: 'breakfast_champion',
    name: 'Breakfast Champion', emoji: '🌅', category: 'nutrition', tier: 'rare',
    lore: 'Five morning meals in a week. Your energy baseline is unshakeable.',
    criterion: 'Log breakfast 5+ days in a single week',
    check: d => ({ unlocked: d.bestBreakfastWeek >= 5, progress: Math.min(d.bestBreakfastWeek / 5, 1) }) },

  { id: 'breakfast_master',
    name: 'Breakfast Master',  emoji: '☀️', category: 'nutrition', tier: 'rare',
    lore: 'Three weeks of morning discipline. The first meal is a ritual now.',
    criterion: 'Breakfast Champion achieved 3+ times',
    check: d => ({ unlocked: d.weekBreakfastChampionCount >= 3, progress: Math.min(d.weekBreakfastChampionCount / 3, 1) }) },

  { id: 'clean_start',
    name: 'Clean Start',       emoji: '🥦', category: 'nutrition', tier: 'common',
    lore: 'Three clean days in a week. Good food, good life.',
    criterion: 'Zero junk food on 3+ days in a single week',
    check: d => ({ unlocked: d.bestCleanWeek >= 3, progress: Math.min(d.bestCleanWeek / 3, 1) }) },

  { id: 'clean_fuel',
    name: 'Clean Fuel',        emoji: '🥗', category: 'nutrition', tier: 'rare',
    lore: 'A week of clean eating. Your cells are grateful.',
    criterion: '5+ days without junk food in a single week',
    check: d => ({ unlocked: d.bestCleanWeek >= 5, progress: Math.min(d.bestCleanWeek / 5, 1) }) },

  { id: 'consistent_clean',
    name: 'Consistent Clean',  emoji: '🍃', category: 'nutrition', tier: 'epic',
    lore: 'Five weeks of clean fuel. Your relationship with food has transformed.',
    criterion: 'Clean Fuel badge earned 5+ times',
    check: d => ({ unlocked: d.weekCleanFuelCount >= 5, progress: Math.min(d.weekCleanFuelCount / 5, 1) }) },

  { id: 'sugar_breaker',
    name: 'Sugar Breaker',     emoji: '💎', category: 'nutrition', tier: 'epic', hidden: true,
    lore: 'Full-week discipline — zero junk food across all logged days.',
    criterion: 'Zero junk food in a week with 5+ logged days',
    check: d => ({ unlocked: d.bestFullCleanWeek, progress: d.bestFullCleanWeek ? 1 : Math.min(d.bestCleanWeek / 7, 1) }) },

  { id: 'nutrition_elite',
    name: 'Nutrition Elite',   emoji: '🏅', category: 'nutrition', tier: 'epic',
    lore: 'Three spotless weeks. You have mastered the plate.',
    criterion: 'Sugar Breaker earned 3+ times',
    check: d => ({ unlocked: d.weekSugarBreakerCount >= 3, progress: Math.min(d.weekSugarBreakerCount / 3, 1) }) },

  { id: 'clean_machine',
    name: 'Clean Machine',     emoji: '⚗️', category: 'nutrition', tier: 'legendary', hidden: true,
    lore: 'Five spotless weeks. Your body runs on pure, uncontaminated fuel.',
    criterion: 'Sugar Breaker earned 5+ times',
    check: d => ({ unlocked: d.weekSugarBreakerCount >= 5, progress: Math.min(d.weekSugarBreakerCount / 5, 1) }) },

  { id: 'night_guardian',
    name: 'Night Guardian',    emoji: '🌙', category: 'nutrition', tier: 'rare',
    lore: 'Early dinners all week. Your fasting window is untouchable.',
    criterion: 'Zero late dinners in a week with 4+ logged days',
    check: d => ({ unlocked: d.bestZeroLateDinnerWeek, progress: d.bestZeroLateDinnerWeek ? 1 : 0.4 }) },

  { id: 'dinner_ninja',
    name: 'Dinner Ninja',      emoji: '🥷', category: 'nutrition', tier: 'rare',
    lore: 'Three weeks of early dinners. Your metabolism cycles are locked in.',
    criterion: 'Night Guardian earned 3+ times',
    check: d => ({ unlocked: d.weekNightGuardianCount >= 3, progress: Math.min(d.weekNightGuardianCount / 3, 1) }) },

  { id: 'dinner_master',
    name: 'Dinner Master',     emoji: '🕐', category: 'nutrition', tier: 'epic',
    lore: 'Seven early dinner weeks. Your circadian rhythms are perfectly aligned.',
    criterion: 'Night Guardian earned 7+ times',
    check: d => ({ unlocked: d.weekNightGuardianCount >= 7, progress: Math.min(d.weekNightGuardianCount / 7, 1) }) },

  { id: 'nutrition_god',
    name: 'Nutrition God',     emoji: '🌿', category: 'nutrition', tier: 'legendary', hidden: true,
    lore: 'Complete dietary mastery. Every meal a conscious, optimal choice.',
    criterion: 'Breakfast Master + Consistent Clean + Dinner Master all earned',
    check: d => ({
      unlocked: d.weekBreakfastChampionCount >= 3 && d.weekCleanFuelCount >= 5 && d.weekNightGuardianCount >= 7,
      progress: Math.min((Math.min(d.weekBreakfastChampionCount, 3) / 3 + Math.min(d.weekCleanFuelCount, 5) / 5 + Math.min(d.weekNightGuardianCount, 7) / 7) / 3, 1),
    }) },

  // ── Fitness (20) ──────────────────────────────────────────────────────────
  { id: 'first_steps',
    name: 'First Steps',       emoji: '🐾', category: 'fitness', tier: 'common',
    lore: 'You started moving. The body remembers every step.',
    criterion: '1,000+ steps in a single day',
    check: d => ({ unlocked: d.bestStepDay >= 1000, progress: Math.min(d.bestStepDay / 1000, 1) }) },

  { id: 'step_walker',
    name: 'Step Walker',       emoji: '👟', category: 'fitness', tier: 'common',
    lore: 'Five thousand steps — the floor of active living.',
    criterion: '5,000+ steps in a single day',
    check: d => ({ unlocked: d.bestStepDay >= 5000, progress: Math.min(d.bestStepDay / 5000, 1) }) },

  { id: 'step_beast',
    name: 'Step Beast',        emoji: '🦁', category: 'fitness', tier: 'rare',
    lore: 'Ten thousand steps. Most people never get here.',
    criterion: '10,000+ steps in a single day',
    check: d => ({ unlocked: d.bestStepDay >= 10000, progress: Math.min(d.bestStepDay / 10000, 1) }) },

  { id: 'step_titan',
    name: 'Step Titan',        emoji: '🗻', category: 'fitness', tier: 'epic',
    lore: 'Fifteen thousand steps. You crossed a mountain today.',
    criterion: '15,000+ steps in a single day',
    check: d => ({ unlocked: d.bestStepDay >= 15000, progress: Math.min(d.bestStepDay / 15000, 1) }) },

  { id: 'step_god',
    name: 'Step God',          emoji: '🌋', category: 'fitness', tier: 'legendary', hidden: true,
    lore: 'Twenty thousand steps. You are a force of locomotion.',
    criterion: '20,000+ steps in a single day',
    check: d => ({ unlocked: d.bestStepDay >= 20000, progress: Math.min(d.bestStepDay / 20000, 1) }) },

  { id: 'step_century',
    name: 'Step Century',      emoji: '📍', category: 'fitness', tier: 'rare',
    lore: '100,000 lifetime steps. A century of motion committed to your body.',
    criterion: '100,000+ total steps logged',
    check: d => ({ unlocked: d.totalStepsAllTime >= 100000, progress: Math.min(d.totalStepsAllTime / 100000, 1) }) },

  { id: 'step_million',
    name: 'Step Million',      emoji: '🌍', category: 'fitness', tier: 'epic',
    lore: 'A million steps. Equivalent to walking across a small country.',
    criterion: '1,000,000+ total steps logged',
    check: d => ({ unlocked: d.totalStepsAllTime >= 1000000, progress: Math.min(d.totalStepsAllTime / 1000000, 1) }) },

  { id: 'recovery_walker',
    name: 'Recovery Walker',   emoji: '🚶', category: 'fitness', tier: 'common',
    lore: 'You walked after dinner. Your metabolism noticed.',
    criterion: 'Log a post-dinner walk at least once',
    check: d => ({ unlocked: d.totalWalks >= 1, progress: Math.min(d.totalWalks, 1) }) },

  { id: 'walker_habit',
    name: 'Walker Habit',      emoji: '🌆', category: 'fitness', tier: 'rare',
    lore: 'Twenty post-dinner walks. It is no longer a choice — it is who you are.',
    criterion: '20+ post-dinner walks total',
    check: d => ({ unlocked: d.totalWalks >= 20, progress: Math.min(d.totalWalks / 20, 1) }) },

  { id: 'walker_devotee',
    name: 'Walker Devotee',    emoji: '🏙️', category: 'fitness', tier: 'epic',
    lore: 'Fifty post-dinner walks. Your evening ritual is sacred.',
    criterion: '50+ post-dinner walks total',
    check: d => ({ unlocked: d.totalWalks >= 50, progress: Math.min(d.totalWalks / 50, 1) }) },

  { id: 'cardio_ignition',
    name: 'Cardio Ignition',   emoji: '🏃', category: 'fitness', tier: 'rare',
    lore: 'Three sessions in one week. Your cardiovascular engine is warming up.',
    criterion: '3+ workout sessions in a single week',
    check: d => ({ unlocked: d.bestWorkoutWeek >= 3, progress: Math.min(d.bestWorkoutWeek / 3, 1) }) },

  { id: 'warrior_mode',
    name: 'Warrior Mode',      emoji: '🛡️', category: 'fitness', tier: 'epic', hidden: true,
    lore: 'Five sessions in one week. Warrior-level commitment.',
    criterion: '5+ workout sessions in a single week',
    check: d => ({ unlocked: d.bestWorkoutWeek >= 5, progress: Math.min(d.bestWorkoutWeek / 5, 1) }) },

  { id: 'cardio_habit',
    name: 'Cardio Habit',      emoji: '🎯', category: 'fitness', tier: 'rare',
    lore: 'Five weeks with 3+ workouts each. Cardio is no longer a chore.',
    criterion: 'Cardio Ignition badge earned 5+ times',
    check: d => ({ unlocked: d.weekCardioCount >= 5, progress: Math.min(d.weekCardioCount / 5, 1) }) },

  { id: 'fitness_fanatic',
    name: 'Fitness Fanatic',   emoji: '💥', category: 'fitness', tier: 'epic',
    lore: 'Ten cardio weeks. You live in motion.',
    criterion: 'Cardio Ignition badge earned 10+ times',
    check: d => ({ unlocked: d.weekCardioCount >= 10, progress: Math.min(d.weekCardioCount / 10, 1) }) },

  { id: 'warrior_repeat',
    name: 'Warrior Repeat',    emoji: '🗡️', category: 'fitness', tier: 'epic',
    lore: 'Three warrior weeks. Iron discipline is your baseline.',
    criterion: 'Warrior Mode earned 3+ times',
    check: d => ({ unlocked: d.weekWarriorModeCount >= 3, progress: Math.min(d.weekWarriorModeCount / 3, 1) }) },

  { id: 'elite_athlete',
    name: 'Elite Athlete',     emoji: '🥇', category: 'fitness', tier: 'legendary', hidden: true,
    lore: 'Five warrior weeks. You train at a professional level of commitment.',
    criterion: 'Warrior Mode earned 5+ times',
    check: d => ({ unlocked: d.weekWarriorModeCount >= 5, progress: Math.min(d.weekWarriorModeCount / 5, 1) }) },

  { id: 'workout_ten',
    name: 'Double Digits',     emoji: '💪', category: 'fitness', tier: 'common',
    lore: 'Ten workout sessions logged. You are establishing something powerful.',
    criterion: '10+ total workout sessions',
    check: d => ({ unlocked: d.totalWorkoutSessions >= 10, progress: Math.min(d.totalWorkoutSessions / 10, 1) }) },

  { id: 'workout_fifty',
    name: 'Iron Fifty',        emoji: '🏋️', category: 'fitness', tier: 'rare',
    lore: 'Fifty sessions. Consistency has become your superpower.',
    criterion: '50+ total workout sessions',
    check: d => ({ unlocked: d.totalWorkoutSessions >= 50, progress: Math.min(d.totalWorkoutSessions / 50, 1) }) },

  { id: 'workout_century',
    name: 'Workout Century',   emoji: '🏅', category: 'fitness', tier: 'epic',
    lore: 'One hundred sessions. Dedication at an uncommon level.',
    criterion: '100+ total workout sessions',
    check: d => ({ unlocked: d.totalWorkoutSessions >= 100, progress: Math.min(d.totalWorkoutSessions / 100, 1) }) },

  { id: 'legend_of_iron',
    name: 'Legend of Iron',    emoji: '🔱', category: 'fitness', tier: 'legendary', hidden: true,
    lore: 'Two hundred workouts. They will write your training logs in legend.',
    criterion: '200+ total workout sessions',
    check: d => ({ unlocked: d.totalWorkoutSessions >= 200, progress: Math.min(d.totalWorkoutSessions / 200, 1) }) },

  // ── Sleep (13) ────────────────────────────────────────────────────────────
  { id: 'first_sleep',
    name: 'First Sleep',       emoji: '😴', category: 'sleep', tier: 'common',
    lore: 'You logged your first night. Rest is data too.',
    criterion: 'Log sleep data at least once',
    check: d => ({ unlocked: d.bestSleepHours >= 1, progress: Math.min(d.bestSleepHours, 1) }) },

  { id: 'good_night',
    name: 'Good Night',        emoji: '🌠', category: 'sleep', tier: 'common',
    lore: 'Seven hours of rest. Your brain rewired itself overnight.',
    criterion: 'Log 7+ hours of sleep in a single night',
    check: d => ({ unlocked: d.bestSleepHours >= 7, progress: Math.min(d.bestSleepHours / 7, 1) }) },

  { id: 'deep_recovery',
    name: 'Deep Recovery',     emoji: '💤', category: 'sleep', tier: 'rare',
    lore: '8+ hours of sleep. True biological restoration.',
    criterion: 'Log 8+ hours of sleep in a single night',
    check: d => ({ unlocked: d.bestSleepHours >= 8, progress: Math.min(d.bestSleepHours / 8, 1) }) },

  { id: 'ultra_rest',
    name: 'Ultra Rest',        emoji: '🛌', category: 'sleep', tier: 'rare',
    lore: 'Nine hours of deep regeneration. Your body rebuilt itself twice over.',
    criterion: 'Log 9+ hours of sleep in a single night',
    check: d => ({ unlocked: d.bestSleepHours >= 9, progress: Math.min(d.bestSleepHours / 9, 1) }) },

  { id: 'sleep_guardian',
    name: 'Sleep Guardian',    emoji: '🌟', category: 'sleep', tier: 'rare',
    lore: 'Seven hours on five days in a week. Recovery fully optimized.',
    criterion: '7+ hours sleep on 5+ days in a single week',
    check: d => ({ unlocked: d.bestSleepWeek >= 5, progress: Math.min(d.bestSleepWeek / 5, 1) }) },

  { id: 'sleep_legend',
    name: 'Sleep Legend',      emoji: '🌃', category: 'sleep', tier: 'epic',
    lore: 'Seven hours every night for a full week. Perfected recovery.',
    criterion: '7+ hours of sleep on all 7 days in a week',
    check: d => ({ unlocked: d.bestSleepWeek >= 7, progress: Math.min(d.bestSleepWeek / 7, 1) }) },

  { id: 'night_discipline',
    name: 'Night Discipline',  emoji: '🌌', category: 'sleep', tier: 'epic', hidden: true,
    lore: 'Every sleep logged before 11:30 PM this week. Your circadian rhythm is your superpower.',
    criterion: 'Sleep before 11:30 PM every logged day in a week (4+ days)',
    check: d => ({ unlocked: d.bestEarlySleepWeek, progress: d.bestEarlySleepWeek ? 1 : 0.55 }) },

  { id: 'sleep_master',
    name: 'Sleep Master',      emoji: '💫', category: 'sleep', tier: 'epic',
    lore: 'Three guardian weeks. Your body knows exactly when rest begins.',
    criterion: 'Sleep Guardian earned 3+ times',
    check: d => ({ unlocked: d.weekSleepGuardianCount >= 3, progress: Math.min(d.weekSleepGuardianCount / 3, 1) }) },

  { id: 'sleep_deity',
    name: 'Sleep Deity',       emoji: '🔮', category: 'sleep', tier: 'legendary', hidden: true,
    lore: 'Seven guardian weeks. Sleep is your ultimate performance enhancer.',
    criterion: 'Sleep Guardian earned 7+ times',
    check: d => ({ unlocked: d.weekSleepGuardianCount >= 7, progress: Math.min(d.weekSleepGuardianCount / 7, 1) }) },

  { id: 'rest_warrior',
    name: 'Rest Warrior',      emoji: '🧘', category: 'sleep', tier: 'rare',
    lore: 'Three weeks of disciplined sleep timing. Your clock is calibrated.',
    criterion: 'Night Discipline earned 3+ times',
    check: d => ({ unlocked: d.weekNightDisciplineCount >= 3, progress: Math.min(d.weekNightDisciplineCount / 3, 1) }) },

  { id: 'deep_sleep_addict',
    name: 'Deep Sleeper',      emoji: '🧠', category: 'sleep', tier: 'rare',
    lore: 'Five nights of 8+ hours. Recovery is your competitive edge.',
    criterion: '8+ hours of sleep on 5+ different nights',
    check: d => ({ unlocked: d.deepSleepCount >= 5, progress: Math.min(d.deepSleepCount / 5, 1) }) },

  { id: 'sleep_champion',
    name: 'Sleep Champion',    emoji: '🏆', category: 'sleep', tier: 'epic',
    lore: 'Twenty nights of 8+ hours. Your recovery protocol is legendary.',
    criterion: '8+ hours of sleep on 20+ different nights',
    check: d => ({ unlocked: d.deepSleepCount >= 20, progress: Math.min(d.deepSleepCount / 20, 1) }) },

  { id: 'night_architect',
    name: 'Night Architect',   emoji: '🌅', category: 'sleep', tier: 'legendary', hidden: true,
    lore: 'Fifty nights of perfect rest. You have engineered recovery into an art form.',
    criterion: '8+ hours of sleep on 50+ different nights',
    check: d => ({ unlocked: d.deepSleepCount >= 50, progress: Math.min(d.deepSleepCount / 50, 1) }) },

  // ── Comeback (10) ─────────────────────────────────────────────────────────
  { id: 'bounce_back',
    name: 'Bounce Back',       emoji: '🦅', category: 'comeback', tier: 'common',
    lore: 'You fell. You got back up. That is the only metric that matters.',
    criterion: 'Log after missing 2+ consecutive days',
    check: d => ({ unlocked: d.hasBounceBack, progress: d.hasBounceBack ? 1 : 0.1 }) },

  { id: 'resilient',
    name: 'Resilient',         emoji: '🌱', category: 'comeback', tier: 'common',
    lore: 'Twice fallen, twice risen. Resilience is a choice.',
    criterion: 'Bounce back from a break 2+ times',
    check: d => ({ unlocked: d.bounceBackCount >= 2, progress: Math.min(d.bounceBackCount / 2, 1) }) },

  { id: 'comeback_spirit',
    name: 'Comeback Spirit',   emoji: '🔥', category: 'comeback', tier: 'rare',
    lore: 'Five times you fell and rose again. Nothing can break this spirit.',
    criterion: 'Bounce back from a break 5+ times',
    check: d => ({ unlocked: d.bounceBackCount >= 5, progress: Math.min(d.bounceBackCount / 5, 1) }) },

  { id: 'comeback_legend',
    name: 'Comeback Legend',   emoji: '🌟', category: 'comeback', tier: 'epic',
    lore: 'Ten comebacks. You are not unstoppable — you are undefeatable.',
    criterion: 'Bounce back from a break 10+ times',
    check: d => ({ unlocked: d.bounceBackCount >= 10, progress: Math.min(d.bounceBackCount / 10, 1) }) },

  { id: 'resilience_god',
    name: 'Resilience God',    emoji: '🌊', category: 'comeback', tier: 'legendary', hidden: true,
    lore: 'Fifteen times the storm hit. Fifteen times you walked out stronger.',
    criterion: 'Bounce back from a break 15+ times',
    check: d => ({ unlocked: d.bounceBackCount >= 15, progress: Math.min(d.bounceBackCount / 15, 1) }) },

  { id: 'phoenix_week',
    name: 'Phoenix Week',      emoji: '🦅', category: 'comeback', tier: 'rare',
    lore: 'You turned a bad week into a great one. This is rare strength.',
    criterion: 'Weekly avg ≥70 after averaging <50 the previous week',
    check: d => ({ unlocked: d.hasPhoenixWeek, progress: d.hasPhoenixWeek ? 1 : 0.1 }) },

  { id: 'phoenix_x3',
    name: 'Triple Phoenix',    emoji: '⚡', category: 'comeback', tier: 'epic',
    lore: 'Three phoenix weeks. Rising from ashes is your specialty.',
    criterion: 'Phoenix week achieved 3+ times',
    check: d => ({ unlocked: d.phoenixWeekCount >= 3, progress: Math.min(d.phoenixWeekCount / 3, 1) }) },

  { id: 'phoenix_master',
    name: 'Phoenix Master',    emoji: '🌋', category: 'comeback', tier: 'epic',
    lore: 'Five phoenix weeks. You have mastered the art of the comeback.',
    criterion: 'Phoenix week achieved 5+ times',
    check: d => ({ unlocked: d.phoenixWeekCount >= 5, progress: Math.min(d.phoenixWeekCount / 5, 1) }) },

  { id: 'eternal_phoenix',
    name: 'Eternal Phoenix',   emoji: '✨', category: 'comeback', tier: 'legendary', hidden: true,
    lore: 'Eight phoenix weeks. You cannot be extinguished.',
    criterion: 'Phoenix week achieved 8+ times',
    check: d => ({ unlocked: d.phoenixWeekCount >= 8, progress: Math.min(d.phoenixWeekCount / 8, 1) }) },

  { id: 'iron_spirit',
    name: 'Iron Spirit',       emoji: '🛡️', category: 'comeback', tier: 'rare',
    lore: 'Fall, recover, then excel. Both a bounce back and a phoenix week earned.',
    criterion: 'Both Bounce Back and Phoenix Week unlocked',
    check: d => ({
      unlocked: d.hasBounceBack && d.hasPhoenixWeek,
      progress: ((d.hasBounceBack ? 1 : 0) + (d.hasPhoenixWeek ? 1 : 0)) / 2,
    }) },

  // ── Elite (26) ────────────────────────────────────────────────────────────
  { id: 'good_day',
    name: 'Good Day',          emoji: '⭐', category: 'elite', tier: 'common',
    lore: 'A score of 70 or above. You met the standard.',
    criterion: 'Score ≥70 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 70, progress: Math.min(d.bestDayScore / 70, 1) }) },

  { id: 'great_day',
    name: 'Great Day',         emoji: '🌟', category: 'elite', tier: 'common',
    lore: 'A score of 75 or above. You exceeded the standard.',
    criterion: 'Score ≥75 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 75, progress: Math.min(d.bestDayScore / 75, 1) }) },

  { id: 'excellent_day',
    name: 'Excellent Day',     emoji: '💫', category: 'elite', tier: 'rare',
    lore: 'A score of 80 or above. Excellence is becoming familiar.',
    criterion: 'Score ≥80 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 80, progress: Math.min(d.bestDayScore / 80, 1) }) },

  { id: 'elite_day',
    name: 'Elite Day',         emoji: '🔥', category: 'elite', tier: 'rare',
    lore: 'A score of 85 or above. Elite performance unlocked.',
    criterion: 'Score ≥85 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 85, progress: Math.min(d.bestDayScore / 85, 1) }) },

  { id: 'titan_protocol',
    name: 'Titan Protocol',    emoji: '👑', category: 'elite', tier: 'epic',
    lore: 'A score of 90 or above. You reached the summit.',
    criterion: 'Score ≥90 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 90, progress: Math.min(d.bestDayScore / 90, 1) }) },

  { id: 'near_perfect',
    name: 'Near Perfect',      emoji: '✨', category: 'elite', tier: 'epic',
    lore: 'A score of 95 or above. Perfection is within reach.',
    criterion: 'Score ≥95 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 95, progress: Math.min(d.bestDayScore / 95, 1) }) },

  { id: 'absolute_peak',
    name: 'Absolute Peak',     emoji: '🌠', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'A score of 99 or above. The theoretical limit of human health.',
    criterion: 'Score ≥99 on any single day',
    check: d => ({ unlocked: d.bestDayScore >= 99, progress: Math.min(d.bestDayScore / 99, 1) }) },

  { id: 'score_machine',
    name: 'Score Machine',     emoji: '🎯', category: 'elite', tier: 'common',
    lore: 'Five days scoring 70+. You are reliably excellent.',
    criterion: 'Score ≥70 on 5+ total days',
    check: d => ({ unlocked: d.scores70Plus >= 5, progress: Math.min(d.scores70Plus / 5, 1) }) },

  { id: 'score_veteran',
    name: 'Score Veteran',     emoji: '🎖️', category: 'elite', tier: 'rare',
    lore: 'Twenty days of 70+. Consistency is your identity.',
    criterion: 'Score ≥70 on 20+ total days',
    check: d => ({ unlocked: d.scores70Plus >= 20, progress: Math.min(d.scores70Plus / 20, 1) }) },

  { id: 'score_master',
    name: 'Score Master',      emoji: '🏆', category: 'elite', tier: 'epic',
    lore: 'Fifty days of 70+. You have redefined your personal average.',
    criterion: 'Score ≥70 on 50+ total days',
    check: d => ({ unlocked: d.scores70Plus >= 50, progress: Math.min(d.scores70Plus / 50, 1) }) },

  { id: 'score_legend',
    name: 'Score Legend',      emoji: '💎', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'One hundred days of 70+. Your baseline is everyone else\'s goal.',
    criterion: 'Score ≥70 on 100+ total days',
    check: d => ({ unlocked: d.scores70Plus >= 100, progress: Math.min(d.scores70Plus / 100, 1) }) },

  { id: 'high_flyer',
    name: 'High Flyer',        emoji: '🚀', category: 'elite', tier: 'rare',
    lore: 'Ten days above 80. You cruise at altitude.',
    criterion: 'Score ≥80 on 10+ total days',
    check: d => ({ unlocked: d.scores80Plus >= 10, progress: Math.min(d.scores80Plus / 10, 1) }) },

  { id: 'consistent_elite',
    name: 'Consistent Elite',  emoji: '⚡', category: 'elite', tier: 'epic',
    lore: 'Thirty days above 80. Elite is no longer an event — it is your norm.',
    criterion: 'Score ≥80 on 30+ total days',
    check: d => ({ unlocked: d.scores80Plus >= 30, progress: Math.min(d.scores80Plus / 30, 1) }) },

  { id: 'summit',
    name: 'Summit',            emoji: '🏔️', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'Seventy-five days above 80. You live at the summit.',
    criterion: 'Score ≥80 on 75+ total days',
    check: d => ({ unlocked: d.scores80Plus >= 75, progress: Math.min(d.scores80Plus / 75, 1) }) },

  { id: 'elite_five',
    name: 'Elite Five',        emoji: '🌟', category: 'elite', tier: 'rare',
    lore: 'Five days scoring 90+. Peak performance is becoming familiar.',
    criterion: 'Score ≥90 on 5+ total days',
    check: d => ({ unlocked: d.scores90Plus >= 5, progress: Math.min(d.scores90Plus / 5, 1) }) },

  { id: 'elite_twenty',
    name: 'Elite Twenty',      emoji: '👑', category: 'elite', tier: 'epic',
    lore: 'Twenty days scoring 90+. Your ceiling has become your floor.',
    criterion: 'Score ≥90 on 20+ total days',
    check: d => ({ unlocked: d.scores90Plus >= 20, progress: Math.min(d.scores90Plus / 20, 1) }) },

  { id: 'elite_fifty',
    name: 'Elite Fifty',       emoji: '✦', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'Fifty days at 90+. You have ascended beyond ordinary health metrics.',
    criterion: 'Score ≥90 on 50+ total days',
    check: d => ({ unlocked: d.scores90Plus >= 50, progress: Math.min(d.scores90Plus / 50, 1) }) },

  { id: 'weekly_champion',
    name: 'Weekly Champion',   emoji: '🎪', category: 'elite', tier: 'rare',
    lore: 'A weekly average of 75+. Your weeks are worth studying.',
    criterion: 'Weekly average ≥75 across a full 7-day week',
    check: d => ({ unlocked: d.bestWeekAvg >= 75, progress: Math.min((d.bestWeekAvg || 0) / 75, 1) }) },

  { id: 'weekly_elite',
    name: 'Weekly Elite',      emoji: '🏆', category: 'elite', tier: 'epic',
    lore: 'A weekly average of 80+. One full week of elite performance.',
    criterion: 'Weekly average ≥80 across a full 7-day week',
    check: d => ({ unlocked: d.bestWeekAvg >= 80, progress: Math.min((d.bestWeekAvg || 0) / 80, 1) }) },

  { id: 'peak_human',
    name: 'Peak Human',        emoji: '✨', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'Seven consecutive days above 80. You are operating at another level entirely.',
    criterion: 'Score ≥80 for 7 consecutive days',
    check: d => ({ unlocked: d.bestHighScoreStreak >= 7, progress: Math.min(d.bestHighScoreStreak / 7, 1) }) },

  { id: 'all_time_great',
    name: 'All-Time Great',    emoji: '🌠', category: 'elite', tier: 'epic',
    lore: 'Fourteen consecutive days above 80. Two weeks at the apex.',
    criterion: 'Score ≥80 for 14 consecutive days',
    check: d => ({ unlocked: d.bestHighScoreStreak >= 14, progress: Math.min(d.bestHighScoreStreak / 14, 1) }) },

  { id: 'immortal',
    name: 'Immortal',          emoji: '🌌', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'Twenty-one consecutive days above 80. Immortal performance.',
    criterion: 'Score ≥80 for 21 consecutive days',
    check: d => ({ unlocked: d.bestHighScoreStreak >= 21, progress: Math.min(d.bestHighScoreStreak / 21, 1) }) },

  { id: 'double_titan',
    name: 'Double Titan',      emoji: '🌙', category: 'elite', tier: 'rare',
    lore: 'Two peak human periods. The summit has become your campsite.',
    criterion: 'Peak Human (7+ day 80+ streak) achieved 2+ times',
    check: d => ({ unlocked: d.peakHumanCount >= 2, progress: Math.min(d.peakHumanCount / 2, 1) }) },

  { id: 'quad_titan',
    name: 'Quad Titan',        emoji: '🌟', category: 'elite', tier: 'epic',
    lore: 'Four peak human periods. You exist on a different plane.',
    criterion: 'Peak Human (7+ day 80+ streak) achieved 4+ times',
    check: d => ({ unlocked: d.peakHumanCount >= 4, progress: Math.min(d.peakHumanCount / 4, 1) }) },

  { id: 'aether_rank',
    name: 'Aether Rank',       emoji: '✦', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'A weekly average of 85+ across a full 7-day week. The highest achievable rank.',
    criterion: 'Weekly average ≥85 across a full 7-day week',
    check: d => ({ unlocked: d.bestWeekAvg >= 85, progress: Math.min((d.bestWeekAvg || 0) / 85, 1) }) },

  { id: 'zenith',
    name: 'Zenith',            emoji: '🔮', category: 'elite', tier: 'legendary', hidden: true,
    lore: 'Three aether rank weeks. The absolute zenith of human performance.',
    criterion: 'Aether Rank (weekly avg ≥85) achieved 3+ times',
    check: d => ({ unlocked: d.weekAetherCount >= 3, progress: Math.min(d.weekAetherCount / 3, 1) }) },

  // ── Weight journey (4) ──────────────────────────────────────────────────
  { id: 'first_weigh_in',
    name: 'On The Scale',      emoji: '⚖️', category: 'consistency', tier: 'common',
    lore: 'You measured. What gets measured gets managed.',
    criterion: 'Log your weight for the first time',
    check: d => ({ unlocked: d.weighInCount >= 1, progress: Math.min(d.weighInCount, 1) }) },

  { id: 'weigh_in_week',
    name: 'Daily Weigh-In',    emoji: '📏', category: 'consistency', tier: 'rare',
    lore: 'Seven mornings, seven readings. The trend line becomes truth.',
    criterion: 'Log your weight 7 days in a row',
    check: d => ({ unlocked: d.weighInStreak >= 7, progress: Math.min(d.weighInStreak / 7, 1) }) },

  { id: 'first_kg_down',
    name: 'First Kilo',        emoji: '🪶', category: 'consistency', tier: 'rare',
    lore: 'One kilogram gone. Proof the plan works.',
    criterion: 'Lose 1 kg from your heaviest recorded weight',
    check: d => ({ unlocked: d.totalKgLost >= 1, progress: Math.min(d.totalKgLost / 1, 1) }) },

  { id: 'five_kg_down',
    name: 'Five Down',         emoji: '🏔️', category: 'elite', tier: 'epic',
    lore: 'Five kilograms lighter. Months of small choices, made visible.',
    criterion: 'Lose 5 kg from your heaviest recorded weight',
    check: d => ({ unlocked: d.totalKgLost >= 5, progress: Math.min(d.totalKgLost / 5, 1) }) },
]

export function getEarnEvolutionTier(count) {
  if (count >= 15) return { label: 'Neon Legendary', color: '#f59e0b', symbol: '✦' }
  if (count >= 7)  return { label: 'Gold',            color: '#eab308', symbol: '⬟' }
  if (count >= 3)  return { label: 'Silver',          color: '#94a3b8', symbol: '◆' }
  if (count >= 1)  return { label: 'Bronze',          color: '#cd7f32', symbol: '●' }
  return null
}

async function buildAggregateData() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [allScores, allDiet, allWorkout, allSleep, allWeight] = await Promise.all([
    db.daily_scores.where('date').belowOrEqual(today).sortBy('date'),
    db.diet_logs.toArray(),
    db.workout_logs.toArray(),
    db.sleep_logs.toArray(),
    db.weight_logs.toArray(),
  ])
  if (allScores.length === 0) return null

  const dietMap    = Object.fromEntries(allDiet.map(d => [d.date, d]))
  const workoutMap = Object.fromEntries(allWorkout.map(d => [d.date, d]))
  const sleepMap   = Object.fromEntries(allSleep.map(d => [d.date, d]))
  const sortedDates = allScores.map(s => s.date)
  const totalDays   = sortedDates.length

  // Streak traversal — track completions and bounce-backs simultaneously
  let maxStreak = 1, currentStreak = 1
  let streakStarterCount = 0, weekWarriorStrCount = 0, hyperConsistentCount = 0
  let streakLegendCount = 0, monthMasterCount = 0, ironStreakCount = 0
  let bounceBackCount = 0, hasBounceBack = false

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.round(
      (new Date(sortedDates[i] + 'T00:00:00') - new Date(sortedDates[i-1] + 'T00:00:00')) / 86400000
    )
    if (diff === 1) {
      currentStreak++
    } else {
      streakStarterCount   += Math.floor(currentStreak / 3)
      weekWarriorStrCount  += Math.floor(currentStreak / 7)
      hyperConsistentCount += Math.floor(currentStreak / 14)
      streakLegendCount    += Math.floor(currentStreak / 21)
      monthMasterCount     += Math.floor(currentStreak / 30)
      ironStreakCount      += Math.floor(currentStreak / 60)
      maxStreak = Math.max(maxStreak, currentStreak)
      currentStreak = 1
      if (diff >= 3) { bounceBackCount++; hasBounceBack = true }
    }
  }
  streakStarterCount   += Math.floor(currentStreak / 3)
  weekWarriorStrCount  += Math.floor(currentStreak / 7)
  hyperConsistentCount += Math.floor(currentStreak / 14)
  streakLegendCount    += Math.floor(currentStreak / 21)
  monthMasterCount     += Math.floor(currentStreak / 30)
  ironStreakCount      += Math.floor(currentStreak / 60)
  maxStreak = Math.max(maxStreak, currentStreak)

  // Quality streak — consecutive days with score ≥ 50 (actual effort, not just logging)
  const qualityDates = allScores.filter(s => s.total_score >= 50).map(s => s.date)
  const qualityDays  = qualityDates.length
  let maxQualityStreak = qualityDays > 0 ? 1 : 0, currentQualityStreak = qualityDays > 0 ? 1 : 0
  let qStreakStarterCount = 0, qWeekWarriorCount = 0, qHyperConsistentCount = 0
  let qStreakLegendCount = 0, qMonthMasterCount = 0, qIronStreakCount = 0

  for (let i = 1; i < qualityDates.length; i++) {
    const diff = Math.round(
      (new Date(qualityDates[i] + 'T00:00:00') - new Date(qualityDates[i-1] + 'T00:00:00')) / 86400000
    )
    if (diff === 1) {
      currentQualityStreak++
    } else {
      qStreakStarterCount   += Math.floor(currentQualityStreak / 3)
      qWeekWarriorCount    += Math.floor(currentQualityStreak / 7)
      qHyperConsistentCount += Math.floor(currentQualityStreak / 14)
      qStreakLegendCount   += Math.floor(currentQualityStreak / 21)
      qMonthMasterCount    += Math.floor(currentQualityStreak / 30)
      qIronStreakCount     += Math.floor(currentQualityStreak / 60)
      maxQualityStreak = Math.max(maxQualityStreak, currentQualityStreak)
      currentQualityStreak = 1
    }
  }
  if (qualityDays > 0) {
    qStreakStarterCount   += Math.floor(currentQualityStreak / 3)
    qWeekWarriorCount    += Math.floor(currentQualityStreak / 7)
    qHyperConsistentCount += Math.floor(currentQualityStreak / 14)
    qStreakLegendCount   += Math.floor(currentQualityStreak / 21)
    qMonthMasterCount    += Math.floor(currentQualityStreak / 30)
    qIronStreakCount     += Math.floor(currentQualityStreak / 60)
    maxQualityStreak = Math.max(maxQualityStreak, currentQualityStreak)
  }

  const bestStepDay         = Math.max(0, ...allWorkout.map(w => w.steps || 0))
  const totalWalks          = allWorkout.filter(w => w.post_dinner_walk).length
  const bestSleepHours      = Math.max(0, ...allSleep.map(s => s.sleep_hours || 0))
  const bestDayScore        = Math.max(0, ...allScores.map(s => s.total_score || 0))
  const totalWorkoutSessions= allWorkout.filter(w => w.exercise_done).length
  const totalStepsAllTime   = allWorkout.reduce((sum, w) => sum + (w.steps || 0), 0)
  const deepSleepCount      = allSleep.filter(s => (s.sleep_hours || 0) >= 8).length
  const scores70Plus        = allScores.filter(s => s.total_score >= 70).length
  const scores80Plus        = allScores.filter(s => s.total_score >= 80).length
  const scores90Plus        = allScores.filter(s => s.total_score >= 90).length

  // High-score streak + peak_human (non-overlapping 7-day periods above 80)
  let bestHighScoreStreak = 0, hsStreak = 0, peakHumanCount = 0
  for (const s of allScores) {
    if (s.total_score >= 80) {
      hsStreak++
      if (hsStreak % 7 === 0) peakHumanCount++
    } else {
      hsStreak = 0
    }
    bestHighScoreStreak = Math.max(bestHighScoreStreak, hsStreak)
  }

  // Weekly sweeps
  let bestWeekIdealDays = 0, bestWorkoutWeek = 0, bestSleepWeek = 0
  let bestCleanWeek = 0, bestBreakfastWeek = 0
  let bestZeroLateDinnerWeek = false, bestEarlySleepWeek = false
  let bestWeekAvg = 0, hasPhoenixWeek = false, bestFullCleanWeek = false

  let weekPerfectCount = 0, weekCardioCount = 0, weekWarriorModeCount = 0
  let weekSleepGuardianCount = 0, weekBreakfastChampionCount = 0
  let weekCleanFuelCount = 0, weekSugarBreakerCount = 0
  let weekNightGuardianCount = 0, weekNightDisciplineCount = 0
  let weekAetherCount = 0, phoenixWeekCount = 0

  const weekStartsSet = new Set()
  for (const s of allScores) {
    const ws = startOfWeek(new Date(s.date + 'T00:00:00'), { weekStartsOn: 1 })
    weekStartsSet.add(format(ws, 'yyyy-MM-dd'))
  }

  const isLateDinner = d => {
    const diet = dietMap[d]; if (!diet) return false
    const mt = diet.meal_times?.dinner || diet.dinner_time
    if (mt && Number(mt.split(':')[0]) >= 21) return true
    return (diet.meal_items || []).filter(i => i.mealType === 'dinner' && i.time)
      .some(i => Number(i.time.split(':')[0]) >= 21)
  }

  let prevWeekAvg = null
  for (const wsStr of Array.from(weekStartsSet).sort()) {
    const wsDate = new Date(wsStr + 'T00:00:00')
    const weStr  = format(endOfWeek(wsDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekScores  = allScores.filter(s => s.date >= wsStr && s.date <= weStr)
    const weekDates   = weekScores.map(s => s.date)
    if (weekDates.length === 0) continue

    const weekAvg         = Math.round(weekScores.reduce((a, s) => a + s.total_score, 0) / weekScores.length)
    const weekWorkoutDays = weekDates.filter(d => workoutMap[d]?.exercise_done).length
    const weekSleepDays   = weekDates.filter(d => (sleepMap[d]?.sleep_hours || 0) >= 7).length
    const weekIdealDays   = weekScores.filter(s => s.total_score >= 70).length
    const cleanDays       = weekDates.filter(d => !(dietMap[d]?.meal_items || []).some(i => i.category === 'bad')).length
    const breakfastDays   = weekDates.filter(d => (dietMap[d]?.meal_items || []).some(i => i.mealType === 'breakfast')).length

    if (prevWeekAvg !== null && prevWeekAvg < 50 && weekAvg >= 70) { hasPhoenixWeek = true; phoenixWeekCount++ }
    if (weekDates.length >= 7) {
      bestWeekAvg = Math.max(bestWeekAvg, weekAvg)
      if (weekAvg >= 85) weekAetherCount++
    }

    bestWeekIdealDays = Math.max(bestWeekIdealDays, weekIdealDays)
    bestWorkoutWeek   = Math.max(bestWorkoutWeek, weekWorkoutDays)
    bestSleepWeek     = Math.max(bestSleepWeek, weekSleepDays)
    bestCleanWeek     = Math.max(bestCleanWeek, cleanDays)
    bestBreakfastWeek = Math.max(bestBreakfastWeek, breakfastDays)
    if (cleanDays >= weekDates.length && weekDates.length >= 5) bestFullCleanWeek = true

    if (weekIdealDays >= 5)   weekPerfectCount++
    if (weekWorkoutDays >= 3) weekCardioCount++
    if (weekWorkoutDays >= 5) weekWarriorModeCount++
    if (weekSleepDays >= 5)   weekSleepGuardianCount++
    if (breakfastDays >= 5)   weekBreakfastChampionCount++
    if (cleanDays >= 5)       weekCleanFuelCount++
    if (cleanDays >= weekDates.length && weekDates.length >= 5) weekSugarBreakerCount++

    if (weekDates.length >= 4) {
      if (!weekDates.some(isLateDinner)) { bestZeroLateDinnerWeek = true; weekNightGuardianCount++ }
      const sleepLogged = weekDates.filter(d => sleepMap[d]?.sleep_time)
      if (sleepLogged.length >= 4 && sleepLogged.every(d => {
        const [h, m] = sleepMap[d].sleep_time.split(':').map(Number)
        if (h >= 0 && h <= 4) return false
        return h < 23 || (h === 23 && m <= 30)
      })) { bestEarlySleepWeek = true; weekNightDisciplineCount++ }
    }
    prevWeekAvg = weekAvg
  }

  const earnCounts = {
    // Consistency
    daily_logger:         Math.min(1, qualityDays >= 1 ? 1 : 0),
    first_week:           Math.min(1, qualityDays >= 7 ? 1 : 0),
    fortnight_logger:     Math.min(1, qualityDays >= 14 ? 1 : 0),
    thirty_club:          Math.min(1, qualityDays >= 30 ? 1 : 0),
    iron_logger:          Math.min(1, qualityDays >= 60 ? 1 : 0),
    century_club:         Math.min(1, qualityDays >= 100 ? 1 : 0),
    double_century:       Math.min(1, qualityDays >= 200 ? 1 : 0),
    year_of_health:       Math.min(1, qualityDays >= 365 ? 1 : 0),
    streak_starter:       qStreakStarterCount,
    week_warrior:         qWeekWarriorCount,
    streak_legend:        qStreakLegendCount,
    month_master:         qMonthMasterCount,
    hyper_consistent:     qHyperConsistentCount,
    iron_streak:          qIronStreakCount,
    perfect_week:         weekPerfectCount,
    consistency_king:     Math.floor(weekPerfectCount / 3),
    perfect_month_run:    Math.floor(weekPerfectCount / 4),
    consistency_deity:    Math.floor(weekPerfectCount / 8),
    // Nutrition
    breakfast_habit:      Math.min(1, bestBreakfastWeek >= 3 ? 1 : 0),
    breakfast_champion:   weekBreakfastChampionCount,
    breakfast_master:     Math.floor(weekBreakfastChampionCount / 3),
    clean_start:          Math.min(1, bestCleanWeek >= 3 ? 1 : 0),
    clean_fuel:           weekCleanFuelCount,
    consistent_clean:     Math.floor(weekCleanFuelCount / 5),
    sugar_breaker:        weekSugarBreakerCount,
    nutrition_elite:      Math.floor(weekSugarBreakerCount / 3),
    clean_machine:        Math.floor(weekSugarBreakerCount / 5),
    night_guardian:       weekNightGuardianCount,
    dinner_ninja:         Math.floor(weekNightGuardianCount / 3),
    dinner_master:        Math.floor(weekNightGuardianCount / 7),
    nutrition_god:        (weekBreakfastChampionCount >= 3 && weekCleanFuelCount >= 5 && weekNightGuardianCount >= 7) ? 1 : 0,
    // Fitness
    first_steps:          allWorkout.filter(w => (w.steps || 0) >= 1000).length,
    step_walker:          allWorkout.filter(w => (w.steps || 0) >= 5000).length,
    step_beast:           allWorkout.filter(w => (w.steps || 0) >= 10000).length,
    step_titan:           allWorkout.filter(w => (w.steps || 0) >= 15000).length,
    step_god:             allWorkout.filter(w => (w.steps || 0) >= 20000).length,
    step_century:         Math.min(1, totalStepsAllTime >= 100000 ? 1 : 0),
    step_million:         Math.min(1, totalStepsAllTime >= 1000000 ? 1 : 0),
    recovery_walker:      totalWalks,
    walker_habit:         Math.floor(totalWalks / 20),
    walker_devotee:       Math.floor(totalWalks / 50),
    cardio_ignition:      weekCardioCount,
    warrior_mode:         weekWarriorModeCount,
    cardio_habit:         Math.floor(weekCardioCount / 5),
    fitness_fanatic:      Math.floor(weekCardioCount / 10),
    warrior_repeat:       Math.floor(weekWarriorModeCount / 3),
    elite_athlete:        Math.floor(weekWarriorModeCount / 5),
    workout_ten:          Math.floor(totalWorkoutSessions / 10),
    workout_fifty:        Math.floor(totalWorkoutSessions / 50),
    workout_century:      Math.floor(totalWorkoutSessions / 100),
    legend_of_iron:       Math.floor(totalWorkoutSessions / 200),
    // Sleep
    first_sleep:          Math.min(1, bestSleepHours >= 1 ? 1 : 0),
    good_night:           Math.min(1, bestSleepHours >= 7 ? 1 : 0),
    deep_recovery:        deepSleepCount,
    ultra_rest:           allSleep.filter(s => (s.sleep_hours || 0) >= 9).length,
    sleep_guardian:       weekSleepGuardianCount,
    sleep_legend:         Math.min(1, bestSleepWeek >= 7 ? 1 : 0),
    night_discipline:     weekNightDisciplineCount,
    sleep_master:         Math.floor(weekSleepGuardianCount / 3),
    sleep_deity:          Math.floor(weekSleepGuardianCount / 7),
    rest_warrior:         Math.floor(weekNightDisciplineCount / 3),
    deep_sleep_addict:    Math.floor(deepSleepCount / 5),
    sleep_champion:       Math.floor(deepSleepCount / 20),
    night_architect:      Math.floor(deepSleepCount / 50),
    // Comeback
    bounce_back:          bounceBackCount,
    resilient:            Math.floor(bounceBackCount / 2),
    comeback_spirit:      Math.floor(bounceBackCount / 5),
    comeback_legend:      Math.floor(bounceBackCount / 10),
    resilience_god:       Math.floor(bounceBackCount / 15),
    phoenix_week:         phoenixWeekCount,
    phoenix_x3:           Math.floor(phoenixWeekCount / 3),
    phoenix_master:       Math.floor(phoenixWeekCount / 5),
    eternal_phoenix:      Math.floor(phoenixWeekCount / 8),
    iron_spirit:          (hasBounceBack && hasPhoenixWeek) ? 1 : 0,
    // Elite
    good_day:             Math.min(1, bestDayScore >= 70 ? 1 : 0),
    great_day:            Math.min(1, bestDayScore >= 75 ? 1 : 0),
    excellent_day:        Math.min(1, bestDayScore >= 80 ? 1 : 0),
    elite_day:            Math.min(1, bestDayScore >= 85 ? 1 : 0),
    titan_protocol:       scores90Plus,
    near_perfect:         allScores.filter(s => s.total_score >= 95).length,
    absolute_peak:        allScores.filter(s => s.total_score >= 99).length,
    score_machine:        Math.floor(scores70Plus / 5),
    score_veteran:        Math.floor(scores70Plus / 20),
    score_master:         Math.floor(scores70Plus / 50),
    score_legend:         Math.floor(scores70Plus / 100),
    high_flyer:           Math.floor(scores80Plus / 10),
    consistent_elite:     Math.floor(scores80Plus / 30),
    summit:               Math.floor(scores80Plus / 75),
    elite_five:           Math.floor(scores90Plus / 5),
    elite_twenty:         Math.floor(scores90Plus / 20),
    elite_fifty:          Math.floor(scores90Plus / 50),
    weekly_champion:      Math.min(1, bestWeekAvg >= 75 ? 1 : 0),
    weekly_elite:         Math.min(1, bestWeekAvg >= 80 ? 1 : 0),
    peak_human:           peakHumanCount,
    all_time_great:       Math.min(1, bestHighScoreStreak >= 14 ? 1 : 0),
    immortal:             Math.min(1, bestHighScoreStreak >= 21 ? 1 : 0),
    double_titan:         Math.floor(peakHumanCount / 2),
    quad_titan:           Math.floor(peakHumanCount / 4),
    aether_rank:          weekAetherCount,
    zenith:               Math.floor(weekAetherCount / 3),
  }

  return {
    totalDays, qualityDays, maxStreak, maxQualityStreak,
    bestStepDay, totalWalks, bestSleepHours, bestDayScore,
    hasBounceBack, bestHighScoreStreak, bestWeekIdealDays, bestWorkoutWeek, bestSleepWeek,
    bestCleanWeek, bestBreakfastWeek, bestFullCleanWeek, bestZeroLateDinnerWeek,
    bestEarlySleepWeek, bestWeekAvg, hasPhoenixWeek,
    weekPerfectCount, weekCardioCount, weekWarriorModeCount, weekSleepGuardianCount,
    weekBreakfastChampionCount, weekCleanFuelCount, weekSugarBreakerCount,
    weekNightGuardianCount, weekNightDisciplineCount, weekAetherCount,
    bounceBackCount, phoenixWeekCount, peakHumanCount,
    scores70Plus, scores80Plus, scores90Plus,
    totalWorkoutSessions, totalStepsAllTime, deepSleepCount,
    earnCounts,
    ...buildWeightMetrics(allWeight),
  }
}

// ── Weight journey metrics ────────────────────────────────────────────────────
function buildWeightMetrics(allWeight) {
  const sorted = [...allWeight].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return { weighInCount: 0, weighInStreak: 0, totalKgLost: 0 }

  // Loss measured from the highest weight recorded, so a bounce-back doesn't
  // erase progress already earned.
  const peak = Math.max(...sorted.map(e => e.weight_kg))
  const latest = sorted[sorted.length - 1].weight_kg

  let streak = 1, best = 1
  for (let i = 1; i < sorted.length; i++) {
    const gap = (parseISO(sorted[i].date) - parseISO(sorted[i - 1].date)) / 86400000
    if (gap === 1) { streak++; best = Math.max(best, streak) }
    else streak = 1
  }

  return {
    weighInCount:  sorted.length,
    weighInStreak: best,
    totalKgLost:   Math.max(0, Math.round((peak - latest) * 10) / 10),
  }
}

export async function runBadgeEngine() {
  try {
    const data = await buildAggregateData()
    if (!data) return []

    const existingRecords = await db.badges.toArray()
    const recMap      = Object.fromEntries(existingRecords.map(r => [r.badge_id, r]))
    const unlockedIds = new Set(existingRecords.filter(b => b.unlock_timestamp).map(b => b.badge_id))
    const newlyUnlocked = []

    for (const badge of BADGES) {
      const { unlocked, progress } = badge.check(data)
      const earn_count = data.earnCounts[badge.id] || 0
      if (unlocked && !unlockedIds.has(badge.id)) {
        await db.badges.put({ badge_id: badge.id, unlock_timestamp: Date.now(), progress: 1, tier: badge.tier, earn_count })
        newlyUnlocked.push(badge)
      } else if (unlockedIds.has(badge.id)) {
        const rec = recMap[badge.id] || {}
        await db.badges.put({ ...rec, earn_count })
      } else {
        await db.badges.put({ badge_id: badge.id, unlock_timestamp: null, progress, tier: badge.tier, earn_count })
      }
    }
    return newlyUnlocked
  } catch (e) {
    console.error('[BadgeEngine]', e)
    return []
  }
}

export async function getBadgeStates() {
  const records = await db.badges.toArray()
  const map = Object.fromEntries(records.map(r => [r.badge_id, r]))
  return BADGES.map(b => {
    const rec = map[b.id]
    return {
      ...b,
      unlocked:   !!(rec?.unlock_timestamp),
      progress:   rec?.progress ?? 0,
      unlockedAt: rec?.unlock_timestamp ?? null,
      earnCount:  rec?.earn_count ?? 0,
    }
  })
}

export async function getThisWeekBadgeStates() {
  const allStates = await getBadgeStates()
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeek  = allStates.filter(b => b.unlockedAt && format(new Date(b.unlockedAt), 'yyyy-MM-dd') >= weekStart)
  const nearUnlock = allStates.filter(b => !b.unlocked && b.progress >= 0.55).sort((a, b) => b.progress - a.progress)
  return { thisWeek, nearUnlock, allStates }
}
