// Taps made on a widget while the app was closed. Android code cannot reach the
// app's database, so the widget keeps each tap in an inbox file, and the app
// writes it to the database the next time it opens. Items are removed from the
// inbox only after they are written, and applied ids are remembered, so a crash
// in between neither loses a tap nor logs it twice.
//
// See docs/widgets_plan.md §3.
import { Capacitor } from '@capacitor/core'
import { format } from 'date-fns'
import db from './db'
import { addWaterEntry, removeWaterEntry, saveWeightEntry } from './localStore'
import { startSleepTimer, stopSleepTimer, getSleepTimerStart, hhmm } from './sleepTimer'
import { runWidgetTask, publishNow, Widgets } from './widgetData'

const APPLIED_KEY = 'widget_inbox_applied'
const KEEP_APPLIED = 300
export const APPLIED_EVENT = 'hq-widget-applied'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = (d) => typeof d === 'string' && DATE.test(d)

// What still needs writing, oldest first: start, then stop, gives the right night
export function pendingItems(items = [], applied = new Set()) {
  return items
    .filter(i => i && typeof i.id === 'string' && !applied.has(i.id))
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))
}

// Returns whether the item changed anything. An item from a newer version of the
// widget is skipped, not fatal.
const STORE = { addWaterEntry, removeWaterEntry, saveWeightEntry, startSleepTimer, stopSleepTimer, getSleepTimerStart }

export async function applyItem(item, store = STORE) {
  const at = Number(item.at) || Date.now()
  switch (item.type) {
    case 'water': {
      const ml = Math.round(Number(item.ml))
      if (!validDate(item.date) || !(ml > 0)) return false
      await store.addWaterEntry(item.date, { ml, kind: 'water', id: item.id, time: hhmm(at) })
      return true
    }
    case 'water_undo':
      if (!validDate(item.date) || !item.target) return false
      await store.removeWaterEntry(item.date, item.target)
      return true
    case 'sleep_start':
      store.startSleepTimer(at, { quiet: true })
      return true
    case 'sleep_stop': {
      // The app's own start wins; the widget's copy covers a timer the app never heard of
      const startedAt = store.getSleepTimerStart() || Number(item.startedAt) || null
      await store.stopSleepTimer({ endAt: at, startedAt })
      return !!startedAt
    }
    case 'weight': {
      const kg = Math.round(Number(item.kg) * 10) / 10
      if (!validDate(item.date) || !(kg >= 20 && kg <= 400)) return false
      await store.saveWeightEntry({ date: item.date, weight_kg: kg })
      return true
    }
    default:
      return false
  }
}

// Writes each item not yet applied, oldest first, and adds its id to `applied`.
// A failed item is still marked, so one bad tap cannot block the rest for ever.
export async function applyPending(items, applied, store = STORE) {
  const done = []
  for (const item of pendingItems(items, applied)) {
    try {
      if (await applyItem(item, store)) done.push(item)
    } catch (e) {
      console.warn('[Widgets:inbox]', item.type, e)
    }
    applied.add(item.id)
  }
  return done
}

async function readApplied() {
  const row = await db.tracker_config.get(APPLIED_KEY)
  try { return new Set(JSON.parse(row?.value || '[]')) } catch { return new Set() }
}

// Applies everything waiting, then publishes fresh widget data in the same step, which
// is what tells the widget those items are now counted and can leave the inbox.
// Returns the items written, so the screens know to reload.
export function applyWidgetInbox() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve([])
  return runWidgetTask(async () => {
    const { items: raw } = await Widgets.readInbox()
    let items = []
    try { items = JSON.parse(raw || '[]') } catch {}
    if (!Array.isArray(items) || !items.length) return []

    const applied = await readApplied()
    const done = await applyPending(items, applied)
    const keep = [...applied].slice(-KEEP_APPLIED)
    await db.tracker_config.put({ key: APPLIED_KEY, value: JSON.stringify(keep), updated_at: new Date().toISOString() })
    await publishNow(items.map(i => i?.id).filter(Boolean))
    if (done.length) {
      try { window.dispatchEvent(new CustomEvent(APPLIED_EVENT, { detail: { count: done.length, at: format(new Date(), 'HH:mm') } })) } catch {}
    }
    return done
  })
}
