// Default food options seeded on first install. Based on food_default.md.
// 'good' category → positive points; 'bad' → points negated at log time.
// Neutral foods from spec mapped to 'good' with low points (they still contribute positively).
export const DEFAULT_FOODS = [
  // ── BREAKFAST — Good ──
  { label: 'Eggs (boiled/scrambled)', category: 'good', points: 2, idealPortions: 3 },
  { label: 'Oats + milk',            category: 'good', points: 2, idealPortions: 1 },
  { label: 'Fruit bowl (mixed)',      category: 'good', points: 2, idealPortions: 1 },
  { label: 'Banana',                 category: 'good', points: 1, idealPortions: 1 },
  { label: 'Peanut butter (natural)',category: 'good', points: 1, idealPortions: 1 },
  { label: 'Curd / yogurt',          category: 'good', points: 2, idealPortions: 1 },
  // ── BREAKFAST — Neutral (low positive) ──
  { label: 'Upma',                   category: 'good', points: 1, idealPortions: 1 },
  { label: 'Idli',                   category: 'good', points: 1, idealPortions: 2 },
  { label: 'Dosa (plain)',           category: 'good', points: 1, idealPortions: 1 },
  { label: 'Poha',                   category: 'good', points: 1, idealPortions: 1 },
  { label: 'Bread (brown)',          category: 'good', points: 1, idealPortions: 2 },
  // ── BREAKFAST — Bad ──
  { label: 'White bread + jam',      category: 'bad',  points: 1, idealPortions: 2 },
  { label: 'Parotta',                category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Maggi / instant noodles',category: 'bad', points: 1, idealPortions: 1 },
  { label: 'Sugary cereal',          category: 'bad',  points: 1, idealPortions: 1 },
  // ── LUNCH — Good ──
  { label: 'Rice (controlled portion)',category: 'good', points: 2, idealPortions: 1 },
  { label: 'Chapati',                category: 'good', points: 2, idealPortions: 2 },
  { label: 'Dal',                    category: 'good', points: 2, idealPortions: 1 },
  { label: 'Chana / rajma',          category: 'good', points: 3, idealPortions: 1 },
  { label: 'Paneer curry',           category: 'good', points: 2, idealPortions: 1 },
  { label: 'Chicken curry',          category: 'good', points: 3, idealPortions: 1 },
  { label: 'Fish curry',             category: 'good', points: 3, idealPortions: 1 },
  { label: 'Vegetable sabzi',        category: 'good', points: 2, idealPortions: 1 },
  { label: 'Salad (cucumber/carrot)',category: 'good', points: 1, idealPortions: 1 },
  // ── LUNCH — Neutral ──
  { label: 'Lemon rice',             category: 'good', points: 1, idealPortions: 1 },
  { label: 'Fried rice',             category: 'good', points: 1, idealPortions: 1 },
  { label: 'Egg masala',             category: 'good', points: 1, idealPortions: 1 },
  // ── LUNCH — Bad ──
  { label: 'Biriyani',               category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Chicken 65 / fried chicken', category: 'bad', points: 1, idealPortions: 1 },
  { label: 'Potato fry (deep fried)',category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Soft drinks',            category: 'bad',  points: 1, idealPortions: 1 },
  // ── DINNER — Good (distinct from lunch items) ──
  { label: 'Rice (light portion)',   category: 'good', points: 2, idealPortions: 1 },
  { label: 'Vegetable curry',        category: 'good', points: 2, idealPortions: 1 },
  { label: 'Curd + cucumber salad', category: 'good', points: 2, idealPortions: 1 },
  // ── DINNER — Neutral ──
  { label: 'Egg bhurji',             category: 'good', points: 2, idealPortions: 2 },
  { label: 'Pathiri',                category: 'good', points: 1, idealPortions: 2 },
  // ── DINNER — Bad ──
  { label: 'Late heavy rice',        category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Shawarma',               category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Pizza',                  category: 'bad',  points: 1, idealPortions: 2 },
  { label: 'Burger',                 category: 'bad',  points: 1, idealPortions: 1 },
  // ── SNACKS — Good ──
  { label: 'Watermelon',             category: 'good', points: 2, idealPortions: 1 },
  { label: 'Apple',                  category: 'good', points: 2, idealPortions: 1 },
  { label: 'Orange',                 category: 'good', points: 2, idealPortions: 1 },
  { label: 'Almonds',                category: 'good', points: 2, idealPortions: 1 },
  { label: 'Peanuts (roasted)',      category: 'good', points: 2, idealPortions: 1 },
  { label: 'Buttermilk',             category: 'good', points: 1, idealPortions: 1 },
  // ── SNACKS — Neutral ──
  { label: 'Coffee (no sugar)',      category: 'good', points: 2, idealPortions: 1 },
  { label: 'Tea (1 sugar)',          category: 'good', points: 1, idealPortions: 1 },
  // ── SNACKS — Bad ──
  { label: 'Banana chips',           category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Biscuits',               category: 'bad',  points: 1, idealPortions: 2 },
  { label: 'Ice cream',              category: 'bad',  points: 1, idealPortions: 1 },
  { label: 'Chocolate',              category: 'bad',  points: 1, idealPortions: 1 },
]

// Seeds default foods into existing custom_meal_options.
// Only adds items that don't already have the same label — never overwrites.
export async function seedFoodDefaults(db) {
  try {
    const seeded = await db.tracker_config.get('food_defaults_seeded_v1')
    if (seeded?.value === 'true') return

    const existing = await db.tracker_config.get('custom_meal_options')
    const current = existing?.value ? JSON.parse(existing.value) : []
    const existingLabels = new Set(current.map(f => f.label.toLowerCase()))

    const toAdd = DEFAULT_FOODS
      .filter(f => !existingLabels.has(f.label.toLowerCase()))
      .map(f => ({ ...f, id: Math.random().toString(36).slice(2, 10) }))

    if (toAdd.length > 0) {
      await db.tracker_config.put({
        key: 'custom_meal_options',
        value: JSON.stringify([...current, ...toAdd]),
      })
    }

    await db.tracker_config.put({ key: 'food_defaults_seeded_v1', value: 'true' })
  } catch (e) {
    console.error('seedFoodDefaults failed silently:', e)
  }
}
