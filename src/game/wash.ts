import { MESS, WASH } from './tuning'
import type { GameState } from './types'

// Washing up. Every stir dirties the mixing bowls, and a dirty bowl makes cloudy, weaker
// jelly. A burnt pot sits on top of the bowls in the sink, so it gets scrubbed first.

/** What sits in the sink waiting for the sponge. */
export type SinkItem = { kind: 'pot' } | { kind: 'bowl'; index: number }

/** The pot is on the stove while a batch boils. */
export function potInUse(state: GameState): boolean {
  return state.mix?.stage === 'boil'
}

/** The bowls hold the mix from the end of the boil until the pour. */
export function bowlsInUse(state: GameState): boolean {
  const stage = state.mix?.stage
  return stage === 'stir' || stage === 'stirred'
}

/** The next thing a scrub stroke cleans: the burnt pot first, then each dirty bowl. */
export function sinkTarget(state: GameState): SinkItem | null {
  if (state.potScrubs > 0 && !potInUse(state)) return { kind: 'pot' }
  if (bowlsInUse(state)) return null
  const index = state.bowls.findIndex(clean => clean < 1)
  return index >= 0 ? { kind: 'bowl', index } : null
}

/** Strokes the sink needs for everything in it right now. */
export function sinkStrokesLeft(state: GameState): number {
  let left = potInUse(state) ? 0 : state.potScrubs
  if (!bowlsInUse(state))
    for (const clean of state.bowls) left += bowlStrokesLeft(clean)
  return left
}

/** Strokes one bowl needs: a tenth of dirt per stroke. */
export function bowlStrokesLeft(clean: number): number {
  return Math.max(0, Math.ceil((1 - clean) * WASH.bowlStrokes - 1e-6))
}

/** True while any bowl is dirty, for the wash chore. */
export function bowlsDirty(state: GameState): boolean {
  return state.bowls.some(clean => clean < 1)
}

/** How clean the bowls are for a stir: their average. */
export function bowlCleanliness(state: GameState): number {
  if (state.bowls.length === 0) return 1
  return state.bowls.reduce((sum, clean) => sum + clean, 0) / state.bowls.length
}

/** A stir leaves every bowl dirty. */
export function dirtyBowls(state: GameState): void {
  state.bowls.fill(0)
}

/** What one scrub stroke did. */
export type WashEvent =
  | { type: 'pot'; left: number }
  | { type: 'pot-clean' }
  | { type: 'bowl'; index: number; left: number }
  | { type: 'bowl-clean'; index: number }
  /** Too fast: suds flew onto the kitchen floor. */
  | { type: 'suds' }
  /** Nothing in the sink needs washing any more. */
  | { type: 'done' }

/**
 * One scrub stroke at `speed` (design units per second) on whatever is on top in the
 * sink. Scrubbing faster than the rub limit flings suds, when `canFling` allows; the
 * stroke still counts.
 */
export function washStroke(
  state: GameState,
  speed: number,
  assist: boolean,
  canFling: boolean
): WashEvent[] {
  const target = sinkTarget(state)
  if (!target) return []
  const events: WashEvent[] = []
  const limit = assist ? MESS.assistRubLimit : MESS.rubLimit
  if (speed > limit && canFling) events.push({ type: 'suds' })
  if (target.kind === 'pot') {
    state.potScrubs--
    events.push(
      state.potScrubs > 0
        ? { type: 'pot', left: state.potScrubs }
        : { type: 'pot-clean' }
    )
  } else {
    const index = target.index
    const clean = Math.min(1, state.bowls[index]! + 1 / WASH.bowlStrokes)
    // Steps of a tenth don't add up to exactly 1, so the last stroke snaps it clean.
    state.bowls[index] = clean > 1 - 1e-6 ? 1 : clean
    const left = bowlStrokesLeft(state.bowls[index]!)
    events.push(
      left > 0 ? { type: 'bowl', index, left } : { type: 'bowl-clean', index }
    )
  }
  if (!sinkTarget(state)) events.push({ type: 'done' })
  return events
}
