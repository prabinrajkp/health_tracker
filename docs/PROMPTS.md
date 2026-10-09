# Health Quest — AI Prompt Editing Guide

## Where to edit the AI prompts

All AI coaching prompts live in one file:

```
frontend/src/services/aiPrompts.js
```

Both the offline WebAssembly engine and the cloud Claude Haiku engine read
from this same file, so changes apply everywhere.

---

## What's inside aiPrompts.js

### `IDENTITY_PROMPT`
Defines the coach's persona and tone.
> Edit this to make the coach more formal, casual, empathetic, motivational, etc.

```js
export const IDENTITY_PROMPT = `You are Health Coach, a personal AI assistant...`
```

---

### `GUARDRAILS_PROMPT`
Strict rules that prevent hallucination and keep answers data-bound.
> Be careful editing this. These rules stop the model from inventing numbers.

Key rules enforced:
1. Only use data from the provided log — never invent values
2. If a field is "not logged", say so explicitly
3. Relative time (today/yesterday) uses dates injected from the app
4. Never modify or recalculate scores
5. No medical advice

---

### `RESPONSE_STYLE_PROMPT`
Controls length and format of replies.
> Edit to make responses longer/shorter, add bullet points, etc.

Default: 2–4 sentences, plain text, cite actual numbers.

---

### `COACHING_RULES`
Domain knowledge about what matters most.
> This is the easiest section to tune. Add or remove rules to shape coaching priorities.

Examples of things to add here:
- "Prioritise sleep over steps when both are low"
- "Never mention weight unless the user asks"
- "Always end with an encouraging note"

---

### `buildSystemPrompt(ctx)`
The function that assembles the full prompt by injecting live health data.

Data injected automatically at runtime:
| Field               | Source               |
|---------------------|----------------------|
| Current date + time | System clock         |
| Today's score       | `daily_scores` table |
| Today's diet log    | `diet_logs` table    |
| Today's workout     | `workout_logs` table |
| Today's sleep       | `sleep_logs` table   |
| Yesterday's logs    | All four tables      |
| 7-day patterns      | Computed aggregates  |
| Scoring thresholds  | `tracker_config`     |

Do not edit the data injection logic unless you know what you are doing —
if a field goes missing the model may hallucinate to fill the gap.

---

## How to test a prompt change

1. Edit `frontend/src/services/aiPrompts.js`
2. Run `npm run build` in `frontend/`
3. Open the Coach tab in the app (browser dev mode or APK)
4. Ask a question with real logged data — check that the answer cites actual numbers

To test the guardrails, try asking about data that isn't logged
(e.g. heart rate, specific food names) — the model should say it doesn't have that data.

---

## Rebuild and install after changes

```bash
bash build_apk.sh
adb install health-quest-vX.X-debug.apk
```
