import { describe, expect, it } from 'vitest'

import {
  burnMix,
  finishBoil,
  finishStir,
  pourTray,
  retryBurnt,
  startFreshBatch
} from './kitchen'
import { cloudiness } from './quality'
import { createEconomy, createGameState } from './state'
import { MESS, WASH } from './tuning'
import type { GameState } from './types'
import {
  bowlCleanliness,
  bowlsDirty,
  sinkStrokesLeft,
  sinkTarget,
  washStroke,
  type WashEvent
} from './wash'

const SLOW = 600

function setup() {
  const state = createGameState()
  const { stock } = createEconomy()
  stock.add('gelatin', 10)
  return { state, stock }
}

/** Scrubs `n` strokes at `speed`, returning every event. */
function scrub(state: GameState, n: number, speed = SLOW): WashEvent[] {
  const events: WashEvent[] = []
  for (let i = 0; i < n; i++)
    events.push(...washStroke(state, speed, false, true))
  return events
}

/** Boils, stirs and pours a batch with average scores, and returns its first mould. */
function makeBatch(state: GameState, stock: ReturnType<typeof setup>['stock']) {
  startFreshBatch(state, stock)
  finishBoil(state.mix!, 0.75)
  finishStir(state, 0.8, state.simMs)
  pourTray(state, [0.8, 0.8, 0.8, 0.8])
  const mould = state.tray!.moulds[0]!
  state.tray = null
  return mould
}

describe('washing the bowl', () => {
  it('gets dirty with every stir, so the next batch is cloudy and weaker', () => {
    const { state, stock } = setup()
    const clean = makeBatch(state, stock)
    expect(bowlsDirty(state)).toBe(true)
    const dirty = makeBatch(state, stock)
    expect(cloudiness(clean.make)).toBe(0)
    expect(cloudiness(dirty.make)).toBe(1)
    expect(dirty.q / clean.q).toBeCloseTo(0.6, 2)
  })

  it('takes 10 strokes, and half a wash makes half-clean jelly', () => {
    const { state, stock } = setup()
    makeBatch(state, stock)
    expect(sinkStrokesLeft(state)).toBe(WASH.bowlStrokes)
    const half = scrub(state, 5)
    expect(half.at(-1)).toEqual({ type: 'bowl', index: 0, left: 5 })
    expect(bowlCleanliness(state)).toBeCloseTo(0.5)
    expect(makeBatch(state, stock).make.bowlClean).toBeCloseTo(0.5)
    expect(scrub(state, 10).slice(-2)).toEqual([
      { type: 'bowl-clean', index: 0 },
      { type: 'done' }
    ])
    expect(state.bowls).toEqual([1])
    expect(scrub(state, 1)).toEqual([])
  })

  it('waits while the bowl holds the mix', () => {
    const { state, stock } = setup()
    makeBatch(state, stock)
    startFreshBatch(state, stock)
    expect(sinkTarget(state)).toEqual({ kind: 'bowl', index: 0 })
    finishBoil(state.mix!, 0.75)
    expect(sinkTarget(state)).toBeNull()
    expect(scrub(state, 3)).toEqual([])
  })

  it('takes 20 strokes for two bowls, and scores their average', () => {
    const { state } = setup()
    state.bowls = [0, 0]
    expect(sinkStrokesLeft(state)).toBe(2 * WASH.bowlStrokes)
    scrub(state, WASH.bowlStrokes)
    expect(state.bowls).toEqual([1, 0])
    expect(bowlCleanliness(state)).toBeCloseTo(0.5)
  })
})

describe('a burnt pot', () => {
  it('needs 6 strokes on top of the bowl, scrubbed first', () => {
    const { state, stock } = setup()
    makeBatch(state, stock)
    startFreshBatch(state, stock)
    burnMix(state, stock)
    expect(state.potScrubs).toBe(WASH.potStrokes)
    // The pot is on the stove: the sink washes the bowl meanwhile.
    expect(sinkTarget(state)).toEqual({ kind: 'bowl', index: 0 })
    expect(sinkStrokesLeft(state)).toBe(WASH.bowlStrokes)
    state.mix = null
    expect(sinkStrokesLeft(state)).toBe(WASH.potStrokes + WASH.bowlStrokes)
    const pot = scrub(state, WASH.potStrokes)
    expect(pot.at(-1)).toEqual({ type: 'pot-clean' })
    expect(state.bowls).toEqual([0])
    expect(scrub(state, WASH.bowlStrokes).at(-1)).toEqual({ type: 'done' })
  })

  it('adds 6 more strokes with each burn', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    burnMix(state, stock)
    retryBurnt(state, stock)
    burnMix(state, stock)
    expect(state.potScrubs).toBe(2 * WASH.potStrokes)
  })
})

describe('scrubbing too fast', () => {
  it('flings suds once per press, and the stroke still counts', () => {
    const { state } = setup()
    state.bowls = [0]
    const fast = MESS.rubLimit + 100
    expect(washStroke(state, fast, false, true)).toEqual([
      { type: 'suds' },
      { type: 'bowl', index: 0, left: 9 }
    ])
    expect(washStroke(state, fast, false, false)).toEqual([
      { type: 'bowl', index: 0, left: 8 }
    ])
  })

  it('allows faster scrubbing in Assist Mode', () => {
    const { state } = setup()
    state.bowls = [0]
    const events = washStroke(state, MESS.rubLimit + 100, true, true)
    expect(events.some(e => e.type === 'suds')).toBe(false)
    expect(washStroke(state, MESS.assistRubLimit + 100, true, true)[0]).toEqual(
      { type: 'suds' }
    )
  })
})
