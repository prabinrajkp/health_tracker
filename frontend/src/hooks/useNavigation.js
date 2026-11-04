import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addOverlay, backAction, tabAction, getTrail, run, rememberSubTab, rememberedSubTab, isTab } from '../services/navigation'

// While `active`, the Android back button calls `onBack` before anything else.
// Sheets, pop-ups and steps inside them use this, newest on top.
export function useBackClose(active, onBack) {
  const latest = useRef(onBack)
  latest.current = onBack
  useEffect(() => {
    if (!active) return undefined
    return addOverlay(() => latest.current())
  }, [active])
}

// The back arrow on a page: the same rule as the Android back button
export function useGoBack() {
  const navigate = useNavigate()
  return () => run(navigate, backAction(getTrail()))
}

// Opens a tab, or a view inside one (`/log?tab=sleep`), without adding to the history
export function useOpenTab() {
  const navigate = useNavigate()
  return (to) => run(navigate, tabAction(getTrail(), to))
}

// A view inside a tab (Food, Move, Sleep; Week, Month, Trends), kept in the address so
// any link always shows the right one, even when the page is already open. Switching
// replaces the address, so back skips the views. A tab opened without a view comes
// back on the one it was left on.
export function useSubTab(page, ids, fallback, alias = {}) {
  const [params, setParams] = useSearchParams()
  const asked = alias[params.get('tab')] || params.get('tab')
  const remembered = rememberedSubTab(page)
  const tab = ids.includes(asked) ? asked : ids.includes(remembered) ? remembered : fallback
  useEffect(() => { rememberSubTab(page, tab) }, [page, tab])
  const setTab = (next) => {
    if (next === tab) return
    setParams(current => {
      const q = new URLSearchParams(current)
      q.set('tab', next)
      return q
    }, { replace: true })
  }
  return [tab, setTab]
}

// Opens any screen: a tab without adding to the history, a detail page one step in
export function useOpen() {
  const navigate = useNavigate()
  return (to) => (isTab(to.split('?')[0]) ? run(navigate, tabAction(getTrail(), to)) : navigate(to))
}
