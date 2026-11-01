# Sick Days — Plan

How the app should treat days when you are unwell and in no mood to log anything.

**Status:** phases 1 and 2 are implemented in v4.35. The notification part of phase 4 is built with the AI nudges work (`ai_nudges_plan.md`): a sick day cancels everything booked, with one note the next morning. The widget part of phase 4, and phase 3, are not. JSON backup of sick days, from phase 3, was brought forward, because a new table left out of backups would be lost on restore.

---

## Verdict

Add a **sick day**: one tap marks the day, and the app then treats it as if it never counted. It adds no score and no XP, it does not pull down your averages, and your streak pauses rather than breaks.

Three principles shape the design:

1. **It must take almost no effort.** Someone who is ill will not fill anything in. Marking is one tap with no form.
2. **It must work when you never opened the app.** That is the most likely case. So when you come back, the app offers to mark the days you missed.
3. **A sick day is set aside, not rewarded.** It earns nothing and it costs nothing. The score stays honest.

---

## 1. What happens today

I checked how the code treats a day with nothing logged. There are two different outcomes, and neither is good.

| | You open the app that day | You never open the app |
|---|---|---|
| Score row for the day | **Created, near 0**, because loading Today calculates and saves a score | None |
| Weekly and monthly averages | **Pulled down** by the near-zero day | Not affected |
| "Days logged" | **Counts** as logged | Does not count |
| Streak on Today | Resets to 0 | Resets to 0 |
| Streak badges | Broken | Broken |
| First-day-back notification | "You were doing well. Restart today" is possible | Same |

So opening the app just to check something while ill makes your numbers worse than staying away. One bad week of flu also wipes a long streak, and that is often when people give up on a tracker for good.

**A related problem to fix along the way:** the app has three separate streak definitions. The one on Today needs a score of 60 or more, the badge streaks need 50 or more, and the one behind the "longest run" figures only needs a day to have been logged. Sick days have to work with all three, so they should share one helper.

---

## 2. How a sick day behaves

| Area | Behaviour |
|---|---|
| Daily score | None for that day. Whatever you logged is kept, but not scored |
| Streak | Paused. 12 days, then 2 sick days, then a good day, gives 13 |
| Averages (week, month, all time) | Left out, as if the day were not in the calculation |
| "Days logged" | Not counted, but shown separately ("5 logged, 2 sick") |
| XP and level | None earned, none lost |
| Badges | Earned badges are never taken away. Sick days neither count toward nor break a badge streak |
| Weekly goals | "Log 5 days" and "Breakfast 5×" shrink with sick days: at most 7 minus the sick days that week |
| Today's goals | Replaced by a rest message |
| Reminders and nudges | Quiet. See section 5 |
| Drinks | Still loggable, but with no goal. See section 6 |
| Sleep timer | Still works. Sleep is saved, not scored |
| Weight | Still loggable. Not excluded from the weight trend |
| Calendar | A thermometer icon instead of a score dot |
| Excel and backup | Included. Older backups still restore |

---

## 3. Marking a sick day

There are three ways in, for three situations.

### 3.1 On the day: one tap on Today

A small "Not feeling well?" link sits on the date line at the top of Today. Today currently fits one screen exactly, so this must not add height.

```
Sunday, Nov 1 · Not feeling well?
Hi, Prabin
```

Tapping it marks the day straight away, with an **Undo** in the confirmation message. There is no dialog and no form.

Today then becomes much calmer:

```
Sunday, Nov 1
Hi, Prabin

     Sick day
     Rest up. Nothing to log today,
     and your 12-day streak is safe.

     I'm feeling better

┌─ Drinks ───────────────────────────┐
│ 0.5 L                     + Glass  │
└────────────────────────────────────┘
[ Going to sleep — start timer ]

[Meal] [Move] [Sleep] [Weight]
```

The score, the bars, the Next card and any penalty are hidden. The log buttons stay, in case you do want to record something.

### 3.2 The next morning: "Still unwell?"

If yesterday was a sick day, a one-line card replaces the Next card: **Still unwell?** with **Yes, rest today too** and a dismiss option. Each day is a separate choice, so being better needs no action at all.

### 3.3 Coming back: the catch-up prompt

When you open the app after days with nothing logged:

```
┌────────────────────────────────────┐
│ Nothing logged on Tue and Wed.     │
│ Were you unwell?                   │
│                                    │
│ [ Mark as sick days ]   [ No ]     │
└────────────────────────────────────┘
```

- It covers the unbroken run of empty days just before today, up to 7 days back.
- A day counts as empty if it has no meals, no sleep and no exercise logged. Steps alone do not count, because they sync automatically.
- It appears once for each gap. **No** is remembered.
- Because streaks are worked out live from history, marking these days restores the streak immediately.

### 3.4 Any past day: the calendar

Progress → Month currently disables days with no score. Past days become tappable, and open a small sheet with **Mark as sick day**, or **Remove sick day** on a marked day. Removing the mark brings the day's score back from whatever was logged.

---

## 4. How it works in the code

### Data

A new `sick_days` table with one row per date: `{ date, created_at }`. Plain and separate, so removing a mark loses nothing.

### The central design choice: no score row on a sick day

| | A. No score row | B. Keep the row, add an "excluded" flag |
|---|---|---|
| Averages, XP, charts, goals, notifications | **Already correct**, since they all handle missing days | Each one must learn to skip flagged rows |
| Files to change | Few | Ten files read scores, each a chance to miss one |
| Risk of a sick day leaking into a figure | Low | High |
| Undo | Recalculated from the logs | Instant |

**Recommendation: A.** Score rows are already calculated from the logs, so nothing is lost. `recomputeScore()` is the single point every save passes through, so one check there covers everything: on a sick date, delete any row and return nothing.

Undoing recalculates with the current scoring rules. For an old day, that could differ slightly from the original score if the rules have changed since.

### What still needs changing

| Change | File |
|---|---|
| New table, plus get, mark and unmark functions | `services/db.js`, `services/localStore.js`, `api/client.js` |
| Skip scoring on sick dates | `recomputeScore()` in `services/localStore.js` |
| One shared helper: "are these two dates consecutive, ignoring sick days?" | new `services/sickDays.js`, with tests |
| Use the helper in the Today streak | `getStreakCount()` in `services/localStore.js` |
| Use it in the badge streaks | `services/badgeEngine.js` |
| Use it in the longest-run figures | `services/prestigeEngine.js`, `pages/Progress.jsx` |
| Use it in the hydration streak | `services/hydration.js` |
| Rest state, the link, "Still unwell?", the catch-up prompt | `pages/Today.jsx`, `services/nextAction.js` |
| Calendar icon, tappable empty days, the mark sheet | `pages/Progress.jsx` |
| "5 logged, 2 sick" on Week and Month | `pages/Progress.jsx`, `weeklyInsights.js`, `monthlyInsights.js` |
| Weekly goal targets | `services/questEngine.js` |
| Quiet notifications | `services/reminders.js`, `notificationEngine.js`, `trendNotificationEngine.js` |
| Export and backup, removing score rows for sick dates after a restore | `pages/Settings.jsx` |
| Home-screen widget | `store/useStore.js`, `HealthQuestWidget.java` |

**The widget:** with no score row, the widget would keep showing yesterday's score, because the app skips updating it when there is no score. It needs a simple "Rest day" state.

**Size:** small to medium. The scoring change is a few lines. Most of the work is the Today states, the calendar and testing the streak logic.

---

## 5. Notifications

The smart nudges and trend alerts are planned each time the app opens, so they are easy to skip on a sick day. The repeating daily reminders (bedtime and dinner on Standard, many more on Coach) are harder, because they fire whether or not the app is opened.

**Proposed:**

- Marking a sick day cancels the daily reminders, the nudges and the trend alerts.
- Reminders come back the next time the app is opened on a day that is not marked sick.
- One gentle notification is scheduled for the next morning: "Hope you're feeling better. Open Health Quest when you're ready." It is sent once, not daily.
- The "You were doing well. Restart today" nudge is skipped if the missed days were marked sick.
- The weekly and monthly wraps still go out, and already skip weeks with too few logged days.

**The limitation:** if you ignore that notification and do not open the app, reminders stay off until you do. Android gives the app no reliable way to turn them back on without being opened. Reminders staying quiet is the safer failure for someone who is ill, but it should be stated in the Reminders screen.

**Also unavoidable:** if you are ill and never mark the day, reminders keep firing as normal, because the app does not know.

---

## 6. Drinks on a sick day

Your water logic document lists people who are "acutely ill or experiencing substantial vomiting or diarrhoea" among those the generic goal should not be used for. So on a sick day:

- The drinks card shows the total but **no goal and no "goal reached"**. A day's goal is stored as 0.
- Logging still works.
- Water badges neither count nor break on that day.

The app should not give any advice about how much to drink when ill.

---

## 7. Problems to design for

**Using it to protect a streak.** Nothing stops someone marking an ordinary lazy day as sick. A hard limit would punish the person having the worst month, so the plan relies on visibility instead: sick days are always shown on the calendar and in the week and month counts. It is your own data, and the streak only means something if you are honest with it.

**Marking a good day.** If you logged a strong morning and then fell ill, marking the day removes its score. The confirmation says so: "Today's score is set aside. What you logged is kept." Undo restores it.

**The first day back.** Fasting is measured from yesterday's dinner to today's breakfast. After a sick day with no dinner logged, the first day back scores 0 of 10 for fasting with no explanation. The plan leaves this alone, because changing it would mean changing the scoring rules, but it is a decision in section 9.

**Bounce Back badge.** It is awarded for logging again after missing two or more days. A sick spell would still earn it. The plan keeps this, since recovering and returning is a real comeback.

**Week-long badges.** Badges such as a 7-day average need seven scored days, so a week with a sick day cannot earn them. This is fair: nothing is lost, it simply did not happen that week.

**Long illness.** The streak pause has no limit. A cap would hit exactly the people with the most serious illness.

**Weight.** A dip while ill will show on the trend. It is real data, so it stays.

**Weekly AI summary.** If the plan in `weekly_ai_summary_plan.md` is built, its digest should mark sick days as "unwell, excluded", so the AI does not read them as failures. It should send only that label, with no health detail.

**Privacy.** Illness dates are health data. They stay on the phone like everything else. The table holds dates only, with no symptoms, and no note field in this version.

---

## 8. Not included

- Symptoms, illness type or severity. Marking must stay effortless, and this is not a medical record.
- Planning future sick days, such as an operation.
- Other kinds of pause, like travel or holidays. The same mechanism could cover them later under a name like "rest day", but they have a different honesty question: a holiday is a choice, and its food still counts.
- Any health advice or detection of illness from your data.

---

## 9. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Streak on a sick day: pause, or count as a day? | Pause | Counting it would reward being ill and inflate the streak |
| A limit on sick days per month? | No limit, always visible | A limit punishes the worst months, and visibility handles misuse |
| Catch-up prompt after just one missed day? | Yes, shown once | That one day is what breaks the streak. Asking once costs little |
| How far back the prompt looks | 7 days | Older days can be marked from the calendar |
| Allow marking a past day that has logs? | Yes, from the calendar only | Falling ill partway through a day is common. The catch-up prompt only offers empty days |
| Silence reminders on sick days? | Yes, with one note the next morning | Section 5 |
| Fasting on the first day back | Leave as it is | Keeps scoring rules untouched. The alternative is to leave fasting out of that day's score |
| Merge the three streak definitions into one? | Share the sick-day helper now, and treat merging as separate | Merging would change existing streak numbers, which deserves its own decision |
| Name shown in the app | "Sick day" | Plain, and matches what you asked for |

---

## 10. Phases

| Phase | Work | Outcome |
|---|---|---|
| 1. Core | Table, scoring check, shared streak helper across all four streaks, tests | Sick days are handled correctly underneath |
| 2. Today | The link, Undo, rest state, "Still unwell?", catch-up prompt, drinks with no goal | Usable from the main screen |
| 3. History | Calendar icon and mark sheet, "5 logged, 2 sick", weekly goal targets, export and backup | Old days can be marked, and it is all visible |
| 4. Quiet | Notifications and the widget | Needs a real phone to test |

Phases 1 and 2 already solve the main problem. Phases 3 and 4 complete it.

---

## 11. Testing

- **Streak logic (unit tests):** a sick day in the middle of a streak, several in a row, one at each end, a sick day with a good score under it, and the same cases for the badge and water streaks.
- **Figures:** a week's and a month's averages match the same data with that day removed, and the near-zero row no longer appears after opening the app on a sick day.
- **Step sync:** background step sync on a sick day saves the steps but creates no score.
- **Undo:** mark and unmark a day with logs, and the score returns.
- **Catch-up:** appears for empty days only, once per gap, not for days with only synced steps, and marking restores the streak.
- **Backup:** a new backup restores with its sick days and leaves no score rows on them. An old backup restores with none.
- **Badges:** no earned badge is lost when a day is marked.
- **On a real phone:** reminders stop and return, the next-morning note fires once, and the widget shows the rest state. None of these can be tested in a browser.
