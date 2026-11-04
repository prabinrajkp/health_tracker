import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  backAction, tabAction, recordMove, getTrail, resetTrail, outsideAction,
  addOverlay, closeTopOverlay, overlayCount,
} from '../navigation'

const page = (to, extra = {}) => {
  const [pathname, q] = to.split('?')
  return { pathname, search: q ? `?${q}` : '', ...extra }
}
const trail = (...tos) => tos.map(t => (typeof t === 'string' ? page(t) : t))

// Plays a list of moves the way react-router reports them, and returns the trail
let n = 0
const loc = (to, state) => ({ ...page(to), key: `k${++n}`, state })
function play(moves) {
  resetTrail()
  for (const [kind, to, state] of moves) recordMove(loc(to, state), kind)
  return getTrail()
}

describe('back', () => {
  it('leaves the app from Today', () => {
    expect(backAction(trail('/'))).toEqual({ type: 'leave' })
  })

  it('goes from any tab straight to Today, however many were visited', () => {
    expect(backAction(trail('/', '/log'))).toEqual({ type: 'go', delta: -1 })
    expect(backAction(trail('/', '/profile', '/settings', '/progress'))).toEqual({ type: 'go', delta: -3 })
    expect(backAction(trail('/progress'))).toEqual({ type: 'replace', to: '/' })
  })

  it('goes from a detail page or a section to what opened it', () => {
    expect(backAction(trail('/', '/profile', '/settings', '/settings?section=appearance'))).toEqual({ type: 'go', delta: -1 })
    expect(backAction(trail('/', '/weight'))).toEqual({ type: 'go', delta: -1 })
  })

  it('goes up to the parent when nothing is behind', () => {
    expect(backAction(trail('/weight'))).toEqual({ type: 'replace', to: '/' })
    expect(backAction(trail('/profile/badges'))).toEqual({ type: 'replace', to: '/profile' })
    expect(backAction(trail('/settings'))).toEqual({ type: 'replace', to: '/profile' })
    expect(backAction(trail('/settings?section=body'))).toEqual({ type: 'replace', to: '/settings' })
  })

  it('goes to Today from a screen opened by a notification or widget', () => {
    expect(backAction(trail('/', '/progress', page('/weight', { outside: true })))).toEqual({ type: 'replace', to: '/' })
    expect(backAction(trail('/', '/settings', page('/log?tab=sleep', { outside: true })))).toEqual({ type: 'replace', to: '/' })
  })
})

describe('switching tabs', () => {
  it('adds one step from Today, then replaces', () => {
    expect(tabAction(trail('/'), '/log')).toEqual({ type: 'push', to: '/log' })
    expect(tabAction(trail('/', '/log'), '/progress')).toEqual({ type: 'replace', to: '/progress' })
    expect(tabAction(trail('/', '/profile', '/settings'), '/log?tab=move')).toEqual({ type: 'replace', to: '/log?tab=move' })
  })

  it('goes back to the start for Today', () => {
    expect(tabAction(trail('/', '/log'), '/')).toEqual({ type: 'go', delta: -1 })
    expect(tabAction(trail('/progress'), '/')).toEqual({ type: 'replace', to: '/' })
  })

  it('never peels: four tabs later, back is Today then out', () => {
    let t = play([['POP', '/']])
    for (const to of ['/log', '/progress', '/', '/profile', '/log']) {
      const a = tabAction(t, to)
      if (a.type === 'push') recordMove(loc(to), 'PUSH')
      else if (a.type === 'replace') recordMove(loc(to), 'REPLACE')
      else { resetTrail(); recordMove(loc('/'), 'POP') }
      t = getTrail()
    }
    expect(t.map(e => e.pathname)).toEqual(['/', '/log'])
    expect(backAction(t)).toEqual({ type: 'go', delta: -1 })
  })
})

describe('the record of pages', () => {
  beforeEach(() => resetTrail())

  it('follows pushes, replaces and steps back', () => {
    resetTrail()
    const a = loc('/'); recordMove(a, 'POP')
    recordMove(loc('/profile'), 'PUSH')
    recordMove(loc('/settings'), 'PUSH')
    recordMove(loc('/settings?section=appearance'), 'PUSH')
    expect(getTrail()).toHaveLength(4)
    recordMove(loc('/settings?section=water'), 'REPLACE')
    expect(getTrail()[3].search).toBe('?section=water')
    recordMove(a, 'POP')
    expect(getTrail().map(e => e.pathname)).toEqual(['/'])
  })

  it('remembers a screen came from outside', () => {
    const t = play([['POP', '/'], ['PUSH', '/progress'], ['REPLACE', '/weight', { outside: true }]])
    expect(t[1].outside).toBe(true)
    expect(outsideAction('/weight')).toEqual({ type: 'replace', to: '/weight', state: { outside: true } })
  })
})

describe('sheets and pop-ups', () => {
  it('back closes the newest first, then has nothing to close', () => {
    const first = vi.fn(), second = vi.fn()
    const removeFirst = addOverlay(first)
    const removeSecond = addOverlay(second)
    expect(closeTopOverlay()).toBe(true)
    expect(second).toHaveBeenCalled()
    removeSecond()
    expect(closeTopOverlay()).toBe(true)
    expect(first).toHaveBeenCalled()
    removeFirst()
    expect(overlayCount()).toBe(0)
    expect(closeTopOverlay()).toBe(false)
  })
})
