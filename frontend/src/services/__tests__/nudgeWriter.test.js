import { describe, it, expect } from 'vitest'
import { checkMessage, parseReply, buildPayload, buildPrompt, allowedNumbers, shouldCallAi, copyKey } from '../nudgeWriter.js'

const slot = (over = {}) => ({ key: 'dinner_window|x', trigger: 'dinner_window', date: '2026-11-03', day: 0, purpose: 'Encourage', facts: { penalty_points: 5, usual_dinner_label: '9:10 PM', step_target: 8000 }, ...over })
const ok = { title: 'Dinner soon', body: 'Starting by now keeps 5 points. You usually eat around 9:10 PM.' }

describe('checkMessage', () => {
  it('passes good copy', () => expect(checkMessage(ok, slot())).toBeNull())
  it('reads thousands separators', () => expect(checkMessage({ title: 'Walk', body: 'Heading for 8,000 steps today.' }, slot())).toBeNull())
  it.each([
    ['invented numbers', { title: 'Dinner', body: 'That keeps 7 points.' }, 'invented_number'],
    ['miscalculated numbers', { title: 'Dinner', body: 'Worth 10 points over 2 days.' }, 'invented_number'],
    ['numbers as words', { title: 'Dinner', body: 'Three days in a row now.' }, 'number_as_word'],
    ['medical claims', { title: 'Dinner', body: 'Late meals can cause disease.' }, 'blocked_term'],
    ['eating less', { title: 'Dinner', body: 'Try to eat less tonight.' }, 'blocked_term'],
    ['skipping meals', { title: 'Dinner', body: 'You could skip dinner.' }, 'blocked_term'],
    ['causes', { title: 'Sleep', body: 'You slept well because of it.' }, 'blocked_term'],
    ['shaming', { title: 'Dinner', body: 'You failed again today.' }, 'blocked_term'],
    ['links', { title: 'Dinner', body: 'See www.example.org' }, 'link'],
    ['exclamation marks', { title: 'Dinner', body: 'Great job!' }, 'exclamation'],
    ['too many emoji', { title: 'Walk 🚶', body: 'Off you go 🌙' }, 'too_many_emoji'],
    ['long titles', { title: 'x'.repeat(36), body: 'ok' }, 'title_too_long'],
    ['long bodies', { title: 'ok', body: 'x'.repeat(131) }, 'body_too_long'],
    ['empty text', { title: ' ', body: 'ok' }, 'empty'],
    ['missing fields', { title: 'ok' }, 'not_text'],
  ])('rejects %s', (_, msg, reason) => expect(checkMessage(msg, slot())).toBe(reason))
  it('rejects a repeat of a recent message', () => {
    expect(checkMessage(ok, slot(), ['Starting by now keeps 5 points. You usually eat around 9:10 PM.'])).toBe('too_similar')
  })
})

describe('parseReply', () => {
  const slots = [slot(), slot({ key: 'steps|x', trigger: 'steps' })]
  it('maps messages back to slots', () => {
    const { copies } = parseReply(JSON.stringify({ messages: [{ id: 'n1', ...ok }] }), slots)
    expect(copies['dinner_window|x'].title).toBe('Dinner soon')
  })
  it('copes with code fences around the JSON', () => {
    expect(parseReply('```json\n' + JSON.stringify({ messages: [{ id: 'n1', ...ok }] }) + '\n```', slots).copies['dinner_window|x']).toBeTruthy()
  })
  it('rejects text that is not JSON', () => {
    expect(parseReply('Sure! Here are some ideas', slots).rejected.not_json).toBe(1)
  })
  it('ignores invented slots', () => {
    const { copies, rejected } = parseReply(JSON.stringify({ messages: [{ id: 'n9', ...ok }, { id: 'hack', ...ok }] }), slots)
    expect(copies).toEqual({})
    expect(rejected.unknown_id).toBe(2)
  })
  it('a bad message costs only its own slot', () => {
    const { copies, rejected } = parseReply(JSON.stringify({ messages: [
      { id: 'n1', ...ok }, { id: 'n2', title: 'Walk', body: 'Worth 99 points' },
    ] }), slots)
    expect(Object.keys(copies)).toEqual(['dinner_window|x'])
    expect(rejected.invented_number).toBe(1)
  })
})

describe('privacy of the request', () => {
  it('sends only the slot facts, the goal option and recent wording', () => {
    const payload = buildPayload([slot()], { plan: { goal: 'gain', muscle: true, maintenanceOffset: -100 }, recentMessages: ['x'], now: new Date(2026, 10, 3) })
    expect(Object.keys(payload).sort()).toEqual(['context', 'recent_messages', 'slots'])
    expect(payload.context).toEqual({ goal: 'gain', build_muscle: true, day: 'Tuesday', tone: 'plain' })
    expect(Object.keys(payload.slots[0]).sort()).toEqual(['arrives', 'facts', 'id', 'purpose'])
    expect(JSON.stringify(payload)).not.toMatch(/2026|maintenanceOffset/)
  })
  it('states the rules in the prompt', () => {
    const p = buildPrompt(buildPayload([slot()], { plan: null, now: new Date(2026, 10, 3) }))
    expect(p).toMatch(/on days when/)
    expect(p).toMatch(/Never suggest skipping a meal/)
  })
  it('collects numbers from facts, including those inside text', () => {
    expect(allowedNumbers({ a: 5, b: '9:10 PM', c: { d: '8,000 steps' } }).sort()).toEqual(['10', '5', '8000', '9'])
  })
})

describe('shouldCallAi', () => {
  const morning = new Date(2026, 10, 3, 9, 0), evening = new Date(2026, 10, 3, 16, 0)
  it('calls once at the first plan of the day', () => expect(shouldCallAi({ calls: 0 }, 2, morning)).toBe(true))
  it('never calls with nothing to write', () => expect(shouldCallAi({ calls: 0 }, 0, morning)).toBe(false))
  it('does not call again in the morning', () => expect(shouldCallAi({ calls: 1, lastAt: morning.getTime() - 3 * 3600000 }, 2, morning)).toBe(false))
  it('allows a refresh after 3 PM', () => expect(shouldCallAi({ calls: 1, lastAt: morning.getTime() }, 2, evening)).toBe(true))
  it('waits between refreshes', () => expect(shouldCallAi({ calls: 1, lastAt: evening.getTime() - 60000 }, 2, evening)).toBe(false))
  it('stops at the hard cap', () => expect(shouldCallAi({ calls: 3, lastAt: 0 }, 2, evening)).toBe(false))
})

describe('copyKey', () => {
  it('changes when the facts change, so stale wording is not reused', () => {
    expect(copyKey(slot())).not.toBe(copyKey(slot({ facts: { penalty_points: 6 } })))
    expect(copyKey(slot())).toBe(copyKey(slot()))
  })
})
