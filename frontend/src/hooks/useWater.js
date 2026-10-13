import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { getWaterDay, getWaterGoal, addWaterEntry, removeWaterEntry, getConfig, getDiet } from '../api/client'
import { waterTotals, mealDrinks, glassSize, DEFAULT_GLASS_ML } from '../services/hydration'

// Today's drinks: what was tapped in, what was logged in meals, the goal in
// force and the user's glass size, with the actions to add and remove a drink.
// One instance is shared by a screen's card or row and the Drinks sheet it
// opens, so they always show the same numbers.
//
// Pass `diet` when the screen already holds today's diet log (the Food log
// does, and edits it live); otherwise the hook loads it and `reload()`
// refreshes it after a meal is logged.
export function useWater({ diet: liveDiet } = {}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [entries, setEntries]       = useState([])
  const [goal, setGoal]             = useState(null)
  const [glassMl, setGlassMl]       = useState(DEFAULT_GLASS_ML)
  const [loadedDiet, setLoadedDiet] = useState(null)
  const ownsDiet = liveDiet === undefined

  const reload = useCallback(async () => {
    const [day, g, rows, diet] = await Promise.all([
      getWaterDay(today), getWaterGoal(), getConfig(), ownsDiet ? getDiet(today) : null,
    ])
    setEntries(day?.entries || [])
    setGoal(g)
    const map = {}
    rows.forEach(r => { map[r.key] = r.value })
    setGlassMl(glassSize(map))
    if (ownsDiet) setLoadedDiet(diet)
  }, [ownsDiet])

  useEffect(() => { reload().catch(console.error) }, [reload])

  const diet     = ownsDiet ? loadedDiet : liveDiet
  const fromMeals = mealDrinks(diet)
  const totals   = waterTotals(entries, diet)
  const targetMl = goal?.targetMl || 0

  const add = useCallback(async (ml, kind = 'water') => {
    try {
      const before = totals.totalMl
      const day = await addWaterEntry(today, { ml, kind })
      setEntries(day.entries)
      if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      // Said once, at the moment the goal is reached — nothing for going past it.
      if (targetMl > 0 && before < targetMl && before + ml >= targetMl) toast.success("You've reached today's drinks goal")
    } catch {
      toast.error('Could not save that drink')
    }
  }, [totals.totalMl, targetMl])

  const remove = useCallback(async (id) => {
    const day = await removeWaterEntry(today, id)
    setEntries(day?.entries || [])
  }, [])

  const undoLast = useCallback(() => {
    const last = entries[entries.length - 1]
    return last ? remove(last.id) : undefined
  }, [entries, remove])

  return { entries, fromMeals, totals, goal, targetMl, glassMl, add, remove, undoLast, reload }
}
