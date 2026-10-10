import { describe, expect, it } from 'vitest'

import { createWallet, rng } from '../../shared'
import { decayPerSecond } from '../grip'
import { lockSection } from '../section'
import { addStoolBlock, createGameState } from '../state'
import { BLOCK_SPRINGS, IMPULSE, PROXY_CAP, SECTION_CELLS } from '../tuning'
import type { GameState } from '../types'
import { tearNearest } from './blockBody'
import { cellCentre } from './geometry'
import { ProxyWall } from './proxies'
import { WallSim } from './wallSim'

const STEP = 1000 / 60

function setup() {
  const state = createGameState()
  state.section = 1
  const wall = new WallSim(state, rng(5))
  const proxies = new ProxyWall(state, wall, rng(6))
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      state.simMs += STEP
      wall.update(STEP)
      proxies.update(STEP)
    }
  }
  return { state, wall, proxies, run }
}

/** Fills the active section with nailed blocks, lets them settle as a hold would, and locks it. */
function fillAndLock(
  state: GameState,
  wall: WallSim,
  run: (seconds: number) => void
): number {
  const section = state.section
  for (let cell = 0; cell < SECTION_CELLS; cell++) {
    const block = addStoolBlock(state, 0.85, 'lime')
    wall.place(block.id, cell)
    wall.hammer(block.id, 0, 0.69)
    wall.hammer(block.id, 3, 0.69)
  }
  run(2)
  lockSection(state, wall, createWallet())
  return section
}

describe('lock snapshot round trip', () => {
  it('rebuilds torn springs, nails and positions from a snapshot', () => {
    const { state, wall, run } = setup()
    const block = addStoolBlock(state, 0.8, 'grape')
    wall.place(block.id, 5)
    wall.hammer(block.id, 1, 0.69)
    wall.hammer(block.id, 2, 0.69)
    run(1)
    const body = wall.bodyOf(block.id)!
    const c = body.soft.center()
    tearNearest(body, c.x, c.y + 13, 2)
    run(1)
    const snapshot = wall.freezeBlock(block.id, 'proxy')!
    expect(wall.liveCount).toBe(0)
    expect(wall.thawBlock(snapshot)).toBe(true)
    run(1 / 60)
    const after = wall.snapshotBlock(block.id)!
    expect(after.tornSprings).toEqual(snapshot.tornSprings)
    expect(after.tornSprings.length).toBe(
      BLOCK_SPRINGS - body.soft.constraints.length
    )
    expect(after.fixings.map(f => f.particle)).toEqual([1, 2])
    for (let i = 0; i < after.positions.length; i++)
      expect(
        Math.abs(after.positions[i]! - snapshot.positions[i]!)
      ).toBeLessThan(1)
  })
})

describe('ProxyWall', () => {
  it('unlocks a section into proxies with no bodies', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    expect(proxies.unlock(section)).toBe(SECTION_CELLS)
    expect(wall.liveCount).toBe(0)
    expect(state.sections[section]!.locked).toBe(false)
  })

  it('decays proxy grip with the live formula', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const block = state.blocks.get(state.sections[section]!.cells[0]!.block!)!
    const before = block.fixings[0]!.grip
    const rate = decayPerSecond({
      q: block.q,
      fixings: 2,
      residue: 0,
      heat: 'none',
      mesh: 0,
      screw: false,
      fly: false,
      holes: block.holes,
      integrity:
        1 -
        proxies.proxies.get(block.id)!.snapshot.tornSprings.length /
          BLOCK_SPRINGS,
      section: null
    })
    run(10)
    expect(block.fixings[0]!.grip).toBeCloseTo(before - rate * 10, 3)
  })

  it('promotes the blocks a slam would rip, and they fall physically', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const weak = [0, 5, 10].map(
      cell => state.sections[section]!.cells[cell]!.block!
    )
    for (const id of weak)
      for (const f of state.blocks.get(id)!.fixings) f.grip = 0.3
    run(0.2)
    expect(wall.liveCount).toBe(0)
    proxies.impulse(IMPULSE.slam, 'slam')
    for (const block of state.blocks.values())
      if (block.status === 'up') wall.impulse(block.id, IMPULSE.slam, 'slam')
    expect(wall.liveCount).toBe(3)
    run(6)
    for (const id of weak) expect(state.blocks.get(id)!.status).toBe('splatted')
    expect(proxies.proxies.size).toBe(SECTION_CELLS - 3)
  })

  it('braces for a slam one block per call, only the blocks it would rip', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const weak = [0, 5, 10].map(
      cell => state.sections[section]!.cells[cell]!.block!
    )
    for (const id of weak)
      for (const f of state.blocks.get(id)!.fixings) f.grip = 0.3
    for (let i = 1; i <= 3; i++) {
      expect(proxies.brace(IMPULSE.slam)).toBe(true)
      expect(wall.liveCount).toBe(i)
    }
    expect(proxies.brace(IMPULSE.slam)).toBe(false)
    for (const id of weak) expect(proxies.proxies.has(id)).toBe(false)
  })

  it('demotes a healthy promoted block after 2s of calm', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const id = state.sections[section]!.cells[6]!.block!
    expect(proxies.promote(id)).toBe(true)
    run(1)
    expect(wall.liveCount).toBe(1)
    run(2.5)
    expect(wall.liveCount).toBe(0)
    expect(state.blocks.get(id)!.status).toBe('proxy')
  })

  it('keeps to the cap by demoting the calmest body', () => {
    const { state, wall, proxies, run } = setup()
    const first = fillAndLock(state, wall, run)
    const second = fillAndLock(state, wall, run)
    proxies.unlock(first)
    proxies.unlock(second)
    const ids = [...proxies.proxies.keys()]
    for (const id of ids.slice(0, PROXY_CAP))
      expect(proxies.promote(id)).toBe(true)
    run(0.5)
    expect(proxies.promote(ids[PROXY_CAP]!)).toBe(true)
    expect(wall.liveCount).toBe(PROXY_CAP)
  })

  it('lets a capped proxy fall without a body when nothing is calm', () => {
    const { state, wall, proxies, run } = setup()
    const first = fillAndLock(state, wall, run)
    const second = fillAndLock(state, wall, run)
    proxies.unlock(first)
    proxies.unlock(second)
    const ids = [...proxies.proxies.keys()]
    for (const id of ids.slice(0, PROXY_CAP)) proxies.promote(id)
    const doomed = state.blocks.get(ids[PROXY_CAP]!)!
    for (const f of doomed.fixings) f.grip = 0.1
    // Keep every body moving so none counts as calm.
    for (let i = 0; i < 90 && doomed.status !== 'splatted'; i++) {
      wall.shove(0, -1, 3)
      run(1 / 60)
    }
    run(2)
    expect(doomed.status).toBe('splatted')
    expect(wall.liveCount).toBeLessThanOrEqual(PROXY_CAP)
  })

  it('forces a promotion for your press even when no body is calm', () => {
    const { state, wall, proxies, run } = setup()
    const first = fillAndLock(state, wall, run)
    const second = fillAndLock(state, wall, run)
    proxies.unlock(first)
    proxies.unlock(second)
    const ids = [...proxies.proxies.keys()]
    for (const id of ids.slice(0, PROXY_CAP)) proxies.promote(id)
    // Keep every body moving so none counts as calm.
    wall.shove(0, -1, 3)
    run(1 / 60)
    const next = ids[PROXY_CAP]!
    expect(proxies.promote(next)).toBe(false)
    expect(proxies.promote(next, true)).toBe(true)
    expect(wall.liveCount).toBe(PROXY_CAP)
    expect(wall.bodyOf(next)).toBeDefined()
  })

  it('never demotes a body it is told to keep', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const id = state.sections[section]!.cells[6]!.block!
    proxies.keep = blockId => blockId === id
    proxies.promote(id)
    run(4)
    expect(wall.bodyOf(id)).toBeDefined()
    proxies.keep = () => false
    run(2.5)
    expect(wall.bodyOf(id)).toBeUndefined()
  })

  it('finds the proxy under a press by its nails first, then its jelly', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const id = state.sections[section]!.cells[5]!.block!
    const nail = state.blocks.get(id)!.fixings[0]!
    expect(proxies.nearest(nail.x + 5, nail.y, 20, 20)).toEqual({
      blockId: id,
      nail: true
    })
    const c = cellCentre(section, 5)
    expect(proxies.nearest(c.x, c.y + 10, 20, 30)).toEqual({
      blockId: id,
      nail: false
    })
    expect(proxies.nearest(c.x, c.y + 10, 20, 0)).toBeNull()
  })

  it('shakes a block off without a body, leaving a splat and old jelly', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const cells = state.sections[section]!.cells
    const a = cells[0]!.block!
    const b = cells[1]!.block!
    proxies.promote(b)
    expect(proxies.drop(a, 'slam')).toBe(true)
    expect(proxies.drop(b, 'slam')).toBe(true)
    expect(wall.liveCount).toBe(0)
    run(3)
    for (const id of [a, b]) {
      expect(state.blocks.get(id)!.status).toBe('splatted')
      expect(state.blocks.get(id)!.cause).toBe('slam')
    }
    expect(cells[0]!.block).toBeNull()
    expect(cells[0]!.residue).toBeGreaterThan(0)
    expect(state.splats.filter(s => s.room === 'wall')).toHaveLength(2)
  })

  it('reopens a locked section as bodies that stay bodies, for a refill', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    expect(proxies.reopen(section)).toBe(SECTION_CELLS)
    expect(state.sections[section]!.locked).toBe(false)
    expect(wall.liveCount).toBe(SECTION_CELLS)
    run(4)
    expect(wall.liveCount).toBe(SECTION_CELLS)
    expect(proxies.proxies.size).toBe(0)
  })

  it('relocks a section with the grade of its weakest grip', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    const id = state.sections[section]!.cells[3]!.block!
    state.blocks.get(id)!.fixings[1]!.grip = 0.5
    proxies.relock(section)
    expect(state.sections[section]!.weakestGrip).toBeCloseTo(0.5, 2)
    expect(state.sections[section]!.grade).toBe('C')
  })

  it('relocks a section as it stands', () => {
    const { state, wall, proxies, run } = setup()
    const section = fillAndLock(state, wall, run)
    proxies.unlock(section)
    proxies.promote(state.sections[section]!.cells[2]!.block!)
    run(0.5)
    const snapshot = proxies.relock(section)
    expect(snapshot).toHaveLength(SECTION_CELLS)
    expect(state.sections[section]!.locked).toBe(true)
    expect(wall.liveCount).toBe(0)
    expect(proxies.proxies.size).toBe(0)
  })
})
