// How much the app is allowed to notify. One setting governs everything the planner
// books (see nudgePlanner.js):
//
//   quiet     bedtime only, plus the weekly / monthly wrap
//   standard  bedtime + dinner, plus one nudge a day   → at most 3 a day
//   coach     bedtime + dinner, plus up to four nudges → about 6 a day
export const NOTIFICATION_MODES = [
  { id: 'quiet',    label: 'Quiet',    desc: 'Bedtime reminder and the weekly summary only' },
  { id: 'standard', label: 'Standard', desc: 'Bedtime, dinner and one nudge — at most 3 a day' },
  { id: 'coach',    label: 'Coach',    desc: 'Bedtime, dinner and up to four nudges — about 6 a day' },
]
export const DEFAULT_NOTIFICATION_MODE = 'standard'
