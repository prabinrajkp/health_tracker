# Widgets — Plan

A family of small home-screen widgets, each with one job: some to show something, some to log something. All of them use the app's current look, in both light and dark.

**Status:** phases 1 to 4 built in v4.38: all eight widgets, the inbox, theme matching and Settings → Widgets. Phase 5 (Usual meal) is not built, as planned. This replaces `widget.md`, the RPG widget specification, which has been removed. See [How it was built](#how-it-was-built) for where the build differs from this plan.

---

## Verdict

**Start again. Replace the one do-everything widget with eight focused ones, and redo the design from the app's own theme.**

| Goal | How |
|---|---|
| A widget for each purpose | Four to show something: Today, Week, Calories, Goals. Four to log something: Drinks, Sleep timer, Quick log, Weight |
| Logging without opening the app | A small "inbox" that keeps taps until the app next opens. See section 3 |
| Matches the current theme | Colours generated from `index.css`, following the app's Light, Dark or System choice |
| Honest about time | Yesterday's score never shows as today's, at any size |

Three decisions shape the rest:

1. **The widget never calculates a score.** Scoring lives in the app's JavaScript and the data lives in the WebView's database, which Android code cannot read. So widgets log only what is safe to keep and hand over later, and they say plainly when a score is still to update.
2. **Drinks and the sleep timer come first for logging.** Drinks are not part of the score, so a tap can show its full effect immediately. The sleep timer needs nothing but a time. These are also the two most frequent actions on Today.
3. **Stay with Android's standard widget system (`RemoteViews`) and Java.** It matches the existing code and adds nothing to the app's size. Jetpack Glance would bring in Compose, and the app has no Compose today.

---

## 1. What is wrong with the current widget

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | **Ignores the theme** | `widget_bg.xml`, `widget_health_quest.xml` | Always dark purple (`#150E2B`) with a violet border. That palette was removed from the app in the UI revamp, and light mode is not supported at all |
| 2 | **Uses a game the app no longer has** | `HealthQuestWidget.java:107-116` | LEGEND, CHAMPION, WARRIOR tiers exist nowhere else in the app. The comment says they match `Dashboard.jsx`, which is gone. The app uses grades S to F |
| 3 | **Yesterday's score looks like today's** | `HealthQuestWidget.java:46-62` | The app writes a date and the widget never reads it. All morning, it shows yesterday's score as if it were current |
| 4 | **The refresh button does not refresh** | `HealthQuestWidget.java:97-101` | The ↻ button and the background both just open the app |
| 5 | **Too small to read** | `widget_health_quest.xml` | 8 and 9sp text, with an italic line at about one third opacity. The app's own minimum was raised after the UI critique |
| 6 | **Emoji as icons** | `HealthQuestWidget.java:80-82` | The UI critique removed these from the app because they look different on every phone and cannot be tinted |
| 7 | **A chart that says little** | `drawRadar` | A 3-point radar labelled W, D and S takes most of the space. Fasting and calories are missing, so the numbers do not add up to the score shown |
| 8 | **Slow to update** | `MainActivity.java`, `useStore.js` | It only redraws 3 seconds after the app resumes, or every 30 minutes. Log something, leave, and the widget stays behind |
| 9 | **Wrong on a sick day** | `useStore.js:16` | With no score, nothing is written, so yesterday's score stays up. This is the widget part of `sick_days_plan.md` phase 4 |
| 10 | **One size, display only** | `widget_health_quest_info.xml` | A 4×3 block with no small version, no way to log anything, and no proper preview in the widget picker |

---

## 2. The widgets

Android groups widgets into information, control and hybrid types, and advises building around one type. Each widget here has one main job, and tapping it goes straight to the matching screen. Sizes are home-screen cells, and each widget changes layout as it is resized.

### To show something

#### Today (replaces the current widget)

The score at a glance, and what to do next.

```
2×1                 2×2                  4×2
┌──────────────┐    ┌──────────┐    ┌──────────────────────────┐
│ 72    B·Great│    │ 72 /100  │    │ 72 /100         B · Great│
└──────────────┘    │ B · Great│    │ Diet     ▓▓▓▓▓▓░░   24/35│
                    │          │    │ Fasting  ▓▓▓▓░░░░    6/10│
                    │ Log lunch│    │ Workout  ▓▓▓░░░░░   15/35│
                    │ 8 pts  › │    │ Sleep    ▓▓▓▓▓▓▓░   27/30│
                    └──────────┘    │ Next: log lunch · 8 pts ›│
                                    └──────────────────────────┘
```

The next step opens that exact action. The fasting bar is left out for anyone with fasting points off. It keeps the existing class name, so a widget already on someone's home screen upgrades in place and does not vanish.

#### Week

How the week is going, without opening Progress.

```
4×1                                  4×2
┌────────────────────────────┐   ┌────────────────────────────┐
│ M  T  W  T  F  S  S     71 │   │ This week    71   +3 vs last│
│ ●  ●  ●  ○  ·  ·  ·     avg│   │ M  T  W  T  F  S  S         │
└────────────────────────────┘   │ ●  ●  ●  ○  ·  ·  ·  12 days│
                                 │ To fix: earlier dinners    ›│
                                 └────────────────────────────┘
```

Dots use the same four score colours as the Progress calendar. A sick day is a small dash, so it does not read as a missed day.

#### Calories

Food against target, in the words that suit the goal.

```
2×2                 4×1
┌──────────┐    ┌───────────────────────────────┐
│ 1,420    │    │ 1,420 / 2,652   1,232 to go  ›│
│ of 2,652 │    └───────────────────────────────┘
│ ▓▓▓▓▓░░░ │
│ 1,232 to │
│ go       │
│ Net ~−390│
└──────────┘
```

Follows the body goal: "left" and "over" for Lose, "to go" and "Goal reached" for Gain. With calorie numbers hidden in Settings, it shows a short message and no figures. Net is shown only at the larger size, marked as an estimate like everywhere else.

#### Goals

The game part of the app: level, streak and what is left today.

```
2×2                 4×2
┌──────────┐    ┌──────────────────────────────┐
│ Level 7  │    │ Level 7  ▓▓▓▓▓▓░░░░   12 days│
│ ▓▓▓▓▓░░░ │    │ ✓ Log breakfast        +10 XP│
│ 12 days  │    │ ○ Walk after dinner    +15 XP│
│ 2 of 4   │    │ ○ Log sleep            +10 XP│
│ goals    │    └──────────────────────────────┘
└──────────┘
```

At most three goals, unfinished first. Scrolling lists are possible on Android, but the point is a glance.

### To log something

#### Drinks

One tap, a glass of water. It updates at once.

```
1×1          2×1                  2×2
┌──────┐   ┌────────────────┐   ┌──────────────┐
│  ▟▙  │   │ ▟▙ 1.2 of 2.1 L│   │ ▟▙ 1.2 of 2.1│
│ 1.2 L│   │    + Glass     │   │    + Glass   │
└──────┘   └────────────────┘   │ 500 mL   Undo│
                                └──────────────┘
```

The same tapered glass as Today, filled the same way, with the same tick at the goal. It uses the glass size from Settings, and on a sick day it shows the total with no goal. Tapping past the goal still works and earns nothing extra, as in the app.

#### Sleep timer

The one button you asked to bring to the home screen, now on the phone's home screen too.

```
2×1                       4×1
┌──────────────────┐   ┌────────────────────────────────┐
│ ▶ Going to sleep │   │ ■ Wake up — stop    6:42:10    │
└──────────────────┘   │   since 11:05 PM               │
                       └────────────────────────────────┘
```

Starts and stops without opening the app. While running, the clock ticks by itself using Android's `Chronometer` view, so it costs no updates or battery. After stopping, it says "Saved. Score updates when you open the app."

#### Quick log

The bottom row of Today, on the home screen. It opens the app on the right screen.

```
4×1
┌────────────────────────────────────┐
│  Meal      Move     Sleep    Weight│
│ 1 of 3    4.2k     ✓ 7h      ✓ 72  │
└────────────────────────────────────┘
```

Meal opens Add Meal on the meal that fits the time of day. This needs nothing beyond the links the app already has, which makes it the easiest of the eight.

#### Weight

Log it and see where it is heading.

```
2×1                    3×2
┌──────────────────┐   ┌─────────────────────┐
│  −   72.4   +  ✓ │   │ 72.4 kg  7-day 72.6 │
└──────────────────┘   │ ╲__╱‾‾╲____   to 70 │
                       │  −   72.4   +     ✓ │
                       └─────────────────────┘
```

Widgets cannot show a keyboard, so it starts at the last weight and steps by 0.1 kg. That suits daily use, since weight moves little from one day to the next. A bigger change is one tap away in the app. The chart line and colours follow the body goal, as on the Weight screen.

### One more, if wanted later

**Usual meal (4×1):** "Usual lunch: dal, rice · Log · Other". One tap logs your most frequent meal for this time of day. It saves the most effort, but it logs food unseen, and the score cannot update until the app opens. Left until the rest has been used for a while.

### Considered and left out

| Idea | Why not |
|---|---|
| RPG character | The app moved on from it, and it is the thing you disliked |
| Radar chart | Bars say the same more clearly in less space |
| Refresh button | Nothing to refresh if the widget is always current |
| Live step counter | Steps would need new background reading from Health Connect. Quick log shows the last synced count |
| Lock-screen widgets | Weight and calories should not sit on a locked phone |

---

## 3. How logging works without opening the app

This is the hard part. The app's data sits in the WebView's IndexedDB, and Android code cannot read or write it. The AI nudges plan hit the same limit.

| Option | Verdict |
|---|---|
| Open the app for every tap | Fine for Quick log. Defeats the point for a glass of water |
| Move all data to native storage | A rewrite of the whole data layer. Far too large for this |
| Run the app's JavaScript in the background | A background runner gets its own JS context and cannot reach this database either |
| **Keep the tap, and hand it over at next open** | **Recommended.** Small, safe, and nothing is lost |

### The inbox

```
Tap on widget
    │
    ▼
Android code adds a line to widget_inbox.json
{ id, type, at, date, value }
    │
    ▼
Widget redraws at once, adding waiting items to what it knows
    │
    ▼  next time the app opens or returns
App reads the inbox, writes each item to the database
    │
    ▼
App confirms, and only then are those items removed
```

| Rule | Why |
|---|---|
| Every item has its own ID, and applied IDs are remembered | A crash between writing and confirming cannot log a drink twice |
| Items are removed only after being written | A crash cannot lose one |
| Each item keeps its own time and date | A glass tapped at 11 PM belongs to that day, even if the app opens the next morning |
| Applied in time order | Start, then stop, gives the right sleep |
| Widget totals are the last published value plus waiting items | The count is right at once, and does not jump when the app opens |

### What each one does

| Item | Before the app opens | When the app opens |
|---|---|---|
| Glass of water | Total and glass update fully. Drinks are not scored, so nothing is left out | Added to that day's drinks |
| Sleep timer start | Clock runs | Timer state set from the saved time, so Today shows it running |
| Sleep timer stop | "Saved. Score updates when you open the app" | Night saved with the saved times. `stopSleepTimer` gains a time argument. Screen time is worked out then, for that range |
| Weight | New weight shows, with the score unchanged | Saved, then the score recalculates, since weight can move the calorie target |

**The notification catch.** If you start the timer from the widget, the app does not know, so the bedtime reminder could still arrive. The app therefore passes the widget the IDs of tonight's bedtime and morning-timer notifications, and the widget cancels them when the button is pressed.

---

## 4. Matching the theme

### Same rules as the app

From `index.css` and `ui_critic.md`:

| App rule | On widgets |
|---|---|
| Near-neutral surfaces, so colour always means something | Background is `surface-card`, solid. No glass, no glow, no gradient |
| One accent, for the main action | `brand` only on the one main button or link. So at most one per widget |
| Status colours have one meaning each | `success`, `warning` and `danger` only for good, caution and cost |
| Category colours are for bars and charts only | The four bars on Today. Never numbers or headings |
| Light mode has a border, dark mode separates by brightness | Same: a 1dp `surface-border` line in light, none in dark |
| One icon set | The same Lucide icons, turned into Android vector drawables. Lucide's ISC licence allows this |
| No emoji as icons | None |
| Grade chip | Same tinted chip as Today: the tone colour at 14% behind the letter |
| Numbers | Tabular figures, large and plain |

### One source of colours

Copying colours by hand is how the current widget fell behind. A small script reads the tokens from `index.css` and generates the Android colour files, run as part of the build, so a change to the app's theme reaches the widgets by itself.

| Token | Dark | Light |
|---|---|---|
| Card | `#181A20` | `#FFFFFF` |
| Raised tile, bar track | `#22252D` | `#EDEDE9` |
| Text | `#ECEDF0` | `#17181C` |
| Secondary text | `#B6BAC4` | `#474A52` |
| Accent | `#7C8CF8` | `#4353D6` |
| Water | `#56A8E2` | `#267EC4` |

### Following Light, Dark and System

The app has three settings, and Android widgets only follow the phone by default.

| App setting | How the widget follows |
|---|---|
| **System** | Colours come from `values` and `values-night` resources, so the launcher switches them with the phone, even at a scheduled sunset, with no update needed |
| **Light or Dark, matching the phone** | Same as above |
| **Light or Dark, different from the phone** | The widget code sets each colour directly when drawing |

Changing the theme in the app redraws all widgets immediately. Charts are drawn as a one-colour shape and then tinted, so they switch along with everything else.

**Wallpaper colours (Material You) are not used.** Android 12 offers them and many widgets adopt them, but you asked for the app's theme, and the app has its own accent.

### Text and shape

- **Font:** text uses the phone's system font. I could not confirm that a widget can use the app's bundled Inter, and `RemoteViews` has no font setter. Drawing text as images would break font scaling and screen readers, so it is not worth doing. The system font is close enough on most phones, though this is the one visible difference from the app.
- **Sizes:** nothing under 12sp. Large number at about 32sp, labels at 13 to 14sp, matching the app's type scale.
- **Corners:** the system's widget corner radius on Android 12 and later, so the widget sits well beside others, and 16dp below that. Buttons and bars inside use the app's 12dp and full round. To confirm on a phone.
- **Touch targets:** at least 48dp, with the system ripple as feedback.
- **Screen readers:** every button gets a description, such as "Add a 250 mL glass of water". State is never shown by colour alone: the grade letter and the tick carry it.

---

## 5. Keeping widgets up to date

### What the app sends

The current file holds eight numbers. A new versioned file holds everything the widgets need, written in one safe step.

```json
{
  "v": 2, "date": "2026-11-02", "at": 1793600000000,
  "theme": "system", "sick": false, "hideCalories": false,
  "score": { "total": 72, "grade": "B", "label": "Great", "tone": "brand",
             "bars": [{ "key": "diet", "value": 24, "max": 35 }] },
  "next": [{ "from": "12:00", "label": "Log lunch", "impact": 8, "route": "/?meal=lunch" }],
  "week": { "avg": 71, "change": 3, "fix": "Earlier dinners", "days": [{ "tone": "success" }] },
  "calories": { "eaten": 1420, "target": 2652, "goal": "gain", "net": -390, "partial": false },
  "goals": { "level": 7, "xpShare": 0.6, "streak": 12, "today": [{ "label": "Log lunch", "xp": 10, "done": false }] },
  "drinks": { "ml": 1200, "goalMl": 2100, "glassMl": 250 },
  "sleep": { "startedAt": null, "lastHours": 7 },
  "weight": { "latest": 72.4, "avg7": 72.6, "target": 70, "direction": "down", "trend": [72.8, 72.6] },
  "steps": 4200,
  "notifications": { "onTimerStart": [61], "onTimerStop": [75] }
}
```

**`next` is a list by time of day.** `computeNextAction` already accepts any time, so the app works out the rest of today in advance. The widget picks by the clock, and "log lunch" does not linger into the evening with the app closed.

**The widget needs no scoring logic.** Grade, tone and targets arrive already worked out, so the rules stay in one place.

### When it updates

| Trigger | What happens |
|---|---|
| Anything logged or changed in the app, once the app settles | Widgets redraw directly through a new plugin, not 3 seconds after the next resume |
| Tap on a widget | That widget and any others affected redraw at once |
| Date changes | Alarm just after midnight, not exact, and only while a widget is placed |
| Time passes | `updatePeriodMillis` set to 1 hour on Today, for the next-step list, and 0 on the rest. Android's minimum is 30 minutes |
| Reboot or launcher restart | Standard update, drawn from the saved file |

Scheduling is by `AlarmManager`, not WorkManager. Enqueuing WorkManager work from a widget's `onUpdate` is a known cause of endless update loops, and the app now includes WorkManager for background nudges. The rule is that widget code never enqueues work.

### Never showing stale data as current

| Widget | When the saved date is not today |
|---|---|
| Today | "Nothing logged yet" and no score |
| Week | Dots stay, today's dot empty, and the average is marked "last updated" |
| Calories | 0 eaten, against the last target |
| Goals | Level and streak stay, and goals show "Open the app to see today's" |
| Drinks | 0, then counts from the inbox |
| Sleep timer | Unaffected. A timer running past midnight is normal |
| Quick log | All "Not yet" |
| Weight | Last weight stays, since it is correct as last known |

### Sick day

Today shows "Sick day. Rest up." and no score. Drinks has no goal. Calories and Goals stay neutral. Week shows the dash. This finishes the widget part of `sick_days_plan.md`.

---

## 6. Finding and adding them

Most people never discover widgets, and the picker alone would hide eight of them.

- **Settings → Widgets:** a short list with a preview of each and an **Add** button that places it on the home screen, using Android's pin-widget request. Some launchers do not support this, so the screen also gives the manual steps.
- **Picker:** each widget gets a clear name, a one-line description and a live preview. Android 12 and later use a preview layout, and older versions an image.
- **Tapping:** routes go through the same tap handling added for nudges, whether the app is closed or in the background.

---

## 7. What changes in the code

| Change | File |
|---|---|
| Tokens to Android colours | new `scripts/gen_widget_colors.mjs`, generating `res/values/` and `res/values-night/widget_colors.xml` |
| Build the data file | new `services/widgetData.js`, with tests. Replaces `writeWidgetData` in `store/useStore.js` |
| Publish, read inbox, confirm, pin a widget | new `WidgetsPlugin.java`, `services/widgetInbox.js` |
| Shared reading, date rules, colours, tap links | new `WidgetState.java`, `WidgetPalette.java`, `WidgetInbox.java` |
| Rebuilt Today, same class name | `HealthQuestWidget.java`. Remove `drawRadar` and the tiers |
| One provider for each new widget | new `WeekWidget`, `CaloriesWidget`, `GoalsWidget`, `DrinksWidget`, `SleepWidget`, `QuickLogWidget`, `WeightWidget` |
| Layouts for each size, and metadata | `res/layout/`, `res/xml/`, with previews |
| Icons | Lucide icons as vector drawables in `res/drawable/` |
| Timer with a given time | `services/sleepTimer.js` |
| "Meal for this time of day" link | `pages/Today.jsx` |
| Refresh after an inbox item | `App.jsx`, before the notification plan runs |
| Settings → Widgets | new `components/WidgetSettings.jsx`, `pages/Settings.jsx` |
| Providers and receivers | `AndroidManifest.xml` |
| Download page and README | `index.html`, `README.md` |

**Size:** mostly layouts and small classes. No new libraries, apart from what the colour script needs at build time. The old radar code comes out.

---

## 8. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| How many widgets | **8, with Usual meal later** | One job each, and people only add what they want |
| Entries with a score effect from a widget | **Yes, with a plain note that the score updates on open** | The alternative is opening the app for every sleep or weight entry |
| Log meals from a widget | **Open Add Meal for now** | Food needs choosing and portions. Usual meal can come later |
| Follow the app's theme or wallpaper colours | **The app's theme** | What you asked for, and it keeps meaning in the colours |
| Background | **Solid card, not see-through** | Text stays readable on any wallpaper, and the app has no transparency anywhere |
| Weight and calories on the home screen | **Allowed. Adding one is the choice** | Hidden calorie numbers are honoured everywhere. Anyone can see a home screen, so this should stay in the widget's description |
| Older phones | **Same widgets on Android 8 and up, simpler resizing below Android 12** | The app's minimum is Android 8 |
| Emulator for testing | **Install one in phase 1, and keep using your phone too** | None is installed on this machine, and widgets cannot be checked in a browser |

---

## 9. Limits to be honest about

- **Scores wait for the app.** A sleep or weight entry from a widget cannot change the score until the app opens. This is the biggest compromise, and the reason for the plain note.
- **Launchers differ.** Cell sizes, corners, resizing and pinning vary by brand. A layout that fits on one phone may need checking on another.
- **Reduced animation.** Widgets get ripples and redraws, not the app's smooth filling glass.
- **Font.** See section 4.
- **Android can delay the midnight update** on a sleeping phone. The date is checked at every draw, so the worst case is a short delay, and old data is still never shown as today's after any update.
- **Eight widgets is a lot of layouts.** Each size is a separate file to design and check, in two themes. This is why the phases below let you stop early.

---

## 10. Phases

| Phase | Work | Outcome | Size |
|---|---|---|---|
| **1. New base, new Today** | Colour script, palette, data file, plugin, date and sick rules, rebuilt Today at three sizes, previews, emulator | The widget you disliked is gone, and it matches the theme | Medium |
| **2. Log from the home screen** | Inbox, Drinks, Sleep timer, Quick log, notification cancelling, Settings → Widgets | The everyday logging works without opening the app | Medium |
| **3. More to see** | Week, Calories, Goals | The display family is complete | Small to medium |
| **4. Weight** | Stepper, trend chart, score-pending note | Scored logging from a widget | Small |
| **5. Usual meal (optional)** | One-tap frequent meal | Decide after living with the rest | Small to medium |

Each phase can ship alone. After phase 1 and 2, the most useful part is done.

---

## 11. Testing

- **Data file:** unit tests for every section, with a sick day, no weigh-ins, hidden calories, fasting off, and each body goal.
- **Next-step list:** the right step at each hour, against `computeNextAction`.
- **Inbox:** applying twice logs once. A crash before confirming loses nothing. Items keep their date across midnight. Start and stop apply in order. An old inbox with an unknown type is skipped, not fatal.
- **Date rules:** each widget's stale state, with a saved date of yesterday and of last week.
- **Colour script:** the output matches `index.css`, and the build fails if a token is missing.
- **Contrast:** check every text and background pair at 4.5:1 or better in both themes, the same bar the app set.
- **On an emulator and a real phone, none of this works in a browser:**
  - Every widget, at every size, in light and dark. Screenshots of each go in the release notes.
  - Phone in dark with the app forced to light, and the reverse. Switching the phone's theme with the app on System.
  - Tap water 5 times with the app closed, then open: exactly 5 entries.
  - Start the timer from the widget at night: no bedtime reminder. Stop it in the morning, open the app: the night is saved with the right times.
  - Leave the phone past midnight: yesterday's score is gone.
  - Upgrade from the current version with the old widget already placed: it stays and turns into the new one.
  - Reboot, launcher change, largest font size, and a brand other than your own, if possible.

---

## Sources

Checked 2026-11-02. Parts of the Android pages were read through a summary, and the items marked "to confirm on a phone" above come from my own knowledge of Android or could not be confirmed from these pages.

- [Android: widgets overview, types and gestures](https://developer.android.com/develop/ui/views/appwidgets/overview)
- [Android: build a basic widget](https://developer.android.com/develop/ui/views/appwidgets)
- [Android: flexible widget layouts](https://developer.android.com/guide/topics/appwidgets/layouts)
- [Android: enhance your widget](https://developer.android.com/develop/ui/views/appwidgets/enhance)
- [Android: advanced widgets, update limits](https://developer.android.com/develop/ui/views/appwidgets/advanced)
- [Android: widget previews](https://developer.android.com/develop/ui/views/appwidgets/previews)
- [Android: RemoteViews reference, including Chronometer](https://developer.android.com/reference/kotlin/android/widget/RemoteViews)
- [CommonsWare: WorkManager and app widget side effects](https://commonsware.com/blog/2019/01/15/workmanager-side-effects-follow-up.html)

---

## How it was built

Checked on an Android 14 emulator with the stock launcher (Launcher3), using the release build and real taps on the home screen.

### Where the build differs from the plan

| Plan | Built | Why |
|---|---|---|
| Today at three sizes | **Four.** A short row size: score, grade and the next step on one line | Launcher3's single row is 137dp tall but two cells are only 145dp wide. The 2×2 layout was cut off at 2×1 |
| Weight at two sizes | **Three.** A narrow one with the value above its buttons | At two cells the value was squeezed to "…" between three buttons |
| Grade chip: the tone at 14% | Same look, drawn by fading a solid tone to 14% | Android's tint mixes a see-through colour onto the white shape, which gave an opaque pale pill in dark mode |
| Border in light mode only | On System, the launcher colours the border itself | A transparent tint leaves the white edge showing. In dark mode it showed as a pale ring |
| Midnight alarm, not exact | A 10-minute window | Android gave the plain alarm a 30-minute window, so yesterday's score could stay up until 00:30 |
| One colour script | **Two scripts:** colours, and Lucide icons as vector drawables | Both run before every build (`npm run widgets:res`) |
| Next step by time of day | Worked out for every half hour left today, plus a second list for a timer started or stopped on the widget | The app's own sleep steps stop applying once the widget changes the timer |
| Widget Undo | Undo takes back a glass still waiting in the inbox at once. For one the app already saved, it leaves an undo item for the app | The widget cannot remove an entry from the app's database itself |
| Bedtime reminders cancelled | Also the morning "timer still running" reminder, when stopped on the widget | Same reason, the other way round |
| Picker previews | Android 12+ draws the layout itself. Older phones get images drawn from the same layouts by a test | Bars and the glass have a sample fill in the layout, since a preview runs no code |
| Files in §7 | `WidgetStore` (data file and inbox), `WidgetState`, `WidgetPalette`, `WidgetKit`, `BaseWidget`, one provider per widget, `WidgetActionReceiver` (buttons), `WidgetTicker` (redraw alarm), `WidgetsPlugin` | `WidgetInbox.java` became part of `WidgetStore`, so the data file and the inbox share one lock |

### Verified on the emulator

- The old widget, already placed, turned into the new Today widget on upgrade without the app being opened.
- **Settings → Widgets → Add** placed each of the eight through the launcher's own dialog, with its preview and description.
- Five taps on Drinks with the app closed: the widget showed 1.75 L at once, and opening the app wrote exactly five entries, each with its tap time, and emptied the inbox.
- Timer started on the widget at 23:20 cancelled that night's 23:05 bedtime alarm and kept the next nights'. It ran past midnight. Stopped at 06:50, the widget said "Saved 7h 30min. Score updates in the app", and opening the app saved the night as 23:20 to 06:50 on the wake-up date.
- Weight stepped from 80.8 to 81.0 and saved: Quick log showed it at once, and the app saved it and recalculated the score on opening.
- Undo: a glass still waiting left the inbox; a saved glass was removed when the app opened.
- After midnight: Today showed nothing logged, Drinks 0, Quick log all "Not yet", Week today's dot empty and the average marked "avg, Thu", Goals asked to open the app, Weight kept the last weight.
- App forced to Dark on a light phone: all widgets dark. App on System, phone switched to dark with the app not running: every widget switched, border included.
- Quick log → Meal at 06:52 opened the app from cold on Add Meal, Breakfast.
- No publish loop: the data file stays the same while the app sits idle.

### Tests

- `widgetData.test.js` and `widgetInbox.test.js` (27 tests): the next step at every hour against `computeNextAction`, sick day, no weigh-ins, hidden calories, under-18, fasting off, each body goal, applying twice, a crash before the applied list is saved, dates across midnight, start then stop, unknown items.
- `WidgetStateTest` (9, on a device): stale dates, waiting glasses, undo, the timer, the step by the clock, weight, formats.
- `WidgetRenderTest` (on a device): draws every widget at every size it can be resized to, on two cell grids, in seven states and four themes, into PNGs for checking by eye. These tests are not part of the app.

### Not checked

- **Android 8 to 11.** Only an Android 14 image is installed. Those versions take the older code path: layouts picked from the reported size, and colours set when drawn, so a phone theme change shows at the next redraw rather than at once.
- A real phone, other launchers and brands, the largest font size, and a reboot.
- On the narrowest sizes, the Weight widget has no room for the "Score updates in the app" note. The tick turning green is the only sign there.

