// Decides what to notify about, when, and in plain words. Pure: pass the facts and
// the time, and it can be tested at any hour. Rules decide; the AI may later reword
// a slot, but never picks the time, the destination or the numbers.
//
// See docs/ai_nudges_plan.md §4 and §6.
import { addDays, format, startOfDay } from 'date-fns'
import { fmtClock } from './nudgeTime'
import { IF_THEN_OPTIONS } from './ifThen'

// Bedtime and dinner are promises the mode makes, so they sit outside the nudge budget
export const ANCHORS = new Set(['bedtime', 'dinner'])
export const NUDGE_CAP = { quiet: 0, standard: 1, coach: 4 }

export const MIN_GAP_MS   = 2 * 60 * 60 * 1000
const ANCHOR_DAYS   = 7    // bedtime and dinner, booked ahead
const NUDGE_DAYS    = 3    // today and the next two days
const COMEBACK_DAYS = [3, 7]
const PLACE_STEP    = 30   // minutes either side of the preferred time
const RECENT_PENALTY = 5   // per send of the same nudge in the last 3 days
const WRAP_WEEK_DOW  = 0   // Sunday

export const CHANNELS = { reminders: 'hq_reminders', nudges: 'hq_nudges', summaries: 'hq_summaries' }

const pct = (value, of) => (of > 0 ? value / of : 0)
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

// Dinner and bedtime reminders fill the evening, and notifications keep two hours
// apart, so an evening nudge may go out in the late afternoon rather than not at all.
const EVENING_FROM = 20 * 60
const LATE_AFTERNOON = 17 * 60 + 30
const windowFor = (pref, before, after) => [pref >= EVENING_FROM ? Math.min(pref - before, LATE_AFTERNOON) : pref - before, pref + after]

const LATE_EATER = 20 * 60 + 15

const atMinutes = (now, day, minutes) => {
  const d = addDays(startOfDay(now), day)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes)
}

const LABELS = { diet: 'Diet', workout: 'Workout', sleep: 'Sleep' }

function tipFor(section, f) {
  if (section === 'diet') {
    return f.plan?.goal === 'gain' ? 'An earlier dinner and a good snack earlier in the day would help.' : 'An earlier dinner would help.'
  }
  if (section === 'workout') return 'A 20-minute walk would help.'
  return 'Starting the sleep timer before 11:30 would help.'
}

// ── Anchors ──────────────────────────────────────────────────────────────────
function anchorsFor(f, day) {
  if (!f.anchorsOn) return []
  const out = []
  const skipBed = day === 0 && f.timerRunning
  if (!skipBed) {
    out.push({
      trigger: 'bedtime', pref: f.times.bed, channel: CHANNELS.reminders, route: '/', fixed: true,
      title: 'Time to wind down',
      body: 'Start your sleep timer when you get into bed.',
      why: `It is your bedtime, ${fmtClock(f.times.bed)}, and no sleep timer was running`,
    })
  }
  if (f.mode !== 'quiet' && !(day === 0 && f.logged.dinner)) {
    out.push({
      trigger: 'dinner', pref: f.times.dinner, channel: CHANNELS.reminders, route: '/?meal=dinner', fixed: true,
      title: 'Dinner time',
      // Someone who eats late hears their own habit, at the time they chose
      body: f.penaltyDinner && f.usual.dinner >= LATE_EATER
        ? `You usually eat around ${fmtClock(f.usual.dinner)}. Starting soon keeps ${f.penaltyDinner} points.`
        : f.penaltyDinner ? `Dinner before 9 PM keeps ${f.penaltyDinner} points.` : 'Good time to have dinner and log it.',
      why: 'It is your dinner reminder time, and dinner was not logged',
    })
  }
  return out
}

// ── Nudges ───────────────────────────────────────────────────────────────────
// Each candidate may be reworded by the AI, so `facts` holds only what cannot go
// stale before it is sent: past logs and fixed rules, never today's live numbers.
function nudgesFor(f, day, ctx) {
  const out = []
  const today = day === 0
  const { times, usual, logged } = f
  const add = (c) => out.push({ channel: CHANNELS.nudges, ai: true, facts: {}, ...c })

  // Decision moment: before their usual late dinner, not at a fixed hour. With a
  // dinner reminder on, that reminder says this instead (see anchorsFor).
  const dinnerAnchor = f.anchorsOn && f.mode !== 'quiet'
  if (!dinnerAnchor && !(today && logged.dinner) && f.penaltyDinner && usual.dinner >= LATE_EATER) {
    const pref = Math.min(usual.dinner - 30, LATE_EATER)
    add({
      trigger: 'dinner_window', pref, window: [pref - 30, pref + 30], stake: f.penaltyDinner + 3, route: '/?meal=dinner',
      title: 'Dinner is coming up',
      body: `You usually eat around ${fmtClock(usual.dinner)}. Starting now keeps ${f.penaltyDinner} points.`,
      why: `Your dinners have been around ${fmtClock(usual.dinner)}, close to the 9 PM cut-off`,
      purpose: 'Encourage starting dinner a little earlier tonight',
      facts: { penalty_points: f.penaltyDinner, cutoff_label: '9 PM', usual_dinner_label: fmtClock(usual.dinner) },
    })
  }

  // Steps speak of the target, never today's count, which rises with the app closed
  if (!(today && logged.steps >= f.stepTarget) && f.avgSteps7 > 0 && f.avgSteps7 < f.stepTarget) {
    add({
      trigger: 'steps', pref: 18 * 60, window: [16 * 60, 19 * 60 + 30], stake: f.points.steps, route: '/log?tab=move',
      title: 'Time for a walk?',
      body: `A 20-minute walk helps you reach ${f.stepTarget.toLocaleString()} steps today.`,
      why: `You have been averaging ${f.avgSteps7.toLocaleString()} steps against a target of ${f.stepTarget.toLocaleString()}`,
      purpose: 'Suggest a short walk this evening. Do not state how many steps they have today',
      facts: { step_target: f.stepTarget, walk_minutes: 20, avg_steps_last_7_days: f.avgSteps7 },
    })
  }

  // Breakfast, for someone who has been missing it
  if (!(today && logged.breakfast) && f.breakfastDays >= 4 && f.breakfastMissed >= 4) {
    add({
      trigger: 'breakfast', pref: Math.max(9 * 60, times.wake + 60), window: [times.wake + 30, 11 * 60], stake: 5, route: '/?meal=breakfast',
      title: 'Breakfast today?',
      body: `It has been missing on ${f.breakfastMissed} of the last ${f.breakfastDays} days. Today is a good day to log it.`,
      why: `Breakfast was missing on ${f.breakfastMissed} of the last ${f.breakfastDays} days`,
      purpose: 'Invite logging breakfast today, gently',
      facts: { days_missed: f.breakfastMissed, days_counted: f.breakfastDays },
    })
  }

  // Your own evidence. A pattern already shown rests for 14 days
  const pattern = f.patterns.find(p => !ctx.rest.restedEvidence.has(p.id))
  if (pattern && !(today && pattern.id === 'dinner_sleep' && logged.dinner) && !(today && pattern.id === 'breakfast_diet' && logged.breakfast)) {
    add({
      trigger: 'evidence', detail: pattern.id, pref: pattern.pref, window: windowFor(pattern.pref, 60, 90), stake: 4, route: pattern.route,
      title: pattern.title, body: pattern.body, why: pattern.why, purpose: pattern.purpose, facts: pattern.facts,
    })
  }

  // The plan they picked for the week, quoted back at the moment it applies
  if (f.ifThen) {
    const meta = IF_THEN_OPTIONS[f.ifThen.cost]
    add({
      trigger: 'if_then', pref: meta.pref, window: windowFor(meta.pref, 30, 60), stake: 6, route: meta.route,
      title: 'Your plan for this week',
      body: `${f.ifThen.text}.`,
      why: 'This is the plan you picked for this week',
      purpose: 'Remind them of the plan they chose this week. Quote it faithfully',
      facts: { their_plan: f.ifThen.text },
    })
  }

  // Fresh start: Monday, the 1st, or the first day back after being unwell
  const when = addDays(startOfDay(f.now), day)
  const backAfterSick = today && f.sickYesterday
  if (backAfterSick || when.getDay() === 1 || when.getDate() === 1) {
    const pref = Math.max(8 * 60 + 30, times.wake + 30)
    if (backAfterSick) {
      add({
        trigger: 'fresh_start', pref, window: [times.wake + 15, 12 * 60], stake: 3, route: '/',
        title: 'Welcome back',
        body: 'Nothing to catch up on. Just start with today.',
        why: 'You were unwell, and today is your first day back',
        purpose: 'Welcome them back after being unwell, with no pressure and nothing to make up',
      })
    } else {
      const askPlan = when.getDay() === 1 && !f.ifThen
      add({
        trigger: 'fresh_start', pref, window: [times.wake + 15, 12 * 60], stake: 3, route: askPlan ? '/progress?tab=week' : '/',
        title: when.getDay() === 1 ? 'New week' : 'New month',
        body: f.lastWeekCost ? `Last week's biggest cost: ${f.lastWeekCost}. That is the one to watch.` : 'A clean slate. One good day is enough to start.',
        why: when.getDay() === 1 ? 'It is the start of a new week' : 'It is the start of a new month',
        purpose: 'Mark a fresh start, and point at the one thing most worth watching',
        facts: f.lastWeekCost ? { biggest_cost_last_week: f.lastWeekCost } : {},
      })
    }
  }

  if (today) {
    // Streak guard: nothing logged by evening, on a streak worth keeping
    if (f.streak >= 3 && !logged.anyMeal) {
      add({
        trigger: 'streak_guard', pref: 19 * 60, window: [17 * 60 + 30, 20 * 60 + 30], stake: 7, route: '/log?tab=food',
        title: `${f.streak} days and counting`,
        body: "Logging today's meals keeps it going.",
        why: `You are on a ${f.streak}-day streak and nothing was logged today`,
        purpose: 'Protect their streak, without alarm',
        facts: { streak_days: f.streak },
      })
    }

    // Near win
    if (f.quest) {
      add({
        trigger: 'near_win', pref: 17 * 60, window: [12 * 60, 19 * 60], stake: 4, route: '/profile',
        title: 'So close',
        body: `${f.quest.label}: ${f.quest.desc}.`,
        why: `You are close to finishing "${f.quest.label}"`,
        purpose: 'Point out how close they are to finishing this week\'s goal',
        facts: { goal_name: f.quest.label, progress: f.quest.desc },
      })
    } else if (f.badge) {
      add({
        trigger: 'near_win', pref: 17 * 60, window: [12 * 60, 19 * 60], stake: 3, route: '/profile/badges',
        title: `Close to ${f.badge.name}`,
        body: `${f.badge.criterion}.`,
        why: `You are close to the ${f.badge.name} badge`,
        purpose: 'Point out how close they are to this badge',
        facts: { badge_name: f.badge.name, how_to_earn: f.badge.criterion },
      })
    }

    // Noticed progress: a real improvement, with nothing asked
    const gains = f.diff ? Object.keys(LABELS).filter(k => f.diff[k] >= 3).sort((x, y) => f.diff[y] - f.diff[x]) : []
    if (f.diff && (gains.length >= 2 || f.diff.total >= 6)) {
      const text = gains.map(k => `${LABELS[k]} ${signed(f.diff[k])}`).join(', ')
      add({
        trigger: 'noticed_progress', pref: Math.max(9 * 60, times.wake + 60), window: [times.wake + 15, 14 * 60], stake: 2, route: '/progress?tab=week',
        title: 'Yesterday was better',
        body: text ? `${text} against the day before. Nothing to do, just worth noticing.` : `Up ${f.diff.total} points on the day before. Nothing to do, just worth noticing.`,
        why: 'Yesterday scored clearly higher than the day before',
        purpose: 'Point out a real improvement. Ask nothing of them',
        facts: { score_yesterday: f.diff.score, change_total: f.diff.total, ...Object.fromEntries(gains.map(k => [`change_${k}`, f.diff[k]])) },
      })
    }

    // After dinner, for anyone it would still earn points
    if (logged.dinnerMin != null && !logged.walk && f.points.walk) {
      const pref = logged.dinnerMin + 35
      add({
        trigger: 'walk', pref, window: [pref - 10, pref + 45], stake: f.points.walk, route: '/log?tab=move',
        title: 'A short walk?',
        body: `10 minutes after dinner earns ${f.points.walk} points.`,
        why: 'Dinner is logged, and a walk still earns points today',
        purpose: 'Suggest a short walk after dinner',
        facts: { walk_minutes: 10, walk_points: f.points.walk },
      })
    }
  }

  // Coach mode adds a few check-ins, each of which looks before it speaks
  if (f.mode === 'coach') {
    if (today) {
      const d = f.diff
      const drops = d ? Object.keys(LABELS).filter(k => d[k] <= -3).sort((x, y) => d[x] - d[y]) : []
      if (drops.length || (d && d.total <= -6)) {
        add({
          trigger: 'morning_review', pref: Math.max(9 * 60, times.wake + 60), window: [times.wake + 15, 11 * 60 + 30], stake: 3, route: '/progress?tab=week',
          title: `Yesterday: ${d.score} points`,
          body: drops.length ? `${drops.map(k => `${LABELS[k]} ${signed(d[k])}`).join(', ')}. ${tipFor(drops[0], f)}` : `${Math.abs(d.total)} below the day before.`,
          why: 'Yesterday scored lower than the day before',
          purpose: 'Say plainly what dropped yesterday, without blame, and give one thing to try today',
          facts: { score_yesterday: d.score, change_total: d.total, ...Object.fromEntries(drops.map(k => [`change_${k}`, d[k]])) },
        })
      }
      if (f.drinks.goalMl > 0 && pct(f.drinks.ml, f.drinks.goalMl) < 0.4) {
        add({
          trigger: 'drinks_check', pref: 15 * 60 + 30, window: [15 * 60, 17 * 60], stake: 1, route: '/', ai: false,
          title: 'A glass of water?',
          body: 'A drink now helps you towards today\'s rough goal.',
          why: 'Your drinks were well behind the rough goal for the day',
        })
      }
      if (!logged.anyMeal || !logged.exercise) {
        add({
          trigger: 'log_day', pref: times.eveningLog, window: windowFor(times.eveningLog, 60, 30), stake: 2, route: '/log', ai: false,
          title: 'Anything to log?',
          body: 'A quick look now saves guessing tomorrow.',
          why: 'Part of today had not been logged',
        })
      }
    }
    if (!(today && logged.lunch)) {
      add({
        trigger: 'lunch_checkin', pref: times.lunch, window: [times.lunch - 15, times.lunch + 75], stake: 3, route: '/?meal=lunch', ai: false,
        title: 'Lunch time',
        body: 'Log your lunch when you have it.',
        why: 'It is your lunch reminder time, and lunch was not logged',
      })
    }
    // A timer still running in the morning: the only time this reminder is true
    if (f.timerRunning && day === (f.now.getHours() * 60 + f.now.getMinutes() < times.wake ? 0 : 1)) {
      add({
        trigger: 'wake_timer', pref: times.wake, window: [times.wake, times.wake + 60], stake: 8, route: '/', ai: false,
        title: 'Good morning',
        body: 'Your sleep timer is still running. Stop it when you are up.',
        why: 'Your sleep timer was still running',
      })
    }
  }
  return out
}

// ── Placing ──────────────────────────────────────────────────────────────────
function place(candidate, f, day, taken, nowMs) {
  const [low, high] = candidate.window || [candidate.pref, candidate.pref]
  const offsets = [0]
  for (let o = PLACE_STEP; candidate.pref - o >= low || candidate.pref + o <= high; o += PLACE_STEP) offsets.push(-o, o)
  for (const o of offsets) {
    const minutes = candidate.pref + o
    if (minutes < low || minutes > high) continue
    if (minutes < f.times.wake || minutes > f.times.bed) continue      // quiet hours
    const at = atMinutes(f.now, day, minutes)
    if (at.getTime() <= nowMs) continue
    if (taken.some(t => Math.abs(t - at.getTime()) < MIN_GAP_MS)) continue
    return at
  }
  return null
}

const slotOf = (c, at, day) => ({
  key: `${c.trigger}|${at.toISOString()}`,
  trigger: c.trigger, detail: c.detail || null,
  at, day, date: format(at, 'yyyy-MM-dd'),
  title: c.title, body: c.body, why: c.why,
  channel: c.channel, route: c.route,
  ai: !!c.ai, purpose: c.purpose || null, facts: c.facts || {},
})

function rank(candidates, ctx, nowMs) {
  const threeDays = 3 * 86400000
  const recent = ctx.recent || []
  const score = (c) => c.stake - RECENT_PENALTY * recent.filter(r => r.trigger === c.trigger && nowMs - r.at < threeDays).length
  const lastSent = (c) => Math.max(0, ...recent.filter(r => r.trigger === c.trigger).map(r => r.at))
  return [...candidates].sort((a, b) => score(b) - score(a) || lastSent(a) - lastSent(b))
}

// ── Wraps ────────────────────────────────────────────────────────────────────
function wrapsFor(f, day) {
  const when = addDays(startOfDay(f.now), day)
  const out = []
  const today = day === 0
  if (when.getDay() === WRAP_WEEK_DOW) {
    const w = today ? f.weekWrap : null
    out.push({
      trigger: 'wrap_week', pref: 20 * 60, window: [f.times.wake, f.times.bed], stake: 100, channel: CHANNELS.summaries, route: '/progress?tab=week', ai: true,
      title: w ? `Week wrap: average ${w.avg}` : 'Your week is ready to review',
      body: w ? `${w.change != null ? `${signed(w.change)} against last week. ` : ''}${w.cost ? `Biggest cost: ${w.cost}.` : 'Open Progress for the detail.'}` : 'Open Progress to see how it went.',
      why: 'Your weekly summary is due on Sunday',
      purpose: w ? 'Sum up the week in one line and offer one takeaway' : 'Invite them to open the app and review their week. Do not state any results',
      facts: w ? { avg_score: w.avg, days_logged: w.days, ...(w.change != null ? { change_vs_last_week: w.change } : {}), ...(w.cost ? { biggest_cost: w.cost } : {}) } : {},
    })
  }
  const lastOfMonth = addDays(when, 1).getDate() === 1
  if (lastOfMonth) {
    const m = today ? f.monthWrap : null
    out.push({
      trigger: 'wrap_month', pref: 20 * 60, window: [f.times.wake, f.times.bed], stake: 100, channel: CHANNELS.summaries, route: '/progress?tab=month', ai: true,
      title: m ? `Month wrap: average ${m.avg}` : 'Your month is ready to review',
      body: m ? `${m.days} days logged${m.change != null ? `, ${signed(m.change)} against last month` : ''}.` : 'Open Progress to see how it went.',
      why: 'Your monthly summary is due on the last day of the month',
      purpose: m ? 'Sum up the month in one line' : 'Invite them to open the app and review their month. Do not state any results',
      facts: m ? { avg_score: m.avg, days_logged: m.days, ...(m.change != null ? { change_vs_last_month: m.change } : {}) } : {},
    })
  }
  return out
}

/**
 * ctx: {
 *   sentToday: [{ trigger, at }],     notifications already sent today, at in ms
 *   recent:    [{ trigger, at }],     sent in the last few days
 *   sickNoteSent: boolean,            a get-well note already went out for this spell
 *   rest: { off:Set, rested:Set, restedEvidence:Set, throttled:boolean },
 * }
 */
export function planSlots(f, ctx = {}) {
  const rest = { off: new Set(), rested: new Set(), restedEvidence: new Set(), throttled: false, ...(ctx.rest || {}) }
  const context = { ...ctx, rest, recent: ctx.recent || [], sentToday: ctx.sentToday || [] }
  const nowMs = f.now.getTime()
  const blocked = (trigger) => rest.off.has(trigger) || rest.rested.has(trigger)

  // Everything stops on a sick day, apart from one gentle note the next morning
  if (f.sickToday) {
    if (context.sickNoteSent) return []
    const minutes = Math.max(f.times.wake + 60, 8 * 60)
    const c = {
      trigger: 'sick_note', channel: CHANNELS.nudges, route: '/',
      title: 'Hope you are feeling better',
      body: "Open Health Quest when you're ready.",
      why: 'You marked yesterday as a sick day',
    }
    return [slotOf(c, atMinutes(f.now, 1, minutes), 1)]
  }

  const slots = []
  for (let day = 0; day < ANCHOR_DAYS; day++) {
    const taken = day === 0 ? context.sentToday.map(s => s.at) : []
    const sentNudges = day === 0 ? context.sentToday.filter(s => !ANCHORS.has(s.trigger)).length : 0
    const daySlots = []

    // Anchors keep their time: the user set it, even when two sit close together
    for (const a of anchorsFor(f, day)) {
      if (rest.off.has(a.trigger)) continue
      const at = atMinutes(f.now, day, a.pref)
      if (at.getTime() <= nowMs) continue
      daySlots.push(slotOf(a, at, day))
      taken.push(at.getTime())
    }

    if (day < ANCHOR_DAYS) {
      // Wraps are promised to every mode, and take the day's slot outside Coach
      let wraps = wrapsFor(f, day).filter(w => !rest.off.has(w.trigger))
      if (f.mode !== 'coach' && wraps.length > 1) wraps = wraps.filter(w => w.trigger === 'wrap_month')
      for (const w of wraps) {
        const at = place(w, f, day, taken, nowMs)
        if (!at) continue
        daySlots.push(slotOf(w, at, day))
        taken.push(at.getTime())
      }

      if (day < NUDGE_DAYS) {
        const throttledToday = rest.throttled && addDays(startOfDay(f.now), day).getDate() % 2 === 1
        let cap = NUDGE_CAP[f.mode] - sentNudges - (f.mode !== 'coach' ? wraps.length : 0)
        if (throttledToday) cap = 0
        const candidates = rank(nudgesFor(f, day, context).filter(c => !blocked(c.trigger)), context, nowMs)
        for (const c of candidates) {
          if (cap <= 0) break
          const at = place(c, f, day, taken, nowMs)
          if (!at) continue
          daySlots.push(slotOf(c, at, day))
          taken.push(at.getTime())
          cap--
        }
      }
    }
    slots.push(...daySlots)
  }

  // Booked ahead and rebooked at every open, so they only ever fire for someone who
  // really stayed away. After the last one, nothing: someone who has left is not chased.
  if (f.mode !== 'quiet' && !rest.off.has('comeback')) {
    COMEBACK_DAYS.forEach((day, i) => {
      const minutes = Math.max(10 * 60, f.times.wake + 60)
      const c = i === 0 ? {
        trigger: 'comeback', channel: CHANNELS.nudges, route: '/log?tab=food', ai: true,
        title: 'No catching up needed',
        body: "Just log today's breakfast if you feel like it.",
        why: 'You had not opened the app for a few days',
        purpose: 'Invite them back after a few days away with one tiny ask and no guilt. Do not mention how long it has been',
      } : {
        trigger: 'comeback', channel: CHANNELS.nudges, route: '/', ai: true,
        title: 'Here when you are ready',
        body: 'Nothing to make up. One log is enough to start again.',
        why: 'You had not opened the app for a week',
        purpose: 'One last gentle invitation after a week away, with no guilt. Do not mention how long it has been',
      }
      slots.push(slotOf(c, atMinutes(f.now, day, minutes), day))
    })
  }
  return slots.sort((a, b) => a.at - b.at)
}
