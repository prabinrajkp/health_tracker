import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import toast from 'react-hot-toast'
import BadgeUnlockOverlay from './components/BadgeUnlockOverlay'
import Navbar from './components/Navbar'
import Today from './pages/Today'
import Log from './pages/Log'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Badges from './pages/Badges'
import Weight from './pages/Weight'
import Onboarding from './pages/Onboarding'
import { migrateHistoricalScores, migrateSleepDates, migrateSleepDatesV8, seedDrinkTags } from './services/localStore'
import db from './services/db'
import { planNudges, recordTap, consumeNativeTap, takeNotices, refreshModelList } from './services/nudgePlanner'
import { seedFoodDefaults } from './services/foodDefaults'
import { syncStepsBackground, syncActiveCalories } from './services/stepSync'
import { runBadgeEngine } from './services/badgeEngine'
import { watchWidgetData, publishWidgets, scheduleWidgetPublish } from './services/widgetData'
import { applyWidgetInbox } from './services/widgetInbox'
import { recordMove, backAction, closeTopOverlay, getTrail, outsideAction, run } from './services/navigation'

const STEP_SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const RESUME_PLAN_GAP_MS    = 60 * 1000      // switching apps and back should not replan every time

// Old tab routes still open the right screen (query string kept), so links
// saved before the tabs were renamed keep working.
function Redirect({ to }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(null)
  const [unlockQueue, setUnlockQueue] = useState([])
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // The app's own record of the pages in the history, for the back button
  useEffect(() => { recordMove(location, navigationType) }, [location.key])

  useEffect(() => {
    migrateSleepDatesV8().catch(console.error)   // undo v7 mis-convention; runs first
    migrateSleepDates().catch(console.error)
    migrateHistoricalScores().catch(console.error)
    // Foods are seeded first, then tagged as drinks where the rules recognise them.
    // The first screen waits for this, so today's drinks total is right from the first render.
    const foodsReady = seedFoodDefaults(db).then(() => seedDrinkTags()).catch(console.error)

    // Sync steps on open, then every 30 minutes
    syncStepsBackground().catch(() => {})
    syncActiveCalories().catch(() => {})
    const stepSyncTimer = setInterval(() => {
      syncStepsBackground().catch(() => {})
      syncActiveCalories().catch(() => {})
    }, STEP_SYNC_INTERVAL_MS)

    foodsReady.then(() => db.tracker_config.get('onboarding_complete'))
      .then(async cfg => {
        if (cfg?.value === 'true') {
          setOnboardingDone(true)
          return
        }
        // No flag set — check if this is an existing user upgrading from < v2.24
        const existingScores = await db.daily_scores.count()
        if (existingScores > 0) {
          // Existing user: mark complete silently and proceed without onboarding
          await db.tracker_config.put({ key: 'onboarding_complete', value: 'true' })
          setOnboardingDone(true)
        } else {
          setOnboardingDone(false)
        }
      })
      .catch(() => setOnboardingDone(true)) // On db error, never block existing users

    // Taps made on a home-screen widget while the app was closed are written first,
    // so the plan below sees a sleep timer started there. Then the widgets redraw.
    watchWidgetData()
    const inboxDone = foodsReady.then(() => applyWidgetInbox()).catch(() => [])
    inboxDone.then(() => publishWidgets()).catch(() => {})

    // Plan the coming notifications from current data, then say anything owed once
    refreshModelList().catch(() => {})
    inboxDone.then(() => planNudges()).then(() => takeNotices()).then(notices => notices.forEach(n => toast(n, { duration: 6000 }))).catch(() => {})

    // Tapping a notification or widget opens the screen the rule chose for it, with
    // only Today behind it
    const followTap = async (key, route) => {
      await recordTap(key).catch(() => {})
      if (route) run(navigateRef.current, outsideAction(route))
    }
    let lastPlanAt = Date.now()
    const replanOnReturn = async () => {
      const tap = await consumeNativeTap().catch(() => null)
      await applyWidgetInbox().catch(() => [])
      if (tap?.route) followTap(tap.key, tap.route)
      scheduleWidgetPublish()   // the next step moves on with the clock
      syncStepsBackground().catch(() => {})
      if (Date.now() - lastPlanAt < RESUME_PLAN_GAP_MS) return
      lastPlanAt = Date.now()
      planNudges().catch(() => {})
    }
    const handles = []
    if (Capacitor.isNativePlatform()) {
      handles.push(LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        followTap(notification?.extra?.key, notification?.extra?.route)
      }))
      handles.push(CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) replanOnReturn() }))
      // Back closes what is on top, then goes up one level, then to Today, then leaves.
      // Leaving minimises, like Home, so coming back is instant.
      handles.push(CapApp.addListener('backButton', () => {
        if (closeTopOverlay()) return
        const action = backAction(getTrail())
        if (action.type === 'leave') CapApp.minimizeApp().catch(() => {})
        else run(navigateRef.current, action)
      }))
      consumeNativeTap().then(tap => { if (tap?.route) followTap(tap.key, tap.route) }).catch(() => {})
    }

    // Run badge engine — queue any newly unlocked badges for the overlay
    runBadgeEngine().then(newBadges => {
      if (newBadges.length > 0) setUnlockQueue(newBadges)
    }).catch(() => {})

    return () => {
      clearInterval(stepSyncTimer)
      handles.forEach(h => Promise.resolve(h).then(x => x?.remove?.()).catch(() => {}))
    }
  }, [])

  if (onboardingDone === null) return null

  if (!onboardingDone) return (
    <Onboarding onComplete={() => setOnboardingDone(true)} />
  )

  return (
    <div className="min-h-screen bg-surface-base">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/log" element={<Log />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/weight" element={<Weight />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/badges" element={<Badges />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/activity" element={<Redirect to="/log" />} />
        <Route path="/history" element={<Redirect to="/progress" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navbar />
      {unlockQueue.length > 0 && (
        <BadgeUnlockOverlay
          badge={unlockQueue[0]}
          remaining={unlockQueue.length}
          onDismiss={() => setUnlockQueue(q => q.slice(1))}
        />
      )}
    </div>
  )
}
