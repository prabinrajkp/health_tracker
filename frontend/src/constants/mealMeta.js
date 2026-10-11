import { Sunrise, Sun, Moon, Apple, CupSoda, Utensils } from 'lucide-react'

// Shared meal-category metadata — used by both the Log screen's meal groups
// and AddMealFlow so the two stay visually and semantically consistent.
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks', 'drink', 'other']

export const MEAL_META = {
  breakfast: { Icon: Sunrise,  label: 'Breakfast' },
  lunch:     { Icon: Sun,      label: 'Lunch' },
  dinner:    { Icon: Moon,     label: 'Dinner' },
  snacks:    { Icon: Apple,    label: 'Snacks' },
  drink:     { Icon: CupSoda,  label: 'Drink' },
  other:     { Icon: Utensils, label: 'Other' },
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
