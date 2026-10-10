import { describe, expect, it } from 'vitest'

import { rng } from '../../shared'
import { slamImpact, TruckShake } from '../events'
import { addStoolBlock, createGameState } from '../state'
import { IMPULSE, RIP_OUT, SHOVE, TRUCK } from '../tuning'
import type { GameState } from '../types'
import { blockWarningLines } from '../warnings'
import { WallSim } from './wallSim'

const STEP = 1000 / 60

function run(state: GameState, sim: WallSim, ms: number, each?: () => void) {
  for (let t = 0; t < ms; t += STEP) {
    state.simMs += STEP
    sim.update(STEP)
    each?.()
  }
}

/**
 * One block in `section`, nailed with sweet hits at `particles`, every nail set just
 * above its orange line, the line the game promises survives every event in the section.
 */
function atOrange(section: number, q: number, particles: number[]) {
  const state = createGameState()
  state.section = section
  const sim = new WallSim(state, rng(5))
  const block = addStoolBlock(state, q, 'grape')
  sim.place(block.id, 5)
  for (const particle of particles) sim.hammer(block.id, particle, 0.69)
  run(state, sim, 500)
  const lines = blockWarningLines(block)
  for (const f of block.fixings) f.grip = lines.orange + 0.005
  return { state, sim, block, nails: block.fixings.length }
}

describe('events are fair', () => {
  const cases = [0.3, 0.6, 0.9].flatMap(q =>
    [[0], [0, 3]].map(particles => ({ q, particles }))
  )

  it('lets a nail just above its orange line survive a door slam', () => {
    for (const section of [1, 2]) {
      for (const { q, particles } of cases) {
        const { state, sim, block, nails } = atOrange(section, q, particles)
        slamImpact(state, sim, null)
        sim.shove(1, -0.35, SHOVE.slam)
        run(state, sim, 2000)
        const label = `S${section + 1} q ${q} x${nails}`
        expect(block.status, label).toBe('up')
        expect(block.fixings, label).toHaveLength(nails)
        expect(
          Math.min(...block.fixings.map(f => f.grip)),
          label
        ).toBeGreaterThan(RIP_OUT)
      }
    }
  })

  it('lets a nail just above its orange line survive a truck', () => {
    for (const { q, particles } of cases) {
      const { state, sim, block, nails } = atOrange(2, q, particles)
      const truck = new TruckShake(state, sim)
      let since = 0
      let side = 1
      run(state, sim, TRUCK.shakeMs + 1000, () => {
        since += STEP
        if (since < TRUCK.tickMs || truck.done) return
        since = 0
        side = -side
        truck.tick()
        sim.shove(side, 0.2, SHOVE.truck)
      })
      const label = `q ${q} x${nails}`
      expect(truck.done, label).toBe(true)
      expect(block.status, label).toBe('up')
      expect(block.fixings, label).toHaveLength(nails)
    }
  })

  it('takes exactly one impulse of grip in truck ticks', () => {
    const { state, sim, block } = atOrange(2, 0.6, [0, 3])
    const before = block.fixings.map(f => f.grip)
    const truck = new TruckShake(state, sim)
    while (!truck.done) truck.tick()
    const shaken = block.fixings.map(f => f.grip)
    // The same block hit by one truck-sized impulse ends at the same grip.
    const twin = atOrange(2, 0.6, [0, 3])
    for (const f of twin.block.fixings) f.grip = before[0]!
    twin.sim.impulse(twin.block.id, IMPULSE.truck, 'truck')
    expect(shaken[0]).toBeCloseTo(twin.block.fixings[0]!.grip, 6)
  })
})
