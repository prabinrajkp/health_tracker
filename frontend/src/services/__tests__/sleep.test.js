import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { calcSleepScore, computeScore } from '../scoring.js'

// ── Helpers (copied from SleepLog.jsx to test in isolation) ─────────────────

function calcHours(st, wt) {
  if (!st || !wt) return 0
  const [sh, sm] = st.split(':').map(Number)
  const [wh, wm] = wt.split(':').map(Number)
  let s = sh * 60 + sm, w = wh * 60 + wm
  if (w <= s) w += 24 * 60
  return Math.round(((w - s) / 60) * 10) / 10
}

// Mirrors the SleepStatus logic for the sleep branch
function sleepStatusType(time) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (h >= 2 && h < 18)   return 'very-late'
  if (h === 0 || h === 1)  return 'penalty'
  if (h === 23 && m > 30)  return 'partial'
  if (h >= 22)             return 'full'
  return null
}

// handleSave: save date = scoreDate directly (no auto-detection needed)
function handleSaveDate(scoreDate) {
  return scoreDate  // scoreDate IS the storage date (wake-up date convention)
}

// Timer: logDate = wake-up date = format(new Date(now), 'yyyy-MM-dd')
function timerLogDate(wakeUpMs) {
  return format(new Date(wakeUpMs), 'yyyy-MM-dd')
}

// ── Default weights used in most tests ───────────────────────────────────────

const W = {
  sleep: { sleep_before_1130: 10, seven_plus_hours: 12, wake_by_7: 8 },
  sleep_max: 30,
  penalties: { sleep_after_midnight: -8 },
}

// ── calcHours ────────────────────────────────────────────────────────────────

describe('calcHours', () => {
  it('same-night: 23:00 → 07:00 = 8h', () => {
    expect(calcHours('23:00', '07:00')).toBe(8)
  })
  it('cross-midnight: 23:30 → 06:30 = 7h', () => {
    expect(calcHours('23:30', '06:30')).toBe(7)
  })
  it('late sleep: 01:00 → 09:00 = 8h', () => {
    expect(calcHours('01:00', '09:00')).toBe(8)
  })
  it('early evening: 22:00 → 06:00 = 8h', () => {
    expect(calcHours('22:00', '06:00')).toBe(8)
  })
  it('very short: 00:00 → 00:30 = 0.5h', () => {
    expect(calcHours('00:00', '00:30')).toBe(0.5)
  })
  it('returns 0 when either time missing', () => {
    expect(calcHours('', '07:00')).toBe(0)
    expect(calcHours('23:00', '')).toBe(0)
  })
  it('wake <= sleep (next day assumed): 23:00 → 05:00 = 6h', () => {
    expect(calcHours('23:00', '05:00')).toBe(6)
  })
})

// ── calcSleepScore ───────────────────────────────────────────────────────────

describe('calcSleepScore', () => {
  it('ideal: slept 22:30, 8h, woke 06:30 → full pts (30)', () => {
    const s = calcSleepScore({ sleep_time: '22:30', sleep_hours: 8, wake_time: '06:30' }, W)
    expect(s).toBe(30)
  })

  it('on time at 23:00, 7h, woke 06:00 → 10 + 12 + 8 = 30', () => {
    const s = calcSleepScore({ sleep_time: '23:00', sleep_hours: 7, wake_time: '06:00' }, W)
    expect(s).toBe(30)
  })

  it('partial timing at 23:45, 7h → 5 + 12 + 8 = 25', () => {
    const s = calcSleepScore({ sleep_time: '23:45', sleep_hours: 7, wake_time: '06:30' }, W)
    expect(s).toBe(25)
  })

  it('after midnight 00:30 → 0 timing pts, no penalty from score fn (penalty in computeScore)', () => {
    const s = calcSleepScore({ sleep_time: '00:30', sleep_hours: 7, wake_time: '07:30' }, W)
    // 0 (timing) + 12 (hours) + 8 (wake) = 20
    expect(s).toBe(20)
  })

  it('short sleep 6h → half hours pts', () => {
    const s = calcSleepScore({ sleep_time: '23:00', sleep_hours: 6, wake_time: '05:00' }, W)
    // 10 + 6 + 8 = 24
    expect(s).toBe(24)
  })

  it('very short sleep 5h → 20% hours pts', () => {
    const s = calcSleepScore({ sleep_time: '23:00', sleep_hours: 5, wake_time: '04:00' }, W)
    // 10 + 2.4 + 0 (wake 04:00 < 08:00 so full wake pts? actually h=4 < 8 → full 8)
    // 10 + 2.4 + 8 = 20.4
    expect(s).toBeCloseTo(20.4, 1)
  })

  it('late wake 09:00 → quarter pts', () => {
    const s = calcSleepScore({ sleep_time: '23:00', sleep_hours: 7, wake_time: '09:00' }, W)
    // 10 + 12 + 2 = 24
    expect(s).toBe(24)
  })

  it('very late wake 10:00 → 0 wake pts', () => {
    const s = calcSleepScore({ sleep_time: '23:00', sleep_hours: 7, wake_time: '10:00' }, W)
    // 10 + 12 + 0 = 22
    expect(s).toBe(22)
  })

  it('screen time deduction reduces effective hours: 7h total - 1h screen = 6h effective', () => {
    const s = calcSleepScore(
      { sleep_time: '23:00', sleep_hours: 7, screen_time_hours: 1, wake_time: '06:00' }, W
    )
    // effective = 6h → half pts (6) instead of 12
    // 10 + 6 + 8 = 24
    expect(s).toBe(24)
  })

  it('returns 0 for null sleep', () => {
    expect(calcSleepScore(null, W)).toBe(0)
  })
})

// ── sleep_after_midnight penalty (computeScore) ──────────────────────────────

describe('midnight penalty (h <= 5 now includes h=2,3,4,5)', () => {
  const DIET = null, WORKOUT = null

  it('sleep at 00:00 gets penalty', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '00:00', sleep_hours: 7, wake_time: '07:00' }, W)
    // rawSleep = 0 + 12 + 8 = 20; penalty = -8; sleepScore = max(0, 12) = 12
    expect(r.sleepScore).toBe(12)
  })

  it('sleep at 01:00 gets penalty', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '01:00', sleep_hours: 7, wake_time: '08:00' }, W)
    // rawSleep = 0 + 12 + 8 = 20; penalty = -8; = 12
    expect(r.sleepScore).toBe(12)
  })

  it('sleep at 02:00 gets penalty (BUG FIX: was not penalized before)', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '02:00', sleep_hours: 7, wake_time: '09:00' }, W)
    // rawSleep = 0 + 12 + 2 = 14; penalty = -8; = 6
    expect(r.sleepScore).toBe(6)
  })

  it('sleep at 03:00 gets penalty', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '03:00', sleep_hours: 6, wake_time: '09:00' }, W)
    // rawSleep = 0 + 6 + 2 = 8; penalty = -8; = max(0, 0) = 0
    expect(r.sleepScore).toBe(0)
  })

  it('sleep at 05:00 gets penalty', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '05:00', sleep_hours: 3, wake_time: '08:00' }, W)
    // rawSleep = 0 + 0 + 8 = 8; penalty = -8; = 0
    expect(r.sleepScore).toBe(0)
  })

  it('sleep at 22:00 does NOT get penalty', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '22:00', sleep_hours: 8, wake_time: '06:00' }, W)
    // rawSleep = 10 + 12 + 8 = 30; penalty = 0
    expect(r.sleepScore).toBe(30)
  })

  it('penalty never pushes sleepScore below 0', () => {
    const r = computeScore(DIET, WORKOUT, { sleep_time: '00:30', sleep_hours: 3, wake_time: '03:30' }, W)
    expect(r.sleepScore).toBeGreaterThanOrEqual(0)
  })
})

// ── SleepStatus logic ────────────────────────────────────────────────────────

describe('SleepStatus feedback (sleep type)', () => {
  it('22:00 → full', ()   => expect(sleepStatusType('22:00')).toBe('full'))
  it('23:00 → full', ()   => expect(sleepStatusType('23:00')).toBe('full'))
  it('23:30 → full', ()   => expect(sleepStatusType('23:30')).toBe('full'))
  it('23:45 → partial', ()=> expect(sleepStatusType('23:45')).toBe('partial'))
  it('00:00 → penalty', ()=> expect(sleepStatusType('00:00')).toBe('penalty'))
  it('01:30 → penalty', ()=> expect(sleepStatusType('01:30')).toBe('penalty'))
  it('02:00 → very-late (BUG FIX: was null before)', () => expect(sleepStatusType('02:00')).toBe('very-late'))
  it('03:30 → very-late', ()=> expect(sleepStatusType('03:30')).toBe('very-late'))
  it('05:00 → very-late', ()=> expect(sleepStatusType('05:00')).toBe('very-late'))
  it('null → null', ()    => expect(sleepStatusType(null)).toBeNull())
})

// ── handleSave: scoreDate is the storage date directly (wake-up date convention) ──

describe('handleSave: scoreDate = storage date', () => {
  const today = '2026-05-09'
  const yesterday = '2026-05-08'

  it('scoreDate=today → saves under today', () => {
    expect(handleSaveDate(today)).toBe(today)
  })
  it('scoreDate=yesterday → saves under yesterday', () => {
    expect(handleSaveDate(yesterday)).toBe(yesterday)
  })
})

// ── Timer logDate (wake-up date = today) ─────────────────────────────────────

describe('timer logDate (wake-up date convention)', () => {
  const makeTs = (dateStr, h, m = 0) => new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime()

  it('woke up 2026-05-09 at any time → logDate = 2026-05-09', () => {
    expect(timerLogDate(makeTs('2026-05-09', 7, 0))).toBe('2026-05-09')
  })
  it('woke up at midnight → logDate = that date', () => {
    expect(timerLogDate(makeTs('2026-05-09', 0, 5))).toBe('2026-05-09')
  })
})
