import { describe, expect, it } from 'vitest'

import {
  arriveMs,
  collapseOrder,
  endingLabel,
  endingStats,
  failFinal,
  heldMs,
  shutAtMs,
  refillQueue,
  returnGag,
  settleFinal,
  showVerdict,
  leaveFinal,
  startFinal,
  stepFinal,
  verdictCaption,
  verdictLine,
  weakestSection,
  type FinalEvent,
  type FinalTestState
} from './finalTest'
import { createBlock, createGameState } from './state'
import { inputsForQuality } from './quality'
import { FINAL, HOLD_MS, SECTION_CELLS, SECTION_COUNT } from './tuning'
import type { GameState } from './types'

const STEP = 1000 / 60

/**
 * Steps the test for `ms`, returning every event with the time it came at and how far
 * the test clock had run.
 */
function run(
  final: FinalTestState,
  ms: number
): { at: number; clock: number; event: FinalEvent }[] {
  const out: { at: number; clock: number; event: FinalEvent }[] = []
  const events: FinalEvent[] = []
  for (let t = 0; t < ms; t += STEP) {
    events.length = 0
    stepFinal(final, STEP, events)
    for (const event of events)
      out.push({ at: t, clock: HOLD_MS - final.holdLeftMs, event })
  }
  return out
}

/** A full wall of proxies with two nails at `grip` each. */
function fullWall(grip = 0.8): GameState {
  const state = createGameState()
  for (const section of state.sections)
    section.cells.forEach((cell, index) => {
      const block = createBlock(state, 0.8, 'lime', inputsForQuality(0.8))
      block.status = 'proxy'
      block.section = section.index
      block.cell = index
      block.fixings = [0, 3].map(particle => ({
        id: block.id * 10 + particle,
        kind: 'nail' as const,
        particle,
        x: 0,
        y: 0,
        grip,
        rehammers: 0
      }))
      cell.block = block.id
    })
  return state
}

/** Moves a fresh attempt on to the start of the test clock. */
function toTest(final: FinalTestState): void {
  run(
    final,
    arriveMs(final.attempt) + 4 * FINAL.snipEveryMs + FINAL.snipEndMs + STEP * 3
  )
  expect(final.stage).toBe('touches')
  run(final, FINAL.touchesMs + STEP * 2)
  expect(final.stage).toBe('test')
}

describe('the final test', () => {
  it('arrives, snips every section in turn, gives 20s of last touches, then starts the clock', () => {
    const final = startFinal(null)
    expect(final.attempt).toBe(1)
    const arrival = run(final, FINAL.arriveMs - STEP)
    expect(arrival).toEqual([])
    expect(final.stage).toBe('arrive')
    const snips = run(
      final,
      STEP * 2 + 4 * FINAL.snipEveryMs + FINAL.snipEndMs + STEP * 2
    )
    const sections = snips
      .filter(e => e.event.type === 'snip')
      .map(e => (e.event as { section: number }).section)
    expect(sections).toEqual([0, 1, 2, 3, 4])
    expect(snips.some(e => e.event.type === 'touches')).toBe(true)
    expect(final.stage).toBe('touches')
    const touches = run(final, FINAL.touchesMs + STEP * 2)
    expect(touches.map(e => e.event.type)).toEqual(['start'])
    expect(final.holdLeftMs).toBeLessThanOrEqual(HOLD_MS)
  })

  it('sends the fly at 12s and the slam at 35s, once each, on every attempt', () => {
    for (const previous of [null, startFinal(startFinal(null))]) {
      const final = startFinal(previous)
      toTest(final)
      const events = run(final, HOLD_MS + STEP)
      const at = (type: string) =>
        events.filter(e => e.event.type === type).map(e => e.clock)
      expect(at('fly')).toHaveLength(1)
      expect(at('slam')).toHaveLength(1)
      expect(
        Math.abs(at('fly')[0]! - (FINAL.flyAtMs * HOLD_MS) / 60_000)
      ).toBeLessThan(STEP * 2)
      expect(
        Math.abs(at('slam')[0]! - (FINAL.slamAtMs * HOLD_MS) / 60_000)
      ).toBeLessThan(STEP * 2)
      expect(at('held')).toHaveLength(1)
      expect(final.stage).toBe('passed')
    }
  })

  it('comes back quicker with a bigger gag each retry', () => {
    expect(arriveMs(1)).toBe(FINAL.arriveMs)
    expect(arriveMs(2)).toBe(FINAL.returnMs)
    expect([1, 2, 3, 4, 7].map(returnGag)).toEqual([
      'none',
      'snacks',
      'neighbour',
      'crew',
      'crew'
    ])
  })

  it('stops the clock at the first fall and lets the cascade run before settling', () => {
    const final = startFinal(null)
    toTest(final)
    run(final, 20_000)
    const left = final.holdLeftMs
    expect(failFinal(final, 2)).toBe(true)
    expect(final.failedLeftMs).toBe(left)
    expect(final.failedEarly).toBe(false)
    // Later falls only count towards their section.
    expect(failFinal(final, 2)).toBe(false)
    expect(final.falls[2]).toBe(2)
    const events = run(final, FINAL.cascadeMs + 1000)
    expect(events.filter(e => e.event.type === 'settle')).toHaveLength(1)
    expect(final.holdLeftMs).toBe(left)
    showVerdict(final)
    expect(final.stage).toBe('verdict')
  })

  it('fails early when a block falls during the snip or last touches, not before', () => {
    const arriving = startFinal(null)
    expect(failFinal(arriving, 0)).toBe(false)
    run(
      arriving,
      FINAL.arriveMs + 4 * FINAL.snipEveryMs + FINAL.snipEndMs + STEP * 3
    )
    expect(arriving.stage).toBe('touches')
    expect(failFinal(arriving, 0)).toBe(true)
    expect(arriving.failedEarly).toBe(true)
    expect(verdictLine(arriving)).toBe(
      'It fell before he even started the clock.'
    )
    expect(verdictCaption(arriving)).toBe('Held for 0.0s of 60')
  })

  it('reads a near miss, and captions the replay on the test clock', () => {
    const final = startFinal(null)
    final.stage = 'test'
    final.holdLeftMs = 800
    failFinal(final, 0)
    expect(verdictLine(final)).toBe('0.8s short. Uncle keeps his car.')
    const early = startFinal(null)
    early.stage = 'test'
    early.holdLeftMs = HOLD_MS - 23_400
    failFinal(early, 0)
    expect(verdictLine(early)).toBe('Uncle keeps his car.')
    expect(verdictCaption(early)).toBe('Held for 23.4s of 60')
    expect(verdictCaption(final)).toBe('Held for 59.2s of 60')
    // The last moment: 59.9s held and 0.1s short, never 60.0s and short.
    const last = startFinal(null)
    last.stage = 'test'
    last.holdLeftMs = 20
    failFinal(last, 0)
    expect(verdictCaption(last)).toBe('Held for 59.9s of 60')
    expect(verdictLine(last)).toBe('0.1s short. Uncle keeps his car.')
  })

  it('shakes the weakest section off block by block, then hands the wall back', () => {
    const state = fullWall()
    const final = startFinal(null)
    final.stage = 'test'
    failFinal(final, 3)
    final.falls[3] = 2
    expect(settleFinal(final, state)).toBe(3)
    expect(final.dropIds).toHaveLength(SECTION_CELLS)
    showVerdict(final)
    leaveFinal(final)
    const events = run(
      final,
      FINAL.lineMs +
        FINAL.walkMs +
        SECTION_CELLS * FINAL.dropEveryMs +
        FINAL.afterDropMs +
        STEP * 2
    )
    const types = events.map(e => e.event.type)
    expect(types[0]).toBe('door')
    const drops = events.filter(e => e.event.type === 'drop')
    expect(drops.map(e => (e.event as { blockId: number }).blockId)).toEqual(
      final.dropIds
    )
    // 80 ms apart, to the nearest step.
    expect(
      Math.abs(drops[2]!.at - drops[1]!.at - FINAL.dropEveryMs)
    ).toBeLessThan(STEP)
    expect(types.at(-1)).toBe('rebuild')
    expect(final.stage).toBe('rebuild')
  })
})

describe('the weakest section', () => {
  it('is the one with the most falls', () => {
    const state = fullWall(0.9)
    const falls = Array<number>(SECTION_COUNT).fill(0)
    falls[1] = 1
    falls[4] = 3
    expect(weakestSection(state, falls)).toBe(4)
  })

  it('breaks a tie on the lowest mean of weakest grip times integrity', () => {
    const state = fullWall(0.9)
    const falls = [1, 0, 1, 0, 0]
    // Section 2 has one sagging block; section 0 has a torn one that grips well.
    const sagging = state.blocks.get(state.sections[2]!.cells[5]!.block!)!
    sagging.fixings[0]!.grip = 0.2
    const torn = state.blocks.get(state.sections[0]!.cells[5]!.block!)!
    torn.torn = 3
    expect(weakestSection(state, falls)).toBe(2)
    // Tear section 0 badly enough and it becomes the weaker one.
    for (const cell of state.sections[0]!.cells)
      state.blocks.get(cell.block!)!.torn = 12
    expect(weakestSection(state, falls)).toBe(0)
  })

  it('counts an empty cell as nothing, so a section with holes is weaker', () => {
    const state = fullWall(0.9)
    state.sections[1]!.cells[0]!.block = null
    expect(weakestSection(state, [0, 0, 0, 0, 0])).toBe(1)
  })
})

describe('refills', () => {
  it('queue every other section that lost a block, in wall order', () => {
    const state = fullWall()
    state.sections[4]!.cells[2]!.block = null
    state.sections[0]!.cells[7]!.block = null
    state.sections[3]!.cells[0]!.block = null
    expect(refillQueue(state, 3)).toEqual([0, 4])
  })
})

describe('the ending', () => {
  it('stares, hands over the keys, walks out and slams the door, then the wall comes down', () => {
    const state = fullWall()
    const final = startFinal(null)
    toTest(final)
    run(final, HOLD_MS + STEP * 2)
    expect(final.stage).toBe('passed')
    const events: { at: number; event: FinalEvent }[] = []
    const step: FinalEvent[] = []
    for (
      let t = 0;
      t < shutAtMs() + FINAL.endingAfterMs + STEP * 3;
      t += STEP
    ) {
      step.length = 0
      stepFinal(final, STEP, step)
      for (const event of step) {
        events.push({ at: final.stageMs, event })
        // The runner lines the wall up to fall when the door slams.
        if (event.type === 'shut') final.dropIds = collapseOrder(state)
      }
    }
    const at = (type: string) => events.find(e => e.event.type === type)!.at
    expect(at('keys')).toBeGreaterThanOrEqual(FINAL.stareMs)
    expect(at('exit')).toBeGreaterThanOrEqual(FINAL.stareMs + FINAL.keysMs)
    expect(at('shut')).toBeGreaterThanOrEqual(shutAtMs())
    const collapse = events.filter(e => e.event.type === 'collapse')
    expect(collapse).toHaveLength(SECTION_COUNT * SECTION_CELLS)
    // The last block goes within 1.8s of the slam, before the ending screen.
    expect(collapse.at(-1)!.at - at('shut')).toBeLessThanOrEqual(
      SECTION_COUNT * SECTION_CELLS * FINAL.collapseEveryMs + STEP
    )
    expect(at('ending')).toBeGreaterThan(collapse.at(-1)!.at)
  })

  it('measures the hold from the clock to his door slam', () => {
    const final = startFinal(null)
    final.stage = 'passed'
    final.stageMs = 1000
    expect(heldMs(final)).toBe(HOLD_MS + 1000)
    final.stageMs = shutAtMs() + 5000
    expect(heldMs(final)).toBe(HOLD_MS + shutAtMs())
    expect(endingLabel(final)).toBe(
      `Held for ${((HOLD_MS + shutAtMs()) / 1000).toFixed(1)}s. Then he shut the door.`
    )
  })

  it('brings the top sections down first and every block exactly once', () => {
    const state = fullWall()
    const order = collapseOrder(state)
    expect(new Set(order).size).toBe(SECTION_COUNT * SECTION_CELLS)
    const sectionOf = (id: number) => state.blocks.get(id)!.section
    expect(sectionOf(order[0]!)).toBe(4)
    expect([0, 1]).toContain(sectionOf(order.at(-1)!))
  })

  it('lists blocks lost, the best hold, bare-wall nails and the car', () => {
    const state = fullWall()
    state.stats.blocksLost = 13
    state.stats.longestHoldMs = 9 * 60_000
    state.stats.bareWallNails = 4
    expect(endingStats(state).map(s => s.value)).toEqual([
      '13',
      '9 min 0s',
      '4',
      'Yours'
    ])
    // A block still on the wall since the first minute held the longest.
    state.blocks.values().next().value!.firstBiteMs = 60_000
    state.simMs = 62 * 60_000 + 14_000
    expect(endingStats(state)[1]!.value).toBe('61 min 14s')
  })
})
