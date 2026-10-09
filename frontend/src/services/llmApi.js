/**
 * Free-tier LLM nutrition analysis — OpenRouter primary, Groq fallback.
 * Both are OpenAI-chat-completions compatible, so one thin caller covers both.
 * Keys live in tracker_config (openrouter_api_key / groq_api_key), entered once
 * in Settings and reused from there — never hardcoded here.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions'

// Ordered fallbacks — free-tier models get deprecated/renamed over time, so a
// single call tries each in turn before giving up on that provider.
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
]
const GROQ_MODELS = [
  // llama-3.3-70b-versatile and llama-3.1-8b-instant were shut down 2026-08-16
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

const BULK_BATCH_SIZE = 12

export function hasLlmKey(config) {
  return !!(config?.openrouter_api_key || config?.groq_api_key)
}

function extractJson(text, opener = '{', closer = '}') {
  if (!text) return null
  const start = text.indexOf(opener)
  const end   = text.lastIndexOf(closer)
  if (start === -1 || end === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

async function callChat(url, apiKey, model, prompt) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`${url.includes('groq') ? 'Groq' : 'OpenRouter'} ${model}: HTTP ${res.status}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error(`${model}: empty response`)
  return content
}

/**
 * OpenRouter is the primary provider — tried first, across its whole model
 * list. Groq only steps in as backup: when no OpenRouter key is configured,
 * or every OpenRouter model call fails (missing/invalid key, rate limit,
 * outage). Groq is never tried while OpenRouter is succeeding.
 */
async function chatCompletion(prompt, config) {
  const errors = []
  if (config?.openrouter_api_key) {
    for (const model of OPENROUTER_MODELS) {
      try { return await callChat(OPENROUTER_URL, config.openrouter_api_key, model, prompt) }
      catch (e) { errors.push(e.message) }
    }
  }
  if (config?.groq_api_key) {
    for (const model of GROQ_MODELS) {
      try { return await callChat(GROQ_URL, config.groq_api_key, model, prompt) }
      catch (e) { errors.push(e.message) }
    }
  }
  if (!errors.length) throw new Error('No AI provider configured — add an API key in Settings')
  throw new Error(`All AI providers failed — ${errors[errors.length - 1]}`)
}

const SCORING_GUIDE = `Scoring guide:
points 3 = protein-rich, very healthy (chicken, fish, eggs, dal, lentils, salad)
points 2 = moderately healthy (rice, chapati, milk, yogurt, fruits, paneer)
points 1 = low-nutrition (light fried items, white bread, packaged snacks)
category bad = junk food (deep fried, fast food, sugary drinks, sweets, chips)
category good = everything else`

function singleFoodPrompt(foodName) {
  return `You are a nutrition analyst for an Indian health-tracking app.

Respond with ONLY valid JSON (no markdown, no code fences, no extra text), in exactly this shape:
{"name":"...","points":1|2|3,"idealPortions":number,"category":"good"|"bad","kcal":number,"protein":number,"carbs":number,"fat":number,"reason":"..."}

${SCORING_GUIDE}

Nutrition is for ONE typical Indian household portion (1 chapati, 1 katori dal, 1 cup rice, 1 egg). reason is max 10 words.

Analyze: ${foodName}`
}

function bulkFoodsPrompt(labels) {
  const list = labels.map(l => `- ${l}`).join('\n')
  return `You are a nutrition analyst for an Indian health-tracking app.

For EACH food below, give the nutrition of ONE typical Indian household portion
(1 chapati, 1 katori dal, 1 cup rice, 1 egg, 1 glass, 1 piece).

Respond with ONLY a valid JSON array (no markdown, no extra text), in exactly this shape:
[{"name":"...","kcal":number,"protein":number,"carbs":number,"fat":number}, ...]

Keep each "name" EXACTLY as given below, one object per food, same order.

Foods:
${list}`
}

function buildHealthSummaryPrompt(data) {
  const { score, diet, workout, sleep, yesterdayDiet } = data

  // Build fasting window
  let fastingText = ''
  if (diet && yesterdayDiet) {
    const dinnerItems = (yesterdayDiet.meal_items || []).filter(i => i.mealType === 'dinner')
    const lastDinner = [...dinnerItems.map(i => i.time).filter(Boolean)].sort().pop()
      || yesterdayDiet.meal_times?.dinner || null
    const bfItems = (diet.meal_items || []).filter(i => i.mealType === 'breakfast')
    const firstBf = [...bfItems.map(i => i.time).filter(Boolean)].sort()[0]
      || diet.meal_times?.breakfast || null
    if (lastDinner && firstBf) {
      const [dh, dm] = lastDinner.split(':').map(Number)
      const [bh, bm] = firstBf.split(':').map(Number)
      let d = dh * 60 + dm, b = bh * 60 + bm
      if (b <= d) b += 24 * 60
      const fh = Math.round(((b - d) / 60) * 10) / 10
      fastingText = `\nFasting window: ${fh} hours (last dinner to first breakfast)`
    }
  }

  // Meals
  const mealLines = []
  const mt = diet?.meal_times || {}
  const mealGroups = ['breakfast', 'lunch', 'dinner', 'snacks']
  for (const type of mealGroups) {
    const items = (diet?.meal_items || []).filter(i => i.mealType === type)
    if (items.length === 0 && !mt[type]) continue
    const timeTag = mt[type] ? ` (at ${mt[type]})` : ''
    const foodList = items.length
      ? items.map(i => `${i.label} ×${i.portions}`).join(', ')
      : 'no items recorded'
    mealLines.push(`  ${type.charAt(0).toUpperCase() + type.slice(1)}${timeTag}: ${foodList}`)
  }
  const dietNotes = [diet?.breakfast_notes, diet?.lunch_notes, diet?.notes].filter(Boolean)

  // Sleep
  const screenH = sleep?.screen_time_hours || 0
  const effectiveSleep = sleep?.sleep_hours ? Math.max(0, sleep.sleep_hours - screenH) : null
  const qualityLabel = { 1: 'Terrible', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent' }

  const lines = [
    `You are a personal health-coaching summarization engine.

Using the user's daily health data, generate a SHORT executive summary focused ONLY on these three pillars:

1. Diet
2. Sleep
3. Workout

For each pillar:
- Identify one meaningful positive aspect from today's data, if one exists.
- Identify one meaningful weakness/problem, ONLY if one exists.
- Do not invent problems when the data does not support them.
- Translate the raw data into a practical insight rather than merely repeating numbers.

Then provide a single "Tomorrow's Focus" with 2–3 highly actionable priorities based on the biggest opportunities from today.

IMPORTANT:
- Prioritize patterns and behaviors over individual food items.
- Consider timing, quantity, consistency, quality, and balance where the available data supports it.
- For sleep, consider duration, bedtime/wake time, sleep quality, screen-time impact, and fasting window when available.
- For diet, consider meal timing, protein, food quality, variety, sweets/processed foods, portions, and late-night eating when available.
- For workout, consider whether exercise was completed, duration, consistency, and intensity when available.
- Do not make medical diagnoses or medical claims.
- Do not praise everything. Be objective and balanced.
- If a pillar has no meaningful negative, simply state the positive and avoid forcing a weakness.
- Keep the tone professional, concise, motivating, and actionable.
- The summary should feel like a human health coach giving a daily executive briefing.

OUTPUT FORMAT (use exactly this structure):

### Today's Executive Summary — [total_score]/100

- 🍽️ **Diet:** [Positive]. **Improve:** [Weakness/opportunity, if applicable].
- 😴 **Sleep:** [Positive]. **Improve:** [Weakness/opportunity, if applicable].
- 💪 **Workout:** [Positive]. **Improve:** [Weakness/opportunity, if applicable].

**Tomorrow's Focus:** [2–3 specific actions based on today's weaknesses while maintaining the positives.]

Do not include unnecessary details, calculations, disclaimers, or a long explanation.

---

DAILY HEALTH DATA:

Total Score: ${score?.total_score ?? 0}/100
Diet Score: ${score?.diet_score ?? 0}/35 | Workout Score: ${score?.workout_score ?? 0}/35 | Sleep Score: ${score?.sleep_score ?? 0}/30${score?.fasting_score > 0 ? ` | Fasting Bonus: ${score.fasting_score}/10` : ''}

DIET:
${mealLines.length ? mealLines.join('\n') : '  No meals logged'}${fastingText}${dietNotes.length ? `\n  Notes: ${dietNotes.join('; ')}` : ''}

SLEEP:
${sleep?.sleep_time ? `  Bedtime: ${sleep.sleep_time}` : '  Bedtime: Not recorded'}
${sleep?.wake_time ? `  Wake time: ${sleep.wake_time}` : '  Wake time: Not recorded'}
${sleep?.sleep_hours > 0 ? `  Total sleep: ${sleep.sleep_hours} hours` : '  Duration: Not recorded'}${screenH > 0 ? `\n  Screen time before bed: ${screenH} hours (effective sleep: ${effectiveSleep} hours)` : ''}${sleep?.quality ? `\n  Quality: ${qualityLabel[sleep.quality] || sleep.quality}/5` : ''}${sleep?.notes ? `\n  Notes: ${sleep.notes}` : ''}

WORKOUT:
${workout?.exercise_type ? `  Exercise: ${workout.exercise_type}${workout.exercise_duration_minutes ? ` — ${workout.exercise_duration_minutes} min` : ''}` : '  No workout logged'}${workout?.notes ? `\n  Notes: ${workout.notes}` : ''}`,
  ]
  return lines.join('')
}

export async function generateHealthSummary(data, config) {
  return await chatCompletion(buildHealthSummaryPrompt(data), config)
}

const num = (v) => (v == null || isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v) * 10) / 10))

function normaliseSingle(json, fallbackName) {
  if (!json) return null
  const points = Number(json.points)
  if (!points || points < 0.5 || points > 10) return null
  return {
    name:          json.name || fallbackName,
    points,
    idealPortions: Number(json.idealPortions) || 1,
    category:      json.category === 'bad' ? 'bad' : 'good',
    kcal:          num(json.kcal),
    protein:       num(json.protein),
    carbs:         num(json.carbs),
    fat:           num(json.fat),
    reason:        json.reason || '',
  }
}

/** Analyzes one food (existing or newly added) — points, category, ideal portions, macros. */
export async function analyzeFoodWithAI(foodName, config) {
  const text   = await chatCompletion(singleFoodPrompt(foodName), config)
  const result = normaliseSingle(extractJson(text), foodName)
  if (!result) throw new Error("Couldn't parse the AI response — try again")
  return result
}

/**
 * Fills nutrition (kcal/protein/carbs/fat) for a batch of existing foods that
 * are missing it. Returns a Map keyed by lower-cased label.
 */
export async function bulkAnalyzeFoodsWithAI(labels, config, onProgress) {
  const results = new Map()
  for (let i = 0; i < labels.length; i += BULK_BATCH_SIZE) {
    const batch = labels.slice(i, i + BULK_BATCH_SIZE)
    const text  = await chatCompletion(bulkFoodsPrompt(batch), config)
    const json  = extractJson(text, '[', ']')
    if (Array.isArray(json)) {
      for (const row of json) {
        if (!row?.name || row.kcal == null) continue
        results.set(String(row.name).toLowerCase().trim(), {
          kcal: num(row.kcal), protein: num(row.protein), carbs: num(row.carbs), fat: num(row.fat),
        })
      }
    }
    onProgress?.(Math.min(i + BULK_BATCH_SIZE, labels.length), labels.length)
  }
  if (results.size === 0) throw new Error("Couldn't parse the AI response — try again")
  return results
}
