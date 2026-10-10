import { describe, expect, it } from 'vitest'

import { COLD_OPEN } from '../game/tuning'
import { ColdOpen } from './coldOpen'

const STEP = 1000 / 60

function runUntilDone(open: ColdOpen, maxMs: number): number {
  let ms = 0
  while (!open.done && ms < maxMs) {
    open.update(STEP)
    ms += STEP
  }
  return ms
}

describe('cold open', () => {
  it('plays both lines and the exit on its own', () => {
    const open = new ColdOpen()
    const total =
      COLD_OPEN.enterMs +
      2 * COLD_OPEN.lineMs +
      COLD_OPEN.exitMs +
      COLD_OPEN.settleMs
    const ms = runUntilDone(open, 20_000)
    expect(open.done).toBe(true)
    expect(ms).toBeGreaterThanOrEqual(total - STEP)
    // Each beat starts on the step after the last one ends.
    expect(ms).toBeLessThanOrEqual(total + 4 * STEP)
  })

  it('moves to the next line on each tap', () => {
    const open = new ColdOpen()
    open.advance() // skips the walk-in to line 1
    open.advance() // line 2
    open.advance() // walks off
    open.advance() // a skip tap too many does nothing
    const ms = runUntilDone(open, 20_000)
    expect(ms).toBeGreaterThanOrEqual(
      COLD_OPEN.exitMs + COLD_OPEN.settleMs - STEP
    )
    expect(ms).toBeLessThan(COLD_OPEN.exitMs + COLD_OPEN.settleMs + 2 * STEP)
    expect(open.done).toBe(true)
  })
})
