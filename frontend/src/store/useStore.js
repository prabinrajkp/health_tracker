import { create } from 'zustand'
import { format } from 'date-fns'
import { getTodayScore, getStreak, getConfig } from '../api/client'
import { scheduleWidgetPublish } from '../services/widgetData'
import { getThemePreference, applyTheme, saveThemePreference, watchSystemTheme } from '../services/theme'

const today = () => format(new Date(), 'yyyy-MM-dd')

// 'system' follows the phone's light/dark setting until the user picks one
const savedTheme = getThemePreference()
applyTheme(savedTheme)

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
    scheduleWidgetPublish(0)   // widgets follow the app's theme, not only the phone's
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
  },
}))

watchSystemTheme(() => { if (useStore.getState().theme === 'system') applyTheme('system') })

export default useStore
