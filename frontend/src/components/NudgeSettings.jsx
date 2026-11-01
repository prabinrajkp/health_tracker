import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { getConfig, saveConfig } from '../api/client'
import { Toggle } from '../pages/log/shared'
import BottomSheet from './BottomSheet'
import { planNudges, recentNudges, rateNudge, setNudgeOff, previewRequest } from '../services/nudgePlanner'
import { compareSources } from '../services/nudgeLearning'

const LABELS = {
  bedtime: 'Bedtime', dinner: 'Dinner', dinner_window: 'Before dinner', steps: 'Walks', breakfast: 'Breakfast',
  evidence: 'Your own patterns', if_then: 'Your weekly plan', fresh_start: 'Fresh starts', streak_guard: 'Streak',
  near_win: 'Nearly there', noticed_progress: 'Progress', walk: 'After-dinner walk', morning_review: 'Morning review',
  drinks_check: 'Drinks', log_day: 'Log your day', lunch_checkin: 'Lunch', wake_timer: 'Sleep timer',
  comeback: 'Comeback', sick_note: 'Get-well note', wrap_week: 'Weekly wrap', wrap_month: 'Monthly wrap',
}

const STATUS_TEXT = {
  no_private_model: 'OpenRouter has no free model right now that avoids collecting data, so nudges stay rule-written. A Groq key avoids this.',
  quota_low: 'Your OpenRouter requests are nearly used up today, so nudges stay rule-written for now.',
  rate_limited: 'The AI provider is rate limiting, so nudges stay rule-written for now.',
  failed: 'The last attempt failed, so nudges stay rule-written for now.',
}

function RecentList({ rows, onRate }) {
  if (!rows.length) return <p className="text-sm text-text-secondary">Nothing sent yet.</p>
  return (
    <div className="group-list">
      {rows.map(r => (
        <div key={r.id} className="py-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{r.title}</p>
              <p className="text-sm text-text-secondary">{r.body}</p>
            </div>
            <div className="flex shrink-0">
              <button onClick={() => onRate(r, 'helpful')} aria-label="Helpful" aria-pressed={r.rating === 'helpful'}
                className={`w-9 h-9 flex items-center justify-center ${r.rating === 'helpful' ? 'text-brand-light' : 'text-text-muted'}`}><ThumbsUp size={16} /></button>
              <button onClick={() => onRate(r, 'not_helpful')} aria-label="Not helpful" aria-pressed={r.rating === 'not_helpful'}
                className={`w-9 h-9 flex items-center justify-center ${r.rating === 'not_helpful' ? 'text-brand-light' : 'text-text-muted'}`}><ThumbsDown size={16} /></button>
            </div>
          </div>
          <p className="t-caption mt-1">{format(new Date(r.at), 'EEE d MMM, h:mm a')} · {r.source === 'ai' ? 'AI-written' : 'Rule-written'}</p>
          {r.why && <p className="t-caption">Why: {r.why}.</p>}
        </div>
      ))}
    </div>
  )
}

export default function NudgeSettings({ hasKey, onOpenAi }) {
  const [config, setConfig] = useState({})
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)

  const load = async () => {
    const list = await getConfig()
    const map = {}
    list.forEach(c => { map[c.key] = c.value })
    setConfig(map)
    setRows(await recentNudges())
  }
  useEffect(() => { load().catch(console.error) }, [])

  const toggle = async (key, on) => {
    await saveConfig({ key, value: String(on) })
    await planNudges()
    await load()
  }
  const rate = async (row, rating) => {
    const off = await rateNudge(row.id, row.rating === rating ? null : rating)
    if (off) toast(`${LABELS[row.trigger] || 'That kind of nudge'} turned off. You can turn it back on below.`)
    await load()
  }
  const turnOn = async (trigger) => { await setNudgeOff(trigger, false); await load() }

  const off = (() => { try { return JSON.parse(config.nudge_off || '[]') } catch { return [] } })()
  const state = (() => { try { return JSON.parse(config.nudge_ai_state || 'null') } catch { return null } })()
  const aiOn = config.nudge_ai === 'true' && hasKey

  return (
    <>
      <div className="card space-y-3">
        <p className="section-label">AI-written nudges</p>
        <Toggle label="Write nudges with AI" sublabel="Messages based on your own patterns. You still get the same number of notifications."
          checked={aiOn} onChange={on => hasKey ? toggle('nudge_ai', on) : onOpenAi()} />
        <p className="text-sm text-text-secondary">
          Sends summary figures, such as average scores and usual times, to your AI provider about once a day. Never your name, notes, foods or body measurements.
        </p>
        {!hasKey && (
          <button onClick={onOpenAi} className="text-sm font-semibold text-brand-light py-1">Add an AI key first</button>
        )}
        <button onClick={async () => setPreview(await previewRequest())} className="text-sm font-semibold text-brand-light py-1 block">See exactly what is sent</button>
        {aiOn && state && (
          <p className="t-caption">
            {state.ok ? `Last written ${state.date}, ${state.written} message${state.written === 1 ? '' : 's'}.` : STATUS_TEXT[state.reason] || STATUS_TEXT.failed}
          </p>
        )}
        {aiOn && Capacitor.isNativePlatform() && (
          <Toggle label="Also write when the app is closed" sublabel="Finishes wording that could not be written earlier. Keeps a copy of your AI key in the app's private storage, and makes network calls with the app closed."
            checked={config.nudge_background === 'true'} onChange={on => toggle('nudge_background', on)} />
        )}
      </div>

      {off.length > 0 && (
        <div className="card space-y-2">
          <p className="section-label">Turned off</p>
          {off.map(t => (
            <div key={t} className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{LABELS[t] || t}</span>
              <button onClick={() => turnOn(t)} className="text-sm font-semibold text-brand-light py-1">Turn back on</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="section-label mb-1">Recent nudges</p>
        <RecentList rows={rows} onRate={rate} />
      </div>

      <BottomSheet open={!!preview} onClose={() => setPreview(null)} title="What is sent">
        <div className="px-4 py-4 space-y-3">
          {preview?.sample && <p className="text-sm text-text-secondary">Nothing has been sent yet. This is a sample from today's figures.</p>}
          <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words">{preview?.text}</pre>
        </div>
      </BottomSheet>
    </>
  )
}

// Developer settings: does AI wording actually do better than the rule-written text?
export function NudgeDeveloperStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => { recentNudges(90).then(rows => setStats(compareSources(rows))).catch(() => {}) }, [])
  if (!stats) return null
  return (
    <div className="card space-y-2">
      <p className="section-label">Nudges: AI against rule-written, 90 days</p>
      {[['AI-written', stats.ai], ['Rule-written', stats.rule]].map(([label, s]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">{label}</span>
          <span className="tabular-nums text-text-primary">{s.sent} sent · {s.tapped} tapped · {s.acted} acted · {s.ignored} ignored</span>
        </div>
      ))}
      <p className="t-caption">On this phone only. Directional at best for one person.</p>
    </div>
  )
}
