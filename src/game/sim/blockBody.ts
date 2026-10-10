import type Matter from 'matter-js'

import { softBody, type SoftBody } from '../../shared'
import { blockStiffness } from '../quality'
import {
  BLOCK_COLS,
  BLOCK_DAMPING,
  BLOCK_ROWS,
  PARTICLE_AIR,
  PARTICLE_FRICTION,
  PARTICLE_RADIUS,
  PARTICLE_SPACING
} from '../tuning'

/** Collision categories: the floor and side walls, and jelly. */
export const CAT_FLOOR = 0x0001
export const CAT_BLOCK = 0x0002

/** A jelly block's soft body plus the bookkeeping the wall needs. */
export interface BlockBody {
  soft: SoftBody
  /** Every spring in creation order, torn or not, so lock snapshots can name them. */
  springs: readonly Matter.Constraint[]
  /** Particle index (row * cols + col) by Matter body id. */
  indexOf: ReadonlyMap<number, number>
  /** Torn springs, rebuilt only when the attached count changes. Read through `tornSprings`. */
  tornCache: Matter.Constraint[]
  tornFor: number
}

/** Builds a 4 x 3 block centred on (x, y). Add `soft.composite` to the world yourself. */
export function createBlockBody(
  x: number,
  y: number,
  q: number,
  heatWave = false
): BlockBody {
  const soft = softBody({
    x,
    y,
    cols: BLOCK_COLS,
    rows: BLOCK_ROWS,
    spacing: PARTICLE_SPACING,
    particleRadius: PARTICLE_RADIUS,
    stiffness: blockStiffness(q, heatWave),
    damping: BLOCK_DAMPING,
    collisionFilter: { category: CAT_BLOCK, mask: CAT_FLOOR | CAT_BLOCK },
    label: 'jelly',
    particle: { friction: PARTICLE_FRICTION, frictionAir: PARTICLE_AIR }
  })
  const indexOf = new Map<number, number>()
  soft.bodies.forEach((body, i) => indexOf.set(body.id, i))
  return {
    soft,
    springs: soft.constraints.slice(),
    indexOf,
    tornCache: [],
    tornFor: soft.constraints.length
  }
}

/** Springs that have torn, for drawing cracks. Cached until another spring tears. */
export function tornSprings(block: BlockBody): readonly Matter.Constraint[] {
  if (block.tornFor !== block.soft.constraints.length) {
    const attached = new Set(block.soft.constraints)
    block.tornCache = block.springs.filter(spring => !attached.has(spring))
    block.tornFor = block.soft.constraints.length
  }
  return block.tornCache
}

function particleIndices(
  block: BlockBody,
  spring: Matter.Constraint
): [number, number] | null {
  const a = spring.bodyA ? block.indexOf.get(spring.bodyA.id) : undefined
  const b = spring.bodyB ? block.indexOf.get(spring.bodyB.id) : undefined
  if (a === undefined || b === undefined) return null
  return [a, b]
}

/** The `count` attached springs whose midpoints are nearest (x, y), nearest first. */
export function nearestSprings(
  block: BlockBody,
  x: number,
  y: number,
  count: number
): Matter.Constraint[] {
  if (count <= 0) return []
  const scored = block.soft.constraints.map(spring => {
    const a = spring.bodyA!.position
    const b = spring.bodyB!.position
    return {
      spring,
      d: Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y)
    }
  })
  scored.sort((p, q) => p.d - q.d)
  return scored.slice(0, count).map(s => s.spring)
}

/**
 * Tears up to `count` springs nearest (x, y). Returns how many tore. `keep` names a
 * particle that must stay attached, such as the one a nail is in: a hard hit tears the
 * jelly around its own nail but never cuts that nail loose. Cutting loose is a split.
 */
export function tearNearest(
  block: BlockBody,
  x: number,
  y: number,
  count: number,
  keep?: number
): number {
  if (count <= 0) return 0
  const springs =
    keep === undefined
      ? nearestSprings(block, x, y, count)
      : nearestSprings(block, x, y, block.soft.constraints.length)
  const kept = keep === undefined ? undefined : block.soft.bodies[keep]
  let left = kept
    ? block.soft.constraints.filter(c => c.bodyA === kept || c.bodyB === kept)
        .length
    : 0
  let torn = 0
  for (const spring of springs) {
    if (torn >= count) break
    const touches = kept && (spring.bodyA === kept || spring.bodyB === kept)
    if (touches && left <= 1) continue
    if (!block.soft.tear(spring)) continue
    torn++
    if (touches) left--
  }
  return torn
}

/**
 * The attached springs crossing the column line next to a particle, on the block-centre
 * side. Tearing them splits the block in two, leaving the particle's side as a scrap.
 */
export function splitSprings(
  block: BlockBody,
  particle: number
): Matter.Constraint[] {
  const col = particle % BLOCK_COLS
  // Cut towards the middle, so the nailed scrap is the smaller side.
  const boundary = col < BLOCK_COLS / 2 ? col : col - 1
  return block.soft.constraints.filter(spring => {
    const ends = particleIndices(block, spring)
    if (!ends) return false
    const ca = ends[0] % BLOCK_COLS
    const cb = ends[1] % BLOCK_COLS
    return Math.min(ca, cb) <= boundary && Math.max(ca, cb) > boundary
  })
}

/** Indices into `springs` of every spring that has torn. */
export function tornIndices(block: BlockBody): number[] {
  const attached = new Set(block.soft.constraints)
  const out: number[] = []
  block.springs.forEach((spring, i) => {
    if (!attached.has(spring)) out.push(i)
  })
  return out
}

/** Particle positions as flat world points, in grid order. */
export function particlePositions(block: BlockBody): Float64Array {
  const out = new Float64Array(block.soft.bodies.length * 2)
  block.soft.bodies.forEach((body, i) => {
    out[i * 2] = body.position.x
    out[i * 2 + 1] = body.position.y
  })
  return out
}

/** Number of particles in the piece that holds `particle`, following attached springs. */
export function pieceSize(block: BlockBody, particle: number): number {
  const n = block.soft.bodies.length
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (i: number): number => {
    while (parent[i] !== i)
      i = parent[i] = parent[parent[i] as number] as number
    return i
  }
  for (const spring of block.soft.constraints) {
    const ends = particleIndices(block, spring)
    if (ends) parent[find(ends[0])] = find(ends[1])
  }
  const root = find(particle)
  let size = 0
  for (let i = 0; i < n; i++) if (find(i) === root) size++
  return size
}

/** Stops a block colliding with other blocks; it keeps landing on the floor. */
export function passThrough(block: BlockBody): void {
  for (const body of block.soft.bodies) body.collisionFilter.mask = CAT_FLOOR
}
