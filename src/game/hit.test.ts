import { describe, expect, it } from 'vitest'

import { isRub, nailTarget, pickTarget, worldRadius } from './hit'
import { NAIL_HIT } from './tuning'

describe('hit radii', () => {
  it('keeps targets at their CSS minimum at any zoom', () => {
    // iPhone SE with Safari bars: scale 0.535. Section zoom 1, Whole Wall zoom 0.5.
    expect(worldRadius(NAIL_HIT, 0.535, 'touch')).toBeCloseTo(44.9, 1)
    expect(worldRadius(NAIL_HIT, 0.535 * 0.5, 'touch')).toBeCloseTo(89.7, 1)
    expect(worldRadius(NAIL_HIT, 1, 'mouse')).toBe(30)
  })
})

describe('pickTarget', () => {
  const nails = [{ blockId: 1, fixingId: 10, x: 100, y: 100 }]
  const jelly = [
    { blockId: 1, particle: 0, x: 100, y: 100 },
    { blockId: 1, particle: 1, x: 126, y: 100 }
  ]

  it('prefers a nail head over the jelly around it', () => {
    const target = pickTarget({
      x: 120,
      y: 104,
      cssPerUnit: 1,
      pointer: 'mouse',
      nails,
      jelly
    })
    expect(target).toEqual({ kind: 'nail', blockId: 1, fixingId: 10 })
  })

  it('re-hammers a thumb press that a mouse would miss', () => {
    const query = { x: 140, y: 100, cssPerUnit: 0.535, nails, jelly }
    expect(pickTarget({ ...query, pointer: 'touch' }).kind).toBe('nail')
    expect(pickTarget({ ...query, pointer: 'mouse' }).kind).toBe('jelly')
  })

  it('puts critters first and the bare wall last', () => {
    const critters = [{ critter: 'fly' as const, id: 3, x: 110, y: 100 }]
    expect(
      pickTarget({
        x: 105,
        y: 100,
        cssPerUnit: 1,
        pointer: 'mouse',
        critters,
        nails
      }).kind
    ).toBe('critter')
    expect(
      pickTarget({
        x: 400,
        y: 400,
        cssPerUnit: 1,
        pointer: 'mouse',
        nails,
        jelly
      })
    ).toEqual({ kind: 'wall' })
  })

  it('finds messes after jelly', () => {
    const messes = [
      { mess: 'splat' as const, id: 5, x: 300, y: 300, radius: 40 }
    ]
    expect(
      pickTarget({ x: 320, y: 300, cssPerUnit: 1, pointer: 'mouse', messes })
    ).toEqual({ kind: 'mess', mess: 'splat', id: 5 })
  })
})

describe('nailTarget', () => {
  // Block 1 swung 45 units away from the aim point at (0, 0) while the hammer charged.
  const swung = [
    { blockId: 1, particle: 3, x: 45, y: 0 },
    { blockId: 1, particle: 7, x: 70, y: 0 }
  ]

  it('nails the jelly under the hammer first', () => {
    const under = { blockId: 2, particle: 0, x: 10, y: 0 }
    expect(nailTarget([...swung, under], 0, 0, 30, 1)).toBe(under)
  })

  it('follows the pressed block within twice the reach', () => {
    expect(nailTarget(swung, 0, 0, 30, 1)).toMatchObject({ particle: 3 })
    expect(nailTarget(swung, 0, 0, 20, 1)).toBeNull()
  })

  it('never reaches for other jelly or a bare-wall press', () => {
    expect(nailTarget(swung, 0, 0, 30, 2)).toBeNull()
    expect(nailTarget(swung, 0, 0, 30, null)).toBeNull()
  })
})

describe('isRub', () => {
  it('turns a press into a rub past 12 CSS px', () => {
    expect(isRub(8, 8)).toBe(false)
    expect(isRub(10, 8)).toBe(true)
  })
})
