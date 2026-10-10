import { clamp, type Stock } from '../shared'
import { nextId } from './state'
import { MESS, SECTION_COLS, SIDE_WALL_LEFT, SIDE_WALL_RIGHT } from './tuning'
import type {
  CellState,
  GameState,
  Room,
  SectionState,
  Splat,
  SplatColour
} from './types'

// Floor cleaning. A splat of set jelly has a chunk: the first strokes scrape it into a
// tub of floor jelly. Then the mop wipes the smear, and each smear wears the mop head.
// A liquid spill from the kitchen is all smear.

/** Leaves a splat on a floor and returns it. Its smear points left or right by `seed`. */
export function addSplat(
  state: GameState,
  room: Room,
  x: number,
  y: number,
  radius: number,
  flavour: SplatColour,
  seed: number,
  chunk: boolean
): Splat {
  const splat: Splat = {
    id: nextId(state),
    room,
    x,
    y,
    radius,
    flavour,
    seed,
    chunk,
    side: seed % 2 === 0 ? 1 : -1,
    strokes: 0,
    spread: false
  }
  state.splats.push(splat)
  return splat
}

/** Rub strokes a splat needs: the scrape, if it has a chunk, then the mop. */
export function strokesFor(splat: Splat): number {
  return (splat.chunk ? MESS.scrapeStrokes : 0) + MESS.mopStrokes
}

/** True while the next stroke still scrapes the chunk. */
export function scraping(splat: Splat): boolean {
  return splat.chunk && splat.strokes < MESS.scrapeStrokes
}

/** What one rub stroke did. */
export type RubEvent =
  | { type: 'scrape'; left: number }
  /** The chunk went into the tub of floor jelly. */
  | { type: 'tub' }
  | { type: 'mop'; left: number }
  /** Too fast: the smear spread to a second spot. */
  | { type: 'spread'; splat: Splat }
  /** The splat is gone. */
  | { type: 'clean' }
  /** The mop head fell apart after its last smear. */
  | { type: 'worn' }
  /** A spare head from stock fitted itself. */
  | { type: 'spare' }
  /** No head on the mop: the stroke did nothing. */
  | { type: 'no-mop' }

/**
 * One rub stroke on a splat at `speed` (design units per second). Scraping needs no mop
 * head; mopping does, and rubbing faster than the limit spreads the smear once.
 */
export function rubSplat(
  state: GameState,
  splat: Splat,
  speed: number,
  stock: Stock,
  assist: boolean
): RubEvent[] {
  if (!state.splats.includes(splat)) return []
  if (scraping(splat)) {
    splat.strokes++
    if (splat.strokes < MESS.scrapeStrokes)
      return [{ type: 'scrape', left: MESS.scrapeStrokes - splat.strokes }]
    state.tubs++
    return [{ type: 'tub' }]
  }
  const events: RubEvent[] = []
  if (state.mopUses <= 0) {
    if (!fitSpareHead(state, stock)) return [{ type: 'no-mop' }]
    events.push({ type: 'spare' })
  }
  splat.strokes++
  const limit = assist ? MESS.assistRubLimit : MESS.rubLimit
  if (speed > limit && !splat.spread) {
    splat.spread = true
    events.push({ type: 'spread', splat: spreadSmear(state, splat) })
  }
  const left = strokesFor(splat) - splat.strokes
  if (left > 0) {
    events.push({ type: 'mop', left })
    return events
  }
  state.splats.splice(state.splats.indexOf(splat), 1)
  state.mopUses--
  events.push({ type: 'clean' })
  if (state.mopUses === 0) {
    events.push({ type: 'worn' })
    if (fitSpareHead(state, stock)) events.push({ type: 'spare' })
  }
  return events
}

/** Fits a spare mop head from stock when the mop has none left. Returns whether it did. */
export function fitSpareHead(state: GameState, stock: Stock): boolean {
  if (state.mopUses > 0 || !stock.use('mopHeads')) return false
  state.mopUses = MESS.headSmears
  return true
}

/** A second, smaller smear beside the first, towards its smear side. It can't spread. */
function spreadSmear(state: GameState, splat: Splat): Splat {
  let x = splat.x + splat.side * MESS.spreadDistance
  if (splat.room === 'kitchen') x = clamp(x, 40, 560)
  else if (splat.room === 'wall')
    x = clamp(x, SIDE_WALL_LEFT + 40, SIDE_WALL_RIGHT - 40)
  const smear = addSplat(
    state,
    splat.room,
    x,
    splat.y,
    splat.radius * MESS.spreadScale,
    splat.flavour,
    splat.seed + 1,
    false
  )
  smear.spread = true
  return smear
}

/** One splat you will walk through on a carry: where it lies and which way it throws you. */
export interface Puddle {
  at: number
  side: 1 | -1
}

/**
 * The splats on a carry's route, in order. Kitchen splats lie in its first stretch,
 * hallway splats where they fell, and wall-room splats in its last stretch.
 */
export function routePuddles(state: GameState, length: number): Puddle[] {
  const out: Puddle[] = []
  for (const splat of state.splats) {
    const at = routeX(splat, length)
    if (at !== null) out.push({ at, side: splat.side })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Where a splat lies on a route of `length`, or null when the route ends before it. */
export function routeX(splat: Splat, length: number): number | null {
  const end = MESS.roomStretch
  if (splat.room === 'kitchen') return (clamp(splat.x, 0, 600) / 600) * end
  if (splat.room === 'wall') {
    const span = SIDE_WALL_RIGHT - SIDE_WALL_LEFT
    return (
      length - end + (clamp(splat.x - SIDE_WALL_LEFT, 0, span) / span) * end
    )
  }
  return splat.x <= length ? splat.x : null
}

/** Rooms that have splats on their floor, for the mop chores. */
export function messyRooms(state: GameState): Set<Room> {
  const rooms = new Set<Room>()
  for (const splat of state.splats) rooms.add(splat.room)
  return rooms
}

/** True while a wall cell has old jelly or empty nails to scrape off. */
export function dirtyCell(cell: CellState): boolean {
  return cell.residue > 0 || cell.emptyNails.length > 0
}

/** Scraping strokes a cell still needs: 12 for a full smear, at least 1 for bare nails. */
export function scrapesLeft(cell: CellState): number {
  if (!dirtyCell(cell)) return 0
  return Math.max(1, Math.ceil(cell.residue * MESS.cellStrokes - 1e-6))
}

/** What one scraping stroke on a wall cell did. */
export type ScrapeEvent =
  | { type: 'scrape'; left: number }
  /** The cell is clean: no residue, no empty nails. */
  | { type: 'clean' }
  /** Too fast: old jelly flew onto the empty cell next door. */
  | { type: 'fling'; cell: number }

/**
 * One scraping stroke on empty cell `index` of a section at `speed` (design units per
 * second). Each stroke takes a twelfth of a full smear; the last one prises out the
 * empty nails. Scraping too fast flings some jelly next door, when `canFling` allows.
 */
export function scrapeCell(
  section: SectionState,
  index: number,
  speed: number,
  assist: boolean,
  canFling: boolean
): ScrapeEvent[] {
  const cell = section.cells[index]
  if (!cell || cell.block !== null || !dirtyCell(cell)) return []
  const events: ScrapeEvent[] = []
  const limit = assist ? MESS.assistRubLimit : MESS.rubLimit
  if (speed > limit && canFling) {
    const next = flingTarget(section, index)
    if (next >= 0) {
      const target = section.cells[next]!
      target.residue = Math.min(1, target.residue + MESS.flingResidue)
      events.push({ type: 'fling', cell: next })
    }
  }
  cell.residue = Math.max(0, cell.residue - 1 / MESS.cellStrokes)
  if (cell.residue < 1e-6) {
    cell.residue = 0
    cell.emptyNails.length = 0
    events.push({ type: 'clean' })
  } else events.push({ type: 'scrape', left: scrapesLeft(cell) })
  return events
}

/** The empty cell beside `index`, right first, then left, or -1. */
function flingTarget(section: SectionState, index: number): number {
  const col = index % SECTION_COLS
  for (const step of [1, -1]) {
    const c = col + step
    if (c < 0 || c >= SECTION_COLS) continue
    if (section.cells[index + step]?.block === null) return index + step
  }
  return -1
}

/** Cells with old jelly or empty nails on the unlocked sections, for the scrape chore. */
export function dirtyCells(state: GameState): number {
  let count = 0
  for (const section of state.sections) {
    if (section.locked) continue
    for (const cell of section.cells)
      if (cell.block === null && dirtyCell(cell)) count++
  }
  return count
}
