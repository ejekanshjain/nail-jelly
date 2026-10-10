import { describe, expect, it } from 'vitest'

import { rng } from '../../shared'
import { addStoolBlock, createGameState } from '../state'
import { BLOCK_SPRINGS } from '../tuning'
import type { GameState } from '../types'
import { blockWarningLines } from '../warnings'
import { tearNearest } from './blockBody'
import { WallSim } from './wallSim'

const STEP = 1000 / 60

/** A sim on section 2, so section 1's halved decay doesn't flatter the numbers. */
function setup(): { state: GameState; sim: WallSim } {
  const state = createGameState()
  state.section = 1
  return { state, sim: new WallSim(state, rng(3)) }
}

function run(state: GameState, sim: WallSim, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) {
    state.simMs += STEP
    sim.update(STEP)
  }
}

/** Places a block in `cell` and nails it with sweet hits at the given particles. */
function nailed(
  state: GameState,
  sim: WallSim,
  cell: number,
  particles: number[],
  q = 0.83
): number {
  const block = addStoolBlock(state, q, 'strawberry')
  expect(sim.place(block.id, cell)).toBe(true)
  for (const particle of particles) sim.hammer(block.id, particle, 0.69)
  return block.id
}

describe('WallSim', () => {
  it('holds a block on two sweet nails for 60s', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 5, [0, 3], 0.8)
    run(state, sim, 60)
    const block = state.blocks.get(id)!
    expect(block.status).toBe('up')
    expect(block.fixings).toHaveLength(2)
  })

  it('tears 1 or 2 springs with a sweet nail', () => {
    const { state, sim } = setup()
    const block = addStoolBlock(state, 0.83, 'lime')
    sim.place(block.id, 5)
    const outcome = sim.hammer(block.id, 0, 0.69)
    expect(outcome?.kind).toBe('sweet')
    const left = sim.bodyOf(block.id)!.soft.constraints.length
    expect(BLOCK_SPRINGS - left).toBeGreaterThanOrEqual(1)
    expect(BLOCK_SPRINGS - left).toBeLessThanOrEqual(2)
  })

  it('tears less and never splits a noodle block', () => {
    const { state, sim } = setup()
    const block = addStoolBlock(state, 0.4, 'lime')
    block.noodles = true
    sim.place(block.id, 5)
    expect(sim.hammer(block.id, 0, 0.69)?.kind).toBe('sweet')
    const springs = () => sim.bodyOf(block.id)!.soft.constraints.length
    expect(springs()).toBe(BLOCK_SPRINGS)
    const hard = sim.hammer(block.id, 3, 1)
    expect(hard?.kind).toBe('hard')
    expect(BLOCK_SPRINGS - springs()).toBe(1)
  })

  it('takes less grip off a meshed block in a slam, and half as much less when ragged', () => {
    const { state, sim } = setup()
    const ids = [0, 0.5, 1].map((mesh, i) => {
      const id = nailed(state, sim, i * 2, [0, 3])
      const block = state.blocks.get(id)!
      block.mesh = mesh
      for (const f of block.fixings) f.grip = 0.6
      sim.impulse(id, 0.35, 'slam')
      return 0.6 - block.fixings[0]!.grip
    })
    const [plain, ragged, clean] = ids as [number, number, number]
    expect(clean / plain).toBeCloseTo(1 / 1.2)
    expect(ragged / plain).toBeCloseTo(1 / 1.1)
  })

  it('lets a weak single nail rip out, then the block falls and splats', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 5, [1])
    sim.sag(0.875, id)
    run(state, sim, 5)
    const block = state.blocks.get(id)!
    expect(block.status).toBe('splatted')
    expect(block.cause).toBe('sag')
    expect(state.splats.length).toBeGreaterThan(0)
    expect(state.sections[1]!.cells[5]!.residue).toBe(1)
  })

  it('loses the whole block on a split', () => {
    const { state, sim } = setup()
    const block = addStoolBlock(state, 0.83, 'grape')
    sim.place(block.id, 5)
    expect(sim.hammer(block.id, 1, 1)?.kind).toBe('split')
    run(state, sim, 3)
    expect(state.blocks.get(block.id)!.status).toBe('splatted')
    expect(state.blocks.get(block.id)!.cause).toBe('split')
  })

  it('loses a block whose nail tore free of the rest', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 5, [0, 3])
    const body = sim.bodyOf(id)!
    // Tear every spring around both corner nails, as repeated hard hits would.
    for (const particle of [0, 3]) {
      const p = body.soft.bodies[particle]!.position
      tearNearest(body, p.x, p.y, 4)
    }
    run(state, sim, 3)
    expect(state.blocks.get(id)!.status).toBe('splatted')
    expect(state.blocks.get(id)!.cause).toBe('torn')
  })

  it('drops a block from a tired hand', () => {
    const { state, sim } = setup()
    const block = addStoolBlock(state, 0.83, 'orange')
    sim.place(block.id, 5)
    run(state, sim, 9)
    expect(state.blocks.get(block.id)!.cause).toBe('hand')
    expect(state.blocks.get(block.id)!.firstBiteMs).toBeNull()
  })

  it('steadies a block on one nail while you aim its second, until you let go', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 5, [0])
    const corner = () => sim.bodyOf(id)!.soft.bodies[3]!.position
    const start = { ...corner() }
    sim.steady(id, 3)
    run(state, sim, 1)
    expect(Math.hypot(corner().x - start.x, corner().y - start.y)).toBeLessThan(
      6
    )
    sim.letGo(id)
    run(state, sim, 1)
    expect(corner().y - start.y).toBeGreaterThan(30)
  })

  it('drops a steadied block whose last nail ripped once you let go', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 5, [0])
    sim.steady(id, 3)
    sim.sag(1, id)
    run(state, sim, 0.5)
    expect(state.blocks.get(id)!.status).toBe('up')
    sim.letGo(id)
    expect(state.blocks.get(id)!.status).toBe('falling')
  })

  it('knocks off a sagging block when the block above falls onto it', () => {
    const { state, sim } = setup()
    const lower = nailed(state, sim, 4, [0, 3])
    sim.sag(0.7, lower)
    const upper = addStoolBlock(state, 0.83, 'blueberry')
    sim.place(upper.id, 0)
    sim.drop(upper.id, 'hand')
    run(state, sim, 2.5)
    expect(state.blocks.get(lower)!.fixings).toHaveLength(0)
    expect(state.blocks.get(lower)!.cause).toBe('knock')
  })

  it('knocks loose a block below its orange line when the one above lands on it', () => {
    const { state, sim } = setup()
    const lower = nailed(state, sim, 4, [0, 3])
    const block = state.blocks.get(lower)!
    // Orange, not red: the old capped knock alone left a nail this worn standing.
    const lines = blockWarningLines(block)
    for (const f of block.fixings) f.grip = lines.orange - 0.03
    expect(lines.orange - 0.03).toBeGreaterThan(lines.red)
    const upper = addStoolBlock(state, 0.83, 'blueberry')
    sim.place(upper.id, 0)
    sim.drop(upper.id, 'hand')
    let loose = 0
    for (let i = 0; i < 150; i++) {
      run(state, sim, 1 / 60)
      for (const event of sim.events.splice(0))
        if (event.type === 'knock' && event.targetId === lower)
          loose += event.loose
    }
    expect(loose).toBe(2)
    expect(block.fixings).toHaveLength(0)
    expect(block.cause).toBe('knock')
  })

  it('keeps a block just above its orange line up when the one above lands on it', () => {
    const { state, sim } = setup()
    const lower = nailed(state, sim, 4, [0, 3])
    const block = state.blocks.get(lower)!
    const lines = blockWarningLines(block)
    for (const f of block.fixings) f.grip = lines.orange + 0.02
    const upper = addStoolBlock(state, 0.83, 'blueberry')
    sim.place(upper.id, 0)
    sim.drop(upper.id, 'hand')
    run(state, sim, 2.5)
    // The knock leaves it on red, a warning to re-hammer, but never knocks it loose.
    expect(block.status).toBe('up')
    expect(block.fixings).toHaveLength(2)
    for (const f of block.fixings) expect(f.grip).toBeLessThan(lines.red)
  })

  it('leaves a healthy block below standing when the one above falls', () => {
    const { state, sim } = setup()
    const lower = nailed(state, sim, 4, [0, 3])
    const upper = addStoolBlock(state, 0.83, 'blueberry')
    sim.place(upper.id, 0)
    sim.drop(upper.id, 'hand')
    run(state, sim, 2.5)
    expect(state.blocks.get(lower)!.status).toBe('up')
  })

  it('knocks a worn neighbour once per swinging spell, however long it swings', () => {
    const { state, sim } = setup()
    const neighbour = nailed(state, sim, 4, [0, 3])
    for (const f of state.blocks.get(neighbour)!.fixings) f.grip = 0.75
    nailed(state, sim, 5, [0])
    run(state, sim, 4)
    // Shaken every second for 10s, it keeps banging into the block beside it.
    for (let i = 0; i < 10; i++) {
      sim.shove(-1, -0.35, 3.5)
      run(state, sim, 1)
    }
    const block = state.blocks.get(neighbour)!
    expect(block.status).toBe('up')
    // At most one knock (KNOCK_MAX through the impulse formula: 0.11), plus 14s of decay.
    for (const fixing of block.fixings)
      expect(fixing.grip).toBeGreaterThan(0.55)
  })

  it('knocks off a sagging neighbour with a block left swinging on one nail', () => {
    const { state, sim } = setup()
    const neighbour = nailed(state, sim, 4, [0, 3])
    sim.sag(0.75, neighbour)
    // Nailed only at its top-left corner, it swings left into the neighbour. It knocks
    // nothing while you could still be aiming its second nail.
    nailed(state, sim, 5, [0])
    run(state, sim, 4)
    expect(state.blocks.get(neighbour)!.fixings).toHaveLength(2)
    // Left on one nail, a shake swings it into the neighbour.
    sim.shove(-1, -0.35, 3.5)
    run(state, sim, 3)
    expect(state.blocks.get(neighbour)!.fixings).toHaveLength(0)
  })

  it('removes a locked section from the engine', () => {
    const { state, sim } = setup()
    nailed(state, sim, 4, [0, 3])
    nailed(state, sim, 6, [0, 3])
    expect(sim.perf().particles).toBe(24)
    const snapshot = sim.lockSection(1)
    expect(snapshot).toHaveLength(2)
    expect(snapshot[0]!.positions).toHaveLength(24)
    expect(snapshot[0]!.fixings.map(f => f.particle)).toEqual([0, 3])
    expect(sim.perf()).toEqual({ blocks: 0, particles: 0, springs: 0 })
  })
})

describe('block quality on the wall', () => {
  /**
   * Minutes until the weaker of two sweet nails decays to grip 0.3, without physics, at
   * the base rate (no section factor).
   */
  function minutesTo03(q: number): number {
    const { state, sim } = setup()
    sim.conditions.sectionDecay = false
    const block = state.blocks.get(nailed(state, sim, 5, [0, 3], q))!
    let seconds = 0
    while (Math.min(...block.fixings.map(f => f.grip)) > 0.3) {
      sim.catchUp(1000)
      seconds++
    }
    return seconds / 60
  }

  it('takes dev blocks at q 0.2, 0.5 and 0.9 to grip 0.3 at the planned times', () => {
    // PLAN.md section 3: the shorter end is two extra tears, the longer end none.
    const low = minutesTo03(0.2)
    const mid = minutesTo03(0.5)
    const high = minutesTo03(0.9)
    expect(low).toBeGreaterThanOrEqual(2.85)
    expect(low).toBeLessThanOrEqual(3.3)
    expect(mid).toBeGreaterThanOrEqual(3.9)
    expect(mid).toBeLessThanOrEqual(4.45)
    expect(high).toBeGreaterThanOrEqual(7.55)
    expect(high).toBeLessThanOrEqual(8.55)
  })

  it('makes weaker jelly softer, split sooner and lose more grip to a slam', () => {
    const { state, sim } = setup()
    const weak = addStoolBlock(state, 0.2, 'lime')
    sim.place(weak.id, 4)
    const weakSpring = sim.bodyOf(weak.id)!.soft.constraints[0]!.stiffness
    expect(sim.hammer(weak.id, 1, 0.9)?.kind).toBe('split')
    const firm = addStoolBlock(state, 0.9, 'lime')
    sim.place(firm.id, 6)
    expect(sim.bodyOf(firm.id)!.soft.constraints[0]!.stiffness).toBeGreaterThan(
      weakSpring
    )
    expect(sim.hammer(firm.id, 1, 0.9)?.kind).toBe('hard')

    const soft = state.blocks.get(nailed(state, sim, 8, [0, 3], 0.2))!
    const tough = state.blocks.get(nailed(state, sim, 10, [0, 3], 0.9))!
    for (const fixing of [...soft.fixings, ...tough.fixings]) fixing.grip = 0.7
    sim.impulse(soft.id, 0.35, 'slam')
    sim.impulse(tough.id, 0.35, 'slam')
    expect(soft.fixings[0]!.grip).toBeLessThan(tough.fixings[0]!.grip)
  })
})

describe('residue on the wall', () => {
  it('makes the next block in that cell lose grip twice as fast', () => {
    const { state, sim } = setup()
    state.sections[1]!.cells[4]!.residue = 1
    const dirty = state.blocks.get(nailed(state, sim, 4, [0, 3]))!
    const clean = state.blocks.get(nailed(state, sim, 6, [0, 3]))!
    expect(dirty.residue).toBe(1)
    const before = [dirty.fixings[0]!.grip, clean.fixings[0]!.grip]
    sim.catchUp(60_000)
    const lostDirty = before[0]! - dirty.fixings[0]!.grip
    const lostClean = before[1]! - clean.fixings[0]!.grip
    expect(lostDirty / lostClean).toBeGreaterThan(1.7)
    expect(lostDirty / lostClean).toBeLessThan(2.3)
  })
})

describe('the fly and the cat on the wall', () => {
  it('makes the block the fly sits on lose grip 1.5 times as fast', () => {
    const { state, sim } = setup()
    const fed = state.blocks.get(nailed(state, sim, 4, [0, 3]))!
    const other = state.blocks.get(nailed(state, sim, 6, [0, 3]))!
    sim.conditions.flyBlock = fed.id
    const before = [fed.fixings[0]!.grip, other.fixings[0]!.grip]
    sim.catchUp(60_000)
    const ratio =
      (before[0]! - fed.fixings[0]!.grip) /
      (before[1]! - other.fixings[0]!.grip)
    expect(ratio).toBeCloseTo(1.5, 2)
  })

  it('blames the fly for a block that sags off under it, and for its bites', () => {
    const { state, sim } = setup()
    const sagged = state.blocks.get(nailed(state, sim, 4, [0, 3]))!
    sim.conditions.flyBlock = sagged.id
    sim.sag(1, sagged.id)
    expect(sagged.cause).toBe('fly')
    sim.conditions.flyBlock = null
    const bitten = state.blocks.get(nailed(state, sim, 6, [0, 3]))!
    expect(sim.tearAt(bitten.id, 5, 2, 'fly')).toBe(2)
    expect(bitten.torn).toBeGreaterThanOrEqual(2)
    sim.sag(1, bitten.id)
    expect(bitten.cause).toBe('fly')
  })
})

describe('the heat wave on the wall', () => {
  it('softens live blocks while hot and firms them up after', () => {
    const { state, sim } = setup()
    const id = nailed(state, sim, 4, [0, 3])
    const stiffness = () => sim.bodyOf(id)!.soft.constraints[5]!.stiffness
    const cool = stiffness()
    sim.setHeat('wave')
    expect(stiffness()).toBeCloseTo(cool * 0.7)
    sim.setHeat('curtains')
    expect(stiffness()).toBeCloseTo(cool * 0.7)
    sim.setHeat('none')
    expect(stiffness()).toBeCloseTo(cool)
  })
})
