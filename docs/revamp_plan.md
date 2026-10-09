# Health Quest — Revamp Plan

How to rebuild the app's surface so a user always knows where they are and what to do next. This plan turns the findings in [app_critique.md](app_critique.md) into concrete work.

**Scope:** screens, navigation, wording and logging flow. The scoring engine, database tables, badge rules and notification logic stay as they are unless a step below says otherwise. No user data is migrated or lost.

**Shape:** three releases. Each one is shippable on its own and leaves the app better than before.

| Release | Theme | Outcome |
|---|---|---|
| v5.0 | Calm the daily loop | Home and logging are simple. One vocabulary. |
| v5.1 | Regroup the rest | Progress, Profile and Settings each do one job. |
| v5.2 | Polish | Onboarding, text size, tone, notifications, hard-coded numbers. |

---

## 1. Design rules

Every decision below follows from these. When a new feature is proposed later, test it against them.

1. **One question per screen.** If a block does not help answer that screen's question, it moves or goes.
2. **One name per number.** A number has one name everywhere; a name never means two numbers.
3. **One home per feature.** Badges live in one place. Settings live in one place. Other screens may link there, not repeat it.
4. **One save rule.** Everything saves as you change it. There is no Save button anywhere in logging.
5. **Five cards, then an expander.** No screen shows more than five cards before the user asks for more.
6. **Advice is tappable.** Anything that tells the user to do something opens the place where they do it.

---

## 2. Vocabulary

| Term | Meaning | Where it appears |
|---|---|---|
| **Score** | Today's total out of 100 | Today, Progress |
| **Points (pts)** | Units of the score | Everywhere a number is added to or taken from the score |
| **Grade** | S / A / B / C / D / F for a score | Next to any score |
| **Streak** | Consecutive quality days | Today (once), Profile |
| **Level / XP** | Lifetime progress | Profile only |
| **Badge** | An achievement | Profile only (plus the unlock pop-up) |
| **Goal** | A daily or weekly target (was "Active Quests") | Profile only |

Retired words: Quest (on Home and Activity), Power-up, Active damage, XP for daily points, the RPG tier names (Idle … Legend), Prestige, monthly identity labels, "Weekly Executive".

Kept but shown less: badge rarity (as the badge's colour only) and badge evolution (as a ×N count only).

---

## 3. Navigation

Four tabs stay, with clearer names and jobs. Settings becomes a gear icon in the Profile header.

| Tab | Was | Question it answers |
|---|---|---|
| **Today** | Home | How am I doing and what's next? |
| **Log** | Activity | Record food, movement, sleep, weight |
| **Progress** | History | Am I improving? |
| **Profile** | Profile | What have I earned? |

Routes after the revamp: `/`, `/log`, `/progress`, `/profile`, `/profile/badges`, `/weight`, `/settings`. The `/workout` and `/sleep` routes are deleted. Keep redirects from `/activity` and `/history` so existing notification deep links still open the right tab.

---

## 4. Target screens

### Today

```
Tue, Oct 9                              🔥 12
┌─────────────────────────────────────────┐
│  72 /100   B · Great                    │
│  Diet     ███████░░░  24/35             │
│  Fasting  ██████░░░░   6/10             │
│  Workout  █████░░░░░  18/35             │
│  Sleep    ████████░░  24/30             │
│                          Full detail ›  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ NEXT  2,400 more steps → +7 pts       › │
│ ⚠ Dinner after 9 PM cost 5 pts          │
└─────────────────────────────────────────┘
┌────────┬────────┬────────┬────────┐
│ 🍽 Meal │ 👟 Move │ 🌙 Sleep│ ⚖ Weight│
│   2/3  │   ✓    │   —    │   ✓    │
└────────┴────────┴────────┴────────┘
```

- **Score card:** score, grade, four bars always visible. "Full detail" opens the existing day-detail panel (radar, breakdown, AI summary) as a sheet.
- **Next card:** the single highest-value action left today, chosen from the list the Home carousel already computes. Static. Tapping it opens the matching log. Penalties show as a second line. When nothing is left: "All done for today".
- **Log row:** four buttons with done-state. Meal opens Add Meal directly; the others open the Log tab on that section.
- **Removed:** greeting headline, bell, second streak badge, RPG tier, Perfect Day banner (becomes a one-time toast), carousel dots and rotation, weekly shortcut, weight shortcut, badge shelf, Daily Quest cards, floating button.

### Log

One page with a three-way switch (Food · Move · Sleep). No hero card, no log sheet.

**Food**
- Each meal (Breakfast, Lunch, Dinner, Snacks) is a section listing its foods with portion − / + and remove, the meal time, and a **+ Add** that opens Add Meal preset to that meal.
- One fasting line under the list.
- Calories card below, unchanged, with the daily calorie and macro targets moved here from the Weight page.
- Notes behind a "Add note" link.

**Move**
- Steps shown once with source and sync time. "Edit" opens a number field. Sync button and the Health Connect help messages stay.
- Two toggles: Post-dinner walk, Exercise. Turning one on reveals its duration (and type for exercise).

**Sleep**
- One primary button: Start timer / Wake up.
- Logged-sleep summary card as today.
- "Edit details" reveals manual times, presets, screen time, quality and notes.

**Add Meal** is unchanged, and becomes reachable from Today and from every meal section.

### Progress

Three sub-tabs: **Week · Month · Trends**. Opens on Week.

- **Week:** week navigator, score card, **What to fix** (was Strategic Fix), then one **Why** card that holds wins, costs, best and hardest day, and top junk foods, collapsed to the top two lines each.
- **Month:** month navigator, calendar, day detail directly under the tapped day, one summary card. Story Arc, Trajectory, Near Misses and the two insight lists sit behind a single **Month insights** expander.
- **Trends:** the line / stacked chart, Meal Insights, and lifetime stats (moved from Profile).

### Profile

1. **Header:** name, level, XP bar, streak, gear icon.
2. **Next badge:** the closest one to unlocking, with progress.
3. **Goals:** today's and this week's goals (was Active Quests).
4. **Badges:** earned badges in a grid, with **See all** → `/profile/badges` showing all badges by category.

Removed: This Month, Journey Timeline, Lifetime Stats (moved), Super Badge Vault and Super Badge Quest (super badges become a category on the all-badges page), the in-page settings list.

### Settings

| Group | Contains |
|---|---|
| **You** | Name, body & goal, theme |
| **Scoring** | One screen: category weights, diet, workout, sleep, fasting, penalties. Labelled "Advanced", with Reset to defaults |
| **Food & AI** | Custom foods, AI key |
| **Reminders & data** | Reminders, export / backup / restore, tutorial |
| About (footer) | Version, replay onboarding. Seven taps on the version unlocks Developer Tools |

The "current weight" field leaves Settings; the Weight log is the only source.

### Onboarding

Three steps: goals, activity level and main struggle, then a three-slide tutorial (how the score works, how to log, where to see progress). The four questions whose answers are never saved are removed.

---

## 5. Work breakdown

### v5.0 — Calm the daily loop

| # | Task | Main files |
|---|---|---|
| 1 | Rename tabs and routes; add redirects; delete the Workout and Sleep pages and their routes | `App.jsx`, `Navbar.jsx`, `pages/WorkoutLog.jsx`, `pages/SleepLog.jsx` |
| 2 | Vocabulary pass: "pts" for daily points, remove XP / Quest / Power-up / damage wording from Today and Log | `Dashboard.jsx`, `Activity.jsx`, `AddMealFlow.jsx` |
| 3 | Rebuild Today as three blocks; extract the next-action logic into its own function returning one item with a target route | `Dashboard.jsx`, new `services/nextAction.js` |
| 4 | Auto-save for diet, workout and sleep; remove the log sheet and its Save button | `Activity.jsx` |
| 5 | Food section inline with per-meal **+ Add**; visible meal times | `Activity.jsx`, `AddMealFlow.jsx` |
| 6 | Move and Sleep sections simplified as described | `Activity.jsx` |
| 7 | Split `Activity.jsx` (1,300 lines) into `Log.jsx` plus `log/FoodSection`, `MoveSection`, `SleepSection` as part of the rewrite | new files |

Notes for task 4, since the Save button currently does more than save:
- It reschedules smart and trend notifications, and schedules the post-dinner walk reminder 35 minutes after dinner time. These must run from the auto-save path.
- It triggers the haptic tap and the "+N pts" toast. Keep one quiet confirmation per change, not a toast per keystroke.
- Debounce text and number fields (notes, manual steps) by about 600 ms; save toggles and portion changes immediately.
- Decide the rule for steps: today, opening the screen overwrites the step count with the synced value. With auto-save, a manual entry should win for the rest of that day unless the user taps Sync.

### v5.1 — Regroup the rest

| # | Task | Main files |
|---|---|---|
| 8 | Progress: three sub-tabs, calendar first, Why card, Month insights expander, Trends tab | `History.jsx` → `Progress.jsx` |
| 9 | Profile reduced to four sections; new all-badges page; gear icon | `Profile.jsx`, new `pages/Badges.jsx` |
| 10 | Badges shown only in Profile; remove shelves from Today and Progress; keep the unlock overlay | `Dashboard.jsx`, `History.jsx`, `BadgeShelf.jsx` |
| 11 | Settings regrouped into four; Scoring merged into one screen; Developer Tools hidden; current-weight field removed | `Settings.jsx` |
| 12 | Split `Settings.jsx` (1,700 lines) into one file per group during the regroup | new files |
| 13 | Move calorie and macro targets from Weight to the Food section | `Weight.jsx`, `log/FoodSection` |

### v5.2 — Polish

| # | Task | Main files |
|---|---|---|
| 14 | Onboarding cut to three steps and three slides | `Onboarding.jsx` |
| 15 | Read every target and maximum from settings instead of fixed numbers (step targets, category maximums, walk and exercise points) | `Dashboard.jsx`, `log/*`, `DayDetail.jsx` |
| 16 | Minimum text size 11 px; remove all 7–10 px labels | all screens, `index.css` |
| 17 | Wording: "Cost you points", "Hardest day", "What to fix" | `History.jsx`, `weeklyInsights.js`, `monthlyInsights.js` |
| 18 | Notification cap of three per day and a Quiet / Standard / Coach choice | `notificationEngine.js`, `trendNotificationEngine.js`, Settings |
| 19 | Update README, the guide page and CHANGELOG to the new names | `README.md`, `index.html`, `CHANGELOG.md` |

---

## 6. What does not change

- Scoring formulas and the `daily_scores` values.
- Database tables and the backup format. Old backups must still restore.
- Badge unlock rules and counts. Only where badges are displayed changes.
- Add Meal's internal flow.
- Sleep timer, screen-time deduction, step sync and its fallbacks.
- Weight page, apart from losing the macro targets.

---

## 7. Decisions needed before starting

| Decision | Recommendation | Why |
|---|---|---|
| Remove the RPG tier from Today entirely, or keep it somewhere? | Remove | It duplicates the grade. Level in Profile carries the game feel. |
| Remove Prestige and Active title? | Hide both from the UI, keep computing them | No data loss; can return later if missed. |
| Keep monthly identity labels ("Momentum Elite")? | Drop | An eighth status label for the same scores. |
| Keep all 104 badges? | Keep, on the all-badges page only | They cost nothing once they are off the main screens. |
| Keep the Perfect Day banner? | Replace with a one-time toast | It pushes the score card down on the best days. |
| Old `/activity` and `/history` routes | Redirect for two releases, then delete | Protects notification deep links already scheduled on the phone. |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Auto-save writes partial data mid-edit (for example a half-typed step count) | Debounce; only save valid values; score recalculation already tolerates repeats. |
| Losing a side effect that lived in the Save button | Checklist in task 4; test the walk reminder and notification reschedule by hand. |
| Users who liked the game layer feel it was removed | Level, XP, goals and badges all remain in Profile; the unlock pop-up still appears anywhere. |
| Large-file rewrites introduce regressions | Split files in the same change that rewrites them, one screen per commit. Existing scoring tests must stay green. |
| Renamed routes break saved links | Redirects, as above. |

---

## 9. Done means

Check these on a real phone before each release.

**v5.0**
- Today fits on one screen without scrolling.
- Logging a meal takes at most three taps from Today or Log.
- No Save button exists in logging; closing the app mid-edit loses nothing.
- The words XP, Quest, Power-up and damage do not appear on Today or Log.

**v5.1**
- No screen shows more than five cards before an expander.
- Badges appear on exactly one screen.
- Settings has one entry point and four groups.
- The calendar is the first thing under the month navigator.

**v5.2**
- Changing a step target or category maximum in Settings changes every screen that shows it.
- No text is smaller than 11 px.
- Onboarding takes under a minute.
- No day produces more than three notifications on the Standard setting.

**Overall:** a new user can say what to do next within five seconds of opening the app.
