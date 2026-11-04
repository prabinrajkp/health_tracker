# In-app navigation — Critique and Plan

How moving between screens works today, why the back button feels like peeling an onion, and what it should do instead.

**Status:** all four phases built in v4.39. See [How it was built](#how-it-was-built) for where the build differs from this plan.

---

## Verdict

**Back should mean "close what is on top, then go up one level, then leave". Today it means "replay every screen I ever opened".**

| Problem | Cause | Fix |
|---|---|---|
| Back walks through every tab you visited | Each tap on the bottom bar adds a page to the history | Switching tabs replaces the page instead of adding one |
| Back cannot leave the app | With nobody listening, the Android back button does nothing once history runs out | The app handles back itself, and leaves from Today |
| Back closes the page under an open sheet | Sheets and pop-ups are not part of the history at all | Back closes the topmost sheet or pop-up first |
| Settings and Profile loop | Settings' back arrow opens Profile again as a new page | Back arrows go up to a fixed parent |
| Notifications and widgets stack on top of yesterday | A tap adds its screen on top of whatever was last open | A tap from outside starts a clean stack: Today, then the screen |

All four come from one root cause: there is no navigation model, only `navigate()` calls that each add a page, and an Android back button left to its default.

---

## 1. What exists today

### Screens and how you reach them

| Level | Screen | Reached from | Its back arrow |
|---|---|---|---|
| Tab | Today, Log, Progress, Profile | Bottom bar | none |
| Inside a tab | Log: Food, Move, Sleep. Progress: Week, Month, Trends | Buttons and swipe on the page, or `?tab=` in a link | none |
| Detail | Weight | Today's Weight button, Quick log widget, notifications | `navigate(-1)` |
| Detail | Badges | Profile → See all | `navigate(-1)` |
| Detail | Settings | Profile gear, Food → "Set up calorie targets", Net summary → "Choose a body goal" | `navigate('/profile')` |
| Section | Settings → Theme, Body, Reminders, Widgets… | Settings menu, or `?section=` in a link | `setActiveSection(null)`, or `navigate(-1)` when opened by link |
| Overlay | Add Meal, Drinks, Today in detail, nudge preview | Buttons | its own close button |
| Overlay | Badge details, the AI overlay in Settings, badge unlocked | Taps | its own close button |
| Inline | A day's detail on Progress → Month | Tapping a day | its own close button |
| From outside | Any route | Notification tap, widget tap | — |

### What the Android back button does

The app does not listen for it (no `backButton` listener anywhere). Capacitor's default, read from `@capacitor/app` `AppPlugin.java`:

```
if (webView.canGoBack()) webView.goBack();
// otherwise: nothing
```

So back always steps one page back through the WebView's history, and on the very first page it does nothing. It never closes a sheet, never knows about tabs, and never leaves the app.

---

## 2. What is wrong

| # | Problem | Where | What you see |
|---|---|---|---|
| 1 | **Every tab tap adds a page** | `components/Navbar.jsx`: `NavLink` pushes by default | Today → Log → Progress → Today → Profile, then back goes Today, Progress, Log, Today. The onion |
| 2 | **Back never leaves the app** | Capacitor default, above | After walking all the way back, back does nothing. You have to use Home |
| 3 | **Back ignores open sheets** | `components/BottomSheet.jsx`, `BadgeModal.jsx`, Settings AI overlay (`Settings.jsx:1899`, `:2030`), Progress day detail (`Progress.jsx:639`) | With Add Meal half filled, back leaves the page under it, or the app. On Android, back on a sheet is expected to close the sheet |
| 4 | **Add Meal loses work on back** | `components/AddMealFlow.jsx`: steps are state | Back from the portion step does not return to the food list. It throws the whole meal away |
| 5 | **Settings' arrow adds Profile again** | `Settings.jsx:1857`: `navigate('/profile')` | Profile → Settings → arrow → Profile → Settings → arrow… each round adds two more pages to peel |
| 6 | **Settings sections behave two ways** | `Settings.jsx:749-756` | From the menu, a section is state: Android back skips the menu and leaves Settings. From a link (`?section=body`), the arrow goes back a page. Same screen, different back |
| 7 | **Back arrows can lead nowhere** | `Weight.jsx:167`, `Badges.jsx:37`: `navigate(-1)` | Opened from a widget or notification with the app closed, there is nothing behind them. The arrow does nothing |
| 8 | **Taps from outside stack on old pages** | `App.jsx` `followTap`: `navigate(route)` | Tap a bedtime notification: back goes to whatever you had open yesterday, then everything before it |
| 9 | **A link to a tab inside Log, Progress or Settings is read once** | `Log.jsx`, `Progress.jsx`, `Settings.jsx`: `useState(() => searchParams…)` | If Log is already open on Food, a notification for `/log?tab=sleep` changes the address but still shows Food. Likely from reading the code, not yet seen on a phone |
| 10 | **The address lies after a tab change** | Log and Progress tabs are state only | Switch Log from Move to Sleep: the address still says `?tab=move`. Harmless until something reads it, as in 9 |
| 11 | **Tabs forget where you were** | Each tab remounts | Progress on Month → Today → Progress: back on Week. Log on Sleep → Today → Log: back on Food |
| 12 | **Same destination, three ways back** | Weight `navigate(-1)`, Settings `navigate('/profile')`, sections `setActiveSection(null)` | No rule a person could learn. The arrow and Android back disagree on Settings |

What already works and should stay:

- Today's `?meal=` link opens Add Meal and then removes itself from the address with `replace`, so back does not reopen it.
- Old routes (`/activity`, `/history`) redirect with `replace`.
- Drinks → Settings closes the sheet before moving.
- Swiping between Food, Move and Sleep.

---

## 3. How it should work

Android's own guidance for apps with a bottom bar: tabs are siblings, not a trail. Back from any tab returns to the start tab, and back on the start tab leaves the app. Back closes whatever is on top first.

### The rules

1. **Overlays first.** Back closes the topmost sheet, pop-up or day detail. Inside Add Meal, back steps to the previous step, and asks before discarding a meal with foods in it.
2. **Then up one level.** A section goes to the Settings menu. A detail page goes to its parent: Settings and Badges to Profile, Weight to Today.
3. **Then to Today.** Any other tab goes to Today.
4. **Then leave.** On Today with nothing open, back leaves the app.
5. **Tabs never stack.** Switching tabs, or switching Food, Move, Sleep or Week, Month, Trends, replaces the page. The history holds at most: Today, the current tab, one detail page, one section.
6. **Taps from outside start clean.** A notification or widget opens Today underneath, then its screen. Back from it goes to Today, then out.
7. **The arrow and Android back always agree.** Both use the same "up" rule.

### Where back goes, screen by screen

| On | Back goes to |
|---|---|
| Any sheet or pop-up open | Closes it, and stays on the page |
| Add Meal, past the first step | The previous step |
| Add Meal with foods picked, first step | "Discard this meal?" Yes closes, No stays |
| Settings section | Settings menu |
| Settings menu | Profile |
| Badges | Profile |
| Weight | Today, or wherever it was opened from if that was the page before |
| Log, Progress or Profile | Today |
| Today | Leaves the app |
| Any screen opened from a notification or widget | Today |

### Leaving: exit or minimise

| Option | Effect |
|---|---|
| `App.minimizeApp()` | **Recommended.** Goes to the background like Home. Coming back is instant and nothing reloads |
| `App.exitApp()` | Closes the app. The next open starts cold, replans notifications and reads the widget inbox again |

No "press back again to exit" toast. Android advises against it.

---

## 4. How to build it

One small navigation layer, used by every screen instead of bare `navigate()` calls.

| Piece | What it does | Where |
|---|---|---|
| `services/navigation.js` | A pure `backTarget(path, overlays)`: where back goes from any screen, following §3. Plus `PARENT` for each detail page | new |
| Back button listener | `CapApp.addListener('backButton')` in `App.jsx`: close the top overlay, else go to `backTarget`, else minimise | `App.jsx` |
| Overlay stack | A small `useBackClose(open, onClose)` hook. Each open sheet or pop-up registers its close function; back calls the newest one | new `hooks/useBackClose.js`; used by `BottomSheet`, `BadgeModal`, `BadgeUnlockOverlay`, Settings AI overlay, Progress day detail |
| Add Meal steps | Register a back step for each step past the first, and the discard question | `AddMealFlow.jsx` |
| Tabs | `NavLink` with `replace`, and tapping the current tab scrolls it to the top | `Navbar.jsx` |
| Sub-tabs in the address | Log and Progress read their tab from the address and change it with `replace`, so links always work and back skips them | `Log.jsx`, `Progress.jsx` |
| Settings sections in the address | Opening a section from the menu pushes `?section=`; the arrow and back both return to the menu | `Settings.jsx` |
| Up arrows | Weight, Badges and Settings use one `goUp()`: back if the page before is the parent, otherwise replace with the parent | `navigation.js`, the three pages |
| Taps from outside | `followTap` resets to Today with `replace`, then opens the screen | `App.jsx` |
| Remember sub-tabs | Each tab keeps its last sub-tab in memory for the session, used when its tab is tapped without a `?tab=` | `Log.jsx`, `Progress.jsx` |

No new libraries. Sheets do not get history entries of their own: that route makes the browser history and the app's state drift apart, and is harder to get right than one listener.

---

## 5. Phases

| Phase | Work | Fixes | Size |
|---|---|---|---|
| **1. Back that ends** | Back listener, tabs with `replace`, leave from Today, clean stack for notification and widget taps | 1, 2, 8 — the onion | Small |
| **2. Back closes what is on top** | Overlay stack, every sheet and pop-up, Progress day detail, Add Meal steps and the discard question | 3, 4 | Medium |
| **3. Up means up** | `goUp()` for Weight, Badges and Settings; Settings sections in the address | 5, 6, 7, 12 | Small |
| **4. Links and memory** | Sub-tabs in the address, links read every time, tabs remember their sub-tab | 9, 10, 11 | Small |

Phase 1 alone removes the onion. Each phase can ship by itself.

---

## 6. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Back on Today | **Minimise** | Same as Home, keeps everything warm. Exit restarts the app and replans notifications |
| Tabs remember their sub-tab | **Yes, for the session** | Coming back to Progress on Month is what people expect. Not kept after the app closes |
| Discard question in Add Meal | **Only when foods are picked** | An empty Add Meal closes on back without a question |
| Swipe-back gesture on Android 14+ | **Same rules, no animation work now** | The gesture sends the same back event. The preview animation can come later |
| Weight's parent | **Today** | Today is where its button is. Opened from Quick log or a notification, back also lands on Today |

---

## 7. Testing

- **Unit:** `backTarget` for every screen in the table in §3, with and without overlays, and after a tap from outside.
- **On the emulator** (`adb shell input keyevent KEYCODE_BACK`), each journey with the number of presses to leave:
  - Today → Log → Progress → Profile, then back: Today, then out. **2 presses**, today it is 4 and then stuck.
  - Profile → Settings → Theme, then back: menu, Profile, Today, out. **4**.
  - Add Meal open with two foods, back: discard question.
  - Drinks sheet open, back: sheet closes, Today stays.
  - Bedtime notification tapped with the app closed, back: Today, then out.
  - Log open on Food, notification for `/log?tab=sleep`: Sleep shows.
  - Progress on Month → Today → Progress: still Month.
- **Browser:** the web build keeps working with the browser's own back button, since the rules only use `replace` and normal history.

---

## Sources

Checked 2026-11-04.

- Capacitor App plugin, back button: the default behaviour is in `node_modules/@capacitor/app/android/src/main/java/com/capacitorjs/plugins/app/AppPlugin.java` (`handleOnBackPressed`), and `exitApp` and `minimizeApp` in its `definitions.d.ts`.
- React Router v6: `NavLink` and `navigate()` push unless given `replace`.
- [Android: principles of navigation](https://developer.android.com/guide/navigation/principles) — the start destination, and up and back.
- [Material Design 3: navigation bar behaviour](https://m3.material.io/components/navigation-bar/guidelines) — back from a destination returns to the start destination.

The two Android pages were not re-read for this review. The behaviours they are cited for are long-standing, and I'm stating them from memory.

---

## How it was built

| Plan | Built | Why |
|---|---|---|
| A tap from outside puts Today underneath, then the screen | The screen opens in place of whatever was open, marked as opened from outside. Back from it goes to Today | Same result, in one move. Two moves in a row are reported as one, so the app's record of pages would miss the first |
| Settings section → Settings menu | A section goes back to what opened it: the menu, or Food when opened from "Set up calorie targets". With nothing behind it, the menu | Going back to the page you came from is what people expect from a link. "Up" to the parent is kept for when nothing is behind |
| `backTarget(path, overlays)` | `backAction(trail)`, `tabAction(trail, to)` and `outsideAction(to)` in `services/navigation.js`, with the overlays in a separate stack | The rule needs the pages in the history, not only the current one |
| Hooks | `useBackClose`, `useGoBack`, `useOpenTab`, `useOpen` and `useSubTab` in `hooks/useNavigation.js` | One place for every screen |
| Add Meal | Back closes the category menu, then steps back (duplicate → list of foods → search), then asks "Discard this meal?" when foods are picked. The ✕ still closes at once | The question is for a back press that may be accidental. The ✕ is a choice |

### Checked on the emulator

With the Android back key, on the Android 14 emulator:

- Today → Log → Progress → Today → Profile → Log, then back: Today, then out. **2 presses**. Before, 5 presses walked back through every tab and the sixth did nothing.
- Profile → Settings → Theme, then back: Settings, Profile, Today, out. **4 presses**.
- The Settings arrow on the menu goes back to Profile instead of opening it again.
- Drinks sheet open, back: the sheet closes and Today stays.
- Add Meal with a food picked, back: list of foods, then "Discard this meal?". Back again keeps the meal; Discard closes.
- Progress on Month → Today → Progress: still Month.
- Log open on Food, a link to `/log?tab=sleep` arrives: Sleep shows.
- In Settings → Theme, a widget opens Weight: back goes to Today, then out.

### Tests

`navigation.test.js` (11 tests): back from Today, tabs, detail pages, sections, and screens opened from outside; tab switching; four tab switches leave only Today and the tab; the record of pages; sheets closing newest first.

### Not checked

- Android 8 to 11, and a real phone. The back key reaches the app the same way on every version Capacitor supports, but this was not tried.
- The browser build uses the browser's own back button, which still walks the history as a browser does. Tabs no longer stack there either.

