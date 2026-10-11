import { create } from 'zustand'
import { format } from 'date-fns'
import { getTodayScore, getStreak, getConfig } from '../api/client'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { weightsFromConfig, categoryMaxes } from '../services/scoreMeta'
import { getThemePreference, applyTheme, saveThemePreference, watchSystemTheme } from '../services/theme'

const today = () => format(new Date(), 'yyyy-MM-dd')

// 'system' follows the phone's light/dark setting until the user picks one
const savedTheme = getThemePreference()
applyTheme(savedTheme)

async function writeWidgetData(score, streak, config) {
  if (!Capacitor.isNativePlatform() || !score) return
  const max = categoryMaxes(weightsFromConfig(config))
  try {
    await Filesystem.writeFile({
      path: 'widget_data.json',
      data: JSON.stringify({
        total:       Math.round(score.total_score   || 0),
        diet:        Math.round(score.diet_score    || 0),
        diet_max:    max.diet,
        workout:     Math.round(score.workout_score || 0),
        workout_max: max.workout,
        sleep:       Math.round(score.sleep_score   || 0),
        sleep_max:   max.sleep,
        streak,
        date: today(),
      }),
      directory: Directory.Data,
      encoding:  'utf8',
    })
  } catch (_) { /* non-critical */ }
}

const useStore = create((set, get) => ({
  selectedDate: today(),
  todayScore: null,
  streak: 0,
  config: {},
  loading: false,
  theme: savedTheme,

  setSelectedDate: (date) => set({ selectedDate: date }),

  setTheme: (t) => {
    saveThemePreference(t)
    applyTheme(t)
    set({ theme: t })
  },

  fetchTodayScore: async () => {
    try {
      const score = await getTodayScore()
      set({ todayScore: score })
    } catch (e) {
      console.error('score fetch failed', e)
    }
  },

  fetchStreak: async () => {
    try {
      const data = await getStreak()
      set({ streak: data.streak })
    } catch (e) {
      console.error('streak fetch failed', e)
    }
  },

  fetchConfig: async () => {
    try {
      const items = await getConfig()
      const config = {}
      items.forEach(item => { config[item.key] = item.value })
      set({ config })
    } catch (e) {
      console.error('config fetch failed', e)
    }
  },

  refreshAll: async () => {
    const { fetchTodayScore, fetchStreak, fetchConfig } = get()
    set({ loading: true })
    await Promise.all([fetchTodayScore(), fetchStreak(), fetchConfig()])
    set({ loading: false })
    // Write widget data after all values are settled
    const { todayScore, streak, config } = get()
    writeWidgetData(todayScore, streak, config)
  },
}))

watchSystemTheme(() => { if (useStore.getState().theme === 'system') applyTheme('system') })

export default useStore
