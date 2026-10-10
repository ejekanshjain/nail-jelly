import { describe, expect, it } from 'vitest'

import { rng, startTimer } from '../shared'
import {
  roomStatus,
  saggingCount,
  startWipe,
  stepWipe,
  wipePosition
} from './rooms'
import { addSplat } from './mess'
import { WallSim } from './sim/wallSim'
import { addStoolBlock, createGameState } from './state'
import { SHOP_WALK_MS, WIPE_MS } from './tuning'

const STEP = 1000 / 60

/** Runs a wipe to the end and returns the step count at which it switched scenes. */
function run(from: 'wall' | 'shop', to: 'kitchen' | 'shop' | 'wall') {
  const wipe = startWipe(from, to)
  const switches: number[] = []
  let steps = 0
  for (;;) {
    const step = stepWipe(wipe, STEP)
    steps++
    if (step.switchNow) switches.push(steps)
    if (step.done) break
  }
  return { wipe, switches, steps }
}

describe('room wipes', () => {
  it('switches once, when the sheet covers the view', () => {
    const { wipe, switches, steps } = run('wall', 'kitchen')
    expect(switches).toHaveLength(1)
    expect(steps * STEP).toBeGreaterThanOrEqual(WIPE_MS - 0.01)
    expect(steps * STEP).toBeLessThan(WIPE_MS + STEP)
    expect(wipe.label).toBeNull()
    const half = startWipe('wall', 'kitchen')
    half.elapsedMs = WIPE_MS / 2
    expect(wipePosition(half)).toBe(1)
  })

  it('walks to and from the shop for longer, with a caption', () => {
    const there = run('wall', 'shop')
    expect(there.wipe.durationMs).toBe(SHOP_WALK_MS)
    expect(there.steps * STEP).toBeLessThan(SHOP_WALK_MS + STEP)
    expect(there.wipe.label).toBe('Walking to the shop…')
    expect(run('shop', 'wall').wipe.label).toBe('Walking back…')
    const mid = startWipe('wall', 'shop')
    mid.elapsedMs = SHOP_WALK_MS / 2
    expect(wipePosition(mid)).toBe(1)
    mid.elapsedMs = SHOP_WALK_MS
    expect(wipePosition(mid)).toBe(2)
  })
})

describe('nav status', () => {
  it('counts blocks up, then shows the hold countdown', () => {
    const state = createGameState()
    const wall = new WallSim(state, rng(3))
    const block = addStoolBlock(state, 0.8, 'lime')
    wall.place(block.id, 0)
    wall.hammer(block.id, 0, 0.69)
    expect(roomStatus(state, 'wall')).toBe('S1 1/12 up')
    state.sections[0]!.holdActive = true
    state.sections[0]!.holdLeftMs = 42_000
    expect(roomStatus(state, 'wall')).toBe('Hold 0:42')
  })

  it('counts the fridge down in the kitchen, then says Ready', () => {
    const state = createGameState()
    expect(roomStatus(state, 'kitchen', 0)).toBe('')
    state.fridge = startTimer('Jelly setting', 60_000, 0)
    expect(roomStatus(state, 'kitchen', 18_000)).toBe('Fridge 0:42')
    expect(roomStatus(state, 'kitchen', 60_000)).toBe('Ready!')
  })

  it('counts hallway splats only', () => {
    const state = createGameState()
    addSplat(state, 'wall', 0, 0, 30, 'lime', 1, true)
    expect(roomStatus(state, 'hallway')).toBe('')
    addSplat(state, 'hallway', 0, 0, 30, 'lime', 1, true)
    expect(roomStatus(state, 'hallway')).toBe('1 splat')
    addSplat(state, 'hallway', 0, 0, 30, 'lime', 1, true)
    expect(roomStatus(state, 'hallway')).toBe('2 splats')
  })

  it('counts a block as sagging once a nail passes its red line', () => {
    const state = createGameState()
    const wall = new WallSim(state, rng(4))
    const block = addStoolBlock(state, 0.8, 'lime')
    wall.place(block.id, 0)
    wall.hammer(block.id, 0, 0.69)
    wall.hammer(block.id, 3, 0.69)
    expect(saggingCount(state)).toBe(0)
    block.fixings[0]!.grip = 0.2
    expect(saggingCount(state)).toBe(1)
  })
})
