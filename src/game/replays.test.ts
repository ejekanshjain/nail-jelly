import { describe, expect, it } from 'vitest'

import { blameLine, BLAME, whereYouWere } from './labels'
import {
  AlertLimiter,
  clipDue,
  clipLabel,
  minutesWithoutSplat,
  splatStats,
  wantsCutaway,
  type CutawayCheck,
  type PendingClip
} from './replays'
import { createBlock, createGameState } from './state'
import { AVERAGE_INPUTS } from './quality'
import { ALERT_GAP_MS, REPLAY } from './tuning'

function lostBlock(heldMs: number, cause: 'sag' | 'split' = 'sag') {
  const state = createGameState()
  const block = createBlock(state, 0.8, 'lime', AVERAGE_INPUTS)
  block.firstBiteMs = 1000
  block.lastNailMs = 1000
  block.lostMs = 1000 + heldMs
  block.cause = cause
  return { state, block }
}

describe('splat clips', () => {
  const pending = (landedMs: number | null): PendingClip => ({
    blocks: [1],
    landedMs,
    carry: false,
    where: null
  })

  it('waits for a landing, then 0.8s, or 1.6s while blocks still fall', () => {
    expect(clipDue(pending(null), 99_999, false)).toBe(false)
    expect(clipDue(pending(0), REPLAY.afterLandMs - 1, false)).toBe(false)
    expect(clipDue(pending(0), REPLAY.afterLandMs, false)).toBe(true)
    expect(clipDue(pending(0), REPLAY.afterLandMs, true)).toBe(false)
    expect(clipDue(pending(0), REPLAY.maxAfterLandMs, true)).toBe(true)
  })

  it('labels a cascade with how many more fell', () => {
    const { block } = lostBlock(3200)
    expect(clipLabel(block, 1)).toBe('Held for 3.2s')
    expect(clipLabel(block, 3)).toBe('Held for 3.2s (+2 more)')
    block.cause = 'carry'
    expect(clipLabel(block, 2)).toBe("Didn't even reach the wall (+1 more)")
  })

  it('gives the splat card 4 stats', () => {
    const { state, block } = lostBlock(9100)
    state.stats.blocksLost = 3
    state.stats.longestHoldMs = 412_000
    state.section = 1
    expect(splatStats(block, state)).toEqual([
      { label: 'Held for', value: '9.1s' },
      { label: 'Blocks lost', value: '3' },
      { label: 'Best hold', value: '6 min 52s' },
      { label: 'Section', value: '2 of 5' }
    ])
    const split = lostBlock(500, 'split')
    expect(splatStats(split.block, split.state)[0]!.value).toBe('0.0s')
  })
})

describe('the cutaway', () => {
  const base: CutawayCheck = {
    firstFall: false,
    cascade: false,
    holdActive: false,
    away: true,
    carrying: false
  }

  it('cuts away for the first fall, a cascade and a fall during a hold', () => {
    expect(wantsCutaway(base)).toBe(false)
    expect(wantsCutaway({ ...base, firstFall: true })).toBe(true)
    expect(wantsCutaway({ ...base, cascade: true })).toBe(true)
    expect(wantsCutaway({ ...base, holdActive: true })).toBe(true)
  })

  it('never cuts away at the wall or mid-carry', () => {
    expect(wantsCutaway({ ...base, firstFall: true, away: false })).toBe(false)
    expect(wantsCutaway({ ...base, firstFall: true, carrying: true })).toBe(
      false
    )
  })
})

describe('blame lines', () => {
  it('names a long-neglected nail and where you were', () => {
    const { block } = lostBlock(6 * 60_000 + 5000)
    const where = whereYouWere('kitchen', 'bowl')
    expect(where).toBe('You were stirring.')
    expect(blameLine(block, where)).toBe(
      'Last re-nailed 6 min ago. You were stirring.'
    )
    expect(whereYouWere('wall', 'overview')).toBeNull()
  })

  it('keeps the usual lines for fresh nails and other causes', () => {
    const { block } = lostBlock(20_000)
    expect(BLAME.sag).toContain(blameLine(block, 'You were at the shop.'))
    block.cause = 'slam'
    block.lostMs = 1000 + 10 * 60_000
    expect(BLAME.slam).toContain(blameLine(block, 'You were at the shop.'))
  })
})

describe('away alerts and the splat sign', () => {
  it('lets one alert through every 2.5s', () => {
    const alerts = new AlertLimiter()
    expect(alerts.allow(0)).toBe(true)
    expect(alerts.allow(ALERT_GAP_MS - 1)).toBe(false)
    expect(alerts.allow(ALERT_GAP_MS)).toBe(true)
  })

  it('counts whole minutes since the last splat', () => {
    const state = createGameState()
    state.simMs = 2 * 60_000 + 59_000
    expect(minutesWithoutSplat(state)).toBe(2)
    state.lastSplatMs = state.simMs - 1000
    expect(minutesWithoutSplat(state)).toBe(0)
  })
})
