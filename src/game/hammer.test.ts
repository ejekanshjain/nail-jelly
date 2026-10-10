import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  baseTears,
  classifyHit,
  hammerFillMs,
  hammerZones,
  hitGrip,
  rehammerGrip,
  rollTears
} from './hammer'
import { blockQuality, extraTearOdds, splitAt, toughness } from './quality'
import { REHAMMER_FLOOR } from './tuning'

describe('hammer outcomes', () => {
  const zones = hammerZones(0.83)

  it('sorts charges at each boundary', () => {
    expect(classifyHit(0.39, zones)).toBe('weak')
    expect(classifyHit(0.4, zones)).toBe('loose')
    expect(classifyHit(0.579, zones)).toBe('loose')
    expect(classifyHit(0.58, zones)).toBe('sweet')
    expect(classifyHit(0.8, zones)).toBe('sweet')
    expect(classifyHit(0.81, zones)).toBe('hard')
    expect(classifyHit(zones.split - 0.001, zones)).toBe('hard')
    expect(classifyHit(zones.split, zones)).toBe('split')
    expect(classifyHit(1, zones)).toBe('split')
  })

  it('peaks sweet grip at the zone centre', () => {
    expect(hitGrip('sweet', 0.69, zones)).toBeCloseTo(1)
    expect(hitGrip('sweet', 0.58, zones)).toBeCloseTo(0.9)
    expect(hitGrip('loose', 0.5, zones)).toBe(0.55)
    expect(hitGrip('hard', 0.85, zones)).toBe(0.85)
  })

  it('widens the sweet zone and the split margin in Assist Mode', () => {
    const assist = hammerZones(0.83, { assist: true })
    expect(assist.sweetFrom).toBeCloseTo(0.536)
    expect(assist.sweetTo).toBeCloseTo(0.844)
    expect(assist.split).toBeCloseTo(zones.split + 0.04)
  })

  it('splits weaker jelly earlier and never splits with noodles', () => {
    expect(splitAt(0.3)).toBeLessThan(splitAt(0.9))
    expect(hammerZones(0.5, { noodles: true }).split).toBe(Infinity)
  })

  it('never splits on a re-hammer', () => {
    const re = hammerZones(0.83, { rehammer: true })
    expect(classifyHit(1, re)).toBe('hard')
  })

  it('applies diminishing returns to re-hammers, down to a floor, and never lowers grip', () => {
    expect(rehammerGrip(0.3, 1, 0)).toBe(1)
    expect(rehammerGrip(0.3, 1, 2)).toBeCloseTo(0.8)
    expect(rehammerGrip(0.3, 1, 9)).toBeCloseTo(REHAMMER_FLOOR)
    expect(rehammerGrip(0.8, 0.55, 1)).toBe(0.8)
  })

  it('fills slower in section 1 and in Assist Mode', () => {
    expect(hammerFillMs(1, false)).toBe(900)
    expect(hammerFillMs(0, false)).toBe(1300)
    expect(hammerFillMs(1, true)).toBeCloseTo(1170)
  })
})

describe('tears', () => {
  it('counts springs per outcome, halved by noodles', () => {
    expect(baseTears('weak', false, false)).toBe(0)
    expect(baseTears('sweet', false, false)).toBe(1)
    expect(baseTears('hard', false, false)).toBe(3)
    expect(baseTears('hard', false, true)).toBe(1)
    expect(baseTears('sweet', false, true)).toBe(0)
    expect(baseTears('sweet', true, false)).toBe(0)
    expect(baseTears('hard', true, false)).toBe(1)
  })

  it('adds at most one extra spring, more often on weak jelly', () => {
    const random = rng(7)
    const counts = { weak: 0, strong: 0 }
    for (let i = 0; i < 2000; i++) {
      const weak = rollTears(1, 0.3, random)
      const strong = rollTears(1, 0.95, random)
      expect(weak).toBeGreaterThanOrEqual(1)
      expect(weak).toBeLessThanOrEqual(2)
      counts.weak += weak - 1
      counts.strong += strong - 1
    }
    expect(counts.weak / 2000).toBeCloseTo(extraTearOdds(0.3), 1)
    expect(counts.weak).toBeGreaterThan(counts.strong)
    expect(rollTears(1, 0.3, random, 0, true)).toBe(1)
  })
})

describe('quality', () => {
  const average = {
    boil: 0.75,
    stir: 0.8,
    pour: 0.8,
    bowlClean: 1,
    recycled: false,
    recipe: false
  }

  it('gives 1 for perfect inputs and about 0.83 for average ones', () => {
    expect(blockQuality({ ...average, boil: 1, stir: 1, pour: 1 })).toBeCloseTo(
      1
    )
    expect(blockQuality(average)).toBeCloseTo(0.8275)
  })

  it('scales for a dirty bowl and recycled jelly, and caps the recipe at 1', () => {
    const q = blockQuality(average)
    expect(blockQuality({ ...average, bowlClean: 0 })).toBeCloseTo(q * 0.6)
    expect(blockQuality({ ...average, recycled: true })).toBeCloseTo(q * 0.7)
    expect(blockQuality({ ...average, recipe: true })).toBeCloseTo(q + 0.08)
    expect(
      blockQuality({ ...average, boil: 1, stir: 1, pour: 1, recipe: true })
    ).toBe(1)
  })

  it('makes better jelly tougher and less likely to tear', () => {
    expect(toughness(0.9)).toBeGreaterThan(toughness(0.3))
    expect(extraTearOdds(0.9)).toBeLessThan(extraTearOdds(0.3))
    expect(extraTearOdds(0.3, 1)).toBeLessThan(extraTearOdds(0.3))
  })
})
