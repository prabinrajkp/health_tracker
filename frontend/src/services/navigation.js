// One rule for the Android back button and every back arrow, so they always agree:
// close what is on top, then go up one level, then to Today, then leave.
// See docs/navigation_critique.md §3.
//
// The browser keeps the history but will not show it, so the app keeps its own copy
// of the pages in it (`trail`), updated on every move by NavTrail in App.jsx.

export const TODAY = '/'
export const TABS = ['/', '/log', '/progress', '/profile']

// Where a page goes when there is nothing behind it: opened from a notification
// or a widget with the app closed
export const PARENT = {
  '/weight': '/',
  '/profile/badges': '/profile',
  '/settings': '/profile',
}

export const isTab = (pathname) => TABS.includes(pathname)

const pathOf = (to) => to.split('?')[0] || '/'
const sectionOf = (search) => new URLSearchParams(search || '').get('section')

/**
 * What back does from the top of `trail` ([{ pathname, search }], oldest first).
 * Pure, so it can be tested. Returns one of:
 *   { type: 'leave' }               on Today: leave the app
 *   { type: 'go', delta: -n }       step back through the history
 *   { type: 'replace', to }         nothing behind this page: put its parent in its place
 */
export function backAction(trail) {
  const current = trail[trail.length - 1]
  if (!current) return { type: 'leave' }
  const { pathname, search } = current

  if (pathname === TODAY) return { type: 'leave' }

  // Opened from a notification or widget: Today, whatever was open before
  if (current.outside) return { type: 'replace', to: TODAY }

  // Tabs are siblings, not a trail: back from any of them is Today
  if (isTab(pathname)) {
    if (trail.length > 1 && trail[0].pathname === TODAY) return { type: 'go', delta: -(trail.length - 1) }
    return { type: 'replace', to: TODAY }
  }

  // A detail page or a Settings section goes back to what opened it
  if (trail.length > 1) return { type: 'go', delta: -1 }
  if (pathname === '/settings' && sectionOf(search)) return { type: 'replace', to: '/settings' }
  return { type: 'replace', to: PARENT[pathname] || TODAY }
}

/**
 * How to switch to a tab from the bottom bar, a button or a link. Switching never
 * adds to the history: from Today a tab is one step in, from anywhere else it takes
 * the current page's place, and Today itself is the bottom of the history.
 */
export function tabAction(trail, to) {
  const path = pathOf(to)
  const current = trail[trail.length - 1]
  if (path === TODAY) {
    if (trail.length > 1 && trail[0].pathname === TODAY && to === TODAY) return { type: 'go', delta: -(trail.length - 1) }
    return { type: 'replace', to }
  }
  if (!current || current.pathname === TODAY) return { type: 'push', to }
  return { type: 'replace', to }
}

// ── The pages in the history ─────────────────────────────────────────────────
let trail = []

export const getTrail = () => trail

// `kind` is react-router's navigation type: PUSH, REPLACE or POP
export function recordMove(location, kind) {
  const entry = { key: location.key, pathname: location.pathname, search: location.search, outside: !!location.state?.outside }
  if (!trail.length) { trail = [entry]; return }
  if (kind === 'PUSH') trail = [...trail, entry]
  else if (kind === 'REPLACE') trail = [...trail.slice(0, -1), entry]
  else {
    const at = trail.findIndex(e => e.key === location.key)
    trail = at >= 0 ? trail.slice(0, at + 1) : [...trail, entry]
  }
}

export function resetTrail() { trail = [] }

// Carries out an action from backAction or tabAction with react-router's navigate
export function run(navigate, action) {
  if (action.type === 'go') navigate(action.delta)
  else if (action.type === 'replace') navigate(action.to, { replace: true, state: action.state })
  else if (action.type === 'push') navigate(action.to)
}

// ── Sheets and pop-ups ───────────────────────────────────────────────────────
// Each open one adds its close function; back calls the newest first.
const overlays = []

export function addOverlay(close) {
  overlays.push(close)
  return () => {
    const at = overlays.lastIndexOf(close)
    if (at >= 0) overlays.splice(at, 1)
  }
}

export function closeTopOverlay() {
  const top = overlays[overlays.length - 1]
  if (!top) return false
  top()
  return true
}

export const overlayCount = () => overlays.length

// ── Sub-tabs remembered for the session ──────────────────────────────────────
// Coming back to Progress lands on the view it was left on, not on Week again.
const lastSubTab = {}
export const rememberSubTab = (page, tab) => { lastSubTab[page] = tab }
export const rememberedSubTab = (page) => lastSubTab[page] || null

// ── Taps from outside the app ────────────────────────────────────────────────
// A notification or widget opens its screen in place of whatever was open, marked
// as opened from outside, so back goes to Today and then out, never to whatever
// was open yesterday. One move, so the trail sees it.
export const outsideAction = (to) => ({ type: 'replace', to, state: { outside: true } })
