import { useEffect, useState } from 'react'
import { getConfig, saveConfig } from '../api/client'
import { IF_THEN_OPTIONS, currentIfThen, weekKey } from '../services/ifThen'
import { planNudges } from '../services/nudgePlanner'

// One specific plan for the week's biggest cost. Later nudges quote it back.
export default function IfThenCard({ cost }) {
  const [plan, setPlan] = useState(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    getConfig().then(rows => {
      const map = {}
      rows.forEach(r => { map[r.key] = r.value })
      setPlan(currentIfThen(map))
    }).catch(() => {})
  }, [cost])

  const options = IF_THEN_OPTIONS[cost]
  if (!options && !plan) return null

  const choose = async (text) => {
    const next = { week: weekKey(), cost, text }
    await saveConfig({ key: 'if_then_plan', value: JSON.stringify(next) })
    setPlan(next)
    setPicking(false)
    planNudges().catch(() => {})
  }

  if (picking) return (
    <div className="pt-3 space-y-2">
      <p className="text-sm text-text-secondary">Pick the one that fits. It will come back at the moment it applies.</p>
      {options.plans.map(text => (
        <button key={text} onClick={() => choose(text)} className="btn-ghost w-full text-left justify-start py-3 h-auto whitespace-normal">{text}</button>
      ))}
    </div>
  )
  if (plan) return (
    <p className="text-sm text-text-secondary pt-3">
      Your plan: <span className="text-text-primary">{plan.text}.</span>{' '}
      {options && <button onClick={() => setPicking(true)} className="font-semibold text-brand-light">Change</button>}
    </p>
  )
  return (
    <button onClick={() => setPicking(true)} className="text-sm font-semibold text-brand-light pt-3 active:opacity-70">
      Make it a plan
    </button>
  )
}
