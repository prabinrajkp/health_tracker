# Health Quest — App Critique (v4.28)

A critic's review of the whole app, focused on one complaint: **there are too many features on every screen and the user gets lost.** Based on a read of the actual screen code, not the planning docs.

## Verdict

The engine is strong: honest scoring, a fast Add Meal flow, a sleep timer, automatic step sync, and a weekly "one thing to fix". The problem is the surface. Every feature built since v1 is still on screen at full volume, and nothing has been demoted or removed to make room.

The result is the opposite of what [ui_guide.md](ui_guide.md) set out to build. That guide says each screen must answer one question and the user should never have to hunt. Today:

| Screen | The one question it should answer | Blocks on screen now |
|---|---|---|
| Home | How am I doing, and what do I do next? | 9, plus a floating button |
| Activity | Log it and leave | 3 tabs × (hero + summary + sheet of 4–7 cards) |
| History → Week | Did my week improve? | 8 cards |
| History → Month | Which days were good? | up to 11 cards |
| Profile | Who am I becoming? | 11 sections, 104 badges |
| Settings | Change a setting | 16 menu rows |

The fix is mostly subtraction and regrouping. Very little new code is needed.

---

## The five root problems

### 1. Too many ways of saying "how you're doing"

A user sees all of these, and they are not the same number:

| System | Where it shows | Based on |
|---|---|---|
| Daily score /100 | Home, History | Today's logs |
| Letter grade S–F | Home, History, Day detail | Daily score |
| RPG tier (Idle → Legend, each with a subtitle) | Home hero card | Daily score again |
| Level + XP | Profile | Lifetime points |
| Prestige | Profile | Badge rarity + streaks |
| Active title | Profile | Level + badges |
| Monthly identity (8 labels, e.g. "Momentum Elite") | History → Month | Month's scores |
| Badge rarity (common / rare / epic / legendary) | Badges | Fixed per badge |
| Badge evolution (Bronze / Silver / Gold / Neon) | Badges | Times earned |
| Super badges | Profile | Sets of badges |
| Streak | Home (twice), Activity, Profile | Quality days |

Grade and RPG tier are two labels for the same daily score, shown side by side on the same card.

### 2. The same word means different things

- **"pts" vs "XP".** The same daily points are called "pts" on Home and "XP" on Activity ("Claim +12 XP"). In Profile, XP is a different, lifetime number. The code uses "pts" 84 times and "XP" 17 times across screens.
- **"Quest"** means three things: the three Diet / Workout / Sleep shortcut cards on Home; the "Diet Quest" header in Activity; and the five daily plus four weekly goals in Profile → Active Quests (weigh-in, breakfast, 8,000 steps, no junk, exercise). There is also a "Super Badge Quest". A user who completes "3/3 quests" on Home has not completed their quests in Profile.
- **"Power-up" and "Active damage"** on Home are just "things you can still do" and "penalties".

### 3. Everything is duplicated

- **Streak** appears twice on Home alone (header chip and the badge on the avatar).
- **Diet / Workout / Sleep done-state** appears twice on Home (chips inside the hero card, then the Daily Quest cards).
- **Badges** appear in four places: Home mini shelf, History → Week (full shelf), History → Month, and Profile. "View all" on Home goes to History, not Profile.
- **Fasting** appears twice in Diet (a mini row on the tab, and a widget inside the log sheet).
- **Steps** appear twice in Workout (the tab, then again inside the sheet with a slider, a number box and four presets for one value that is synced automatically anyway).
- **Monthly summary** appears in History → Month and again in Profile → This Month.
- **Settings menu** exists twice: 8 rows at the bottom of Profile and 16 rows in Settings, with different names for the same thing ("Scoring Weights" vs "Category Weights", "Custom Foods" vs "Custom Meal Options").
- **Weight** is entered in the Weight log and also as "current weight" in Settings → Player Profile.

### 4. Logging has three different save rules

- Add Meal saves by itself when you tap Finish.
- The Diet / Workout / Sleep sheet saves only when you tap the bottom button ("Claim +N XP →").
- The sleep timer and step sync save by themselves.

So a user can never be sure whether closing a sheet loses their change. On top of that, adding one food from the Activity tab takes two stacked sheets:

> meal tile → log sheet → "Add food to breakfast" → second sheet → pick food → builder → Finish → (duplicate warning) → confirmation → Done → back on first sheet → Claim XP

The floating button on Home does the same job in half the steps, but it only exists on Home.

### 5. The useful advice is buried under decoration

- The best feature for a lost user is "what should I do next". On Home it is a carousel that **rotates by itself every 10 seconds** through up to seven items. The user cannot rely on it, and tapping an item does nothing.
- In History → Month, the calendar is third on the page, below a hero card and Meal Insights, even though the tab is called "Monthly Calendar". The charts are at the very bottom, under eleven cards.
- History opens on a tab called "Weekly Executive", which is not a phrase a user would look for.
- The bell icon on Home looks tappable and does nothing.

---

## Screen by screen

### Home ([Dashboard.jsx](../frontend/src/pages/Dashboard.jsx))

What is there, top to bottom: greeting, streak chip, dead bell, Perfect Day banner, hero card (tier emoji, tier name, subtitle, score, grade, progress bar, grade label, three status chips, an expander that opens two sub-tabs holding a score ring, four bars, a radar chart and the AI summary), rotating power-up card, This Week shortcut, Weight shortcut, badge mini shelf, Daily Quests, floating Add Meal button.

Change it to three blocks:

1. **Score card.** Score, grade, and the four category bars visible without expanding. Drop the RPG tier and subtitle from this card.
2. **Next best action.** One static line, the highest-value thing left today, and tapping it opens that log. Keep the penalty warning here as a second line when one applies. No auto-rotation.
3. **Log row.** Meal · Steps · Sleep · Weight as four buttons with a tick when done. This replaces the status chips, the Daily Quest cards, the weight shortcut and the floating button.

Move off Home: weekly shortcut and badge shelf (they belong in Progress and Profile). Remove: bell icon, second streak badge, radar chart from the Home expander.

### Activity ([Activity.jsx](../frontend/src/pages/Activity.jsx))

- Make everything auto-save and remove the "Claim XP" button. One rule everywhere.
- **Diet:** show the logged foods directly on the tab, grouped by meal, with a "+" per meal that opens Add Meal straight away. That removes the sheet-inside-a-sheet. Show the meal time next to each meal, since dinner time drives both the late-dinner penalty and the fasting score and is currently hidden inside the sheet.
- **Workout:** show steps once. Keep one "edit" link for manual entry instead of slider + number box + presets. Walk and exercise become two toggles on the tab.
- **Sleep:** timer as the one primary action. Put manual times, screen time, quality and notes behind a single "Edit details" link.
- Rename the buttons to plain verbs: "Add meal", "Log workout", "Log sleep" instead of "Start Diet Quest" and "Power Up Workout".
- Keep one fasting display, on the Diet tab.

### History ([History.jsx](../frontend/src/pages/History.jsx))

- Rename the tab to **Progress**, and the sub-tabs to **Week**, **Month**, **Trends**.
- **Week:** score card, Strategic Fix, then Wins and Damage collapsed into one "Why" card. Remove the badge shelf from here. Fold best/worst day and junk foods into the "Why" card.
- **Month:** calendar first, day detail directly under it. Then one summary card. Move Story Arc, Trajectory, Near Misses and "Driving Scores Up / Score Drags" behind a single "Month insights" expander, or pick the two that matter.
- **Trends:** the line/stacked chart and Meal Insights live here, so they are no longer under eleven cards.

### Profile ([Profile.jsx](../frontend/src/pages/Profile.jsx))

Eleven sections is a second dashboard. Reduce to:

1. Hero: name, level, XP bar, streak.
2. Next badge: the single closest one, with progress.
3. Badges: earned ones, plus a "See all" page for the full 104, grouped by category.

Remove from Profile: This Month (duplicate of History), Journey Timeline, Lifetime Stats (move to Trends if wanted), the settings list (replace with one gear icon in the header), and either Super Badge Vault or Super Badge Quest (they show the same thing).

### Settings ([Settings.jsx](../frontend/src/pages/Settings.jsx))

Sixteen rows, six of which are scoring knobs. Group into four:

- **You:** name, body & goal, theme.
- **Scoring:** one screen with sections for category weights, diet, workout, sleep, fasting and penalties, under an "Advanced" label with a "Reset to defaults" button.
- **Food & AI:** custom foods, AI key.
- **Reminders & data:** reminders, export/backup, tutorial.

Hide Developer Tools behind a hidden gesture (for example seven taps on the version number). It should not be a visible row in a release build. Move Reset Onboarding into an "About" footer.

### Weight ([Weight.jsx](../frontend/src/pages/Weight.jsx))

Clear and focused. One issue: the calorie and macro targets shown here are diet information. Show them on the Diet tab, where the Calories card already is, and keep Weight about weight.

### Onboarding ([Onboarding.jsx](../frontend/src/pages/Onboarding.jsx))

Seven required questions, then six tutorial slides. Only three answers are used (goals, activity level, main struggle). Eating pattern, sleep pattern, diet preference and time constraint are required to continue but are never saved. Either use them or remove them, and cut the tutorial to three slides: how the score works, how to log, where to see progress.

---

## Other issues found

- **Unreachable screens.** `/workout` and `/sleep` still have routes and full pages ([WorkoutLog.jsx](../frontend/src/pages/WorkoutLog.jsx), [SleepLog.jsx](../frontend/src/pages/SleepLog.jsx), about 800 lines together) but nothing links to them. They duplicate the Activity tabs and should be deleted.
- **Hard-coded targets that ignore Settings.** Step targets, category maximums and point values are editable in Settings, but several screens print fixed numbers: the Workout tab's "8,000 target" and 10,000 bar, the Home bars' 35 / 10 / 35 / 30 maximums, and "+10 pts" on the walk card. Change the settings and the screens disagree with the score.
- **Text too small.** About 77 labels use 9–10 px text and a few use 7–8 px. Set a floor of 11–12 px. Removing content is what makes that possible.
- **Tone.** "Active damage", "Biggest Damage", "Worst Day", "Stacked failure detected". The UI guide warns against "guilt simulators". Prefer "Cost you points", "Hardest day", "What to fix".
- **Notification load.** There are about twenty kinds of notification (fixed reminders, risk alerts, trend alerts, weekly and monthly summaries). I did not work out the worst-case number per day. Add a daily cap of three and a single choice of Quiet / Standard / Coach.
- **Settings is hard to find.** It is only reachable from the bottom of Profile, below ten sections.

---

## What to keep exactly as it is

- Add Meal: time-based meal guess, Repeat Yesterday, frequent and recent meals, named meals.
- Sleep timer with automatic screen-time deduction.
- Automatic step sync with the phone-sensor fallback.
- Strategic Fix: one highest-impact action per week.
- Calendar with tap-for-detail and share as image.
- Fully offline, with export and backup.

---

## Recommended order of work

**Phase 1 — biggest relief, smallest effort**

1. One vocabulary: "points" for daily score everywhere; "XP" and "Level" only in Profile; "Quest" only for the Profile goals. Remove the RPG tier from Home.
2. Home down to three blocks (score, next action, log row).
3. Auto-save everywhere; remove the "Claim XP" button; "+" on a meal opens Add Meal directly.
4. Delete the unreachable Workout and Sleep pages, the dead bell and the duplicate streak.

**Phase 2 — regroup**

5. History becomes Progress with Week / Month / Trends; calendar first.
6. Profile down to hero, next badge, badges. Gear icon for Settings.
7. Settings grouped into four; Developer Tools hidden.
8. Badges shown in one place only (Profile), with at most a "new badge" toast elsewhere.

**Phase 3 — polish**

9. Onboarding: drop the unused questions, three tutorial slides.
10. Read all targets and maximums from Settings.
11. Minimum text size, softer wording, notification cap.

## How to tell it worked

- Home fits on one screen without scrolling.
- Logging a meal takes at most three taps from any tab.
- No screen has more than five cards before the first expander.
- Each number has one name, and each name means one number.
- A new user can say what to do next within five seconds of opening the app.
