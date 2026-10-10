import { describe, expect, it } from 'vitest'

import {
  createPour,
  pourAccuracy,
  stepPour,
  thinFactor,
  type PourEvent
} from './pour'
import { POUR } from './tuning'

const DT = 10

function run(
  pour: ReturnType<typeof createPour>,
  ms: number,
  holding: boolean
): PourEvent[] {
  const events: PourEvent[] = []
  for (let t = 0; t < ms; t += DT) {
    const event = stepPour(pour, DT, holding)
    if (event) events.push(event)
  }
  return events
}

describe('pouring', () => {
  it('drips on for about 0.05 after you let go', () => {
    const pour = createPour(4)
    run(pour, 1000, true)
    const atRelease = pour.fills[0]!
    run(pour, POUR.decayMs + 50, false)
    expect(pour.fills[0]! - atRelease).toBeCloseTo(0.05, 2)
  })

  it('overflows once past 1.00', () => {
    const pour = createPour(4)
    const events = run(pour, 4000, true)
    expect(events.filter(e => e === 'spill')).toHaveLength(1)
    expect(pour.fills[0]).toBe(1)
    expect(pour.spilled).toEqual([true, false, false, false])
  })

  it('moves on half a second after the flow stops, then finishes', () => {
    const pour = createPour(2)
    run(pour, 1500, true)
    expect(run(pour, POUR.decayMs + POUR.nextAfterMs + 20, false)).toEqual([
      'next'
    ])
    expect(pour.index).toBe(1)
    // An empty mould waits for you.
    expect(run(pour, 2000, false)).toEqual([])
    run(pour, 1500, true)
    expect(run(pour, 1000, false)).toEqual(['done'])
    expect(pour.done).toBe(true)
  })

  it("won't move on from a mould under the minimum, and says so once", () => {
    const pour = createPour(2)
    // A quick tap: a dribble well under the minimum.
    run(pour, 100, true)
    expect(pour.fills[0]).toBeLessThan(POUR.minFill)
    expect(run(pour, 3000, false)).toEqual(['short'])
    expect(pour.index).toBe(0)
    run(pour, 1500, true)
    expect(pour.fills[0]).toBeGreaterThan(POUR.minFill)
    expect(run(pour, 1000, false)).toEqual(['next'])
  })

  it('keeps a full block at the line and a thinner one below it', () => {
    expect(thinFactor(POUR.line)).toBe(1)
    expect(thinFactor(1)).toBe(1)
    expect(thinFactor(POUR.line / 2)).toBeCloseTo(1 - POUR.thin / 2)
  })

  it('scores 1 on the line and 0 a quarter off it, or 0.35 off in Assist', () => {
    expect(pourAccuracy(0.8, false)).toBe(1)
    expect(pourAccuracy(0.55, false)).toBeCloseTo(0)
    expect(pourAccuracy(1.05, false)).toBe(0)
    expect(pourAccuracy(0.55, true)).toBeCloseTo(1 - 0.25 / 0.35)
    expect(pourAccuracy(0.45, true)).toBeCloseTo(0)
  })
})
