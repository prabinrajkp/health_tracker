# Health Quest 🏃

> A fully offline, gamified health tracker for Android. Score your diet, fasting, workouts and sleep every day — no cloud, no account, and no backend required.

**Guide & APK download:** https://prabinrajkp.github.io/health_tracker

---

## What is this?

Health Quest turns daily health habits into a scored game. Every day you start at 0 and earn points by eating well, walking, exercising, sleeping on time, and fasting long enough. The score tells you honestly how your day went — not how you felt about it.

A short setup asks for your goals, activity level and main struggle, and tunes the scoring to match. From then on the app shows one score, one next action, and one thing to fix each week. Levels, goals and 100+ badges keep it rewarding over time.

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

**Fully offline.** All data lives in IndexedDB on the phone. No login, no server, no internet required after install. Optional AI features use your own key and only send what they need: AI-written nudges, off by default, send summary figures about once a day.

---

## Scoring System

These are the default maximums. Setup adjusts them to your goals, and all of them can be changed in Settings → Scoring rules.

| Category | Max Points | How it's earned |
|----------|-----------|----------------|
| **Diet** | 35 pts | Points per food and portion; junk food and dinner after 9 PM take points off |
| **Fasting** | 10 pts | Logistic curve from last dinner → first breakfast (12 h min, 16 h target). Off by default when your goal is to gain weight |
| **Workout** | 35 pts | Steps + post-dinner walk + exercise session |
| **Sleep** | 30 pts | Bedtime + effective hours (minus screen time) + wake time |
| **Calories** | 10 pts | Staying near the calorie target for your body goal; only counted once body details and food nutrition are set |
| **Bonus** | +10 pts | Near-perfect or perfect day |
| **Total** | 100 pts | All components added and capped at 100 |

### Steps Scoring Curve (default)

| Steps | Points |
|-------|--------|
| < 5,000 | 0 |
| 5,000 | 7.5 pts (half base) |
| 8,000 | 15 pts (full base) |
| 10,000 | 18 pts (+ bonus) |
| 14,000 | ~23 pts |
| 18,000+ | **28 pts max** |

Above 10,000 steps, points increase linearly to 28 at 18,000 steps. The step targets shift with the activity level chosen in setup, from 6,000 for sedentary up to 12,000 for very active.

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

## Features

Four tabs, each with one job. Everything saves as you change it — there is no Save button in logging.

The Android back button closes whatever is on top first (a sheet, a pop-up, a step in Add Meal), then goes back one level, then to Today, and leaves the app from Today. Switching tabs never adds to the history.

### Today
- Score, grade (S/A/B/C/D/F) and the four category bars: Diet · Fasting · Workout · Sleep
- One **Next** card: the most useful thing left to do today. Tapping it opens the place to do it
- Any penalty already applied (late dinner, sleep after midnight) shown under it
- A drinks card with a glass that fills: one tap adds a glass of water, and tapping the card opens the full drinks sheet
- A sleep timer button: start it at bedtime, stop it when you wake
- Four log buttons with done-state: Meal · Move · Sleep · Weight
- Sick days: one tap on "Not feeling well?" sets the day aside, with no score and no effect on averages, and the streak pauses instead of breaking. After days with nothing logged, Today asks whether you were unwell
- "Full detail" opens the day's radar, breakdown and optional AI health summary

### Log
- **Food:** each meal lists its foods with portions and the meal time; **+ Add** opens Add Meal on that meal (search, Repeat Yesterday, frequent and recent meals, named meals, optional AI lookup). One fasting line and the calories and macro targets sit below
- **Drinks** (one row on Food, opening a sheet): one tap adds a glass of water; the sheet adds bigger amounts or another drink and lists the day's entries. Drinks logged in a meal (coffee, tea, juice, milk) are counted automatically, because foods can be tagged as drinks with a mL per portion. The total counts toward an estimated daily goal from body weight (30 mL per kg), which can be set by hand or switched off, and is never part of the score
- **Net calories** (on the Calories card): food eaten minus an estimate of everything burned, against the net your goal asks for. It opens to show resting burn, steps and exercise. It is information only and never changes the score or the food target
- **Move:** steps synced from Health Connect or the phone sensor, or typed in (a typed count is kept for the day until you tap Sync); switches for post-dinner walk and exercise, with a Normal or Hard choice for sessions
- **Sleep:** one timer button with automatic screen-time deduction; manual times, presets, quality and notes under Edit details

### Progress
- **Week:** average score, average net calories with a bar for each complete day, one **What to fix**, and a **Why** card with wins and costs
- **Month:** colour-coded calendar first; tap a day for full detail and share it as a PNG; average net calories; **Expected vs actual**, which compares your logs with your weight trend after about 3 weeks and offers a corrected maintenance figure; month insights behind one expander
- **Trends:** line or stacked score chart, Meal Insights, and all-time stats

### Profile
- Level and XP, streak, the next badge closest to unlocking, today's and this week's goals, earned badges
- "See all" lists every badge by category, including combination badges
- The gear icon opens Settings

### Weight
- Daily weigh-in, 7-day average, change vs last week and since start, distance to target, 30d / 90d / 1y trend. Colours follow your body goal, so gaining is good news when gaining is the goal. Reaching your target offers a switch to Keep

### Notifications
- The rules decide whether to notify, when, and which numbers are true, and work offline. Everything is booked with plain rule-written text first, so nothing depends on a network call
- **Booked ahead:** bedtime and dinner a week out, nudges for three days, and a gentle comeback at day 3 and day 7 away. After that, nothing. Every open replans, so anything already done is cancelled
- **Nudges:** before a late dinner, your own patterns (such as earlier dinners and sleep score, at least 5 days each side), streak guard, nearly-there goals, noticed progress, fresh starts, and the if-then plan you pick for the week's biggest cost
- **Limits:** at least 2 hours apart, quiet between bedtime and wake-up, nothing on a sick day but one note the next morning
- **Learns simply:** a kind ignored 3 times in a row rests for 7 days, two "not helpful" ratings turn it off, and mostly ignored nudges drop to every other day
- **AI wording (optional):** the AI only rewords facts the rules chose. Every number is checked against those facts, and anything that fails keeps the rule-written text. Groq is tried first, then OpenRouter on hosts that do not collect data

### Home-screen widgets
Eight widgets, each with one job, in the app's own colours and following its Light, Dark or System theme:
- **To see:** Today (score, grade and the next step, which moves on with the clock), This week (a dot per day and one thing to fix), Calories (food against target, worded for your body goal), Goals (level, streak and today's goals)
- **To log:** Drinks (one tap adds a glass, and the glass fills at once), Sleep timer (start and stop on the home screen, with a live clock), Quick log (Meal, Move, Sleep and Weight, each opening its screen), Weight (step from your last weight in 0.1 kg and save)
- Taps on a widget are kept on the phone and written to your logs the next time the app opens, each with its own time. Scores update then. Starting the timer on a widget cancels that night's bedtime reminder
- Yesterday's score is never shown as today's: after midnight each widget shows today as not started yet
- Add them from **Settings → Widgets**, or from the home screen's widget list

### Settings
- **You:** name, body & goal (Lose, Keep or Gain, pace, Build muscle, height, age, activity, target weight, hide calorie numbers, optional active calories from Health Connect), water goal and glass size, theme
- **Scoring:** one screen for category maximums, workout points and step targets, sleep, fasting and penalties, with Reset to defaults
- **Food & AI:** custom foods with points, ideal portions and nutrition; optional AI key. Foods not logged for more than 7 days move to an archive to keep the list short. They can be restored, still appear in Add Meal search, and come back by themselves when logged. Each food can be marked as a drink with its mL per portion
- **Widgets:** a preview of each, with an Add button that places it on the home screen
- **Reminders & data:** Quiet / Standard / Coach notification level, reminder times, optional AI-written nudges with a view of exactly what is sent, recent nudges with why each was sent and helpful or not buttons, Excel export, JSON backup and restore, tutorial

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
adb install health-quest-v4.39-debug.apk
```

**Option B — WiFi (same network):**
```bash
python3 -m http.server 9999 --directory .
```
Then open `http://<your-pc-ip>:9999/health-quest-v4.39-debug.apk` on your phone and tap to install.

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
│   │   │   ├── widgetData.js      # Everything the home-screen widgets show
│   │   │   ├── widgetInbox.js     # Writes taps made on a widget when the app opens
│   │   │   └── reminders.js       # Fixed reminders and the notification level
│   │   └── store/
│   │       └── useStore.js        # Zustand global state
│   ├── scripts/                   # Widget colours and icons, generated from the app's theme
│   └── android/                   # Capacitor Android project, with the widgets in Java
├── backend/                       # FastAPI (optional, for desktop browser dev)
├── build_apk.sh                   # One-command APK builder
└── docs/                          # Planning docs, app critique and revamp plan
```

---

## Data Storage

All data is stored in `IndexedDB` via Dexie under the database name `HealthQuestDB`:

| Table | Contents |
|-------|---------|
| `diet_logs` | Daily meal items, portion data, meal times |
| `workout_logs` | Steps, walk, exercise per day |
| `sleep_logs` | Sleep/wake times, hours, screen time, quality |
| `weight_logs` | Daily weigh-ins |
| `water_logs` | Each day's drinks and the goal that applied that day |
| `sick_days` | Dates set aside because you were unwell |
| `meals` | Each logged meal, used for Repeat Yesterday, frequent meals and Meal Insights |
| `meal_templates` | Meals you repeat, learned automatically |
| `badges` | Badge progress, unlock dates and earn counts |
| `daily_scores` | Computed score per day (diet, fasting, workout, sleep, calories, bonus, total, steps) |
| `tracker_config` | All settings: scoring rules, custom foods, reminders, profile |

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

Released under the [MIT License](LICENSE). You are free to use, modify and share it; it comes with no warranty.
