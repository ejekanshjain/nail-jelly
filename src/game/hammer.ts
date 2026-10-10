import { clamp, type Rng } from '../shared'
import { extraTearOdds, splitAt } from './quality'
import {
  ASSIST_FILL_SCALE,
  ASSIST_SWEET_SCALE,
  HAMMER_FILL_MS,
  HAMMER_FILL_S1_MS,
  HARD_GRIP,
  LOOSE_GRIP,
  REHAMMER_FALLOFF,
  REHAMMER_FLOOR,
  REHAMMER_TEARS,
  SWEET_CENTRE,
  SWEET_EDGE_GRIP,
  SWEET_FROM,
  SWEET_TO,
  TEARS,
  WEAK_BELOW
} from './tuning'

export type HitKind = 'weak' | 'loose' | 'sweet' | 'hard' | 'split'

/** What the hammer would do for a given block, as charge thresholds from 0 to 1. */
export interface HammerZones {
  /** Below this: weak. */
  loose: number
  sweetFrom: number
  sweetTo: number
  /** At or above this: split. Infinity when the block can't split. */
  split: number
}

export interface HammerOptions {
  assist?: boolean
  noodles?: boolean
  /** Re-hammers never split. */
  rehammer?: boolean
}

/** Charge thresholds for a block of quality `q`. */
export function hammerZones(
  q: number,
  options: HammerOptions = {}
): HammerZones {
  const half =
    ((SWEET_TO - SWEET_FROM) / 2) * (options.assist ? ASSIST_SWEET_SCALE : 1)
  return {
    loose: WEAK_BELOW,
    sweetFrom: SWEET_CENTRE - half,
    sweetTo: SWEET_CENTRE + half,
    split: options.rehammer
      ? Infinity
      : splitAt(q, options.noodles, options.assist)
  }
}

/** Sorts a charge at release into an outcome. */
export function classifyHit(charge: number, zones: HammerZones): HitKind {
  if (charge < zones.loose) return 'weak'
  if (charge < zones.sweetFrom) return 'loose'
  if (charge <= zones.sweetTo) return 'sweet'
  if (charge < zones.split) return 'hard'
  return 'split'
}

/** Grip a fresh nail gets from this outcome. Sweet hits peak at the zone centre. */
export function hitGrip(
  kind: HitKind,
  charge: number,
  zones: HammerZones
): number {
  switch (kind) {
    case 'loose':
      return LOOSE_GRIP
    case 'sweet': {
      const half = (zones.sweetTo - zones.sweetFrom) / 2
      const off = clamp(Math.abs(charge - SWEET_CENTRE) / half, 0, 1)
      return 1 - (1 - SWEET_EDGE_GRIP) * off
    }
    case 'hard':
      return HARD_GRIP
    default:
      return 0
  }
}

/** Springs a hit tears before the extra roll. Noodles halve it, rounding down. */
export function baseTears(
  kind: Exclude<HitKind, 'split'>,
  rehammer: boolean,
  noodles: boolean
): number {
  const base = rehammer ? REHAMMER_TEARS[kind] : TEARS[kind]
  return noodles ? Math.floor(base / 2) : base
}

/** Total springs a tear removes: the base count plus one on an extra-tear roll. */
export function rollTears(
  base: number,
  q: number,
  random: Rng,
  mesh = 0,
  noodles = false
): number {
  if (base <= 0) return 0
  if (noodles) return base
  return base + (random() < extraTearOdds(q, mesh) ? 1 : 0)
}

/** New grip after re-hammering a nail with `rehammers` earlier re-hammers. Never lowers grip. */
export function rehammerGrip(
  current: number,
  outcomeGrip: number,
  rehammers: number
): number {
  return Math.max(
    current,
    outcomeGrip * Math.max(REHAMMER_FLOOR, 1 - REHAMMER_FALLOFF * rehammers)
  )
}

/** Hammer fill time: slower in section 1 and in Assist Mode. */
export function hammerFillMs(section: number, assist: boolean): number {
  const base = section === 0 ? HAMMER_FILL_S1_MS : HAMMER_FILL_MS
  return base * (assist ? ASSIST_FILL_SCALE : 1)
}
