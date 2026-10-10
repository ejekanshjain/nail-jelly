import { describe, expect, it } from 'vitest'

import {
  AVERAGE_PACE,
  batchSeconds,
  fridgeIdleSeconds,
  paceReport,
  UNSKILLED_PACE
} from './pacing'

describe('pacing', () => {
  it('keeps the average run inside 60 to 90 minutes, passing or failing once', () => {
    const report = paceReport(AVERAGE_PACE, 1)
    expect(report.passMin).toBeGreaterThanOrEqual(60)
    expect(report.passMin).toBeLessThanOrEqual(90)
    expect(report.failMin).toBeGreaterThanOrEqual(60)
    expect(report.failMin).toBeLessThanOrEqual(90)
  })

  it('takes an unskilled player over 2 hours with two failed tests', () => {
    expect(paceReport(UNSKILLED_PACE, 2).failMin).toBeGreaterThan(120)
  })

  it('leaves the average player under 10s idle per fridge minute', () => {
    expect(fridgeIdleSeconds(AVERAGE_PACE, 4)).toBeLessThan(10)
    expect(fridgeIdleSeconds(AVERAGE_PACE, 6)).toBeLessThan(10)
  })

  it('makes a player who does not pipeline wait out the whole fridge minute', () => {
    const pipelined = batchSeconds({ ...UNSKILLED_PACE, pipelines: true }, 4)
    expect(batchSeconds(UNSKILLED_PACE, 4) - pipelined).toBeCloseTo(60, 5)
    expect(fridgeIdleSeconds(UNSKILLED_PACE, 4)).toBe(60)
  })
})
