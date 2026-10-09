# 🧩 RPG Performance Widget — Product & Design Specification

## 🎯 Objective

Deliver a **home screen widget** that:

* Shows user performance instantly
* Feels like a **living RPG character system**
* Enables **quick refresh without opening app**
* Keeps interaction minimal but meaningful

---

# 🧠 Core Philosophy

> “Gamified insight, not gamified clutter”

The widget must:

* Look cool (RPG vibe)
* Be readable in <2 seconds
* Provide one clear action (refresh)

---

# 🧱 Widget Layout (Medium / Large)

## Structure

```id="layout"
[ 🧙 Character ]    [ 🔄 Refresh ]

      ⚡ LEVEL STATUS
        84 / 100

   🔺 Performance Radar

🥗 22/35   ⚡ 34/35   🌙 24/30
```

---

# 🎮 Component Breakdown

## 1. RPG Character (Top Left)

### Purpose

Visual identity + emotional engagement

### Behavior

* Changes based on score:

  * 🔴 Low → tired / dull
  * 🟡 Medium → neutral
  * 🟢 High → energetic / glowing

* Optional upgrades:

  * Outfit evolves with streaks
  * Aura/glow for high performance

---

## 2. Refresh Button (Top Right)

### Purpose

Trigger sync without opening app

### Functionality

* Tap → triggers:

  * Step sync
  * Score recalculation
  * Widget update

---

### States

| State   | Behavior            |
| ------- | ------------------- |
| Idle    | 🔄 icon             |
| Loading | spinning animation  |
| Failed  | ⚠️ icon (tap retry) |

---

## 3. Score Display (Center)

### Format

```id="score"
84 / 100
```

### Add Subtitle

* “Champion”
* “On Track”
* “Needs Push”

---

## 4. Performance Radar (Centerpiece)

### Keep It Minimal

* 3-axis only:

  * Diet
  * Workout
  * Sleep

### Design Rules

* Thin lines
* Soft glow fill
* No labels inside chart

---

## 5. Quick Metrics (Bottom Row)

```id="metrics"
🥗 22/35   ⚡ 34/35   🌙 24/30
```

### Purpose

* Fast numeric clarity
* Backup for radar

---

# 🎨 Visual Design System

## Background

* Semi-transparent dark card
* Subtle blur (glass effect)
* Avoid wallpaper clash

---

## Color Mapping

| Metric  | Color  |
| ------- | ------ |
| Diet    | Green  |
| Workout | Blue   |
| Sleep   | Purple |

---

## Character Style

* Flat + slightly stylized (not cartoonish)
* Clean outlines
* No heavy detail (widget constraints)

---

# ⚡ Interaction Model

## Tap Zones

| Area      | Action               |
| --------- | -------------------- |
| Character | Open app → Dashboard |
| Radar     | Open app → Analytics |
| Refresh   | Sync data            |

---

## Long Press (Optional Future)

* Change character theme
* Toggle minimal mode

---

# 🔄 Refresh Logic

## Trigger Flow

```id="refresh_logic"
OnClick:
    Fetch steps API
    Update activity score
    Recalculate total score
    Refresh widget UI
```

---

## Performance Constraints

* Max refresh time: <2 seconds
* Use cached fallback if API fails

---

## Smart Throttling

* Prevent spam taps:

  * cooldown: 10–15 sec

---

# 🧠 Intelligence Layer (Optional Upgrade)

## Dynamic Character Feedback

| Condition    | Character Mood |
| ------------ | -------------- |
| Diet low     | sluggish       |
| Workout high | energized      |
| Sleep low    | tired          |

---

## Micro Text (Optional)

Below score:

* “Diet holding you back”
* “Strong performance today”

---

# 📱 Widget Sizes

## Small

```id="small"
🧙 84
```

Minimal only (character + score)

---

## Medium (Recommended)

* Character
* Score
* Radar
* Refresh

---

## Large

* All above +
* Quick metrics row

---

# 🚀 Engineering Considerations

## Android

* Use:

  * AppWidgetProvider
  * RemoteViews
* Handle async refresh carefully
* Use WorkManager for background sync

---

## iOS (if planned)

* WidgetKit
* Timeline updates (limited refresh)

---

# ⚠️ Pitfalls to Avoid

## 1. Overcrowding

Do NOT:

* Add text labels everywhere
* Add too many icons

---

## 2. Heavy Graphics

* Character must be lightweight
* No high-res assets

---

## 3. Slow Refresh

* If refresh feels laggy → user stops using

---

# 📊 Success Metrics

You know it works if:

* User checks widget 5–10 times/day
* Refresh used at least 2–3 times/day
* App opens via widget taps increase

---

# 🏁 Final Positioning

This widget is:

> **A gamified command center on the home screen**

Not:

> A mini version of your dashboard

---

# ⚡ Bottom Line

* Character = engagement
* Radar = insight
* Refresh = control

Balance these three, and this becomes your app’s **daily habit trigger**.
