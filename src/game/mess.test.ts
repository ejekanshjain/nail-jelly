import { describe, expect, it } from 'vitest'

import {
  addSplat,
  dirtyCells,
  messyRooms,
  routePuddles,
  rubSplat,
  scrapeCell,
  scrapesLeft,
  strokesFor,
  type RubEvent,
  type ScrapeEvent
} from './mess'
import { createEconomy, createGameState } from './state'
import { MESS } from './tuning'
import type { GameState, Splat } from './types'

const SLOW = 600

function setup() {
  const state = createGameState()
  const { stock } = createEconomy()
  return { state, stock }
}

/** Rubs a splat `n` times at `speed`, returning every event. */
function rub(
  state: GameState,
  stock: ReturnType<typeof setup>['stock'],
  splat: Splat,
  n: number,
  speed = SLOW
): RubEvent[] {
  const events: RubEvent[] = []
  for (let i = 0; i < n; i++)
    events.push(...rubSplat(state, splat, speed, stock, false))
  return events
}

describe('cleaning a splat', () => {
  it('scrapes a chunk into a tub after 5 strokes, then mops it in 7 more', () => {
    const { state, stock } = setup()
    const splat = addSplat(state, 'wall', 300, 1184, 50, 'lime', 4, true)
    expect(strokesFor(splat)).toBe(12)
    const scrape = rub(state, stock, splat, 5)
    expect(scrape.at(-1)).toEqual({ type: 'tub' })
    expect(state.tubs).toBe(1)
    expect(state.mopUses).toBe(MESS.headSmears)
    const mop = rub(state, stock, splat, 7)
    expect(mop.at(-1)).toEqual({ type: 'clean' })
    expect(state.splats).toHaveLength(0)
    expect(state.mopUses).toBe(MESS.headSmears - 1)
  })

  it('mops a kitchen spill in 7 strokes, with no tub', () => {
    const { state, stock } = setup()
    const spill = addSplat(state, 'kitchen', 300, 740, 26, 'lime', 3, false)
    expect(rub(state, stock, spill, 6).every(e => e.type === 'mop')).toBe(true)
    expect(rub(state, stock, spill, 1)).toEqual([{ type: 'clean' }])
    expect(state.tubs).toBe(0)
  })

  it('spreads the smear once, to its side, when you mop too fast', () => {
    const { state, stock } = setup()
    const spill = addSplat(state, 'kitchen', 300, 740, 26, 'lime', 4, false)
    expect(spill.side).toBe(1)
    const events = rub(state, stock, spill, 2, 3000)
    const spread = events.filter(e => e.type === 'spread')
    expect(spread).toHaveLength(1)
    const smear = state.splats[1]!
    expect(smear.x).toBe(300 + MESS.spreadDistance)
    expect(smear.radius).toBeLessThan(spill.radius)
    // The spread smear can't spread again, however fast you go.
    rub(state, stock, smear, 3, 3000)
    expect(state.splats).toHaveLength(2)
    // Assist Mode allows faster mopping.
    const calm = addSplat(state, 'kitchen', 100, 740, 26, 'lime', 6, false)
    expect(
      rubSplat(state, calm, 3000, stock, true).some(e => e.type === 'spread')
    ).toBe(false)
  })

  it('wears the mop head out after 5 smears, then mops nothing without a spare', () => {
    const { state, stock } = setup()
    const events: RubEvent[] = []
    for (let i = 0; i < MESS.headSmears; i++) {
      const spill = addSplat(state, 'kitchen', 300, 740, 26, 'lime', 2, false)
      events.push(...rub(state, stock, spill, 7))
    }
    expect(events.at(-1)).toEqual({ type: 'worn' })
    expect(state.mopUses).toBe(0)
    const next = addSplat(state, 'wall', 200, 1184, 50, 'grape', 2, true)
    // Scraping needs no mop head.
    expect(rub(state, stock, next, 5).at(-1)).toEqual({ type: 'tub' })
    expect(rub(state, stock, next, 1)).toEqual([{ type: 'no-mop' }])
    expect(next.strokes).toBe(5)
  })

  it('fits a spare head by itself', () => {
    const { state, stock } = setup()
    stock.add('mopHeads', 1)
    state.mopUses = 1
    const spill = addSplat(state, 'kitchen', 300, 740, 26, 'lime', 2, false)
    const events = rub(state, stock, spill, 7)
    expect(events.slice(-3)).toEqual([
      { type: 'clean' },
      { type: 'worn' },
      { type: 'spare' }
    ])
    expect(state.mopUses).toBe(MESS.headSmears)
    expect(stock.count('mopHeads')).toBe(0)
  })
})

describe('puddles on the carry route', () => {
  it('come from unmopped splats only, kitchen first and wall room last', () => {
    const { state, stock } = setup()
    expect(routePuddles(state, 2400)).toEqual([])
    addSplat(state, 'wall', 1144, 1184, 50, 'lime', 1, true)
    addSplat(state, 'kitchen', 300, 740, 26, 'lime', 2, false)
    const hall = addSplat(state, 'hallway', 900, 604, 40, 'lime', 3, true)
    addSplat(state, 'hallway', 2000, 604, 40, 'lime', 3, true)
    const puddles = routePuddles(state, 1200)
    expect(puddles.map(p => p.at)).toEqual([150, 900, 1200])
    expect(puddles.map(p => p.side)).toEqual([1, -1, -1])
    rub(state, stock, hall, 12)
    expect(routePuddles(state, 2400).map(p => p.at)).toEqual([150, 2000, 2400])
    expect(messyRooms(state)).toEqual(new Set(['wall', 'kitchen', 'hallway']))
  })
})

describe('scraping the wall', () => {
  it('takes 12 strokes to clear a full smear and its empty nails', () => {
    const { state } = setup()
    const section = state.sections[1]!
    const cell = section.cells[5]!
    cell.residue = 1
    cell.emptyNails.push({ x: 10, y: 10 }, { x: 20, y: 10 })
    expect(scrapesLeft(cell)).toBe(12)
    const events: ScrapeEvent[] = []
    for (let i = 0; i < 11; i++)
      events.push(...scrapeCell(section, 5, SLOW, false, false))
    expect(events.at(-1)).toEqual({ type: 'scrape', left: 1 })
    expect(cell.emptyNails).toHaveLength(2)
    expect(dirtyCells(state)).toBe(1)
    expect(scrapeCell(section, 5, SLOW, false, false)).toEqual([
      { type: 'clean' }
    ])
    expect(cell.emptyNails).toHaveLength(0)
    expect(dirtyCells(state)).toBe(0)
    expect(scrapeCell(section, 5, SLOW, false, false)).toEqual([])
  })

  it('prises out a bare-wall nail in one stroke and leaves occupied cells alone', () => {
    const { state } = setup()
    const section = state.sections[1]!
    section.cells[2]!.emptyNails.push({ x: 0, y: 0 })
    expect(scrapesLeft(section.cells[2]!)).toBe(1)
    expect(scrapeCell(section, 2, SLOW, false, false)).toEqual([
      { type: 'clean' }
    ])
    section.cells[3]!.residue = 1
    section.cells[3]!.block = 99
    expect(scrapeCell(section, 3, SLOW, false, false)).toEqual([])
  })

  it('flings jelly onto the empty cell next door when you scrape too fast', () => {
    const { state } = setup()
    const section = state.sections[1]!
    section.cells[7]!.residue = 1
    // Cell 7 ends its row, so the jelly lands on the left, in cell 6.
    const events = scrapeCell(section, 7, 3000, false, true)
    expect(events[0]).toEqual({ type: 'fling', cell: 6 })
    expect(section.cells[6]!.residue).toBeCloseTo(MESS.flingResidue)
    expect(scrapeCell(section, 7, 3000, false, false)[0]?.type).toBe('scrape')
    expect(scrapeCell(section, 7, 3000, true, true)[0]?.type).toBe('scrape')
  })
})
