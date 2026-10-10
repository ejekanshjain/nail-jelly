import { damp, type Rng } from '../shared'
import { gaussian } from './noise'
import { addSplat, type Puddle } from './mess'
import { createBlock } from './state'
import { CARRY, CAT, SLIP } from './tuning'
import type {
  BlockState,
  CarryState,
  Flavour,
  GameState,
  TrayMould
} from './types'

// The hallway carry: you hold to walk while the tray drifts, and steer to keep it level.
// Blocks slide along the tilted tray, push each other, and fall off its ends.

/** What you do during one step of the carry. */
export interface CarryInput {
  /** Holding to walk. */
  walking: boolean
  /** Steering from -1 to 1: tilt, mouse, thumb or keys. */
  steer: number
  /** The jolt meter is over its limit. */
  jolt: boolean
}

/** How hard this carry is. */
export interface CarryOptions {
  /** Drift noise in degrees per root second. */
  noise: number
  /** Below this tilt the jelly grips the tray. */
  gripDeg: number
}

export type CarryEvent =
  /** A block slid off one end (`side` -1 left, 1 right) at tray position `x`. */
  | { type: 'drop'; mould: TrayMould; x: number; v: number; side: 1 | -1 }
  | { type: 'step' }
  | { type: 'hop' }
  /** You stepped in a puddle; it throws the tray towards `side`. */
  | { type: 'slip'; side: 1 | -1 }
  /** You walked into the cat; it throws the tray towards `side` and runs off. */
  | { type: 'trip'; side: 1 | -1 }
  | { type: 'arrive' }
  /** The tray has been empty long enough to give up. */
  | { type: 'empty' }

/** The route for the next carry: the first one is short. */
export function carryRoute(carries: number): number {
  return carries === 0 ? CARRY.firstRoute : CARRY.route
}

/** Drift noise for a section (0 to 4): 3 in section 1, up to 7 in section 5. */
export function carryOptions(section: number, assist: boolean): CarryOptions {
  return {
    noise:
      (CARRY.driftNoise + CARRY.driftNoisePerSection * section) *
      (assist ? CARRY.assistNoise : 1),
    gripDeg: assist ? CARRY.assistGripDeg : CARRY.gripDeg
  }
}

/**
 * Starts a carry with the moulds side by side, centred on the tray, the route's puddles
 * ahead of you, and the cat on the runner at `catAt` when it is there.
 */
export function createCarry(
  moulds: readonly TrayMould[],
  length: number,
  puddles: readonly Puddle[] = [],
  catAt: number | null = null
): CarryState {
  const half = ((moulds.length - 1) / 2) * CARRY.pitch
  return {
    length,
    pos: 0,
    angle: 0,
    drift: 0,
    bob: 1,
    stepInMs: CARRY.stepMs,
    walking: false,
    blocks: moulds.map((mould, i) => ({
      mould,
      x: -half + i * CARRY.pitch,
      v: 0,
      hopMs: 0
    })),
    edge: half + CARRY.edgeMargin,
    hopCooldownMs: 0,
    arrived: false,
    emptyMs: 0,
    puddles: [...puddles].sort((a, b) => a.at - b.at),
    nextPuddle: 0,
    slipMs: 0,
    slipSide: 1,
    stopMs: 0,
    catAt
  }
}

/** Shoos the cat off the runner. Returns whether it was there. */
export function shooHallwayCat(carry: CarryState): boolean {
  if (carry.catAt === null) return false
  carry.catAt = null
  return true
}

/** A slip or a trip: the drift kicks towards `side` and you stop walking for a moment. */
function stumble(carry: CarryState, side: 1 | -1): void {
  carry.slipMs = SLIP.kickMs
  carry.slipSide = side
  carry.stopMs = SLIP.stopMs
  carry.walking = false
}

/**
 * Where steering is measured from: a thumb steers from where it landed, so holding still
 * walks level; a mouse steers from the tray's target ring.
 */
export function steerOrigin(
  pointerType: string,
  pressX: number,
  trayX: number
): number {
  return pointerType === 'touch' ? pressX : trayX
}

/** Advances the carry by `dtMs`, pushing what happened onto `out`. */
export function stepCarry(
  carry: CarryState,
  dtMs: number,
  input: CarryInput,
  random: Rng,
  options: CarryOptions,
  out: CarryEvent[]
): void {
  const dt = dtMs / 1000
  carry.stopMs = Math.max(0, carry.stopMs - dtMs)
  carry.walking = input.walking && !carry.arrived && carry.stopMs === 0

  // Drift: a random walk pulled back towards level, calmer while you stand still.
  const noise = options.noise * (carry.walking ? 1 : CARRY.standingNoise)
  carry.drift +=
    -CARRY.driftPull * carry.drift * dt +
    noise * Math.sqrt(dt) * gaussian(random)

  // A slip kicks the drift towards the smear's side over a moment.
  if (carry.slipMs > 0) {
    const ms = Math.min(dtMs, carry.slipMs)
    carry.slipMs -= ms
    carry.drift += (carry.slipSide * SLIP.kickDeg * ms) / SLIP.kickMs
  }

  if (carry.walking) {
    carry.pos = Math.min(carry.length, carry.pos + CARRY.walkSpeed * dt)
    const puddle = carry.puddles[carry.nextPuddle]
    if (puddle && carry.pos >= puddle.at) {
      carry.nextPuddle++
      stumble(carry, puddle.side)
      out.push({ type: 'slip', side: puddle.side })
    }
    if (carry.catAt !== null && carry.pos >= carry.catAt - CAT.tripReach) {
      const side = random() < 0.5 ? -1 : 1
      carry.catAt = null
      stumble(carry, side)
      out.push({ type: 'trip', side })
    }
    carry.stepInMs -= dtMs
    if (carry.stepInMs <= 0) {
      carry.stepInMs += CARRY.stepMs
      carry.bob = carry.bob === 1 ? -1 : 1
      out.push({ type: 'step' })
    }
  }
  const bob = carry.walking ? carry.bob * CARRY.bobDeg : 0
  const target = carry.drift + CARRY.steerDeg * input.steer + bob
  carry.angle = damp(carry.angle, target, CARRY.angleLambda, dt)

  carry.hopCooldownMs = Math.max(0, carry.hopCooldownMs - dtMs)
  if (input.jolt && carry.hopCooldownMs === 0 && carry.blocks.length > 0) {
    carry.hopCooldownMs = CARRY.hopCooldownMs
    for (const block of carry.blocks) {
      block.hopMs = CARRY.hopMs
      block.v += (random() * 2 - 1) * CARRY.hopKick
    }
    out.push({ type: 'hop' })
  }

  slide(carry, dt, options.gripDeg)
  dropOffEnds(carry, out)

  if (carry.blocks.length === 0) {
    carry.emptyMs += dtMs
    if (carry.emptyMs >= CARRY.emptyEndMs && !carry.arrived) {
      carry.arrived = true
      out.push({ type: 'empty' })
    }
  } else if (carry.pos >= carry.length && !carry.arrived) {
    carry.arrived = true
    out.push({ type: 'arrive' })
  }
}

/** Slides each block along the tilted tray, then keeps them in order without overlaps. */
function slide(carry: CarryState, dt: number, gripDeg: number): void {
  const tilt = Math.abs(carry.angle) >= gripDeg
  const pull = tilt
    ? CARRY.slideAccel * Math.sin((carry.angle * Math.PI) / 180)
    : 0
  for (const block of carry.blocks) {
    block.hopMs = Math.max(0, block.hopMs - dt * 1000)
    // A hopping block is in the air, so the tray can't grip it.
    if (!tilt && block.hopMs === 0 && Math.abs(block.v) < CARRY.stickSpeed)
      block.v = 0
    else block.v += (pull - CARRY.slideDrag * block.v) * dt
    block.x += block.v * dt
  }
  // Neighbours push each other: overlapping pairs split the overlap and share speed.
  const blocks = carry.blocks
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i + 1 < blocks.length; i++) {
      const a = blocks[i]!
      const b = blocks[i + 1]!
      const overlap = CARRY.pitch - (b.x - a.x)
      if (overlap <= 0) continue
      a.x -= overlap / 2
      b.x += overlap / 2
      if (a.v > b.v) a.v = b.v = (a.v + b.v) / 2
    }
}

function dropOffEnds(carry: CarryState, out: CarryEvent[]): void {
  const blocks = carry.blocks
  while (blocks.length > 0 && blocks[blocks.length - 1]!.x > carry.edge) {
    const block = blocks.pop()!
    out.push({
      type: 'drop',
      mould: block.mould,
      x: block.x,
      v: block.v,
      side: 1
    })
  }
  while (blocks.length > 0 && blocks[0]!.x < -carry.edge) {
    const block = blocks.shift()!
    out.push({
      type: 'drop',
      mould: block.mould,
      x: block.x,
      v: block.v,
      side: -1
    })
  }
}

/** Where hallway splats lie, in design units: on the runner. */
export const HALLWAY_SPLAT_Y = 604

/**
 * A block that slid off the tray and hit the floor at route position `routeX`: it counts
 * as lost, and leaves a hallway splat there.
 */
export function loseCarried(
  state: GameState,
  mould: TrayMould,
  flavour: Flavour,
  routeX: number,
  seed: number
): BlockState {
  const block = createBlock(state, mould.q, flavour, mould.make)
  block.status = 'splatted'
  block.cause = 'carry'
  block.lostMs = state.simMs
  state.stats.blocksLost++
  state.lastSplatMs = state.simMs
  addSplat(
    state,
    'hallway',
    routeX,
    HALLWAY_SPLAT_Y,
    CARRY.splatRadius,
    flavour,
    seed,
    true
  )
  return block
}
