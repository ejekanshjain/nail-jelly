import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { WallSim } from './sim/wallSim'
import { addStoolBlock, createGameState } from './state'
import {
  currentTip,
  lessonRip,
  nextTip,
  scriptedSagBlock,
  scriptedSagGrip,
  showTip,
  TIPS,
  watchLesson
} from './tutorial'
import { TUTORIAL } from './tuning'
import type { GameState } from './types'
import { blockNailLevelFor } from './warnings'

const STEP = 1000 / 60

/** Section 1 with one block per cell in `cells`, nailed at the given particles. */
function wall(cells: number[], particles: number[]) {
  const state = createGameState()
  state.phase = 'play'
  const sim = new WallSim(state, rng(4))
  const ids = cells.map(cell => {
    const block = addStoolBlock(state, 0.83, 'lime')
    sim.place(block.id, cell)
    for (const p of particles) sim.hammer(block.id, p, 0.69)
    return block.id
  })
  return { state, sim, ids }
}

function step(state: GameState, sim: WallSim): void {
  state.simMs += STEP
  sim.update(STEP)
}

describe('first-time tips', () => {
  it('show once each, over the room hint, for a few seconds', () => {
    const { tutorial } = createGameState()
    expect(showTip(tutorial, 'first-pay', 1000)).toBe(true)
    expect(currentTip(tutorial, 1000)).toBe(TIPS['first-pay'])
    expect(currentTip(tutorial, 1000 + TUTORIAL.tipMs)).toBeNull()
    expect(showTip(tutorial, 'first-pay', 50_000)).toBe(false)
    expect(currentTip(tutorial, 50_000)).toBeNull()
  })

  it('wait their turn behind the tip showing now', () => {
    const { tutorial } = createGameState()
    showTip(tutorial, 'lesson', 0)
    expect(showTip(tutorial, 'first-splat', 1000)).toBe(false)
    expect(currentTip(tutorial, 1000)).toBe(TIPS.lesson)
    expect(nextTip(tutorial, 2000)).toBe(false)
    expect(nextTip(tutorial, TUTORIAL.tipMs)).toBe(true)
    expect(currentTip(tutorial, TUTORIAL.tipMs)).toBe(TIPS['first-splat'])
  })

  it('has words for every tip, each one short', () => {
    for (const text of Object.values(TIPS)) {
      expect(text.length).toBeGreaterThan(10)
      for (const sentence of text.split('. '))
        expect(sentence.split(' ').length).toBeLessThan(20)
    }
  })
})

describe('the single-nail lesson', () => {
  it('rips the first block left on one nail 9s after it bites', () => {
    const { state, sim, ids } = wall([5], [0])
    const tutorial = state.tutorial
    watchLesson(state, tutorial, ids[0]!)
    let rippedAt = -1
    while (state.simMs < 15_000 && rippedAt < 0) {
      step(state, sim)
      const block = lessonRip(state, tutorial)
      if (block) {
        block.cause = 'one-nail'
        sim.sag(1, block.id)
        rippedAt = state.simMs
      }
    }
    expect(rippedAt).toBeGreaterThanOrEqual(8000)
    expect(rippedAt).toBeLessThanOrEqual(10_000)
    const block = state.blocks.get(ids[0]!)!
    expect(block.status).toBe('falling')
    expect(block.cause).toBe('one-nail')
  })

  it('lets a block with a second nail off, and watches only one block', () => {
    const { state, sim, ids } = wall([5, 6], [0])
    const tutorial = state.tutorial
    watchLesson(state, tutorial, ids[0]!)
    watchLesson(state, tutorial, ids[1]!)
    expect(tutorial.lessonBlock).toBe(ids[0])
    sim.hammer(ids[0]!, 3, 0.69)
    state.simMs += 20_000
    expect(lessonRip(state, tutorial)).toBeNull()
    expect(tutorial.lessonBlock).toBeNull()
  })

  it('never runs after section 1', () => {
    const { state, ids } = wall([5], [0])
    state.section = 1
    watchLesson(state, state.tutorial, ids[0]!)
    expect(state.tutorial.lessonBlock).toBeNull()
  })
})

describe('the scripted sag', () => {
  it('slips one healthy two-nail block past its red line once the tray sets', () => {
    const { state, ids } = wall([4, 5], [0, 3])
    expect(scriptedSagBlock(state, state.tutorial, 1)).toBeNull()
    state.fridge = {
      id: 'fridge',
      label: 'Jelly setting',
      startedAt: 0,
      endsAt: 60_000,
      durationMs: 60_000
    }
    expect(scriptedSagBlock(state, state.tutorial, 0.2)).toBeNull()
    const block = scriptedSagBlock(state, state.tutorial, 0.5)!
    expect(ids).toContain(block.id)
    const grip = scriptedSagGrip(block)
    expect(blockNailLevelFor(block, grip)).toBe('red')
    state.section = 1
    expect(scriptedSagBlock(state, state.tutorial, 1)).toBeNull()
  })
})
