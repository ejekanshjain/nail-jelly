import { isDone, startTimer } from '../shared'
import { NOODLES } from './tuning'
import type { GameState, NoodleState, StoveMix } from './types'

// Noodle Reinforcement: each batch's noodles boil on the back hob for a real-time minute,
// then you hold to drain them. Let go too early and they water the jelly down; too late
// and they turn to mush, or slide into the sink.

/** How a drain went: watery, good, mush, or the whole lot down the sink. */
export type DrainResult = 'watery' | 'good' | 'mush' | 'dumped'

/** Sorts a drain by how long you held. Holding to `NOODLES.dumpMs` dumps them. */
export function drainResult(heldMs: number): DrainResult {
  if (heldMs >= NOODLES.dumpMs) return 'dumped'
  if (heldMs < NOODLES.drainFrom) return 'watery'
  if (heldMs <= NOODLES.drainTo) return 'good'
  return 'mush'
}

/** Drained, one way or another: the batch can be poured. */
export function noodlesDrained(noodles: NoodleState | null): boolean {
  return noodles === 'good' || noodles === 'watery' || noodles === 'mush'
}

/** What the noodles add to the blocks: reinforcement, and water when drained early. */
export function noodleHelp(noodles: NoodleState | null): {
  noodles: boolean
  watery: boolean
} {
  return {
    noodles: noodles === 'good' || noodles === 'watery',
    watery: noodles === 'watery'
  }
}

/** True once a mix may be poured as far as its noodles go. */
export function noodlesAllowPour(mix: StoveMix): boolean {
  return mix.noodles === null || noodlesDrained(mix.noodles)
}

/** Puts the batch's noodles on the back hob at wall-clock time `at`. */
export function startNoodles(state: GameState, at: number): boolean {
  const mix = state.mix
  if (mix?.noodles !== 'raw') return false
  mix.noodles = 'boiling'
  state.noodles = startTimer('Noodles boiling', NOODLES.boilMs, at)
  return true
}

/** The noodles have boiled for their minute and wait to be drained. */
export function noodlesReady(state: GameState, at: number): boolean {
  return (
    state.mix?.noodles === 'boiling' &&
    state.noodles !== null &&
    isDone(state.noodles, at)
  )
}

/** Drains ready noodles after holding for `heldMs`. Returns how it went, or null. */
export function drainNoodles(
  state: GameState,
  heldMs: number,
  at: number
): DrainResult | null {
  const mix = state.mix
  if (!mix || !noodlesReady(state, at)) return null
  const result = drainResult(heldMs)
  mix.noodles = result === 'dumped' ? 'mush' : result
  state.noodles = null
  return result
}
