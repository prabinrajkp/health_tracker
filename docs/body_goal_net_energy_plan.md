# Body Goal and Net Calories — Plan

Two connected changes: support people who want to gain weight, not only lose it, and combine food and workouts into one net calorie figure.

**Status:** all five phases are implemented in v4.36. The paces and protein ranges have not been reviewed by a dietitian, and reading active calories from Health Connect has not been tested on a phone.

---

## Verdict

**Both are needed, and they belong together.** They share one idea: a goal is a signed number of calories per day.

| Goal | Daily net to aim for |
|---|---|
| Lose | −275 to −825 |
| Keep | 0 |
| Gain | +275 to +500 |

Net calories then answers one question for everybody: "Am I on the side of the line my goal needs?"

Three recommendations shape the plan:

1. **The user chooses the goal.** Today the app works it out from BMI, and that is the root of the problem.
2. **Net is shown, not scored.** Exercise already earns workout points, and scoring net would reward the largest burn, which is the wrong incentive.
3. **The weight trend has the final word.** Calories eaten and burned are both estimates. After a few weeks, the app compares them with what the scale actually did and offers a corrected figure.

The goal work is the priority, because it includes a live bug and penalises anyone trying to gain.

---

## 1. Goals today

### The goal the user picks does nothing to calories

Onboarding offers Fat Loss and Muscle Gain, but those choices only adjust score weights at setup. `onboarding_goals` is saved at `Onboarding.jsx:221` and nothing ever reads it. Settings has no goal choice either, only "Rate of loss".

The calorie target comes from BMI alone (`dietetics.js:68-70`):

| BMI | Target |
|---|---|
| Above 23 | Maintenance minus the loss rate |
| 18.5 to 23 | Maintenance |
| Below 18.5 | Maintenance plus 500 |

**Example, using the app's own formula:** a 30-year-old man, 175 cm, 72 kg, lightly active. Maintenance is 2,377 kcal and BMI is 23.5.

- He picks Muscle Gain, and the app sets his target to **1,877 kcal**: a 500 calorie deficit.
- A slow gain target would be about **2,652 kcal**, which is 775 kcal higher.
- If he eats that, the calorie score drops to 0 and the card shows him hundreds of calories "over", in amber.

### What else works against someone gaining weight

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | **"Target reached" shows immediately** | `Weight.jsx:104,208` | At 60 kg with a 70 kg target, the distance is negative, and any value at or below 0 reads as "target reached". **This is a live bug** |
| 2 | **Gaining is coloured as bad** | `Weight.jsx:138-139,198-205` | Going down is green and going up is amber, including the chart line |
| 3 | **Weight badges only reward loss** | `badgeEngine.js:652-662` | "First Kilo" and "Five Down" count kilos lost from the heaviest weight. A gainer can never earn them, and no gain badge exists |
| 4 | **Fasting earns up to 10 points** | `scoring.js:126-163` | It rewards long gaps without food, which makes eating more harder |
| 5 | **Extra portions lose points** | `scoring.js:26-27` | Each portion over the ideal costs 50% of its value, even for healthy food |
| 6 | **Wording assumes loss** | `FoodSection.jsx:206-207`, `reminders.js:95`, `weeklyInsights.js:59,63`, `Settings.jsx:756,774` | "Over" is amber, "No late snacks!", "protects your fasting window", "Rate of loss" |
| 7 | **The AI summary does not know the goal** | `llmApi.js:121-223` | It can advise someone who is trying to gain to eat less |

### Problems for everybody

| # | Problem | Where | Effect |
|---|---|---|---|
| 8 | **Protein targets can be low** | `dietetics.js:100` | Protein is 10–15% of the calorie target. For the example at 1,877 kcal that is 47–70 g, and the low end is under the 60 g that the ICMR-NIN figure of 0.83 g/kg gives for 72 kg |
| 9 | **Older days can change after a goal change** | `localStore.js:39-46` | Recalculating an old day uses today's settings. So once a goal exists, editing last month's meal would score it against the new goal. The same flaw already applies to activity level and loss rate |
| 10 | **No safety checks by age** | `dietetics.js` | A person under 18 can receive a deficit. The formula and BMI cut-offs are meant for adults |
| 11 | **Reaching the target changes nothing** | `Weight.jsx:208` | The tile changes, but the app keeps prescribing the same deficit |
| 12 | **A zero fasting maximum is misread** | `scoring.js:294` | `max_points || 10` treats 0 as 10, while `categoryMaxes` uses `??`. Turning fasting off needs this fixed |

---

## 2. The goal design

### Three goals and one muscle option

| Setting | Options |
|---|---|
| **Body goal** (one choice) | Lose weight, Keep my weight, Gain weight |
| **Pace** | Lose: the existing Gentle 275, Standard 500, Aggressive 825. Gain: Slow +275, Steady +500. Keep: none |
| **Build muscle** (on or off) | Works with any goal. Raises protein and gives training more weight |

Build muscle stays separate because "gain weight" covers two different people: someone underweight who needs to reach a healthy weight, and someone training for muscle. Lose plus Build muscle also handles someone trying to do both, which the current multi-select allows but does not act on.

The gain paces, at roughly 7,700 kcal per kg:

| Pace | Daily | About per week | Suggested for |
|---|---|---|---|
| Slow | +275 | 0.25 kg | Building muscle. About 0.35% of body weight a week at 70 kg, inside the 0.25–0.5% usually suggested |
| Steady | +500 | 0.45 kg | Underweight people. This is the amount the app already adds below BMI 18.5 |

### What each goal changes

| Area | Lose | Keep | Gain |
|---|---|---|---|
| Calorie target | Maintenance − pace, with the existing floor | Maintenance | Maintenance + pace |
| Calorie points | As today: ±10% is full, zero at 35% | As today | Forgiving above target: full up to +20%, zero at +50%. As today below target |
| Card text | "320 left", "120 over" | "120 over" in neutral | "320 to go", "Goal reached", "120 extra" in neutral |
| Fasting points | On | On | **Off by default**, with a switch to keep them |
| Portions above ideal, healthy food | Lose 50% | Lose 50% | **No loss.** Junk food still costs points |
| Weight colours | Down is good | Within 1 kg is good | Up is good |
| "To target" | Current − target | None | Target − current |
| Badges | Existing | New: steady for 4 weeks | New: first 1 kg and 5 kg up |

The percentages in the calorie points row are proposals, not published figures. Score totals are safe here: the categories add up to 120 and are capped at 100, so someone with fasting off can still reach 100.

**Unchanged for every goal:** junk food penalties, the late dinner penalty, sleep, steps and the workout score. Gaining weight on fried snacks and sleeping late should not score well.

### Protein targets

Shown on the Calories card, not scored.

| Situation | Proposed range | Basis |
|---|---|---|
| Default | 0.83–1.2 g/kg | The low end is the ICMR-NIN 2024 figure |
| Losing weight | 1.0–1.4 g/kg | My judgment, to help hold on to muscle |
| Build muscle | 1.6–2.0 g/kg | Morton 2018 found gains level off near 1.6 |

Fat stays at 20–30% of calories, and carbs take what is left. No screen suggests protein powder: ICMR-NIN advises against long-term use of protein powders and high-protein concentrates. **A qualified dietitian should review these ranges and the paces before release,** as they are the most health-sensitive numbers in the app.

### Guard rails

| Situation | What the app does |
|---|---|
| Lose chosen below BMI 18.5 | Lose is not offered. Short explanation, with Keep or Gain suggested |
| Target weight below BMI 18.5 | Not accepted for Lose |
| Target on the wrong side, such as Gain with a lower target | Asks which is right, and does not guess |
| Gain chosen above BMI 25 | Allowed, with a note. Defaults to Slow and suggests Build muscle |
| Under 18 by birth year | No calorie targets or deficits. A message suggests asking a doctor, and score points for calories sit out |
| Losing faster than 1% of body weight a week, for 3 weeks | A calm note suggesting a slower pace |
| Weight falling while on Gain, for 3 weeks | Suggests checking intake, and seeing a doctor if the loss has no obvious reason |
| Pregnancy, breastfeeding, medical conditions, eating disorders | The app does not ask. Body & goal carries one plain line saying targets are not for these situations |
| Target reached | Asks once whether to switch to Keep |

**Never:** praise for a bigger deficit, "burn it off" wording, badges for deficit size or eating very little.

### Where it appears

**Onboarding:** step 1 gets a single-choice Lose, Keep or Gain at the top, with the focus chips below it. "Muscle Gain" becomes the Build muscle chip and "Fat Loss" is dropped as a chip. Still three screens.

**Settings → Body & goal:** goal first, then pace, which changes with the goal, then the existing body fields. The "Ideal weight" row becomes "Healthy range" (BMI 18.5 to 23), since a single ideal number means little and reads badly for someone working towards a weight.

### Existing users

Nothing changes until they choose:

- **A missing `body_goal` means `auto`,** which is the current BMI rule, exactly. Every existing score stays identical.
- **One question, once,** using the same card as the sick-day prompts: "What's your body goal?" It is pre-selected from `onboarding_goals` where possible.
- **New users have no `auto`.** They choose in onboarding.

### Keeping old days stable

Goal settings are stored with a start date in `tracker_config`:

```json
[{ "from": "2026-11-01", "goal": "gain", "pace": "slow", "muscle": true }]
```

Recalculating a day uses the entry in force on that date, and days before the first entry use `auto`. Backups already include `tracker_config`, so this needs no new table and no database version. Activity level is not covered here, and that existing gap stays as it is.

---

## 3. Net calories

### What the app has today

Food calories exist. **Calories burned do not exist anywhere in the app.** Steps, walk minutes, exercise type and exercise minutes are logged, and only ever turned into points. The Progress figure "Avg kcal a meal" is per meal, and weekly and monthly insights do not mention calories.

### Which "net"

Apps use the word in two ways:

| Meaning | Formula | Issue |
|---|---|---|
| Food minus exercise | Eaten − exercise | Needs a separate target to compare with, and the result means little by itself |
| **Food minus everything burned** | Eaten − total burned | Directly tied to weight, and the same line works for every goal |

**Recommendation: the second.** Net above 0 means gaining and below 0 means losing, for everybody.

### Estimating calories burned

```
Total burned = Resting and daily life + Steps + Exercise
```

**The double-counting trap:** the app's current maintenance is BMR × activity level, and activity level already includes exercise. Adding workouts on top would count them twice. So the day is built up from a low base instead.

| Part | Formula | Notes |
|---|---|---|
| **Resting and daily life** | BMR × 1.2 | The app's existing sedentary multiplier. Covers rest, digestion and ordinary moving around |
| **Steps** | Steps above 2,500 → km → hours at 4.8 km/h × 2.8 × kg | Net cost of moderate walking (3.8 METs − 1). Step length is 0.414 × height. The 2,500 allowance for steps already inside the base is my assumption, to be tested |
| **Exercise** | (METs − 1) × kg × hours | Subtracting 1 avoids counting rest twice, since the session replaces time that the base already covers |
| **Weight used** | Latest weigh-in on or before that day | Same as the calorie target |

Exercise values from the 2024 Adult Compendium of Physical Activities:

| App's type | Normal | Hard |
|---|---|---|
| Badminton | 5.5 social (15030) | 7.0 competitive (15020) |
| Gym | 5.0 gym and weights (02061) | 6.0 vigorous lifting (02050) |
| Cycling | 6.8 leisure, 10–12 mph (01020) | 8.0, 12–14 mph (01030) |
| Stairs | 6.8 general (17131) | 9.3 fast (17134) |
| Other | 5.0, same as Gym | 6.0 |
| Walking | Counted through steps | Counted through steps |

The Compendium marks estimated values in red, which I could not see in the text I read. Check these on the site when building. Adding this mapping and the Normal or Hard choice is a judgment of mine: the Compendium itself says its values do not reflect precise individual energy use.

**Avoiding overlap:**

- **Walking sessions and post-dinner walks add nothing when steps exist,** because those steps are already counted. If the day has no steps at all, they are counted from their minutes.
- **Stairs and sports** can partly overlap with steps if the phone was carried. This is accepted, and the weight check in section 4 absorbs it.
- **No activity data at all:** a day with no steps and no exercise uses the old BMR × activity level figure, labelled "from your activity level". A person who just forgot their phone should not appear to have burned almost nothing.

### Worked example

The same 72 kg man, with 9,000 steps and a 45-minute normal gym session, eating 2,100 kcal:

| | kcal |
|---|---|
| Resting and daily life: 1,729 × 1.2 | 2,075 |
| Steps: 6,500 steps counted, 4.7 km | ~200 |
| Gym: 4 × 72 × 0.75 | ~215 |
| **Total burned** | **~2,490** |
| Eaten | 2,100 |
| **Net** | **~−390** |

As a sanity check, 2,490 sits between the old lightly active (2,377) and moderately active (2,680) figures, which is about right for this day. A day with no walking beyond 2,500 steps gives 2,075, the same as the old sedentary figure.

**What −390 means depends on the goal:** close to plan for Lose at Standard, under for Keep, and well short for Gain.

### How the target and net fit together

**Today's eating target stays fixed for the day and exercise does not raise it.** This is the most important decision in this section.

| | Exercise raises the target | **Fixed target, net shown alongside (recommended)** |
|---|---|---|
| Stability | The number moves through the day | Stable |
| Accuracy risk | Estimated burn turns directly into permission to eat | Errors stay in an information-only number |
| Effect on Lose | People overestimate burn, then eat it back | No "I earned this" loop |
| Effect on Gain | Would actually help on active days | A gainer on a heavy day sees net fall short, and can choose to eat more |
| Scoring | Exercise would also change calorie points, on top of workout points | Unchanged |

For the same reason, **calorie points continue to compare food with the target.** Net is information.

### Unfinished days

At 10 AM, net would be huge and meaningless. So:

- **While today is open,** the card shows "so far" numbers with no verdict.
- **A day counts as complete** when at least 2 of breakfast, lunch and dinner are logged and at least 70% of portions carry calorie data, which is the existing coverage rule.
- **Incomplete days** still show their numbers, but stay out of averages and comparisons.
- **Sick days** show no verdict and stay out of every average.

**Known limit:** someone who really does eat only one meal would be left out of the averages. That is better than treating every half-logged day as a large deficit.

### Where it appears

The earlier feedback about the drinks block being cluttered applies here, so no new card is added to Today.

| Place | Addition |
|---|---|
| **Log → Food, Calories card** | One expandable line: "Net so far ~−390 · Goal −500". Open it to see eaten, resting, steps and exercise |
| **Log → Move** | One line under exercise: "About 215 kcal". A Normal or Hard choice appears only when a session is on |
| **Day detail** | The same net line, with the breakdown |
| **Progress → Week** | Average net on complete days, and how many days counted, with 7 bars around the goal line |
| **Progress → Month** | Average net, and the weight check from section 4 |
| **Excel export** | Eaten, Burned and Net columns |

All burn and net figures are rounded to the nearest 10 and shown with "~". They are never coloured as failure for a single day, since one day's number is too rough to judge.

---

## 4. Checking against the scale

Both inputs carry real error. Reviews found that even fitness trackers are not accurate on energy use, though good at steps. Studies against doubly labelled water consistently find that people under-report what they eat. A formula cannot fix either. The scale can.

Actual maintenance can be worked out from what happened:

```
Actual maintenance ≈ Average eaten − (weight change per day × 7,700)
```

### On Progress → Month

> **Expected vs actual, last 4 weeks**
> Your logs suggest −0.3 kg a week. Your weight changed −0.1 kg a week.
> Your real maintenance looks about 150 kcal lower than the estimate.
> [Use this figure]

| Rule | Value | Why |
|---|---|---|
| Minimum data | 3 weeks, 14 complete days, 6 weigh-ins | Water and food swing weight by more than a week's real change |
| Weight change | Trend across the period, not first against last | One heavy morning should not change anything |
| Suggest only when the gap is | 150 kcal or more | Smaller gaps are noise |
| Limit | Within 20% of the formula, and never below the floor | Protects against bad logging. Someone logging half their meals would otherwise get a dangerously low target |
| Adoption | **Only when the user taps it,** and it can be undone | The app should not quietly change a health target |
| Sick days | Left out of the eating average | Illness changes intake and weight |

**A useful side effect:** the corrected figure also absorbs consistent logging habits. If someone always under-counts oil, their "maintenance" comes out lower, and the target still works for them. The screen should call it "your working maintenance", not a measurement of their metabolism.

**The limit of 7,700:** Hall's work shows this fixed rule overstates long-term change, as the body adapts and weight responds slowly. It is acceptable here because only the last few weeks are used and it is recalculated as new data arrives. It should never be used to promise a future weight or date.

---

## 5. What changes in the code

| Change | File |
|---|---|
| Goal, pace and muscle, with `auto`, floors, protein ranges, guard rails | `services/dietetics.js` |
| Goal in force on a date | `services/localStore.js` (`getDieteticsFor`), and a new `services/bodyGoal.js` |
| Goal-aware calorie points, fasting, portions. Fix `max_points || 10` | `services/scoring.js`, and every caller of `computeScore` and `calcDietScore` |
| Burn and net calculation | new `services/energy.js` |
| Scale check | new `services/maintenanceCheck.js` |
| Intensity field on workouts, no index so no database version | `pages/log/MoveSection.jsx` |
| Target bug and goal-aware colours | `pages/Weight.jsx` |
| Goal, pace, validation, healthy range | `pages/Settings.jsx` |
| Goal question | `pages/Onboarding.jsx`, `pages/Today.jsx` for existing users |
| Calories card text and net line | `pages/log/FoodSection.jsx` |
| Net on the day, week and month | `components/DayDetail.jsx`, `pages/Progress.jsx`, `services/weeklyInsights.js`, `services/monthlyInsights.js` |
| Gain and steady badges | `services/badgeEngine.js`. Check that badge counts in `prestigeEngine.js` and `superBadges.js` still work |
| Goal in the summary prompt | `services/llmApi.js` |
| Reminder and insight wording, such as "No late snacks!" | `services/reminders.js`, `services/notificationEngine.js`, `services/trendNotificationEngine.js`, `services/weeklyInsights.js` |
| Excel columns | `pages/Settings.jsx` |
| Scoring and goal description | `README.md`, `index.html` |

**Other plans:** `ai_nudges_plan.md` and `weekly_ai_summary_plan.md` should both receive the goal and net figures. Build at least phase 1 here before either, so neither has to be rewritten for gainers. The nudge plan's rule against suggesting less food should become goal-aware too.

---

## 6. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Goals offered | Lose, Keep, Gain, plus Build muscle | Covers underweight, muscle building and both at once, with few choices |
| Should exercise raise the day's eating target? | **No.** Fixed target, net shown alongside | Burn is an estimate and should not become permission to eat. If you want "earn it back" for gainers only, that is possible later |
| Should net affect the score? | **No** | Exercise is already scored, and scoring net would reward the biggest burn |
| Fasting points on Gain | Off by default, can be turned on | It works against eating more. Some people may still like the routine |
| Name on screen | "Net" | Your word, and short. The expanded line explains it |
| Normal or Hard choice on exercise | Yes, only when a session is on | Sport intensity changes the burn by a lot, and it is one tap |
| Existing users | `auto` until they answer one question | No score changes without a choice |
| Under-18s | No calorie targets at all | The formula and cut-offs are for adults |
| Scale correction | Offered, and applied only by tap | A health target should never change silently |
| Option to hide calorie numbers | Yes, in phase 4 | Numbers can be unhelpful for some people, and the score still works without them |
| Dietitian review before release | Yes, of the paces and protein ranges | They are health guidance, and I am not qualified to sign off on them |

---

## 7. Limits to be honest about

- **Net is a rough estimate.** Food logs, the BMR formula, step conversion and METs all have error, and they add up. Treat a daily figure as a direction, and the 2 to 4 week trend as the real signal.
- **The formula is population-level.** Two people with the same stats can burn noticeably different amounts. Section 4 is how the app deals with this.
- **It depends on logging.** Net needs food with calorie data. People who skip meals or use foods with no nutrition data get few complete days, and so little or no weekly picture.
- **Weight is not muscle.** The app cannot tell whether a gain is muscle or fat. Protein, training and pace improve the odds, but it should never claim "you gained muscle".
- **It is not medical advice.** Being underweight, or losing weight without trying, can have medical causes that an app cannot see.

---

## 8. Phases

| Phase | Work | Outcome | Size |
|---|---|---|---|
| **1. Goal** | Body goal, pace, history, `auto`, Settings, onboarding, one-time question, guard rails, Weight bug and colours, card text | Gainers get a correct target and correct feedback. Target bug gone | Medium |
| **2. Goal-aware app** | Calorie points, fasting, portions, protein, badges, reminders, insights, AI summary | The whole app supports the goal | Medium |
| **3. Net** | `energy.js`, intensity choice, net line on Food, Move and day detail | Daily net with a clear breakdown | Medium |
| **4. Trend** | Week and month net, scale check, Excel, hide-calories option | Net tied to real results | Medium |
| **5. Optional** | Health Connect active calories, healthy add-on ideas for gainers from foods they already log | Refinements | Small to medium |

Phase 1 can ship alone and should go first. In phase 5, the Health Connect plugin can read `ActiveCaloriesBurned`, but it needs a new permission, overlaps with steps and exercise, and is not clearly more accurate. It is not worth doing early.

---

## 9. Testing

- **No change for existing users:** run existing data through the new code with `auto`, and confirm that every score is identical. This is the most important test, and `dietetics.test.js` must pass untouched.
- **Goal targets:** the worked example, each goal and pace, the floor, and each guard rail, including under 18 and each BMI boundary.
- **Weight screen:** Lose, Keep and Gain with targets above and below current weight, confirming that the distance, "target reached" and colours are right. Includes the 60 kg with a 70 kg target bug.
- **Old days:** change goal, edit last month's meal, and confirm that day still uses the old goal.
- **Scoring:** Gain above target, fasting off and the corrected bonus ceiling, extra healthy portions against extra junk.
- **Burn:** the worked example. Walking sessions not added to steps. No-data fallback. No weigh-in. Sanity range against the old activity levels.
- **Unfinished days:** net has no verdict while open. Incomplete and sick days stay out of averages.
- **Scale check:** too little data shows nothing. Noisy weights do not trigger it. Limits hold. Applying and undoing work.
- **Backup:** goal history survives a backup and restore through the real import, and older backups still restore.
- **In the browser:** the full flow, in both light and dark mode, and confirm that Today still fits without scrolling. Nothing here except phase 5 depends on native features.
- **Real use:** at least 4 weeks of your own logs, comparing the app's expected change with your actual change, before trusting the burn numbers.

---

## Sources

Checked 2026-11-01. The nutrition and exercise papers were mostly read through abstracts and summaries, not in full.

**Energy cost of activity**
- [2024 Adult Compendium of Physical Activities (paper)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/)
- Compendium values: [sports](https://pacompendium.com/sports/), [walking](https://pacompendium.com/walking/), [bicycling](https://pacompendium.com/bicycling/), [conditioning exercise](https://pacompendium.com/conditioning-exercise/)

**Accuracy**
- [Consumer activity trackers, systematic review](https://pubmed.ncbi.nlm.nih.gov/26684758/)
- [Wearables and energy expenditure, 2020 review](https://www.pubmed.gov/32897239/)
- [O'Driscoll et al., activity monitors meta-analysis](https://www.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/how-well-do-activity-monitors-estimate-energy-expenditure-a-systematic-review-and-metaanalysis-of-the-validity-of-current-technologies/BF859A0E710880C069FF12D2D697868D)
- [Self-reported energy intake against doubly labelled water](https://pubmed.ncbi.nlm.nih.gov/11348556/)
- [Trabulsi and Schoeller review](https://pubmed.ncbi.nlm.nih.gov/11595643)
- [Hall et al., energy imbalance and body weight](https://pubmed.ncbi.nlm.nih.gov/21872751/)

**Gaining weight and protein**
- [Slater et al., energy surplus and muscle](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2019.00131/pdf)
- [Examine, size of the surplus](https://examine.com/faq/should-the-magnitude-of-the-energy-surplus-depend-on-the-training-status-of-the-individual), secondary
- The Morton 2018 protein figure and the 0.25–0.5% weekly rate from Iraki 2019 came through secondary summaries. Check the originals before quoting them in the app.
- [ICMR-NIN 2024 guidelines, as reported](https://www.m3india.in/contents/news/why-do-icmr-nin-s-new-dietary-guidelines-advise-against-protein-supplements), secondary. I did not open the primary PDF.

**Not checked:** the BMI 18.5 and 23 cut-offs are the app's existing values from `py_abacus`, and I did not verify them against a source for this plan.
