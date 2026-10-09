import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import BadgeUnlockOverlay from './components/BadgeUnlockOverlay'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Activity from './pages/Activity'
import WorkoutLog from './pages/WorkoutLog'
import SleepLog from './pages/SleepLog'
import History from './pages/History'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Weight from './pages/Weight'
import Onboarding from './pages/Onboarding'
import { migrateHistoricalScores, migrateSleepDates, migrateSleepDatesV8 } from './services/localStore'
import db from './services/db'
import { scheduleSmartNotifications } from './services/notificationEngine'
import { scheduleTrendNotifications } from './services/trendNotificationEngine'
import { seedFoodDefaults } from './services/foodDefaults'
import { syncStepsBackground } from './services/stepSync'
import { runBadgeEngine } from './services/badgeEngine'

const STEP_SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(null)
  const [unlockQueue, setUnlockQueue] = useState([])

  useEffect(() => {
    migrateSleepDatesV8().catch(console.error)   // undo v7 mis-convention; runs first
    migrateSleepDates().catch(console.error)
    migrateHistoricalScores().catch(console.error)
    seedFoodDefaults(db).catch(console.error)

    // Sync steps on open, then every 30 minutes
    syncStepsBackground().catch(() => {})
    const stepSyncTimer = setInterval(() => syncStepsBackground().catch(() => {}), STEP_SYNC_INTERVAL_MS)

    db.tracker_config.get('onboarding_complete')
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

    // Schedule smart notifications for today based on current data
    scheduleSmartNotifications().catch(() => {})
    scheduleTrendNotifications().catch(() => {})

    // Run badge engine — queue any newly unlocked badges for the overlay
    runBadgeEngine().then(newBadges => {
      if (newBadges.length > 0) setUnlockQueue(newBadges)
    }).catch(() => {})

    return () => clearInterval(stepSyncTimer)
  }, [])

  if (onboardingDone === null) return null

  if (!onboardingDone) return (
    <Onboarding onComplete={() => setOnboardingDone(true)} />
  )

  return (
    <div className="min-h-screen bg-surface-base">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/workout" element={<WorkoutLog />} />
        <Route path="/sleep" element={<SleepLog />} />
        <Route path="/history" element={<History />} />
        <Route path="/weight" element={<Weight />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
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
