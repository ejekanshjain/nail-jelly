import { partly } from './quality'
import {
  CURTAIN_DECAY,
  DAMAGE_DECAY,
  DECAY_BASE,
  DECAY_Q_BASE,
  DECAY_Q_SLOPE,
  FLY_DECAY,
  HEAT_DECAY,
  HOLES_FREE,
  HOLES_STEP,
  LOAD,
  LONG_SECTION,
  MESH_DECAY,
  ORANGE_MIN,
  RED_MIN,
  RESIDUE_DECAY,
  RIP_OUT,
  SCREW_DECAY,
  SECTION_DECAY,
  SLACK_MAX,
  SLACK_POWER,
  UPGRADE_DECAY_FLOOR,
  WARNING_MARGIN
} from './tuning'

export type Heat = 'none' | 'wave' | 'curtains'

/** Everything that sets how fast one fixing loses grip. */
export interface DecayInputs {
  q: number
  /** Live fixings on the block, including this one. */
  fixings: number
  residue: number
  heat: Heat
  /** Mesh help, 0 to 1: a ragged sheet gives half. */
  mesh: number
  screw: boolean
  fly: boolean
  holes: number
  /** Fraction of the block's springs still attached, 0 to 1. */
  integrity: number
  /** The block's section, for its decay factor, or null for none (the final test). */
  section: number | null
  /**
   * Any other factor, 1 by default: the section's ease (`longSectionEase`) and Assist
   * Mode.
   */
  scale?: number
}

/** The load factor for a block held by `fixings` live fixings. */
export function loadFactor(fixings: number): number {
  const index = Math.min(Math.max(fixings, 1), LOAD.length) - 1
  return LOAD[index] as number
}

/**
 * The decay factor for a section that has been active for `elapsedMs`: 1 at first,
 * easing evenly to `LONG_SECTION.min` between its `fromMs` and `toMs`.
 */
export function longSectionEase(elapsedMs: number): number {
  const { fromMs, toMs, min } = LONG_SECTION
  const t = Math.min(1, Math.max(0, (elapsedMs - fromMs) / (toMs - fromMs)))
  return 1 - (1 - min) * t
}

/** Grip lost per second of simulation time. */
export function decayPerSecond(inputs: DecayInputs): number {
  const quality = DECAY_Q_BASE - DECAY_Q_SLOPE * inputs.q
  const heat =
    inputs.heat === 'wave'
      ? HEAT_DECAY
      : inputs.heat === 'curtains'
        ? CURTAIN_DECAY
        : 1
  const upgrades = Math.max(
    UPGRADE_DECAY_FLOOR,
    partly(MESH_DECAY, inputs.mesh) * (inputs.screw ? SCREW_DECAY : 1)
  )
  const holes = 1 + HOLES_STEP * Math.max(0, inputs.holes - HOLES_FREE)
  const damage = 1 + DAMAGE_DECAY * (1 - inputs.integrity)
  return (
    DECAY_BASE *
    quality *
    loadFactor(inputs.fixings) *
    (1 + RESIDUE_DECAY * inputs.residue) *
    heat *
    upgrades *
    (inputs.fly ? FLY_DECAY : 1) *
    holes *
    damage *
    (inputs.section === null ? 1 : (SECTION_DECAY[inputs.section] ?? 1)) *
    (inputs.scale ?? 1)
  )
}

/** Pin length for a grip: a weaker nail lets the block hang lower and swing wider. */
export function slackFor(grip: number): number {
  return SLACK_MAX * Math.pow(Math.max(0, 1 - grip), SLACK_POWER)
}

/** Grip one fixing loses to an impulse of strength `impulse`. */
export function impulseLoss(
  grip: number,
  impulse: number,
  fixings: number,
  tough: number
): number {
  return (impulse * Math.max(0, 1 - grip) * loadFactor(fixings)) / tough
}

/** The highest grip an impulse still rips out. Nails above it survive that impulse. */
export function breakGrip(
  impulse: number,
  fixings: number,
  tough: number
): number {
  const k = (impulse * loadFactor(fixings)) / tough
  return (RIP_OUT + k) / (1 + k)
}

/** Grip levels where a nail turns orange and red. */
export interface WarningLines {
  orange: number
  red: number
}

/** The impulses a section's events can deliver: the strongest and the weakest. */
export interface ImpulsePool {
  strongest: number
  weakest: number
}

/**
 * Orange: the strongest event in the pool could rip this nail. Red: the weakest one will.
 * A nail above its orange line survives every event in its section.
 */
export function warningLines(
  pool: ImpulsePool,
  fixings: number,
  tough: number
): WarningLines {
  const orange = Math.max(
    ORANGE_MIN,
    breakGrip(pool.strongest, fixings, tough) + WARNING_MARGIN
  )
  const red = Math.min(
    orange,
    Math.max(RED_MIN, breakGrip(pool.weakest, fixings, tough) + WARNING_MARGIN)
  )
  return { orange, red }
}

export type NailLevel = 'ok' | 'orange' | 'red'

export function nailLevel(grip: number, lines: WarningLines): NailLevel {
  if (grip < lines.red) return 'red'
  if (grip < lines.orange) return 'orange'
  return 'ok'
}
