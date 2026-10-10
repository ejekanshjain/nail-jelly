import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { decayPerSecond } from './grip'
import {
  createScrewJob,
  screwCircle,
  screwGrip,
  type ScrewEvent
} from './screw'
import { WallSim } from './sim/wallSim'
import { addStoolBlock, createGameState } from './state'
import { BLOCK_SPRINGS, SCREW } from './tuning'

/** Completes circles every `gapMs`, returning every event. */
function circles(gaps: number[], assist = false): ScrewEvent[] {
  const job = createScrewJob(0)
  let t = 0
  const events: ScrewEvent[] = []
  for (const gap of gaps) {
    t += gap
    events.push(...screwCircle(job, t, assist))
  }
  return events
}

describe('turning a screw', () => {
  it('goes home after 4 slow circles with no strips', () => {
    const events = circles([900, 800, 700, 650])
    expect(events.filter(e => e === 'turn')).toHaveLength(4)
    expect(events).not.toContain('strip')
    expect(events.at(-1)).toBe('done')
    expect(circles([900, 800, 700, 650, 900])).toHaveLength(5)
  })

  it('strips the jelly on a circle under 0.6s, or 0.45s in Assist', () => {
    expect(
      circles([700, 550, 700, 700]).filter(e => e === 'strip')
    ).toHaveLength(1)
    expect(circles([700, 500, 700, 700], true)).not.toContain('strip')
    expect(
      circles([400, 400, 400, 400], true).filter(e => e === 'strip')
    ).toHaveLength(4)
  })

  it('grips 0.6 + 0.4 x evenness, less 0.15 per strip', () => {
    expect(screwGrip(1, 0)).toBeCloseTo(1)
    expect(screwGrip(0.75, 0)).toBeCloseTo(0.9)
    expect(screwGrip(0.75, 2)).toBeCloseTo(0.6)
    // Stripped to bits, it still bites a little instead of ripping out at once.
    expect(screwGrip(0, 4)).toBeGreaterThan(0.12)
  })
})

describe('a screw in the wall', () => {
  it('pins the block as a screw, and each strip tears 2 springs', () => {
    const state = createGameState()
    state.section = 1
    const sim = new WallSim(state, rng(5))
    const block = addStoolBlock(state, 0.83, 'lime')
    sim.place(block.id, 5)
    expect(sim.strip(block.id, 0)).toBe(SCREW.stripTears)
    const fixing = sim.screw(block.id, 0, 0.75, 1)
    expect(fixing).toMatchObject({ kind: 'screw', grip: 0.75 })
    expect(block.status).toBe('up')
    expect(sim.handBlock).toBeNull()
    expect(block.holes).toBe(1)
    const springs = sim.bodyOf(block.id)!.soft.constraints.length
    expect(BLOCK_SPRINGS - springs).toBe(SCREW.stripTears)
  })

  it('decays at the screw rate: 0.8 times a nail', () => {
    const state = createGameState()
    state.section = 1
    const sim = new WallSim(state, rng(5))
    const block = addStoolBlock(state, 0.83, 'grape')
    sim.place(block.id, 6)
    sim.screw(block.id, 0, 1, 0)
    for (let i = 0; i < 600; i++) {
      state.simMs += 1000 / 60
      sim.update(1000 / 60)
    }
    const inputs = {
      q: 0.83,
      fixings: 1,
      residue: 0,
      heat: 'none',
      mesh: 0,
      fly: false,
      holes: 1,
      integrity: 1,
      section: 1
    } as const
    const lost = 1 - block.fixings[0]!.grip
    expect(lost).toBeCloseTo(decayPerSecond({ ...inputs, screw: true }) * 10, 4)
    expect(decayPerSecond({ ...inputs, screw: true })).toBeCloseTo(
      0.8 * decayPerSecond({ ...inputs, screw: false })
    )
  })
})
