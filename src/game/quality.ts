import { clamp } from '../shared'
import { thinFactor } from './pour'
import {
  ASSIST_SPLIT_BONUS,
  CAUSE_MIN_LOSS,
  EXTRA_TEAR_BASE,
  EXTRA_TEAR_MAX,
  EXTRA_TEAR_PER_Q,
  FIRM_FROM,
  HEAT_STIFFNESS,
  MAX_LUMPS,
  MESH_EXTRA_TEAR,
  MESH_TOUGHNESS,
  NOODLE_TOUGHNESS,
  NOODLES,
  Q_BASE,
  Q_BOIL,
  Q_DIRTY_BOWL,
  Q_MIN,
  Q_POUR,
  Q_RECIPE,
  Q_RECYCLED,
  Q_STIR,
  SPLIT_BASE,
  SPLIT_PER_Q,
  STIFFNESS_BASE,
  STIFFNESS_PER_Q,
  TOUGH_BASE,
  TOUGH_PER_Q,
  WOBBLY_FROM
} from './tuning'

/** Scores from making one block, each 0 to 1. Blocks keep them to explain their quality. */
export interface QualityInputs {
  boil: number
  /** Stir evenness when the stir finished. */
  stir: number
  /** Stir score lost because the mix set in the bowl before pouring. */
  set?: number
  pour: number
  bowlClean: number
  recycled: boolean
  recipe: boolean
  /** Reinforced with drained noodles. */
  noodles?: boolean
  /** The noodles came out of the pot too early and watered the jelly down. */
  watery?: boolean
  /** The mould's fill, 0 to 1. Short of the line makes a thinner block (`thinFactor`). */
  fill?: number
}

/** Inputs from an average batch: q 0.83. The starter tray uses them. */
export const AVERAGE_INPUTS: QualityInputs = {
  boil: 0.75,
  stir: 0.8,
  pour: 0.8,
  bowlClean: 1,
  recycled: false,
  recipe: false
}

/** The stir score that counts, after any setting in the bowl. */
export function effectiveStir(inputs: QualityInputs): number {
  return Math.max(0, inputs.stir - (inputs.set ?? 0))
}

/** Block quality from 0.05 to 1. Average inputs with a clean bowl give about 0.83. */
export function blockQuality(inputs: QualityInputs): number {
  const raw =
    Q_BASE +
    Q_BOIL * inputs.boil +
    Q_STIR * effectiveStir(inputs) +
    Q_POUR * inputs.pour
  const q =
    raw * bowlFactor(inputs.bowlClean) * (inputs.recycled ? Q_RECYCLED : 1) +
    (inputs.recipe ? Q_RECIPE : 0) -
    (inputs.watery ? NOODLES.wateryQ : 0)
  return clamp(q * thinFactor(inputs.fill ?? 1), Q_MIN, 1)
}

function bowlFactor(bowlClean: number): number {
  return Q_DIRTY_BOWL + (1 - Q_DIRTY_BOWL) * bowlClean
}

/**
 * Inputs that make a block of quality `q`, for dev trays and tests: every score and the
 * bowl's cleanliness at one shared level, so low quality shows as lumps and cloud.
 */
export function inputsForQuality(q: number): QualityInputs {
  const at = (x: number): QualityInputs => ({
    boil: x,
    stir: x,
    pour: x,
    bowlClean: x,
    recycled: false,
    recipe: false
  })
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (blockQuality(at(mid)) < q) lo = mid
    else hi = mid
  }
  return at((lo + hi) / 2)
}

/** The word on the tray and the stool. */
export type QualityWord = 'Firm' | 'Wobbly' | 'Sloppy'

export function qualityWord(q: number): QualityWord {
  if (q >= FIRM_FROM) return 'Firm'
  if (q >= WOBBLY_FROM) return 'Wobbly'
  return 'Sloppy'
}

/** Which part of making the block cost it the most quality. */
export type QualityCause =
  'boil' | 'stir' | 'set' | 'pour' | 'thin' | 'bowl' | 'recycled' | 'watery'

/** How each cause reads after the word, as in "Wobbly: dirty bowl". */
export const CAUSE_TEXT: Record<QualityCause, string> = {
  boil: 'wonky boil',
  stir: 'lumpy',
  set: 'set in the bowl',
  pour: 'missed the line',
  thin: 'too thin',
  bowl: 'dirty bowl',
  recycled: 'contains floor',
  watery: 'watery noodles'
}

/** The input that cost the most quality, or null when nothing cost much. */
export function mainCause(inputs: QualityInputs): QualityCause | null {
  const stir = effectiveStir(inputs)
  const raw =
    Q_BASE + Q_BOIL * inputs.boil + Q_STIR * stir + Q_POUR * inputs.pour
  const bowl = bowlFactor(inputs.bowlClean)
  const recycled = inputs.recycled ? Q_RECYCLED : 1
  // Each input's loss in quality points, with the other factors as they are.
  const losses: [QualityCause, number][] = [
    ['boil', Q_BOIL * (1 - inputs.boil) * bowl * recycled],
    ['stir', Q_STIR * (1 - inputs.stir) * bowl * recycled],
    ['set', Q_STIR * (inputs.stir - stir) * bowl * recycled],
    ['pour', Q_POUR * (1 - inputs.pour) * bowl * recycled],
    ['bowl', raw * (1 - bowl) * recycled],
    ['recycled', raw * bowl * (1 - recycled)],
    ['watery', inputs.watery ? NOODLES.wateryQ : 0],
    [
      'thin',
      blockQuality({ ...inputs, fill: 1 }) * (1 - thinFactor(inputs.fill ?? 1))
    ]
  ]
  let best: QualityCause | null = null
  let most = CAUSE_MIN_LOSS
  for (const [cause, loss] of losses)
    if (loss > most) {
      best = cause
      most = loss
    }
  return best
}

/** "Firm", or the word and its main cause: "Wobbly: dirty bowl". */
export function qualityLabel(q: number, inputs: QualityInputs): string {
  const word = qualityWord(q)
  const cause = word === 'Firm' ? null : mainCause(inputs)
  return cause ? `${word}: ${CAUSE_TEXT[cause]}` : word
}

/**
 * Sums up a tray, one caption line per label, most common first:
 * ["3 Firm", "1 Wobbly: lumpy"].
 */
export function traySummary(
  moulds: readonly { q: number; make: QualityInputs }[]
): string[] {
  const counts = new Map<string, number>()
  for (const mould of moulds) {
    const label = qualityLabel(mould.q, mould.make)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} ${label}`)
}

/** How cloudy the jelly looks, 0 to 1: a dirty bowl clouds it. */
export function cloudiness(inputs: QualityInputs): number {
  return clamp(1 - inputs.bowlClean, 0, 1)
}

/** Lumps drawn inside the jelly: an uneven stir leaves up to 8. */
export function lumpCount(inputs: QualityInputs): number {
  return Math.round((1 - effectiveStir(inputs)) * MAX_LUMPS)
}

/** Spring stiffness for a block: firmer jelly wobbles less. */
export function blockStiffness(q: number, heatWave = false): number {
  return (
    (STIFFNESS_BASE + STIFFNESS_PER_Q * q) * (heatWave ? HEAT_STIFFNESS : 1)
  )
}

/**
 * Scales an upgrade factor by how much of its help applies: `help` 1 gives the whole
 * `factor`, 0.5 half the change, 0 none. A ragged mesh sheet gives half.
 */
export function partly(factor: number, help: number): number {
  return 1 + (factor - 1) * clamp(help, 0, 1)
}

/** Odds that a tear rips one extra spring. Weak jelly tears more; mesh holds it together. */
export function extraTearOdds(q: number, mesh = 0): number {
  return (
    clamp(EXTRA_TEAR_BASE - EXTRA_TEAR_PER_Q * q, 0, EXTRA_TEAR_MAX) *
    partly(MESH_EXTRA_TEAR, mesh)
  )
}

/** Divides the grip lost to impulses. `mesh` is the block's mesh help, 0 to 1. */
export function toughness(q: number, mesh = 0, noodles = false): number {
  return (
    (TOUGH_BASE + TOUGH_PER_Q * q) *
    partly(MESH_TOUGHNESS, mesh) *
    (noodles ? NOODLE_TOUGHNESS : 1)
  )
}

/** Hammer charge at which the block splits. Infinity with noodles. */
export function splitAt(q: number, noodles = false, assist = false): number {
  if (noodles) return Infinity
  return SPLIT_BASE + SPLIT_PER_Q * q + (assist ? ASSIST_SPLIT_BONUS : 0)
}
