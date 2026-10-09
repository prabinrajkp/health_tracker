# Changelog — Health Quest

All notable changes to this project are documented here.

## [v4.28] — 2026-09-10

### Changed
- **AI Health Summary — on-demand with per-day caching** — the summary no longer auto-generates every time the Full Detail panel opens. Instead a "Generate Health Summary" button appears on first open; once generated it is saved to local storage keyed by date so re-opening the panel that day instantly shows the cached result. A Regenerate button remains available to refresh it manually.

---

## [v4.27] — 2026-09-10

### Added
- **AI health coaching summary** — the "Notes & Comments" section in the Full Detail panel (home screen and history) is replaced by a live, AI-generated executive brief. When the Full Detail view opens, the app automatically feeds the day's diet, sleep, and workout data to the LLM and produces a three-pillar summary (diet / sleep / workout — one positive and one improvement per pillar) plus tomorrow's focus priorities. Shows a spinner while generating and a Regenerate button to refresh. Gracefully falls back to a "add an API key in Settings" prompt when no AI key is configured.

---

## [v4.26] — 2026-09-10

### Fixed
- **Keyboard popping up on every screen** — the Add Meal search box used `autoFocus`, which fires as soon as the component mounts; since the bottom sheet stays permanently mounted (CSS-hidden, not unmounted) so it can animate open/closed, this meant the phone's keyboard would pop up the instant the app loaded, even on screens with no visible text field. The search box now only focuses once the sheet actually opens on the browse step, timed to its slide-in animation, and blurs again when it closes.

---

## [v4.25] — 2026-09-09

### Fixed
- **AI provider models** — updated Groq model IDs after `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` were deprecated and shut down on August 16, 2026; replaced with `openai/gpt-oss-120b` and `openai/gpt-oss-20b`; also added `meta-llama/llama-3.3-70b-instruct:free` as the new primary OpenRouter model for improved reliability

---

## [v4.24] — 2026-07-31

### Added
- **Always-reachable AI search** — the Add Food search results now always show a "Search further" option below the matched list, whether or not a close match was found; previously it only appeared when the top match was below the confidence threshold, so a wrong (but confident) match could trap you with no way to search further or fall back to AI
- **Time-based meal category default** — opening Add Food now guesses your meal category from the current time (breakfast before 11 AM, lunch until 3:30 PM, snacks until 7 PM, dinner after) instead of always asking first; a category chip stays visible in the header so you can change it in one tap whenever the guess is wrong
- **Repeat Yesterday card** — if you logged a meal in the same category yesterday, a one-tap "Repeat Yesterday" card appears at the top of Add Food so you can log it again instantly
- **Name your meals** — Frequently Logged Meals can now be renamed (tap the pencil icon) into a memorable combo name like "Kerala Lunch" instead of a raw comma-separated food list; the name shows everywhere that meal appears (recommendations, recent meals, Repeat Yesterday)

### Changed
- **Category selection merged into Add Food** — the separate "what are you adding?" screen is gone; category is guessed automatically and picked inline from the header, removing a full screen from the flow
- **Softer AI language in search** — "X% match" confidence numbers are gone in favor of a plain "Closest matches" heading, and the AI fallback no longer says "Analyzing…" or "Search with AI" — it now reads "Finding your food…" and "Search further"

---

## [v4.23] — 2026-07-30

### Added
- **Redesigned Add Meal flow** — a new bottom-sheet flow (tap the new floating Add Meal button on Home, or "Add food to X" inside Activity) walks you through picking a meal category, then surfaces Frequently Logged Meals, Recent Meals, Favorite Meals, and Recent Foods before you ever have to type; search falls back to AI only when nothing in your food list is a close match
- **Smarter meal builder** — add multiple foods to one meal, with portions pre-filled from what you've picked before (portion learning), "frequently added with this" suggestions based on what you usually eat together, and a heads-up if you try to log the same meal twice in a short window
- **Meal Insights** — History → Month now includes a Meal Insights card: top foods, your most-repeated meal templates, a meal diversity score, and how often meals repeat week to week

### Changed
- **Meals are now tracked as their own history** — logging a meal saves it as a discrete, reusable entry the app learns from over time (a meal you repeat 3+ times becomes an auto-detected "template"), instead of just a flat list of foods for the day
- **Legacy /diet screen removed** — the old, unlinked `/diet` route is gone; all diet logging continues to go through Activity as before

### Fixed
- **Daily score race condition** — a rare error when two score recalculations landed at the same moment (most likely right after logging a meal) no longer surfaces as a failure
- **Desktop dev fallback** — the browser-only dev fallback path (used when the local FastAPI server isn't running) now correctly falls back to on-device storage for diet/workout/sleep lookups instead of silently returning empty data

---

## [v4.22] — 2026-07-30

### Changed
- **Calorie tracking moved to the real Diet screen** — the calorie/macro card and remaining-macro totals from the last release now appear on the actual Diet screen inside Activity (bottom nav → Activity), not the unused /diet route that wasn't linked anywhere in the app
- **AI provider keys moved out of Add Food** — the OpenRouter/Groq API key fields no longer show every time you open Settings → Custom Meal Options to add a food; they now live in their own AI Assistant section in Settings

### Fixed
- **Calorie data wasn't being saved from the real food picker** — foods logged from the Activity screen's food picker never carried their calorie/protein/carb/fat values onto the log entry, so the calorie card would have shown no data no matter how much you logged; it now snapshots nutrition the same way the rest of the app does
- **Live remaining preview in the real food picker** — selecting a food and portion count in the Activity food picker now previews what your remaining calories and macros will be before you tap Add, matching the rest of the app

---

## [v4.21] — 2026-07-30

### Added
- **AI-powered nutrition assistant** — paste a free OpenRouter or Groq API key once in Settings, and "Ask AI to fill details" (new foods) and "Fill all with AI" (bulk) now analyze foods automatically instead of needing to copy-paste into ChatGPT; OpenRouter is the primary provider, Groq only steps in as backup when OpenRouter has no key configured or is unavailable
- **Live remaining preview while adding food** — the add-food form now previews what your remaining calories and macros will be for the day before you tap Add, based on the food and portion count selected

### Changed
- **Remaining macros in Diet Log** — the Calories card's protein/carbs/fat bars now show "X g left" the same way the calorie total already does, instead of just a progress bar against the range

---

## [v4.20] — 2026-07-27

### Added
- **Weight page** — a new Weight screen (from the Home card or Profile menu) where you log your weight each day and watch the trend line move toward your goal; shows 7-day average, change vs last week, change since you started, and how far you are from target, with a 30d/90d/1y chart and your target drawn as a reference line
- **Calorie & macro targets** — a new Body & Goal section in Settings takes your height, year of birth, sex, activity level and target rate of loss, and works out your BMR, maintenance calories, daily calorie target and protein/carbs/fat/fibre ranges; pick Gentle (0.25 kg/wk), Standard (0.5 kg/wk) or Aggressive (0.75 kg/wk), with the target never dropping below the safe floor of 1500 kcal (male) or 1200 kcal (female)
- **Nutrition on foods** — every food can now carry calories, protein, carbs and fat per portion, typed in by hand or filled by the Ask AI flow; a **bulk fill** generates one prompt covering every food still missing data so you can populate the whole list in a single round trip, with a coverage meter showing how many foods are done
- **Calories card in Diet Log** — shows calories eaten against your target with a progress bar and per-macro bars, plus how many calories you have left for the day
- **Calorie points** — staying near your calorie target now earns up to 10 points a day; full points within 10% of target, tapering to zero at 35% off in either direction, so under-eating counts against you as much as over-eating
- **Weight badges & quest** — four new badges (On The Scale, Daily Weigh-In, First Kilo, Five Down) and a Log Weight daily quest
- **Weight in export & backup** — weight history is included in the Excel export as its own sheet and in the JSON backup, and restores on a new device

### Changed
- **Past scores are untouched** — the calorie component only applies on days that have both your body metrics and calorie data for most of what you logged; on every other day, including your whole history, the score is calculated exactly as before

---

## [v4.19] — 2026-05-19

### Added
- **After-dinner trend alert (9:30 PM)** — if today's score is tracking lower than yesterday in Diet, Workout, or Sleep (≥3 pts drop), a notification fires at 9:30 PM naming which sections fell and giving the single most impactful fix for tonight
- **Morning review (9 AM)** — if yesterday's final score was worse than the day before, a morning notification shows yesterday's score, which sections dropped, and one concrete action to recover today
- **Appreciation notification (after sleep timer)** — when the sleep timer stops in the morning, if yesterday improved vs the day before in ≥2 sections or by ≥6 pts overall, a notification fires ~10 s later celebrating the specific gains and motivating a repeat
- **Weekly trend summary (Sunday 8 PM)** — compares this week's avg vs last week; improvement variant calls out the best-performing section, decline variant names the biggest drop and its fix; skipped if fewer than 4 days logged in either week
- **Monthly trend summary (last day of month 8 PM)** — compares this month's avg vs last month; both improvement and decline variants include section-level detail and a target for next month; skipped if fewer than 10 days logged

---

## [v4.18] — 2026-05-19

### Fixed
- **Sleep timer race condition (critical)** — stopping the sleep timer no longer silently zeroes out your sleep points; previously, updating the date selector before the DB write completed could reset the form to empty, causing a manual "Save Sleep" tap to overwrite the real data with a blank record and produce 0 sleep score
- **After-midnight timer now saves correctly** — starting the timer after midnight is reliably saved under the wake-up date; the scoreDate update now waits until the IndexedDB write finishes, so the subsequent form reload always finds the saved record

### Added
- **Version number in Settings** — app version (v4.18) is now displayed as a footer at the bottom of the Settings menu, so you always know which build is installed

### Changed
- **Date picker stays accurate overnight** — if the Sleep Log page is open past midnight (e.g. while the timer is running), "Today" and "Yesterday" now update automatically at midnight instead of showing the stale launch-time dates

---

## [v4.17] — 2026-05-12

### Changed
- **Consistency badges** — 14 badges across the total-day and streak categories now require a quality day (score ≥50) to count, instead of any logged day; former "logger" badges renamed (e.g. Daily Logger → First Effort, Fortnight Logger → Active Fortnight) to reflect the activity-based standard

---

## [v4.16] — 2026-05-09

### Added
- **Developer Tools** — a new password-protected entry in Settings lets you inspect and edit any past day's sleep log (sleep/wake times, hours, screen time), workout log (steps, walk, exercise), and daily score; requires a password so normal users cannot accidentally corrupt data
- **Two score correction modes** — "Save data & recompute" rebuilds the score from the edited raw data; "Write score directly" lets you set each score component manually without going through recompute

### Fixed
- **Lost sleep points after migration** — any day whose sleep data was displaced or lost by a past migration can now be corrected by re-entering the sleep data in Developer Tools and recomputing

---

## [v4.15] — 2026-05-09

### Added
- **Active Run Panel** — replaces the static score bar in Diet Log; shows live run state (Elite Run 💎, Clean Run 🌿, Recovery Active 🔥, Combo Active ⚡, etc.), momentum level from your streak, current score, and the next combo hint so you can see your dietary progression at a glance
- **Food combo detection** — five combos (Morning Engine ⚡, Clean Fuel 🌿, Bounce Back 🔥, Discipline Chain 🎯, Recovery Sync 🌙) activate automatically as you log meals; active combos appear as chips in the Run Panel and a toast fires when a new one unlocks mid-session
- **Perfect meal badge** — a ✨ Perfect badge appears on any meal section where you log ≥2 good items with no bad items

---

## [v4.14] — 2026-05-09

### Added
- **Date selector for sleep entry** — a Yesterday / Today toggle appears in the manual sleep section; tap to choose which day's score the sleep affects, with the actual date shown clearly for each option

### Fixed
- **Manual sleep save no longer fails** — reverted to wake-up-date storage convention; sleep is saved under the date you woke up and the score lookup uses the same date directly, removing all fragile auto-detection logic that caused silent failures
- **No double-count across days** — `saveSleep` now recomputes only the selected day's score, so the same sleep session cannot inflate two days' scores simultaneously
- **Data migration on upgrade** — on first launch, any records incorrectly displaced by the previous v4.13 migration are automatically restored to the correct wake-up date

---

## [v4.13] — 2026-05-09

### Fixed
- **Sleep attribution (critical)** — sleep from last night now strictly gives points to today's score; previously the same sleep could be double-counted into two days. Sleep is now stored under the sleep-start date and recompute only targets the wake-up day
- **Early-morning timer fix** — starting the timer after midnight (e.g. 01:00 AM) correctly assigns sleep to the previous night, so waking up on Tuesday still credits Tuesday's score
- **Manual save date correction** — entering an evening (18:00+) or post-midnight (00:00–11:59) sleep time with today's date automatically saves under yesterday; daytime naps (12:00–17:59) stay under today
- **Historical data migration** — on first launch, existing sleep records are moved from wake-up date to sleep-start date so all past scores are correctly attributed
- **Sleep status feedback** — sleeping between 2–5 AM now shows "Very late — no timing points" instead of showing no message at all
- **After-midnight penalty coverage** — the sleep-after-midnight score penalty now applies to all times from midnight through 5:59 AM (previously only midnight–1:59 AM was penalised)

---

## [v4.12] — 2026-05-09

### Added
- **100 badges total** — expanded from 23 to 100 badges across all 6 categories (Consistency, Nutrition, Fitness, Sleep, Comeback, Elite); covers every difficulty from common starter badges to legendary hidden achievements, providing a constant dopamine ladder of new goals
- **New milestone badges** — first_week, fortnight_logger, thirty_club, iron_logger, century_club, double_century, year_of_health for total days logged; streak_legend (21d), month_master (30d), iron_streak (60d) for streaks; 7 new score milestones (Good Day through Absolute Peak); 4 new step milestones (First Steps through Step God); 4 fitness session milestones; 4 sleep depth badges
- **New repeatable habit badges** — consistency_king, perfect_month_run, consistency_deity (perfect week counts); breakfast_master, consistent_clean, nutrition_elite, clean_machine, dinner_ninja, dinner_master (nutrition weeks); cardio_habit, fitness_fanatic, warrior_repeat, elite_athlete (workout weeks); sleep_master, sleep_deity, rest_warrior (sleep weeks); resilient, comeback_spirit, comeback_legend, resilience_god (bounce-backs); phoenix_x3, phoenix_master, eternal_phoenix (phoenix weeks); score count badges, elite count badges
- **Hidden legendary badges expanded** — now 14 hidden badges for the hardest achievements
- **Combo badges** — iron_spirit (requires both Bounce Back + Phoenix Week), nutrition_god (requires Breakfast Master + Consistent Clean + Dinner Master)

### Fixed
- **Earn count chips now clearly visible** — replaced tiny 7px corner chips with a proper `×N` pill rendered below the badge name in a color-coded pill with border; count is now immediately legible at a glance

---

## [v4.11] — 2026-05-09

### Added
- **Badge earn counts** — every badge now tracks how many times it has been earned (e.g. "Step Beast x7"); the count is displayed as a chip on each badge in the inventory and featured shelf
- **Badge evolution tiers** — earn a badge repeatedly to evolve its tier: Bronze (1×) → Silver (3×) → Gold (7×) → Neon Legendary (15×); tier color and symbol update on the badge card and in the detail modal
- **Hidden badge mystery silhouettes** — six elite/legendary badges (Hyper Consistent, Sugar Breaker, Warrior Mode, Night Discipline, Peak Human, Aether Rank) appear as `?` mystery slots until progress reaches 50%, maintaining curiosity without spoiling the unlock condition
- **Super Badge Quest card** — a cinematic progress card above the quests section always shows the nearest super badge to completion with component badge status chips, a gold progress bar, and the prestige reward preview
- **Badge detail modal earn tier** — when a badge with count > 1 is tapped, the modal now shows an evolution tier banner with symbol, tier label, and earn count

### Changed
- Badge inventory corner icon now shows the evolution tier symbol (●/◆/⬟/✦) instead of a plain checkmark for badges earned multiple times

---

## [v4.10] — 2026-05-09

### Fixed
- **Score breakdown panel** — expanded view now renders on a dark surface-card background instead of inside the purple gradient, making all text, stat bars, and Full Detail panel fully readable
- **Score Bars toggle** — active view selector uses brand color for the active state, consistent with the rest of the app
- **Perfect Day** — now requires only breakfast + lunch + dinner (snacks are optional), so the achievement accurately reflects consistent main-meal tracking

---

## [v4.9] — 2026-05-09

### Added
- **Profile tab** — replaced Settings in the bottom navigation with a full identity and progression hub
- **Hero Section** — animated aura ring (color evolves: blue → teal → purple → gold based on level), player initials avatar, active title, animated XP bar, and prestige stats row
- **Level & XP system** — every logged day earns XP from your score; badge unlocks add bonus XP; level thresholds scale with each tier
- **Prestige score** — composite score from badge rarities + streak bonuses displayed alongside level
- **Active Title system** — 8 dynamic titles (Newcomer → Committed → Discipline Builder → Elite Performer → Legendary Cultivator → Ascendant) based on badges and level
- **Super Badge Vault** — 3 combination super badges (Total Balance Core, Iron Will, Phoenix Rising) that unlock by combining specific regular badges; locked ones show progress and required components
- **Featured Badges** — top 5 unlocked badges sorted by rarity shown as large highlighted cards
- **Badge Inventory Shelves** — all 23 badges organized by category (Consistency, Nutrition, Fitness, Sleep, Comeback, Elite) in horizontal scroll shelves with progress rings
- **Active Quests** — 4 daily quests (breakfast, steps, clean eating, exercise) and 4 weekly quests (workouts, days logged, avg score, breakfast streak) with live XP-reward progress bars
- **Lifetime Stats** — 8 animated stat cards: days logged, avg score, total steps, workouts, sleep hours, elite days, consistency %, best streak
- **Journey Timeline** — cinematic vertical milestones: first log, first badge, best streak, first 90+ day, first legendary badge
- **Monthly Snapshot** — embedded monthly hero card with identity gradient and AI narrative; links to full Monthly Calendar view
- **Settings Center** — compact settings list at the bottom of Profile; all existing settings remain accessible at /settings

### Changed
- Bottom navigation: Settings tab → Profile tab (Settings still accessible from Profile → Settings Center)

---

## [v4.8] — 2026-05-08

### Added
- **Hero Performance Card** — Monthly tab now opens with an identity-themed hero card (8 gradient identities: Momentum Elite, Peak Performer, Rising Force, Discipline Builder, Recovery Master, Comeback Mode, Energy Stabilizer, Foundation Builder) showing avg score, grade letter, AI narrative, trend badge vs last month, and key stats
- **Monthly Story Arc** — Week-by-week breakdown cards showing theme, emoji, avg score, and activity note for each week of the month
- **Trajectory Engine** — Compares first-half vs second-half monthly averages and projects next month's score using half-trend extrapolation
- **Insight Intelligence** — Two-panel layout showing what drove scores up (positive drivers) and what dragged them down (risk signals)
- **Near-Miss Psychology** — Pill strip showing how close you were to the next grade tier or badge milestone
- **Enhanced Calendar** — Best-day 🏆 and exercise-day ⚡ markers on calendar cells; stronger color intensity for 80+ days; expanded legend with marker key
- **Monthly badge shelf** — Badges earned within the current month displayed in a dedicated shelf below the calendar

---

## [v4.7] — 2026-05-08

### Added
- **Badge Shelf System** — 23 badges across 6 categories (Consistency, Nutrition, Fitness, Sleep, Comeback, Elite) with 4 rarity tiers (Common → Rare → Epic → Legendary)
- **Cinematic unlock overlay** — full-screen badge reveal with tier-specific glow, haptic burst, lore text, and auto-dismiss; queues multiple unlocks sequentially
- **Badge progress engine** — runs on every app open, evaluates all badge conditions against full history, saves progress to new `badges` IndexedDB table
- **Dashboard mini shelf** — shows this week's unlocked badges + nearest near-unlock badges with tap-to-detail modal
- **History weekly shelf** — full scrollable badge carousel in the Weekly Executive tab, ordered unlocked → near-unlock → locked; shows progress rings and tier animations
- **Badge detail modal** — tap any badge for lore, criterion, rarity, unlock date, and live progress bar
- **Weekly nav shortcut** — "This Week" card on Dashboard navigates directly to the weekly executive summary

---

## [v4.6] — 2026-05-08

### Added
- **Rotating power-up cards** — the "Next Power-Up" panel now cycles through all available opportunities (steps, walk, exercise, sleep, each meal) every 10 seconds with a fade transition; dot indicators show position and are tappable
- **Health Connect background sync** — steps are now fetched from Health Connect (or sensor fallback) automatically on every app open and refreshed every 30 minutes in the background, no longer requiring a manual visit to the Activity tab

---

## [v4.5] — 2026-05-08

### Fixed
- **Score breakdown readability** — expanded panel now renders on the app's dark surface background instead of inside the purple gradient; all text, stat bars, and detail rows are fully legible
- **Perfect Day criteria** — snacks no longer required; only breakfast, lunch, and dinner need to be logged for the diet quest to count as complete

---

## [v4.4] — 2026-05-08

### Fixed
- **Perfect Day criteria** — now requires all 4 meal types (breakfast, lunch, dinner, snacks) to be logged for diet, workout score > 0 for workout, and sleep_time set for sleep; previously triggered too easily with any meal entry

### Changed
- **Score breakdown** — standalone "Today's Score" card removed; score details (ring, stat bars, full detail) are now an expandable section inside the RPG hero card, accessed via a "View score breakdown" toggle
- **Compact header** — date + greeting condensed to two lines with smaller type; large subtitle removed to reclaim vertical space on the Dashboard
- **Grade label** — "Below target" renamed to "Keep pushing" for a more motivating tone

---

## [v4.3] — 2026-05-08

### Added
- **Hero Momentum Zone** — Activity screen opens with a dynamic hero card showing the active quest's XP progress bar, mission text ("X steps to unlock full XP"), and streak flame; replaces the plain score header
- **Swipe tab navigation** — swipe left/right anywhere on the Activity screen to switch between Diet, Workout, and Sleep tabs

### Changed
- **Gamified action buttons** — Log button now reads "Start Diet Quest", "Power Up Workout", or "Log Sleep Recovery"; Save button shows "Claim +X XP →" when points are earned
- **Positive language framing** — Workout card no longer shows "not logged" or "Below target"; replaced with "Walk bonus ready", "Exercise bonus ready", and a step percentage like "47% there"
- **Quest cards grid layout** — Dashboard daily quest cards now fill the full width in a 3-column grid; no horizontal scrolling required

---

## [v4.2] — 2026-05-08

### Added
- **Animated ScoreRing** — ring gains breathing glow and SVG blur filter at 80+ score; legendary tier (92+) shows golden "✦ MAX ✦" label with amplified radiance
- **Gradient StatBars** — progress bars use gradient fill with a glow shadow when value reaches 75%+ of max, making top performance visually pop
- **Ambient background orbs** — Dashboard background has slowly drifting blurred gradient orbs that make the interface feel alive; a bonus orb appears at high scores
- **PERFECT DAY combo banner** — golden banner fires when all 3 quests (Diet + Workout + Sleep) are completed on the same day
- **Time-aware greeting** — Dashboard greeting and subtitle shift based on time of day (morning / midday / afternoon / evening / night) with a matching emoji
- **Haptic feedback on save** — Activity save button triggers a medium-impact haptic vibration on Android

### Changed
- **Hero card pulse animation** — score card subtly breathes via CSS when score ≥ 80; legendary scores get deeper glow shadow and golden HP bar gradient
- **Smart contextual CTAs** — focus banner replaced with gamified prompts: specific step counts remaining, emoji icons, language like "unlock full workout pts" and "instant power-up"
- **Score breakdown collapsed by default** — breakdown card is hidden until tapped, reducing visual noise on first open; ring/detail toggle moves inside the expanded view

---

## [v4.1] — 2026-05-08

### Changed
- **App-wide theme** — complete visual overhaul from Google Blue to deep-purple dark (#0A081C surfaces) and lavender light (#F8F6FF); all cards use 24 px rounded corners, gradient buttons with glow shadows, inputs rounded-2xl

### Added
- **Greeting header** — Dashboard opens with bold "Hello [Name]!" personalised greeting, date, live quest-progress subtitle, and streak badge
- **Gradient hero score card** — score section replaced with full-bleed purple gradient card showing rank emoji, HP bar, grade badge, and category status chips
- **Horizontal quest cards** — daily quests (Diet / Workout / Sleep) shown as swipeable gradient mini-cards with per-category colour themes and progress fill
- **Floating pill navbar** — bottom navigation redesigned as a floating rounded-pill above the screen edge with purple gradient glow on the active tab

---

## [v4.0] — 2026-05-08

### Changed
- **AI Health Coach removed** — Coach tab removed from bottom navigation, `/coach` route and AICoach page deleted, all AI service files removed, AI Coach section removed from Settings; app is leaner with no AI dependencies

---

## [v3.9] — 2026-05-08

### Changed
- **Removed local LLM** — WASM-based inference has no GPU access in Android WebView, making any model (SmolLM2, TinyStories, or otherwise) too slow for a usable chat experience; removed the bundled model and @huggingface/transformers dependency entirely
- **Smart Coach is now the sole AI** — the data-driven rule engine gives instant, accurate responses based on actual logged health data; no loading wait, no hallucination, no model download
- **APK size back to ~11 MB** (was 112–144 MB with bundled model)

---

## [v3.8] — 2026-05-08

### Fixed
- **15-minute first-load fixed** — Android was decompressing the 112 MB ONNX model and 23 MB WASM runtime at runtime (because AAPT compresses all APK assets by default); added `noCompress 'onnx', 'wasm'` to `build.gradle` so they are stored uncompressed and memory-mapped directly — load time drops from 10-15 min to 20-60 s

### Changed
- **Model pre-warms in background** — as soon as the Coach tab opens, SmolLM2-135M starts loading silently while the user reads the welcome message; by the time they type their first question the model is already loaded or nearly ready
- **AI status dot in header** — amber pulsing dot = model loading in background; green dot = model ready; user always knows the AI state without a blocking spinner

---

## [v3.7] — 2026-05-07

### Added
- **SmolLM2-135M-Instruct bundled in APK** — the AI model (112 MB, 4-bit quantized ONNX) is shipped inside the app; no download step required, works offline immediately on first launch
- **Switched to @huggingface/transformers** — replaced WebLLM with the official Hugging Face ONNX runtime; uses the same SmolLM2-135M-Instruct model from HuggingFaceTB directly from the APK assets

### Changed
- **No model picker or download UI** — Settings → AI Health Coach now shows a simple "Built-in" status card; users no longer have to choose or download a model
- **Local model is always tried first** — every chat message goes to SmolLM2-135M (via WASM) automatically; Smart Coach is the silent fallback if inference times out (35 s)

---

## [v3.6] — 2026-05-07

### Fixed
- **Local model download error** — replaced invalid SmolLM2-135M and SmolLM2-360M model IDs (which do not exist in WebLLM's prebuilt registry) with verified IDs: Qwen2.5-0.5B (smallest confirmed-working model) and Llama-3.2-1B; users no longer see "Cannot find model record in appConfig" when trying to download a local model

---

## [v3.5] — 2026-05-07

### Added
- **Smart Coach Engine** — new always-on, zero-latency response engine that generates data-driven answers directly from RAG-retrieved Dexie records; handles all query types (foods, steps, sleep, scores, workout, fasting, opportunities, streak) with accurate bullet-point formatting; never crashes, works on any device with no model download required
- **SmolLM2-135M** — added as the new default local AI model (~78 MB vs 320 MB for Qwen); smallest model WebLLM supports; ~5–15s response on mid-range mobile vs 30–60s for Qwen

### Changed
- **AI engine priority** — Smart Coach is now the default for all responses; local LLM (if downloaded) is tried first with a 25-second timeout; if it times out or crashes the app automatically falls back to Smart Coach instantly with no error shown to the user
- **No more hangs or crashes** — 25-second hard timeout on LLM inference prevents the app from freezing on slow devices; all failures silent-fail to Smart Coach

---

## [v3.4] — 2026-05-07

### Changed
- **Stability release** — all v3.x AI features (offline WebAssembly LLM, RAG data retrieval, rich chat formatting, guardrailed system prompts) packaged together as a stable build; no logic changes from v3.3

---

## [v3.3] — 2026-05-07

### Added
- **RAG (Retrieval-Augmented Generation)** — before every AI inference the app detects the query type and fetches exact Dexie records for that topic; food queries get the full aggregated food item list with counts and meal breakdown; step queries get per-day step counts with credit grades; sleep queries get per-day bedtime/duration breakdown; score queries get a full daily score table; workout queries list every exercise session; fasting queries compute per-day fasting windows from dinner→breakfast times
- **Rich chat formatting** — AI message bubbles now render bullet points as visual list items, `**bold**` markers as bold text, and "Next: " action lines as a highlighted call-to-action card; plain coaching answers stay as paragraphs

### Changed
- **AI response style** — system prompt now instructs the model to use bullet lists for list-type answers, bold for key metrics, and always end with a "Next:" action; generic score-summary answers to specific food/step/sleep questions are prevented by the injected RAG data

---

## [v3.2] — 2026-05-07

### Changed
- **Smarter, data-accurate AI replies** — rebuilt system prompt injects current date/time, full today and yesterday logs (steps, sleep, dinner time, exercise, walk, snacks), and 7-day pattern aggregates so the model answers from real numbers instead of guessing
- **Context-aware time references** — "today", "yesterday", and "this week" are resolved to exact calendar dates before the prompt is sent, so the model understands relative time questions correctly
- **Guardrails against hallucination** — strict rules in the prompt prevent the model from inventing scores, making up meal times, or answering questions about data that wasn't logged; it now says "not logged" instead of fabricating values
- **Dedicated prompt file** — all system prompt sections (`IDENTITY_PROMPT`, `GUARDRAILS_PROMPT`, `RESPONSE_STYLE_PROMPT`, `COACHING_RULES`) moved to `frontend/src/services/aiPrompts.js` for easy manual editing; see `PROMPTS.md` at project root for the editing guide

---

## [v3.1] — 2026-05-07

### Added
- **Offline AI model support** — users can download a small quantized LLM (Qwen 0.5B ~320 MB, TinyLlama 1.1B ~650 MB, or Gemma 2B ~1.5 GB) directly to their device; once downloaded the model runs entirely via WebAssembly — no internet required, no API calls, no data ever leaves the phone
- **Model management UI** — new AI Health Coach settings screen shows model status (installed/not installed), model picker with size info, download button with real-time progress bar, and one-tap remove to free storage
- **Offline inference in Coach chat** — when a local model is installed it becomes the primary AI engine for all chat responses; Phase 1 rule-based engine remains always active as a silent fallback; priority order: local model > rule-based fallback
- **Thinking indicator with load text** — while the model is loading or running inference the chat bubble shows the current model status (loading weights, running inference) so the user knows what is happening

---

## [v3.0] — 2026-05-07

### Added
- **Phase 2 Cloud AI** — optional Claude Haiku integration that replaces the rule-based Phase 1 engine with real LLM responses; user provides their own Anthropic API key (stored locally, never uploaded); health context (scores, 7-day patterns) is sent to the Anthropic API only when Phase 2 is enabled; Phase 1 remains always active as the default and as a silent fallback if the API call fails
- **Phase 2 Settings UI** — new toggle and API key input (with show/hide) in the AI Health Coach settings screen; includes a "Test connection" button that fires a live API call and shows the response; privacy warning explains what data is sent; roadmap updated to reflect Phase 2 active status

---

## [v2.35] — 2026-05-07

### Added
- **AI Health Coach** — new on-device coaching system with conversational chat interface, weekly executive summary panel, 7-day pattern detection, opportunity scoring (finds the highest-value action at any moment), fasting window coaching, and data-driven responses for diet, sleep, workout, and streak topics; 100% private — all analysis runs on-device with zero data upload, no API calls, no cloud sync
- **Coach tab** — new bottom navigation item giving instant access to the AI Health Coach from anywhere in the app
- **AI Coach settings screen** — new Settings section showing Phase 1 active status, full feature list, and the future roadmap (Phases 2–4: offline LLM model download, AI-generated narratives, full Gemma/Phi on-device companion)

---

## [v2.34] — 2026-05-06

### Added
- **JSON backup & import** — the Data Export screen now offers a full JSON backup alongside the existing Excel export; the backup can be imported on any device to restore all logs, scores, and settings without data loss, enabling seamless cross-device transfer
- **Today's Focus card** — a new card on the Dashboard shows either the biggest active score damage (e.g. "Dinner after 9 PM −5 pts") or the best available opportunity (e.g. "1 500 more steps → full workout pts"); removes the "what should I do?" question and gives one clear daily action

### Changed
- **Diet scoring fields** — removed "Protein first at meals" and "Reduced tea sugar" from the Diet Scoring settings; these point categories were not tracked by the scoring engine and have been removed to avoid confusion
- **Custom meal form** — moved the "Add new food" form to the top of the Meal Options screen with the existing foods list below, matching the natural add-then-review workflow

---

## [v2.33] — 2026-05-06

### Fixed
- **Steps sync on devices with no fitness app** — when Health Connect is installed and permission is granted but returns 0 steps (because no app like Google Fit or Samsung Health is writing data to it), the app now falls through to the phone's built-in step sensor instead of showing 0; this fixes sync on Nothing Phone, Xiaomi, Oppo, Vivo, and other devices where HC is present but has no step provider connected

### Added
- **"No step source" guidance card** — when Health Connect is connected but has no data, the workout card shows a clear explanation ("Health Connect is ready but no app is writing steps to it. Open Google Fit or Samsung Health, let it run, then sync.") with a Try Sync Again button instead of silently showing 0

---

## [v2.32] — 2026-05-06

### Fixed
- **Health Connect auto-sync on launch** — replaced `requestHealthPermissions` (which launches an Android Activity/dialog every launch, causing silent failures) with `checkHealthPermissions` (silent background check); steps now sync automatically on launch when permission was previously granted, with no dialog interruption
- **HC date serialization** — pass explicit ISO strings to Health Connect `readRecords` so `Instant.parse()` on the Android side always receives a valid format

---

## [v2.31] — 2026-05-06

### Added
- **Sensor step fallback** — when Health Connect is unavailable or permission is denied, the app automatically reads today's step count from the phone's built-in step counter sensor; steps are displayed with a source badge ("Health Connect · 2:15 PM" / "Phone sensor · 2:15 PM" / "Manual entry") so you always know where the data came from
- **Reconnect card for denied HC permission** — when Health Connect is installed but step permission was denied, the workout card shows a reconnect prompt instead of the normal sync button; tapping it re-requests the permission or falls back to the phone sensor automatically

### Changed
- **Manual step edits marked as manual source** — adjusting steps via the slider, number input, or quick-set presets now marks the source as "Manual entry" in the source badge

---

## [v2.30] — 2026-05-06

### Fixed
- **Steps sync on Samsung phones** — when Health Connect is not installed (common on Samsung Android 13), the workout screen now shows a clear guidance message with Samsung Health setup instructions instead of silently hiding the sync button
- **Sleep timer blocked by Usage Access permission** — the timer now always stops and saves on "Wake Up" regardless of whether Usage Access permission is granted; screen-on time deduction is applied only when the permission is available, making the feature work universally without requiring the advanced permission

---

## [v2.29] — 2026-05-03

### Changed
- **Home screen widget** — redesigned as a gamified command center: radar chart now spans the full width as the visual centerpiece with soft glow fill and per-axis colored dots and labels (blue=Workout, green=Diet, purple=Sleep); tier title and score are rendered in the RPG tier color; a subtitle mood line (e.g. "Peak performance.") appears below the header; a quick metrics row (🥗 Diet · ⚡ Workout · 🌙 Sleep) replaces the old stat bars at the bottom

---

## [v2.28] — 2026-05-03

### Added
- **RPG character card** — character card at the top of the Dashboard shows an emoji avatar, tier title (7 tiers: Idle → Legend based on your score), HP bar with glow effect, and Diet/Workout/Sleep status chips; the character evolves as your daily score improves
- **Android home screen widget** — add the Health Quest widget to your Android home screen to see your RPG character, score, streak, and a radar chart of Diet/Workout/Sleep performance; tap Refresh to update without opening the app

### Changed
- **Diet summary meal cards** — the four meal cards (Breakfast, Lunch, Dinner, Snacks) are now tappable buttons that open the diet log sheet scrolled directly to the selected meal section

---

## [v2.27] — 2026-05-03

### Added
- **Default food library** — 54 real-world food items across breakfast, lunch, dinner, and snacks are now pre-loaded on first install so the food picker is ready to use from day one; existing user-created foods are never overwritten or removed
- **Edit food items** — all foods in Meal Options (both seeded defaults and user-created) now have a pencil icon for inline editing of points and ideal portion size without leaving the list
- **Ask AI for food details** — type a food name in Add Food, tap "Ask AI to fill details", copy the generated prompt to ChatGPT, paste the reply back, and the app auto-detects points, ideal portions, and category with a loading animation; tap "Use this" to confirm or adjust before saving

### Changed
- **Daily quest navigation** — Diet, Workout, and Sleep quest buttons on the home screen now open the Activity page with the correct tab pre-selected instead of routing to the old separate log screens
- **Daily Rules removed from home screen** — the hardcoded personal rules card has been removed from the dashboard; rules are personal and should live in Settings rather than the shared home screen

---

## [v2.26] — 2026-05-03

### Fixed
- **Sleep fallback load no longer overwrites date with yesterday** — when sleep data is loaded from yesterday's record as a fallback, it is now stored internally as today's date so any subsequent manual save writes to today, not yesterday; this prevents yesterday's score from being accidentally changed when editing sleep manually
- **Sleep timer gate on fallback** — yesterday's sleep is only loaded as a fallback if the sleep timer is NOT currently running; while the timer is active the form stays clean, avoiding stale data in the form before Stop Timer is tapped
- **Sleep risk notification cancels on timer stop** — `scheduleSmartNotifications()` is called immediately after the timer auto-save, cancelling the 11:15 PM sleep-risk alert (ID 31) as soon as sleep is recorded
- **Manual sleep always saves to today** — the explicit Save button for sleep now always writes `date = today` regardless of which date was loaded, making it impossible to overwrite yesterday's score via manual entry

### Changed
- **Manual time override is now hidden by default** — the "Sleep & Wake Times" section is collapsed behind a "Manual time override" disclosure row; tap to expand; clearly labelled "Use only if timer unavailable" so the timer remains the obvious primary path
- **Notification icon** — replaced the generic "i" icon with the app logo (monochrome white-on-transparent) across all Android density buckets; accent colour set to app purple (#7c3aed)

---

## [v2.25] — 2026-05-02

### Added
- **Intelligent notification engine** — new `notificationEngine.js` service schedules contextual one-time daily alerts (IDs 30–39) based on live data; rescheduled on every app open and after every save so "already done" alerts cancel automatically
- **Dinner risk alert** — fires at 8:30 PM if dinner not yet logged; bumped to 8:15 PM for users with 3+ late dinners in the past 7 days (pattern detection)
- **Sleep risk alert** — fires at 11:15 PM if sleep timer not started
- **Workout gap alert** — fires at 6 PM only if steps < 4,000; message includes current step count
- **Re-engagement nudge** — fires at 10 AM if user has no logged score for 2 consecutive days; suppressed otherwise
- **Weekly insight notification** — Sunday 7 PM; message is data-driven (late dinner count and cost if ≥3, or weekly avg score)
- **Behavior-aware breakfast nudge** — 9 AM alert fires only if breakfast was missed 4+ of the last 5 days
- **Smart suppression** — no nudges sent if today's score is already ≥80; all smart notifications cancel when the triggering action is completed

### Changed
- Smart notifications respect a max-4-per-day frequency cap with priority ordering (sleep > dinner > steps > re-engagement > weekly > breakfast)
- Existing fixed reminders (IDs 1–26, configured in Settings → Reminders) unchanged

---

## [v2.24] — 2026-05-02

### Added
- **Onboarding flow** — new first-launch setup (≈ 1 min, 6 screens): Welcome → Goal selection (multi-select, 6 goals) → Lifestyle Snapshot (activity level, eating pattern, sleep pattern) → Constraints & Preferences (diet type, time, primary struggle) → Computing (auto-advances) → Swipeable tutorial (6 slides with touch-swipe); scoring weights computed and saved automatically from answers; skip option available
- **Personalised scoring weights** — onboarding maps goal selection + activity level → adjusted diet/workout/sleep max points and step thresholds; late-dinner penalty strengthened if "late-night eating" is the primary struggle
- **Tutorial in Settings** — "View Tutorial" menu item replays the 6-slide scoring tutorial at any time; "Reset Onboarding" menu item clears the setup flag so it runs again on next launch

---

## [v2.23] — 2026-05-02

### Added
- **Weekly Executive Summary** — new "Weekly Executive" tab in History; analyses Mon–Sun data and surfaces:
  - Weekly avg score with grade badge and trend vs previous week
  - Mini metrics grid (avg steps, avg sleep, workouts completed, late-dinner count)
  - **Biggest Wins** — positive signals vs last week or thresholds (breakfast consistency, workout improvement, step increase, sleep duration, clean dinner timing, zero junk food)
  - **Biggest Damage** — high-frequency bad behaviours with impact explained (late dinners, poor sleep nights, junk food days, missed breakfast, low-step days, no workout, inconsistent wake time)
  - **Stacked failure detection** — flags days where two bad patterns hit simultaneously (e.g. late dinner + short sleep)
  - **Root cause detection** — correlates which failures most often appear on low-score days and ranks them by frequency
  - **Strategic Fix** — single highest-impact recommendation derived from root cause (specific and measurable)
  - Best day / Worst day callout
  - Most frequent junk foods ranked by occurrence
  - Week navigation (previous weeks supported)

---

## [v2.22] — 2026-05-02

### Added
- **Food picker → Settings shortcut** — a "+" button in the food picker header jumps directly to Settings → Custom Meal Options; the empty state also shows a prominent button so new users can add foods without hunting through the menu
- **Smarter notifications** — step check-in alerts now include your configured step target and bonus threshold (e.g. "Target: 8k steps · bonus from 10k"); three new daily reminders: dinner time warning (before the 9 PM penalty kicks in), a 9:30 PM no-snacking alert, a post-dinner walk nudge, and a configurable end-of-day log reminder
- **Dinner & evening-log reminder times** — two new configurable times in Settings → Reminders

### Changed
- **Dashboard score card merged** — the "Today's Score" ring and "Today's Performance" panel are now a single card with a ring/detail toggle (⊙ / bar-chart icons); removes all score duplication
- **History chart default changed to Line** — line chart is now the default view in Monthly Breakdown; Stacked bar is the secondary option

---

## [v2.21] — 2026-05-02

### Changed
- **Food picker search hidden by default** — the search bar no longer appears automatically when the food picker opens; tap the 🔍 icon in the picker header to reveal it, tap again to hide and clear the query
- **Food picker multi-select** — tap multiple food cards to select them all at once; each selected item gets its own portion stepper in the bottom panel; a single "Add N foods to [Meal]" button logs them all in one action

---

## [v2.20] — 2026-05-02

### Added
- **Custom food picker** — the native Android dropdown for logging food items is replaced with a full-screen custom picker matching the app's design; foods are shown as tappable cards with category colour, points, and ideal portions; includes a live search bar and a portions stepper before adding
- **App logo** — `logo.png` now appears in the Dashboard header and Settings screen; Android launcher icon updated to use the same logo across all pixel densities

### Changed
- **Settings as compact menu** — the long scrollable Settings page is replaced with a clean menu list (11 sections, each with a title and description); tapping any row opens a focused detail screen with a Save button; eliminates scrolling past unrelated options

---

## [v2.19] — 2026-05-02

### Fixed
- **Activity sheet save button** — raised the bottom sheet above the navbar so the Save button is no longer hidden behind it when logging Diet, Workout, or Sleep
- **Gesture navigation clearance** — added extra bottom padding so the Save button stays clear of Android's gesture navigation bar on phones without hardware buttons

---

## [v2.18] — 2026-05-02

### Added
- **Unified Activity page** — new `/activity` screen consolidates Diet, Workout, and Sleep into a single tabbed view with summary cards and a bottom-sheet log form; replaces navigating between three separate pages

### Changed
- **Navbar simplified to 4 items** — Diet, Workout, and Sleep nav tabs replaced by a single Activity tab (⚡); layout is now Home · Activity · History · Settings

### Fixed
- **Score previews match actual scoring** — Activity page now uses the real scoring functions so displayed points respect user-configured weights and the linear step bonus above 10 k steps

---

## [v2.17] — 2026-05-02

### Added
- **Previous month tail in monthly chart** — when viewing the current month, the last ≤7 days of the previous month are prepended to both the stacked bar and line chart at 35 % opacity, with a dashed month-boundary line and a "Faded = prev month" legend note; tooltip shows the full "Apr 30" label for those entries; past months are unaffected

---

## [v2.16] — 2026-05-01

### Fixed
- **Sleep auto-saved on Wake Up (1 h minimum)** — pressing "Wake Up — Stop Timer" now immediately persists the sleep record so navigating away before tapping "Save Sleep" can no longer lose the data; accidental short stops (under 1 hour elapsed) clear the timer silently without writing any record, preventing noise in scores

---

## [v2.15] — 2026-04-29

### Fixed
- **Sleep stored under wake-up date (today)** — previously, sleep started at 11 PM was stored under the sleep-start date (yesterday), causing it to be invisible in today's Sleep tab and today's Notes & Comments on the Dashboard; now always stored under the date the user pressed "Wake Up" (today)
- **Sleep auto-saved on Wake Up** — pressing "Wake Up — Stop Timer" now immediately persists the record to the database; previously, data was only held in React state and lost if the user navigated away before pressing "Save Sleep"
- **Yesterday's stale sleep no longer hijacks today's Sleep tab** — removed the yesterday fallback from the load effect; the Sleep Log now only loads today's record, keeping past sleeps in History where they belong

---

## [v2.14] — 2026-04-29

### Fixed
- **Sleep summary card persists after navigation** — replaced lost-on-nav `timerCompleted` React state with data-driven `sleepLogged` flag (`!timerStart && !!sleep_time && sleep_hours > 0`); summary now survives page switches
- **Sleep data loaded correctly** — `useEffect` now checks today first, then falls back to yesterday (sleep started at night is stored under the previous calendar day); score no longer shows as 0 after returning to the Sleep tab

### Added
- **Dedicated completed-sleep summary card** — shown immediately after stopping the timer (and on any return visit):
  - Purple-bordered card with gradient background
  - Large total sleep duration as hero metric (colour-coded green/amber/red)
  - 2-column grid: Fell asleep · Woke up · Screen time · Effective sleep
  - When no screen time: full-width "Effective sleep (no screen deduction)"
  - Target met / "Need X more" footer badge
  - Live "+X / 30 pts" badge in the header

---

## [v2.13] — 2026-04-29

### Added
- **Configurable step thresholds** in Settings → Workout Scoring
  - Partial credit from (default 5,000)
  - Full credit from (default 8,000)
  - Bonus starts at (default 10,000)
  - Max bonus reached at (default 18,000)
- All four thresholds editable via number inputs (step size 500) — existing behaviour preserved via defaults

---

## [v2.12] — 2026-04-29

### Changed
- **Steps scoring: linear bonus above 10k**
  - Previously capped at 18 pts at 10,000 steps
  - Now: +10 pts earned linearly from 10,000 → 18,000 steps
  - Maximum from steps alone: **28 pts** at 18,000+ steps
  - Below 10k behaviour unchanged (5k = half pts, 8k = full base, 10k = 18 pts)
- Settings sublabels updated to describe the new formula

### Fixed
- Historical workout scores recomputed (migration v6) to credit extra step points where applicable

---

## [v2.11] — 2026-04-29

### Added
- **Line chart: Total score as first metric** — gold colour, 0–100 Y-axis, selected by default
- **Sleep tab: Completed sleep summary card** shown after pressing "Wake Up — Stop Timer"
  - Displays: fell asleep time · woke up time · total sleep · sleep points earned · screen time · effective sleep
  - "Start a new sleep session" link below
- **Sleep details in Notes & Comments** (Dashboard + History) now include:
  - 🌙 Fell asleep at HH:MM
  - 🌅 Woke up at HH:MM
  - 😴 Total sleep duration
  - 📱 Screen time deducted → effective sleep (when applicable)
  - ⭐ Sleep quality rating

---

## [v2.10] — 2026-04-29

### Added
- **Snacks in Notes & Comments** — snack items (with individual timestamps) now appear in the History day panel and Dashboard notes section
- **Performance radar + rich day detail on Dashboard home screen**
  - Radar chart (Diet · Workout · Sleep), score breakdown, and notes & comments now visible for today without opening History
  - History retains identical view for past days
- Shared `DayDetail.jsx` component — single source of truth for radar, breakdown, and notes across Dashboard and History

### Fixed
- **Lost diet points recovery** — `calcMealItemsScore` now falls through to legacy scoring when all food items carry zero point values (old default-seeded items); affected historical days recover correct diet score via migration v5
- **Hardcoded weight defaults removed** — `current_weight`, `target_weight`, and `player_name` default to empty strings; new installs prompt user to fill in their own values
- Settings weight inputs now show placeholder hints (e.g. "e.g. 80 kg")

---

## [v2.9.1] — 2026-04-29

### Fixed
- **Future-date score records deleted** — old `saveSleep` calls created 0-point records for "tomorrow"; migration v4 cleans these up on first launch
- `recomputeScore` now returns early for any date in the future, permanently preventing future ghost records
- History display uses `pastScores` filter (date ≤ today) as an additional guard

---

## [v2.9] — 2026-04-29

### Added
- **Historical backtracing migration** — on first launch after install, the app recomputes all historical daily scores to populate `fasting_score` and `steps` fields; line chart metrics show full history, not just recent data

### Changed
- **Stacked bar chart** — Fasting and Steps removed; bar now shows Diet · Workout · Sleep only (cleaner, avoids visual noise from additive-only metrics)

### Fixed
- **Day share button** — replaced broken `fetch(dataUrl)` call (fails in Android WebView) with `atob()` blob conversion; added `@capacitor/filesystem` fallback: saves PNG to Documents folder with "Saved to Documents" toast if Web Share API is unavailable

---

## [v2.8] — 2026-04-25

### Added
- **Snacks meal tab** — fourth meal type in Diet Log; each snack item carries its own timestamp (no section-level time picker)
- **Fasting score as separate additive component** — fasting no longer part of diet score; shown as its own bar in Dashboard and History breakdown; `maxPossible` updated to include `fasting.max_points`
- **Steps and fasting in line chart** — History line chart now has 5 selectable metrics: Diet · Workout · Sleep · Fasting · Steps; `steps` field stored in daily score records
- **Day performance export as PNG** — Share button in History day detail captures the full panel (radar + breakdown + notes) as a PNG image via Web Share API; falls back to download on desktop
- **Line chart toggle** in History monthly breakdown — switch between Stacked bar and Line views

### Changed
- **Time format** changed from decimal (e.g. `9.5h`) to human-readable (e.g. `9h 30min`) throughout: sleep timer, fasting widget, screen time stepper, toast messages, and day comments
- **Fasting timer resets** after today's dinner is logged — widget switches to "next fast started · dinner at HH:MM" mode instead of staying on the previous window

### Fixed
- **Penalty transparency** — `sleep_after_midnight` penalty folded into sleep score; `dinner_after_9pm` penalty folded into diet score; both visible as red chip warnings on Dashboard and in scores

---

## [v2.7] — 2026-04-24

### Changed
- Penalty system refactored: sleep and diet penalties now deducted from their respective section scores rather than as an invisible global deduction
- Dashboard shows active penalty chips (⚠) below affected category bars for transparency

---

## [v2.6] — 2026-04-22

### Added
- **Fasting widget** in Diet Log — live countdown from last dinner to current time; shows elapsed hours in real time
- Fasting score calculation: logistic curve between `min_hours` and `target_hours`
- `yesterdayDiet` lookup added to scoring pipeline for fasting window computation
- **Screen time deduction** in sleep scoring — effective sleep = total hours − screen-on hours

### Changed
- Sleep scoring uses effective hours instead of raw hours for the 7+ hours component

---

## [v2.5] — 2026-04-18

### Added
- **Custom meal options** in Settings — add named foods with good/bad category, points per portion, and ideal portions
- Per-food `meal_items` array replaces static checkbox fields (backward compatible)
- Ideal portions: scoring proportional up to ideal, deduction above ideal (50% penalty per extra portion)
- **Data export** — Excel workbook (.xlsx) with sheets for Scores, Diet, Workout, Sleep, Custom Foods; saved to device Documents on Android

---

## [v2.4] — 2026-04-14

### Added
- **Local notifications** via `@capacitor/local-notifications`
  - Bedtime and wake-up reminders (configurable times)
  - Three step check-in reminders per day (configurable times)
  - Lunch reminder (configurable)
  - Fixed hydration reminders at 11:00 and 15:30
- Notification settings section in Configure page

---

## [v2.3] — 2026-04-10

### Added
- **Sleep timer** with automatic screen-time detection via Android `UsageStats` API
  - Start at bedtime, stop in the morning — records exact sleep and wake times
  - Screen-on time auto-deducted from total sleep hours
  - Graceful permission flow for Usage Access setting
- `formatElapsed` live timer display (HH:MM:SS)

### Changed
- Sleep log date logic: if timer started before noon, log date assigned to previous calendar day

---

## [v2.2] — 2026-04-07

### Added
- **History page** with monthly calendar view
  - Color-coded day dots by score (green ≥80, yellow ≥60, orange ≥40, red <40)
  - Monthly stacked bar chart (Diet · Workout · Sleep)
  - Summary metrics: avg score, best day, days logged
  - Tap any day to see score breakdown
- **Score streak counter** on Dashboard — consecutive days scoring ≥ 60 pts

---

## [v2.1] — 2026-04-03

### Added
- **Performance radar chart** in day detail (Diet · Workout · Sleep normalised to 100)
- Grade badges: S / A / B / C / D / F with labels and colour coding
- `ScoreRing` animated SVG component
- **Bonus points system** — all-rules-followed (+5 pts), perfect score (+10 pts)
- Configurable score weights in Settings — all category maxes and item weights

---

## [v2.0] — 2026-03-28

### Changed
- Complete UI rewrite — dark-mode design system with Google Pay–inspired card layout
- Capacitor Android integration (package: `com.healthquest.tracker`)
- All data moved to IndexedDB via Dexie — fully offline, no FastAPI required on device
- `client.js` router: native → IndexedDB, browser → FastAPI with IndexedDB fallback
- `scoring.js` extracted as pure functions, no I/O side effects

### Added
- `useStore` (Zustand) for global today-score and streak state
- `seedDefaults` for first-launch config seeding
- `StatBar` progress bar component
- Theme toggle (Dark / Light) persisted to `localStorage`

---

## [v1.3] — 2026-03-20

### Added
- FastAPI backend with SQLite persistence (for browser dev / desktop use)
- `/diet`, `/workout`, `/sleep`, `/scores`, `/config` REST endpoints
- Monthly scores endpoint with streak computation
- `start.sh` to launch the backend + Vite dev server together

---

## [v1.2] — 2026-03-14

### Added
- **Workout Log page** — steps input, post-dinner walk toggle + duration, exercise session toggle + type + duration
- Workout scoring: 8k steps = 15 pts, 10k bonus = +3 pts, walk = 10 pts, exercise = 10 pts
- Steps scoring partial credit (≥5k = 50% of base)

---

## [v1.1] — 2026-03-09

### Added
- **Sleep Log page** — manual sleep/wake time entry, sleep hours auto-calculated
- Sleep scoring: on-time sleep (+10), 7+ hours (+12), wake by 8 AM (+8)
- Quick presets: Perfect / Target / Late / Weekend
- Sleep quality rating (1–5)
- Penalty for sleep after midnight (−8 pts)

---

## [v1.0] — 2026-03-04 — Initial Release

### Features
- **Diet Log page** — breakfast, lunch, dinner checkboxes with notes
  - Protein-first toggle, no post-dinner snack toggle, tea sugar toggle
  - Dinner time entry with on-time scoring
- **Dashboard** — daily score display with category breakdown
- Basic scoring: diet (35 max), workout (35 max), sleep (30 max)
- Dinner-after-9PM penalty (−5 pts)
- Six daily rules display
- Daily quests checklist (Diet · Workout · Sleep)
- React 18 + Vite + Tailwind CSS frontend
- Local state only (no persistence between page refreshes)
