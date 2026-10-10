import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  createCarry,
  shooHallwayCat,
  stepCarry,
  type CarryEvent
} from './carry'
import {
  biteTears,
  catTears,
  createCat,
  createFly,
  hallwayCatAt,
  pickCatBlock,
  pickFlyBlock,
  shooCat,
  stepCat,
  stepFly,
  swatFly,
  type CatEvent,
  type CatInput,
  type CatState,
  type FlyEvent,
  type FlyState
} from './critters'
import { AVERAGE_INPUTS } from './quality'
import { addStoolBlock, createGameState } from './state'
import { CARRY, CAT, FLY } from './tuning'
import type { BlockState, GameState } from './types'

const STEP = 100

/** Runs the fly for `ms`, returning what it did and when. */
function flyFor(
  fly: FlyState,
  ms: number,
  blockUp: (at: number) => boolean = () => true
): { at: number; event: FlyEvent }[] {
  const seen: { at: number; event: FlyEvent }[] = []
  const out: FlyEvent[] = []
  for (let at = STEP; at <= ms; at += STEP) {
    out.length = 0
    stepFly(fly, STEP, blockUp(at), out)
    for (const event of out) seen.push({ at, event })
  }
  return seen
}

/** Runs the cat for `ms` with the given input, returning what it did and when. */
function catFor(
  cat: CatState,
  ms: number,
  input: Partial<CatInput> = {}
): { at: number; event: CatEvent }[] {
  const seen: { at: number; event: CatEvent }[] = []
  const out: CatEvent[] = []
  const full: CatInput = {
    present: true,
    pick: () => 7,
    isUp: () => true,
    ...input
  }
  for (let at = STEP; at <= ms; at += STEP) {
    out.length = 0
    stepCat(cat, STEP, full, out)
    for (const event of out) seen.push({ at, event })
  }
  return seen
}

/** A nailed-up block of quality `q` in `cell` of the active section. */
function upBlock(state: GameState, cell: number, q = 0.8): BlockState {
  const block = addStoolBlock(state, q, 'lime', AVERAGE_INPUTS)
  block.status = 'up'
  block.section = state.section
  block.cell = cell
  block.fixings.push({
    id: block.id * 10,
    kind: 'nail',
    particle: 0,
    x: 0,
    y: 0,
    grip: 1,
    rehammers: 0
  })
  state.sections[state.section]!.cells[cell]!.block = block.id
  return block
}

describe('the fly', () => {
  it('lands after its flight, bites every 4s and leaves after 30s', () => {
    const fly = createFly(1, 5)
    const seen = flyFor(fly, FLY.arriveMs + FLY.stayMs + FLY.leaveMs)
    expect(seen[0]).toEqual({ at: FLY.arriveMs, event: 'land' })
    const bites = seen.filter(s => s.event === 'bite').map(s => s.at)
    expect(bites).toEqual(
      [4, 8, 12, 16, 20, 24, 28].map(s => FLY.arriveMs + s * 1000)
    )
    expect(seen.find(s => s.event === 'leave')?.at).toBe(
      FLY.arriveMs + FLY.stayMs
    )
    expect(seen.at(-1)?.event).toBe('gone')
  })

  it('leaves as soon as its block is no longer up', () => {
    const fly = createFly(1, 5)
    const seen = flyFor(fly, 9000, at => at < 8000)
    expect(seen).toEqual([
      { at: FLY.arriveMs, event: 'land' },
      { at: FLY.arriveMs + FLY.biteEveryMs, event: 'bite' },
      { at: 8000, event: 'leave' }
    ])
  })

  it('swats onto the jelly once landed, cleanly in flight, and never twice', () => {
    const flying = createFly(1, 5)
    flyFor(flying, 1000)
    expect(swatFly(flying)).toBe('air')
    expect(swatFly(flying)).toBeNull()
    const landed = createFly(1, 5)
    flyFor(landed, FLY.arriveMs + 500)
    expect(swatFly(landed)).toBe('jelly')
    expect(flyFor(landed, FLY.squashMs).at(-1)?.event).toBe('gone')
  })

  it('goes for weak jelly more often, and only for blocks that are up', () => {
    const state = createGameState()
    state.section = 1
    const weak = upBlock(state, 0, 0.2)
    const firm = upBlock(state, 1, 0.9)
    const fallen = upBlock(state, 2, 0.05)
    fallen.status = 'falling'
    const random = rng(5)
    let weakPicks = 0
    for (let i = 0; i < 1000; i++) {
      const pick = pickFlyBlock([weak, firm, fallen], random)
      expect(pick).not.toBe(fallen)
      if (pick === weak) weakPicks++
    }
    // Weights 0.95 and 0.25: the weak block takes about 79% of the picks.
    expect(weakPicks).toBeGreaterThan(720)
    expect(weakPicks).toBeLessThan(860)
    expect(pickFlyBlock([fallen], random)).toBeNull()
  })

  it('bites 1 spring, sometimes 2 on weak jelly, and none through noodles', () => {
    const state = createGameState()
    const weak = upBlock(state, 0, 0.2)
    const random = rng(9)
    const tears = Array.from({ length: 200 }, () => biteTears(weak, random))
    expect(new Set(tears)).toEqual(new Set([1, 2]))
    weak.noodles = true
    expect(biteTears(weak, random)).toBe(0)
  })
})

describe('the cat', () => {
  it('waits on the windowsill until you walk in', () => {
    const cat = createCat()
    expect(catFor(cat, 120_000, { present: false })).toEqual([])
    expect(cat.phase).toBe('sill')
    expect(catFor(cat, STEP)).toEqual([{ at: STEP, event: 'stare' }])
  })

  it('goes back to waiting if you leave while it stares', () => {
    const cat = createCat()
    catFor(cat, STEP)
    catFor(cat, STEP, { present: false })
    expect(cat.phase).toBe('sill')
  })

  it('stares, hops down, wiggles for 3s, jumps, hangs on, then leaves', () => {
    const cat = createCat()
    const seen = catFor(
      cat,
      STEP +
        CAT.stareMs +
        CAT.hopMs +
        CAT.wiggleMs +
        CAT.jumpMs +
        CAT.hangMs +
        CAT.leaveMs +
        STEP
    )
    expect(seen.map(s => s.event)).toEqual([
      'stare',
      'hop',
      'wiggle',
      'jump',
      'grab',
      'drop',
      'gone'
    ])
    const at = (event: CatEvent) => seen.find(s => s.event === event)!.at
    expect(at('jump') - at('wiggle')).toBe(CAT.wiggleMs)
    expect(cat.blockId).toBe(7)
  })

  it('can be shooed only while it gets ready to jump', () => {
    const cat = createCat()
    expect(shooCat(cat)).toBe(false)
    catFor(cat, STEP + CAT.stareMs + CAT.hopMs + 1000)
    expect(cat.phase).toBe('wiggle')
    expect(shooCat(cat)).toBe(true)
    expect(catFor(cat, CAT.fleeMs).map(s => s.event)).toEqual(['gone'])
    const late = createCat()
    catFor(late, STEP + CAT.stareMs + CAT.hopMs + CAT.wiggleMs + 100)
    expect(late.phase).toBe('jump')
    expect(shooCat(late)).toBe(false)
  })

  it('loses interest when nothing is up to jump at', () => {
    const none = createCat()
    expect(
      catFor(none, STEP + CAT.stareMs, { pick: () => null }).at(-1)?.event
    ).toBe('bored')
    const fell = createCat()
    const seen = catFor(fell, STEP + CAT.stareMs + CAT.hopMs + CAT.wiggleMs, {
      isUp: () => false
    })
    expect(seen.map(s => s.event)).toEqual(['stare', 'hop', 'wiggle', 'bored'])
  })

  it('jumps at the lowest row that has a block up', () => {
    const state = createGameState()
    state.section = 3
    upBlock(state, 1)
    const low = [upBlock(state, 5), upBlock(state, 6)]
    const random = rng(4)
    for (let i = 0; i < 20; i++)
      expect(low.map(b => b.id)).toContain(pickCatBlock(state, 3, random))
    const bottom = upBlock(state, 9)
    expect(pickCatBlock(state, 3, random)).toBe(bottom.id)
    expect(pickCatBlock(state, 4, random)).toBeNull()
  })

  it('tears 3 springs, or 1 through noodles', () => {
    const block = upBlock(createGameState(), 0)
    expect(catTears(block)).toBe(3)
    block.noodles = true
    expect(catTears(block)).toBe(1)
  })
})

describe('the hallway cat', () => {
  it('sits on the runner from section 4, clear of puddles', () => {
    const random = rng(2)
    expect(hallwayCatAt(2, 2400, [], random)).toBeNull()
    for (let i = 0; i < 50; i++) {
      const at = hallwayCatAt(3, 2400, [{ at: 1300 }], random)!
      expect(at).toBeGreaterThanOrEqual(2400 * CAT.hallFrom)
      expect(at).toBeLessThanOrEqual(2400 * CAT.hallTo)
      expect(Math.abs(at - 1300)).toBeGreaterThanOrEqual(CAT.puddleGap)
    }
  })

  it('trips you when you walk into it, and not once you shoo it', () => {
    const moulds = [{ q: 0.8, make: AVERAGE_INPUTS }]
    const walk = (catAt: number | null, shoo: boolean): CarryEvent[] => {
      const carry = createCarry(moulds, 2400, [], catAt)
      if (shoo) shooHallwayCat(carry)
      const out: CarryEvent[] = []
      const options = { noise: 0, gripDeg: CARRY.gripDeg }
      for (let i = 0; i < 300; i++)
        stepCarry(
          carry,
          STEP,
          { walking: true, steer: 0, jolt: false },
          rng(1),
          options,
          out
        )
      return out.filter(e => e.type === 'trip')
    }
    expect(walk(600, false)).toHaveLength(1)
    expect(walk(600, true)).toHaveLength(0)
    expect(walk(null, false)).toHaveLength(0)
  })

  it('stops you and throws the tray when you trip', () => {
    const carry = createCarry([{ q: 0.8, make: AVERAGE_INPUTS }], 2400, [], 100)
    const out: CarryEvent[] = []
    const options = { noise: 0, gripDeg: CARRY.gripDeg }
    while (!out.some(e => e.type === 'trip'))
      stepCarry(
        carry,
        STEP,
        { walking: true, steer: 0, jolt: false },
        rng(1),
        options,
        out
      )
    expect(carry.catAt).toBeNull()
    expect(carry.stopMs).toBeGreaterThan(0)
    stepCarry(
      carry,
      STEP,
      { walking: true, steer: 0, jolt: false },
      rng(1),
      options,
      out
    )
    expect(carry.walking).toBe(false)
    expect(Math.abs(carry.drift)).toBeGreaterThan(5)
  })
})
