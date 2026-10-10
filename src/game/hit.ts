import {
  CRITTER_HIT,
  JELLY_HIT,
  NAIL_HIT,
  PRESSED_JELLY_REACH,
  RUB_THRESHOLD_CSS
} from './tuning'

/** Fingers get bigger targets than a mouse. */
export type PointerKind = 'touch' | 'mouse'

/** A hit radius in world units, with CSS-pixel minimums for each pointer kind. */
export interface HitRadius {
  world: number
  touch: number
  mouse: number
}

/**
 * Converts a hit radius to world units at the current scale, so a target never shrinks
 * below its CSS-pixel minimum. `cssPerUnit` is viewport scale times camera zoom.
 */
export function worldRadius(
  radius: HitRadius,
  cssPerUnit: number,
  pointer: PointerKind
): number {
  const css = pointer === 'touch' ? radius.touch : radius.mouse
  return Math.max(radius.world, css / Math.max(cssPerUnit, 1e-6))
}

interface Located {
  x: number
  y: number
}

/** The nearest item within `radius` of (x, y), or null. */
export function nearestWithin<T extends Located>(
  items: readonly T[],
  x: number,
  y: number,
  radius: number
): T | null {
  let best: T | null = null
  let bestDist = radius * radius
  for (const item of items) {
    const dx = item.x - x
    const dy = item.y - y
    const d = dx * dx + dy * dy
    if (d <= bestDist) {
      best = item
      bestDist = d
    }
  }
  return best
}

export interface CritterCandidate extends Located {
  critter: 'fly' | 'cat'
  id: number
}

export interface NailCandidate extends Located {
  blockId: number
  fixingId: number
}

export interface JellyCandidate extends Located {
  blockId: number
  particle: number
}

/** A residue cell or floor splat, as a circle. */
export interface MessCandidate extends Located {
  mess: 'residue' | 'splat'
  id: number
  radius: number
}

export type HitTarget =
  | { kind: 'critter'; critter: 'fly' | 'cat'; id: number }
  | { kind: 'nail'; blockId: number; fixingId: number }
  | { kind: 'jelly'; blockId: number; particle: number }
  | { kind: 'mess'; mess: 'residue' | 'splat'; id: number }
  | { kind: 'wall' }

export interface HitQuery {
  /** Press point in world units. */
  x: number
  y: number
  /** CSS pixels per world unit: viewport scale times camera zoom. */
  cssPerUnit: number
  pointer: PointerKind
  critters?: readonly CritterCandidate[]
  nails?: readonly NailCandidate[]
  jelly?: readonly JellyCandidate[]
  messes?: readonly MessCandidate[]
}

/**
 * Decides what a press on the world means. Priority: fly and cat, then nail heads, then
 * jelly, then residue and splats, then the bare wall. React buttons and the stool take
 * their presses before this runs.
 */
export function pickTarget(query: HitQuery): HitTarget {
  const { x, y, cssPerUnit, pointer } = query
  const critter = nearestWithin(
    query.critters ?? [],
    x,
    y,
    worldRadius(CRITTER_HIT, cssPerUnit, pointer)
  )
  if (critter)
    return { kind: 'critter', critter: critter.critter, id: critter.id }
  const nail = nearestWithin(
    query.nails ?? [],
    x,
    y,
    worldRadius(NAIL_HIT, cssPerUnit, pointer)
  )
  if (nail)
    return { kind: 'nail', blockId: nail.blockId, fixingId: nail.fixingId }
  const jelly = nearestWithin(
    query.jelly ?? [],
    x,
    y,
    worldRadius(JELLY_HIT, cssPerUnit, pointer)
  )
  if (jelly)
    return { kind: 'jelly', blockId: jelly.blockId, particle: jelly.particle }
  for (const mess of query.messes ?? []) {
    if (Math.hypot(mess.x - x, mess.y - y) <= mess.radius)
      return { kind: 'mess', mess: mess.mess, id: mess.id }
  }
  return { kind: 'wall' }
}

/**
 * Where a new nail goes when the hammer lands at (x, y): the jelly under it, or else the
 * block you pressed, which may have swung on its first nail while the hammer charged, up
 * to `PRESSED_JELLY_REACH` times further away. Null means the nail hits the bare wall.
 */
export function nailTarget(
  jelly: readonly JellyCandidate[],
  x: number,
  y: number,
  radius: number,
  pressedBlock: number | null
): JellyCandidate | null {
  const under = nearestWithin(jelly, x, y, radius)
  if (under || pressedBlock === null) return under
  let best: JellyCandidate | null = null
  let bestDist = (radius * PRESSED_JELLY_REACH) ** 2
  for (const item of jelly) {
    if (item.blockId !== pressedBlock) continue
    const d = (item.x - x) ** 2 + (item.y - y) ** 2
    if (d <= bestDist) {
      best = item
      bestDist = d
    }
  }
  return best
}

/** True once a press has moved far enough (in CSS px) to count as a rub instead of a hit. */
export function isRub(dxCss: number, dyCss: number): boolean {
  return dxCss * dxCss + dyCss * dyCss > RUB_THRESHOLD_CSS * RUB_THRESHOLD_CSS
}
