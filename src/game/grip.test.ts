import { describe, expect, it } from 'vitest'

import {
  breakGrip,
  decayPerSecond,
  impulseLoss,
  longSectionEase,
  nailLevel,
  slackFor,
  type DecayInputs,
  warningLines
} from './grip'
import { toughness } from './quality'
import {
  BLOCK_SPRINGS,
  IMPULSE,
  LONG_SECTION,
  RIP_OUT,
  SECTION_DECAY,
  SECTION_IMPULSE_POOLS
} from './tuning'

/** An average block (q 0.83) on clean wall, with sweet nails that each tore one spring. */
function inputs(overrides: Partial<DecayInputs> = {}): DecayInputs {
  const fixings = overrides.fixings ?? 2
  return {
    q: 0.83,
    fixings,
    residue: 0,
    heat: 'none',
    mesh: 0,
    screw: false,
    fly: false,
    holes: fixings,
    integrity: (BLOCK_SPRINGS - fixings) / BLOCK_SPRINGS,
    section: null,
    ...overrides
  }
}

/** Minutes for a fixing to fall from `from` to grip 0.3. */
function minutesTo03(input: DecayInputs, from = 1): number {
  return (from - 0.3) / decayPerSecond(input) / 60
}

describe('grip decay', () => {
  it('takes an average block on 2 sweet nails to grip 0.3 in about 7.3 minutes', () => {
    expect(minutesTo03(inputs())).toBeCloseTo(7.3, 0)
    expect(Math.abs(minutesTo03(inputs()) - 7.3)).toBeLessThan(0.2)
  })

  it('makes 3 and 4 nails decay faster than 2', () => {
    const two = decayPerSecond(inputs({ fixings: 2 }))
    const three = decayPerSecond(inputs({ fixings: 3 }))
    const four = decayPerSecond(inputs({ fixings: 4 }))
    expect(three).toBeGreaterThan(two)
    expect(four).toBeGreaterThan(three)
  })

  it('divides hold time by 2.2 on a single nail', () => {
    const two = decayPerSecond(
      inputs({ fixings: 2, holes: 1, integrity: 28 / 29 })
    )
    const one = decayPerSecond(
      inputs({ fixings: 1, holes: 1, integrity: 28 / 29 })
    )
    expect(one / two).toBeCloseTo(2.2)
  })

  it('applies residue, heat, fly, damage, the section factors and any extra scale', () => {
    const base = decayPerSecond(inputs())
    expect(decayPerSecond(inputs({ residue: 1 })) / base).toBeCloseTo(2)
    expect(decayPerSecond(inputs({ heat: 'wave' })) / base).toBeCloseTo(3)
    expect(decayPerSecond(inputs({ heat: 'curtains' })) / base).toBeCloseTo(1.8)
    expect(decayPerSecond(inputs({ fly: true })) / base).toBeCloseTo(1.5)
    expect(decayPerSecond(inputs({ section: 0 })) / base).toBeCloseTo(0.5)
    for (const section of [1, 4])
      expect(decayPerSecond(inputs({ section })) / base).toBeCloseTo(
        SECTION_DECAY[section]!
      )
    expect(decayPerSecond(inputs({ scale: 0.5 })) / base).toBeCloseTo(0.5)
    expect(decayPerSecond(inputs({ integrity: 0.5 }))).toBeGreaterThan(base)
  })

  it('eases a long-running section off, from full speed down to its floor', () => {
    const { fromMs, toMs, min } = LONG_SECTION
    expect(longSectionEase(0)).toBe(1)
    expect(longSectionEase(fromMs)).toBe(1)
    expect(longSectionEase((fromMs + toMs) / 2)).toBeCloseTo((1 + min) / 2)
    expect(longSectionEase(toMs)).toBeCloseTo(min)
    expect(longSectionEase(toMs * 3)).toBeCloseTo(min)
  })

  it('never lets upgrades cut decay below the floor', () => {
    const plain = decayPerSecond(inputs())
    const both = decayPerSecond(inputs({ mesh: 1, screw: true }))
    expect(both / plain).toBeCloseTo(0.64)
    expect(both / plain).toBeGreaterThanOrEqual(0.6)
  })

  it('takes a fully upgraded block 12 to 15 minutes to reach grip 0.3', () => {
    // Recipe q, two screws at average evenness, mesh, and noodles so nothing tore.
    const minutes = minutesTo03(
      inputs({ q: 0.91, mesh: 1, screw: true, integrity: 1 }),
      0.92
    )
    expect(minutes).toBeGreaterThan(12)
    expect(minutes).toBeLessThan(15)
  })
})

describe('slack', () => {
  it('lets weaker nails hang lower', () => {
    expect(slackFor(1)).toBe(0)
    expect(slackFor(0.6)).toBeCloseTo(6.58, 1)
    expect(slackFor(0.3)).toBeCloseTo(15.2, 1)
  })
})

describe('impulses', () => {
  const tough = toughness(0.83)

  it('lets grip 0.6 survive a slam and rips grip 0.25 on one', () => {
    const strong = 0.6 - impulseLoss(0.6, IMPULSE.slam, 2, tough)
    const weak = 0.25 - impulseLoss(0.25, IMPULSE.slam, 2, tough)
    expect(strong).toBeGreaterThan(RIP_OUT)
    expect(weak).toBeLessThanOrEqual(RIP_OUT)
  })

  it('hits single nails harder than pairs', () => {
    expect(impulseLoss(0.7, IMPULSE.slam, 1, tough)).toBeGreaterThan(
      impulseLoss(0.7, IMPULSE.slam, 2, tough)
    )
  })

  it('finds the exact grip an impulse rips', () => {
    for (const fixings of [1, 2, 3]) {
      const edge = breakGrip(IMPULSE.slam, fixings, tough)
      const after = edge - impulseLoss(edge, IMPULSE.slam, fixings, tough)
      expect(after).toBeCloseTo(RIP_OUT, 6)
    }
  })

  it('keeps every nail above its orange line safe from its section strongest event', () => {
    for (const [section, pool] of SECTION_IMPULSE_POOLS.entries()) {
      for (const q of [0.3, 0.6, 0.9]) {
        for (const fixings of [1, 2]) {
          const t = toughness(q)
          const lines = warningLines(pool, fixings, t)
          const grip = lines.orange + 0.005
          const after = grip - impulseLoss(grip, pool.strongest, fixings, t)
          expect(after, `S${section + 1} q ${q} x${fixings}`).toBeGreaterThan(
            RIP_OUT
          )
          expect(lines.red).toBeLessThanOrEqual(lines.orange)
        }
      }
    }
  })

  it('rips a red nail on the weakest event in its pool', () => {
    const pool = SECTION_IMPULSE_POOLS[1]!
    const lines = warningLines(pool, 1, tough)
    const grip = breakGrip(pool.weakest, 1, tough) - 0.01
    expect(nailLevel(grip, lines)).toBe('red')
    expect(
      grip - impulseLoss(grip, pool.weakest, 1, tough)
    ).toBeLessThanOrEqual(RIP_OUT)
  })
})
