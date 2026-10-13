import { describe, it, expect } from 'vitest'
import { ruleTag, applyDrinkTag, tagFoodsByRule, isDrinkFood, clampMl } from '../drinkTagging'
import { DEFAULT_FOODS } from '../foodDefaults'

describe('ruleTag', () => {
  it('tags common drinks with a typical portion', () => {
    expect(ruleTag('Coffee (no sugar)')).toEqual({ isDrink: true, mlPerPortion: 150 })
    expect(ruleTag('Tea (1 sugar)')).toEqual({ isDrink: true, mlPerPortion: 150 })
    expect(ruleTag('Lemon juice')).toEqual({ isDrink: true, mlPerPortion: 200 })
    expect(ruleTag('Buttermilk')).toEqual({ isDrink: true, mlPerPortion: 200 })
    expect(ruleTag('Soft drinks')).toEqual({ isDrink: true, mlPerPortion: 250 })
    expect(ruleTag('Tender coconut water')).toEqual({ isDrink: true, mlPerPortion: 250 })
    expect(ruleTag('Nimbu pani')).toEqual({ isDrink: true, mlPerPortion: 200 })
    expect(ruleTag('Milk')).toEqual({ isDrink: true, mlPerPortion: 200 })
  })

  it('does not tag foods that merely contain a drink word', () => {
    for (const food of ['Oats + milk', 'Milk chocolate', 'Tea biscuit', 'Watermelon', 'Coffee cake',
      'Curd / yogurt', 'Curd + cucumber salad', 'Coconut rice', 'Milk bread', 'Steak', 'Teapot dumpling']) {
      expect(ruleTag(food).isDrink, food).toBe(false)
    }
  })

  it('tags exactly the four drinks in the default food list', () => {
    const drinks = DEFAULT_FOODS.filter(f => ruleTag(f.label).isDrink).map(f => f.label)
    expect(drinks).toEqual(['Soft drinks', 'Buttermilk', 'Coffee (no sugar)', 'Tea (1 sugar)'])
  })

  it('treats an empty name as not a drink', () => {
    expect(ruleTag('').isDrink).toBe(false)
    expect(ruleTag(undefined).isDrink).toBe(false)
  })
})

describe('applyDrinkTag — who wins', () => {
  const coffee = { id: '1', label: 'Coffee' }

  it('lets the AI override a rule, and the user override both', () => {
    const byRule = applyDrinkTag(coffee, { isDrink: true, mlPerPortion: 150 }, 'rule')
    const byAi   = applyDrinkTag(byRule, { isDrink: true, mlPerPortion: 180 }, 'ai')
    const byUser = applyDrinkTag(byAi, { isDrink: true, mlPerPortion: 250 }, 'user')
    expect(byRule).toMatchObject({ isDrink: true, mlPerPortion: 150, drinkTagBy: 'rule' })
    expect(byAi).toMatchObject({ mlPerPortion: 180, drinkTagBy: 'ai' })
    expect(byUser).toMatchObject({ mlPerPortion: 250, drinkTagBy: 'user' })
  })

  it('never lets rules or AI overwrite the user\'s choice', () => {
    const mine = applyDrinkTag(coffee, { isDrink: false }, 'user')
    expect(applyDrinkTag(mine, { isDrink: true, mlPerPortion: 150 }, 'ai')).toBe(mine)
    expect(applyDrinkTag(mine, { isDrink: true, mlPerPortion: 150 }, 'rule')).toBe(mine)
  })

  it('does not let a rule overwrite the AI', () => {
    const byAi = applyDrinkTag(coffee, { isDrink: false }, 'ai')
    expect(applyDrinkTag(byAi, { isDrink: true, mlPerPortion: 150 }, 'rule')).toBe(byAi)
  })

  it('lets the user change their own tag', () => {
    const mine = applyDrinkTag(coffee, { isDrink: true, mlPerPortion: 150 }, 'user')
    expect(applyDrinkTag(mine, { isDrink: true, mlPerPortion: 300 }, 'user').mlPerPortion).toBe(300)
  })

  it('will not tag a drink without a usable volume', () => {
    expect(applyDrinkTag(coffee, { isDrink: true, mlPerPortion: 0 }, 'ai')).toMatchObject({ isDrink: false, mlPerPortion: null })
    expect(applyDrinkTag(coffee, { isDrink: true, mlPerPortion: 99999 }, 'ai').isDrink).toBe(false)
    expect(clampMl('abc')).toBeNull()
  })
})

describe('tagFoodsByRule', () => {
  it('tags only foods nobody has looked at, and reports how many', () => {
    const mine = { id: '3', label: 'Lassi', isDrink: false, mlPerPortion: null, drinkTagBy: 'user' }
    const { foods, changed } = tagFoodsByRule([{ id: '1', label: 'Tea' }, { id: '2', label: 'Dal' }, mine])
    expect(changed).toBe(2)
    expect(foods[0]).toMatchObject({ isDrink: true, mlPerPortion: 150, drinkTagBy: 'rule' })
    expect(foods[1]).toMatchObject({ isDrink: false, drinkTagBy: 'rule' })
    expect(foods[2]).toBe(mine)
    expect(tagFoodsByRule(foods).changed).toBe(0)
  })
})

describe('isDrinkFood', () => {
  it('needs both the flag and a volume', () => {
    expect(isDrinkFood({ isDrink: true, mlPerPortion: 150 })).toBe(true)
    expect(isDrinkFood({ isDrink: true })).toBe(false)
    expect(isDrinkFood({ mlPerPortion: 150 })).toBe(false)
    expect(isDrinkFood(null)).toBe(false)
  })
})
