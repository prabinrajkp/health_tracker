// Combination badges: each is earned by holding all of its component badges.
export const SUPER_BADGES = [
  {
    id: 'total_balance_core',
    name: 'Total Balance Core',
    emoji: '⚖️',
    required: ['step_beast', 'sleep_guardian', 'clean_fuel'],
    requireLabels: ['Step Beast', 'Sleep Guardian', 'Clean Fuel'],
    description: 'Master all three pillars: fitness, sleep, and clean nutrition in one journey.',
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '🔱',
    required: ['week_warrior', 'cardio_ignition', 'night_discipline'],
    requireLabels: ['Week Warrior', 'Cardio Ignition', 'Night Discipline'],
    description: '7-day streak, cardio dominance, and disciplined sleep — the trinity of iron.',
  },
  {
    id: 'phoenix_rising',
    name: 'Phoenix Rising',
    emoji: '🦅',
    required: ['bounce_back', 'phoenix_week', 'titan_protocol'],
    requireLabels: ['Bounce Back', 'Phoenix Week', 'Titan Protocol'],
    description: 'Fall, recover, and hit the summit. The rarest comeback achievable.',
  },
]
