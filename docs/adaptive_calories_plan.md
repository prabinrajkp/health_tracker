# Adaptive calories — Feasibility and Plan

Can the app learn each person's real maintenance from their own food, workout and weight logs, and correct the calorie target every week or month?

**Status:** feasibility review and plan only. Nothing here is implemented.

---

## Verdict

**Feasible, and about half of it already exists. Worth building, but only as a careful upgrade of the current "Expected vs actual" check, not as a new automatic dial.**

| Question | Short answer |
|---|---|
| Is the data there? | Yes. Food with calories, steps and workouts, and daily weight are all logged and kept |
| Does the app already do this? | Partly. Since v4.36, Progress → Month compares the logs with the weight trend and offers a corrected maintenance figure, one tap to apply |
| What is wrong with what exists? | It is hidden, it waits for a tap, and **at its minimum data it suggests a change about half the time even when nothing needs changing** (§3) |
| Weekly or monthly? | **Check weekly, change slowly.** A week of weight is mostly water. The estimate should use the last 4 to 6 weeks, move by a small step each week, and settle |
| Who benefits? | People who log most days and weigh most days. For them it can remove the biggest error in the app: the formula's guess at their burn |
| Who does not? | Occasional loggers, occasional weighers, under-18s, and anyone for whom weight-watching is unhealthy. For them it must stay off or quiet |
| Biggest risk | Acting on noise. A week of salty food or a missed log can look like a 300 kcal change. Every rule below is about not doing that |

---

## 1. The idea in plain words

The formula guesses how much you burn: BMR × activity level, plus steps and workouts. It can easily be 10 to 15% out for one person. The scale doesn't guess.

```
What you really burn ≈ what you ate − what the scale says you stored

  stored per day = weight trend (kg per day) × 7,700 kcal per kg
```

Eat 2,200 a day for four weeks and lose 0.25 kg a week, and your real maintenance is about 2,200 + (0.25 × 7,700 / 7) ≈ 2,475 kcal. If the formula said 2,250, your target can move up about 225 kcal and still keep the same pace.

This "working maintenance" also absorbs consistent logging habits. If someone always under-counts cooking oil by 150 kcal, their working maintenance comes out 150 lower, and the target still works for them. The app should never call it their metabolism.

---

## 2. What exists today

From `services/maintenanceCheck.js` and `components/NetSummary.jsx` (v4.36):

| Part | Today |
|---|---|
| Window | The last 28 days, or since the last correction if that is more recent |
| Data needed | At least 14 complete days (two main meals, 70% of portions with calorie data), 6 weigh-ins, across 21 days |
| Weight trend | Least-squares slope through the weigh-ins |
| Intake | Average of complete days only |
| Suggests a change when | The gap between expected and actual is 150 kcal a day or more |
| Limit | ±20% of the formula's maintenance |
| Applied | Only by a tap on **Use this figure**, under Progress → Month, as `maintenanceOffset` and `burnOffset` on the body goal from today |
| Shown to the user | Expected vs actual kg per week, the working maintenance, the change |
| Safety floor | Targets never go below 1,500 (men) or 1,200 (women), already in `dietetics.js` |

That is a good base: offline, explainable, opt-in, limited and reversible. The rest of this plan improves it rather than replacing it.

---

## 3. What is wrong with it

### 3.1 It reads noise as signal

Day-to-day weight moves by about 0.5 to 1 kg from water, salt, carbs, digestion and, for many women, the menstrual cycle. Here is how much that noise is worth in kcal a day, for the trend line the check draws:

| Weigh-ins | Uncertainty, 1 SE (0.5 kg noise) | With 0.8 kg noise |
|---|---|---|
| **6 over 21 days (today's minimum)** | **±230 kcal/day** | ±368 |
| Daily for 21 days | ±139 | ±222 |
| 3 a week for 28 days | ±124 | ±199 |
| Daily for 28 days | ±90 | ±144 |
| Daily for 42 days | ±49 | ±78 |

A simulation with no real gap at all, only weight noise, gives how often the check would still suggest a change:

| Data | 0.5 kg noise | 0.8 kg noise |
|---|---|---|
| Today's minimum | **51%** | **68%** |
| Daily for 28 days | 10% | 30% |
| Daily for 42 days | 0% | 6% |

These numbers come from a simple model with independent daily noise. Real water swings come in runs of several days, which makes them worse. The 150 kcal threshold is smaller than the noise at the amounts of data the check accepts.

### 3.2 Uneven logging biases it

Intake is averaged over complete days only, but the weight trend covers every day. People tend to log fully on good days and skip the heavy ones. Then intake looks lower than it was, the scale looks "too high" for that intake, and the check concludes that maintenance is lower than it is. The target then gets cut for someone who mostly needs to log the weekend.

### 3.3 Other faults

| # | Problem | Effect |
|---|---|---|
| 3 | Hidden on Progress → Month, behind the calendar | Most people never see it |
| 4 | One-off: a single jump of up to 20% on one tap | No settling. The next check may jump back |
| 5 | Restarts its 28 days after each correction | After a change, nothing more can be said for three weeks |
| 6 | The first weeks after a goal change count | Starting a deficit drops 1 to 2 kg of water and glycogen in the first fortnight. It looks like a huge burn |
| 7 | 7,700 kcal per kg for every change | Fine for fat loss. Slow gain with strength training stores leaner tissue, which holds less energy per kg, so it underestimates surplus needs early on |
| 8 | Sick days are not excluded from the weight trend | Illness moves weight through fluid, not fat |
| 9 | No sense of why it is off | Could be logging, could be activity level, could be water. It can't tell, and the screen should say so |

---

## 4. What it should do

### 4.1 The model

Each week, Monday morning, using the last 6 weeks (minimum 4):

1. **Trend weight.** Use a robust line through the weigh-ins, the median of pairwise slopes, so one salty Sunday cannot tip it. Measure the person's own weigh-in noise from the leftover scatter instead of assuming one.
2. **Intake.** Average all days in the window. A day with partial logs counts as **unknown**, not as zero, and not as "skip and hope". If more than 20% of days are unknown, there is no update this week and the reason is shown.
3. **What the window says.** Observed maintenance = average intake − trend × 7,700 (§4.4 for gain), with its uncertainty from steps 1 and 2.
4. **Blend, don't jump.** Move the current estimate towards the observed one in proportion to how sure the observation is (a simple Kalman-style weight):

   ```
   weight  = prior uncertainty² / (prior uncertainty² + observation uncertainty²)
   new     = current + weight × (observed − current)
   ```

   The formula's maintenance is the starting point, with an uncertainty of about 12%. A noisy month moves the estimate a little; a clean six weeks moves it a lot.
5. **Limits.** At most ±100 kcal per weekly step, ±20% overall (as today), and never a target under the existing 1,500 / 1,200 floor or under BMR.
6. **Only real changes.** No change unless the gap is both over 100 kcal and over twice its own uncertainty.

Over a few weeks the estimate settles on the person's real working maintenance. It keeps following them as they lose weight and burn less, which a one-off correction cannot do.

### 4.2 What it leaves out

| Leave out | Why |
|---|---|
| The first 14 days after starting or changing a goal | Water and glycogen, not fat |
| Sick days and the 2 days after | Fluid shifts. The app already marks sick days |
| A weigh-in more than 2 kg off the trend | A scale error or a one-off, ignored and shown as ignored |
| Under-18s | Calorie targets are already off for them |
| Anyone who turned calorie numbers off | They chose not to see calories; the scale check stays off too |

### 4.3 When and how it changes the target

| Setting | Behaviour | Recommended for |
|---|---|---|
| **Suggest** (default) | Each Monday, if there is a change, the weekly wrap notification says so and a card on Today offers it: "Your target moves to 2,350 from Monday. Why?" One tap to accept, one to skip | Everyone at first |
| **Automatic** | Small weekly steps apply by themselves, with a note in the weekly wrap and an undo | People who have accepted a few suggestions |
| **Off** | Formula only | Anyone who prefers it |

The calorie screen always shows the target's source ("Formula", or "Learned from your last 6 weeks"), the history of changes, and **Back to the formula**.

### 4.4 Gaining weight

Weight gained during a surplus with training is partly lean tissue, which stores much less energy per kg than fat. Using 7,700 would conclude that the person burns far less than they do. For **Gain with build muscle**, the plan is to use a lower energy figure per kg, around 5,000 to 6,000, and to update more slowly. This needs the dietitian review already flagged for paces and protein.

### 4.5 Without food logs

Someone who weighs in but rarely logs food can still get a **pace check**, with no maintenance estimate: "You chose 0.5 kg a week; the last 6 weeks show 0.2. Eating about 230 less a day would close the gap." It assumes their eating stays the same, which the screen says.

---

## 5. Benefit to the user, honestly

### Who it helps

| Person | Benefit |
|---|---|
| Logs most days, weighs most mornings, on Lose | **High.** A plateau stops being a mystery. Their target matches what actually works for them, usually within 4 to 6 weeks |
| On Gain, struggling to put weight on | **High.** The commonest problem with gaining is under-eating against a formula that guessed low. This shows it with their own numbers |
| On Keep | **Medium.** Confirms a steady target; small corrections |
| Uses Health Connect active calories | **Medium.** Wrist estimates are often well off; this corrects the total without caring which part was wrong |

### Who it does not help, or could harm

| Person | Risk | What the plan does |
|---|---|---|
| Logs three days a week | Wrong conclusions from missing days | No update; says "log 6 days a week for 4 weeks to calibrate" |
| Weighs once a week | Too little to see a trend | No update until 4 weeks with at least 3 weigh-ins a week |
| Has, or is at risk of, disordered eating | A number that keeps tightening can feed obsession | Off by default for under-18s; never below the floors; never framed as failure; Off is one tap; no streaks or badges tied to it |
| Very large weekly swings (cycle, medication, creatine) | Noise | Measured per person; wider uncertainty means smaller, rarer changes |
| Wants the formula | Distrusts a moving target | Off, and Back to the formula, always available |

### What it doesn't do

- It doesn't measure metabolism. It measures what works for this person, logging habits included.
- It doesn't replace a dietitian or a doctor, and the app should say so next to it.
- It can't tell why the formula was off: logging, activity or water. The screen says "your working maintenance" and nothing more specific.

---

## 6. Feasibility

| Area | Assessment |
|---|---|
| Data | Already logged and stored on the phone: diet with kcal, workouts, steps, weight, sick days, goal history with dates |
| Maths | A robust slope, averages and one blend. Cheap, offline, and runs at app open |
| Where it lives | Extends `maintenanceCheck.js`. `maintenanceOffset` on the goal entry already applies from a date, so each weekly step is one new entry and history is kept |
| UI | A card on Today, a line in the weekly wrap, and a history in Settings → Body & goal. The weekly wrap notification already exists (`wrap_week`) |
| Testing | **The deciding piece.** Simulated users with a known true maintenance, realistic weight noise, logging gaps and holidays, to tune the limits so changes are rare when nothing changed and quick when something did |
| Effort | Medium. About the size of the net-calories work in v4.36 |
| Risk to existing users | Low if Suggest is the default and nothing changes without a tap |

---

## 7. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Weekly or monthly | **Weekly checks, small steps, 6-week window** | Monthly is slow to follow someone losing weight. Weekly with limits gets there smoothly |
| Default mode | **Suggest** | A target that moves by itself, unexplained, loses trust quickly |
| Automatic mode | **Offered after 3 accepted suggestions** | Earned trust, not a buried switch |
| Pace check without food logs | **Yes** | Helps the weigh-only users who get nothing today |
| Gain energy per kg | **About 5,500, after the dietitian review** | Avoids under-feeding people building muscle |
| Keep the current one-tap check during the change | **Replace it** | Two scale checks giving different answers would confuse |

---

## 8. Phases

| Phase | Work | Outcome | Size |
|---|---|---|---|
| **1. Make the current check safe** | Robust slope, the person's own noise, the 2× uncertainty rule, unknown days instead of skipped days, exclusions in §4.2, a simulator with tests | No more suggestions from noise. Can ship alone | Small |
| **2. Weekly learning** | The blend in §4.1, weekly steps with limits, a target-source line and history, Suggest card on Today and in the weekly wrap | The target follows the person week by week | Medium |
| **3. Automatic and pace check** | Automatic mode after 3 accepts, the pace check for weigh-only users, Gain energy figure after review | Less tapping; more people helped | Small |

Phase 1 is worth doing even if the rest never is: it fixes a check that is already in the app and is too eager.

---

## 9. Testing

- **Simulator** (unit tests): 1,000 synthetic people each, true maintenance off the formula by −20% to +20%, weight noise 0.3 to 1.0 kg, runs of water retention, 60% to 100% of days logged, weekend under-logging, a holiday week. Measure:
  - how often it changes the target when the formula was right (aim: under 5% of weeks),
  - how many weeks to get within 100 kcal when it was wrong (aim: 6 or fewer for daily loggers),
  - that it never crosses the floors or the 20% limit.
- **Edge cases:** goal change mid-window, sick week, scale swapped (a 2 kg step), no weigh-ins for 10 days, calorie numbers hidden, under-18.
- **On real data:** run it over the developer's own months of logs and compare its weekly path with what actually happened.

---

## Sources

Checked 2026-11-12. The noise and false-suggestion figures in §3.1 come from a short simulation of the current check's own rule (least-squares slope × 7,700, 150 kcal threshold). The rest is stated from general knowledge and was not re-read for this review:

- The 7,700 kcal per kg rule, and its overestimate of loss over months as the body adapts: Hall K. D. et al., "Quantification of the effect of energy imbalance on bodyweight", *The Lancet*, 2011.
- A smoothed weight trend instead of single weigh-ins: John Walker, *The Hacker's Diet*.
- Learning expenditure from intake and the weight trend is how adaptive-calorie apps such as MacroFactor describe their approach. Their method is not public, so nothing here copies it.
- Lean tissue holds much less energy per kg than fat, which is why §4.4 asks for a dietitian's figure rather than picking one.
