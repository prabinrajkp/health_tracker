import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Save, RotateCcw, Minus, Plus, Trash2, Sparkles, Sun, Moon, Download, Upload, Bell,
  ChevronRight, User, Scale, Sliders, Utensils, Dumbbell, Clock, Timer,
  AlertTriangle, ArrowLeft, BarChart2, Footprints, BookOpen, RefreshCw, Pencil, Check, X,
  Copy, ChevronDown, Lock, HeartPulse, Flame, KeyRound, Eye, EyeOff,
} from 'lucide-react'
import { TutorialSlides } from './Onboarding'
import * as XLSX from 'xlsx'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { getConfig, saveConfig, getScoreForDate } from '../api/client'
import { version as APP_VERSION } from '../../package.json'
import useStore from '../store/useStore'
import db from '../services/db'
import { ACTIVITY_PAC, LOSS_RATES, computeDietetics, ageFromBirthYear } from '../services/dietetics'
import { hasLlmKey, analyzeFoodWithAI, bulkAnalyzeFoodsWithAI } from '../services/llmApi'

// ids match Onboarding's ACTIVITY_LEVELS so onboarding_activity can prefill this
const ACTIVITY_OPTIONS = [
  { id: 'sedentary',         label: 'Sedentary',         desc: 'Mostly sitting / desk job' },
  { id: 'lightly_active',    label: 'Lightly active',    desc: 'Light walks, not structured' },
  { id: 'moderately_active', label: 'Moderately active', desc: 'Exercise 3–4× per week' },
  { id: 'very_active',       label: 'Very active',       desc: 'Daily training or physical work' },
  { id: 'athlete',           label: 'Athlete',           desc: 'Twice-daily training or physical job' },
]

const DEFAULT_WEIGHTS = {
  diet_max: 35, workout_max: 35, sleep_max: 30,
  diet: { breakfast: 5, lunch: 5, dinner_on_time: 8, no_post_dinner_snack: 7 },
  workout: {
    steps_8000: 15, steps_10000_bonus: 3, post_dinner_walk: 10, exercise_session: 10,
    steps_half_threshold: 5000, steps_full_threshold: 8000,
    steps_bonus_start: 10000, steps_bonus_end: 18000,
  },
  sleep: { sleep_before_1130: 10, seven_plus_hours: 12, wake_by_7: 8 },
  bonus: { all_rules_followed: 5, perfect_score: 10 },
  penalties: { dinner_after_9pm: -5, sleep_after_midnight: -8 },
  fasting: { target_hours: 16, min_hours: 12, max_points: 10 },
  calories: { max_points: 10, tolerance: 0.10, zero_at: 0.35, min_coverage: 0.7 },
}

// ── Small reusable pieces ─────────────────────────────────────────────────────
function Stepper({ label, sublabel, value, onChange, min = 0, max = 20 }) {
  return (
    <div className="list-row">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {sublabel && <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center text-text-secondary">
          <Minus size={12} />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-text-primary tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center text-text-secondary">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

function DetailHeader({ title, onBack, accent }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-border shrink-0 bg-surface-card">
      <button onClick={onBack}
        className="w-9 h-9 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-center shrink-0">
        <ArrowLeft size={16} className="text-text-secondary" />
      </button>
      <h2 className="text-base font-semibold text-text-primary flex-1">{title}</h2>
    </div>
  )
}

const EMPTY_OPTION = {
  label: '', category: 'good', points: 3, idealPortions: 1,
  kcal: null, protein: null, carbs: null, fat: null,   // per portion; null = unknown
}

const hasNutrition = (o) => o?.kcal != null

const NUTRITION_FIELDS = [
  { key: 'kcal',    label: 'kcal' },
  { key: 'protein', label: 'P (g)' },
  { key: 'carbs',   label: 'C (g)' },
  { key: 'fat',     label: 'F (g)' },
]

export default function Settings() {
  const { fetchConfig, theme, setTheme } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sectionFromUrl = searchParams.get('section')
  const [weights, setWeights]         = useState(DEFAULT_WEIGHTS)
  const [playerName, setPlayerName]   = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [heightCm, setHeightCm]       = useState('')
  const [birthYear, setBirthYear]     = useState('')
  const [gender, setGender]           = useState('')
  const [activityLevel, setActivityLevel] = useState('lightly_active')
  const [lossRate, setLossRate]       = useState('standard')
  const [bulkMode, setBulkMode]       = useState(null)   // null | 'prompt' | 'paste'
  const [bulkText, setBulkText]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [importing, setImporting]     = useState(false)
  const importFileRef                 = useRef(null)
  const [editingId, setEditingId]     = useState(null)
  const [editDraft, setEditDraft]     = useState(null)
  const [aiMode, setAiMode]           = useState(null)   // null | 'prompt' | 'paste' | 'loading' | 'result'
  const [aiResult, setAiResult]       = useState(null)
  const [aiPasteText, setAiPasteText] = useState('')
  const [aiShowHowTo, setAiShowHowTo] = useState(false)
  const [aiCopied, setAiCopied]       = useState(false)
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [groqKey, setGroqKey]             = useState('')
  const [showKeys, setShowKeys]           = useState(false)
  const [savingKeys, setSavingKeys]       = useState(false)
  const [bulkAiLoading, setBulkAiLoading] = useState(false)
  const [bulkAiProgress, setBulkAiProgress] = useState(null)
  const [customOptions, setCustomOptions] = useState([])
  const [newOption, setNewOption]     = useState({ ...EMPTY_OPTION })
  const [bedTime, setBedTime]         = useState('23:00')
  const [wakeTime, setWakeTime]       = useState('06:30')
  const [stepTimes, setStepTimes]     = useState(['10:00', '14:00', '18:00'])
  const [lunchReminderTime, setLunchReminderTime] = useState('12:30')
  const [dinnerReminderTime, setDinnerReminderTime] = useState('20:00')
  const [eveningLogTime, setEveningLogTime] = useState('22:00')
  const [activeSection, setActiveSection] = useState(() => searchParams.get('section') || null)

  // Developer tools
  const [devUnlocked, setDevUnlocked] = useState(false)
  const [devPin, setDevPin]           = useState('')
  const [devPinErr, setDevPinErr]     = useState(false)
  const [devDate, setDevDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [devLoaded, setDevLoaded]     = useState(false)
  const [devSleep, setDevSleep]       = useState(null)
  const [devWorkout, setDevWorkout]   = useState(null)
  const [devScore, setDevScore]       = useState(null)
  const [devSaving, setDevSaving]     = useState(false)

  useEffect(() => {
    getConfig().then(items => {
      const map = {}
      items.forEach(i => { map[i.key] = i.value })
      if (map.score_weights)       { try { setWeights(JSON.parse(map.score_weights)) } catch {} }
      if (map.player_name)         setPlayerName(map.player_name)
      if (map.target_weight)       setTargetWeight(map.target_weight)
      if (map.current_weight)      setCurrentWeight(map.current_weight)
      if (map.height_cm)           setHeightCm(map.height_cm)
      if (map.birth_year)          setBirthYear(map.birth_year)
      if (map.gender)              setGender(map.gender)
      // Fall back to the activity level onboarding already captured
      if (map.activity_level)      setActivityLevel(map.activity_level)
      else if (map.onboarding_activity) setActivityLevel(map.onboarding_activity)
      if (map.loss_rate)           setLossRate(map.loss_rate)
      if (map.custom_meal_options) { try { setCustomOptions(JSON.parse(map.custom_meal_options)) } catch {} }
      if (map.openrouter_api_key)  setOpenrouterKey(map.openrouter_api_key)
      if (map.groq_api_key)        setGroqKey(map.groq_api_key)
      if (map.bed_time)              setBedTime(map.bed_time)
      if (map.wake_time)             setWakeTime(map.wake_time)
      if (map.step_reminder_times)   { try { setStepTimes(JSON.parse(map.step_reminder_times)) } catch {} }
      if (map.lunch_reminder_time)   setLunchReminderTime(map.lunch_reminder_time)
      if (map.dinner_reminder_time)  setDinnerReminderTime(map.dinner_reminder_time)
      if (map.evening_log_time)      setEveningLogTime(map.evening_log_time)
    })
  }, [])

  const setW = (cat, key, val) => setWeights(w => ({ ...w, [cat]: { ...w[cat], [key]: Number(val) } }))
  const addCustomOption = () => {
    if (!newOption.label.trim()) return toast.error('Enter a meal name')
    setCustomOptions(prev => [...prev, { ...newOption, label: newOption.label.trim(), id: Math.random().toString(36).slice(2, 10) }])
    setNewOption({ ...EMPTY_OPTION })
  }
  const removeCustomOption = (id) => setCustomOptions(prev => prev.filter(o => o.id !== id))

  // ── AI provider keys ──────────────────────────────────────────────────────
  const aiConfig = { openrouter_api_key: openrouterKey.trim(), groq_api_key: groqKey.trim() }

  const saveApiKeys = async () => {
    setSavingKeys(true)
    try {
      await Promise.all([
        saveConfig({ key: 'openrouter_api_key', value: openrouterKey.trim() }),
        saveConfig({ key: 'groq_api_key',       value: groqKey.trim() }),
      ])
      toast.success('AI keys saved')
    } catch {
      toast.error('Failed to save keys')
    } finally {
      setSavingKeys(false)
    }
  }

  // Auto-analyzes with the saved API key; falls back to the manual copy/paste
  // flow when no key is configured yet or the call fails.
  const startAskAI = async () => {
    if (!hasLlmKey(aiConfig)) { setAiMode('prompt'); return }
    setAiMode('loading')
    try {
      const result = await analyzeFoodWithAI(newOption.label, aiConfig)
      setAiResult(result)
      setAiMode('result')
    } catch (e) {
      toast.error(e.message || 'AI analysis failed')
      setAiMode('prompt')
    }
  }

  const startBulkAI = async () => {
    if (!hasLlmKey(aiConfig)) { setBulkMode('prompt'); return }
    setBulkAiLoading(true)
    setBulkAiProgress({ done: 0, total: missingNutrition.length })
    try {
      const results = await bulkAnalyzeFoodsWithAI(
        missingNutrition.map(o => o.label),
        aiConfig,
        (done, total) => setBulkAiProgress({ done, total }),
      )
      let count = 0
      const updated = customOptions.map(o => {
        const hit = results.get(o.label.toLowerCase().trim())
        if (!hit) return o
        count++
        return { ...o, ...hit }
      })
      setCustomOptions(updated)
      toast.success(`Nutrition added to ${count} food${count !== 1 ? 's' : ''} — remember to save`)
    } catch (e) {
      toast.error(e.message || 'AI bulk fill failed')
    } finally {
      setBulkAiLoading(false)
      setBulkAiProgress(null)
    }
  }

  // ── Ask AI helpers ────────────────────────────────────────────────────────
  const generatePrompt = (foodName) =>
    `You are helping a health tracking app analyse food for scoring.\n\nReply ONLY in this exact format, no other text:\n\nFood: ${foodName}\nPoints: [1, 2, or 3]\nIdeal: [number]\nCategory: [good or bad]\nCalories: [kcal in ONE typical Indian household portion]\nProtein: [grams]\nCarbs: [grams]\nFat: [grams]\nReason: [10 words max]\n\nScoring guide:\nPoints 3 = Protein-rich, very healthy (chicken, fish, eggs, dal, lentils, salad)\nPoints 2 = Moderately healthy (rice, chapati, milk, yogurt, fruits, paneer)\nPoints 1 = Low-nutrition (light fried items, white bread, packaged snacks)\nCategory bad = Junk food (deep fried, fast food, sugary drinks, sweets, chips)\nCategory good = Everything else\n\nNutrition must be for ONE portion as normally served in an Indian home\n(1 chapati, 1 katori dal, 1 cup rice, 1 egg). Numbers only, no units.\n\nAnalyze: ${foodName}`

  const num = (raw) => {
    if (raw == null) return null
    const v = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''))
    return isNaN(v) || v < 0 ? null : v
  }

  const parseAIResponse = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const get = (prefix) => {
      const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()))
      return line ? line.slice(prefix.length).trim() : null
    }
    const name = get('Food:')
    const points = parseFloat(get('Points:') || '')
    const idealPortions = parseFloat(get('Ideal:') || '') || 1
    const categoryRaw = (get('Category:') || '').toLowerCase()
    const reason = get('Reason:') || ''
    const category = categoryRaw === 'bad' ? 'bad' : 'good'
    if (isNaN(points) || points < 0.5 || points > 10) return null
    return {
      name: name || null, points, idealPortions, category, reason,
      kcal:    num(get('Calories:')),
      protein: num(get('Protein:')),
      carbs:   num(get('Carbs:')),
      fat:     num(get('Fat:')),
    }
  }

  // ── Bulk nutrition fill ───────────────────────────────────────────────────
  // Nothing ships with nutrition data, so filling ~50 foods one at a time is
  // unworkable — this does the whole backlog in a single prompt/paste round trip.
  const missingNutrition = customOptions.filter(o => !hasNutrition(o))

  const generateBulkPrompt = () => {
    const list = missingNutrition.map(o => `- ${o.label}`).join('\n')
    return `You are helping a health tracking app add nutrition data to its food list.\n\nFor EACH food below, give the nutrition of ONE typical Indian household portion\n(1 chapati, 1 katori dal, 1 cup rice, 1 egg, 1 glass, 1 piece).\n\nReply ONLY with one line per food, in this exact format, no other text:\n\nFoodName | calories | protein_g | carbs_g | fat_g\n\nExample:\nChapati | 120 | 3 | 18 | 3.7\nDal | 180 | 9 | 27 | 3\n\nKeep the food names EXACTLY as written below.\n\nFoods:\n${list}`
  }

  const applyBulkNutrition = () => {
    const byLabel = new Map(customOptions.map(o => [o.label.toLowerCase(), o]))
    const updates = new Map()

    for (const line of bulkText.split('\n')) {
      const parts = line.split('|').map(p => p.trim())
      if (parts.length < 5) continue
      const [label, kcal, protein, carbs, fat] = parts
      const target = byLabel.get(label.toLowerCase().replace(/^[-*\d.\s]+/, ''))
      if (!target) continue
      const kcalVal = num(kcal)
      if (kcalVal == null) continue
      updates.set(target.id, { kcal: kcalVal, protein: num(protein), carbs: num(carbs), fat: num(fat) })
    }

    if (updates.size === 0) {
      return toast.error("Couldn't match any foods — check the response format")
    }
    setCustomOptions(prev => prev.map(o => (updates.has(o.id) ? { ...o, ...updates.get(o.id) } : o)))
    setBulkMode(null)
    setBulkText('')
    toast.success(`Nutrition added to ${updates.size} food${updates.size !== 1 ? 's' : ''} — remember to save`)
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatePrompt(newOption.label || 'this food'))
      setAiCopied(true)
      setTimeout(() => setAiCopied(false), 2500)
    } catch { toast.error('Could not copy automatically — select and copy the text above') }
  }

  const handleAnalyse = async () => {
    if (!aiPasteText.trim()) return toast.error('Paste the AI response first')
    setAiMode('loading')
    await new Promise(r => setTimeout(r, 950))
    const result = parseAIResponse(aiPasteText)
    if (!result) { setAiMode('paste'); return toast.error("That didn't look right. Try copying the full response again.") }
    setAiResult(result)
    setAiMode('result')
  }

  const handleUseResult = () => {
    setNewOption(o => ({
      ...o,
      label: aiResult.name || o.label,
      points: aiResult.points,
      idealPortions: aiResult.idealPortions,
      category: aiResult.category,
      kcal:    aiResult.kcal,
      protein: aiResult.protein,
      carbs:   aiResult.carbs,
      fat:     aiResult.fat,
    }))
    setAiMode(null); setAiResult(null); setAiPasteText(''); setAiShowHowTo(false); setAiCopied(false)
  }

  const resetAI = () => {
    setAiMode(null); setAiResult(null); setAiPasteText(''); setAiShowHowTo(false); setAiCopied(false)
  }

  const scheduleNotifications = async () => {
    if (!Capacitor.isNativePlatform()) return
    try {
      const perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return

      const cancelIds = [1, 2, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26]
      await LocalNotifications.cancel({ notifications: cancelIds.map(id => ({ id })) })

      const stepTarget  = weights.workout?.steps_full_threshold ?? 8000
      const bonusStart  = weights.workout?.steps_bonus_start    ?? 10000
      const stepTargetK = stepTarget >= 1000 ? `${(stepTarget / 1000).toFixed(0)}k` : String(stepTarget)
      const bonusK      = bonusStart  >= 1000 ? `${(bonusStart  / 1000).toFixed(0)}k` : String(bonusStart)

      const STEP_MESSAGES = [
        { title: '🌅 Step check-in (1/3)', body: `Morning push — get moving! Target: ${stepTargetK} steps today · bonus from ${bonusK}` },
        { title: '🌞 Step check-in (2/3)', body: `Midday check — stay on track for ${stepTargetK} steps. You can do it!` },
        { title: '🌆 Step check-in (3/3)', body: `Evening sprint — push for ${stepTargetK} steps! Extra pts from ${bonusK} 🏃` },
      ]

      const [bh, bm]  = bedTime.split(':').map(Number)
      const [wh, wm]  = wakeTime.split(':').map(Number)
      const [lh, lm]  = lunchReminderTime.split(':').map(Number)
      const [drh, drm] = dinnerReminderTime.split(':').map(Number)
      const [elh, elm] = eveningLogTime.split(':').map(Number)

      await LocalNotifications.schedule({ notifications: [
        { id: 1,  title: '🌙 Bedtime reminder',   body: 'Start your sleep timer in Health Quest — good sleep = good score!', schedule: { on: { hour: bh, minute: bm }, repeats: true } },
        { id: 2,  title: '☀️ Good morning!',       body: 'Stop your sleep timer and start the day strong!',                   schedule: { on: { hour: wh, minute: wm }, repeats: true } },
        ...stepTimes.map((t, i) => {
          const [h, m] = t.split(':').map(Number)
          const msg = STEP_MESSAGES[i] || STEP_MESSAGES[2]
          return { id: 10 + i, title: msg.title, body: msg.body, schedule: { on: { hour: h, minute: m }, repeats: true } }
        }),
        { id: 20, title: '🥗 Lunch time!',         body: `Log your lunch in Health Quest — protein first for max points!`,   schedule: { on: { hour: lh, minute: lm }, repeats: true } },
        { id: 21, title: '💧 Stay hydrated!',       body: 'Drink a glass of water — hydration keeps energy sharp.',           schedule: { on: { hour: 11, minute: 0  }, repeats: true } },
        { id: 22, title: '💧 Afternoon hydration',  body: 'Another glass of water! Stay fuelled for the rest of the day.',    schedule: { on: { hour: 15, minute: 30 }, repeats: true } },
        { id: 23, title: '🍽️ Dinner reminder',      body: `Aim to eat dinner now — after 9 PM triggers a score penalty!`,    schedule: { on: { hour: drh, minute: drm }, repeats: true } },
        { id: 24, title: '🚫 No late snacks!',       body: 'Avoid post-dinner snacking to protect your diet score.',           schedule: { on: { hour: 21, minute: 30  }, repeats: true } },
        { id: 25, title: '🚶 Post-dinner walk?',     body: 'A short walk after dinner earns bonus workout points!',            schedule: { on: { hour: drh, minute: Math.min(59, drm + 40) }, repeats: true } },
        { id: 26, title: '📋 Log your day!',         body: `Don't forget to record Sleep & Workout before midnight.`,          schedule: { on: { hour: elh, minute: elm }, repeats: true } },
      ] })
    } catch {}
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveConfig({ key: 'score_weights',       value: JSON.stringify(weights) }),
        saveConfig({ key: 'player_name',          value: playerName }),
        saveConfig({ key: 'target_weight',        value: targetWeight }),
        saveConfig({ key: 'current_weight',       value: currentWeight }),
        saveConfig({ key: 'height_cm',            value: heightCm }),
        saveConfig({ key: 'birth_year',           value: birthYear }),
        saveConfig({ key: 'gender',               value: gender }),
        saveConfig({ key: 'activity_level',       value: activityLevel }),
        saveConfig({ key: 'loss_rate',            value: lossRate }),
        saveConfig({ key: 'custom_meal_options',  value: JSON.stringify(customOptions) }),
        saveConfig({ key: 'openrouter_api_key',   value: openrouterKey.trim() }),
        saveConfig({ key: 'groq_api_key',         value: groqKey.trim() }),
        saveConfig({ key: 'bed_time',              value: bedTime }),
        saveConfig({ key: 'wake_time',             value: wakeTime }),
        saveConfig({ key: 'step_reminder_times',   value: JSON.stringify(stepTimes) }),
        saveConfig({ key: 'lunch_reminder_time',   value: lunchReminderTime }),
        saveConfig({ key: 'dinner_reminder_time',  value: dinnerReminderTime }),
        saveConfig({ key: 'evening_log_time',      value: eveningLogTime }),
      ])
      await fetchConfig()
      await scheduleNotifications()
      toast.success('Settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const [scores, dietLogs, workoutLogs, sleepLogs, weightLogs] = await Promise.all([
        db.daily_scores.orderBy('date').toArray(),
        db.diet_logs.orderBy('date').toArray(),
        db.workout_logs.orderBy('date').toArray(),
        db.sleep_logs.orderBy('date').toArray(),
        db.weight_logs.orderBy('date').toArray(),
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scores.map(r => ({
        Date: r.date, 'Total Score': Math.round(r.total_score), 'Diet Score': Math.round(r.diet_score),
        'Workout Score': Math.round(r.workout_score), 'Sleep Score': Math.round(r.sleep_score),
        'Calorie Score': r.calorie_score == null ? '' : r.calorie_score,
        'Bonus Points': Math.round(r.bonus_points || 0), 'Streak Days': r.streak_days || 0,
      }))), 'Scores')
      if (weightLogs.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weightLogs.map(r => ({
          Date: r.date, 'Weight (kg)': r.weight_kg, Notes: r.notes || '',
        }))), 'Weight')
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dietLogs.map(r => ({
        Date: r.date, Notes: r.notes || '',
        'Meal Items': (r.meal_items || []).map(i => `${i.label}×${i.portions}`).join(', '),
      }))), 'Diet')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workoutLogs.map(r => ({
        Date: r.date, Steps: r.steps || 0, 'Post-Dinner Walk': r.post_dinner_walk ? 'Yes' : 'No',
        'Walk Minutes': r.post_dinner_walk_minutes || 0, 'Exercise Done': r.exercise_done ? 'Yes' : 'No',
        'Exercise Type': r.exercise_type || '', 'Exercise Duration (min)': r.exercise_duration_minutes || 0,
      }))), 'Workout')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sleepLogs.map(r => ({
        Date: r.date, 'Sleep Time': r.sleep_time || '', 'Wake Time': r.wake_time || '',
        'Sleep Hours': r.sleep_hours || 0, 'Screen Time (hrs)': r.screen_time_hours || 0,
        'Effective Sleep (hrs)': Math.max(0, (r.sleep_hours || 0) - (r.screen_time_hours || 0)),
        Quality: r.quality || '',
      }))), 'Sleep')
      const foodRows = []
      for (const d of dietLogs) {
        for (const item of (d.meal_items || [])) {
          foodRows.push({ Date: d.date, 'Meal Type': item.mealType || '', Food: item.label || '',
            Portions: item.portions || 1, 'Pts/Portion': item.pointsPerPortion || 0,
            'Total Pts': (item.pointsPerPortion || 0) * (item.portions || 1) })
        }
      }
      if (foodRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foodRows), 'Food Items')
      const filename = `health-data-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      if (Capacitor.isNativePlatform()) {
        const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents })
        toast.success(`Saved to Documents/${filename}`, { duration: 6000 })
      } else {
        XLSX.writeFile(wb, filename)
        toast.success('Downloaded as Excel')
      }
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const handleJsonExport = async () => {
    setExporting(true)
    try {
      const [config, dietLogs, workoutLogs, sleepLogs, scores, weightLogs] = await Promise.all([
        db.tracker_config.toArray(),
        db.diet_logs.orderBy('date').toArray(),
        db.workout_logs.orderBy('date').toArray(),
        db.sleep_logs.orderBy('date').toArray(),
        db.daily_scores.orderBy('date').toArray(),
        db.weight_logs.orderBy('date').toArray(),
      ])
      const backup = {
        // Stays at 1 — the import check is `!== 1`, so bumping would reject old backups.
        version: 1,
        exportedAt: format(new Date(), 'yyyy-MM-dd'),
        data: { config, diet_logs: dietLogs, workout_logs: workoutLogs, sleep_logs: sleepLogs, daily_scores: scores, weight_logs: weightLogs },
      }
      const json = JSON.stringify(backup, null, 2)
      const filename = `health-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      if (Capacitor.isNativePlatform()) {
        const data = btoa(unescape(encodeURIComponent(json)))
        await Filesystem.writeFile({ path: filename, data, directory: Directory.Documents })
        toast.success(`Saved to Documents/${filename}`, { duration: 6000 })
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        toast.success('Downloaded JSON backup')
      }
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const handleJsonImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      if (!backup?.data || backup?.version !== 1) return toast.error('Invalid backup file')
      const { config, diet_logs, workout_logs, sleep_logs, daily_scores, weight_logs } = backup.data
      await Promise.all([
        config?.length       && db.tracker_config.bulkPut(config),
        diet_logs?.length    && db.diet_logs.bulkPut(diet_logs),
        workout_logs?.length && db.workout_logs.bulkPut(workout_logs),
        sleep_logs?.length   && db.sleep_logs.bulkPut(sleep_logs),
        daily_scores?.length && db.daily_scores.bulkPut(daily_scores),
        weight_logs?.length  && db.weight_logs.bulkPut(weight_logs),   // absent in pre-v4.20 backups
      ].filter(Boolean))
      await fetchConfig()
      toast.success(`Imported — ${diet_logs?.length ?? 0} diet · ${workout_logs?.length ?? 0} workout · ${sleep_logs?.length ?? 0} sleep logs`)
    } catch { toast.error('Import failed — check the file format') }
    finally { setImporting(false) }
  }

  // ── Menu item definition ──────────────────────────────────────────────────
  const totalMax = (weights.diet_max || 35) + (weights.workout_max || 35) + (weights.sleep_max || 30)
  const bodyComplete = !!(heightCm && birthYear && gender)
  // Live preview of what the entered metrics produce
  const previewTargets = bodyComplete && currentWeight
    ? computeDietetics({
        age: ageFromBirthYear(birthYear),
        gender,
        heightCm: Number(heightCm),
        weightKg: Number(currentWeight),
        pac: ACTIVITY_PAC[activityLevel] ?? ACTIVITY_PAC.lightly_active,
        deficitKcal: LOSS_RATES.find(r => r.id === lossRate)?.deficit,
      })
    : null
  const MENU = [
    { key: 'profile',    Icon: User,          color: '#a78bfa', label: 'Player Profile',      desc: `${playerName || 'Not set'} · ${currentWeight || '—'} kg` },
    { key: 'body',       Icon: HeartPulse,    color: '#ec4899', label: 'Body & Goal',          desc: bodyComplete ? `${heightCm} cm · ${targetWeight || '—'} kg goal · ${LOSS_RATES.find(r => r.id === lossRate)?.label ?? 'Standard'}` : 'Set up calorie & macro targets' },
    { key: 'appearance', Icon: Sun,           color: '#f59e0b', label: 'Appearance',           desc: `${theme === 'dark' ? 'Dark' : 'Light'} theme` },
    { key: 'weights',    Icon: Scale,         color: '#FBBC04', label: 'Category Weights',     desc: `Diet ${weights.diet_max} · Workout ${weights.workout_max} · Sleep ${weights.sleep_max} · Total ${totalMax}` },
    { key: 'diet',       Icon: Utensils,      color: '#34A853', label: 'Diet Scoring',         desc: 'Meal points and dinner timing' },
    { key: 'workout',    Icon: Dumbbell,      color: '#1A73E8', label: 'Workout Scoring',      desc: 'Steps, walk, exercise thresholds' },
    { key: 'sleep',      Icon: Moon,          color: '#a78bfa', label: 'Sleep Scoring',        desc: 'Bedtime, duration, wake-up' },
    { key: 'fasting',    Icon: Timer,         color: '#38bdf8', label: 'Intermittent Fasting', desc: `${weights.fasting?.min_hours ?? 12}h min · ${weights.fasting?.target_hours ?? 16}h target` },
    { key: 'penalties',  Icon: AlertTriangle, color: '#EA4335', label: 'Penalties',            desc: 'Dinner late & sleep after midnight' },
    { key: 'foods',      Icon: Sparkles,      color: '#f97316', label: 'Custom Meal Options',  desc: `${customOptions.length} food${customOptions.length !== 1 ? 's' : ''} configured` },
    { key: 'ai_provider', Icon: KeyRound,     color: '#7c3aed', label: 'AI Assistant',         desc: hasLlmKey(aiConfig) ? 'Connected' : 'Not configured' },
    { key: 'reminders',  Icon: Bell,          color: '#a78bfa', label: 'Reminders',            desc: `Bed ${bedTime} · Wake ${wakeTime} · Dinner ${dinnerReminderTime}` },
    { key: 'export',     Icon: Download,      color: '#34A853', label: 'Data Export & Import',  desc: 'Excel · JSON backup · restore on new device' },
    { key: 'tutorial',   Icon: BookOpen,      color: '#38bdf8', label: 'View Tutorial',        desc: 'How to win — scoring explained' },
    { key: 'reset_onboarding', Icon: RefreshCw, color: '#f97316', label: 'Reset Onboarding', desc: 'Replay goals & personalisation setup' },
    { key: 'dev_tools',        Icon: Lock,      color: '#64748b', label: 'Developer Tools',  desc: 'Restricted — advanced data override' },
  ]

  // ── Detail screens ────────────────────────────────────────────────────────
  const renderDetail = () => {
    const back = () => {
      setEditingId(null)
      setEditDraft(null)
      if (sectionFromUrl) {
        navigate(-1)
      } else {
        setActiveSection(null)
      }
    }
    const SaveBtn = () => (
      <div className="px-4 pt-4 pb-8 border-t border-surface-border bg-surface-card shrink-0">
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-4 rounded-2xl text-sm font-semibold">
          <Save size={14} />{saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    )

    if (activeSection === 'profile') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Player Profile" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <div>
            <label className="section-label block mb-1.5">Display name</label>
            <input className="input" placeholder="Your name" value={playerName} onChange={e => setPlayerName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1.5">Current weight (kg)</label>
              <input type="number" className="input" placeholder="e.g. 80" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)} />
            </div>
            <div>
              <label className="section-label block mb-1.5">Target weight (kg)</label>
              <input type="number" className="input" placeholder="e.g. 70" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
            </div>
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'body') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Body & Goal" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <p className="text-xs text-text-muted">
            Used to work out your daily calorie and macro targets. Weight comes from your
            weight log — everything else is set here.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1.5">Height (cm)</label>
              <input type="number" className="input" placeholder="e.g. 175" value={heightCm}
                onChange={e => setHeightCm(e.target.value)} />
            </div>
            <div>
              <label className="section-label block mb-1.5">Year of birth</label>
              <input type="number" className="input" placeholder="e.g. 1991" value={birthYear}
                onChange={e => setBirthYear(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="section-label block mb-1.5">Sex (for the BMR formula)</label>
            <div className="flex gap-2">
              {[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }].map(g => (
                <button key={g.id} onClick={() => setGender(g.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    gender === g.id
                      ? 'bg-brand text-white border-transparent'
                      : 'border-surface-border text-text-muted bg-surface-elevated'
                  }`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="section-label block mb-1.5">Activity level</label>
            <div className="space-y-2">
              {ACTIVITY_OPTIONS.map(a => (
                <button key={a.id} onClick={() => setActivityLevel(a.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                    activityLevel === a.id
                      ? 'border-brand bg-brand/10'
                      : 'border-surface-border bg-surface-elevated'
                  }`}>
                  <p className="text-sm font-semibold text-text-primary">{a.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="section-label block mb-1.5">Target weight (kg)</label>
            <input type="number" className="input" placeholder="e.g. 70" value={targetWeight}
              onChange={e => setTargetWeight(e.target.value)} />
          </div>

          <div>
            <label className="section-label block mb-1.5">Rate of loss</label>
            <div className="space-y-2">
              {LOSS_RATES.map(r => (
                <button key={r.id} onClick={() => setLossRate(r.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                    lossRate === r.id
                      ? 'border-brand bg-brand/10'
                      : 'border-surface-border bg-surface-elevated'
                  }`}>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-text-primary">{r.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{r.kgPerWeek} kg per week</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-danger">−{r.deficit}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              The deficit only applies above BMI 23, and your target never drops below
              {gender === 'female' ? ' 1200' : ' 1500'} kcal.
            </p>
          </div>

          {previewTargets && (
            <div className="card space-y-2.5">
              <p className="section-label">Your targets</p>
              {[
                ['BMR', `${previewTargets.bmr} kcal/day`],
                ['Activity', previewTargets.activity_level],
                ['Maintenance', `${previewTargets.maintenance} kcal`],
                ['Daily target', `${previewTargets.energy} kcal`],
                ['BMI', `${previewTargets.bmi}`],
                ['Ideal weight', `${previewTargets.ideal_weight} kg`],
                ['Protein', `${previewTargets.proteins.min}–${previewTargets.proteins.max} g`],
                ['Carbs', `${previewTargets.carbs.min}–${previewTargets.carbs.max} g`],
                ['Fat', `${previewTargets.fat.min}–${previewTargets.fat.max} g`],
                ['Fibre', `${previewTargets.fibre.min}–${previewTargets.fibre.max} g`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{label}</span>
                  <span className="text-sm font-semibold text-text-primary tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          )}

          {bodyComplete && !currentWeight && (
            <p className="text-xs text-warning">
              Log a weight on the Weight page to see your targets.
            </p>
          )}
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'appearance') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Appearance" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-6">
          <p className="section-label mb-3">Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ key: 'dark', Icon: Moon, label: 'Dark' }, { key: 'light', Icon: Sun, label: 'Light' }].map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setTheme(key)}
                className={`flex items-center justify-center gap-2 py-5 rounded-2xl border-2 text-sm font-semibold transition-all ${theme === key ? 'border-brand bg-brand/10 text-brand-light' : 'border-surface-border bg-surface-elevated text-text-muted'}`}>
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'weights') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Category Weights" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <div className="card space-y-0">
            <Stepper label="Diet max points"    value={weights.diet_max}    onChange={v => setWeights(w => ({ ...w, diet_max: v }))}    max={50} />
            <Stepper label="Workout max points" value={weights.workout_max} onChange={v => setWeights(w => ({ ...w, workout_max: v }))} max={50} />
            <Stepper label="Sleep max points"   value={weights.sleep_max}   onChange={v => setWeights(w => ({ ...w, sleep_max: v }))}   max={50} />
          </div>
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs text-text-muted">Total possible score</span>
            <span className={`badge ${totalMax === 100 ? 'badge-success' : 'badge-warning'}`}>{totalMax} pts</span>
          </div>
          <button onClick={() => { setWeights(DEFAULT_WEIGHTS); toast('Reset to defaults — save to apply', { icon: '↩' }) }}
            className="btn-ghost w-full mt-4"><RotateCcw size={13} />Reset all to defaults</button>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'diet') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Diet Scoring" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <div className="card space-y-0">
            <Stepper label="Breakfast logged"           value={weights.diet?.breakfast         ?? 5} onChange={v => setW('diet', 'breakfast', v)} />
            <Stepper label="Lunch logged"               value={weights.diet?.lunch              ?? 5} onChange={v => setW('diet', 'lunch', v)} />
            <Stepper label="Dinner on time (≤8:30 PM)"  value={weights.diet?.dinner_on_time     ?? 8} onChange={v => setW('diet', 'dinner_on_time', v)} />
            <Stepper label="No post-dinner snacks"      value={weights.diet?.no_post_dinner_snack ?? 7} onChange={v => setW('diet', 'no_post_dinner_snack', v)} />
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'workout') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Workout Scoring" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <div className="card space-y-0">
            <Stepper label="Base pts at full-credit threshold" sublabel="Half earned at partial threshold" value={weights.workout?.steps_8000 ?? 15} onChange={v => setW('workout', 'steps_8000', v)} max={20} />
            <Stepper label="Bonus pts at bonus-start"          sublabel="Then +10 linear to max"          value={weights.workout?.steps_10000_bonus ?? 3} onChange={v => setW('workout', 'steps_10000_bonus', v)} />
            <Stepper label="Post-dinner walk"                  value={weights.workout?.post_dinner_walk   ?? 10} onChange={v => setW('workout', 'post_dinner_walk', v)} />
            <Stepper label="Exercise session"                  sublabel="Badminton, stairs, etc."         value={weights.workout?.exercise_session    ?? 10} onChange={v => setW('workout', 'exercise_session', v)} />
          </div>
          <div className="card">
            <p className="section-label mb-3">Step Thresholds</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Partial credit from', key: 'steps_half_threshold', def: 5000,  hint: '50% pts from here' },
                { label: 'Full credit from',    key: 'steps_full_threshold', def: 8000,  hint: '100% base pts' },
                { label: 'Bonus starts at',     key: 'steps_bonus_start',    def: 10000, hint: '+10 extra pts begin' },
                { label: 'Max bonus at',        key: 'steps_bonus_end',      def: 18000, hint: 'Full +10 bonus here' },
              ].map(({ label, key, def, hint }) => (
                <div key={key}>
                  <label className="section-label block mb-1">{label}</label>
                  <input type="number" step="500" min="0" max="50000" className="input text-center tabular-nums"
                    value={weights.workout?.[key] ?? def} onChange={e => setW('workout', key, Number(e.target.value))} />
                  <p className="text-xs text-text-muted mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'sleep') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Sleep Scoring" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <div className="card space-y-0">
            <Stepper label="Sleep before 11:30 PM"  sublabel="Rule #6"                                        value={weights.sleep?.sleep_before_1130 ?? 10} onChange={v => setW('sleep', 'sleep_before_1130', v)} />
            <Stepper label="7+ hours of sleep"      sublabel="Uses effective hours (minus screen time)"        value={weights.sleep?.seven_plus_hours   ?? 12} onChange={v => setW('sleep', 'seven_plus_hours', v)} />
            <Stepper label="Wake by 8 AM"            sublabel="Full ≤8 AM · half 8–9 AM · none after 9"        value={weights.sleep?.wake_by_7          ?? 8}  onChange={v => setW('sleep', 'wake_by_7', v)} />
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'fasting') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Intermittent Fasting" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <p className="text-xs text-text-muted mb-4 px-1">Score is calculated from yesterday's dinner → today's breakfast. Points scale logistically toward the target.</p>
          <div className="card space-y-0">
            <Stepper label="Target fasting hours"     sublabel="Full points at this duration" value={weights.fasting?.target_hours ?? 16} onChange={v => setWeights(w => ({ ...w, fasting: { ...(w.fasting||{}), target_hours: v } }))} min={8} max={24} />
            <Stepper label="Minimum hours for points" sublabel="No points below this"         value={weights.fasting?.min_hours    ?? 12} onChange={v => setWeights(w => ({ ...w, fasting: { ...(w.fasting||{}), min_hours: v } }))}    min={4} max={20} />
            <Stepper label="Max fasting points"                                               value={weights.fasting?.max_points   ?? 10} onChange={v => setWeights(w => ({ ...w, fasting: { ...(w.fasting||{}), max_points: v } }))}   max={20} />
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'penalties') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Penalties" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <div className="card space-y-0">
            <Stepper label="Dinner after 9 PM"   value={Math.abs(weights.penalties?.dinner_after_9pm   ?? 5)} onChange={v => setWeights(w => ({ ...w, penalties: { ...w.penalties, dinner_after_9pm: -v } }))} />
            <Stepper label="Sleep after midnight" value={Math.abs(weights.penalties?.sleep_after_midnight ?? 8)} onChange={v => setWeights(w => ({ ...w, penalties: { ...w.penalties, sleep_after_midnight: -v } }))} />
          </div>
          <p className="text-xs text-text-muted mt-3 px-1">Penalties are deducted from the respective category score (diet / sleep).</p>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'ai_provider') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="AI Assistant" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound size={14} style={{ color: '#7c3aed' }} />
              <p className="section-label flex-1">AI Provider (free tier)</p>
              {hasLlmKey(aiConfig) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#22c55e20', color: '#22c55e' }}>Connected</span>
              )}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Paste a free API key once and "Ask AI" (in Custom Meal Options) fills points +
              nutrition automatically — no more copy-pasting into ChatGPT. OpenRouter is used
              first; Groq only steps in if OpenRouter has no key or is unavailable. Get a free
              key from{' '}
              <a className="underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>
              {' '}or{' '}
              <a className="underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq</a>.
            </p>
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] text-text-muted">OpenRouter API key</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#7c3aed20', color: '#7c3aed' }}>PRIMARY</span>
                </div>
                <input type={showKeys ? 'text' : 'password'} className="input text-xs font-mono" placeholder="sk-or-v1-…"
                  value={openrouterKey} onChange={e => setOpenrouterKey(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] text-text-muted">Groq API key</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#64748b20', color: '#94a3b8' }}>BACKUP</span>
                </div>
                <input type={showKeys ? 'text' : 'password'} className="input text-xs font-mono" placeholder="gsk_…"
                  value={groqKey} onChange={e => setGroqKey(e.target.value)} autoComplete="off" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowKeys(s => !s)}
                className="btn-ghost px-3 py-2 text-xs shrink-0" type="button">
                {showKeys ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button onClick={saveApiKeys} disabled={savingKeys} className="btn-primary flex-1 py-2 text-xs">
                {savingKeys ? 'Saving…' : 'Save Keys'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )

    if (activeSection === 'foods') {
      const startEdit = (opt) => {
        setEditingId(opt.id)
        setEditDraft({
          points: opt.points, idealPortions: opt.idealPortions ?? 1,
          kcal: opt.kcal ?? null, protein: opt.protein ?? null,
          carbs: opt.carbs ?? null, fat: opt.fat ?? null,
        })
      }
      const cancelEdit = () => { setEditingId(null); setEditDraft(null) }
      const commitEdit = (id) => {
        setCustomOptions(prev => prev.map(o => o.id === id ? { ...o, ...editDraft } : o))
        setEditingId(null); setEditDraft(null)
      }

      return (
        <div className="flex flex-col h-full">
          <DetailHeader title="Meal Options" onBack={back} />
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
            {/* Add new */}
            <div className="card space-y-3">
              <p className="section-label">Add new food</p>
              <input className="input" placeholder="Food name (e.g. Boiled eggs, Fried snack…)"
                value={newOption.label} onChange={e => setNewOption(o => ({ ...o, label: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addCustomOption()} />
              {newOption.label.trim() && (
                <button onClick={startAskAI}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-brand/30 bg-brand/8 text-sm font-medium"
                  style={{ color: '#7c3aed', background: '#7c3aed10' }}>
                  <Sparkles size={14} />
                  Ask AI to fill details
                </button>
              )}
              <div className="flex gap-2">
                {[['good', 'Good', 'bg-success'], ['bad', 'Bad', 'bg-danger']].map(([cat, lbl, bg]) => (
                  <button key={cat} onClick={() => setNewOption(o => ({ ...o, category: cat }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${newOption.category === cat ? `${bg} text-white border-transparent` : 'border-surface-border text-text-muted bg-surface-elevated'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="section-label mb-1">Pts per portion</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setNewOption(o => ({ ...o, points: Math.max(1, o.points - 1) }))} className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center"><Minus size={12} /></button>
                    <span className="flex-1 text-center text-sm font-semibold tabular-nums text-text-primary">{newOption.points}</span>
                    <button onClick={() => setNewOption(o => ({ ...o, points: Math.min(20, o.points + 1) }))} className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
                {newOption.category === 'good' && (
                  <div>
                    <p className="section-label mb-1">Ideal portions</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setNewOption(o => ({ ...o, idealPortions: Math.max(0.5, Math.round((o.idealPortions - 0.5)*2)/2) }))} className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center"><Minus size={12} /></button>
                      <span className="flex-1 text-center text-sm font-semibold tabular-nums text-text-primary">{newOption.idealPortions ?? 1}</span>
                      <button onClick={() => setNewOption(o => ({ ...o, idealPortions: Math.min(10, Math.round((o.idealPortions + 0.5)*2)/2) }))} className="w-8 h-8 rounded-xl border border-surface-border bg-surface-elevated flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="section-label mb-1.5">Nutrition per portion (optional)</p>
                <div className="grid grid-cols-4 gap-2">
                  {NUTRITION_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <input type="number" min="0" className="input text-center tabular-nums px-1"
                        placeholder="—"
                        value={newOption[key] ?? ''}
                        onChange={e => setNewOption(o => ({ ...o, [key]: e.target.value === '' ? null : Number(e.target.value) }))} />
                      <p className="text-[10px] text-text-muted text-center mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={addCustomOption} className="btn-primary w-full"><Plus size={14} />Add Food</button>
            </div>

            {/* Nutrition coverage + bulk fill */}
            {customOptions.length > 0 && (
              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <Flame size={14} style={{ color: '#f97316' }} />
                  <p className="section-label flex-1">Nutrition data</p>
                  <span className="text-xs font-semibold tabular-nums text-text-primary">
                    {customOptions.length - missingNutrition.length} / {customOptions.length}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{
                    width: `${((customOptions.length - missingNutrition.length) / customOptions.length) * 100}%`,
                    background: '#f97316',
                  }} />
                </div>
                <p className="text-xs text-text-muted">
                  {missingNutrition.length === 0
                    ? 'Every food has calorie data — calorie scoring is active.'
                    : `${missingNutrition.length} food${missingNutrition.length !== 1 ? 's' : ''} still need calories. Days scored only once most of what you log has data.`}
                </p>
                {missingNutrition.length > 0 && (
                  <button onClick={startBulkAI} disabled={bulkAiLoading}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-sm font-medium disabled:opacity-60"
                    style={{ color: '#f97316', background: '#f9731610', borderColor: '#f9731640' }}>
                    {bulkAiLoading
                      ? <><RefreshCw size={14} className="animate-spin" /> Analyzing {bulkAiProgress?.done ?? 0}/{bulkAiProgress?.total ?? missingNutrition.length}…</>
                      : <><Sparkles size={14} /> Fill all {missingNutrition.length} with AI</>}
                  </button>
                )}
              </div>
            )}

            {/* Existing options */}
            {customOptions.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No foods added yet</p>
            ) : (
              <div className="card space-y-0 divide-y divide-surface-border">
                {customOptions.map(opt => {
                  const isEditing = editingId === opt.id
                  return (
                    <div key={opt.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.category === 'good' ? 'bg-success' : 'bg-danger'}`} />
                        <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{opt.label}</span>
                        <span className={`text-xs font-semibold shrink-0 ${opt.category === 'good' ? 'text-success' : 'text-danger'}`}>
                          {opt.category === 'good' ? '+' : '-'}{isEditing ? editDraft.points : opt.points} pts
                        </span>
                        {!isEditing && (
                          <button onClick={() => startEdit(opt)}
                            className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated text-text-muted flex items-center justify-center shrink-0">
                            <Pencil size={11} />
                          </button>
                        )}
                        {isEditing && (
                          <button onClick={() => commitEdit(opt.id)}
                            className="w-7 h-7 rounded-lg bg-success/20 border border-success/40 text-success flex items-center justify-center shrink-0">
                            <Check size={11} />
                          </button>
                        )}
                        <button onClick={() => isEditing ? cancelEdit() : removeCustomOption(opt.id)}
                          className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated hover:border-danger/40 hover:text-danger text-text-muted flex items-center justify-center shrink-0">
                          {isEditing ? <X size={11} /> : <Trash2 size={11} />}
                        </button>
                      </div>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-3 pl-5">
                          <div>
                            <p className="section-label mb-1">Pts per portion</p>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEditDraft(d => ({ ...d, points: Math.max(0, Math.round((d.points - 0.5)*2)/2) }))}
                                className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated flex items-center justify-center"><Minus size={11} /></button>
                              <span className="flex-1 text-center text-sm font-semibold tabular-nums text-text-primary">{editDraft.points}</span>
                              <button onClick={() => setEditDraft(d => ({ ...d, points: Math.min(20, Math.round((d.points + 0.5)*2)/2) }))}
                                className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated flex items-center justify-center"><Plus size={11} /></button>
                            </div>
                          </div>
                          <div>
                            <p className="section-label mb-1">Ideal portions</p>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEditDraft(d => ({ ...d, idealPortions: Math.max(0.5, Math.round((d.idealPortions - 0.5)*2)/2) }))}
                                className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated flex items-center justify-center"><Minus size={11} /></button>
                              <span className="flex-1 text-center text-sm font-semibold tabular-nums text-text-primary">{editDraft.idealPortions}</span>
                              <button onClick={() => setEditDraft(d => ({ ...d, idealPortions: Math.min(10, Math.round((d.idealPortions + 0.5)*2)/2) }))}
                                className="w-7 h-7 rounded-lg border border-surface-border bg-surface-elevated flex items-center justify-center"><Plus size={11} /></button>
                            </div>
                          </div>
                        </div>
                      )}
                      {isEditing && (
                        <div className="pl-5">
                          <p className="section-label mb-1">Nutrition per portion</p>
                          <div className="grid grid-cols-4 gap-2">
                            {NUTRITION_FIELDS.map(({ key, label }) => (
                              <div key={key}>
                                <input type="number" min="0" className="input text-center tabular-nums px-1 py-1.5"
                                  placeholder="—"
                                  value={editDraft[key] ?? ''}
                                  onChange={e => setEditDraft(d => ({ ...d, [key]: e.target.value === '' ? null : Number(e.target.value) }))} />
                                <p className="text-[10px] text-text-muted text-center mt-0.5">{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!isEditing && (
                        <p className="text-xs text-text-muted pl-5">
                          {opt.idealPortions ? `ideal: ${opt.idealPortions} portion${opt.idealPortions !== 1 ? 's' : ''}` : ''}
                          {opt.idealPortions && hasNutrition(opt) ? ' · ' : ''}
                          {hasNutrition(opt)
                            ? `${opt.kcal} kcal · P${opt.protein ?? 0} C${opt.carbs ?? 0} F${opt.fat ?? 0}`
                            : <span className="text-warning">no calorie data</span>}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

          </div>
          <SaveBtn />
        </div>
      )
    }

    if (activeSection === 'reminders') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Reminders" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {!Capacitor.isNativePlatform() && (
            <p className="text-xs text-warning bg-warning/10 rounded-xl px-3 py-2">Notifications only work on the Android app.</p>
          )}
          <div className="card space-y-4">
            <p className="section-label">Sleep reminders</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="section-label block mb-1.5">Bed time</label><input type="time" className="input" value={bedTime} onChange={e => setBedTime(e.target.value)} /></div>
              <div><label className="section-label block mb-1.5">Wake up</label><input type="time" className="input" value={wakeTime} onChange={e => setWakeTime(e.target.value)} /></div>
            </div>
          </div>
          <div className="card space-y-3">
            <p className="section-label">Step check-ins <span className="text-text-muted font-normal">(3 per day)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {stepTimes.map((t, i) => (
                <div key={i}>
                  <label className="section-label block mb-1">Reminder {i + 1}</label>
                  <input type="time" className="input py-1.5 text-xs" value={t}
                    onChange={e => setStepTimes(prev => prev.map((v, j) => j === i ? e.target.value : v))} />
                </div>
              ))}
            </div>
          </div>
          <div className="card space-y-3">
            <p className="section-label">Meal reminders</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="section-label block mb-1.5">Lunch reminder</label><input type="time" className="input" value={lunchReminderTime} onChange={e => setLunchReminderTime(e.target.value)} /></div>
              <div><label className="section-label block mb-1.5">Dinner reminder</label><input type="time" className="input" value={dinnerReminderTime} onChange={e => setDinnerReminderTime(e.target.value)} /></div>
            </div>
            <p className="text-xs text-text-muted">No-snacking alert sent at 9:30 PM · Post-dinner walk reminder 40 min after dinner time</p>
          </div>
          <div className="card space-y-3">
            <p className="section-label">End-of-day</p>
            <div><label className="section-label block mb-1.5">Log reminder</label><input type="time" className="input" value={eveningLogTime} onChange={e => setEveningLogTime(e.target.value)} /></div>
            <p className="text-xs text-text-muted">Prompts you to log Sleep &amp; Workout before midnight</p>
          </div>
          <div className="card">
            <p className="section-label mb-2">Always-on reminders</p>
            <p className="text-xs text-text-muted">Hydration at 11:00 &amp; 15:30 · Step notifications include your configured step target</p>
          </div>
        </div>
        <SaveBtn />
      </div>
    )

    if (activeSection === 'export') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Data Export & Import" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-6 space-y-4">
          <div className="card space-y-3">
            <p className="section-label">Export data</p>
            <p className="text-xs text-text-muted">Save all your health logs — scores, diet, workout, and sleep.</p>
            <button onClick={handleExport} disabled={exporting} className="btn-ghost w-full py-4 rounded-2xl">
              <Download size={15} />{exporting ? 'Exporting…' : 'Export as Excel (.xlsx)'}
            </button>
            <button onClick={handleJsonExport} disabled={exporting} className="btn-ghost w-full py-4 rounded-2xl">
              <Download size={15} />{exporting ? 'Exporting…' : 'Export full JSON backup'}
            </button>
          </div>
          <div className="card space-y-3">
            <p className="section-label">Import data</p>
            <p className="text-xs text-text-muted leading-relaxed">Restore a JSON backup to transfer all data to this device. Existing entries for the same date will be overwritten.</p>
            <button onClick={() => importFileRef.current?.click()} disabled={importing} className="btn-ghost w-full py-4 rounded-2xl">
              <Upload size={15} />{importing ? 'Importing…' : 'Import JSON backup'}
            </button>
            <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />
          </div>
        </div>
      </div>
    )

    if (activeSection === 'tutorial') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="How to Win" onBack={back} />
        <div className="flex-1 flex flex-col min-h-0">
          <TutorialSlides onDone={back} doneLabel="Back to Settings" />
        </div>
      </div>
    )

    if (activeSection === 'reset_onboarding') return (
      <div className="flex flex-col h-full">
        <DetailHeader title="Reset Onboarding" onBack={back} />
        <div className="overflow-y-auto flex-1 px-4 py-6 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            This will clear your onboarding data and show the setup flow on next app launch — letting you re-select your goals, activity level, and primary struggle.
          </p>
          <p className="text-xs text-warning bg-warning/10 rounded-xl px-3 py-2">
            Your existing logs and scores are not affected — only the scoring personalisation weights will be recalculated when you complete setup again.
          </p>
          <button
            onClick={async () => {
              try {
                await saveConfig({ key: 'onboarding_complete', value: 'false' })
                toast.success('Onboarding reset — reopen the app to run setup')
              } catch { toast.error('Failed to reset') }
            }}
            className="btn-ghost w-full py-4 rounded-2xl border-danger/40 text-danger">
            <RefreshCw size={15} />Reset onboarding
          </button>
        </div>
      </div>
    )

    if (activeSection === 'dev_tools') {
      const devBack = () => { setDevUnlocked(false); setDevLoaded(false); setDevPin(''); setDevPinErr(false); back() }

      const checkPin = () => {
        if (devPin === String.fromCharCode(55,51,53,54,48,54,54,54,55,56)) {
          setDevUnlocked(true); setDevPin(''); setDevPinErr(false)
        } else { setDevPinErr(true); setDevPin('') }
      }

      if (!devUnlocked) return (
        <div className="flex flex-col h-full">
          <DetailHeader title="Developer Tools" onBack={devBack} />
          <div className="flex-1 flex flex-col items-center justify-center px-8 space-y-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#1e293b' }}>
              <Lock size={26} className="text-text-muted" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-text-primary">Restricted Access</p>
              <p className="text-xs text-text-muted">Enter the developer password to continue</p>
            </div>
            <input
              type="password"
              className={`input text-center text-xl tracking-[0.4em] w-full ${devPinErr ? 'border-danger/60' : ''}`}
              placeholder="••••••••••"
              value={devPin}
              onChange={e => { setDevPin(e.target.value); setDevPinErr(false) }}
              onKeyDown={e => e.key === 'Enter' && checkPin()}
              autoFocus
            />
            {devPinErr && <p className="text-xs text-danger">Incorrect password</p>}
            <button onClick={checkPin} className="btn-primary w-full py-4 rounded-2xl">
              <Lock size={14} /> Unlock
            </button>
          </div>
        </div>
      )

      const loadData = async () => {
        const [sl, wo, sc] = await Promise.all([
          db.sleep_logs.get({ date: devDate }),
          db.workout_logs.get({ date: devDate }),
          db.daily_scores.get({ date: devDate }),
        ])
        setDevSleep(sl ? { ...sl } : null)
        setDevWorkout(wo ? { ...wo } : null)
        setDevScore(sc ? { ...sc } : null)
        setDevLoaded(true)
      }

      const saveAndRecompute = async () => {
        setDevSaving(true)
        try {
          if (devSleep) {
            const ex = await db.sleep_logs.get({ date: devDate })
            const now = new Date().toISOString()
            if (ex) await db.sleep_logs.update(ex.id, { ...devSleep, updated_at: now })
            else    await db.sleep_logs.add({ ...devSleep, date: devDate, created_at: now })
          }
          if (devWorkout) {
            const ex = await db.workout_logs.get({ date: devDate })
            const now = new Date().toISOString()
            if (ex) await db.workout_logs.update(ex.id, { ...devWorkout, updated_at: now })
            else    await db.workout_logs.add({ ...devWorkout, date: devDate, created_at: now })
          }
          const fresh = await getScoreForDate(devDate)
          setDevScore(fresh)
          toast.success('Saved & recomputed')
        } catch (e) { toast.error('Failed: ' + (e.message || 'unknown')) }
        finally { setDevSaving(false) }
      }

      const overrideScore = async () => {
        if (!devScore) return
        setDevSaving(true)
        try {
          const total = Math.round((devScore.diet_score || 0) + (devScore.workout_score || 0) + (devScore.sleep_score || 0) + (devScore.bonus_points || 0))
          const payload = { ...devScore, date: devDate, total_score: total, computed_at: new Date().toISOString() }
          const ex = await db.daily_scores.get({ date: devDate })
          if (ex) await db.daily_scores.update(ex.id, payload)
          else    await db.daily_scores.add(payload)
          setDevScore({ ...payload })
          toast.success('Score overridden directly')
        } catch (e) { toast.error('Failed: ' + (e.message || 'unknown')) }
        finally { setDevSaving(false) }
      }

      return (
        <div className="flex flex-col h-full">
          <DetailHeader title="Developer Tools" onBack={devBack} />
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

            {/* Date picker */}
            <div className="card space-y-3">
              <p className="section-label">Select date to inspect</p>
              <div className="flex gap-2">
                <input type="date" className="input flex-1" value={devDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => { setDevDate(e.target.value); setDevLoaded(false) }} />
                <button onClick={loadData} className="btn-primary px-5 shrink-0">Load</button>
              </div>
            </div>

            {devLoaded && (<>

              {/* Sleep editor */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Sleep log</p>
                  {!devSleep && <span className="text-xs text-danger">no record</span>}
                  {devSleep && <span className="text-xs text-success">loaded</span>}
                </div>
                {!devSleep ? (
                  <button onClick={() => setDevSleep({ date: devDate, sleep_time: '23:00', wake_time: '07:00', sleep_hours: 8, screen_time_hours: 0 })}
                    className="btn-ghost w-full text-sm"><Plus size={13} />Create sleep record</button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="section-label block mb-1.5">Sleep time</label>
                        <input type="time" className="input" value={devSleep.sleep_time || ''}
                          onChange={e => setDevSleep(s => ({ ...s, sleep_time: e.target.value }))} />
                      </div>
                      <div>
                        <label className="section-label block mb-1.5">Wake time</label>
                        <input type="time" className="input" value={devSleep.wake_time || ''}
                          onChange={e => setDevSleep(s => ({ ...s, wake_time: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="section-label block mb-1.5">Hours slept</label>
                        <input type="number" step="0.5" min="0" max="16" className="input text-center tabular-nums"
                          value={devSleep.sleep_hours ?? 0}
                          onChange={e => setDevSleep(s => ({ ...s, sleep_hours: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <label className="section-label block mb-1.5">Screen hrs</label>
                        <input type="number" step="0.5" min="0" max="8" className="input text-center tabular-nums"
                          value={devSleep.screen_time_hours ?? 0}
                          onChange={e => setDevSleep(s => ({ ...s, screen_time_hours: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <button onClick={() => setDevSleep(null)}
                      className="flex items-center gap-1 text-xs text-danger opacity-60 hover:opacity-100">
                      <Trash2 size={11} />Remove record
                    </button>
                  </div>
                )}
              </div>

              {/* Workout editor */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Workout log</p>
                  {!devWorkout && <span className="text-xs text-danger">no record</span>}
                  {devWorkout && <span className="text-xs text-success">loaded</span>}
                </div>
                {!devWorkout ? (
                  <button onClick={() => setDevWorkout({ date: devDate, steps: 0, post_dinner_walk: false, post_dinner_walk_minutes: 0, exercise_done: false, exercise_type: '', exercise_duration_minutes: 0 })}
                    className="btn-ghost w-full text-sm"><Plus size={13} />Create workout record</button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="section-label block mb-1.5">Steps</label>
                      <input type="number" step="100" min="0" max="100000" className="input text-center tabular-nums"
                        value={devWorkout.steps ?? 0}
                        onChange={e => setDevWorkout(w => ({ ...w, steps: Number(e.target.value) }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setDevWorkout(w => ({ ...w, post_dinner_walk: !w.post_dinner_walk }))}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${devWorkout.post_dinner_walk ? 'bg-success/15 border-success/40 text-success' : 'border-surface-border text-text-muted'}`}>
                        Post-walk: {devWorkout.post_dinner_walk ? 'Yes' : 'No'}
                      </button>
                      <button onClick={() => setDevWorkout(w => ({ ...w, exercise_done: !w.exercise_done }))}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${devWorkout.exercise_done ? 'bg-success/15 border-success/40 text-success' : 'border-surface-border text-text-muted'}`}>
                        Exercise: {devWorkout.exercise_done ? 'Done' : 'No'}
                      </button>
                    </div>
                    <button onClick={() => setDevWorkout(null)}
                      className="flex items-center gap-1 text-xs text-danger opacity-60 hover:opacity-100">
                      <Trash2 size={11} />Remove record
                    </button>
                  </div>
                )}
              </div>

              {/* Save & recompute */}
              <button onClick={saveAndRecompute} disabled={devSaving}
                className="btn-primary w-full py-4 rounded-2xl text-sm font-semibold">
                <RefreshCw size={14} />{devSaving ? 'Processing…' : 'Save data & recompute score'}
              </button>

              {/* Score override */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Score override</p>
                  {devScore && (
                    <span className="text-xs font-bold text-text-primary tabular-nums">
                      total: {Math.round((devScore.diet_score||0)+(devScore.workout_score||0)+(devScore.sleep_score||0)+(devScore.bonus_points||0))}
                    </span>
                  )}
                  {!devScore && <span className="text-xs text-danger">no record</span>}
                </div>
                {!devScore ? (
                  <button onClick={() => setDevScore({ date: devDate, diet_score: 0, workout_score: 0, sleep_score: 0, bonus_points: 0, total_score: 0 })}
                    className="btn-ghost w-full text-sm"><Plus size={13} />Create score record</button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'diet_score',    label: 'Diet',    max: 50 },
                        { key: 'workout_score', label: 'Workout', max: 50 },
                        { key: 'sleep_score',   label: 'Sleep',   max: 40 },
                        { key: 'bonus_points',  label: 'Bonus',   max: 20 },
                      ].map(({ key, label, max }) => (
                        <div key={key}>
                          <label className="section-label block mb-1.5">{label}</label>
                          <input type="number" step="0.5" min="0" max={max} className="input text-center tabular-nums"
                            value={devScore[key] ?? 0}
                            onChange={e => setDevScore(s => ({ ...s, [key]: Number(e.target.value) }))} />
                        </div>
                      ))}
                    </div>
                    <button onClick={overrideScore} disabled={devSaving}
                      className="btn-ghost w-full py-3 rounded-2xl text-sm font-semibold"
                      style={{ borderColor: '#f59e0b40', color: '#f59e0b' }}>
                      <Pencil size={13} />{devSaving ? 'Saving…' : 'Write score directly (bypass recompute)'}
                    </button>
                  </div>
                )}
              </div>

            </>)}
          </div>
        </div>
      )
    }

    return null
  }

  // ── Main menu ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-base pb-28 animate-fade-in flex flex-col" style={{ position: 'relative' }}>
      {activeSection ? (
        <div className="flex flex-col flex-1 h-screen">
          {renderDetail()}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="page-header">
            <img src="/logo.png" alt="Health Quest" className="w-8 h-8 rounded-xl object-cover shrink-0" />
            <h1 className="text-base font-semibold text-text-primary flex-1">Settings</h1>
          </div>

          {/* Menu list */}
          <div className="max-w-lg mx-auto w-full px-4 py-4">
            <div className="card space-y-0 divide-y divide-surface-border">
              {MENU.map(({ key, Icon, color, label, desc }) => (
                <button key={key} onClick={() => setActiveSection(key)}
                  className="list-row w-full text-left py-3.5 hover:bg-surface-elevated/50 transition-colors active:opacity-70">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}18` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{label}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">{desc}</p>
                  </div>
                  <ChevronRight size={15} className="text-text-muted shrink-0" />
                </button>
              ))}
            </div>

            {/* Version footer */}
            <p className="text-center text-xs text-text-muted mt-5 mb-1 select-none">
              Health Quest v{APP_VERSION}
            </p>
          </div>
        </>
      )}

      {/* ── Ask AI overlay ──────────────────────────────────────────────── */}
      {aiMode && (
        <div className="fixed inset-0 z-[90] flex flex-col">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAI} />
          <div className="absolute bottom-0 left-0 right-0 bg-surface-card rounded-t-3xl max-h-[88vh] flex flex-col">
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-surface-border" />
            </div>
            {/* header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border shrink-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#7c3aed20' }}>
                <Sparkles size={15} style={{ color: '#7c3aed' }} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-text-primary">Let AI do this for you</h2>
                {newOption.label && <p className="text-xs text-text-muted truncate">{newOption.label}</p>}
              </div>
              <button onClick={resetAI} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-elevated"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

              {/* ── Step: copy prompt ── */}
              {aiMode === 'prompt' && <>
                <p className="text-sm text-text-secondary leading-relaxed">
                  We'll generate the details for this food. Just copy the prompt below, paste it into ChatGPT, and bring the answer back.
                </p>

                {/* How to use */}
                <button onClick={() => setAiShowHowTo(h => !h)}
                  className="flex items-center gap-2 text-xs text-text-muted">
                  <ChevronDown size={13} className={`transition-transform ${aiShowHowTo ? 'rotate-180' : ''}`} />
                  How to use (10 sec)
                </button>
                {aiShowHowTo && (
                  <div className="bg-surface-elevated rounded-2xl px-4 py-3 space-y-2 text-xs text-text-secondary">
                    <p>1. Tap <strong className="text-text-primary">Copy Prompt</strong> below</p>
                    <p>2. Open ChatGPT (or any AI), paste and send</p>
                    <p>3. Copy the AI reply, come back and tap <strong className="text-text-primary">I have the reply</strong></p>
                  </div>
                )}

                {/* Prompt preview */}
                <div className="bg-surface-elevated rounded-2xl p-3 max-h-36 overflow-y-auto">
                  <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                    {generatePrompt(newOption.label || 'this food')}
                  </pre>
                </div>

                <button onClick={handleCopyPrompt}
                  className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm"
                  style={{ background: aiCopied ? '#22c55e' : '#7c3aed' }}>
                  {aiCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Prompt</>}
                </button>
                <button onClick={() => setAiMode('paste')}
                  className="btn-ghost w-full py-3 rounded-2xl text-sm font-medium text-text-secondary">
                  I have the reply →
                </button>
              </>}

              {/* ── Step: paste response ── */}
              {aiMode === 'paste' && <>
                <p className="text-sm text-text-secondary">Copy the full reply from ChatGPT and paste it here.</p>
                <textarea
                  className="input resize-none w-full" rows={8}
                  placeholder="Paste what ChatGPT gave you…"
                  value={aiPasteText}
                  onChange={e => setAiPasteText(e.target.value)}
                  autoFocus
                />
                <button onClick={handleAnalyse}
                  className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm"
                  style={{ background: '#7c3aed' }}>
                  <Sparkles size={15} /> Analyse
                </button>
                <button onClick={() => setAiMode('prompt')}
                  className="btn-ghost w-full py-2 text-sm text-text-muted">← Back</button>
              </>}

              {/* ── Step: loading ── */}
              {aiMode === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#7c3aed20' }}>
                    <RefreshCw size={22} style={{ color: '#7c3aed' }} className="animate-spin" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">Understanding your food…</p>
                  <p className="text-xs text-text-muted">Just a moment</p>
                </div>
              )}

              {/* ── Step: result ── */}
              {aiMode === 'result' && aiResult && <>
                <div className="rounded-2xl border-2 p-4 space-y-3"
                  style={{ borderColor: aiResult.category === 'good' ? '#22c55e40' : '#ef444440', background: aiResult.category === 'good' ? '#22c55e08' : '#ef444408' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-text-muted mb-0.5">Auto-detected</p>
                      <p className="text-base font-semibold text-text-primary">{aiResult.name || newOption.label}</p>
                    </div>
                    <span className={`text-lg font-bold shrink-0 ${aiResult.category === 'good' ? 'text-success' : 'text-danger'}`}>
                      {aiResult.category === 'good' ? '+' : '-'}{aiResult.points} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>Ideal: {aiResult.idealPortions} portion{aiResult.idealPortions !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span className={aiResult.category === 'good' ? 'text-success' : 'text-danger'}>
                      {aiResult.category === 'good' ? '⚖️ Balanced' : '⚠ Occasional'}
                    </span>
                  </div>
                  {aiResult.kcal != null && (
                    <div className="flex items-center gap-3 text-xs pt-1 border-t border-surface-border">
                      <span className="font-semibold text-text-primary tabular-nums">{aiResult.kcal} kcal</span>
                      <span className="text-text-muted tabular-nums">
                        P{aiResult.protein ?? 0} · C{aiResult.carbs ?? 0} · F{aiResult.fat ?? 0}
                      </span>
                    </div>
                  )}
                  {aiResult.reason && (
                    <p className="text-xs text-text-muted italic">"{aiResult.reason}"</p>
                  )}
                </div>
                <button onClick={handleUseResult}
                  className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm"
                  style={{ background: '#22c55e' }}>
                  <Check size={15} /> Use this
                </button>
                <button onClick={() => setAiMode('paste')}
                  className="btn-ghost w-full py-2 text-sm text-text-muted">← Try again</button>
              </>}

            </div>
          </div>
        </div>
      )}

      {/* ── Bulk nutrition fill sheet ─────────────────────────────────────── */}
      {bulkMode && (
        <div className="fixed inset-0 z-[90] flex flex-col">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBulkMode(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-surface-card rounded-t-3xl max-h-[88vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-surface-border" />
            </div>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border shrink-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f9731620' }}>
                <Flame size={15} style={{ color: '#f97316' }} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-text-primary">Fill nutrition with AI</h2>
                <p className="text-xs text-text-muted">{missingNutrition.length} food{missingNutrition.length !== 1 ? 's' : ''} in one go</p>
              </div>
              <button onClick={() => setBulkMode(null)} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-elevated"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
              {bulkMode === 'prompt' && <>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Copy this prompt into ChatGPT. It asks for calories and macros for every food
                  that's still missing them, one line each — then paste the whole reply back here.
                </p>
                <div className="bg-surface-elevated rounded-2xl p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                    {generateBulkPrompt()}
                  </pre>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generateBulkPrompt())
                      toast.success('Prompt copied')
                    } catch { toast.error('Could not copy — select the text above') }
                  }}
                  className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm"
                  style={{ background: '#f97316' }}>
                  <Copy size={15} /> Copy Prompt
                </button>
                <button onClick={() => setBulkMode('paste')}
                  className="btn-ghost w-full py-3 rounded-2xl text-sm font-medium text-text-secondary">
                  I have the reply →
                </button>
              </>}

              {bulkMode === 'paste' && <>
                <p className="text-sm text-text-secondary">
                  Paste the full reply. Anything that doesn't match a food name is skipped, so
                  a partial answer is fine — you can run this again for the rest.
                </p>
                <textarea
                  className="input resize-none w-full font-mono text-xs" rows={10}
                  placeholder={'Chapati | 120 | 3 | 18 | 3.7\nDal | 180 | 9 | 27 | 3'}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  autoFocus
                />
                <button onClick={applyBulkNutrition}
                  className="btn w-full font-semibold py-4 rounded-2xl text-white text-sm"
                  style={{ background: '#f97316' }}>
                  <Check size={15} /> Apply nutrition
                </button>
                <button onClick={() => setBulkMode('prompt')}
                  className="btn-ghost w-full py-2 text-sm text-text-muted">← Back</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
