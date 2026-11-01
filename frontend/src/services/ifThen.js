// If-then plans for the week's biggest cost. Simple, specific plans work better than
// complex ones, so the choices are fixed and short. They are the app's own words, not
// free text, which is what lets them be sent to the AI and quoted back in a nudge.
import { format, startOfWeek } from 'date-fns'

export const IF_THEN_OPTIONS = {
  late_dinner: {
    pref: 18 * 60 + 30, route: '/?meal=dinner',
    plans: ['If dinner is running late, I will start cooking by 7:30', 'If I will be out late, I will eat before I leave'],
  },
  poor_sleep: {
    pref: 21 * 60, route: '/',
    plans: ['If it is 10:30, I will put my phone away', 'If I am still up at 11, I will start the sleep timer and go to bed'],
  },
  junk_food: {
    pref: 16 * 60, route: '/log?tab=food',
    plans: ['If I want a snack, I will have fruit first', 'If junk food is offered, I will take one small portion'],
  },
  no_breakfast: {
    pref: 8 * 60, route: '/?meal=breakfast',
    plans: ['If I am short of time, I will have something simple like a banana and milk', 'If I wake up late, I will take breakfast with me'],
  },
  poor_steps: {
    pref: 18 * 60, route: '/log?tab=move',
    plans: ['If I finish dinner, I will walk for 15 minutes', 'If I take a phone call, I will walk during it'],
  },
  no_workout: {
    pref: 17 * 60, route: '/log?tab=move',
    plans: ['If it is 6 PM on a workday, I will exercise for 20 minutes', 'If I miss a session, I will go for a walk instead'],
  },
  inconsistent_wake: {
    pref: 21 * 60 + 30, route: '/',
    plans: ['If my alarm rings, I will get up straight away', 'If it is the weekend, I will still wake within 30 minutes of my usual time'],
  },
}

export const weekKey = (date = new Date()) => format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')

// The plan for this week, or null when none is set or it belongs to an earlier week.
export function currentIfThen(config, now = new Date()) {
  try {
    const plan = JSON.parse(config?.if_then_plan || 'null')
    return plan?.week === weekKey(now) && IF_THEN_OPTIONS[plan.cost] ? plan : null
  } catch {
    return null
  }
}
