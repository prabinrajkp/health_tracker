import { describe, it, expect, vi, afterEach } from 'vitest'
import { completeNudges, nudgeRequests, pickFreeModels } from '../llmApi.js'

const reply = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) })
const http = (status) => ({ ok: false, status, json: async () => ({}) })
const both = { groq_api_key: 'g', openrouter_api_key: 'o' }

afterEach(() => vi.unstubAllGlobals())

describe('nudge requests', () => {
  it('tries Groq first, with strict JSON', () => {
    const [first, second] = nudgeRequests('p', { type: 'object' }, both)
    expect(first.keyName).toBe('groq')
    expect(first.body.response_format.json_schema.strict).toBe(true)
    expect(second.keyName).toBe('openrouter')
  })
  it('only asks OpenRouter for hosts that do not collect data', () => {
    const [r] = nudgeRequests('p', {}, { openrouter_api_key: 'o' })
    expect(r.body.provider.data_collection).toBe('deny')
  })
  it('makes at most 2 attempts', () => {
    expect(nudgeRequests('p', {}, both)).toHaveLength(2)
    expect(nudgeRequests('p', {}, { openrouter_api_key: 'o' })).toHaveLength(2)
  })
})

describe('failure paths', () => {
  it('no key means no calls', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    await expect(completeNudges('p', {}, {})).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
  })
  it('falls through to OpenRouter when Groq fails', async () => {
    const f = vi.fn(async (url) => {
      if (url.includes('groq')) return http(500)
      if (url.endsWith('/key')) return { ok: true, json: async () => ({ data: { free_model_daily_requests: { remaining: 40 } } }) }
      return reply('{"messages":[]}')
    })
    vi.stubGlobal('fetch', f)
    expect((await completeNudges('p', {}, both)).provider).toBe('openrouter')
  })
  it('does not spend the last OpenRouter requests', async () => {
    const f = vi.fn(async (url) => url.endsWith('/key')
      ? { ok: true, json: async () => ({ data: { free_model_daily_requests: { remaining: 3 } } }) } : reply('{}'))
    vi.stubGlobal('fetch', f)
    await expect(completeNudges('p', {}, { openrouter_api_key: 'o' })).rejects.toMatchObject({ reason: 'quota_low' })
    expect(f.mock.calls.every(([u]) => u.endsWith('/key'))).toBe(true)
  })
  it('does not relax privacy when no private model is available', async () => {
    const bodies = []
    vi.stubGlobal('fetch', vi.fn(async (url, o) => {
      if (url.endsWith('/key')) return http(500)
      bodies.push(JSON.parse(o.body))
      return http(404)
    }))
    await expect(completeNudges('p', {}, { openrouter_api_key: 'o' })).rejects.toMatchObject({ reason: 'no_private_model' })
    expect(bodies.every(b => b.provider?.data_collection === 'deny')).toBe(true)
  })
  it('reports rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => http(429)))
    await expect(completeNudges('p', {}, { groq_api_key: 'g' })).rejects.toMatchObject({ reason: 'rate_limited' })
  })
  it('gives up on a request that hangs', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))))))
    const p = completeNudges('p', {}, { groq_api_key: 'g' })
    const check = expect(p).rejects.toMatchObject({ reason: 'failed' })
    await vi.advanceTimersByTimeAsync(41000)
    await check
    vi.useRealTimers()
  })
})

describe('pickFreeModels', () => {
  const now = new Date('2026-11-01')
  const m = (id, over = {}) => ({ id, supported_parameters: ['response_format'], expiration_date: null, ...over })
  it('keeps general free models that can return JSON', () => {
    expect(pickFreeModels([m('a/b:free'), m('a/paid')], now)).toEqual(['a/b:free'])
  })
  it('drops models without JSON, specialised ones, and those about to go', () => {
    expect(pickFreeModels([
      m('a/b:free', { supported_parameters: [] }),
      m('a/code-model:free'), m('nvidia/x-content-safety:free'),
      m('a/old:free', { expiration_date: '2026-11-05' }),
      m('a/later:free', { expiration_date: '2026-12-31' }),
    ], now)).toEqual(['a/later:free'])
  })
})
