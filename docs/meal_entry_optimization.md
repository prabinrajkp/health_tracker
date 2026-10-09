# Food Logging Workflow Redesign – Implementation Specification

## Objective

Redesign the food logging experience to minimize user effort while maximizing speed, personalization, and long-term learning. The system should revolve around **Meals** instead of individual food entries and should intelligently reuse historical data to reduce typing and navigation.

The application should feel like it already knows what the user is about to eat.

The entire design should prioritize **recognition over recall**, **taps over typing**, and **behavioral learning over manual configuration**.

AI should only be used as a fallback when the food database cannot confidently identify a food.

---

# Core Design Principles

1. Logging a repeat meal should require no more than **1–2 taps**.
2. Common meals with small modifications should require **2–3 taps**.
3. AI should never be the primary interaction.
4. The system should continuously learn from the user's eating history.
5. Recommendations should be deterministic and history-driven rather than AI-driven.
6. Users should be encouraged to reuse meals instead of repeatedly adding individual foods.
7. Reduce the number of screens wherever possible.
8. Search should always be available but should rarely be necessary.
9. The app should silently become smarter over time without requiring any user setup.

---

# Data Model

Create three independent entities.

## Food

Represents an individual food item.

Fields

- Food ID
- Name
- Aliases
- Category
- Nutrition
- Portion Variants
- Ideal Portion
- Health Score
- Source (Database / AI)

---

## Meal

Represents a meal consumed on a particular day.

Fields

- Meal ID
- Meal Category
    - Breakfast
    - Lunch
    - Dinner
    - Snack
    - Drink
    - Other
- Timestamp
- Food Items
- Portion of each food
- Nutrition Summary
- Health Score

Meals are immutable historical records.

---

## Meal Template

Represents reusable meals automatically learned from history.

Fields

- Template ID
- Meal Category
- Template Name (optional)
- Meal Fingerprint
- Food Items
- Learned Default Portions
- Times Used
- First Used
- Last Used
- Recommendation Score
- Average Calories
- Average Protein
- Average Carbs
- Average Fat
- Average Health Score

Meal Templates evolve as the user continues logging food.

---

# Home Screen

Replace the floating "+" button with a food-themed floating action button.

Examples

- Add Meal
- Plate + icon
- Bowl + icon
- Fork & Spoon + icon

The button should exist only on the Home Screen.

No floating action button should appear on any other screen.

---

# Add Meal Flow

When the user taps Add Meal, open a bottom sheet or modal instead of navigating to another screen.

Everything should happen inside this experience.

---

## Step 1

Ask the user to choose the Meal Category.

Options

- Breakfast
- Lunch
- Dinner
- Snack
- Drink
- Other

Do NOT assign meal category based on time.

Snack should support unlimited entries per day.

---

## Step 2

Immediately display recommendations.

The order should be

### Frequently Logged Meals

These are complete meal combinations learned from historical usage.

Example

Kerala Breakfast

- Puttu
- Kadala Curry

Gym Breakfast

- Oats
- Milk
- Banana

One tap logs the complete meal.

---

### Recent Meals

Display the most recently logged meals for the selected category.

Each recommendation should include all foods in that meal.

One tap logs the entire meal.

---

### Favorite Meals

User-pinned meals.

Always shown before recent meals.

---

### Recent Foods

Display commonly used individual foods.

Selecting one starts building a meal.

---

### Search

A persistent search field should always remain visible.

Typing immediately searches the local food database.

---

# Search Logic

Search order

1. Local food database
2. Synonym lookup
3. Alias lookup
4. Fuzzy match

If confidence exceeds threshold

Show ranked food matches.

If confidence is below threshold

Call AI Nutrition Service.

The AI should generate

- Food Name
- Nutrition
- Portion
- Health Score

Display a confirmation card.

After confirmation

Save the food permanently to the local database.

Future searches should never call AI for the same food again.

---

# Meal Builder

After adding a food

Do NOT close the workflow.

Instead continue building the meal.

Example

Lunch

↓

Rice

↓

Chicken Curry

↓

Curd

↓

Papad

↓

Finish Meal

The completed meal becomes one Meal object.

---

# Portion Learning

For every food

Remember the portion most frequently selected by the user.

Examples

Idli

History

2
2
2
3
2
2

Recommended

2

Rice

150g
180g
150g
160g
150g

Recommended

150g

Automatically preselect learned portions.

Users may still edit them.

---

# Favorite Meals

Allow users to manually save any completed meal.

Examples

Gym Breakfast

Office Lunch

Cheat Meal

Family Dinner

Pinned meals should always appear at the top of recommendations.

---

# Meal Intelligence Engine

The recommendation engine must NOT use AI.

It should rely entirely on historical user data.

---

# Meal Fingerprinting

Every meal should generate a deterministic fingerprint.

Normalize

- Remove duplicate spaces
- Normalize food names
- Sort foods alphabetically
- Ignore ordering of foods

Generate

Meal Category + Sorted Foods

Example

Breakfast

Egg

Toast

Milk

becomes

Breakfast

Egg

Milk

Toast

Generate a fingerprint/hash from the normalized representation.

Meals with identical fingerprints are considered the same meal.

---

# Meal Template Creation

If the same meal fingerprint is logged

at least 3 times

within the last 60 days

Automatically create or update a Meal Template.

No user action required.

---

# Meal Evolution

Meals often differ slightly.

Example

Meal A

Rice

Chicken Curry

Curd

Meal B

Rice

Chicken Curry

Curd

Papad

The engine should recognize

Rice

Chicken Curry

Curd

as the core meal

Papad as an optional addition

Instead of treating them as unrelated meals.

---

# Combo Meal Detection

Automatically learn meal combinations.

Example

Puttu

Kadala Curry

appears together

12 times

Promote to

Frequent Combo Meal

Likewise

Rice

Fish Curry

Thoran

Curd

becomes

Kerala Lunch

The user should be able to log the entire combo with one tap.

---

# Food Association Mining

Track foods that frequently appear together.

Example

Chicken Curry

appears with

Rice

95%

Curd

90%

Salad

42%

When the user adds

Chicken Curry

Suggest

Frequently paired with this

+ Rice

+ Curd

+ Salad

One tap adds them.

No AI required.

---

# Meal Completion Suggestions

As users build meals

Predict the next likely foods using historical associations.

Example

User adds

Tea

Suggestions

Banana

Biscuits

Bread

Another example

Rice

↓

Chicken Curry

Suggestions

Curd

Papad

Pickle

Suggestions should be generated using historical frequency only.

---

# Recommendation Scoring

Rank meal recommendations using

40% Frequency

30% Recency

20% Consistency

10% Diversity

Where

Frequency

Number of times logged.

Recency

Recently consumed meals.

Consistency

Meals with stable food combinations.

Diversity

Avoid showing the exact same meal every day if several good alternatives exist.

---

# Duplicate Detection

If the user attempts to log nearly the same meal within a short period

Display

"It looks like you recently logged a similar meal."

Options

- Update previous meal
- Log anyway

---

# Template Maintenance

If a Meal Template has not been used

for more than 180 days

Reduce its recommendation score.

Do not delete it.

---

# Analytics

Track

- Most eaten breakfast
- Most eaten lunch
- Most eaten dinner
- Most eaten snack
- Favorite meal combinations
- Most repeated meals
- Average calories per meal
- Average protein per meal
- Meal diversity score
- Weekly meal repetition percentage
- Top foods
- Top meal templates

These analytics should also improve recommendation quality.

---

# UX Guidelines

The interface should optimize for recognition rather than recall.

Users should almost never need to type.

Navigation depth should be minimized.

Keep everything inside a single Add Meal workflow whenever possible.

Use bottom sheets and inline interactions instead of multiple screens.

Avoid chat-style interactions for normal food logging.

The experience should resemble a modern search interface rather than a messaging app.

AI should remain invisible unless absolutely necessary.

The user should never feel they are "using AI."

Instead, the app should simply feel intelligent.

---

# Success Metrics

The redesigned workflow should achieve the following targets.

Repeat meal

1–2 taps

Repeat meal with one modification

2–3 taps

New food already in database

Search → Select → Done

Unknown food

Search → AI → Confirm → Done

Average food logging time

Less than 10 seconds

Average screens visited

One

Typing should be the exception, not the rule.

The defining product experience should be:

> "The app already knows what I usually eat and lets me log my meals almost instantly."