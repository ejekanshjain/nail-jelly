import { describe, expect, it } from 'vitest'

import { rng, TiltAxis } from '../shared'
import {
  carryOptions,
  carryRoute,
  createCarry,
  steerOrigin,
  stepCarry,
  type CarryEvent,
  type CarryInput,
  type CarryOptions
} from './carry'
import { AVERAGE_INPUTS } from './quality'
import { CARRY } from './tuning'
import type { CarryState, TrayMould } from './types'

const STEP = 1000 / 60
const CALM: CarryOptions = { noise: 0, gripDeg: CARRY.gripDeg }

function tray(count = 4): TrayMould[] {
  return Array.from({ length: count }, () => ({
    q: 0.83,
    make: AVERAGE_INPUTS
  }))
}

/** Runs the carry for `seconds`, with input from `input` each step. Returns every event. */
function run(
  carry: CarryState,
  seconds: number,
  input: (carry: CarryState) => CarryInput,
  options: CarryOptions = CALM,
  random = rng(7)
): CarryEvent[] {
  const events: CarryEvent[] = []
  for (let i = 0; i < seconds * 60; i++)
    stepCarry(carry, STEP, input(carry), random, options, events)
  return events
}

const walkLevel = (): CarryInput => ({ walking: true, steer: 0, jolt: false })

describe('the hallway carry', () => {
  it('takes the short route first, then the full one', () => {
    expect(carryRoute(0)).toBe(1200)
    expect(carryRoute(1)).toBe(2400)
    const carry = createCarry(tray(), carryRoute(0))
    const events = run(carry, 11.2, walkLevel)
    expect(events.filter(e => e.type === 'arrive')).toHaveLength(1)
    expect(carry.pos).toBe(1200)
  })

  it('keeps every block on a level tray', () => {
    const carry = createCarry(tray(), 2400)
    // Countering the drift perfectly keeps only the footstep bob, under the grip angle.
    const options = carryOptions(4, false)
    const events = run(
      carry,
      23,
      c => ({ walking: true, steer: -c.drift / CARRY.steerDeg, jolt: false }),
      options
    )
    expect(events.some(e => e.type === 'drop')).toBe(false)
    expect(events.some(e => e.type === 'arrive')).toBe(true)
    expect(carry.blocks).toHaveLength(4)
  })

  it('drops the edge block within 1.5s of a held 12 degree tilt', () => {
    const carry = createCarry(tray(), 2400)
    const events = run(carry, 1.5, () => ({
      walking: false,
      steer: 12 / CARRY.steerDeg,
      jolt: false
    }))
    const drop = events.find(e => e.type === 'drop')
    expect(drop).toMatchObject({ type: 'drop', side: 1 })
    expect(carry.blocks).toHaveLength(3)
  })

  it('keeps blocks in order without letting them overlap', () => {
    const carry = createCarry(tray(), 2400)
    const events: CarryEvent[] = []
    for (let i = 0; i < 180; i++) {
      stepCarry(
        carry,
        STEP,
        { walking: false, steer: -0.4, jolt: i % 30 === 0 },
        rng(3),
        CALM,
        events
      )
      for (let k = 0; k + 1 < carry.blocks.length; k++)
        expect(
          carry.blocks[k + 1]!.x - carry.blocks[k]!.x
        ).toBeGreaterThanOrEqual(CARRY.pitch - 1e-6)
    }
    expect(
      events.filter(e => e.type === 'drop').every(e => e.side === -1)
    ).toBe(true)
  })

  it('hops every block on a jolt, at most once per cooldown', () => {
    const carry = createCarry(tray(), 2400)
    const events = run(carry, 0.3, () => ({
      walking: false,
      steer: 0,
      jolt: true
    }))
    expect(events.filter(e => e.type === 'hop')).toHaveLength(1)
    expect(carry.blocks.every(b => b.v !== 0 || b.hopMs > 0)).toBe(true)
  })

  it('drifts harder in later sections and half as hard standing still', () => {
    const spread = (section: number, walking: boolean) => {
      const carry = createCarry(tray(), 1e9)
      let sum = 0
      const n = 60 * 120
      const random = rng(11)
      const events: CarryEvent[] = []
      // Blocks that never slide keep the tray from emptying, which would stop the walk.
      const options = { ...carryOptions(section, false), gripDeg: 90 }
      for (let i = 0; i < n; i++) {
        stepCarry(
          carry,
          STEP,
          { walking, steer: 0, jolt: false },
          random,
          options,
          events
        )
        sum += carry.drift * carry.drift
      }
      return Math.sqrt(sum / n)
    }
    const s1 = spread(0, true)
    const s5 = spread(4, true)
    expect(s5 / s1).toBeCloseTo(7 / 3)
    expect(spread(4, false) / s5).toBeCloseTo(0.5)
    expect(carryOptions(0, true).noise).toBeCloseTo(3 * 0.6)
  })

  it('ends a carry whose tray is empty', () => {
    const carry = createCarry(tray(1), 2400)
    const events = run(carry, 4, () => ({
      walking: true,
      steer: 1,
      jolt: false
    }))
    expect(events.map(e => e.type)).toContain('empty')
    expect(carry.arrived).toBe(true)
  })
})

describe('slipping on a puddle', () => {
  const puddle = [{ at: 300, side: 1 as const }]

  it('throws the tray towards the smear and stops you for 0.8s', () => {
    const carry = createCarry(tray(), 2400, puddle)
    const events = run(carry, 6, walkLevel)
    const slip = events.findIndex(e => e.type === 'slip')
    expect(events[slip]).toEqual({ type: 'slip', side: 1 })
    expect(events.find(e => e.type === 'drop')).toMatchObject({ side: 1 })
    expect(carry.pos).toBeLessThan(6 * CARRY.walkSpeed - 0.75 * CARRY.walkSpeed)
  })

  it('leaves every block on a tray countered in time', () => {
    const carry = createCarry(tray(), 2400, puddle)
    const events = run(carry, 6, c => ({
      walking: true,
      steer: -c.drift / CARRY.steerDeg,
      jolt: false
    }))
    expect(events.some(e => e.type === 'slip')).toBe(true)
    expect(events.some(e => e.type === 'drop')).toBe(false)
  })
})

describe('carry steering', () => {
  it('steers a thumb from where it landed and a mouse from the tray', () => {
    const pointer = { x: 0, isDown: true, lastType: 'touch' as string }
    const axis = new TiltAxis({ pointer, pointerRange: CARRY.pointerRange })
    // The thumb lands at x 100: holding still there is level, sliding right tilts right.
    axis.originX = steerOrigin('touch', 100, 300)
    pointer.x = 100
    expect(axis.update(STEP)).toBe(0)
    pointer.x = 175
    expect(axis.update(STEP)).toBeCloseTo(0.5)
    // A mouse hovering 75 units right of the tray's ring tilts right by the same amount.
    pointer.lastType = 'mouse'
    pointer.isDown = false
    axis.originX = steerOrigin('mouse', 100, 300)
    pointer.x = 375
    expect(axis.update(STEP)).toBeCloseTo(0.5)
  })
})
