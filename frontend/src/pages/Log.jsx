import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Utensils, Footprints, Moon, Check } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import useStore from '../store/useStore'
import { scheduleSmartNotifications } from '../services/notificationEngine'
import { scheduleTrendNotifications } from '../services/trendNotificationEngine'
import { CATEGORY_COLORS } from '../services/scoreMeta'
import FoodSection from './log/FoodSection'
import MoveSection from './log/MoveSection'
import SleepSection from './log/SleepSection'

const TABS = [
  { id: 'food',  label: 'Food',  Icon: Utensils,   color: CATEGORY_COLORS.diet },
  { id: 'move',  label: 'Move',  Icon: Footprints, color: CATEGORY_COLORS.workout },
  { id: 'sleep', label: 'Sleep', Icon: Moon,       color: CATEGORY_COLORS.sleep },
]
// Names the tabs had before the rename — old links still land in the right place.
const TAB_ALIAS = { diet: 'food', workout: 'move' }

export default function Log() {
  const { fetchTodayScore } = useStore()
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const initial = TAB_ALIAS[requested] || (TABS.some(t => t.id === requested) ? requested : 'food')

  const [tab, setTab]     = useState(initial)
  const [saved, setSaved] = useState(false)
  const savedTimer  = useRef(null)
  const touchStartX = useRef(null)

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  // Everything the old Save button did besides writing the record: refresh the
  // score, re-plan today's notifications, and confirm — quietly, once per change.
  const afterSave = useCallback(async () => {
    await fetchTodayScore()
    scheduleSmartNotifications().catch(() => {})
    scheduleTrendNotifications().catch(() => {})
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [fetchTodayScore])

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 80) return
    const idx = TABS.findIndex(t => t.id === tab)
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1].id)
    if (dx > 0 && idx > 0) setTab(TABS[idx - 1].id)
  }

  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in">
      <div className="page-header">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">Log</h1>
          <p className="text-xs text-text-muted">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold text-success transition-opacity duration-300 ${saved ? 'opacity-100' : 'opacity-0'}`}
          aria-live="polite">
          <Check size={13} strokeWidth={3} />Saved
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={handleTouchEnd}>

        <div className="grid grid-cols-3 gap-1 bg-surface-elevated rounded-2xl p-1">
          {TABS.map(({ id, label, Icon, color }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active ? 'bg-surface-card shadow-sm' : ''}`}
                style={{ color: active ? color : 'rgb(var(--c-text-muted))' }}>
                <Icon size={15} strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </button>
            )
          })}
        </div>

        {tab === 'food'  && <FoodSection  afterSave={afterSave} />}
        {tab === 'move'  && <MoveSection  afterSave={afterSave} />}
        {tab === 'sleep' && <SleepSection afterSave={afterSave} />}
      </div>
    </div>
  )
}
