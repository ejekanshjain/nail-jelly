import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { BLAME, formatHeld, heldForLabel } from './labels'
import {
  gradeFor,
  lockBonus,
  updateSection,
  upCount,
  type SectionEvent
} from './section'
import { WallSim } from './sim/wallSim'
import { addStoolBlock, createEconomy, createGameState } from './state'
import { HOLD_MS, PAY_HELD_MS, SECTION_CELLS } from './tuning'
import type { BlockState } from './types'

const STEP = 1000 / 60

function setup() {
  const state = createGameState()
  const wall = new WallSim(state, rng(9))
  const { wallet } = createEconomy()
  const events: SectionEvent[] = []
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      state.simMs += STEP
      wall.update(STEP)
      events.push(...updateSection(state, wall, wallet, STEP))
    }
  }
  const fill = (count: number) => {
    for (let cell = 0; cell < count; cell++) {
      const block = addStoolBlock(state, 0.9, 'lime')
      wall.place(block.id, cell)
      wall.hammer(block.id, 0, 0.69)
      wall.hammer(block.id, 3, 0.69)
    }
  }
  return { state, wall, wallet, events, step, fill }
}

describe('section hold', () => {
  it('starts only with 12 up and nothing in the hand', () => {
    const { state, wall, events, step, fill } = setup()
    fill(SECTION_CELLS - 1)
    step(0.5)
    expect(events.some(e => e.type === 'hold-start')).toBe(false)
    const last = addStoolBlock(state, 0.9, 'lime')
    wall.place(last.id, SECTION_CELLS - 1)
    step(0.5)
    expect(events.some(e => e.type === 'hold-start')).toBe(false)
    wall.hammer(last.id, 0, 0.69)
    wall.hammer(last.id, 3, 0.69)
    step(0.1)
    expect(upCount(state, 0)).toBe(SECTION_CELLS)
    expect(events.filter(e => e.type === 'hold-start')).toHaveLength(1)
  })

  it('resets when a block falls, and locks at zero with one bonus', () => {
    const { state, wall, wallet, events, step, fill } = setup()
    fill(SECTION_CELLS)
    step(1)
    wall.drop(state.sections[0]!.cells[5]!.block!, 'sag')
    step(0.1)
    expect(events.some(e => e.type === 'hold-reset')).toBe(true)
    expect(state.sections[0]!.holdActive).toBe(false)
    expect(state.sections[0]!.holdLeftMs).toBe(HOLD_MS)

    const refill = addStoolBlock(state, 0.9, 'lime')
    step(2)
    wall.place(refill.id, 5)
    wall.hammer(refill.id, 0, 0.69)
    wall.hammer(refill.id, 3, 0.69)
    const before = wallet.coins()
    step(HOLD_MS / 1000 + 0.5)
    const locks = events.filter(e => e.type === 'lock')
    expect(locks).toHaveLength(1)
    expect(state.sections[0]!.locked).toBe(true)
    expect(state.section).toBe(1)
    expect(wallet.coins() - before).toBeGreaterThanOrEqual(lockBonus(0))
    expect(wall.perf().particles).toBe(0)
    step(2)
    expect(events.filter(e => e.type === 'lock')).toHaveLength(1)
  })

  it('pays each block 4 coins once after it holds long enough', () => {
    const { wallet, events, step, fill } = setup()
    fill(1)
    step(PAY_HELD_MS / 1000 - 1)
    expect(events.some(e => e.type === 'pay')).toBe(false)
    const before = wallet.coins()
    step(2)
    step(5)
    expect(events.filter(e => e.type === 'pay')).toHaveLength(1)
    expect(wallet.coins() - before).toBe(4)
  })

  it('grades a locked section by its weakest grip', () => {
    expect(gradeFor(0.8)).toBe('A')
    expect(gradeFor(0.6)).toBe('B')
    expect(gradeFor(0.5)).toBe('C')
    expect(gradeFor(0.2)).toBe('D')
    expect([0, 1, 2, 3, 4].map(lockBonus)).toEqual([15, 20, 25, 30, 35])
  })
})

describe('loss labels', () => {
  const block = (overrides: Partial<BlockState>) =>
    ({
      id: 7,
      firstBiteMs: 1000,
      lostMs: 10_100,
      cause: 'sag',
      ...overrides
    }) as BlockState

  it('formats held times under and over a minute', () => {
    expect(heldForLabel(block({}))).toBe('Held for 9.1s')
    expect(formatHeld(412_700)).toBe('6 min 52s')
  })

  it('labels blocks that never held', () => {
    expect(heldForLabel(block({ cause: 'split' }))).toBe(
      'Held for 0.0s. SPLORCH.'
    )
    expect(heldForLabel(block({ cause: 'hand', firstBiteMs: null }))).toBe(
      'Never touched the wall.'
    )
    expect(heldForLabel(block({ cause: 'carry', firstBiteMs: null }))).toBe(
      "Didn't even reach the wall."
    )
  })

  it('has at least 5 blame lines for every cause', () => {
    for (const lines of Object.values(BLAME))
      expect(lines.length).toBeGreaterThanOrEqual(5)
  })
})
