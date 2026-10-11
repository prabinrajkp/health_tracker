import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { getWaterDay, getWaterGoal, addWaterEntry, removeWaterEntry, getConfig } from '../api/client'
import { waterTotals, glassSize, DEFAULT_GLASS_ML } from '../services/hydration'

// Today's drinks, the goal in force and the user's glass size, with the
// actions to add and remove a drink. Used by the Today card and Log → Food.
export function useWater() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [entries, setEntries] = useState([])
  const [goal, setGoal]       = useState(null)
  const [glassMl, setGlassMl] = useState(DEFAULT_GLASS_ML)

  useEffect(() => {
    Promise.all([getWaterDay(today), getWaterGoal(), getConfig()]).then(([day, g, rows]) => {
      setEntries(day?.entries || [])
      setGoal(g)
      const map = {}
      rows.forEach(r => { map[r.key] = r.value })
      setGlassMl(glassSize(map))
    }).catch(console.error)
  }, [])

  const totals   = waterTotals(entries)
  const targetMl = goal?.targetMl || 0

  const add = useCallback(async (ml, kind = 'water') => {
    try {
      const before = waterTotals(entries).totalMl
      const day = await addWaterEntry(today, { ml, kind })
      setEntries(day.entries)
      if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      // Said once, at the moment the goal is reached — nothing for going past it.
      if (targetMl > 0 && before < targetMl && before + ml >= targetMl) toast.success("You've reached today's drinks goal")
    } catch {
      toast.error('Could not save that drink')
    }
  }, [entries, targetMl])

  const remove = useCallback(async (id) => {
    const day = await removeWaterEntry(today, id)
    setEntries(day?.entries || [])
  }, [])

  const undoLast = useCallback(() => {
    const last = entries[entries.length - 1]
    return last ? remove(last.id) : undefined
  }, [entries, remove])

  return { entries, totals, goal, targetMl, glassMl, add, remove, undoLast }
}
