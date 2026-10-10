import { describe, expect, it } from 'vitest'

import {
  AVERAGE_INPUTS,
  blockQuality,
  cloudiness,
  inputsForQuality,
  lumpCount,
  mainCause,
  qualityLabel,
  qualityWord,
  traySummary
} from './quality'

describe('quality labels', () => {
  it('reads Firm from 0.75, Wobbly from 0.5, otherwise Sloppy', () => {
    expect(qualityWord(0.75)).toBe('Firm')
    expect(qualityWord(0.749)).toBe('Wobbly')
    expect(qualityWord(0.5)).toBe('Wobbly')
    expect(qualityWord(0.499)).toBe('Sloppy')
  })

  it('names the input that cost the most', () => {
    const avg = AVERAGE_INPUTS
    expect(mainCause({ ...avg, bowlClean: 0.1 })).toBe('bowl')
    expect(mainCause({ ...avg, stir: 0.3 })).toBe('stir')
    expect(mainCause({ ...avg, stir: 0.9, set: 0.5 })).toBe('set')
    expect(mainCause({ ...avg, recycled: true })).toBe('recycled')
    expect(mainCause({ ...avg, boil: 0.1, stir: 1 })).toBe('boil')
    expect(mainCause({ ...avg, boil: 1, stir: 1, pour: 0 })).toBe('pour')
    expect(mainCause({ ...avg, boil: 0.99, stir: 0.99, pour: 0.99 })).toBeNull()
  })

  it('blames watery noodles, which cost 0.1', () => {
    const watery = { ...AVERAGE_INPUTS, watery: true }
    expect(mainCause(watery)).toBe('watery')
    const q = blockQuality(watery)
    expect(blockQuality({ ...watery, watery: false }) - q).toBeCloseTo(0.1)
    expect(qualityLabel(q, watery)).toBe('Wobbly: watery noodles')
  })

  it('makes a half-full mould a thin, weaker block, and says so', () => {
    const best = { ...AVERAGE_INPUTS, boil: 1, stir: 1 }
    const full = blockQuality({ ...best, pour: 1, fill: 0.8 })
    // About 55% full: the pour scores 0 and the block is thinner too.
    const half = { ...best, pour: 0, fill: 0.55 }
    expect(full).toBe(1)
    expect(blockQuality(half)).toBeLessThan(0.75)
    expect(mainCause(half)).toBe('thin')
    expect(qualityLabel(blockQuality(half), half)).toBe('Wobbly: too thin')
  })

  it('adds the cause to Wobbly and Sloppy, never to Firm', () => {
    const dirty = { ...AVERAGE_INPUTS, bowlClean: 0.1 }
    expect(qualityLabel(blockQuality(dirty), dirty)).toBe('Wobbly: dirty bowl')
    const lumpy = { ...AVERAGE_INPUTS, stir: 0 }
    expect(qualityLabel(blockQuality(lumpy), lumpy)).toBe('Sloppy: lumpy')
    expect(qualityLabel(blockQuality(AVERAGE_INPUTS), AVERAGE_INPUTS)).toBe(
      'Firm'
    )
  })

  it('sums up a tray, most common label first', () => {
    const lumpy = { ...AVERAGE_INPUTS, stir: 0 }
    const moulds = [
      { q: blockQuality(lumpy), make: lumpy },
      { q: 0.83, make: AVERAGE_INPUTS },
      { q: 0.83, make: AVERAGE_INPUTS }
    ]
    expect(traySummary(moulds)).toEqual(['2 Firm', '1 Sloppy: lumpy'])
  })
})

describe('setting in the bowl', () => {
  it('costs stir score, quality and lumps', () => {
    const set = { ...AVERAGE_INPUTS, set: 0.3 }
    expect(blockQuality(set)).toBeCloseTo(
      blockQuality({ ...AVERAGE_INPUTS, stir: 0.5 })
    )
    expect(lumpCount(set)).toBe(4)
    expect(lumpCount(AVERAGE_INPUTS)).toBe(2)
  })
})

describe('looks', () => {
  it('clouds jelly from a dirty bowl and lumps it from an uneven stir', () => {
    expect(cloudiness(AVERAGE_INPUTS)).toBe(0)
    expect(cloudiness({ ...AVERAGE_INPUTS, bowlClean: 0.25 })).toBe(0.75)
    expect(lumpCount({ ...AVERAGE_INPUTS, stir: 0 })).toBe(8)
    expect(lumpCount({ ...AVERAGE_INPUTS, stir: 1 })).toBe(0)
  })

  it('makes dev blocks at q 0.2, 0.5 and 0.9 that match and look different', () => {
    const looks = [0.2, 0.5, 0.9].map(q => {
      const make = inputsForQuality(q)
      expect(blockQuality(make)).toBeCloseTo(q, 3)
      return { cloud: cloudiness(make), lumps: lumpCount(make) }
    })
    expect(looks.map(l => l.lumps)).toEqual([7, 4, 1])
    expect(looks[0]!.cloud).toBeGreaterThan(looks[1]!.cloud)
    expect(looks[1]!.cloud).toBeGreaterThan(looks[2]!.cloud)
    expect(qualityWord(0.2)).toBe('Sloppy')
    expect(qualityWord(0.9)).toBe('Firm')
  })
})
