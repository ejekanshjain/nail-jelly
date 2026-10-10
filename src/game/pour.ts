import { clamp } from '../shared'
import { POUR } from './tuning'

/** Pouring a batch into its moulds, one at a time. */
export interface Pour {
  /** Fill of each mould, 0 to 1. */
  fills: number[]
  /** Whether each mould overflowed. */
  spilled: boolean[]
  /** The mould under the jug. */
  index: number
  /** Flow from 0 to 1. It ramps up while held and drips on after release. */
  flow: number
  /** Time since the flow stopped on a mould that has some jelly, or -1. */
  idleMs: number
  done: boolean
}

export function createPour(moulds: number): Pour {
  return {
    fills: Array<number>(moulds).fill(0),
    spilled: Array<boolean>(moulds).fill(false),
    index: 0,
    flow: 0,
    idleMs: -1,
    done: false
  }
}

/** What one step of pouring did. `short`: it stopped below `POUR.minFill` and waits. */
export type PourEvent = 'spill' | 'next' | 'done' | 'short' | null

/**
 * Advances the pour by `dtMs`. Holding ramps the flow up; letting go lets it drip on
 * for a moment. Past 1.00 the mould overflows once. Half a second after the flow stops,
 * the jug moves to the next mould, and after the last one the pour is done. A mould
 * still under `POUR.minFill` then says `short` once and waits for more.
 */
export function stepPour(
  pour: Pour,
  dtMs: number,
  holding: boolean
): PourEvent {
  if (pour.done) return null
  pour.flow = holding
    ? Math.min(1, pour.flow + dtMs / POUR.rampMs)
    : Math.max(0, pour.flow - dtMs / POUR.decayMs)
  const i = pour.index
  const raw = pour.fills[i]! + (POUR.fillPerSecond * pour.flow * dtMs) / 1000
  const after = Math.min(POUR.spillAbove, raw)
  pour.fills[i] = after
  if (!pour.spilled[i] && raw > POUR.spillAbove) {
    pour.spilled[i] = true
    return 'spill'
  }
  if (holding || pour.flow > 0 || after === 0) {
    pour.idleMs = -1
    return null
  }
  const idleBefore = Math.max(0, pour.idleMs)
  pour.idleMs = idleBefore + dtMs
  if (pour.idleMs < POUR.nextAfterMs) return null
  // Too little to make a block: wait for more, saying so once.
  if (after < POUR.minFill)
    return idleBefore < POUR.nextAfterMs ? 'short' : null
  pour.idleMs = -1
  if (pour.index + 1 < pour.fills.length) {
    pour.index++
    return 'next'
  }
  pour.done = true
  return 'done'
}

/** How close a fill came to the line: 1 on it, 0 a window away or further. */
export function pourAccuracy(fill: number, assist: boolean): number {
  const window = assist ? POUR.assistWindow : POUR.window
  return clamp(1 - Math.abs(fill - POUR.line) / window, 0, 1)
}

/**
 * How much of a block's quality a mould's fill keeps: 1 at the line or above, less the
 * further short of it. A thin block tears and drops sooner.
 */
export function thinFactor(fill: number): number {
  const short = Math.max(0, POUR.line - fill) / POUR.line
  return 1 - POUR.thin * short
}
