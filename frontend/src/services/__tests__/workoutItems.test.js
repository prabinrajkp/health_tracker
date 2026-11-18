import { describe, it, expect } from 'vitest'
import {
  parseChunk, itemsFromText, matchExercise, itemsKcal, summarise, itemsOf, withEntry, liftHistory, isNewBest, copyItems,
} from '../workoutItems'
import { EXERCISE_BY_ID, EXERCISES } from '../exerciseLibrary'
import { exerciseKcal, estimateBurn } from '../energy'
import { calcWorkoutScore } from '../scoring'
import { parseExerciseMapping, exerciseMappingPrompt } from '../llmApi'
import { DEFAULT_WEIGHTS } from '../db'

const one = (text) => itemsFromText(text)[0]

describe('reading free text', () => {
  it.each([
    ['bench 3x10 5kg', 'bench_press', { sets: 3, reps: 10, kg: 5 }],
    ['BP 3*10*5', 'bench_press', { sets: 3, reps: 10, kg: 5 }],
    ['3 sets of 12 squats 40 kg', 'squat', { sets: 3, reps: 12, kg: 40 }],
    ['curls 3x12 @ 12.5', 'bicep_curl', { sets: 3, reps: 12, kg: 12.5 }],
    ['deadlift 1x5 225 lbs', 'deadlift', { sets: 1, reps: 5, kg: 102.1 }],
    ['run 5k 28 min', 'running', { km: 5, minutes: 28 }],
    ['yoga 1hr', 'yoga', { minutes: 60 }],
    ['spin class 45', 'cycling_indoor', { minutes: 45 }],
    ['cricket nets 1.5 hrs', 'cricket', { minutes: 90 }],
    ['10 pushups', 'push_up', { reps: 10 }],
    ['benchpres 3x8 50kg', 'bench_press', { sets: 3, reps: 8, kg: 50 }],
    ['football', 'football', {}],
  ])('%s', (text, library, fields) => {
    const item = one(text)
    expect(item.library).toBe(library)
    expect(item).toMatchObject(fields)
  })

  it('reads effort words', () => {
    expect(one('hard hiit 25 minutes')).toMatchObject({ library: 'circuit', effort: 'hard', minutes: 25 })
    expect(one('easy cycling 30 min').effort).toBe('normal')
  })

  it('splits a whole workout, with a heading as the session', () => {
    const items = itemsFromText('gym 50 min: bench 3x10 60kg, squats 3x8 80kg, deadlift 1x5 100kg')
    expect(items.map(i => i.library)).toEqual(['gym', 'bench_press', 'squat', 'deadlift'])
    expect(items[0].minutes).toBe(50)
  })

  it('leaves an unknown name unmatched rather than guessing', () => {
    const item = one('kalari 40 min')
    expect(item.library).toBeNull()
    expect(item.kind).toBe('unknown')
  })

  it('uses names the user or the AI taught it', () => {
    expect(matchExercise('kalari', { kalari: 'martial_arts' }).id).toBe('martial_arts')
  })

  it('estimates time from sets and distance, and says so', () => {
    expect(one('bench 4x8 40kg')).toMatchObject({ minutes: 8, minutesEstimated: true })
    expect(one('swim 1 km')).toMatchObject({ minutes: 24, minutesEstimated: true })
    expect(one('cycling 20 min')).toMatchObject({ minutes: 20, minutesEstimated: false })
  })

  it('keeps a lone number until the exercise is chosen', () => {
    const unknown = one('kalari 40')
    expect(withEntry(unknown, EXERCISE_BY_ID.martial_arts)).toMatchObject({ minutes: 40, minutesEstimated: false })
    expect(withEntry(one('zzlift 12'), EXERCISE_BY_ID.squat)).toMatchObject({ reps: 12 })
  })

  it('ignores filler without crashing', () => {
    expect(parseChunk('did 3 sets of 10 reps at 20 kg')).toMatchObject({ sets: 3, reps: 10, kg: 20 })
    expect(itemsFromText('  ,, ')).toEqual([])
  })
})

describe('calories', () => {
  const kg = 70

  it('are the same every time for the same row', () => {
    const items = itemsFromText('cycling 30 min')
    expect(itemsKcal(items, { kg }).total).toBe(itemsKcal(items, { kg }).total)
    expect(Math.round(itemsKcal(items, { kg }).total)).toBe(Math.round((6.8 - 1) * kg * 0.5))
  })

  it('come from time and effort, not the weight lifted', () => {
    const light = itemsKcal(itemsFromText('bench 3x10 5kg'), { kg }).total
    const heavy = itemsKcal(itemsFromText('bench 3x10 80kg'), { kg }).total
    expect(light).toBe(heavy)
  })

  it('count lifts inside a session once, as part of the session', () => {
    const session = itemsFromText('gym 50 min: bench 3x10 60kg, squats 3x8 80kg')
    expect(Math.round(itemsKcal(session, { kg }).total)).toBe(Math.round((5 - 1) * kg * (50 / 60)))
    expect(summarise(session).exercise_duration_minutes).toBe(50)
  })

  it('take out what the steps already counted for walks and runs', () => {
    const walk = itemsFromText('walking 30 min')
    const noSteps = itemsKcal(walk, { kg, heightCm: 175, steps: 0 }).total
    const withSteps = itemsKcal(walk, { kg, heightCm: 175, steps: 12000 }).total
    expect(withSteps).toBeLessThan(noSteps * 0.2)
    const run = itemsFromText('run 30 min')
    const runWithSteps = itemsKcal(run, { kg, heightCm: 175, steps: 12000 }).total
    expect(runWithSteps).toBeGreaterThan(0)
    expect(runWithSteps).toBeLessThan(itemsKcal(run, { kg, steps: 0 }).total)
  })

  it('leave a day logged the old way exactly as before', () => {
    const old = { exercise_done: true, exercise_type: 'Gym', exercise_duration_minutes: 45, exercise_intensity: 'hard', steps: 8000 }
    expect(exerciseKcal(old, kg)).toBe((6 - 1) * kg * 0.75)
  })

  it('give way to device calories', () => {
    const workout = { workout_items: itemsFromText('cycling 30 min'), active_kcal: 210, steps: 0 }
    const burn = estimateBurn({ dietetics: { bmr: 1600, pac: 1.4, heightCm: 175, weightKg: kg }, workout, useDevice: true })
    expect(burn.exercise).toBe(210)
  })
})

describe('the old fields, for everything else that reads them', () => {
  it('follow the list', () => {
    const items = itemsFromText('badminton 40 min hard, stretching 10 min')
    expect(summarise(items)).toEqual({ exercise_done: true, exercise_type: 'Badminton', exercise_duration_minutes: 50, exercise_intensity: 'hard' })
    expect(summarise([])).toMatchObject({ exercise_done: false, exercise_duration_minutes: 0 })
  })

  it('score the same as the old single session', () => {
    const old = { exercise_done: true, exercise_type: 'Gym', exercise_duration_minutes: 45, steps: 0 }
    const asList = { steps: 0, ...summarise(itemsOf(old)) }
    expect(calcWorkoutScore(asList, DEFAULT_WEIGHTS)).toBe(calcWorkoutScore(old, DEFAULT_WEIGHTS))
  })

  it('do not count an unrecognised name', () => {
    expect(summarise(itemsFromText('kalari 60 min')).exercise_done).toBe(false)
  })

  it('read an old day as one item', () => {
    expect(itemsOf({ exercise_done: true, exercise_type: 'Cycling', exercise_duration_minutes: 30 })[0]).toMatchObject({ library: 'cycling', minutes: 30 })
    expect(itemsOf({ exercise_done: false })).toEqual([])
  })
})

describe('the AI only names exercises', () => {
  const ids = new Set(EXERCISES.map(e => e.id))

  it('keeps ids from the library and drops anything else', () => {
    const reply = '[{"text":"kalari","library":"martial_arts","effort":"normal","kcal":900},{"text":"zoomba","library":"made_up"}]'
    expect(parseExerciseMapping(reply, ['kalari', 'zoomba'], ids)).toEqual({ kalari: { library: 'martial_arts', effort: 'normal' } })
  })

  it('survives a reply that is not JSON', () => {
    expect(parseExerciseMapping('sorry, I cannot help', ['kalari'], ids)).toEqual({})
  })

  it('sends only the names and the list: no numbers, so no weight, age or targets', () => {
    const prompt = exerciseMappingPrompt(['kalari'], EXERCISES)
    expect(prompt).toContain('kalari')
    expect(prompt).not.toMatch(/\d/)
  })
})

describe('lifting progress', () => {
  const logs = [
    { date: '2026-11-10', workout_items: [{ library: 'bench_press', sets: 3, reps: 10, kg: 40 }] },
    { date: '2026-11-14', workout_items: [{ library: 'bench_press', sets: 3, reps: 8, kg: 45 }] },
  ]

  it('finds the last session and the best set', () => {
    const h = liftHistory(logs, 'bench_press')
    expect(h.last).toMatchObject({ date: '2026-11-14', kg: 45 })
    expect(h.best).toMatchObject({ kg: 45, reps: 8 })
  })

  it('knows a new best', () => {
    const { best } = liftHistory(logs, 'bench_press')
    expect(isNewBest({ kg: 47.5, reps: 5 }, best)).toBe(true)
    expect(isNewBest({ kg: 45, reps: 9 }, best)).toBe(true)
    expect(isNewBest({ kg: 45, reps: 8 }, best)).toBe(false)
  })

  it('repeats a session with fresh ids, leaving out unknown names', () => {
    const items = itemsFromText('bench 3x10 40kg, kalari 20 min')
    const again = copyItems(items)
    expect(again).toHaveLength(1)
    expect(again[0].id).not.toBe(items[0].id)
  })
})
