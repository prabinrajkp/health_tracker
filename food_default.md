# 🍽️ Default Meal Options System — Product Specification

## 🎯 Objective

Establish a **ready-to-use, zero-friction food logging system** by:

* Providing **pre-seeded, real-world meal options**
* Covering **typical youth eating patterns (good + bad)**
* Preserving **full flexibility via custom food additions**
* Aligning tightly with the **existing scoring engine**

---

# 🧠 Design Principles

1. **Speed > Perfection**

   * User should log a meal in **< 5 seconds**

2. **Reality-First**

   * Include *actual foods users eat*, not idealized diets

3. **Behavior Shaping**

   * Scoring should **reward direction**, not perfection

4. **Non-Restrictive**

   * No food is banned — only scored differently

---

# ⚙️ System Behavior

## Default + Custom Hybrid Model

```yaml
meal_options:
  default_items: (system seeded)
  custom_items: (user created)
```

* Default items → Always available
* Custom items → User-defined, stored in DB
* Both share identical structure:

  * `name`
  * `category` (good / neutral / bad)
  * `points_per_portion`
  * `ideal_portion`
  * `meal_type` (optional)

---

# 🧩 Food Categorization Logic

| Category   | Behavior                         |
| ---------- | -------------------------------- |
| ✅ Good     | Full points up to ideal portion  |
| ⚖️ Neutral | Low/moderate points              |
| ❌ Bad      | Low points + penalty after ideal |

---

# 📊 Scoring Logic (Aligned with Existing Engine)

```python
if portion <= ideal:
    score = portion * points
else:
    score = ideal * points - (extra_portion * points * 0.5)
```

---

# 🍳 DEFAULT FOOD OPTIONS

## 🥗 BREAKFAST

### ✅ Good

| Food                    | Points | Ideal  |
| ----------------------- | ------ | ------ |
| Eggs (boiled/scrambled) | +2     | 2–3    |
| Oats + milk             | +2     | 1 bowl |
| Fruit bowl (mixed)      | +2     | 1 bowl |
| Banana                  | +1     | 1      |
| Peanut butter (natural) | +1     | 1 tbsp |
| Curd / yogurt           | +2     | 1 bowl |

---

### ⚖️ Neutral

| Food          | Points | Ideal    |
| ------------- | ------ | -------- |
| Upma          | +1     | 1 bowl   |
| Idli          | +1     | 2        |
| Dosa (plain)  | +1     | 1        |
| Poha          | +1     | 1 bowl   |
| Bread (brown) | +1     | 2 slices |

---

### ❌ Bad

| Food                    | Points | Ideal    |
| ----------------------- | ------ | -------- |
| White bread + jam       | +0.5   | 2 slices |
| Parotta                 | +0.5   | 1        |
| Maggi / instant noodles | +0.5   | 1 pack   |
| Sugary cereal           | +0.5   | 1 bowl   |

---

---

## 🍛 LUNCH

### ✅ Good

| Food                      | Points | Ideal     |
| ------------------------- | ------ | --------- |
| Rice (controlled portion) | +2     | 1 portion |
| Chapati                   | +2     | 2         |
| Dal                       | +2     | 1 bowl    |
| Chana / rajma             | +3     | 1 bowl    |
| Paneer curry              | +2     | 1 portion |
| Chicken curry             | +3     | 1 portion |
| Fish curry                | +3     | 1 portion |
| Vegetable sabzi           | +2     | 1 bowl    |
| Curd                      | +2     | 1 bowl    |
| Salad (cucumber/carrot)   | +1     | 1 bowl    |

---

### ⚖️ Neutral

| Food       | Points | Ideal     |
| ---------- | ------ | --------- |
| Lemon rice | +1     | 1 portion |
| Fried rice | +1     | 1 portion |
| Egg masala | +1     | 1 portion |

---

### ❌ Bad

| Food                       | Points | Ideal     |
| -------------------------- | ------ | --------- |
| Biriyani                   | +1     | 1 portion |
| Chicken 65 / fried chicken | +1     | 1 portion |
| Potato fry (deep fried)    | +0.5   | 1 portion |
| Soft drinks                | +0     | 1 glass   |

---

---

## 🌙 DINNER

### ✅ Good

| Food                  | Points | Ideal     |
| --------------------- | ------ | --------- |
| Rice (light portion)  | +2     | 1         |
| Chapati               | +2     | 2         |
| Dal                   | +2     | 1 bowl    |
| Chicken curry         | +3     | 1 portion |
| Fish curry            | +3     | 1 portion |
| Vegetable curry       | +2     | 1 bowl    |
| Curd + cucumber salad | +2     | 1 bowl    |

---

### ⚖️ Neutral

| Food       | Points | Ideal  |
| ---------- | ------ | ------ |
| Egg bhurji | +2     | 2 eggs |
| Pathiri    | +1     | 2      |

---

### ❌ Bad

| Food            | Points | Ideal    |
| --------------- | ------ | -------- |
| Late heavy rice | +0.5   | 1        |
| Shawarma        | +1     | 1        |
| Pizza           | +1     | 2 slices |
| Burger          | +1     | 1        |

---

---

## 🍉 SNACKS

### ✅ Good

| Food              | Points | Ideal     |
| ----------------- | ------ | --------- |
| Watermelon        | +2     | 1 bowl    |
| Apple             | +2     | 1         |
| Orange            | +2     | 1         |
| Almonds           | +2     | 10–15     |
| Peanuts (roasted) | +2     | 1 handful |
| Buttermilk        | +1     | 1 glass   |

---

### ⚖️ Neutral

| Food              | Points | Ideal |
| ----------------- | ------ | ----- |
| Coffee (no sugar) | +2     | 1     |
| Tea (1 sugar)     | +1     | 1     |

---

### ❌ Bad

| Food         | Points | Ideal     |
| ------------ | ------ | --------- |
| Banana chips | +0.5   | 1 handful |
| Biscuits     | +0.5   | 2         |
| Ice cream    | +1     | 1 scoop   |
| Chocolate    | +1     | 1 bar     |

---

---

# 🧠 UX BEHAVIOR

## Smart Defaults

* Frequently used items → surface on top
* Last logged items → quick access row
* Meal-based filtering (Breakfast/Lunch/Dinner/Snacks)

---

## Add Custom Item (Existing Behavior)

User can:

* Add new food
* Define:

  * Points
  * Ideal portion
  * Category

---

## Recommendation Engine (Optional Enhancement)

After logging:

> “You often log biriyani — try reducing portion to stay within ideal”

---

# 📦 DATA MODEL

```json
{
  "name": "Eggs",
  "category": "good",
  "points_per_portion": 2,
  "ideal_portion": 3,
  "meal_type": "breakfast"
}
```

---

# 🔄 Migration Strategy

## On First Install

* Seed all default items into `meal_items` table

## On Update

* Only add missing items
* Do NOT overwrite user-modified/custom items

---

# 🚀 Future Enhancements

* Regional presets (Kerala / North Indian / Urban fast food)
* AI-based food recognition
* Meal combos (e.g., “rice + dal + chicken” quick add)

---

# 🚨 Risks

* Overloading user with too many options
  → Mitigation: category-based filtering + search

* Wrong scoring perception
  → Mitigation: transparent scoring logic

---

# 🏁 Final Positioning

This system ensures:

* **Instant usability from Day 1**
* **Behavioral nudging via scoring**
* **No dependency on user setup**

---

# 🔥 Bottom Line

> If logging food takes effort → user quits
> If options feel real → user sticks

This system guarantees the second.
