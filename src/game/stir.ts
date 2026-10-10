import type { Rng } from '../shared'
import { STIR } from './tuning'

/** Progress through the 50 circles. Evenness itself comes from the shared `CircleGesture`. */
export interface Stir {
  circles: number
  /** When the last circle finished, or the stroke started. Null before any input. */
  lastAtMs: number | null
  sloshes: number
  spills: number
  done: boolean
}

export function createStir(): Stir {
  return { circles: 0, lastAtMs: null, sloshes: 0, spills: 0, done: false }
}

/** Things one finished circle can cause, in the order they should play. */
export type StirEvent =
  'tick' | 'clack' | 'slosh' | 'spill' | 'halfway' | 'bend' | 'done'

/** A press in the bowl starts timing the first circle. */
export function startStroke(stir: Stir, atMs: number): void {
  stir.lastAtMs ??= atMs
}

/** The circle time under which a circle sloshes. */
export function sloshBelowMs(assist: boolean): number {
  return assist ? STIR.assistSloshBelowMs : STIR.sloshBelowMs
}

/**
 * Counts one finished circle of `radius`, finished at `atMs`. A quick circle sloshes,
 * and one slosh in four spills. Beats fire at 25 and 45, and 50 finishes the stir.
 */
export function stirCircle(
  stir: Stir,
  radius: number,
  atMs: number,
  { assist, random }: { assist: boolean; random: Rng }
): StirEvent[] {
  if (stir.done) return []
  const events: StirEvent[] = ['tick']
  const tookMs = stir.lastAtMs === null ? Infinity : atMs - stir.lastAtMs
  stir.lastAtMs = atMs
  stir.circles++
  if (radius > STIR.clackAbove) events.push('clack')
  if (tookMs < sloshBelowMs(assist)) {
    stir.sloshes++
    events.push('slosh')
    if (random() < STIR.spillOdds) {
      stir.spills++
      events.push('spill')
    }
  }
  if (stir.circles === STIR.halfway) events.push('halfway')
  if (stir.circles === STIR.bend) events.push('bend')
  if (stir.circles >= STIR.circles) {
    stir.done = true
    events.push('done')
  }
  return events
}
