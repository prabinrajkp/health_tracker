# Health Quest 🏃

> A fully offline, gamified personal health tracker built for fat loss, triglyceride control, and prediabetes reversal — running entirely on your Android phone with no cloud, no account, and no backend required.

**Guide & APK download:** https://prabinrajkp.github.io/health_tracker

---

## What is this?

Health Quest turns daily health habits into a scored game. Every day you start at 0 and earn points by eating well, walking, exercising, sleeping on time, and fasting long enough. The score tells you honestly how your day went — not how you felt about it.

Built around a real health plan targeting:

- Weight reduction (135 kg → 120 kg first target)
- Triglycerides: 538 → normal
- HbA1c: 6.0 → pre-diabetic reversal
- Fatty liver improvement
- Consistent sleep and energy

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Charts | Recharts |
| State | Zustand |
| Local DB | Dexie (IndexedDB) |
| Mobile | Capacitor v8 (Android) |
| Notifications | `@capacitor/local-notifications` |
| File I/O | `@capacitor/filesystem` |
| Image export | `html-to-image` |
| Data export | SheetJS (xlsx) |

**Fully offline.** All data lives in IndexedDB on the phone. No login, no server, no internet required after install.

---

## Scoring System

| Category | Max Points | How it's earned |
|----------|-----------|----------------|
| **Diet** | 35 pts | Per-meal food items with portion scoring; penalty for dinner after 9 PM |
| **Fasting** | 10 pts | Logistic curve from last dinner → first breakfast (12 h min, 16 h target) |
| **Workout** | 35 pts | Steps + post-dinner walk + exercise session |
| **Sleep** | 30 pts | Sleep timing + duration + effective hours (minus screen time) |
| **Bonus** | +10 pts | Near-perfect or perfect day |
| **Total** | ~100 pts | All components added; bonus can push above 100 briefly |

### Steps Scoring Curve

| Steps | Points |
|-------|--------|
| < 5,000 | 0 |
| 5,000 | 7.5 pts (half base) |
| 8,000 | 15 pts (full base) |
| 10,000 | 18 pts (+ bonus) |
| 14,000 | ~23 pts |
| 18,000+ | **28 pts max** |

Above 10,000 steps, points increase linearly to 28 at 18,000 steps. All thresholds are configurable in Settings.

### Grade Scale

| Score | Grade |
|-------|-------|
| 90–100 | S — Outstanding |
| 80–89 | A — Excellent |
| 70–79 | B — Great |
| 60–69 | C — Good |
| 40–59 | D — Below target |
| < 40 | F — Needs work |

---

## Daily Rules (Non-Negotiable)

1. No banana chips after dinner
2. Dinner by 8:30 PM
3. Tea: 1 spoon sugar only
4. Protein first, rice second
5. 8,000+ steps daily
6. Sleep before 11:30 PM

---

## Features

### Dashboard
- Score ring with grade (S/A/B/C/D/F) and today's date
- Per-category stat bars: Diet · Fasting · Workout · Sleep
- Inline penalty chips when rules are broken (dinner after 9 PM, sleep after midnight)
- Performance radar chart (Diet / Workout / Sleep proportional to max)
- Score breakdown with bonus
- Notes & comments: foods logged, sleep times, fasting window, screen time
- Daily quests (tap to go to each log page)
- Day streak counter
- Daily rules reminder

### Diet Log
- Four meal tabs: Breakfast · Lunch · Dinner · Snacks
- Per-food-item portion tracking with points per portion and ideal portions
- Snacks tab: each item carries its own timestamp
- Fasting widget: shows current fast progress with elapsed time in `Xh Ymin` format
  - Resets to "next fast" mode after today's dinner is logged
- Dinner-after-9-PM penalty preview
- Custom meal options managed in Settings (good/bad categories, ideal portions)

### Workout Log
- Step count with color-coded target progress
- Post-dinner walk toggle + duration
- Exercise session toggle + type + duration
- Live score preview

### Sleep Log
- Sleep timer: tap to start at bedtime, tap Wake Up in the morning
- Automatic screen-time deduction via Android Usage Stats API
- Completed sleep summary card (fell asleep · woke up · total · effective · sleep points)
- Manual time entry + quick presets
- Screen time stepper (0.5 h increments)
- Sleep quality rating (1–5)
- Notes field
- Live score preview

### History
- Monthly calendar with color-coded dots (green/yellow/orange/red by score)
- Tap any past day → full detail panel:
  - Score, grade, performance radar
  - Category breakdown
  - Foods logged (all meals including snacks + times)
  - Sleep times, total, effective, screen time
  - Fasting window
  - Notes
- Share / export day as PNG image (Web Share API with Filesystem fallback)
- Monthly chart toggle: Stacked bar (Diet · Workout · Sleep) or Line chart
- Line chart metrics: **Total · Diet · Workout · Sleep · Fasting · Steps**
- Monthly summary: avg score, best day, days logged

### Settings
- Theme toggle (Dark / Light)
- Player profile: display name, current weight, target weight
- Configurable score weights: all category maxes and individual item points
- Step thresholds: partial credit, full credit, bonus start, max bonus (all configurable)
- Fasting targets: min hours, target hours, max points
- Penalty amounts: dinner timing, sleep after midnight
- Custom meal options: add/remove foods with category, points/portion, ideal portions
- Reminders (Android): bedtime, wake-up, step check-ins (×3), lunch, hydration (fixed)
- Data export: full Excel workbook (scores, diet, workout, sleep, food items)

---

## Building the APK

### Prerequisites

- Node.js 18+
- Java 21 (OpenJDK) — installed automatically if missing
- Android SDK — downloaded automatically if missing
- Internet connection (first build only, to download SDK)

### One-Command Build

```bash
bash build_apk.sh
```

The script will:
1. Install Java 21 if needed
2. Download Android SDK command-line tools if needed
3. Accept SDK licenses and install `android-35` + `build-tools;35.0.0`
4. Run `npm install` and `npm run build`
5. Run `npx cap sync android`
6. Build the debug APK with Gradle
7. Copy the APK to the project root

### Install on Phone

**Option A — USB (fastest):**
```bash
adb install health-quest-v2.13-debug.apk
```

**Option B — WiFi (same network):**
```bash
python3 -m http.server 9999 --directory .
```
Then open `http://<your-pc-ip>:9999/health-quest-v2.13-debug.apk` on your phone and tap to install.

> Settings → Apps → Install unknown apps → enable for your browser

---

## Project Structure

```
health_tracker/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js          # Routes to local store (Capacitor) or FastAPI (browser)
│   │   ├── components/
│   │   │   ├── DayDetail.jsx      # Shared radar + score breakdown + notes panel
│   │   │   ├── Navbar.jsx
│   │   │   ├── ScoreRing.jsx      # Animated SVG score ring
│   │   │   └── StatBar.jsx        # Progress bar component
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Home screen
│   │   │   ├── DietLog.jsx        # Meal + fasting tracking
│   │   │   ├── WorkoutLog.jsx     # Steps + exercise tracking
│   │   │   ├── SleepLog.jsx       # Sleep timer + manual entry
│   │   │   ├── History.jsx        # Calendar + charts + day detail
│   │   │   └── Settings.jsx       # All configuration
│   │   ├── services/
│   │   │   ├── db.js              # Dexie schema + default weights
│   │   │   ├── localStore.js      # All CRUD operations + score computation
│   │   │   └── scoring.js         # Pure scoring functions (no side effects)
│   │   └── store/
│   │       └── useStore.js        # Zustand global state
│   └── android/                   # Capacitor Android project
├── backend/                       # FastAPI (optional, for desktop browser dev)
├── build_apk.sh                   # One-command APK builder
└── requiremet_doc.MD              # Original health plan
```

---

## Data Storage

All data is stored in `IndexedDB` via Dexie under the database name `HealthQuestDB`:

| Table | Contents |
|-------|---------|
| `diet_logs` | Daily meal items, portion data, meal times |
| `workout_logs` | Steps, walk, exercise per day |
| `sleep_logs` | Sleep/wake times, hours, screen time, quality |
| `daily_scores` | Computed score per day (diet, fasting, workout, sleep, bonus, total, steps) |
| `tracker_config` | All settings: weights, custom meals, notifications, profile |

Scores are recomputed on every save and cached in `daily_scores`. A startup migration ensures historical records have all fields (fasting_score, steps) populated.

---

## Development (Browser)

```bash
cd frontend
npm install
npm run dev
```

The app will use the FastAPI backend if `VITE_API_URL` is set, or fall back to IndexedDB automatically. For pure local-only development:

```bash
# No backend needed — IndexedDB works in Chrome/Firefox
npm run dev
```

---

## License

Personal use. Built for one person's health journey.
