# AI Nudges — Plan

Personal, well-timed notifications written with the user's own AI key, for people who switch them on.

**Status:** all six phases are implemented in v4.37. At release, nothing had been run on a real phone or against a real AI provider. See "How it was built" at the end for where the build differs from this plan.

**Scope note:** "notification panel" is read here as the notifications the app sends to the phone, plus the Reminders screen that controls them. The app has no in-app notification list today. Section 8 proposes a small one.

---

## Verdict

**Worth building, but AI is not the first fix, and it should not decide anything.**

The notifications feel basic for two separate reasons:

1. **The wording is fixed.** AI can solve this.
2. **The engine is blind in several places.** Reminders fire whether or not the job is done, the people who most need a nudge cannot receive one, and one rule reads the wrong night's sleep. AI cannot solve this. Better-worded notifications would still arrive at the wrong time.

The recommended design is **rules decide, AI writes**:

- **The app decides** whether to notify, when, about what, and which numbers are true. This runs on the phone, works offline and can be fully tested.
- **The AI only turns those facts into a short message** in the user's context. It never picks the time, sees raw logs or supplies a number.
- **Every notification has a plain rule-written version.** If the AI is off, offline, slow, rate limited or wrong, that version goes out and the user never notices.

The AI cannot run at the moment a notification fires, because the app has no server and no background job. So messages are **written ahead while the app is open**, then scheduled. Most of this plan's design follows from that one limit.

---

## 1. What exists today

### Inventory

| Source | File | IDs | Count | Behaviour |
|---|---|---|---|---|
| Fixed reminders | `services/reminders.js` | 1–26 | 12 | Repeat daily at a set time |
| Smart nudges | `services/notificationEngine.js` | 30–35 | 6 | One-shot, planned for today only |
| Trend alerts and wraps | `services/trendNotificationEngine.js` | 40–44 | 5 | One-shot score comparisons |
| Post-dinner walk | `services/reminders.js` | 6 | 1 | One-shot, Coach only |

That is 24 fixed message templates. Standard sends at most 3 a day. By my count Coach can send about 20 on an ordinary day.

### Faults found in the code

These were found by reading the code, not by watching a phone.

| # | Fault | Where | Effect |
|---|---|---|---|
| 1 | **Fixed reminders never check anything** | `reminders.js:62-98` | "Log your lunch" arrives after lunch is logged. Water reminders ignore the drinks total. "Stop your sleep timer" arrives with no timer running |
| 2 | **Planning only runs on a fresh app start, after a save, or when the sleep timer stops** | `App.jsx:66-68`, `Log.jsx:42-43`, `Today.jsx:269-270` | Nothing listens for the app returning to the foreground; `@capacitor/app` is installed but not imported anywhere in `src`. A day with no fresh start and no save gets no smart nudges at all |
| 3 | **The comeback nudge cannot reach its audience** | `notificationEngine.js:127-136` | "Back on track?" needs 2 missed days, and is only scheduled if the app is opened that same morning before 10 AM. Someone who has drifted away does not open the app, and someone who opens it does not need the message |
| 4 | **The wraps have the same problem** | `trendNotificationEngine.js:303-316` | The download page says everyone gets the weekly and monthly summary, but the weekly one is only scheduled if the app ran on Sunday before 8 PM, and the monthly one has the same limit on the last day of the month |
| 5 | **Sleep Risk reads the wrong night** | `notificationEngine.js:102`, `sleepTimer.js:61` | Sleep rows are dated by wake-up day. Stopping the timer this morning makes today's row look like "sleep started", so tonight's alert is cancelled for exactly the people who use the timer. A timer running tonight is not checked at all |
| 6 | **On Standard, Sleep Risk takes the one daily slot** | `notificationEngine.js:184-197` | Sleep Risk ranks first. For anyone with no sleep row today, it beats dinner, steps, comeback and breakfast until 11:15 PM |
| 7 | **Sick days are ignored** | all three engines | This is phase 4 of `sick_days_plan.md`. "Back on track?" can also fire straight after marked sick days, because sick days have no score |
| 8 | **Numbers and times are hard-coded** | `notificationEngine.js:95,102,114`, `trendNotificationEngine.js:64-68` | "5 pts", 4,000 steps, 11:15 PM and "~10 pts" ignore the user's Settings and their real bedtime |
| 9 | **Tapping does nothing specific** | no listener in `src` | A tap opens the app wherever it was. The "notification deep links" mentioned in `revamp_plan.md` do not exist |
| 10 | **Nothing is recorded** | no table | The app cannot tell what was sent, tapped or ignored, so the "reduce if ignored" rule in `notification.md` cannot work |
| 11 | **Timing is probably inexact** | `AndroidManifest.xml:64-70`, plugin `setExactIfPossible` | Neither the app's manifest nor the plugin's declares an exact-alarm permission, so on Android 12+ the plugin falls back to non-exact alarms. Repeating reminders use a plain `set`, which Doze can delay. The FAQ in `index.html` tells users to allow exact alarms. Needs confirming on a phone |

### What the nudges never mention

Streaks, badges close to unlocking, quests, fasting, drinks, weight, the user's onboarding goal, and any pattern from their own history beyond counting late dinners and missed breakfasts. The app holds rich data and uses very little of it here.

### Tone

Some wording is at odds with the softer language from the revamp: "You usually miss dinner timing", "Sleep Risk", "⚠️ Dinner Risk".

---

## 2. A critical look at the AI APIs

Checked on 2026-11-01 against the live OpenRouter model list and the official docs. Free-tier details change often, so recheck them before building.

### Finding that affects the app today

**Three of the four OpenRouter models hard-coded in `llmApi.js:13-18` are no longer on OpenRouter's public model list.** Only `google/gemma-4-31b-it:free` is still listed. Missing: `meta-llama/llama-3.3-70b-instruct:free`, `openai/gpt-oss-20b:free`, `nvidia/nemotron-nano-9b-v2:free`.

Every food lookup and daily summary through OpenRouter currently tries models in that order, so it most likely wastes attempts before reaching the one that works. If Gemma is busy, it drops to Groq, or fails if there is no Groq key. The docs do not say whether failed requests count against the daily limit. A hard-coded free-model list will keep going stale, and one model on today's list already shows an expiry date of 2026-12-31. Phase 0 fixes this.

### Provider comparison

| | OpenRouter (free models) | Groq |
|---|---|---|
| Daily limit | **50 requests**, or 1,000 after buying 10 credits. 20 a minute | gpt-oss models: 1,000 requests and 200K tokens a day, 8K tokens a minute. The docs list these as Developer-plan base limits; third-party pages report the same for free, unconfirmed. The console shows the account's real limits |
| Check remaining quota | `GET /api/v1/key` returns `free_model_daily_requests` | Response headers |
| Guaranteed JSON | Varies by host. Of 14 free models, 7 advertise `response_format` and 4 advertise `structured_outputs` | `strict: true` guarantees the schema on both gpt-oss models the app already uses |
| Model stability | Low, as shown above | Better, though the code notes earlier models were shut down in August 2026 |
| Data handling | Varies by host. A third-party review says about half of free models run on hosts that may train on prompts; not verified against OpenRouter. Has `provider.data_collection: "deny"` and `provider.zdr`. The docs do not say what happens if nothing matches, and each free model I checked has a single host, so this could leave few or none | Docs: not retained by default; logged up to 30 days only for abuse or reliability work; zero retention available in settings. Training is not mentioned |

**Conclusion:** for nudges, try **Groq first**, then OpenRouter with `data_collection: "deny"`. This is the opposite of the order used for food lookups and summaries, for good reason: this feature runs without the user pressing a button and sends behaviour data, so privacy and predictability matter more.

### Capabilities, and whether to use them

| Capability | Use it? | Why |
|---|---|---|
| Rewriting facts into natural language | **Yes** | This is what these models do reliably, including on small free ones |
| Choosing among a few rule-approved angles | **Yes** | "Which of these three facts would land best tonight?" adds value at low risk |
| Structured JSON output | **Yes, with a fallback** | Use strict mode where available and still validate. `extractJson` stays for models without it |
| Variety across days | **Yes** | Send the last few messages so it does not repeat itself. Needs a higher temperature than the fixed `0.2` in `callChat` |
| Quota check before calling | **Yes** | Automatic calls must never use up the daily requests the user needs for food lookups |
| Deciding when to notify | **No** | Must work offline and be testable. Adding up to 3 notifications a day is not a job for a free model that can change next month |
| Doing arithmetic or finding patterns | **No** | The app calculates these exactly and cheaply. The model would be slower, costlier and sometimes wrong |
| Function calling, so the AI can query data | **No** | More data leaves the phone, more calls, more failure. A small prepared digest is enough |
| Medical or dietary advice | **No** | Outside what the app should claim, and riskiest in a notification, where there is no room for context |
| Free conversation inside notifications | **No** | The notification reply box still has to open the app, and a chat coach is a separate product |
| Streaming, images, audio | **No** | Nobody is watching the message appear |

### Gaps in the app's own AI code

`callChat` has no timeout, so a hung request can stall the whole chain. It also has no `max_tokens`, no temperature or system message options, and no quota check. Failing fast matters more for an automatic feature than for one the user is waiting on.

---

## 3. How it fits together

```
App opens, returns to foreground, or a log is saved
        │
        ▼
1. FACTS       Build today's facts and history (no AI, no network)
        │
        ▼
2. DECIDE      Rules choose triggers, times and budget
               Sick day, quiet hours, ignored too often → drop
        │
        ▼
3. SCHEDULE    Book every slot straight away with rule-written text
        │
        ▼  only if switched on, online, in budget, and facts changed
4. WRITE       One AI call for all open slots
        │
        ▼
5. CHECK       Validate each message. Fail → that slot keeps its rule text
        │
        ▼
6. UPGRADE     Re-book passing slots with the same ID and time
        │
        ▼
7. RECORD      Log what fired, what was tapped, what was done afterwards
```

Step 3 comes before step 4 on purpose. The notification is safe before any network call starts, and if the user closes the app mid-request, nothing is lost.

### Three kinds of fact

The risk with messages written ahead is that they go stale. Each fact is labelled, and the rules only offer a future slot facts that cannot go out of date.

| Kind | Examples | Allowed in a message written ahead? |
|---|---|---|
| **Fixed history** | Last week's average, how many early dinners this fortnight, usual bedtime | Yes |
| **Fixed rules** | Penalty size, step target, points needed for a grade | Yes |
| **Live today** | Today's steps, today's score | **No**, unless the message is sent immediately |

Most of today's state can only change while the app is open, because logging happens in the app. So the existing rule of re-planning after each save already keeps meals and sleep correct. **Steps are the exception**, since they rise with no app open. "Only 1,200 steps" written at noon may be false at 6 PM, so step nudges speak of the target and the habit, not the current count.

### Reaching someone who has not opened the app

This fixes faults 2, 3 and 4, and needs no AI or background job. Scheduled alarms stay on the phone until they fire, and the notification plugin registers for reboot, which needs confirming on a phone.

- **Each plan books ahead,** covering today and the next two days, with slots marked to be replaced at the next open.
- **Comeback messages are booked in advance** for day 3 and day 7 of silence. Every open cancels and rebooks them, so they only ever fire for someone who really stayed away.
- **After day 7, nothing.** A person who has left should not be chased.
- **Wraps are booked ahead** for the coming Sunday and month end. If the app stays closed, they use whatever was last known and ask the user to open the app, rather than quoting a total.

The only thing lost is freshness, and that is the right loss to accept.

### Bedtime and other repeating reminders

Android's repeating alarm cannot skip one occurrence, which is why these reminders are blind. Replace them with one-shot reminders booked 7 days ahead, using a new ID range (60–89). Then they can skip a sick day or a night the timer is already running. If the app stays closed for over a week, even the bedtime reminder goes quiet, which matches the comeback rule.

---

## 4. The nudges

Each entry is a trigger the rules detect. The examples show AI wording and are illustrative, with made-up numbers.

| Nudge | Fires when | What makes it land | Example |
|---|---|---|---|
| **Decision moment** | Shortly before the user's own usual dinner, bed or walk time, if not done yet | Timing learned from their logs instead of a fixed 8:30 PM | "Dinner before 9 keeps 5 points tonight. You usually eat around 9:10, so starting now is enough." |
| **Your own evidence** | A pattern in their data passes the checks below | Their own record persuades better than general advice | "On your 6 early-dinner days this fortnight you averaged 84, against 71 on the others." |
| **Near win** | Within reach of a grade, badge, quest or weekly target | People push harder as a goal gets close | "One more 8,000-step day finishes this week's walking quest." |
| **Streak guard** | Streak is alive and today has nothing logged by evening | Protects something already earned, without alarm | "12 days and counting. Logging today's meals keeps it going." |
| **If-then plan** | Weekly: the user picks a plan for their biggest cost. Later nudges quote it back | The best evidenced item here. See below | "Your plan: if dinner runs late, have dal and skip the snack." |
| **Noticed progress** | A real improvement, with nothing asked of the user | Encouragement without a demand. Extends ID 42 | "Third morning running with breakfast before 9. That's new this month." |
| **Fresh start** | Monday, the 1st, or the first day after sick days | New beginnings are natural moments to restart | "New week. Last week's biggest cost was late dinners, so that's the one to watch." |
| **Comeback** | Day 3 and day 7 of silence, not sick | One tiny ask and no guilt | "No catching up needed. Just log today's breakfast if you feel like it." |
| **Wrap** | Sunday and month end | Offers a single takeaway, and links to the weekly summary if that is built | "Your steadiest week so far: 5 nights in bed before 11:30." |

### Pattern checks

The pattern finder is the part that makes nudges feel expert, and also the easiest to get wrong. With few days of data, comparing many habits will turn up false patterns.

- A fixed, short list of pairs: dinner time and sleep score, bedtime and next-day steps, breakfast and diet score, walk and bedtime, screen time and sleep.
- At least 5 days on each side, and a gap large enough to be worth saying.
- Wording says "on days when", never "because". It reports a correlation, not a cause. This is enforced in the prompt and spot-checked in testing.
- A pattern already shown is rested for 14 days.

### Evidence behind this

Keep expectations modest:

- **Timing and context.** Research on adaptive health interventions treats a person's state and their *receptivity*, their ability to take in and use support at that moment, as core design elements (Nahum-Shani et al.; Künzler et al.).
- **Fading effect.** In the HeartSteps trial, tailored walking suggestions raised steps in the next 30 minutes by about 24% overall, and by far more early on, with the effect falling over the 42 days. It was a small study of about 44 people. This supports both low volume and varied wording, but it does not show that AI wording stops the fade.
- **If-then plans.** Meta-analyses find small to medium effects: about 0.31 for physical activity and 0.33 for healthy eating, with simple, specific plans doing better than complex ones. Worthwhile, but not magic.

### Deliberately excluded

Fake urgency, repeated escalation, guilt, random rewards designed to keep people checking, public comparison, and any increase in volume. The aim is for the user to keep notifications on after three months, not to maximise opens.

---

## 5. The AI call

### One call per plan, not one per notification

A single request writes all open slots. This keeps quota use low.

| Limit | Value | Why |
|---|---|---|
| Normal calls | 1 at the first plan of the day | Most days need no more |
| Refresh | 1 more if facts change meaningfully after 3 PM | Evening nudges matter most |
| Hard cap | 3 a day | Protects quota against bugs and frequent saves |
| Skip if OpenRouter remaining is below | 10 | Food lookups and summaries the user asks for come first. 50 a day is not much |
| Timeout | 20 seconds per attempt | It runs in the background and rule text is already booked |
| Attempts | At most 2 models | Automatic calls should not burn through the chain |
| Size, rough estimate | 1,000 to 1,500 tokens per call | Instructions, digest and about 300 tokens of output. To be measured |

### What is sent

Only the facts for the open slots, plus a little shared context.

```json
{
  "context": { "goal": "fat_loss", "day": "Tuesday", "tone": "plain" },
  "recent_messages": ["New week. Last week's biggest cost was late dinners..."],
  "slots": [
    {
      "id": "dinner_window",
      "purpose": "Encourage an earlier dinner tonight",
      "facts": {
        "penalty_points": 5,
        "cutoff": "21:00",
        "usual_dinner": "21:10",
        "early_dinner_days_14d": 6,
        "avg_score_early": 84,
        "avg_score_late": 71
      }
    }
  ]
}
```

**Never sent:** name, age, height, weight, free-text notes, individual foods, exact dates, the sleep log itself, or anything from other apps. The onboarding goal is sent as a fixed option, not free text.

### What must come back

```json
{ "messages": [ { "id": "dinner_window", "title": "...", "body": "..." } ] }
```

### Instructions to the model, in outline

- Write one message per slot from its facts only. Do not add facts, and do not calculate anything.
- Title up to 35 characters, body up to 130. Numbers as digits.
- Plain and warm, like a sensible friend who knows the numbers. No guilt, no exclamation marks, at most one emoji.
- Say "on days when", never "because". Do not mention medical conditions, diagnosis, weight loss claims, or eating less.
- Do not repeat the wording in `recent_messages`.

### Checks on every reply

The reply is treated as untrusted. Each message is checked separately, and a failure affects only that slot.

| Check | Catches |
|---|---|
| Valid JSON, and the ID matches a slot | Malformed replies, invented slots |
| Length limits | Text cut off in the notification shade |
| **Every number in the text exists in that slot's facts** | Invented or miscalculated figures. This is the most important check |
| Blocked terms: diagnosis, disease, cure, starve, skip meals, "you failed", and similar | Medical claims and shaming. The list is small and maintained by hand |
| No links, phone numbers or email addresses | Odd model output |
| Not too similar to a recent message | Repetition |

The AI's text is display-only. **The tap destination always comes from the rule,** so a bad reply can produce an odd sentence but cannot trigger an action.

### Model list

The hard-coded list becomes a starting value. When a key is set, fetch `GET /api/v1/models` at most once a week and keep free models that advertise `response_format`, have no near expiry date, and are not specialised for code or content safety. `openrouter/free` appears in the model list but not in the routing docs I read, so try it during testing before relying on it.

---

## 6. Timing and budget rules

These apply to everyone, with or without AI.

| Rule | Value |
|---|---|
| Daily maximum | Quiet, Standard and Coach keep their current meaning. **AI never adds to the count** |
| Minimum gap | 2 hours between notifications, already specified in `notification.md` |
| Quiet hours | Nothing between the user's bedtime and wake time |
| Already done | Cancelled at the next plan |
| Sick day | Everything cancelled. One gentle note next morning, as in `sick_days_plan.md` section 5 |
| Priority | Replaces today's fixed order, so that Sleep Risk stops always winning. Highest points at stake that can still be recovered today, then least recently sent |
| Own times | Bed, dinner and wake times from Settings, then learned from the last 14 days of logs |

Coach mode's 20 a day is itself a problem, and this design should bring it down to about 6. That is a change to what Coach means, so it is listed as a decision.

---

## 7. Learning from responses

There are too few notifications for clever methods. One person gets around 90 a month across 9 types, so a bandit or a model would mostly be fitting noise. Use simple rules.

| Signal | How it is known |
|---|---|
| **Tapped** | Plugin event, once a listener exists |
| **Acted** | The matching log appears within 2 hours. This is inferred and can be coincidence |
| **Ignored** | Neither of the above. A dismissal cannot be reliably detected |
| **Rated** | Helpful or not, in the recent list |

| Rule | Action |
|---|---|
| 3 ignored in a row on one type | Rest that type for 7 days |
| Rated "not helpful" twice | Turn that type off, and show that in Reminders so it can be undone |
| More than 80% ignored over 14 days | Drop to one every other day, and say so once in the app |
| Consistently done late | Move that nudge later or earlier using the user's actual times |

**Does the AI actually help?** On about 1 in 5 days, send the rule text even when AI text is available, then compare tap and acted rates on a small screen in Developer settings. This is local-only, since the app has no analytics, and will be directional at best for one person. It is still better than assuming.

---

## 8. What the user sees

### Settings → Reminders

The mode choice stays as it is. Below it, a new card, shown even with no key set:

> **AI-written nudges** (off by default)
> Messages based on your own patterns, in place of fixed reminders. You still get the same number of notifications.
> *Sends summary figures, such as average scores and usual times, to your AI provider about once a day. Never your name, notes or food list.*
> [See exactly what is sent]

- **No key:** the switch is disabled, with a link to the AI key section. Nothing else changes.
- **See exactly what is sent:** shows the last request, or a sample one, as readable text. This builds more trust than a promise does.
- **Off again:** the next plan goes back to rule text straight away.

### Recent nudges

The in-app list that does not exist today. Under Reminders, not on Today, to avoid adding clutter that the earlier critique removed.

- The last 14 days: text, time, whether it was AI or rule-written, and helpful or not buttons.
- Each entry answers "why did I get this?" in one line, using the rule that fired.

### On the notification itself

| Feature | Plugin support | Plan |
|---|---|---|
| Tap opens the right screen | Yes, through `extra` and a listener | **Yes.** Dinner opens Add Meal, bedtime opens Today. `nextAction.js` already has this target format |
| Expanded text | Yes, `largeBody` | **Yes,** for evidence nudges with a second sentence |
| Separate channels | Yes | **Yes.** Reminders, Nudges and Summaries, so Android can mute each one separately |
| Lock-screen privacy | Yes, on the channel | **Yes.** Personal figures should not show on a locked phone. Nudges use private visibility |
| Action buttons | Yes, but they open the app | **Not in the first version.** A "Done" button that opens the app gains little over a tap |

---

## 9. Privacy and safety

- **Bigger change than the daily summary.** Today, data only leaves the phone when the user presses a button. This feature sends data automatically about once a day, so it needs its own off-by-default switch and clear wording. The app's "offline" message on the download page and in the README must be updated to say so.
- **Provider policies vary and change.** The app cannot guarantee a provider's behaviour. It can send less, prefer the stricter route, and be open about it.
- **No silent downgrade.** If `data_collection: "deny"` leaves no usable OpenRouter model, nudges stay rule-written. The privacy setting is not relaxed to make them work. The screen should say why.
- **Food and fasting.** Nudges must never suggest eating less, skipping a meal or extending a fast. Dinner nudges are about eating earlier. The app does not know about eating disorders, pregnancy, diabetes or medication, so the safe default is to avoid those instructions entirely.
- **Sleep and fluids.** No medical framing. Drinks nudges treat the goal as a rough guide, the same way the Drinks screen does, and never push someone to drink more than it.
- **Illness and bad weeks.** Rules stop everything on a marked sick day. For unmarked bad days, the budget and tone rules keep it gentle, and the model is never told to push harder.
- **Injection.** Free text is never sent, so a food name or note cannot steer the prompt, and replies cannot trigger actions.

---

## 10. What changes in the code

| Change | File |
|---|---|
| Timeout, options, quota check, model refresh, per-feature provider order | `services/llmApi.js` |
| Facts builder | new `services/nudgeFacts.js` |
| Pattern finder | new `services/nudgePatterns.js` |
| Decision engine: pure, takes `now`, like `nextAction.js` | new `services/nudgeEngine.js` |
| Prompt and reply validator | new `services/nudgeWriter.js` |
| Booking, horizon, channels, ID ranges | `services/reminders.js`, replacing most of `notificationEngine.js` and the daily part of `trendNotificationEngine.js` |
| Foreground listener and tap routing | `App.jsx`, using `@capacitor/app` |
| Sleep Risk reading tonight's state, including the running timer | `nudgeFacts.js` using `sleepTimer.js` |
| `nudge_log` table, Dexie version 7 | `services/db.js`, `services/localStore.js`, and JSON backup and restore in `pages/Settings.jsx` |
| Switch, preview, recent list | `pages/Settings.jsx`, or a new component since Settings is already large |
| Exact-alarm decision, and matching FAQ wording | `AndroidManifest.xml`, `index.html` |
| Offline claim wording | `README.md`, `index.html` |

**Migration:** on upgrade, cancel the old repeating IDs and book the new one-shots, using the same one-time pattern as `migrateFixedReminders`. This is the riskiest step: a mistake could leave duplicates or silence. It needs a real phone with the previous version installed.

---

## 11. Decisions for you

| Decision | Recommendation | Why |
|---|---|---|
| Do phase 1 for everyone, including people with no key? | **Yes** | Those faults affect every user, and AI depends on them being fixed |
| New mode, or a separate switch? | **Separate switch** | It changes who writes the words, not how many are sent |
| AI nudges in Quiet mode? | **Wraps only** | Quiet promises very little, and should stay that way |
| Reduce Coach from about 20 a day to about 6? | **Yes** | 20 a day cannot feel expert. It does change what existing Coach users get, and they should be told once |
| Provider order for nudges | **Groq first, then OpenRouter with `deny`** | Stricter JSON, clearer data policy, higher limits |
| Ask for exact alarms? | **Not for nudges.** Decide for bedtime after phone testing | A few minutes' drift is fine for a nudge, and Google restricts this permission. The FAQ should change either way |
| Allow scheduling a background worker? | **Not now.** See phase 5 | The booking-ahead design covers most of the need at far less risk |
| Keep nudge text in backups? | **Yes,** with 90-day pruning | Same reason as sick days: a table left out of backups is lost on restore |
| Default for new users | **Off** | It sends data automatically, so it must be a choice |

---

## 12. Limits to be honest about

- **Reach.** Only people with their own API key can use the AI part, and most users won't have one. This is the strongest reason to get phases 1 and 2 right, since they reach everyone.
- **AI may not beat good templates.** No evidence found here shows AI wording outperforms well-written, data-filled rule text. The personal facts probably do most of the work. Section 7's comparison exists to find out, and phase 2 is useful either way.
- **Messages cannot react to the moment.** They are written when the app was last open. With no server, nothing can respond to something like an unusually active afternoon.
- **Android can still delay or block.** Battery savers on some brands can hold back or clear alarms. No design avoids this entirely.
- **Free models change.** Quality varies and models vanish, as the 3 missing ones show. Validation guards against bad text but cannot make it good.
- **Testing is partly out of reach.** I cannot judge real AI output without a key, or real delivery without a phone.

---

## 13. Phases

| Phase | Work | Outcome | Size | Needs AI? |
|---|---|---|---|---|
| 0. Connection | Replace missing models, add timeout, quota check and options | Food lookups and summaries become more reliable too | Small | Key to test |
| 1. Foundation | Foreground listener, Sleep Risk fix, sick days, Settings values, tap routing, channels, one-shot booking ahead, comeback, wraps, `nudge_log`, new priority order | Every user gets notifications that check before firing and can reach someone who has stopped opening the app | Medium to large | No |
| 2. Smarter rules | Facts builder, pattern finder, near win, streak guard, fresh start, noticed progress, recent list | Personal notifications for everyone, written as templates | Medium | No |
| 3. AI writes | Switch and consent, preview, digest, prompt, validator, upgrade step | AI wording for people who opt in, with rule text as the safety net | Medium | Yes |
| 4. Learning | Rest rules, ratings, AI against rule comparison, if-then plans | Fewer ignored notifications, and evidence on whether AI helps | Small to medium | Partly |
| 5. Background worker (optional) | Native WorkManager job | Fresh messages on days the app is not opened | Large | Yes |

**Phase 5 should probably not be built.** Android can run a job with no app open, but with a 15-minute minimum and no guaranteed timing, and Doze may delay it or cut its network access. The app's data sits in the WebView's IndexedDB, which native code cannot read, so the app would have to copy a digest and the API key into native storage. It would also make network calls with the app closed, which is a bigger privacy step, and could only be tested on real phones across brands. Decide only after phases 1 to 4 show how often the booked-ahead text is too stale to be useful.

The weekly AI summary in `weekly_ai_summary_plan.md` can share phase 0 and the digest approach. Whichever is built second gets cheaper.

---

## 14. Testing

- **Decision engine:** unit tests with `now` passed in, for each fault in section 1. Examples: timer stopped this morning and tonight's alert still fires; timer running and no alert; a sick day sends nothing; a score-less sick spell does not trigger the comeback; the budget and 2-hour gap hold in each mode.
- **Patterns:** known fixtures, including below-threshold samples and sick days, to confirm that nothing weak gets through.
- **Validator:** a set of bad replies: invented numbers, medical claims, wrong IDs, too long, not JSON, wrapped in code fences.
- **Failure paths:** no key, offline, timeout, 429, quota low, every model failing. Each must leave the rule text booked and show no error to the user.
- **Privacy:** inspect the outgoing request and confirm it holds no name, notes or food list. Confirm that with the switch off, no nudge request is made at all.
- **Real output, needs a key:** run about 20 sample digests through each candidate model. Record how many pass validation and read them for tone. Drop any model below an agreed pass rate. Test `data_collection: "deny"` to see what it does with free models.
- **On a real phone, none of this can be done in a browser:**
  - Upgrade from the previous version: no duplicates and no silence.
  - Leave the app closed for 3 and 7 days: comeback fires once each, then silence.
  - Reboot: booked notifications survive.
  - Tap: the right screen opens, from both a closed app and a backgrounded one.
  - Locked phone: figures are hidden.
  - Measure real delay of inexact alarms, and test a brand with an aggressive battery saver.
- **Living with it:** a two-week trial on your own phone before release. The real test is whether you keep it on.

---

## How it was built

Where the build differs from the plan above, and why:

- **Booking IDs are 60–119, not 60–89.** A week of bedtime and dinner reminders plus three days of nudges did not fit in 30.
- **The dinner decision moment merges with the dinner reminder.** Notifications keep two hours apart, so a separate nudge could never fit next to the reminder. With the reminder on, it carries the personal wording at the time the user chose. The separate nudge only exists with reminders off.
- **Evening nudges can go out from 5:30 PM.** A dinner reminder at 8 and bedtime at 11 leave no gap of two hours on both sides, so an evening nudge moves earlier rather than being dropped.
- **Reminders keep the time the user set.** "Consistently done late" moves nudges through the learned times. It does not move a reminder away from a time chosen in Settings.
- **Priority is points at stake, minus 5 for each send of that nudge in the last 3 days.** Plain "highest stake, then least recently sent" let the same high-stake nudge win every day.
- **The noticed-progress nudge replaces the old appreciation alert.** It is part of the plan like any other nudge, so it counts towards the budget.
- **`openrouter/free` is not used,** since nothing confirms how it behaves with `data_collection: "deny"`. The list is refreshed from the live model list instead.
- **The background worker's job is narrow.** Slots for the next few days are written while the app is open, so the worker only finishes wording that could not be written then, such as when offline or out of quota. It is off by default, and keeps a copy of the AI key in the app's private storage while on.

## Sources

Checked 2026-11-01.

**AI providers**
- [OpenRouter public model list](https://openrouter.ai/api/v1/models), read directly
- [OpenRouter limits](https://openrouter.ai/docs/api-reference/limits)
- [OpenRouter provider routing](https://openrouter.ai/docs/features/provider-routing)
- [OpenRouter structured outputs](https://openrouter.ai/docs/features/structured-outputs)
- [TrueFoundry on OpenRouter free models](https://www.truefoundry.com/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you), third party and not verified
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [Groq data handling](https://console.groq.com/docs/your-data)

**Android background work**
- [Android: modern background execution](https://android-developers.googleblog.com/2018/10/modern-background-execution-in-android.html)
- [Capacitor background runner issue](https://github.com/ionic-team/capacitor-background-runner/issues/3)

**Behaviour research**, read from abstracts and summaries, not full papers
- [Klasnja et al., HeartSteps micro-randomized trial](https://www.pubmed.ncbi.nlm.nih.gov/30192907/)
- [Nahum-Shani et al., just-in-time adaptive interventions](https://pmc.ncbi.nlm.nih.gov/articles/PMC4732268)
- [Künzler et al., receptivity](https://pmc.ncbi.nlm.nih.gov/articles/PMC9494762)
- [Implementation intentions and healthy eating, meta-regression](https://repositorio.comillas.edu/items/9db59488-02dc-4553-ba19-9c17f296d021)
- [Implementation intentions and physical activity, meta-analysis](https://www.mcmasteroptimalaging.org/full-article/HE/meta-analytic-review-effect-implementation-intentions-physical-activity-25322)

The near-win and fresh-start ideas are well known in behavioural science, but I did not find or check a source for them while writing this plan, so treat them as reasoning and not as evidence.
