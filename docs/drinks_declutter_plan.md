# Drinks on the Food Log — Critique and Resolve Plan

The Drinks block added in v4.32 makes the Food log feel cluttered. This document says why, and proposes a fix.

**Status:** planning only. Nothing here is implemented.

---

## Verdict

The complaint is right. The Food log is where you record meals, and the Drinks block puts a second, complete logging tool in the middle of it. With a few drinks logged it is about 530 px tall in my render of v4.32, which is more than half a phone screen, and it sits between the meals and the Calories card.

The underlying mistake is one of frequency. **Almost every drink is logged from the Today card in one tap.** The full control on the Food log is needed only for the exceptions: a different drink type, a bigger amount, or removing a mistake. Yet it is always open, at full size, for everyone.

**The fix:** shrink Drinks on the Food log to a single row, and move the full control into a sheet that opens on demand, from either the Food log or the Today card.

---

## 1. What is on screen now

Counting what the Drinks block shows on the Food log, top to bottom:

| # | Element | Always shown? |
|---|---|---|
| 1 | Header bar: "Drinks" and "1.5 of 3.05 L" | Yes |
| 2 | Progress bar | When a goal is set |
| 3 | "Water 1.25 L · other drinks 250 mL" | When other drinks are logged |
| 4 | Four type pills: Water, Tea / coffee, Milk, Other | Yes |
| 5 | Three amount buttons: Glass, 500 mL, 1 L | Yes |
| 6 | Up to four entry rows, each with a time, type, amount and a delete button | When anything is logged |
| 7 | "Show all" link | With five or more entries |
| 8 | A three-line explanation of the goal, plus a settings link | Yes |

That is up to **13 tappable controls** (4 pills, 3 buttons, 4 delete buttons and 2 links) and **8 distinct elements**, for something whose main action is already one tap away on Today.

For comparison, an entire meal on the same screen is a header bar and its food rows.

---

## 2. Why it feels cluttered

**1. The rare case is given the most room.** The pills and amount buttons exist for "not water" and "not one glass". Those are the minority of logs, but they take the most space and are always visible.

**2. Two selectors for one action.** Logging takes a choice of type and then a choice of amount: seven controls in two rows. It looks like a form, on a screen that is otherwise lists.

**3. A history nobody needs to see.** The entry list shows "23:07 Water 1000 mL" four times over. Unlike food rows, these entries carry no points and are never adjusted, so the list is there only to delete a mistake. The Today card already has Undo for the common case.

**4. The explanation is permanent.** Three lines of small text about estimates, heat, illness and thirst appear every time, under every log. The same text, in fuller form, is already in Settings → Water goal. It is right that the user can read it; it does not need to be read daily.

**5. It looks like a fifth meal.** Since v4.33 the Drinks heading uses the same header bar as Breakfast, Lunch, Dinner and Snacks. It reads as another meal, but behaves completely differently, which makes the screen harder to scan.

**6. It pushes Calories down.** Calories are part of the food score. Drinks are not part of any score. The unscored block sits above the scored one.

**7. The same total appears twice in the block.** The header says "1.5 of 3.05 L" and the bar directly beneath says the same thing graphically, followed by a third line breaking it down.

**8. Part of this is the cost of counting other drinks.** Tracking tea, milk and other drinks was a deliberate choice, and it is what created the type pills and the breakdown line. The plan below keeps that feature but stops it costing space when it is not being used.

---

## 3. Options considered

| | A. One row + sheet | B. Own tab in Log | C. Sheet from Today only |
|---|---|---|---|
| Food log shows | One Drinks row | Nothing | Nothing |
| Full control lives in | A bottom sheet | A fourth tab: Food · Move · Sleep · Drinks | A bottom sheet |
| Reached from | The row, or the Today card | The tab, or the Today card | The Today card only |
| Food log gets shorter by | About 480 px | About 530 px | About 530 px |
| Downside | One extra tap for a non-water drink | A whole tab for something that is not scored, and four tabs are tighter on a narrow phone | Drinks vanish from Log entirely, so someone looking there finds nothing |

**Recommendation: A.** It removes nearly all the clutter, keeps drinks discoverable where intake is logged, and reuses the bottom sheet the app already has. B gives unscored drinks equal billing with the three scored sections, which overstates them. C hides the feature from anyone who starts in Log.

---

## 4. The proposed design

### On the Food log: one row

```
 Breakfast            08:30    + Add
   Idli …
 Lunch                13:00    + Add
   Dal …
 Dinner · nothing yet          + Add
 Snacks · nothing yet          + Add
 Fasting          12h 30min · +1/10

 Drinks  ▓▓▓▓▓▓░░░░  1.5 of 3.05 L   + Glass

 Calories …
```

- The row shows the name, a slim progress bar, the total and one **+ Glass** button.
- Tapping **+ Glass** adds a glass of water, exactly like the Today card.
- Tapping anywhere else on the row opens the sheet.
- It moves **below Calories**, so the scored parts of the screen come first. (See the decision in section 6.)
- It is styled as a plain row, not a meal header bar, so it no longer reads as a fifth meal.

### The sheet: everything else

```
 Drinks                              ✕
 1.5 of 3.05 L          ▓▓▓▓▓▓░░░░

 [ Water ] [ Tea / coffee ] [ Milk ] [ Other ]
 [ + Glass 250 mL ] [ + 500 mL ] [ + 1 L ]

 Today
 23:07  Water          1000 mL   🗑
 23:06  Tea / coffee    250 mL   🗑
 …

 The goal is an estimate.  About this goal ›
```

- Same controls as today, but only on screen when asked for.
- The entry list can show the whole day here, since the sheet scrolls and space is no longer shared with meals.
- The three-line explanation becomes one line with a link to Settings → Water goal, where the full text already is.
- The breakdown ("water / other drinks") appears only when other drinks have been logged, as now.

### On Today

- The card is unchanged: glass, total, Undo, **+ Glass**.
- Tapping the card opens **the same sheet, on Today**, instead of navigating to the Food log and scrolling. This is faster and removes the scroll-to-section behaviour added in v4.32.

---

## 5. What changes in the code

| Change | File |
|---|---|
| Extract the full control into a `DrinksSheet` component built on the existing `BottomSheet` | new `components/DrinksSheet.jsx` |
| Replace `DrinksBlock` with a one-row `DrinksRow`; move it below `CaloriesCard` | `pages/log/FoodSection.jsx` |
| Open the sheet from the Today card instead of navigating | `pages/Today.jsx` |
| Remove the `focus=drinks` scroll handling, which is no longer needed | `pages/log/FoodSection.jsx` |
| Shorten the goal explanation to one line with a link | `components/DrinksSheet.jsx` |

No change to data, the goal logic, badges, export or Settings. `useWater` stays as it is and is shared by the row, the card and the sheet.

One detail to handle: the Today card and the sheet would each hold their own copy of today's drinks. When the sheet is opened from Today, both must show the same numbers, so the sheet should use the card's data, not load its own.

**Size:** small. One new component, mostly moved code, and edits to two screens.

---

## 6. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| One row + sheet, own tab, or Today only? | One row + sheet (A) | Section 3 |
| Where does the Drinks row sit on the Food log? | Below Calories | Scored things first. The alternative is to leave it under Fasting, where it is now |
| Keep **+ Glass** on the Food log row? | Yes | Without it the row is only a link, and logging from Log takes two taps |
| Keep tracking other drinks (tea, milk, other)? | Yes, inside the sheet | It was a deliberate choice, and in the sheet it costs no space on the Food log. Dropping it would simplify the sheet to three buttons |
| Keep the full entry list? | Yes, in the sheet only | It is the only way to remove an older mistake |

---

## 7. How to tell it worked

- The Food log is about 480 px shorter with drinks logged than in v4.33.
- Drinks take one row on the Food log, with at most two tappable areas.
- Logging a glass of water is still one tap from Today and one tap from the Food log.
- Logging a non-water drink takes three taps: open, choose type, choose amount.
- The goal explanation is no longer visible on the Food log.
- Calories are visible without scrolling past Drinks.
