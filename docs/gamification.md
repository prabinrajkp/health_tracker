# Claude Code Implementation Specification

# Health Gamification App — Profile, Settings, Badges & Quest Ecosystem

# IMPORTANT IMPLEMENTATION DIRECTIVE

This document is a production implementation specification.

The implementation must:

* follow the architecture exactly
* preserve UX hierarchy
* preserve retention psychology principles
* preserve performance
* support scalability
* support future expansion
* support animation systems
* support live event systems
* support AI-generated progression systems

The goal is NOT to build:

* a simple health tracker
* a basic achievement system
* a static settings page

The goal IS to build:

# a live gamified behavioral progression platform

The implementation should feel:

* premium
* cinematic
* responsive
* emotional
* game-like
* progression-driven
* identity-centered

---

# PRIMARY PRODUCT GOALS

The new ecosystem must:

## Increase

* D7 retention
* D30 retention
* daily active usage
* profile revisits
* badge interaction
* quest participation
* emotional attachment
* streak continuation

## Reduce

* dashboard fatigue
* churn after missed days
* analytics overload
* static interaction patterns

---

# CORE UX PRINCIPLES

# Principle 1

Identity over configuration.

---

# Principle 2

Progression over reporting.

---

# Principle 3

Reward effort and consistency.

---

# Principle 4

Never punish users aggressively.

---

# Principle 5

Make progress emotionally visible.

---

# Principle 6

Every interaction should feel rewarding.

---

# Principle 7

The UI must feel alive.

---

# CRITICAL NAVIGATION CHANGE

# REMOVE

Bottom tab:
Settings

---

# ADD

Bottom tab:
Profile

---

# FINAL BOTTOM NAVIGATION

Home
Activity
History
Profile

---

# SETTINGS MUST MOVE INSIDE PROFILE

Settings become:

* secondary
* utility-focused
* collapsible/grouped

Profile becomes:

* emotional hub
* progression center
* prestige showcase

---

# PROFILE SCREEN — FINAL ARCHITECTURE

# SCREEN ORDER (MANDATORY)

# 1. HERO PROFILE SECTION

# 2. ACTIVE TITLE & AURA

# 3. SUPER BADGE VAULT

# 4. FEATURED BADGES

# 5. BADGE INVENTORY SHELVES

# 6. ACTIVE QUESTS

# 7. LIFETIME STATS

# 8. JOURNEY TIMELINE

# 9. MONTHLY SNAPSHOT

# 10. SETTINGS CENTER

DO NOT CHANGE THIS HIERARCHY.

---

# 1. HERO PROFILE SECTION

# REQUIRED COMPONENTS

## Avatar / Aura System

Implementation Requirements:

* animated aura background
* glow intensity changes dynamically
* support particle effects
* support rarity effects
* support future cosmetics

Aura state must depend on:

* level
* prestige score
* super badge count
* current streak
* consistency score

---

## Player Name

Large typography.

---

## Active Title

Examples:

* Momentum Elite
* Recovery Master
* Discipline Titan
* Sleep Ascendant

System Requirements:

* manually equip-able
* AI-generated recommendations supported
* seasonal titles supported

---

## Player Level

Requirements:

* XP-based progression
* animated XP bar
* smooth transitions
* scalable leveling curve

---

## Prestige Score

Prestige Score Formula Inputs:

* badge rarity
* badge counts
* super badges
* streak quality
* seasonal achievements

Must support:

* future balancing
* weighting updates

DO NOT hardcode formulas.

---

# 2. ACTIVE TITLE & AURA SYSTEM

# REQUIREMENTS

Users must be able to:

* equip active titles
* equip aura themes
* unlock aura effects

Aura Examples:

* Neon Purple
* Elite Gold
* Recovery Blue
* Legendary Crimson

Implementation Requirements:

* GPU-optimized animations
* reduced-motion support
* low-performance fallback mode

---

# 3. SUPER BADGE VAULT

# PURPOSE

Highest-prestige achievement area.

This must visually feel:

* rare
* cinematic
* elite
* aspirational

---

# SUPER BADGE SYSTEM REQUIREMENTS

# A. Combination Logic

Super badges unlock from:

* badge combinations
* streak combinations
* seasonal combinations
* event completions

Examples:

Sleep Guardian ×10
+
Step Beast ×10
+
Clean Fuel ×10

→ Total Balance Core

---

# B. Super Badge Metadata

Each super badge must support:

* id
* title
* rarity
* description
* required badges
* unlock conditions
* prestige value
* aura unlock
* seasonal status
* hidden visibility state
* animation theme

---

# C. Super Badge Vault UI

Requirements:

* horizontal cinematic shelves
* large cards
* animated glow
* particle effects
* rarity borders
* expandable modal

---

# D. Hidden Super Badges

Support:

* silhouette placeholders
* partial hints
* hidden unlock recipes

---

# E. Super Badge Tiers

Support:

* Bronze
* Silver
* Gold
* Legendary
* Ascendant

Visuals must evolve dynamically.

---

# F. Super Badge Unlock Cinematics

MANDATORY FLOW:

1. Dim background
2. Animate fusion
3. Display badge forge effect
4. Trigger haptic feedback
5. Reveal title
6. Trigger XP burst
7. Apply aura update if unlocked

---

# 4. FEATURED BADGES SECTION

# PURPOSE

Quick emotional showcase.

---

# REQUIREMENTS

Users can:

* pin badges
* reorder badges
* feature rare badges

Display:

* top 3–5 badges
* animated highlights
* count multipliers

---

# 5. BADGE INVENTORY SHELVES

# CORE REQUIREMENT

BADGES MUST BE REPEATABLE.

This is mandatory.

Badges are NOT one-time achievements.

They represent:

# accumulated behavioral mastery

---

# BADGE DATA MODEL

Each badge instance must support:

* badge_id
* category
* rarity
* current_tier
* total_earned_count
* seasonal_earned_count
* last_earned_date
* prestige_value
* equipped_state
* progress_value
* hidden_state

---

# BADGE CATEGORY REQUIREMENTS

# Categories

## Consistency

## Recovery

## Sleep

## Nutrition

## Fitness

## Seasonal

## Comeback

## Legendary

---

# BADGE UI REQUIREMENTS

# A. Horizontal Shelves

Mandatory.

DO NOT use:

* flat grids
* achievement tables

---

# B. Badge Count Display

Examples:

* x34
* 18 Earned
* Tier III

Counts must feel visually rewarding.

---

# C. Badge Evolution

Support evolution states:

Bronze
Silver
Gold
Platinum
Neon Legendary

Visuals must evolve.

---

# D. Progress Indicators

Example:
18 / 25 → Platinum

---

# E. Badge Detail Modal

Must display:

* description
* lore text
* progress
* evolution path
* earned history
* prestige impact
* related quests

---

# F. Badge Motion

Required:

* floating motion
* breathing glow
* hover response
* unlock pulse

---

# 6. LIVE QUEST SYSTEM

# PURPOSE

Convert app into:

# a live evolving progression system

---

# QUEST TYPES (MANDATORY)

# A. Daily Quests

Examples:

* hydration goal
* workout completion
* early sleep

---

# B. Weekly Quests

Examples:

* 3 workouts
* 7-day streak
* meal consistency

---

# C. Super Badge Quests

High-prestige live events.

Examples:

* Iron Week Protocol
* Recovery Nexus Event
* Discipline Ascension

---

# D. Seasonal Legendary Quests

Examples:

* Summer Transformation
* Winter Recovery
* Elite Discipline Month

---

# E. Secret Quests

Support:

* hidden triggers
* surprise unlocks
* discovery mechanics

---

# QUEST SYSTEM REQUIREMENTS

# A. Countdown Support

Mandatory.

Examples:

* 5 days remaining
* final stage
* expires tonight

---

# B. Quest Progress Tracking

Examples:
██████░░░░
4 / 7 completed

---

# C. Quest Rewards

Must support:

* badges
* super badges
* XP
* prestige
* aura unlocks
* cosmetics
* titles

---

# D. Quest States

Required states:

* locked
* active
* near completion
* completed
* expired

---

# E. Quest Alert System

Quest alerts must appear:

* Home
* Profile
* Weekly Summary
* Monthly Summary

---

# F. Quest Completion Animation

Required:

* cinematic reveal
* particle burst
* sound hook support
* haptic support
* XP burst

---

# G. Quest Frequency

Support:

* daily
* weekly
* monthly
* seasonal
* event-triggered

---

# 7. LIFETIME STATS CENTER

# PURPOSE

Create emotional memory and visible long-term progression.

---

# REQUIRED METRICS

# Core

* lifetime score
* total steps
* total workouts
* total sleep hours
* fasting hours
* healthy meals

---

# Achievement

* elite days
* 90+ score days
* highest streak
* super badge count
* legendary badge count

---

# Behavioral

* consistency percentage
* comeback count
* average monthly score
* best month ever

---

# UI REQUIREMENTS

Use:

* animated counters
* large typography
* glowing metric cards
* grouped categories

DO NOT use:

* raw tables
* dense analytics blocks

---

# 8. JOURNEY TIMELINE

# PURPOSE

Transform progression into emotional memory.

---

# TIMELINE EVENTS

Examples:

* first 80+ week
* first super badge
* first legendary month
* comeback streak
* milestone XP level

---

# TIMELINE UI

Requirements:

* cinematic vertical timeline
* expandable milestone cards
* replay support
* animated reveal transitions

---

# 9. MONTHLY SNAPSHOT

# PURPOSE

Show current momentum.

---

# REQUIRED COMPONENTS

* current monthly score
* active streak
* momentum trend
* active quests
* near-unlock opportunities
* projected progression

---

# 10. SETTINGS CENTER

# SETTINGS MUST BE SECONDARY

Settings are utility.

NOT emotional centerpiece.

---

# SETTINGS SECTION STRUCTURE

# A. Personalization

Examples:

* Focus Mode
* Coaching Style
* Goal Type
* Motivation Style

---

# B. Appearance

Examples:

* themes
* aura effects
* motion intensity
* reduced motion

---

# C. Health Preferences

Examples:

* sleep schedule
* fasting preference
* workout preference
* meal timing

---

# D. Advanced Settings

Contains:

* scoring rules
* category weights
* penalties
* experimental scoring

Must be hidden/collapsible.

DO NOT expose immediately.

---

# E. Account & Data

Examples:

* export
* sync
* privacy
* backup

---

# F. Labs / Experimental

Examples:

* AI coach beta
* adaptive quests
* smart progression

---

# PERFORMANCE REQUIREMENTS

# MUST OPTIMIZE

Because profile screen becomes animation-heavy.

---

# REQUIRED OPTIMIZATIONS

* lazy loading shelves
* GPU-accelerated animations
* virtualization for badge lists
* animation throttling
* image caching
* memoized progression calculations
* async quest evaluation

---

# MOTION SYSTEM REQUIREMENTS

# MOTION PHILOSOPHY

Motion should feel:

* premium
* alive
* emotional
* responsive

NOT:

* distracting
* chaotic

---

# REQUIRED MOTION TYPES

* floating depth
* breathing glows
* animated counters
* kinetic transitions
* smooth easing
* elastic interactions
* particle shimmer

---

# ACCESSIBILITY REQUIREMENTS

MANDATORY:

* reduced motion mode
* scalable typography
* screen reader support
* color-independent state indicators
* large touch targets
* high contrast support

---

# BACKEND SYSTEM REQUIREMENTS

# REQUIRED SERVICES

# 1. Badge Engine

Responsibilities:

* evaluate badge unlocks
* handle repeatable counts
* calculate evolution tiers
* update prestige values

---

# 2. Super Badge Engine

Responsibilities:

* evaluate combinations
* trigger fusion unlocks
* calculate rarity
* unlock aura effects

---

# 3. Quest Engine

Responsibilities:

* generate quests
* evaluate progress
* trigger events
* handle expiration
* manage seasonal events

---

# 4. Prestige Engine

Responsibilities:

* calculate prestige score
* level progression
* rarity balancing
* XP distribution

---

# 5. AI Progression Engine

Responsibilities:

* personalized quests
* adaptive recommendations
* title generation
* progression analysis

---

# DATABASE TABLE REQUIREMENTS

# users

* id
* level
* xp
* prestige_score
* aura_state
* active_title

---

# badges

* id
* category
* rarity
* unlock_conditions
* prestige_value
* evolution_config

---

# user_badges

* user_id
* badge_id
* total_earned_count
* current_tier
* progress
* equipped_state
* last_earned_date

---

# super_badges

* id
* required_badges
* rarity
* prestige_bonus
* aura_unlock

---

# user_super_badges

* user_id
* super_badge_id
* unlock_date
* tier

---

# quests

* id
* type
* duration
* reward_config
* difficulty
* hidden_state

---

# user_quests

* user_id
* quest_id
* progress
* completion_state
* expiration_date

---

# ANALYTICS & TRACKING REQUIREMENTS

Track:

* profile revisit frequency
* badge interactions
* quest participation
* shelf scrolling behavior
* unlock conversion rates
* near-completion dropoff
* aura usage
* title changes

---

# FEATURES TO AVOID

DO NOT IMPLEMENT:

* flat achievement grids
* corporate UI aesthetics
* static dashboards
* punishment-heavy mechanics
* impossible grind quests
* excessive configuration exposure
* cluttered profile screens
* low-performance particle overload

---

# FINAL PRODUCT TARGET

The final experience must feel like:

# “A premium live behavioral RPG built around real-world health progression.”

Users should emotionally feel:

* evolving
* progressing
* recognized
* rewarded
* prestigious
* motivated
* attached to their growth

The app should become:

* emotionally sticky
* progression-driven
* identity-centered
* event-powered
* retention-focused

—not merely a utility health tracker.
