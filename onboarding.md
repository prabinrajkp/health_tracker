# 🚀 Onboarding & Guided Setup — Product Design Specification

## 🎯 Objective

Design a **low-friction, high-signal onboarding system** that:

* Captures **user intent (goals)**
* Infers **behavior patterns**
* Maps inputs directly to **backend scoring logic**
* Educates users on **how to win in the app**
* Avoids fatigue from long forms

---

# 🧠 Design Philosophy

> **Don’t ask everything. Ask what moves the system.**

* Max 60–90 seconds completion time
* Use **progressive disclosure** (step-by-step, not a long form)
* Prefer **choices over typing**
* Translate answers → **system configuration + scoring bias**

---

# 🏗️ Onboarding Architecture

## Flow Overview

```
1. Welcome
2. Goal Identification
3. Lifestyle Snapshot
4. Constraints & Preferences
5. Scoring Personalization Mapping
6. Quick Tutorial
7. Dashboard Entry
```

---

# 🧩 1. Welcome Screen

### Purpose

Set tone and expectation.

### Content

* App value proposition:

  > “Track less. Improve faster.”
* CTA: **Start Setup (≈ 1 min)**

---

# 🎯 2. Goal Identification (Most Critical Step)

### UI Pattern

Card-based selection (multi-select allowed)

### Question

> “What are you trying to improve right now?”

### Options

* Fat loss
* Muscle gain
* General fitness
* Better sleep
* Consistency / discipline
* Energy levels

---

### Backend Mapping

Each goal adjusts scoring weights:

| Goal              | Diet Weight         | Workout Weight | Sleep Weight |
| ----------------- | ------------------- | -------------- | ------------ |
| Fat loss          | High                | Medium         | Medium       |
| Muscle gain       | High (protein bias) | High           | Medium       |
| Sleep improvement | Medium              | Low            | High         |
| General fitness   | Balanced            | Balanced       | Balanced     |

---

# ⚡ 3. Lifestyle Snapshot

### Purpose

Capture baseline behavior without asking detailed logs

---

### Q1: Activity Level

* Sedentary
* Lightly active
* Moderately active
* Very active

**Mapping**
→ Sets workout expectations & scoring thresholds

---

### Q2: Eating Pattern

* Fixed meal times
* Irregular eating
* Late dinners frequent

**Mapping**
→ Enables late dinner penalties & consistency scoring

---

### Q3: Sleep Pattern

* Consistent (same time daily)
* Slight variation
* Irregular

**Mapping**
→ Sleep scoring strictness

---

# 🚧 4. Constraints & Preferences

### Purpose

Avoid unrealistic recommendations

---

### Q1: Diet Preference

* Vegetarian
* Eggetarian
* Non-vegetarian

→ Filters scoring suggestions (e.g., protein sources)

---

### Q2: Time Constraints

* “I have <30 min/day”
* “I can manage 30–60 min”
* “Flexible”

→ Adjust workout expectations

---

### Q3: Primary Struggle

> “What usually breaks your routine?”

Options:

* Late-night eating
* Skipping workouts
* Snacking/junk cravings
* Poor sleep
* Inconsistency

---

### Mapping

This directly feeds:

```
primary_risk_factor = selected_option
```

Used later in:

* Weekly summary
* Alerts
* Strategic fix suggestions

---

# ⚙️ 5. Scoring Personalization Engine

## Output of Onboarding

Create a **User Profile Config**

```
{
  goal: "fat_loss",
  activity_level: "moderate",
  diet_type: "eggetarian",
  primary_risk: "late_dinner",
  scoring_weights: {
    diet: 0.4,
    workout: 0.35,
    sleep: 0.25
  },
  rules: {
    late_dinner_penalty: true,
    protein_priority: true
  }
}
```

---

## Dynamic Scoring Adjustments

### Example

If:

* Goal = fat loss
* Risk = late dinner

Then:

* Increase penalty:

  ```
  dinner_after_9pm → -5 pts
  ```
* Increase reward:

  ```
  early dinner → +2 pts bonus
  ```

---

# 🎓 6. Guided Tutorial (Critical)

## Objective

Ensure user understands:

> “How to win in this system”

---

## Format

### Option A: Swipeable Cards (Recommended)

---

### Slide 1 — Core Idea

> “Your score reflects daily habits — not perfection.”

---

### Slide 2 — Diet

* Protein = points
* Junk = penalty
* Portion control matters

---

### Slide 3 — Workout

* Any movement counts
* Consistency > intensity

---

### Slide 4 — Sleep

* 7–8 hours = max points
* Late nights reduce recovery score

---

### Slide 5 — Strategy

> “Fix your biggest mistake — not everything at once.”

---

### Slide 6 — Weekly Summary (Hook)

> “Every Sunday, we tell you what actually went wrong.”

---

## CTA

* “Got it. Show my dashboard”

---

# 🔁 7. Revisit Tutorial (Settings Integration)

## Requirement

User must be able to re-access tutorial anytime.

---

### Settings Menu

Add:

```
Settings
 ├── Profile
 ├── Goals
 ├── 🔁 View Tutorial
 ├── Reset Onboarding
```

---

### Behavior

* Tutorial opens in same swipe format
* Optional:

  * “Replay onboarding questions”

---

# 📊 UX Principles (Non-Negotiables)

* No typing unless necessary
* Tap-based input
* Max 6–7 screens
* Progress indicator (e.g., 3/6)
* Instant feedback (micro-animations)

---

# 🧪 Edge Cases

## User Skips Onboarding

* Assign default profile:

  ```
  balanced scoring
  no strict penalties
  ```

---

## User Changes Goal Later

* Recalculate:

  * scoring weights
  * penalties
  * weekly insights logic

---

# 🔥 Strategic Advantage

This onboarding ensures:

* App is **personalized from day 1**
* Weekly summaries are **context-aware**
* Recommendations feel **relevant, not generic**

---

# 🧾 Implementation Checklist

## Backend

* [ ] User profile schema
* [ ] Goal → scoring mapping engine
* [ ] Risk factor tagging system

## Frontend

* [ ] Onboarding flow UI
* [ ] Swipe tutorial
* [ ] Settings integration

## Logic

* [ ] Dynamic scoring weights
* [ ] Rule engine for penalties/rewards
* [ ] Profile update triggers recalculation

---

# 🏁 Final Note

If you get onboarding right:

* Users **trust the score**
* Insights feel **personal**
* Retention improves **automatically**

If you get it wrong:

* Everything feels generic
* Users disengage in <3 days

---

**This is not a form. This is your app’s intelligence calibration layer.**
