# Weekly AI Summary — Plan

A weekly counterpart to the daily AI health summary: one longer, more joined-up analysis of the whole week.

**Status:** planning only. Nothing here is implemented.

---

## Verdict

**Feasible, and mostly a matter of reuse.** The app already has everything a weekly summary needs: the AI connection used by the daily summary, a week's worth of data on the phone, and a Week tab that already calculates averages, wins, costs and one thing to fix.

The work is in three places:

1. **Deciding what the AI is for.** The Week tab already states facts and picks a fix by rule. The AI summary is only worth having if it does what rules cannot: connect things across days and across diet, sleep, movement and drinks.
2. **Shaping what is sent.** A week of raw logs is too much for the free AI models the app uses, and sends more personal data than needed. The app should send a compact digest, not the logs.
3. **Keeping the AI honest.** The app must calculate every number. The AI interprets; it must not do arithmetic or invent facts.

---

## 1. What exists today

| Piece | Where | Relevant behaviour |
|---|---|---|
| Daily summary | Full detail panel (Today, and a day in Progress → Month) | Generated on a button, never automatically. Cached per day. Needs the user's own API key |
| AI connection | `services/llmApi.js` | OpenRouter first, Groq as backup, free models, with fallbacks |
| Weekly numbers | `services/weeklyInsights.js` | Average, grade, change vs last week, wins, costs, best and hardest day, junk foods, one "What to fix" |
| Week screen | Progress → Week | Shows those numbers, with a week navigator |

The daily summary covers three pillars (diet, sleep, workout), one positive and one improvement each, plus tomorrow's focus.

---

## 2. What the weekly summary should add

It should not be seven daily summaries stapled together, and it should not restate the Week tab. It earns its place by answering questions that need the whole week:

- **Patterns across days.** "Your three lowest days all followed a night under six and a half hours."
- **Links between pillars.** "On days you walked after dinner, you also went to bed on time."
- **Weekday against weekend.** "Scores held on weekdays and dropped by about fifteen on Saturday and Sunday."
- **Direction.** Better or worse than last week, and where the change came from.
- **What actually moved the score.** Which habit cost the most points over the week, in total.
- **One plan for next week**, built from the above, with two or three specific actions.

### Proposed structure

```
This week in one line        the headline, with the average and the change

What went well               2–3 points, each tied to evidence from the week
What held you back           2–3 points, with what it cost
Patterns worth noticing      1–3 links across days or pillars
Compared with last week      where the change came from

Next week's plan             2–3 specific actions, most important first
```

Longer than the daily summary, but still a single screen of reading: roughly 150 to 220 words.

---

## 3. What gets sent to the AI

### Send a digest, not the logs

The app builds a compact, structured description of the week and sends only that. This keeps the request small enough for free models, sends less personal data, and makes the AI's job interpretation instead of counting.

**Proposed digest:**

| Section | Contents |
|---|---|
| Week | Dates, days logged, the user's category maximums |
| Score | Average, grade, change vs last week, best and hardest day |
| Per day (7 short rows) | Weekday, total score, the four category scores, steps, sleep hours and bedtime, dinner time, whether exercise and the post-dinner walk happened, junk items, drinks total against goal |
| Diet | Days with breakfast, late dinners, junk-food days and the top junk items, average calories against target when known |
| Fasting | Average window, days at target |
| Movement | Average steps, days at the step target, exercise sessions by type |
| Sleep | Average hours, average bedtime and wake time, how consistent they were, nights after midnight |
| Drinks | Average against goal, days the goal was met |
| Weight | Change over the week, when two or more weigh-ins exist |
| Already calculated | The wins, costs and "What to fix" from the Week tab |
| Last week | The same headline numbers, for comparison |

The per-day rows are what make pattern-finding possible. Seven short rows are cheap; seven days of food lists are not.

### What is deliberately left out

- **The full food list for each day.** Only junk items and counts go.
- **Free-text notes.** They can contain anything personal. See the decision in section 8.
- **The user's name**, and anything else that identifies them.

### Numbers the app must fix first

The daily summary's request currently states the category maximums as fixed numbers (35, 35, 30) even though they are adjustable in Settings. The weekly request should send the user's real maximums, and the daily one should be corrected at the same time.

---

## 4. Keeping it accurate

AI summaries fail in a few known ways. Each needs a specific guard.

| Risk | Guard |
|---|---|
| Wrong arithmetic | Every number is calculated by the app and given to the AI. The instructions say to quote numbers, not compute them |
| Invented patterns | The instructions require each pattern to name the days it is based on, and to leave the section out when the data does not support one |
| Too little data | Below a minimum number of logged days, no summary is offered (decision in section 8) |
| Forced negatives | As in the daily summary: no weakness is invented when there is none |
| Medical claims | No diagnoses, and nothing about weight, fasting or fluids phrased as medical advice |
| Contradicting the Week tab | The app's own wins, costs and "What to fix" are included in the digest, so the AI builds on them instead of reaching a different conclusion |
| Guilt-heavy tone | Same plain wording as the rest of the app: "cost you points", "hardest day" |

One further check is possible after the reply arrives: confirm that the weekly average quoted in the text matches the app's figure, and discard the reply and retry once if it does not. This is cheap and catches the worst kind of error.

---

## 5. Where it lives and how it behaves

**Place:** Progress → Week, as a card under "What to fix" and above "Why". It follows the week navigator, so any past week can have one.

**Behaviour, matching the daily summary so there is one pattern to learn:**

- **On a button**, never automatic. "Generate weekly summary."
- **Cached per week**, so reopening shows it instantly.
- **Regenerate** is available.
- **No key set:** the card explains that an AI key is needed, with a link to Settings.
- **Offline or failed:** a plain message and a retry. The rest of the Week tab is unaffected.

**The current week needs a rule,** because it is unfinished and changes every day:

- A summary generated mid-week is labelled as covering the days so far ("Mon to Thu").
- When more days are logged afterwards, the card says the summary is out of date and offers to refresh. It does not refresh by itself.
- Completed weeks never go stale.

**Sharing:** the Month tab can share a day as an image. The same could apply to the weekly summary. Useful, but not needed for a first version.

---

## 6. Notifications

The app already sends a weekly wrap notification on Sunday evening. It could point to the summary: "Your week is ready to review."

It should **not** generate the summary in the background. That would use the user's AI quota without them asking, and it would be a network call the user did not start, which the app avoids everywhere else. The notification can invite; the user taps to generate.

---

## 7. What changes in the code

| Change | File |
|---|---|
| Build the weekly digest from the week's logs | new `services/weeklyDigest.js`, with tests |
| Weekly prompt and a `generateWeeklySummary()` function | `services/llmApi.js` |
| The summary card: button, loading, result, regenerate, stale notice | new `components/WeeklySummaryCard.jsx` |
| Place the card on the Week tab and pass it the week's data | `pages/Progress.jsx` |
| Per-week cache, with the stale check | alongside the daily cache |
| Send real category maximums in the daily prompt | `services/llmApi.js` |
| Optional: Sunday notification wording | `services/trendNotificationEngine.js` |

**Reuse:** the AI connection, the summary text renderer in `DayDetail.jsx` (it should move to a shared component), and all of `weeklyInsights.js`.

**Data the Week tab does not load yet:** drinks and weight for the week. Both are small reads.

**Size:** small to medium. The digest builder is the main new logic and is fully testable without an AI key. The card is a variation of the daily one.

---

## 8. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Minimum days logged before a summary is offered | 4 of 7 | With fewer, "patterns" are guesses. The Sunday notification already uses the same threshold |
| Include the user's free-text notes? | No, by default | Notes can hold anything personal, and they go to an outside service. Could be a switch later |
| Include drinks and weight? | Yes | "Holistic" is the point, and both are now tracked. They are left out when there is no data |
| Generate automatically on Sunday? | No, on a button only | It spends the user's quota and makes an unrequested network call |
| Allow summaries for past weeks? | Yes | The navigator already goes back, and the data is there |
| Summary for the unfinished current week? | Yes, labelled "so far" | People will want it on a Friday. The stale notice covers the rest |
| Where is the cache kept? | In the app's database, not browser storage | So it is included in backups and survives a reinstall. The daily summary's cache could move there too |
| Length | About 150 to 220 words | Long enough to connect things, short enough to read in one go |

---

## 9. Privacy

This sends more data to an outside AI service in one request than anything else in the app: a week of scores, sleep times, steps and eating patterns. It goes to OpenRouter or Groq, using the user's own key, exactly as the daily summary does.

- It only happens when the user taps the button.
- The digest is designed to send summaries, not raw logs, and no name.
- The card should say, once and briefly, that generating a summary sends the week's figures to the AI provider. The daily summary does not currently say this, and should gain the same line.
- With no key set, nothing is ever sent.

---

## 10. Limits to be honest about

- **Free models vary.** Quality and availability change, and the app already falls back through several. A weekly summary is a harder task than a daily one, so weak models will show more. Worth testing each fallback model with the same digest.
- **It is not a coach.** It sees one week of numbers. It cannot know about illness, travel or a bad week at work unless notes are included.
- **It cannot be fully tested without a key.** The digest builder can be tested completely. The AI's output can only be checked by running it.
- **Two summaries, two voices.** The daily and weekly summaries are separate requests and may phrase things differently. Sharing the same instructions on tone keeps them close.

---

## 11. Phases

| Phase | Work | Outcome |
|---|---|---|
| 1. Digest | The digest builder and its tests; load drinks and weight for the week | The week described accurately in a compact form. No AI yet |
| 2. Summary | The weekly prompt, the card, button, cache and regenerate | A working weekly summary on the Week tab |
| 3. Trust | The stale notice for the current week, the average check, the privacy line, real maximums in the daily prompt | Accurate and clearly labelled |
| 4. Extras | Sunday notification wording, share as image | Optional |

Phases 1 to 3 are the feature. Phase 4 can wait.

---

## 12. Testing

- **Digest:** unit tests against a known week. Averages, counts, weekday and weekend split, a week with missing days, a week with no drinks or weight data, custom category maximums.
- **Below the minimum:** the card offers no summary and says why.
- **Cache:** a completed week reopens instantly; the current week shows the stale notice after another day is logged.
- **No key, offline, failed request:** each shows the right message, and the Week tab still works.
- **Real runs:** with a key, generate summaries for a strong week, a poor week and a mixed week, on each fallback model, and check every number in the text against the Week tab.
- **Privacy:** inspect the outgoing request and confirm it contains no name, no notes and no full food lists.
