# Free-text workout logging — Plan

Log any workout in your own words, such as "bench press 3×10 at 5 kg, 20 min cycling, 2 km run", and get a calorie figure, with AI help the way Add Meal already has.

**Status:** all four phases built in v4.40. See [How it was built](#how-it-was-built) for where the build differs from this plan.

---

## Verdict

**Build the free-text logging. Do not let the AI produce the calories.**

| Part of the request | Verdict | Why |
|---|---|---|
| Log any exercise as free text | **Yes** | Today there are six fixed types and five fixed durations. Most real workouts don't fit |
| Capture sets, reps and weight for gym work | **Yes, for progress, not for calories** | It is the record a lifter wants, to see bench press go from 5 kg to 20 kg. It barely changes the calorie figure (§2) |
| AI reads the text | **Yes, as with foods** | Turns "bench 3x10 5kg, 20 min cycle" into rows, and remembers each exercise so it needs the AI once |
| AI decides the calories | **No** | A language model's calorie number changes from call to call and can't be checked. The app should work it out from published activity values (METs), the duration and your weight, as it already does |
| More accurate calories | **Somewhat, and honestly limited** | The biggest gain is the right activity and real duration instead of "Gym, 45 min". Estimates of this kind stay ±20 to 30% per person, whatever the input |

**Rule for the whole feature: the AI reads, the app counts.** It is the same split the notifications use ("rules decide, AI writes").

---

## 1. What exists today

| Part | Today | Where |
|---|---|---|
| Session | One per day: on or off, a type, a duration, Normal or Hard | `pages/log/MoveSection.jsx` |
| Types | Badminton, Stairs, Walking, Gym, Cycling, Other | `EXERCISE_TYPES` |
| Durations | 20, 30, 45, 60, 90 min | `EXERCISE_DURATIONS` |
| Calories | (MET − 1) × kg × hours, from 2024 Compendium METs, net of the resting burn already counted | `services/energy.js` `exerciseKcal` |
| Score | Points for a session of 20+ min (60%) or 45+ min (full) | `services/scoring.js:198` |
| Steps | Synced from Health Connect; walking is counted through steps, not twice | `energy.js` |
| Device calories | Health Connect active calories, if turned on, replace the estimates | `estimateBurn` |
| Also reads `exercise_done`, `exercise_type`, `exercise_duration_minutes` | Badges, weekly insights, nudges, widgets (Goals, Quick log), Excel export, JSON backup | several |

What is missing: a second session in a day, any exercise not in the six, real durations, and any record of what was lifted.

---

## 2. A critical look at the request

### 2.1 Weight lifted barely changes calories

The energy cost of a gym session comes mostly from **time and effort**: moving between sets, holding, breathing hard, recovering. The work of lifting the bar itself is small.

| Bench press, 3 × 10 | Energy to lift the bar (about 22% muscle efficiency, 45 cm travel) |
|---|---|
| 5 kg | ~1 kcal |
| 20 kg | ~3 kcal |
| 50 kg | ~7 kcal |
| 80 kg | ~12 kcal |

| The same 3 sets, taking about 6 minutes, 70 kg person | Net burn |
|---|---|
| Light effort, MET 3.5 | ~18 kcal |
| Vigorous effort, MET 6.0 | ~35 kcal |

Going from 5 kg to 80 kg adds about 11 kcal. Changing the effort level for the same six minutes adds about 17. Over an hour, effort and time move the figure by **175 to 350 kcal**. So "3×10 at 5 kg" is worth logging, but its calories should come from how long the session took and how hard it was, not from the kilograms.

### 2.2 Why the AI should not produce the number

| If the AI gives calories | Problem |
|---|---|
| Ask twice, get two numbers | Logs and net calories drift for no reason |
| Says 450 kcal for "bench 3x10" | Nothing to check it against; plausible-sounding numbers are the hardest to catch |
| Doesn't know your weight unless sent | Sending body weight is more personal data leaving the phone |
| Needs the network every time | Breaks the app's offline promise |

What the AI is good at is understanding the text: that "bp 3x10 5" is bench press with 3 sets of 10 at 5 kg, and that "spin class 45" is indoor cycling for 45 minutes. It then picks the matching activity from a list the app gives it. The app holds the METs, applies your weight, and does the arithmetic, so the result is the same every time and can be shown step by step.

### 2.3 Accuracy, honestly

- Published METs are averages. Two people doing the same session can differ by 20 to 30%.
- Duration is the input that matters most, and gym logs often don't record it. The plan estimates it from sets when missing (§3.3) and shows that it did.
- Once the adaptive calories plan (`docs/adaptive_calories_plan.md`) is in place, any steady over- or under-estimate is absorbed into the learned maintenance. Per-session accuracy then matters less for the target, and more as feedback ("today's session was about 250 kcal").
- A heart-rate watch through Health Connect beats any of this. When device calories are on, they still replace the estimate, as today.

### 2.4 Risks

| Risk | What the plan does |
|---|---|
| Logging becomes a chore | Free text is optional. One tap still logs "Gym, 45 min" as today. Repeat-last-session and saved routines make the detailed path fast |
| Scoring gets gamed: log 5 sessions, get 5× points | Points stay per day, from total minutes, capped as today |
| Double counting running and walking with steps | Step-based activities count through steps when steps cover them (§3.4) |
| Calorie numbers shown to someone who hid them | Hidden, as everywhere else |
| AI unavailable or no key | A local parser and exercise list cover common cases. The AI is only for unknowns, as with foods |

---

## 3. How it should work

### 3.1 The flow

```
"bench press 3x10 5kg, incline db 3x12 10kg, 20 min cycling"
        │
        ▼  1. local parser: split by comma or line; read sets×reps, kg, min, km
        ▼  2. match each name to the exercise library (local, then learned)
        ▼  3. unknown names only: AI maps them to the library, once, and the match is saved
        ▼  4. app works out time and calories from METs, your weight and duration
        ▼
┌──────────────────────────────────────────────┐
│ Bench press        3 × 10 · 5 kg      ~6 min │
│ Incline DB press   3 × 12 · 10 kg     ~6 min │
│ Cycling            20 min · moderate          │
│ Total 32 min · about 190 kcal       [Save]   │
└──────────────────────────────────────────────┘
   each row editable: name, sets, reps, kg, minutes, effort
```

### 3.2 The exercise library

A local table, shipped with the app, of about 80 common activities. Each has a name, aliases, a kind (strength, cardio, sport, steps-based, flexibility), and Normal and Hard METs from the 2024 Compendium.

- **Strength** exercises share the Compendium's resistance-training values, light to vigorous, rather than one per lift. The Compendium doesn't separate bench press from squats, and pretending otherwise would be false precision.
- **Cardio and sport** get their own values (running by pace, cycling by effort, swimming, yoga, football, cricket, badminton…).
- **Learned matches:** "bp", "db flys", "spin class" map to library entries once, by alias or by the AI, and are stored like custom foods, with **Edit** and **Forget** in Settings.

### 3.3 Time when it isn't given

| Input | Duration used |
|---|---|
| "20 min cycling" | 20 min |
| "2 km run" | From a typical pace, editable |
| "bench 3×10" | About 2 minutes per set (work plus rest), so 6 min, shown as "~6 min" and editable |
| The whole session's time is given ("gym 50 min: bench…, squats…") | The session time wins; exercises inside it share it |

When the summed estimate differs a lot from a session time given, the session time is used.

### 3.4 Steps and double counting

| Activity | Counted through |
|---|---|
| Walking, hiking, running, stairs | **Steps**, when the day has synced steps covering the session. The row shows "counted in your steps". With no steps, the session's own minutes count |
| Cycling, swimming, gym, sport | The session |
| Device active calories turned on | The device, for everything, as today |

Running is the case the current code misses: a 5 km run is counted both as steps and as a session. This fixes it.

### 3.5 What the AI is asked

Same providers, privacy rules and caching as the food lookup (`services/llmApi.js`).

- **Sent:** only the unrecognised exercise names and the list of library entries to pick from. Not your weight, not the date, nothing else.
- **Asked for:** strict JSON, `[{ "text": "spin class", "library": "cycling_indoor", "effort": "hard" }]`, using a schema as the nudges do.
- **Checked:** the library id must exist; anything else is "Unrecognised — pick one", never a guess.
- **Never asked for:** calories, METs or durations.

### 3.6 Data

Today's single session becomes a list, alongside meals, in the same day record:

```js
workout_items: [
  { id, name: 'Bench press', library: 'resistance', kind: 'strength',
    sets: 3, reps: 10, kg: 5, minutes: 6, minutesEstimated: true, effort: 'normal', time: '18:30' },
  { id, name: 'Cycling', library: 'cycling_moderate', kind: 'cardio', minutes: 20, effort: 'normal' },
]
```

The existing `exercise_done`, `exercise_type` and `exercise_duration_minutes` stay, **worked out from the list on every save**: done if any item; total minutes; the main type. So scoring, badges, weekly insights, nudges, widgets, Excel and backups keep working unchanged. An old day with no list reads as one item built from those fields.

### 3.7 Score

Unchanged in spirit: points for 20+ and 45+ minutes of **total** exercise in the day, capped as today. Calories never score, as everywhere in the app. Optionally later: a strength day can count from fewer minutes, since rest between sets is real training. That's a scoring decision for you, not part of this plan.

### 3.8 Progress for lifters

Recording sets and weight earns its keep here, not in calories:

- per exercise: best set and total weight moved, session by session,
- "Last time: 3 × 10 at 5 kg" shown while logging, with one tap to repeat,
- a gentle "new best" when it goes up. Badges for this are a later decision.

---

## 4. Benefit to the user

| Person | Benefit |
|---|---|
| Goes to the gym and wants to track lifts | **High.** A real training log, with progress, inside the same app |
| Does varied sport (cricket, swimming, football) | **High.** Can finally log what they do instead of "Other" |
| Runner with Health Connect steps | **Medium.** Fixes double counting; the run is recorded by name |
| Walks only | **None.** Steps already cover it; the screen stays as simple as today |
| Wants the most accurate calories | **Low to medium.** Better than six fixed types, but a heart-rate device is better still, and adaptive calories corrects the target either way |

---

## 5. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| AI calorie numbers | **Never.** AI maps names; the app counts | Repeatable, checkable, offline |
| Free text as the only way | **No. Keep the one-tap session as the quick path** | Most days are "gym, 45 min" |
| Strength calories from weight lifted | **No. From time and effort** | §2.1 |
| Several sessions a day | **Yes, as a list** | Morning run plus evening gym is common |
| Lifting progress view | **Yes, simple: best set and last time** | The reason a lifter would bother with sets and kg |
| Strength-day scoring change | **Leave for later** | Changes the score for everyone; deserves its own look |

---

## 6. Phases

| Phase | Work | Outcome | Size |
|---|---|---|---|
| **1. List and library** | `workout_items`, the summary fields derived from it, the local exercise library, structured rows with editable minutes and effort, steps double-count fix | Any exercise, several a day, right calories from METs. No AI | Medium |
| **2. Free text** | Local parser for sets×reps, kg, min, km; aliases; "~6 min" estimates | Type a whole workout in one line | Small |
| **3. AI for unknowns** | Name-to-library mapping with schema, validation and saved matches; Settings list of learned exercises | Varied, personal names understood once | Small |
| **4. Lifting progress** | Last time, best set, repeat session, saved routines | The log is worth keeping | Small to medium |

Phase 1 is useful without any AI, and works offline.

---

## 7. Testing

- **Parser:** a table of real inputs ("bench 3x10 5kg", "BP 3*10*5", "3 sets of 12 squats 40 kg", "run 5k 28 min", "yoga 1hr", "football", typos) against expected rows.
- **Calories:** the same row always gives the same kcal; Walking or Running with steps adds nothing; device calories replace everything.
- **Compatibility:** every place that reads `exercise_done`, `exercise_type` and `exercise_duration_minutes` gets the same values from a list as from the old single session. Old backups restore.
- **AI:** an unknown library id is rejected; calories in a reply are ignored; no key leaves the parser and library working.
- **Scoring:** the same day scores the same before and after, for days logged the old way.

---

## Sources

Checked 2026-11-18.

- METs and the (MET − 1) × kg × hours method: 2024 Adult Compendium of Physical Activities, already used in `services/energy.js`. Its resistance-training entries cover lifting as a session by effort, not per exercise. The exact codes for the new library need looking up when it is built.
- The lifting-energy figures in §2.1 are my own calculation: mass × g × 0.45 m × reps × sets, at about 22% muscle efficiency, a common textbook range (20 to 25%), stated from general knowledge.
- Between-person spread of 20 to 30% around Compendium values: general knowledge, not re-read for this plan.

---

## How it was built

| Plan | Built | Why |
|---|---|---|
| Walking, running, hiking and stairs count through steps when steps cover them | The session counts, **less** the part the step counter already counted (its cadence × minutes, out of the day's steps above 2,500) | Counting a run only as steps would value it as a walk, about half its cost. Taking out the overlap avoids double counting and keeps the run's real cost. A walk fully covered by steps adds about nothing, as before |
| Exercises inside a session share its time | A lift with only an estimated time, on a day with a whole session (Gym, Circuit, Bodyweight), adds no minutes or calories of its own and shows "Part of your session" | One rule, no double counting, and "gym 50 min: bench…, squats…" totals 50 minutes |
| AI for unknown names | Called when **Add** is pressed and a name is not recognised, only with an AI key. Without one, or if a name is still unknown, the row asks to pick from the list. Names picked by hand are remembered too | The tap is the user's request, as with "Ask AI" for foods |
| About 80 activities | 65: 3 whole sessions, 28 lifts and bodyweight exercises, 4 step-based, 13 cardio, 13 sports, 4 flexibility | Covers the common cases. Anything else is learned once |
| Lifting progress | Last 4 sessions and the best set in each lift's row, a "New best" message, Repeat last workout, and saved routines | As planned. A chart over time is left for later |

Files: `services/exerciseLibrary.js`, `services/workoutItems.js`, `components/ExerciseLog.jsx` (on Log → Move), `components/ExerciseSettings.jsx` (Settings → Your exercises), the AI mapping in `services/llmApi.js`. The old single-session fields are filled by `summarise()` on every save. The Excel export has a new Exercises column, and the AI health summary names the exercises.

### MET values to confirm

The library's METs are the Compendium's as I know them, not re-read for this build. They need checking against the 2024 Adult Compendium before they are relied on. The six activities from before keep their existing values.

### Checked on the emulator

"gym 50 min: bench 3x10 60kg, squats 3x8 80kg, 20 min cycling, kalari 30 min" gave a 50-minute gym session with the two lifts inside it, 20 minutes of cycling, and "kalari" flagged as not recognised. Picking Martial arts saved it as a learned name. One tap added Badminton, "Push day" saved as a routine, and the old fields followed the list (done, Gym, 145 minutes).

### Tests

`workoutItems.test.js` (35): the parser on real inputs, matching and typos, estimated times, calories that stay the same and ignore the weight lifted, sessions, steps overlap, device calories, the old fields and scoring for old days, the AI reply check, and lifting progress.

### Not checked

A real phone, the AI lookup against a live provider (no key on the test device), and the MET values (above).

