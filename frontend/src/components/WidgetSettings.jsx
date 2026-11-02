import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Plus, Play, Utensils, Footprints, Moon, Scale, Minus, Flame } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import WaterGlass from './WaterGlass'
import { Widgets } from '../services/widgetData'

// Settings → Widgets: what each home-screen widget is for, a preview drawn in the app's
// own colours, and an Add button that asks the launcher to place it.
// See docs/widgets_plan.md §6.

const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl bg-surface-card p-3 ${className}`} style={{ border: '1px solid var(--card-border)' }} aria-hidden="true">
    {children}
  </div>
)
const Bar = ({ pct, color = 'bg-brand' }) => (
  <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
  </div>
)

// Small pictures of each widget, not live data
const PREVIEWS = {
  today: () => (
    <Card>
      <div className="flex items-end justify-between">
        <p className="flex items-baseline gap-1"><span className="text-2xl font-bold tabular-nums text-text-primary">72</span><span className="text-xs text-text-muted">/ 100</span></p>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-brand-light bg-brand/15">B · Great</span>
      </div>
      <p className="text-xs font-semibold text-brand-light mt-2">Next</p>
      <p className="text-sm font-semibold text-text-primary">Log lunch</p>
    </Card>
  ),
  week: () => (
    <Card className="flex items-center gap-3">
      <div className="flex-1 grid grid-cols-7 gap-1 text-center">
        {/* As on the widget: a dot per scored day, a ring for today, small dots for days to come */}
        {['w-3 h-3 bg-success', 'w-3 h-3 bg-brand', 'w-3 h-3 bg-warning', 'w-3 h-3 border-2 border-surface-muted',
          'w-1 h-1 bg-surface-muted', 'w-1 h-1 bg-surface-muted', 'w-1 h-1 bg-surface-muted'].map((dot, i) => (
          <div key={i} className="flex flex-col items-center">
            <p className="text-xs text-text-muted">{'MTWTFSS'[i]}</p>
            <span className="h-3 mt-1 flex items-center"><span className={`inline-block rounded-full ${dot}`} /></span>
          </div>
        ))}
      </div>
      <p className="text-center"><span className="block text-xl font-bold tabular-nums text-text-primary">71</span><span className="text-xs text-text-muted">avg</span></p>
    </Card>
  ),
  calories: () => (
    <Card>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><Flame size={13} />Calories</p>
      <p className="text-2xl font-bold tabular-nums text-text-primary mt-1">1420</p>
      <p className="text-xs text-text-muted mb-2">of 2652 kcal</p>
      <Bar pct={54} />
    </Card>
  ),
  goals: () => (
    <Card>
      <p className="text-lg font-bold text-text-primary">Level 7</p>
      <div className="my-2"><Bar pct={60} /></div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"><Flame size={14} className="text-warning" />12 days</p>
      <p className="text-xs text-text-secondary mt-0.5">2 of 5 goals today</p>
    </Card>
  ),
  drinks: () => (
    <Card className="flex items-center gap-3">
      <WaterGlass fraction={0.57} size={40} />
      <span className="flex-1"><span className="block text-sm font-semibold text-text-primary tabular-nums">1.2 L</span><span className="block text-xs text-text-muted">of 2.1 L</span></span>
      <span className="w-9 h-9 rounded-xl bg-brand text-onbrand flex items-center justify-center"><Plus size={18} /></span>
    </Card>
  ),
  sleep: () => (
    <Card className="p-2">
      <div className="rounded-xl bg-surface-elevated py-3 flex items-center justify-center gap-2 text-sm font-semibold text-text-primary">
        <Play size={15} />Going to sleep
      </div>
    </Card>
  ),
  quick: () => (
    <Card className="grid grid-cols-4 text-center">
      {[[Utensils, 'Meal', '1 of 3'], [Footprints, 'Move', '4.2k'], [Moon, 'Sleep', 'Logged'], [Scale, 'Weight', 'Not yet']].map(([Icon, label, status]) => (
        <div key={label}>
          <p className="flex items-center justify-center gap-1 text-xs font-semibold text-text-primary"><Icon size={13} />{label}</p>
          <p className="text-xs text-text-muted mt-1">{status}</p>
        </div>
      ))}
    </Card>
  ),
  weight: () => (
    <Card className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-xl bg-surface-elevated flex items-center justify-center text-text-secondary"><Minus size={15} /></span>
      <span className="flex-1 text-center text-lg font-bold tabular-nums text-text-primary">72.4</span>
      <span className="w-8 h-8 rounded-xl bg-surface-elevated flex items-center justify-center text-text-secondary"><Plus size={15} /></span>
      <span className="w-8 h-8 rounded-xl bg-brand text-onbrand flex items-center justify-center"><Check size={15} /></span>
    </Card>
  ),
}

const GROUPS = [
  { title: 'To see', items: [
    { kind: 'today', name: "Today's score", desc: 'Your score, grade and what to do next' },
    { kind: 'week', name: 'This week', desc: 'A dot for each day, the average, and one thing to fix' },
    { kind: 'calories', name: 'Calories', desc: 'Food against your target', personal: true },
    { kind: 'goals', name: 'Goals', desc: "Level, streak and today's goals" },
  ] },
  { title: 'To log', items: [
    { kind: 'drinks', name: 'Drinks', desc: 'One tap adds a glass of water' },
    { kind: 'sleep', name: 'Sleep timer', desc: 'Start it in bed, stop it when you wake' },
    { kind: 'quick', name: 'Quick log', desc: 'Meal, move, sleep and weight, one tap away' },
    { kind: 'weight', name: 'Weight', desc: "Today's weight in 0.1 kg steps", personal: true },
  ] },
]

const MANUAL = 'Touch and hold an empty part of your home screen, tap Widgets, then find Health Quest.'

export default function WidgetSettings() {
  const native = Capacitor.isNativePlatform()
  const [status, setStatus] = useState({ canPin: false, placed: {} })

  const load = () => {
    if (!native) return
    Widgets.status().then(setStatus).catch(() => {})
  }

  useEffect(() => {
    load()
    // Back from the launcher's own "Add to home screen?" question
    const onShow = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])

  const add = async (kind) => {
    try {
      const { requested } = await Widgets.pin({ kind })
      if (!requested) toast(MANUAL, { duration: 7000 })
      setTimeout(load, 4000)
    } catch {
      toast(MANUAL, { duration: 7000 })
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        See your day and log the everyday things from your home screen. Widgets follow the theme you chose here.
      </p>

      {GROUPS.map(group => (
        <section key={group.title}>
          <h2 className="section-label">{group.title}</h2>
          <div className="group-list">
            {group.items.map(({ kind, name, desc, personal }) => {
              const placed = status.placed?.[kind] > 0
              const Preview = PREVIEWS[kind]
              return (
                <div key={kind} className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-base text-text-primary">{name}</span>
                      <span className="block text-sm text-text-secondary">{desc}</span>
                    </span>
                    {native && (placed ? (
                      <span className="flex items-center gap-1 text-sm font-semibold text-success shrink-0"><Check size={15} />Added</span>
                    ) : (
                      <button onClick={() => add(kind)} className="btn-ghost px-4 py-2 shrink-0" aria-label={`Add the ${name} widget`}>
                        <Plus size={15} />Add
                      </button>
                    ))}
                  </div>
                  <div className="max-w-[18rem]"><Preview /></div>
                  {personal && <p className="t-caption">Shows personal numbers. Anyone who can see your home screen sees them.</p>}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="card space-y-2">
        <p className="section-label">Logging from a widget</p>
        <p className="text-sm text-text-secondary">
          A drink, a night or a weight tapped on a widget is kept on your phone and added to your logs the next time you open the app.
          Drinks show straight away. Scores update when you open the app.
        </p>
      </div>

      {native ? (
        !status.canPin && <p className="text-sm text-text-secondary">Your launcher cannot add widgets from here. {MANUAL}</p>
      ) : (
        <p className="text-sm text-text-secondary">Widgets are part of the Android app.</p>
      )}
    </div>
  )
}
