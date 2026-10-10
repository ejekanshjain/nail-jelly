import type { Heat } from './grip'
import { HEAT } from './tuning'

// The heat wave's timeline: a warning, then 90s of heat that softens the jelly and
// speeds up decay. Shutting the curtains takes the edge off.

/** A heat wave under way: when its warning started, and whether you shut the curtains. */
export interface HeatWave {
  startMs: number
  curtains: boolean
}

/** Where a heat wave is: its warning, the heat itself, or over. */
export type HeatPhase = 'coming' | 'hot' | 'over'

export function heatPhase(wave: HeatWave, simMs: number): HeatPhase {
  const elapsed = simMs - wave.startMs
  if (elapsed < HEAT.warnMs) return 'coming'
  if (elapsed < HEAT.warnMs + HEAT.durationMs) return 'hot'
  return 'over'
}

/** The wall's heat: a heat wave while it is hot, the milder curtains heat once shut. */
export function wallHeat(wave: HeatWave | null, simMs: number): Heat {
  if (!wave || heatPhase(wave, simMs) !== 'hot') return 'none'
  return wave.curtains ? 'curtains' : 'wave'
}

/**
 * How hot it looks, 0 to 1: it builds over the warning, holds, and fades over the last
 * 3 seconds. The curtains halve it.
 */
export function heatLevel(wave: HeatWave | null, simMs: number): number {
  if (!wave) return 0
  const elapsed = simMs - wave.startMs
  const end = HEAT.warnMs + HEAT.durationMs
  const level = Math.max(
    0,
    Math.min(1, elapsed / HEAT.warnMs, (end - elapsed) / 3000)
  )
  return wave.curtains ? level / 2 : level
}
