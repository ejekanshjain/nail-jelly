import { formatHeld, heldForLabel } from './labels'
import { ALERT_GAP_MS, REPLAY } from './tuning'
import type { BlockState, GameState } from './types'

// The rules behind splat replays and away alerts: when a clip is taken, how a cascade
// reads, when the game cuts away to the wall, and how often alerts may toast.

/** Blocks falling together, filmed as one clip. The first block is the headline. */
export interface PendingClip {
  blocks: number[]
  /** Simulation time the first block landed, or null while all are in the air. */
  landedMs: number | null
  /** Dropped off the tray in the hallway, not off the wall. */
  carry: boolean
  /** Where you were when the first block went, for its blame line. */
  where: string | null
}

/**
 * True once the clip should be taken: `afterLandMs` after the first landing when nothing
 * else is falling, and never later than `maxAfterLandMs`.
 */
export function clipDue(
  pending: PendingClip,
  simMs: number,
  stillFalling: boolean
): boolean {
  if (pending.landedMs === null) return false
  const since = simMs - pending.landedMs
  if (since >= REPLAY.maxAfterLandMs) return true
  return since >= REPLAY.afterLandMs && !stillFalling
}

/** The replay's caption: "Held for 3.2s", plus "(+2 more)" for a cascade. */
export function clipLabel(first: BlockState, count: number): string {
  const label = heldForLabel(first)
  if (count <= 1) return label
  return `${label.replace(/\.$/, '')} (+${count - 1} more)`
}

/** What decides a "Meanwhile, at the Wall…" cutaway. */
export interface CutawayCheck {
  /** No block had fallen off the wall before this one. */
  firstFall: boolean
  /** It joins a clip that is already filming another fall. */
  cascade: boolean
  /** The section's 60s hold was running. */
  holdActive: boolean
  /** You are in another room, so you can't see the wall. */
  away: boolean
  /** Mid-carry: a cutaway would cost you the tray, so the replay waits for the corner. */
  carrying: boolean
}

/** The first fall, a cascade and a fall during a hold cut away to the wall when you are elsewhere. */
export function wantsCutaway(check: CutawayCheck): boolean {
  if (!check.away || check.carrying) return false
  return check.firstFall || check.cascade || check.holdActive
}

/** A share card stat row. */
export interface SplatStat {
  label: string
  value: string
}

/** The splat card's 4 stats: held for, blocks lost so far, best hold, section. */
export function splatStats(block: BlockState, state: GameState): SplatStat[] {
  const held =
    block.firstBiteMs !== null &&
    block.lostMs !== null &&
    block.cause !== 'split'
      ? formatHeld(block.lostMs - block.firstBiteMs)
      : '0.0s'
  return [
    { label: 'Held for', value: held },
    { label: 'Blocks lost', value: String(state.stats.blocksLost) },
    { label: 'Best hold', value: formatHeld(state.stats.longestHoldMs) },
    {
      label: 'Section',
      value: `${(block.section >= 0 ? block.section : state.section) + 1} of 5`
    }
  ]
}

/** Whole minutes since the last block splatted, for the sign on the wall. */
export function minutesWithoutSplat(state: GameState): number {
  return Math.max(0, Math.floor((state.simMs - state.lastSplatMs) / 60_000))
}

/** Lets an away alert through at most once every `ALERT_GAP_MS` of simulation time. */
export class AlertLimiter {
  private lastMs = -Infinity

  /** True, and starts a new gap, when an alert may show at `simMs`. */
  allow(simMs: number): boolean {
    if (simMs - this.lastMs < ALERT_GAP_MS) return false
    this.lastMs = simMs
    return true
  }
}
