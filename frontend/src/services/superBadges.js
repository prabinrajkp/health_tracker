// Combination badges: each is earned by holding all of its component badges.
export const SUPER_BADGES = [
  {
    id: 'total_balance_core',
    name: 'Total Balance Core',
    emoji: '⚖️',
    required: ['step_beast', 'sleep_guardian', 'clean_fuel'],
    requireLabels: ['Step Beast', 'Sleep Guardian', 'Clean Fuel'],
    description: 'Master all three pillars: fitness, sleep, and clean nutrition in one journey.',
    grad: 'linear-gradient(135deg,#1e3a5f,#1a4a3a,#3d1f00)',
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '🔱',
    required: ['week_warrior', 'cardio_ignition', 'night_discipline'],
    requireLabels: ['Week Warrior', 'Cardio Ignition', 'Night Discipline'],
    description: '7-day streak, cardio dominance, and disciplined sleep — the trinity of iron.',
    grad: 'linear-gradient(135deg,#3d1a1a,#1a1a3d,#1a3d2a)',
  },
  {
    id: 'phoenix_rising',
    name: 'Phoenix Rising',
    emoji: '🦅',
    required: ['bounce_back', 'phoenix_week', 'titan_protocol'],
    requireLabels: ['Bounce Back', 'Phoenix Week', 'Titan Protocol'],
    description: 'Fall, recover, and hit the summit. The rarest comeback achievable.',
    grad: 'linear-gradient(135deg,#3d1a00,#1a0d3d,#3d2800)',
  },
]
