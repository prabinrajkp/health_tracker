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

Four tabs, each with one job. Everything saves as you change it — there is no Save button in logging.

### Today
- Score, grade (S/A/B/C/D/F) and the four category bars: Diet · Fasting · Workout · Sleep
- One **Next** card: the most useful thing left to do today. Tapping it opens the place to do it
- Any penalty already applied (late dinner, sleep after midnight) shown under it
- Four log buttons with done-state: Meal · Move · Sleep · Weight
- "Full detail" opens the day's radar, breakdown and optional AI health summary

### Log
- **Food:** each meal lists its foods with portions and the meal time; **+ Add** opens Add Meal on that meal (search, Repeat Yesterday, frequent and recent meals, named meals, optional AI lookup). One fasting line and the calories and macro targets sit below
- **Move:** steps synced from Health Connect or the phone sensor, or typed in (a typed count is kept for the day until you tap Sync); switches for post-dinner walk and exercise
- **Sleep:** one timer button with automatic screen-time deduction; manual times, presets, quality and notes under Edit details

### Progress
- **Week:** average score, one **What to fix**, and a **Why** card with wins and costs
- **Month:** colour-coded calendar first; tap a day for full detail and share it as a PNG; month insights behind one expander
- **Trends:** line or stacked score chart, Meal Insights, and all-time stats

### Profile
- Level and XP, streak, the next badge closest to unlocking, today's and this week's goals, earned badges
- "See all" lists every badge by category, including combination badges
- The gear icon opens Settings

### Weight
- Daily weigh-in, 7-day average, change vs last week and since start, distance to target, 30d / 90d / 1y trend

### Settings
- **You:** name, body & goal (height, age, activity, target weight, rate of loss), theme
- **Scoring:** one screen for category maximums, workout points and step targets, sleep, fasting and penalties, with Reset to defaults
- **Food & AI:** custom foods with points, ideal portions and nutrition; optional AI key
- **Reminders & data:** Quiet / Standard / Coach notification level, reminder times, Excel export, JSON backup and restore, tutorial

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
adb install health-quest-v4.29-debug.apk
```

**Option B — WiFi (same network):**
```bash
python3 -m http.server 9999 --directory .
```
Then open `http://<your-pc-ip>:9999/health-quest-v4.29-debug.apk` on your phone and tap to install.

> Settings → Apps → Install unknown apps → enable for your browser

---

## Project Structure

```
health_tracker/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js          # Routes to local store (Capacitor) or FastAPI (browser)
│   │   ├── components/            # AddMealFlow, BottomSheet, DayDetail, BadgeTile, Navbar…
│   │   ├── pages/
│   │   │   ├── Today.jsx          # Score, next action, log buttons
│   │   │   ├── Log.jsx            # Food / Move / Sleep switch (auto-save)
│   │   │   ├── log/               # FoodSection, MoveSection, SleepSection
│   │   │   ├── Progress.jsx       # Week / Month / Trends
│   │   │   ├── Profile.jsx        # Level, next badge, goals, badges
│   │   │   ├── Badges.jsx         # All badges by category
│   │   │   ├── Weight.jsx         # Weight log and trend
│   │   │   └── Settings.jsx       # All configuration
│   │   ├── services/
│   │   │   ├── db.js              # Dexie schema + default weights
│   │   │   ├── localStore.js      # All CRUD operations + score computation
│   │   │   ├── scoring.js         # Pure scoring functions (no side effects)
│   │   │   ├── nextAction.js      # Picks Today's one next action
│   │   │   └── reminders.js       # Fixed reminders and the notification level
│   │   └── store/
│   │       └── useStore.js        # Zustand global state
│   └── android/                   # Capacitor Android project
├── backend/                       # FastAPI (optional, for desktop browser dev)
├── build_apk.sh                   # One-command APK builder
└── docs/                          # Planning docs and original health plan (requiremet_doc.MD)
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
