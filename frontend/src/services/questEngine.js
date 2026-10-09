import { format, startOfWeek, endOfWeek } from 'date-fns'
import db from './db'

export async function computeQuests() {
  const today     = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [todayDiet, todayWorkout, todaySleep, weekScores, weekWorkout, weekDiet, todayWeight] = await Promise.all([
    db.diet_logs.where('date').equals(today).first().catch(() => null),
    db.workout_logs.where('date').equals(today).first().catch(() => null),
    db.sleep_logs.where('date').equals(today).first().catch(() => null),
    db.daily_scores.where('date').between(weekStart, weekEnd, true, true).toArray(),
    db.workout_logs.where('date').between(weekStart, weekEnd, true, true).toArray(),
    db.diet_logs.where('date').between(weekStart, weekEnd, true, true).toArray(),
    db.weight_logs.where('date').equals(today).first().catch(() => null),
  ])

  const weighedToday = !!todayWeight

  const todayMeals   = todayDiet?.meal_items || []
  const hasBreakfast = todayMeals.some(i => i.mealType === 'breakfast')
  const hasDinner    = todayMeals.some(i => i.mealType === 'dinner')
  const junkToday    = todayMeals.some(i => i.category === 'bad')
  const todaySteps   = todayWorkout?.steps || 0
  const hasExercise  = !!todayWorkout?.exercise_done

  const weekWorkoutCount = weekWorkout.filter(w => w.exercise_done).length
  const weekLogged       = weekScores.length
  const weekAvg          = weekLogged ? Math.round(weekScores.reduce((a, s) => a + s.total_score, 0) / weekLogged) : 0
  const weekBreakfastDays = weekDiet.filter(d => (d.meal_items || []).some(i => i.mealType === 'breakfast')).length
  const weekCleanDays     = weekDiet.filter(d => !(d.meal_items || []).some(i => i.category === 'bad')).length

  const daily = [
    {
      id: 'weigh_in',
      label: 'Log Weight',
      emoji: '⚖️',
      desc: weighedToday ? `${todayWeight.weight_kg} kg recorded ✓` : 'Step on the scale',
      complete: weighedToday,
      progress: weighedToday ? 1 : 0,
      xp: 5,
    },
    {
      id: 'breakfast',
      label: 'Log Breakfast',
      emoji: '🌅',
      desc: hasBreakfast ? 'Morning fuel logged ✓' : 'Start the day with a meal',
      complete: hasBreakfast,
      progress: hasBreakfast ? 1 : 0,
      xp: 5,
    },
    {
      id: 'steps_8k',
      label: '8,000 Steps',
      emoji: '👟',
      desc: `${Math.min(todaySteps, 8000).toLocaleString()} / 8,000`,
      complete: todaySteps >= 8000,
      progress: Math.min(todaySteps / 8000, 1),
      xp: 10,
    },
    {
      id: 'no_junk',
      label: 'Clean Eating Day',
      emoji: '🥗',
      desc: junkToday ? 'Junk detected — try again tomorrow' : hasDinner ? 'Clean all day ✓' : 'Stay clean through dinner',
      complete: hasDinner && !junkToday,
      progress: junkToday ? 0 : hasDinner ? 1 : hasBreakfast ? 0.5 : 0.2,
      xp: 8,
      failed: junkToday,
    },
    {
      id: 'exercise',
      label: 'Complete a Workout',
      emoji: '💪',
      desc: hasExercise ? 'Session logged ✓' : 'Log any exercise today',
      complete: hasExercise,
      progress: hasExercise ? 1 : 0,
      xp: 12,
    },
  ]

  const weekly = [
    {
      id: 'weekly_workouts',
      label: '3 Workouts This Week',
      emoji: '🏃',
      desc: `${weekWorkoutCount} / 3 sessions`,
      complete: weekWorkoutCount >= 3,
      progress: Math.min(weekWorkoutCount / 3, 1),
      xp: 30,
    },
    {
      id: 'weekly_log',
      label: 'Log 5 Days This Week',
      emoji: '📋',
      desc: `${weekLogged} / 5 days`,
      complete: weekLogged >= 5,
      progress: Math.min(weekLogged / 5, 1),
      xp: 20,
    },
    {
      id: 'weekly_score',
      label: 'Avg Score ≥65',
      emoji: '📈',
      desc: weekLogged > 0 ? `${weekAvg} avg over ${weekLogged} days` : 'Log days to track',
      complete: weekLogged >= 3 && weekAvg >= 65,
      progress: weekLogged > 0 ? Math.min(weekAvg / 65, 1) : 0,
      xp: 25,
    },
    {
      id: 'weekly_breakfast',
      label: 'Breakfast 5× This Week',
      emoji: '☀️',
      desc: `${weekBreakfastDays} / 5 mornings`,
      complete: weekBreakfastDays >= 5,
      progress: Math.min(weekBreakfastDays / 5, 1),
      xp: 15,
    },
  ]

  return { daily, weekly }
}
