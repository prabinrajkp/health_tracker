// Turns rule-approved facts into a prompt, and checks what comes back. The reply is
// treated as untrusted: each message is checked by itself, and one that fails only
// means that slot keeps its rule-written text. See docs/ai_nudges_plan.md §5.
import { extractJson } from './llmApi'

export const MAX_TITLE = 35
export const MAX_BODY  = 130
const SIMILAR_SHARE = 0.7
const MAX_EMOJI = 1
const HARD_CAP_CALLS = 3
const REFRESH_AFTER_MIN = 15 * 60
const MIN_CALL_GAP_MS = 2 * 60 * 60 * 1000

// Medical claims, shaming, and anything that pushes eating less. Kept small, by hand.
export const BLOCKED = 'diagnos|disease|disorder|\\bcure|medical|medicine|medication|illness|diabet|starv|skip(ping)? (a |your |the )?(meal|breakfast|lunch|dinner)|eat less|eating less|smaller portions?|cut (back|down)|fast longer|extend your fast|calorie deficit|lose weight|weight loss|burn it off|you failed|failure|lazy|shame|guilt|obes|\\bfat\\b|because|\\bmust\\b|last chance|hurry'
const BLOCKED_RE = new RegExp(BLOCKED, 'i')
export const LINK_PATTERN = 'https?:|www\\.|\\S+@\\S+|\\.(com|net|org|in)\\b'
const LINK_RE = new RegExp(LINK_PATTERN, 'i')
export const NUMBER_WORD_PATTERN = '\\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand)\\b'
const NUMBER_WORDS = new RegExp(NUMBER_WORD_PATTERN, 'i')
const EMOJI_RE = /\p{Extended_Pictographic}/gu

export const NUDGE_SCHEMA = {
  type: 'object',
  properties: {
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } },
        required: ['id', 'title', 'body'],
        additionalProperties: false,
      },
    },
  },
  required: ['messages'],
  additionalProperties: false,
}

const numbersIn = (text) => (String(text).replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) || [])

export function allowedNumbers(facts) {
  const out = new Set()
  const visit = (v) => {
    if (v == null) return
    if (typeof v === 'object') Object.values(v).forEach(visit)
    else numbersIn(v).forEach(n => out.add(n))
  }
  visit(facts)
  return [...out]
}

const WHEN = ['today', 'tomorrow', 'in 2 days', 'in 3 days', 'in 4 days', 'in 5 days', 'in 6 days', 'in a week']

// What goes to the AI. No name, notes, foods, dates or body measurements: only the
// figures named in each slot's facts, and the goal as a fixed option.
export function buildPayload(slots, { plan, recentMessages = [], now = new Date() }) {
  return {
    context: {
      goal: plan?.goal || 'unspecified',
      build_muscle: !!plan?.muscle,
      day: now.toLocaleDateString('en-US', { weekday: 'long' }),
      tone: 'plain',
    },
    recent_messages: recentMessages,
    slots: slots.map((s, i) => ({ id: `n${i + 1}`, arrives: WHEN[s.day] || 'soon', purpose: s.purpose, facts: s.facts })),
  }
}

export function buildPrompt(payload) {
  return `You write short phone notifications for a health habit app. The app has already decided what to say and when. You only choose the words.

Rules:
- Write one message for each slot, using only that slot's purpose and facts. Do not add facts. Do not calculate anything.
- Any number you use must appear in that slot's facts. Write numbers as digits, never as words.
- Title up to ${MAX_TITLE} characters. Body up to ${MAX_BODY} characters.
- Plain and warm, like a sensible friend who knows the numbers. No guilt, no pressure, no exclamation marks, and at most one emoji in a message.
- Say "on days when", never "because". These are patterns, not causes.
- Do not mention medical conditions, diagnosis, weight loss, or eating less. Never suggest skipping a meal.
- Write so it reads right at the moment it arrives ("arrives" says when).
- Do not reuse the wording in recent_messages.

Reply with only valid JSON in exactly this shape:
{"messages":[{"id":"n1","title":"...","body":"..."}]}

Data:
${JSON.stringify(payload)}`
}

const wordsOf = (text) => new Set(String(text).toLowerCase().match(/[a-z']+/g) || [])

function tooSimilar(text, recent) {
  const a = wordsOf(text)
  if (!a.size) return false
  return recent.some(r => {
    const b = wordsOf(r)
    const shared = [...a].filter(w => b.has(w)).length
    return shared / Math.max(a.size, b.size) >= SIMILAR_SHARE
  })
}

// Returns null when the message passes, or a short reason when it does not.
export function checkMessage(msg, slot, recent = []) {
  if (typeof msg?.title !== 'string' || typeof msg?.body !== 'string') return 'not_text'
  const title = msg.title.trim(), body = msg.body.trim()
  if (!title || !body) return 'empty'
  if (title.length > MAX_TITLE) return 'title_too_long'
  if (body.length > MAX_BODY) return 'body_too_long'
  const text = `${title} ${body}`
  const allowed = new Set(allowedNumbers(slot.facts))
  if (numbersIn(text).some(n => !allowed.has(n))) return 'invented_number'
  if (NUMBER_WORDS.test(text)) return 'number_as_word'
  if (BLOCKED_RE.test(text)) return 'blocked_term'
  if (LINK_RE.test(text)) return 'link'
  if (text.includes('!')) return 'exclamation'
  if ((text.match(EMOJI_RE) || []).length > MAX_EMOJI) return 'too_many_emoji'
  if (tooSimilar(body, recent)) return 'too_similar'
  return null
}

// Maps a raw reply back to slots. Anything that fails is left out, and counted.
export function parseReply(text, slots, recent = []) {
  const json = extractJson(text)
  const messages = Array.isArray(json?.messages) ? json.messages : null
  if (!messages) return { copies: {}, rejected: { not_json: 1 } }
  const copies = {}, rejected = {}
  for (const msg of messages) {
    const index = /^n(\d+)$/.exec(msg?.id || '')?.[1]
    const slot = index ? slots[Number(index) - 1] : null
    const reason = slot ? checkMessage(msg, slot, recent) : 'unknown_id'
    if (reason) { rejected[reason] = (rejected[reason] || 0) + 1; continue }
    copies[slot.key] = { title: msg.title.trim(), body: msg.body.trim() }
  }
  return { copies, rejected }
}

// One call at the first plan of the day, one more after 3 PM, and a hard cap.
export function shouldCallAi({ calls = 0, lastAt = 0 }, openCount, now = new Date()) {
  if (openCount === 0 || calls >= HARD_CAP_CALLS) return false
  if (calls === 0) return true
  if (now.getTime() - lastAt < MIN_CALL_GAP_MS) return false
  return now.getHours() * 60 + now.getMinutes() >= REFRESH_AFTER_MIN
}

// Copy is stored by day, nudge and facts, so a changed fact means fresh wording.
export function copyKey(slot) {
  const source = JSON.stringify([slot.date, slot.trigger, slot.detail, slot.purpose, slot.facts])
  let h = 0
  for (let i = 0; i < source.length; i++) h = (h * 31 + source.charCodeAt(i)) | 0
  return `${slot.date}|${slot.trigger}|${h}`
}
