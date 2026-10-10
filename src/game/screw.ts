import { clamp } from '../shared'
import { RIP_OUT, SCREW } from './tuning'

// Driving a screw: 4 slow circles around it. The circle gesture measures evenness; this
// module counts circles, times each one and decides when the jelly strips.

/** One screw going in. */
export interface ScrewJob {
  circles: number
  strips: number
  /** Time the current circle started, from event time stamps. */
  circleStartMs: number
  done: boolean
}

export function createScrewJob(atMs: number): ScrewJob {
  return { circles: 0, strips: 0, circleStartMs: atMs, done: false }
}

/** What one completed circle did. */
export type ScrewEvent = 'turn' | 'strip' | 'done'

/** The circle time under which the jelly strips. */
export function stripBelowMs(assist: boolean): number {
  return assist ? SCREW.assistStripBelowMs : SCREW.stripBelowMs
}

/**
 * Counts a circle completed at `atMs`. Every circle turns the screw; one quicker than the
 * strip limit also strips the jelly. The last circle drives it home.
 */
export function screwCircle(
  job: ScrewJob,
  atMs: number,
  assist: boolean
): ScrewEvent[] {
  if (job.done) return []
  const events: ScrewEvent[] = ['turn']
  if (atMs - job.circleStartMs < stripBelowMs(assist)) {
    job.strips++
    events.push('strip')
  }
  job.circleStartMs = atMs
  job.circles++
  if (job.circles >= SCREW.circles) {
    job.done = true
    events.push('done')
  }
  return events
}

/** A finished screw's grip: 0.6 + 0.4 x evenness, less 0.15 per strip. */
export function screwGrip(evenness: number, strips: number): number {
  const grip =
    SCREW.baseGrip +
    SCREW.evennessGrip * clamp(evenness, 0, 1) -
    SCREW.stripGrip * strips
  // A screw stripped to nothing still bites a little, so it never rips out on the spot.
  return Math.max(RIP_OUT + 0.05, grip)
}
