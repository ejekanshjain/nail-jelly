import { describe, expect, it } from 'vitest'

import { FLOOR_Y, STOOL_TOP } from '../tuning'
import { sectionView, showsFloor, toDesign, wholeView } from './camera'
import { cellRect, sectionRect } from './geometry'

/**
 * A two-line tip in small type covers the design's top 84 units on an iPhone SE with
 * Safari's toolbars showing (0.535 CSS px per unit).
 */
const TIP_BAND = 84

describe('Whole Wall framing', () => {
  it('keeps the floor above the stool strip, so floor splats can be mopped', () => {
    const floor = toDesign(wholeView(), 0, FLOOR_Y)
    expect(floor.y).toBeLessThan(STOOL_TOP)
  })

  it('lowers the wall while the uncle watches, clear of a two-line phone tip', () => {
    const lowered = wholeView(true)
    // Section 5 is the top-left section; its first row of blocks starts below the tip.
    const firstRow = toDesign(lowered, 0, cellRect(4, 0).y)
    expect(firstRow.y).toBeGreaterThanOrEqual(TIP_BAND)
    expect(toDesign(wholeView(), 0, cellRect(4, 0).y).y).toBeLessThan(TIP_BAND)
    // The bottom row of sections still sits above his strip.
    const bottom = sectionRect(0)
    expect(toDesign(lowered, 0, bottom.y + bottom.height).y).toBeLessThan(
      STOOL_TOP
    )
  })
})

describe('showsFloor', () => {
  it('sees the floor from Whole Wall and the bottom row, not from the upper sections', () => {
    expect(showsFloor(wholeView())).toBe(true)
    expect(showsFloor(wholeView(true))).toBe(false)
    expect([0, 1, 2, 3, 4].map(i => showsFloor(sectionView(i)))).toEqual([
      true,
      true,
      false,
      false,
      false
    ])
  })
})
