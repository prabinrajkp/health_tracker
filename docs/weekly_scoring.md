# 🧠 Weekly Executive Summary — Product Design & Implementation Plan

## 🎯 Objective

Transform raw tracking data into **actionable intelligence**.

This feature answers one core question:

> **“What actually drove my performance this week?”**

Instead of passive dashboards, this becomes a **decision engine**.

---

# 🧩 Core Philosophy

* Data → Insights → Decisions → Behavior Change
* Weekly summary = **CEO dashboard of your life system**
* Must be:

  * **Brutally honest**
  * **Simple to consume (30 sec read)**
  * **Actionable**

---

# 📅 Time Window Definition

* Week = **Monday → Sunday**
* Generated:

  * **Sunday night (primary)**
  * Optional: rolling preview during week

---

# 🏗️ Feature Architecture

## 1. Data Inputs

Pull from existing modules:

### Diet

* Daily diet score
* Food logs (tagged: carbs, protein, junk, fruit)
* Late dinner flags

### Workout

* Total sessions
* Duration
* Type (badminton, walking, gym)

### Sleep

* Duration
* Sleep score
* Sleep timing consistency

### Fasting

* Fasting window duration

### Steps

* Daily step counts

---

## 2. Derived Metrics Layer (Important)

This is where real intelligence happens.

### Weekly Aggregates

* Avg diet score
* Avg sleep duration
* Total workouts
* Avg steps
* # of late dinners
* # of junk food events
* # of “ideal days” (score >70)

---

### Behavioral Patterns

Detect:

* **Consistency**

  * Same wake time? (±1 hr variance)
* **Drop-off days**

  * Identify worst 2 days
* **Stacked failures**

  * e.g. late dinner + poor sleep combo

---

# 🧠 Insight Engine (Core Logic)

## A. Biggest Wins (Positive Signals)

Criteria:

* Above baseline OR target achievement

Examples:

* “5 days with breakfast logged”
* “Workout consistency improved (4 sessions vs last week 2)”
* “Average steps increased by 2,000”

### Logic

```
if metric_this_week > metric_last_week OR exceeds threshold:
    add to wins
```

---

## B. Biggest Damage (Negative Signals)

Criteria:

* High-frequency bad behavior
* Strong correlation with low score days

Examples:

* “4 late dinners”
* “Sleep < 7h on 5 days”
* “Junk food logged 3 times”

### Logic

```
if bad_event_count >= threshold:
    add to damage
```

---

## C. Root Cause Detection (Advanced Layer)

Not just listing issues — identifying **drivers**

Example:

* If low score days overlap with:

  * late dinners → flag as cause
  * no workout → secondary cause

### Simple Correlation Model

```
for each bad_day:
    track events present
rank events by frequency
top = root cause
```

---

## D. Strategic Fix (Most Important Output)

Single high-impact recommendation.

Rules:

* Must address **top damage driver**
* Must be **specific + measurable**

Examples:

* “Move dinner before 8:45 PM”
* “Add 1 protein source to lunch daily”
* “Fix sleep window to 11 PM–7 AM”

### Logic

```
top_issue → mapped_solution
```

---

# 🖥️ UI / UX Design

## 1. Weekly Summary Card (Top Level)

```
Week: Apr 22–28

Score: 64 → C (↑ from 52 last week)

Biggest Wins
✔ 5 days breakfast logged
✔ 3 workouts completed
✔ Steps improved

Biggest Damage
❌ 4 late dinners
❌ Sleep <7h on 5 days
❌ Junk food x3

Strategic Fix
👉 Move dinner before 8:45 PM
```

---

## 2. Expandable Sections

### A. Trend Graphs (Optional)

* Weekly trend vs last week
* Keep minimal

### B. Day-Level Breakdown

* Highlight:

  * Best day
  * Worst day

---

## 3. Visual Language

* Wins → Green ✔
* Damage → Red ❌
* Fix → Highlighted CTA (bold / accent color)

---

# ⚙️ Scoring Integration

## Weekly Score Formula

```
Weekly Score = avg(daily scores)
```

Add:

* Trend indicator:

  * ↑ improving
  * ↓ declining

---

# 🧪 Edge Cases Handling

### No Data Week

* Show:

  * “Insufficient data”
  * Encourage logging

### Perfect Week

* Show:

  * “Maintain current system”
  * No fix needed

### Mixed Week

* Focus on:

  * Dominant negative driver

---

# 🚀 Advanced Features (Phase 2)

## 1. Week-over-Week Comparison

```
Sleep improved by +45 mins avg
Late dinners reduced from 5 → 2
```

---

## 2. Behavior Score Attribution

Break score into drivers:

* Diet impact %
* Sleep impact %
* Workout impact %

---

## 3. Predictive Alert

Mid-week:

* “You are trending towards a poor week due to late dinners”

---

## 4. Streak Intelligence

* “3 weeks of improving diet score”

---

# 🧠 Product Positioning

This feature converts your app from:

### ❌ Tracker

→ logs data

### ✅ System

→ drives behavior change

---

# 🔥 Why This Is High-Leverage

* Removes guesswork
* Forces accountability
* Identifies **actual bottlenecks**
* Enables **small, high-impact fixes**

---

# 🧾 Implementation Checklist

### Backend

* [ ] Weekly aggregation pipeline
* [ ] Pattern detection module
* [ ] Insight generation rules

### Frontend

* [ ] Weekly summary card
* [ ] Expandable insights
* [ ] Visual hierarchy

### Logic

* [ ] Wins detection
* [ ] Damage detection
* [ ] Fix recommendation mapping

---

# 🏁 Final Note

This feature is not a “nice-to-have.”

# It is your app’s intelligence layer.

Without it:

* Users log data

With it:

* Users change behavior

---
