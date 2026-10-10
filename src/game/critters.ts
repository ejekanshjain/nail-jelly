import { randRange, type Rng } from '../shared'
import { rollTears } from './hammer'
import { isUp } from './section'
import { CAT, FLY, SECTION_COLS } from './tuning'
import type { BlockState, GameState } from './types'

// The fly and the cat as plain state machines. The scenes move and draw them; these
// rules decide when each one lands, bites, wiggles, jumps and leaves.

// ---------------------------------------------------------------- The fly

export type FlyPhase = 'arrive' | 'landed' | 'leave' | 'swatted' | 'gone'

export interface FlyState {
  phase: FlyPhase
  /** Time spent in the current phase. */
  phaseMs: number
  /** The block it flies to or sits on, and the particle it sits on. */
  blockId: number
  particle: number
  bites: number
}

/** What the fly did this step: landed, took a bite, started to leave, or left. */
export type FlyEvent = 'land' | 'bite' | 'leave' | 'gone'

export function createFly(blockId: number, particle: number): FlyState {
  return { phase: 'arrive', phaseMs: 0, blockId, particle, bites: 0 }
}

function flyTo(fly: FlyState, phase: FlyPhase): void {
  fly.phase = phase
  fly.phaseMs = 0
}

/**
 * Moves the fly on by `dtMs`. It lands after its flight, bites every few seconds, and
 * leaves after its stay or as soon as its block is no longer up.
 */
export function stepFly(
  fly: FlyState,
  dtMs: number,
  blockUp: boolean,
  out: FlyEvent[]
): void {
  fly.phaseMs += dtMs
  switch (fly.phase) {
    case 'arrive':
    case 'landed':
      if (!blockUp || (fly.phase === 'landed' && fly.phaseMs >= FLY.stayMs)) {
        flyTo(fly, 'leave')
        out.push('leave')
      } else if (fly.phase === 'arrive') {
        if (fly.phaseMs < FLY.arriveMs) return
        flyTo(fly, 'landed')
        out.push('land')
      } else
        while (fly.phaseMs >= (fly.bites + 1) * FLY.biteEveryMs) {
          fly.bites++
          out.push('bite')
        }
      return
    case 'leave':
    case 'swatted':
      if (fly.phaseMs < (fly.phase === 'leave' ? FLY.leaveMs : FLY.squashMs))
        return
      flyTo(fly, 'gone')
      out.push('gone')
  }
}

/**
 * Swats the fly. Returns 'jelly' when it sat on a block, so the swat hits the jelly too,
 * 'air' for a clean kill in flight, or null when there is nothing left to swat.
 */
export function swatFly(fly: FlyState): 'jelly' | 'air' | null {
  if (fly.phase !== 'arrive' && fly.phase !== 'landed') return null
  const where = fly.phase === 'landed' ? 'jelly' : 'air'
  flyTo(fly, 'swatted')
  return where
}

/** The block a fly goes for: any block up in the list, weaker jelly more likely. */
export function pickFlyBlock(
  blocks: readonly BlockState[],
  random: Rng
): BlockState | null {
  let total = 0
  for (const block of blocks) if (isUp(block)) total += FLY.pickBias - block.q
  let roll = random() * total
  let last: BlockState | null = null
  for (const block of blocks) {
    if (!isUp(block)) continue
    last = block
    roll -= FLY.pickBias - block.q
    if (roll < 0) return block
  }
  return last
}

/** Springs one bite tears: one, plus one more on the block's extra-tear roll. Noodles stop it. */
export function biteTears(block: BlockState, random: Rng): number {
  if (block.noodles) return 0
  return rollTears(FLY.biteTears, block.q, random, block.mesh)
}

// ---------------------------------------------------------------- The cat

export type CatPhase =
  | 'sill'
  | 'stare'
  | 'hop'
  | 'wiggle'
  | 'jump'
  | 'hang'
  | 'leave'
  | 'shooed'
  | 'gone'

export interface CatState {
  phase: CatPhase
  phaseMs: number
  /** The block it goes for, picked when it hops down. */
  blockId: number | null
}

/**
 * What the cat did this step. 'grab' lands on the block, 'drop' lets go, and 'bored'
 * walks off because nothing is left to jump at.
 */
export type CatEvent =
  'stare' | 'hop' | 'wiggle' | 'jump' | 'grab' | 'drop' | 'bored' | 'gone'

/** What the cat looks at each step. */
export interface CatInput {
  /** You are in the wall room to see it. It waits on the windowsill until you are. */
  present: boolean
  /** The block it would jump at now, or null. Read once, when it hops down. */
  pick: () => number | null
  /** Whether a block is still up on the wall. */
  isUp: (blockId: number) => boolean
}

export function createCat(): CatState {
  return { phase: 'sill', phaseMs: 0, blockId: null }
}

function catTo(cat: CatState, phase: CatPhase): void {
  cat.phase = phase
  cat.phaseMs = 0
}

/** How long each timed phase lasts. */
const CAT_MS: Partial<Record<CatPhase, number>> = {
  stare: CAT.stareMs,
  hop: CAT.hopMs,
  wiggle: CAT.wiggleMs,
  jump: CAT.jumpMs,
  hang: CAT.hangMs,
  leave: CAT.leaveMs,
  shooed: CAT.fleeMs
}

/**
 * Moves the cat on by `dtMs`. It waits on the windowsill until you are present, stares,
 * hops down under a block, wiggles, jumps, hangs on, then walks off.
 */
export function stepCat(
  cat: CatState,
  dtMs: number,
  input: CatInput,
  out: CatEvent[]
): void {
  cat.phaseMs += dtMs
  if (cat.phase === 'sill') {
    if (!input.present) return
    catTo(cat, 'stare')
    out.push('stare')
    return
  }
  // Walking out mid-stare sends it back to waiting.
  if (cat.phase === 'stare' && !input.present) {
    catTo(cat, 'sill')
    return
  }
  const length = CAT_MS[cat.phase]
  if (length === undefined || cat.phaseMs < length) return
  const targetUp = cat.blockId !== null && input.isUp(cat.blockId)
  switch (cat.phase) {
    case 'stare':
      cat.blockId = input.pick()
      if (cat.blockId === null) {
        catTo(cat, 'leave')
        out.push('bored')
      } else {
        catTo(cat, 'hop')
        out.push('hop')
      }
      return
    case 'hop':
      catTo(cat, 'wiggle')
      out.push('wiggle')
      return
    case 'wiggle':
    case 'jump':
      if (!targetUp) {
        catTo(cat, 'leave')
        out.push('bored')
      } else if (cat.phase === 'wiggle') {
        catTo(cat, 'jump')
        out.push('jump')
      } else {
        catTo(cat, 'hang')
        out.push('grab')
      }
      return
    case 'hang':
      catTo(cat, 'leave')
      out.push('drop')
      return
    default:
      catTo(cat, 'gone')
      out.push('gone')
  }
}

/** Shoos the cat while it gets ready to jump. Returns whether it worked. */
export function shooCat(cat: CatState): boolean {
  if (cat.phase !== 'hop' && cat.phase !== 'wiggle') return false
  catTo(cat, 'shooed')
  return true
}

/** The cat's target: a block up in the lowest row of the section that has one. */
export function pickCatBlock(
  state: GameState,
  section: number,
  random: Rng
): number | null {
  const cells = state.sections[section]?.cells ?? []
  let row = -1
  const ids: number[] = []
  cells.forEach((cell, index) => {
    if (cell.block === null || !isUp(state.blocks.get(cell.block))) return
    const r = Math.floor(index / SECTION_COLS)
    if (r > row) {
      row = r
      ids.length = 0
    }
    if (r === row) ids.push(cell.block)
  })
  return ids[Math.floor(random() * ids.length)] ?? null
}

/** Springs the cat's claws tear. Noodles halve them, rounding down. */
export function catTears(block: BlockState): number {
  return block.noodles ? Math.floor(CAT.tears / 2) : CAT.tears
}

// ---------------------------------------------------------------- The hallway cat

/**
 * Where the cat sits on a carry's route from section 4 on, clear of the puddles, or
 * null when it stays out of the hallway.
 */
export function hallwayCatAt(
  section: number,
  length: number,
  puddles: readonly { at: number }[],
  random: Rng
): number | null {
  if (section < CAT.hallFromSection) return null
  for (let i = 0; i < 8; i++) {
    const at = length * randRange(CAT.hallFrom, CAT.hallTo, random)
    if (puddles.every(p => Math.abs(p.at - at) >= CAT.puddleGap)) return at
  }
  return null
}
