# Counting Drinks Logged as Food — Plan

When a drink such as lemon juice or coffee is logged as part of a meal, it should count toward the day's drinks total automatically, without logging it a second time.

**Status:** planning only. Nothing here is implemented.

**Related:** [drinks_declutter_plan.md](drinks_declutter_plan.md) reshapes how Drinks is shown. This plan changes what is counted. They touch the same screens and are best built together.

---

## Verdict

**Feasible, and a clear improvement.** Today a coffee logged in a meal earns food points but adds nothing to drinks, and a coffee tapped in Drinks adds volume but no points. The two never meet, so the drinks total under-counts for anyone who logs drinks as food.

The fix is to let a food carry two extra facts: **whether it is a drink**, and **how many mL one portion is**. Once a food has those, logging it adds to the drinks total with no extra step.

Three points shape the design:

1. **The link should be calculated, not copied.** The drinks total becomes "drinks tapped in Drinks, plus drink foods in today's meals". Nothing is duplicated, so changing a portion or removing the food corrects the total by itself.
2. **AI helps but cannot be required.** The app works offline and the AI key is optional. Tagging needs a built-in path that works with no key, with AI as the faster option when a key exists.
3. **It creates a double-counting risk** that the design has to make visible. See section 5.

---

## 1. What changes for the user

- Log "Coffee" at breakfast → the Today glass rises by 150 mL. Nothing else to do.
- Change it to 2 portions → the total rises to 300 mL. Remove it → it drops back.
- The Drinks view shows where the total came from: what was tapped in, and what came from meals.
- Each food in Settings → Custom foods can be marked as a drink, with its portion size in mL.
- New foods added through AI lookup arrive already tagged.

The daily score is still untouched. Drink foods keep earning or losing food points exactly as now; this only adds volume.

---

## 2. Data model

**Two new optional fields on a food** (stored with the existing food list, so no database change):

| Field | Meaning | Example |
|---|---|---|
| `isDrink` | Counts toward drinks | `true` for Coffee |
| `mlPerPortion` | Volume of one portion, in mL | `150` |

A food with neither field is treated as not a drink. That default under-counts rather than over-counts, which is the safer error.

**Copied onto the meal item when logged.** The app already copies a food's calories and macros onto each logged item so that later edits to the food do not rewrite history. `mlPerPortion` should be copied the same way.

**The drinks total becomes:**

```
total = sum of entries tapped in Drinks
      + sum over today's meal items of (portions × mlPerPortion)
```

Nothing from meals is written into the drinks table. This is what keeps the two in step automatically.

---

## 3. How foods get tagged

Tagging has to work in three situations. All three are needed.

### 3.1 Built-in rules (offline, no key, instant)

A small table of common drink words and a typical Indian household portion for each. Run once on upgrade over the existing food list, and whenever a food is added by hand.

| Matches | Default portion |
|---|---|
| tea, chai, coffee | 150 mL |
| juice, lemon / lime water, sharbat | 200 mL |
| milk, buttermilk, lassi, shake, smoothie | 200 mL |
| soft drink, soda, cola | 250 mL |
| water, coconut water | 250 mL |

In the default food list this would tag four foods: **Buttermilk, Coffee (no sugar), Tea (1 sugar)** and **Soft drinks**.

The rules must be conservative. "Oats + milk", "Curd / yogurt" and "Watermelon" contain liquid but are food, and must not be tagged. Matching on whole words and excluding names with "+" or a clear solid food avoids most false hits, but this needs a test list of real food names.

### 3.2 AI tagging (when a key is set)

The app already asks the AI for points, portions and nutrition for a food. Two lines are added to that same request:

```
Drink: [yes or no — is this a beverage that is drunk, not eaten]
Volume: [mL in ONE typical Indian household serving, or 0 if not a drink]
```

- **New foods** found through "Search further" in Add Meal, or "Ask AI" in Settings, are tagged in the same call. No extra request.
- **Existing foods** get a one-time "Tag drinks with AI" button in Custom foods, next to the existing nutrition fill. It sends the food names in batches, as the nutrition fill already does, and only for foods not yet reviewed.

AI results override the built-in rules, since the AI handles names the rules cannot ("Nimbu pani", "Sulaimani", "Tender coconut").

### 3.3 By hand (always available)

The food editor in Custom foods gets a **"This is a drink"** switch and an **mL per portion** field. This is the final word: a manual choice is never overwritten by rules or AI. To make that work, each food records who set the tag (rules, AI or the user).

### Recommended order of trust

**User > AI > built-in rules > untagged.**

---

## 4. Screens affected

| Screen | Change |
|---|---|
| **Today card** | Total includes drink foods. No layout change |
| **Drinks view** (row and sheet from the declutter plan) | A "From your meals" group listing each drink food with its volume, read-only, with a link to edit the meal |
| **Add Meal confirmation** | One line: "+150 mL to drinks" when the meal contains a drink |
| **Food log meal rows** | A small glass icon and volume on drink foods, so it is clear they count |
| **Custom foods editor** | The drink switch and mL field; a "Tag drinks with AI" action; a glass icon on tagged foods |
| **Settings → Water goal** | One line explaining that drinks logged in meals count too |
| **Excel export** | A "From meals (mL)" column on the Drinks sheet |

---

## 5. Problems to design for

### 5.1 Double counting

This is the main risk. Someone logs coffee at breakfast, then out of habit also taps **Tea / coffee** in Drinks. The total now counts it twice.

Mitigations, in order of preference:

1. **Show the meal drinks inside the Drinks view.** If "Coffee 150 mL, from breakfast" is already listed there, the user can see it is counted.
2. **Say so at the moment of logging**, with the "+150 mL to drinks" line.
3. **Consider removing the Tea / coffee and Milk buttons from Drinks** once foods are tagged, leaving Water and Other. Those two buttons exist mainly because meal drinks did not count. This is a decision for you in section 8.

The app should not try to detect and merge duplicates automatically. It cannot know whether two coffees were one or two.

### 5.2 The goal stamp on days with no tapped drinks

Each day currently records the goal that applied, at the moment a drink is tapped. A day where every drink came from meals would have no stamp, so it could never count as "goal met" for badges.

**Fix:** stamp the day's goal whenever a meal containing a drink is saved, as well as when a drink is tapped.

### 5.3 Badges read only tapped drinks

The Hydration badges are calculated from the drinks table alone. They need to include meal drinks, or the glass on Today could show a full day that the badges do not recognise.

**Fix:** the badge calculation takes each day's meal drinks into its total. The "Early Glass" badge should also accept a drink logged in a meal before 9 AM.

### 5.4 Soft drinks count toward a hydration goal

By the reference doc, the goal is for all beverages, and a cola is a beverage. So it should count. But it means a Hydration badge can be earned partly on soft drinks, which sits oddly beside those same drinks losing food points.

Recommendation: count them, because the alternative is a volume total that is knowingly wrong. The food score already carries the judgement. This is flagged as a decision in section 8.

### 5.5 Wrong portion sizes

A "glass" of juice at home may be 300 mL where the default says 200. The total is only as good as the per-food number.

**Fix:** the mL field is editable per food, and the Custom foods list shows the volume so a wrong one is noticeable. The first time a tagged food is logged, the confirmation line shows the volume it used.

### 5.6 Wrong tags

Rules and AI will both make mistakes in both directions. A manual switch, the trust order in section 3.3, and a visible glass icon on tagged foods make errors easy to spot and fix.

### 5.7 Archived foods

Archiving (v4.33) does not affect tags. An archived drink food found through search and logged still counts.

---

## 6. History: what happens to past days

Two choices:

| | Count from now on | Recount the past |
|---|---|---|
| Past days' totals | Unchanged | Rise wherever a drink food was logged |
| Past "goal met" and badges | Unchanged | Mostly unchanged anyway: past days without a tapped drink have no goal stamp, so they cannot become "met" |
| Risk | None | Totals on old days shift after the fact, and depend on tags that did not exist then |
| Work | Less | More |

**Recommendation: count from now on.** Only meal items logged after the update, which carry their own `mlPerPortion`, are counted. Past days stay exactly as they were. One exception worth making: items already logged **today** when a food is first tagged should count, so the feature is visibly working on day one.

---

## 7. What changes in the code

| Change | File |
|---|---|
| Built-in drink rules and default portions; `tagFood()` with the trust order | new `services/drinkTagging.js`, with tests |
| Total from tapped entries plus meal drinks | `services/hydration.js`, `hooks/useWater.js` |
| Copy `mlPerPortion` onto logged items | `components/AddMealFlow.jsx` |
| Stamp the day's goal when a meal with a drink is saved | `services/localStore.js` |
| Badge metrics include meal drinks | `services/hydration.js`, `services/badgeEngine.js` |
| Two extra lines in the AI food prompt and its parser; batch tagging | `services/llmApi.js` |
| One-time rules pass over the existing food list | `App.jsx` (alongside the existing startup migrations) |
| Drink switch, mL field, tag action, icons | `pages/Settings.jsx` |
| "From your meals" group, confirmation line, row icon | Drinks view, `AddMealFlow.jsx`, `pages/log/FoodSection.jsx` |
| Export column | `pages/Settings.jsx` |

No new database table. Backups are unaffected in format: the new fields travel inside the existing food list and meal items, and older backups restore as "not tagged".

**Size:** medium. The calculation and tagging rules are small and testable. Most of the work is the Custom foods editor and getting the Drinks view to explain the total clearly.

---

## 8. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Tagging: rules, AI, or both? | Both, plus a manual switch | Rules keep it working offline with no key. AI covers names the rules miss |
| Run AI tagging automatically, or on a button? | On a button | It uses the user's own API quota and needs a connection. A silent call would break the app's "nothing leaves the phone unless you ask" behaviour |
| Keep the Tea / coffee and Milk buttons in Drinks? | Remove them once this ships; keep Water and Other | They are the main source of double counting, and meal logging now covers them |
| Do soft drinks and other "bad" drinks count? | Yes | The goal is for all beverages. The food score already penalises them |
| Recount past days? | No, count from the update onward | Section 6 |
| Build with the declutter plan or separately? | Together | Both rework the Drinks view. Doing them apart means building that view twice |

---

## 9. Phases

| Phase | Work | Outcome |
|---|---|---|
| 1. Count | New fields, built-in rules, one-time tagging pass, total includes meal drinks, goal stamp, badges | Coffee at breakfast raises the glass. Works offline |
| 2. Explain | "From your meals" group, confirmation line, row icons, manual switch and mL field | The total is understandable and correctable |
| 3. AI | Prompt lines, tagging of new foods, "Tag drinks with AI" for existing ones | Better coverage for unusual names |
| 4. Tidy | Remove the redundant Drinks buttons if agreed; export column; Settings wording | No double entry points |

Phase 1 alone delivers the request. Phases 2 and 3 make it trustworthy.

---

## 10. Testing

- Unit tests for the rules against a list of real food names, including the traps: "Oats + milk", "Curd / yogurt", "Watermelon", "Milk chocolate", "Tea biscuit".
- Unit tests for the total: tapped only, meals only, both, half portions, a food with no volume.
- Log a drink food, change its portion, remove it, and confirm the total follows each time.
- A day with only meal drinks reaches the goal and counts for badges.
- The daily score is identical before and after.
- With no AI key and no connection, tagging and counting still work.
- A manual tag survives a later AI tagging run.
- An older backup restores with all foods untagged and nothing broken.

---

## 11. Out of scope

- Water content of solid food (fruit, curd, soup, rice). The reference doc treats that as separate from beverage intake.
- Different volumes for the same food at different meals.
- Any change to food points, calories or the daily score.
- Detecting or merging duplicate drinks automatically.
