import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  boilAccuracy,
  createBoil,
  greenZone,
  stepBoil,
  type Boil,
  type BoilEvent,
  type BoilStepOptions
} from './boil'
import { BOIL } from './tuning'

const DT = 10
const ZONE = greenZone(false)
const QUIET: BoilStepOptions = { zone: ZONE, random: () => 0.5, noise: 0 }

/** Runs the boil for `ms`, holding while `hold(boil)` says so. Returns the events. */
function run(
  boil: Boil,
  ms: number,
  hold: (b: Boil) => boolean,
  options = QUIET
): BoilEvent[] {
  const events: BoilEvent[] = []
  for (let t = 0; t < ms; t += DT) {
    const event = stepBoil(boil, DT, hold(boil), options)
    if (event) events.push(event)
  }
  return events
}

/** A steady hand: heats below the middle of the green, lets go above it. */
const steady = (b: Boil) => b.heat < 0.64

describe('the boil', () => {
  it('heats over 2.6s of holding and drains over 4.2s', () => {
    const boil = createBoil()
    run(boil, 1300, () => true)
    expect(boil.heat).toBeCloseTo(0.5, 5)
    run(boil, 2100, () => false)
    expect(boil.heat).toBeCloseTo(0, 5)
    expect(greenZone(true)).toEqual({ from: 0.54, to: 0.78 })
  })

  it('adds noise and bubbles while you hold', () => {
    const noisy = createBoil()
    const events = run(noisy, 5000, steady, { zone: ZONE, random: rng(7) })
    const clean = createBoil()
    run(clean, 5000, steady)
    expect(events.filter(e => e === 'bubble').length).toBeGreaterThanOrEqual(2)
    expect(noisy.heat).not.toBeCloseTo(clean.heat, 3)
  })

  it('scores time in the green since first reaching it', () => {
    const calm = createBoil()
    const events = run(calm, 20_000, steady)
    expect(events).toContain('done')
    expect(calm.greenMs).toBeGreaterThanOrEqual(BOIL.doneMs - DT)
    expect(boilAccuracy(calm)).toBeGreaterThan(0.95)

    // Overshoot well past the green once, then settle.
    const wild = createBoil()
    let overshoots = 0
    run(wild, 30_000, b => {
      if (overshoots < 2 && b.heat > 0.85) overshoots++
      return overshoots < 2 ? b.heat < 0.86 || b.overMs === 0 : steady(b)
    })
    expect(wild.done).toBe(true)
    expect(boilAccuracy(wild)).toBeGreaterThan(0.3)
    expect(boilAccuracy(wild)).toBeLessThan(0.9)
    expect(boilAccuracy(wild)).toBeCloseTo(wild.greenMs / wild.sinceGreenMs)
  })

  it('burns after a full second above 0.9, not after 0.99s', () => {
    const close = createBoil()
    close.heat = 0.95
    run(close, 990, () => true)
    expect(close.burnt).toBe(false)
    // Dropping under the line resets the count.
    close.heat = 0.5
    run(close, 10, () => false)
    expect(close.overMs).toBe(0)
    close.heat = 0.95
    run(close, 990, () => true)
    expect(close.burnt).toBe(false)

    const burnt = createBoil()
    burnt.heat = 0.95
    expect(run(burnt, 1000, () => true)).toContain('burn')
    expect(burnt.burnt).toBe(true)
  })
})
