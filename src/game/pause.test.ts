import { describe, expect, it } from 'vitest'

import { rng, startTimer } from '../shared'
import { decayPerSecond } from './grip'
import { hiddenCatchUpMs, PauseClock, shiftTimer } from './pause'
import { WallSim } from './sim/wallSim'
import { addStoolBlock, createGameState } from './state'
import { HIDDEN_CATCH_UP_MS } from './tuning'

describe('dialog pauses', () => {
  it('push a wait later by exactly the paused time', () => {
    const clock = new PauseClock()
    const fridge = startTimer('Jelly setting', 60_000, 1_000)
    expect(clock.step(false, 5_000)).toBe(0)
    expect(clock.step(true, 6_000)).toBe(0)
    expect(clock.paused).toBe(true)
    expect(clock.step(true, 20_000)).toBe(0)
    const pausedMs = clock.step(false, 21_000)
    expect(pausedMs).toBe(15_000)
    const shifted = shiftTimer(fridge, pausedMs)
    expect(shifted.endsAt - fridge.endsAt).toBe(15_000)
    expect(shifted.durationMs).toBe(fridge.durationMs)
  })

  it('count time hidden behind an open dialog as dialog time, not grip loss', () => {
    const clock = new PauseClock()
    clock.step(true, 1_000)
    clock.hide(2_000)
    expect(clock.show(50_000)).toBe(0)
    expect(clock.step(false, 51_000)).toBe(50_000)
  })
})

describe('hidden tabs', () => {
  it('turn at most two minutes of absence into grip loss', () => {
    const clock = new PauseClock()
    clock.hide(0)
    expect(clock.show(30_000)).toBe(30_000)
    clock.hide(100_000)
    expect(clock.show(100_000 + 10 * 60_000)).toBe(HIDDEN_CATCH_UP_MS)
    expect(hiddenCatchUpMs(-5)).toBe(0)
  })

  it('apply decay without advancing holds, payouts or simulation time', () => {
    const state = createGameState()
    const wall = new WallSim(state, rng(5))
    const block = addStoolBlock(state, 0.6, 'grape')
    wall.place(block.id, 0)
    wall.hammer(block.id, 0, 0.69)
    wall.hammer(block.id, 3, 0.69)
    const section = state.sections[0]!
    section.holdActive = true
    section.holdLeftMs = 30_000
    const before = block.fixings.map(f => f.grip)
    const integrity = wall.bodyOf(block.id)!.soft.integrity()
    const simMs = state.simMs

    wall.catchUp(hiddenCatchUpMs(10 * 60_000))

    block.fixings.forEach((fixing, i) => {
      const rate = decayPerSecond({
        q: block.q,
        fixings: 2,
        residue: 0,
        heat: 'none',
        mesh: 0,
        screw: false,
        fly: false,
        holes: block.holes,
        integrity,
        section: 0
      })
      expect(fixing.grip).toBeCloseTo(before[i]! - rate * 120, 6)
    })
    expect(state.simMs).toBe(simMs)
    expect(section.holdLeftMs).toBe(30_000)
    expect(block.paid).toBe(false)
  })

  it('rips out nails that pass the rip-out line while you were away', () => {
    const state = createGameState()
    const wall = new WallSim(state, rng(6))
    const block = addStoolBlock(state, 0.5, 'lime')
    wall.place(block.id, 0)
    wall.hammer(block.id, 0, 0.69)
    block.fixings[0]!.grip = 0.15
    wall.catchUp(HIDDEN_CATCH_UP_MS)
    expect(block.fixings).toHaveLength(0)
    expect(block.status).toBe('falling')
    expect(wall.events.some(e => e.type === 'rip')).toBe(true)
  })
})
