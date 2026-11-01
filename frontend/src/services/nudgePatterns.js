// Patterns in the user's own logs, for the "your own evidence" nudge. A fixed, short
// list of pairs, because comparing many habits on few days finds false patterns.
// Wording says "on days when", never "because": these are correlations.
import { format, addDays, parseISO } from 'date-fns'

export const MIN_DAYS_EACH_SIDE = 5
const MIN_SCORE_GAP = 3
const MIN_STEPS_GAP = 1000
const MIN_BED_GAP   = 30
const EARLY_DINNER  = 20 * 60 + 30
const EARLY_BED     = 23 * 60

const avg = (list) => list.reduce((s, v) => s + v, 0) / list.length
const round = (n) => Math.round(n)

// Two groups of values, or null unless both are big enough to say anything.
function compare(pairs) {
  const yes = pairs.filter(p => p.habit).map(p => p.value)
  const no  = pairs.filter(p => !p.habit).map(p => p.value)
  if (yes.length < MIN_DAYS_EACH_SIDE || no.length < MIN_DAYS_EACH_SIDE) return null
  return { days: yes.length, withHabit: avg(yes), without: avg(no) }
}

const nextDay = (date) => format(addDays(parseISO(date), 1), 'yyyy-MM-dd')

// days: one row per date, oldest first, with
//   { date, sick, dinnerMin, bedMin, breakfast, walk, steps, dietScore, sleepScore, screenHours, sleepHours }
// bedMin belongs to the night ending on `date` (sleep rows are dated by wake-up day)
// and runs past 1440 for times after midnight.
export function findPatterns(days) {
  const usable = days.filter(d => !d.sick)
  const byDate = Object.fromEntries(usable.map(d => [d.date, d]))
  const out = []

  const dinnerSleep = compare(usable.flatMap(d => {
    const next = byDate[nextDay(d.date)]
    return d.dinnerMin != null && next?.sleepScore != null ? [{ habit: d.dinnerMin < EARLY_DINNER, value: next.sleepScore }] : []
  }))
  if (dinnerSleep && dinnerSleep.withHabit - dinnerSleep.without >= MIN_SCORE_GAP) {
    const a = round(dinnerSleep.withHabit), b = round(dinnerSleep.without)
    out.push({
      id: 'dinner_sleep', pref: 17 * 60 + 30, route: '/?meal=dinner', strength: a - b,
      title: 'Earlier dinners and your sleep',
      body: `After your ${dinnerSleep.days} dinners before 8:30, your sleep score averaged ${a}, against ${b} after later ones.`,
      why: 'Your logs show better sleep scores after earlier dinners',
      purpose: 'Show the link between dinner before 8:30 PM and a better sleep score, and invite an earlier dinner tonight',
      facts: { days_with_early_dinner: dinnerSleep.days, cutoff_label: '8:30', avg_sleep_score_after_early: a, avg_sleep_score_after_late: b },
    })
  }

  const bedSteps = compare(usable.flatMap(d => d.bedMin != null && d.steps > 0 ? [{ habit: d.bedMin < EARLY_BED, value: d.steps }] : []))
  if (bedSteps && bedSteps.withHabit - bedSteps.without >= MIN_STEPS_GAP) {
    const a = round(bedSteps.withHabit), b = round(bedSteps.without)
    out.push({
      id: 'bed_steps', pref: 21 * 60, route: '/', strength: (a - b) / 500,
      title: 'Early nights and your steps',
      body: `On days after a night in bed before 11, you averaged ${a.toLocaleString()} steps, against ${b.toLocaleString()} on the others.`,
      why: 'Your logs show more steps after earlier nights',
      purpose: 'Show the link between bed before 11 PM and more steps the next day, and invite an earlier night',
      facts: { days_with_early_bed: bedSteps.days, cutoff_label: '11', avg_steps_after_early_bed: a, avg_steps_after_late_bed: b },
    })
  }

  const breakfastDiet = compare(usable.flatMap(d => d.dietScore != null ? [{ habit: d.breakfast, value: d.dietScore }] : []))
  if (breakfastDiet && breakfastDiet.withHabit - breakfastDiet.without >= MIN_SCORE_GAP) {
    const a = round(breakfastDiet.withHabit), b = round(breakfastDiet.without)
    out.push({
      id: 'breakfast_diet', pref: 8 * 60 + 30, route: '/?meal=breakfast', strength: a - b,
      title: 'Breakfast and your diet score',
      body: `On your ${breakfastDiet.days} days with breakfast, your diet score averaged ${a}, against ${b} without it.`,
      why: 'Your logs show better diet scores on days with breakfast',
      purpose: 'Show the link between having breakfast and a better diet score, and invite logging breakfast today',
      facts: { days_with_breakfast: breakfastDiet.days, avg_diet_score_with: a, avg_diet_score_without: b },
    })
  }

  const walkBed = compare(usable.flatMap(d => {
    const next = byDate[nextDay(d.date)]
    return next?.bedMin != null ? [{ habit: d.walk, value: next.bedMin }] : []
  }))
  if (walkBed && walkBed.without - walkBed.withHabit >= MIN_BED_GAP) {
    const gap = round(walkBed.without - walkBed.withHabit)
    out.push({
      id: 'walk_bed', pref: 18 * 60 + 30, route: '/log?tab=move', strength: gap / 10,
      title: 'Evening walks and bedtime',
      body: `On your ${walkBed.days} days with a post-dinner walk, you went to bed about ${gap} minutes earlier.`,
      why: 'Your logs show earlier nights after a post-dinner walk',
      purpose: 'Show the link between a post-dinner walk and an earlier bedtime, and invite a walk tonight',
      facts: { days_with_walk: walkBed.days, minutes_earlier_to_bed: gap },
    })
  }

  const screenSleep = compare(usable.flatMap(d => d.sleepHours > 0 && d.sleepScore != null ? [{ habit: (d.screenHours || 0) < 1, value: d.sleepScore }] : []))
  if (screenSleep && screenSleep.withHabit - screenSleep.without >= MIN_SCORE_GAP) {
    const a = round(screenSleep.withHabit), b = round(screenSleep.without)
    out.push({
      id: 'screen_sleep', pref: 21 * 60 + 30, route: '/', strength: a - b,
      title: 'Screens at night and your sleep',
      body: `On your ${screenSleep.days} nights with under an hour of screen time, your sleep score averaged ${a}, against ${b} on the others.`,
      why: 'Your logs show better sleep scores with less night-time screen use',
      purpose: 'Show the link between under 1 hour of night-time screen use and a better sleep score, and invite putting the phone away tonight',
      facts: { nights_with_little_screen: screenSleep.days, screen_hours_label: '1', avg_sleep_score_with: a, avg_sleep_score_without: b },
    })
  }

  return out.sort((x, y) => y.strength - x.strength)
}
