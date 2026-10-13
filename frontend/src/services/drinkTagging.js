// Which foods are drinks, and how much one portion holds.
//
// A food tagged as a drink carries `isDrink` and `mlPerPortion`; logging it in
// a meal then counts toward the day's drinks total with no second entry.
// `drinkTagBy` records who set the tag, and a stronger source is never
// overwritten by a weaker one:   user  >  ai  >  rule  >  (untagged)
//
// The rules below work offline with no AI key. They are deliberately
// conservative: an untagged drink only under-counts, while a wrongly tagged
// food would inflate the total.

const TRUST = { rule: 1, ai: 2, user: 3 }

export const ML_LIMITS = { min: 20, max: 1500 }

// Checked in order; the first match wins. Typical Indian household servings.
const DRINK_RULES = [
  { ml: 150, words: ['tea', 'chai', 'coffee', 'kaapi', 'sulaimani', 'kahwa', 'espresso', 'latte', 'cappuccino'] },
  { ml: 200, words: ['juice', 'sharbat', 'sherbet', 'nimbu pani', 'lemon water', 'lime water', 'lemonade', 'jaljeera', 'aam panna', 'kokum'] },
  { ml: 200, words: ['buttermilk', 'chaas', 'chaach', 'moru', 'sambharam', 'lassi', 'milkshake', 'shake', 'smoothie', 'badam milk', 'milk'] },
  { ml: 250, words: ['soft drink', 'soft drinks', 'soda', 'cola', 'coke', 'pepsi', 'sprite', 'fanta', 'energy drink'] },
  { ml: 250, words: ['coconut water', 'tender coconut', 'water'] },
]

// Names containing these are food even when a drink word appears in them
// ("Oats + milk", "Milk chocolate", "Tea biscuit", "Watermelon", "Coffee cake").
const FOOD_WORDS = [
  'oats', 'cereal', 'porridge', 'biscuit', 'biscuits', 'cake', 'chocolate', 'ice cream', 'bread', 'rice', 'curry',
  'powder', 'toast', 'cookie', 'cookies', 'sweet', 'halwa', 'payasam', 'kheer', 'pudding', 'rusk', 'bun', 'paneer',
]

const norm = (s) => ` ${(s || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()} `
const hasWord = (text, word) => text.includes(` ${word} `)

export function clampMl(value) {
  const ml = Math.round(Number(value))
  return Number.isFinite(ml) && ml >= ML_LIMITS.min && ml <= ML_LIMITS.max ? ml : null
}

// What the built-in rules make of a food name.
export function ruleTag(label) {
  const text = norm(label)
  if (text.trim() === '') return { isDrink: false, mlPerPortion: null }
  // "X + Y" is a dish, and so is anything naming a solid food
  if (text.includes('+') || FOOD_WORDS.some(w => hasWord(text, w))) return { isDrink: false, mlPerPortion: null }
  for (const rule of DRINK_RULES) {
    if (rule.words.some(w => hasWord(text, w))) return { isDrink: true, mlPerPortion: rule.ml }
  }
  return { isDrink: false, mlPerPortion: null }
}

// Applies a tag from `source` unless the food already has one from a source
// that is trusted at least as much. Returns the same object when nothing changes.
export function applyDrinkTag(food, tag, source) {
  if ((TRUST[food.drinkTagBy] || 0) >= TRUST[source] && source !== 'user') return food
  const ml = tag.isDrink ? clampMl(tag.mlPerPortion) : null
  // A "drink" with no usable volume cannot be counted, so it is not tagged as one
  const isDrink = !!tag.isDrink && ml !== null
  return { ...food, isDrink, mlPerPortion: isDrink ? ml : null, drinkTagBy: source }
}

// Tags every food the rules have not looked at yet. Used once on upgrade and
// for foods added by hand.
export function tagFoodsByRule(foods = []) {
  let changed = 0
  const tagged = foods.map(food => {
    if (food.drinkTagBy) return food
    changed++
    return applyDrinkTag(food, ruleTag(food.label), 'rule')
  })
  return { foods: tagged, changed }
}

export const isDrinkFood = (food) => !!food?.isDrink && clampMl(food.mlPerPortion) !== null
