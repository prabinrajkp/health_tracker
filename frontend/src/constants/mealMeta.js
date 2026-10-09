// Shared meal-category metadata — used by both Activity.jsx's per-meal tiles
// and AddMealFlow so the two stay visually and semantically consistent.
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks', 'drink', 'other']

export const MEAL_META = {
  breakfast: { icon: '🌅', label: 'Breakfast', color: '#f59e0b', hint: 'Target: 7–9 AM' },
  lunch:     { icon: '☀️', label: 'Lunch',     color: '#22c55e', hint: 'Target: 12–2 PM' },
  dinner:    { icon: '🌙', label: 'Dinner',     color: '#a78bfa', hint: 'Target: before 8:30 PM' },
  snacks:    { icon: '🍎', label: 'Snacks',    color: '#f97316', hint: 'Each item tracked with its own time' },
  drink:     { icon: '🥤', label: 'Drink',     color: '#38bdf8', hint: 'Anytime, multiple times' },
  other:     { icon: '🍽️', label: 'Other',     color: '#64748b', hint: 'Other meals' },
}

// Guesses the meal category from the current time so most users never need to
// touch the category picker at all — it stays reachable as an override, just
// no longer a mandatory first step. Boundaries follow common Indian meal windows.
export function defaultCategoryForTime(date = new Date()) {
  const mins = date.getHours() * 60 + date.getMinutes()
  if (mins < 11 * 60) return 'breakfast'
  if (mins < 15 * 60 + 30) return 'lunch'
  if (mins < 19 * 60) return 'snacks'
  return 'dinner'
}
