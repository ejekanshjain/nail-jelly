import Matter from 'matter-js'

import {
  clamp,
  createPhysics,
  pinToWorld,
  stepPhysics,
  type Rng
} from '../../shared'
import { decayPerSecond, impulseLoss, slackFor, type Heat } from '../grip'
import {
  baseTears,
  classifyHit,
  hammerZones,
  hitGrip,
  rehammerGrip,
  rollTears,
  type HitKind
} from '../hammer'
import { addSplat } from '../mess'
import { nextId } from '../state'
import { blockStiffness, toughness } from '../quality'
import { blockWarningLines } from '../warnings'
import {
  ASSIST_DECAY,
  BLOCK_COLS,
  CAUSE_WINDOW_MS,
  FALL_RESIDUE,
  FALL_TIMEOUT_MS,
  FLOOR_Y,
  HAND_STIFFNESS,
  HAND_TIRE_MS,
  HAND_TIRE_S1_MS,
  HAND_TREMBLE,
  HAND_TREMBLE_MS,
  KNOCK_LOOSE_SPEED,
  KNOCK_MAX,
  KNOCK_MIN_SPEED,
  KNOCK_PER_SPEED,
  KNOCK_SWING_GRACE_MS,
  PARTICLE_RADIUS,
  PASS_THROUGH_MS,
  PIN_STIFFNESS,
  RIP_OUT,
  SCRAP_POP_MS,
  SCREW,
  SHOVE_VARIATION,
  SIDE_WALL_LEFT,
  SIDE_WALL_RIGHT,
  SPLAT_CENTRE_GAP,
  SPLAT_MIN_PARTICLES,
  UP_MIN_PARTICLES
} from '../tuning'
import type {
  BlockSnapshot,
  BlockState,
  Fixing,
  FixingKind,
  GameState,
  LossCause
} from '../types'
import {
  CAT_FLOOR,
  createBlockBody,
  particlePositions,
  passThrough,
  pieceSize,
  splitSprings,
  tearNearest,
  tornIndices,
  type BlockBody
} from './blockBody'
import { cellAt, cellCentre, sectionAt } from './geometry'

const { Bodies, Body, Composite, Events } = Matter

/** What one hammer blow did. */
export type HitOutcome =
  | {
      kind: Exclude<HitKind, 'split'>
      blockId: number
      fixingId: number | null
      x: number
      y: number
      tears: number
      grip: number
      rehammer: boolean
    }
  | { kind: 'split'; blockId: number; x: number; y: number; tears: number }
  | { kind: 'wall'; x: number; y: number }

/** Things that happened during a step, for sounds, captions and replays. */
export type SimEvent =
  | { type: 'hit'; outcome: HitOutcome }
  | {
      type: 'screw'
      blockId: number
      fixingId: number
      x: number
      y: number
      grip: number
      strips: number
    }
  | { type: 'bite'; blockId: number }
  | { type: 'rip'; blockId: number; x: number; y: number }
  | { type: 'fall'; blockId: number; cause: LossCause }
  | { type: 'splat'; blockId: number; x: number; y: number }
  | { type: 'tremble'; blockId: number }
  | {
      type: 'knock'
      sourceId: number
      targetId: number
      impulse: number
      /** Nails the hit knocked loose because they were below their orange line. */
      loose: number
    }

/** Matter objects and timers for one block on the wall. */
interface LiveBlock {
  id: number
  body: BlockBody
  pins: Map<number, Matter.Constraint>
  /** The hand's pins and their resting points while it holds the block. */
  hand: Matter.Constraint[] | null
  handPoints: { x: number; y: number }[]
  trembling: boolean
  /** Time spent with no fixings and no hand. */
  fallMs: number
  passing: boolean
  /** Fixings due to pop because their piece got too small, by fixing id. */
  popAt: Map<number, number>
  /** Spring count when the pieces were last checked. */
  checkedSprings: number
}

/** How a thawed block starts moving: sag and swing offsets and their speeds per second. */
export interface ThawMotion {
  sag: number
  sagSpeed: number
  angle: number
  angleSpeed: number
  pivotX: number
  pivotY: number
}

const NO_MOTION: ThawMotion = {
  sag: 0,
  sagSpeed: 0,
  angle: 0,
  angleSpeed: 0,
  pivotX: 0,
  pivotY: 0
}

/** Settings the sim reads each step. */
export interface WallConditions {
  heat: Heat
  assist: boolean
  /**
   * Each section decays at its own speed (`SECTION_DECAY`): section 1 at half while you
   * learn, later ones faster. The final test turns this off.
   */
  sectionDecay: boolean
  /**
   * How much the active section eases off once it has run long (`longSectionEase`), 0
   * to 1. The game sets it each step; 1 in the final test.
   */
  ease: number
  /** The block a fly sits on, which decays faster, or null. */
  flyBlock: number | null
}

/**
 * The physical wall: Matter engine, soft-body blocks, nails, falls and splats. It writes
 * plain data into `GameState` and keeps the Matter objects to itself, keyed by block id.
 */
export class WallSim {
  readonly engine = createPhysics({
    positionIterations: 6,
    velocityIterations: 4,
    constraintIterations: 4
  })
  readonly events: SimEvent[] = []
  readonly conditions: WallConditions = {
    heat: 'none',
    assist: false,
    sectionDecay: true,
    ease: 1,
    flyBlock: null
  }
  /** The block the hand holds, if any. */
  handBlock: number | null = null
  private readonly live = new Map<number, LiveBlock>()
  private readonly bodyBlock = new Map<number, number>()
  private readonly knockSpeeds = new Map<string, number>()
  /**
   * The impulse each source block has already knocked off each target during its
   * current episode (one fall, or one spell swinging on a single nail), and for a fall,
   * the target's fixings that were below their orange line when it first touched.
   */
  private readonly knockWindows = new Map<
    string,
    { episode: number; applied: number; weak: number[] }
  >()

  constructor(
    readonly state: GameState,
    readonly random: Rng = Math.random
  ) {
    const floor = Bodies.rectangle(
      (SIDE_WALL_LEFT + SIDE_WALL_RIGHT) / 2,
      FLOOR_Y + 40,
      SIDE_WALL_RIGHT - SIDE_WALL_LEFT + 400,
      80,
      {
        isStatic: true,
        friction: 0.9,
        collisionFilter: { category: CAT_FLOOR }
      }
    )
    const wall = (x: number) =>
      Bodies.rectangle(x, FLOOR_Y / 2, 80, FLOOR_Y * 3, {
        isStatic: true,
        collisionFilter: { category: CAT_FLOOR }
      })
    Composite.add(this.engine.world, [
      floor,
      wall(SIDE_WALL_LEFT - 40),
      wall(SIDE_WALL_RIGHT + 40)
    ])
    Events.on(this.engine, 'collisionStart', this.onCollision)
  }

  // ---------------------------------------------------------------- Queries

  /** The soft body of a live block, or undefined. */
  bodyOf(blockId: number): BlockBody | undefined {
    return this.live.get(blockId)?.body
  }

  /** Ids of blocks with bodies in the engine. */
  liveIds(): IterableIterator<number> {
    return this.live.keys()
  }

  /** Pin points of the hand, for drawing, or null. */
  handPoints(): readonly { x: number; y: number }[] | null {
    const id = this.handBlock
    return id === null ? null : (this.live.get(id)?.handPoints ?? null)
  }

  /** True while the hand on the held block trembles. */
  handTrembling(): boolean {
    const id = this.handBlock
    return id !== null && (this.live.get(id)?.trembling ?? false)
  }

  /** Number of blocks with soft bodies in the engine. */
  get liveCount(): number {
    return this.live.size
  }

  /** Leaves one splat for a block that fell without a body, such as a proxy. */
  splatWithoutBody(block: BlockState, x: number): void {
    addSplat(
      this.state,
      'wall',
      x,
      FLOOR_Y,
      14 + 4 * 12,
      block.flavour,
      block.id * 31,
      true
    )
    block.status = 'splatted'
    this.state.lastSplatMs = this.state.simMs
    this.events.push({ type: 'splat', blockId: block.id, x, y: FLOOR_Y })
  }

  /** Bodies, particles and springs in the engine. */
  perf(): { blocks: number; particles: number; springs: number } {
    let particles = 0
    let springs = 0
    for (const live of this.live.values()) {
      particles += live.body.soft.bodies.length
      springs += live.body.soft.constraints.length
    }
    return { blocks: this.live.size, particles, springs }
  }

  // ---------------------------------------------------------------- Actions

  /** Moves a stool block into an empty cell of the active section, held by the hand. */
  place(blockId: number, cell: number): boolean {
    const state = this.state
    const block = state.blocks.get(blockId)
    const section = state.sections[state.section]
    const slot = section?.cells[cell]
    if (!block || block.status !== 'stool' || !section || section.locked)
      return false
    if (!slot || slot.block !== null || this.handBlock !== null) return false

    const centre = cellCentre(section.index, cell)
    const body = createBlockBody(
      centre.x,
      centre.y,
      block.q,
      this.conditions.heat !== 'none'
    )
    const top = body.soft.particles[0]!
    const corners = [top[0]!, top[BLOCK_COLS - 1]!]
    const handPoints = corners.map(p => ({ x: p.position.x, y: p.position.y }))
    const hand = corners.map((p, i) =>
      pinToWorld(p, handPoints[i]!, HAND_STIFFNESS)
    )
    this.register(blockId, body, hand, handPoints)
    state.stool = state.stool.filter(id => id !== blockId)
    block.status = 'held'
    block.section = section.index
    block.cell = cell
    block.residue = slot.residue
    block.heldAtMs = state.simMs
    slot.block = blockId
    this.handBlock = blockId
    return true
  }

  /**
   * Your free hand steadies an up block at the jelly you pressed while the hammer
   * charges, so a block swinging on its first nail stays under the hammer. A nail, a
   * drop or `letGo` ends it.
   */
  steady(blockId: number, particle: number): void {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    const body = live?.body.soft.bodies[particle]
    if (!block || !live || !body || live.hand) return
    if (block.status !== 'up' || block.cause !== null) return
    const point = { x: body.position.x, y: body.position.y }
    live.hand = [pinToWorld(body, point, HAND_STIFFNESS)]
    live.handPoints = [point]
    Composite.add(this.engine.world, live.hand)
  }

  /**
   * Lets go of a block the hand steadies. The hand placing a block keeps holding it. A
   * block whose last nail ripped while you held it falls now.
   */
  letGo(blockId: number): void {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    if (!block || !live || this.handBlock === blockId) return
    this.releaseHand(live)
    if (block.status === 'up' && block.fixings.length === 0)
      this.markFalling(block)
  }

  /** Drives a new nail into `particle` of a block with the given charge. */
  hammer(blockId: number, particle: number, charge: number): HitOutcome | null {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    const body = live?.body.soft.bodies[particle]
    if (!block || !live || !body || block.cause !== null) return null
    if (block.status !== 'held' && block.status !== 'up') return null

    const zones = hammerZones(block.q, {
      assist: this.conditions.assist,
      noodles: block.noodles
    })
    const kind = classifyHit(charge, zones)
    const x = body.position.x
    const y = body.position.y
    let outcome: HitOutcome
    if (kind === 'weak') {
      outcome = {
        kind,
        blockId,
        fixingId: null,
        x,
        y,
        tears: 0,
        grip: 0,
        rehammer: false
      }
    } else if (kind === 'split') {
      let tears = 0
      for (const spring of splitSprings(live.body, particle))
        if (live.body.soft.tear(spring)) tears++
      block.torn += tears
      block.holes++
      // The nail holds the scrap for a moment, then every fixing pops and it all falls.
      this.addFixing(block, live, particle, x, y, 1)
      for (const fixing of block.fixings)
        live.popAt.set(fixing.id, this.state.simMs + SCRAP_POP_MS)
      block.cause = 'split'
      block.status = 'up'
      this.releaseHand(live)
      outcome = { kind, blockId, x, y, tears }
    } else {
      const grip = hitGrip(kind, charge, zones)
      const fixing = this.addFixing(block, live, particle, x, y, grip)
      block.holes++
      const tears = tearNearest(
        live.body,
        x,
        y,
        rollTears(
          baseTears(kind, false, block.noodles),
          block.q,
          this.random,
          block.mesh,
          block.noodles
        ),
        particle
      )
      block.torn += tears
      block.lastNailMs = this.state.simMs
      if (kind === 'sweet') {
        block.sweetMs = this.state.simMs
        this.jiggle(live, x, y)
      }
      if (block.firstBiteMs === null) {
        block.firstBiteMs = this.state.simMs
        this.events.push({ type: 'bite', blockId })
      }
      if (block.status === 'held') block.status = 'up'
      this.releaseHand(live)
      outcome = {
        kind,
        blockId,
        fixingId: fixing.id,
        x,
        y,
        tears,
        grip,
        rehammer: false
      }
    }
    this.events.push({ type: 'hit', outcome })
    return outcome
  }

  /** Drives an existing nail again. Uses no nail and never splits. */
  rehammer(
    blockId: number,
    fixingId: number,
    charge: number
  ): HitOutcome | null {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    const fixing = block?.fixings.find(f => f.id === fixingId)
    if (!block || !live || !fixing || block.cause !== null) return null
    const zones = hammerZones(block.q, {
      assist: this.conditions.assist,
      noodles: block.noodles,
      rehammer: true
    })
    const kind = classifyHit(charge, zones)
    if (kind === 'split') return null // unreachable: re-hammers have no split zone
    let tears = 0
    let grip = fixing.grip
    if (kind !== 'weak') {
      grip = rehammerGrip(
        fixing.grip,
        hitGrip(kind, charge, zones),
        fixing.rehammers
      )
      fixing.grip = grip
      fixing.rehammers++
      tears = tearNearest(
        live.body,
        fixing.x,
        fixing.y,
        rollTears(
          baseTears(kind, true, block.noodles),
          block.q,
          this.random,
          block.mesh,
          block.noodles
        ),
        fixing.particle
      )
      block.torn += tears
      block.lastNailMs = this.state.simMs
      if (kind === 'sweet') {
        block.sweetMs = this.state.simMs
        this.jiggle(live, fixing.x, fixing.y)
      }
    }
    const outcome: HitOutcome = {
      kind,
      blockId,
      fixingId,
      x: fixing.x,
      y: fixing.y,
      tears,
      grip,
      rehammer: true
    }
    this.events.push({ type: 'hit', outcome })
    return outcome
  }

  /**
   * A screw driven home in `particle` with the grip its circles earned. The strips already
   * tore their springs. Screws never split.
   */
  screw(
    blockId: number,
    particle: number,
    grip: number,
    strips: number
  ): Fixing | null {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    const body = live?.body.soft.bodies[particle]
    if (!block || !live || !body || block.cause !== null) return null
    if (block.status !== 'held' && block.status !== 'up') return null
    const x = body.position.x
    const y = body.position.y
    const fixing = this.addFixing(block, live, particle, x, y, grip, 'screw')
    block.holes++
    block.lastNailMs = this.state.simMs
    if (block.firstBiteMs === null) {
      block.firstBiteMs = this.state.simMs
      this.events.push({ type: 'bite', blockId })
    }
    if (block.status === 'held') block.status = 'up'
    this.releaseHand(live)
    this.events.push({
      type: 'screw',
      blockId,
      fixingId: fixing.id,
      x,
      y,
      grip,
      strips
    })
    return fixing
  }

  /** A screw turned too fast tears the jelly around it. Returns the springs torn. */
  strip(blockId: number, particle: number): number {
    return this.tearAt(blockId, particle, SCREW.stripTears)
  }

  /**
   * Tears the `count` springs nearest a particle, as a fly's bite or the cat's claws do.
   * A `cause` records the shock, so a fall that follows blames it. Returns the springs torn.
   */
  tearAt(
    blockId: number,
    particle: number,
    count: number,
    cause?: LossCause
  ): number {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    const body = live?.body.soft.bodies[particle]
    if (!block || !live || !body || count <= 0) return 0
    const tears = tearNearest(
      live.body,
      body.position.x,
      body.position.y,
      count
    )
    block.torn += tears
    if (cause) {
      block.lastShock = cause
      block.lastShockMs = this.state.simMs
    }
    return tears
  }

  /** Adds speed to every particle of one block, such as the cat hanging off it. */
  pull(blockId: number, vx: number, vy: number): void {
    const live = this.live.get(blockId)
    if (!live) return
    for (const p of live.body.soft.bodies)
      Body.setVelocity(p, { x: p.velocity.x + vx, y: p.velocity.y + vy })
  }

  /** A nail into bare wall. It stays there, useless, until the cell is scraped. */
  nailWall(x: number, y: number): HitOutcome {
    const section = sectionAt(x, y)
    const cell = section >= 0 ? cellAt(section, x, y) : -1
    const slot =
      cell >= 0 ? this.state.sections[section]?.cells[cell] : undefined
    slot?.emptyNails.push({ x, y })
    const outcome: HitOutcome = { kind: 'wall', x, y }
    this.events.push({ type: 'hit', outcome })
    return outcome
  }

  /** Takes grip off every fixing of a block, as a slam, truck, cat or falling neighbour does. */
  impulse(blockId: number, strength: number, cause: LossCause): void {
    const block = this.state.blocks.get(blockId)
    if (!block || block.fixings.length === 0) return
    const tough = toughness(block.q, block.mesh, block.noodles)
    const count = block.fixings.length
    for (const fixing of block.fixings)
      fixing.grip -= impulseLoss(fixing.grip, strength, count, tough)
    block.lastShock = cause
    block.lastShockMs = this.state.simMs
    this.ripOut(block)
  }

  /** Records a shock on a block whose grip was just lowered, and pops the nails it ripped. */
  shock(blockId: number, cause: LossCause): void {
    const block = this.state.blocks.get(blockId)
    if (!block) return
    block.lastShock = cause
    block.lastShockMs = this.state.simMs
    this.ripOut(block)
  }

  /** Sets the heat. A heat wave softens every live block; they firm up again after it. */
  setHeat(heat: Heat): void {
    const wasHot = this.conditions.heat !== 'none'
    this.conditions.heat = heat
    const hot = heat !== 'none'
    if (hot === wasHot) return
    for (const live of this.live.values()) {
      const block = this.state.blocks.get(live.id)
      if (block) live.body.soft.setStiffness(blockStiffness(block.q, hot))
    }
  }

  /** Kicks every live particle along one shared direction, with a little variation per block. */
  shove(dirX: number, dirY: number, speed: number): void {
    const len = Math.hypot(dirX, dirY) || 1
    for (const live of this.live.values()) {
      const k = (speed * (1 + (this.random() * 2 - 1) * SHOVE_VARIATION)) / len
      for (const p of live.body.soft.bodies)
        Body.setVelocity(p, {
          x: p.velocity.x + dirX * k,
          y: p.velocity.y + dirY * k
        })
    }
  }

  /** Pulls every fixing and the hand off a block, so it falls. */
  drop(blockId: number, cause: LossCause): void {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    if (!block || !live) return
    if (block.status !== 'held' && block.status !== 'up') return
    block.cause = cause
    this.releaseHand(live)
    for (const fixing of block.fixings.slice())
      this.removeFixing(block, live, fixing)
    this.markFalling(block)
  }

  /** Lowers grip on one block, or on all of them, for dev testing. */
  sag(amount: number, blockId?: number): void {
    for (const block of this.state.blocks.values()) {
      if (blockId !== undefined && block.id !== blockId) continue
      for (const fixing of block.fixings)
        fixing.grip = clamp(fixing.grip - amount, 0, 1)
      this.ripOut(block)
    }
  }

  /**
   * Applies `ms` of grip decay to every nailed block at once, without stepping physics,
   * for time the tab spent hidden. Nails that pass rip-out come out now.
   */
  catchUp(ms: number): void {
    for (const block of this.state.blocks.values()) {
      if (block.status !== 'up' || block.fixings.length === 0) continue
      const live = this.live.get(block.id)
      if (!live || live.hand) continue
      this.decay(block, live, ms)
      this.ripOut(block)
    }
  }

  // ---------------------------------------------------------------- Step

  update(dtMs: number): void {
    const state = this.state
    this.updateHand(dtMs)
    for (const block of state.blocks.values()) {
      if (block.status !== 'up' || block.fixings.length === 0) continue
      const live = this.live.get(block.id)
      if (!live) continue
      this.decay(block, live, dtMs)
      this.popScraps(block, live)
      this.ripOut(block)
    }
    for (const block of state.blocks.values()) {
      const live = this.live.get(block.id)
      if (!live) continue
      for (const fixing of block.fixings) {
        const pin = live.pins.get(fixing.id)
        if (pin) pin.length = slackFor(fixing.grip)
      }
    }

    this.knockSpeeds.clear()
    stepPhysics(this.engine, dtMs)
    this.applyKnocks()

    for (const block of state.blocks.values()) {
      const live = this.live.get(block.id)
      if (!live) continue
      if (block.status === 'up' || block.status === 'held')
        this.checkPieces(block, live)
      else if (block.status === 'falling') this.updateFalling(block, live, dtMs)
    }
  }

  // ---------------------------------------------------------------- Lock

  /** Freezes a section: snapshots its blocks and removes their bodies from the engine. */
  lockSection(sectionIndex: number): BlockSnapshot[] {
    const section = this.state.sections[sectionIndex]
    if (!section) return []
    const out: BlockSnapshot[] = []
    for (const cell of section.cells) {
      if (cell.block === null) continue
      const snapshot = this.freezeBlock(cell.block, 'locked')
      if (snapshot) out.push(snapshot)
    }
    return out
  }

  /** Everything needed to redraw a live block and rebuild it later. */
  snapshotBlock(blockId: number): BlockSnapshot | null {
    const block = this.state.blocks.get(blockId)
    const live = this.live.get(blockId)
    if (!block || !live) return null
    const pieces = live.body.soft.outline().map(piece => ({
      points: piece.points.slice(0, piece.count * 2),
      count: piece.count,
      particles: piece.particles,
      centerX: piece.centerX,
      centerY: piece.centerY
    }))
    return {
      blockId,
      cell: block.cell,
      q: block.q,
      make: block.make,
      flavour: block.flavour,
      positions: particlePositions(live.body),
      tornSprings: tornIndices(live.body),
      fixings: block.fixings.map(f => ({ ...f })),
      holes: block.holes,
      mesh: block.mesh,
      noodles: block.noodles,
      pieces
    }
  }

  /** Snapshots a live block and removes its bodies, leaving it as a still picture or a proxy. */
  freezeBlock(
    blockId: number,
    status: 'locked' | 'proxy'
  ): BlockSnapshot | null {
    const snapshot = this.snapshotBlock(blockId)
    const live = this.live.get(blockId)
    const block = this.state.blocks.get(blockId)
    if (!snapshot || !live || !block) return null
    this.removeLive(live)
    block.status = status
    return snapshot
  }

  /**
   * Rebuilds a block's soft body from its snapshot: the bent grid, its torn springs and
   * its current fixings. `motion` moves it down by `sag` and turns it by `angle` around
   * (`pivotX`, `pivotY`), with matching velocities in units per second.
   */
  thawBlock(snapshot: BlockSnapshot, motion: ThawMotion = NO_MOTION): boolean {
    const block = this.state.blocks.get(snapshot.blockId)
    if (!block || this.live.has(block.id)) return false
    const body = createBlockBody(0, 0, block.q, this.conditions.heat !== 'none')
    const cos = Math.cos(motion.angle)
    const sin = Math.sin(motion.angle)
    body.soft.bodies.forEach((particle, i) => {
      const dx = snapshot.positions[i * 2]! - motion.pivotX
      const dy = snapshot.positions[i * 2 + 1]! - motion.pivotY
      const x = motion.pivotX + dx * cos - dy * sin
      const y = motion.pivotY + dx * sin + dy * cos + motion.sag
      Body.setPosition(particle, { x, y })
      // Velocity per step: the sag speed plus the swing's tangential speed.
      Body.setVelocity(particle, {
        x: (-(y - motion.pivotY) * motion.angleSpeed) / 60,
        y: (motion.sagSpeed + (x - motion.pivotX) * motion.angleSpeed) / 60
      })
    })
    for (const index of snapshot.tornSprings) {
      const spring = body.springs[index]
      if (spring) body.soft.tear(spring)
    }
    const live = this.register(block.id, body, null, [])
    for (const fixing of block.fixings) {
      const particle = body.soft.bodies[fixing.particle]!
      const pin = pinToWorld(
        particle,
        { x: fixing.x, y: fixing.y },
        PIN_STIFFNESS,
        slackFor(fixing.grip)
      )
      Composite.add(this.engine.world, pin)
      live.pins.set(fixing.id, pin)
    }
    block.status = 'up'
    return true
  }

  /** Fastest particle speed of a live block, in units per second. */
  maxSpeed(blockId: number): number {
    const live = this.live.get(blockId)
    if (!live) return 0
    let max = 0
    for (const p of live.body.soft.bodies) max = Math.max(max, p.speed)
    return max * 60
  }

  // ---------------------------------------------------------------- Internals

  /** Adds a block's body (and the hand, if any) to the engine and starts tracking it. */
  private register(
    blockId: number,
    body: BlockBody,
    hand: Matter.Constraint[] | null,
    handPoints: { x: number; y: number }[]
  ): LiveBlock {
    Composite.add(this.engine.world, [body.soft.composite, ...(hand ?? [])])
    for (const particle of body.soft.bodies)
      this.bodyBlock.set(particle.id, blockId)
    const live: LiveBlock = {
      id: blockId,
      body,
      pins: new Map(),
      hand,
      handPoints,
      trembling: false,
      fallMs: 0,
      passing: false,
      popAt: new Map(),
      checkedSprings: body.soft.constraints.length
    }
    this.live.set(blockId, live)
    return live
  }

  private addFixing(
    block: BlockState,
    live: LiveBlock,
    particle: number,
    x: number,
    y: number,
    grip: number,
    kind: FixingKind = 'nail'
  ): Fixing {
    const body = live.body.soft.bodies[particle]!
    const fixing: Fixing = {
      id: nextId(this.state),
      kind,
      particle,
      x,
      y,
      grip,
      rehammers: 0
    }
    const pin = pinToWorld(body, { x, y }, PIN_STIFFNESS, slackFor(grip))
    Composite.add(this.engine.world, pin)
    live.pins.set(fixing.id, pin)
    block.fixings.push(fixing)
    return fixing
  }

  private removeFixing(
    block: BlockState,
    live: LiveBlock,
    fixing: Fixing
  ): void {
    const pin = live.pins.get(fixing.id)
    if (pin) Composite.remove(this.engine.world, pin)
    live.pins.delete(fixing.id)
    live.popAt.delete(fixing.id)
    block.fixings = block.fixings.filter(f => f !== fixing)
    const cell = this.state.sections[block.section]?.cells[block.cell]
    cell?.emptyNails.push({ x: fixing.x, y: fixing.y })
  }

  private releaseHand(live: LiveBlock): void {
    if (!live.hand) return
    for (const pin of live.hand) Composite.remove(this.engine.world, pin)
    live.hand = null
    live.trembling = false
    if (this.handBlock === live.id) this.handBlock = null
  }

  /** Pushes particles near a sweet nail outwards, so the block jiggles. */
  private jiggle(live: LiveBlock, x: number, y: number): void {
    for (const p of live.body.soft.bodies) {
      const dx = p.position.x - x
      const dy = p.position.y - y
      const d = Math.hypot(dx, dy)
      if (d < 1 || d > 60) continue
      const k = (1 - d / 60) * 2.2
      Body.setVelocity(p, {
        x: p.velocity.x + (dx / d) * k,
        y: p.velocity.y + (dy / d) * k
      })
    }
  }

  private updateHand(dtMs: number): void {
    const id = this.handBlock
    if (id === null) return
    const block = this.state.blocks.get(id)
    const live = this.live.get(id)
    if (!block || !live?.hand) return
    const heldMs = this.state.simMs + dtMs - block.heldAtMs
    const tireMs = block.section === 0 ? HAND_TIRE_S1_MS : HAND_TIRE_MS
    if (heldMs >= tireMs) {
      block.cause = 'hand'
      this.drop(id, 'hand')
      return
    }
    const trembleFrom = tireMs - (HAND_TIRE_MS - HAND_TREMBLE_MS)
    if (heldMs >= trembleFrom) {
      if (!live.trembling) {
        live.trembling = true
        this.events.push({ type: 'tremble', blockId: id })
      }
      const t = this.state.simMs / 1000
      live.hand.forEach((pin, i) => {
        const rest = live.handPoints[i]!
        pin.pointB!.x = rest.x + Math.sin(t * 37 + i) * HAND_TREMBLE
        pin.pointB!.y = rest.y + Math.sin(t * 29 + i * 2) * HAND_TREMBLE
      })
    }
  }

  private decay(block: BlockState, live: LiveBlock, dtMs: number): void {
    const integrity = live.body.soft.integrity()
    const count = block.fixings.length
    for (const fixing of block.fixings) {
      const rate = decayPerSecond({
        q: block.q,
        fixings: count,
        residue: block.residue,
        heat: this.conditions.heat,
        mesh: block.mesh,
        screw: fixing.kind === 'screw',
        fly: this.conditions.flyBlock === block.id,
        holes: block.holes,
        integrity,
        section: this.conditions.sectionDecay ? block.section : null,
        scale:
          this.conditions.ease * (this.conditions.assist ? ASSIST_DECAY : 1)
      })
      fixing.grip -= (rate * dtMs) / 1000
    }
  }

  private popScraps(block: BlockState, live: LiveBlock): void {
    if (live.popAt.size === 0) return
    for (const fixing of block.fixings.slice()) {
      const at = live.popAt.get(fixing.id)
      if (at !== undefined && this.state.simMs >= at) fixing.grip = 0
    }
  }

  /** Removes fixings at or below rip-out. A block with none left falls. */
  private ripOut(block: BlockState): void {
    const live = this.live.get(block.id)
    if (!live) return
    let ripped = false
    for (const fixing of block.fixings.slice()) {
      if (fixing.grip > RIP_OUT) continue
      this.removeFixing(block, live, fixing)
      this.events.push({
        type: 'rip',
        blockId: block.id,
        x: fixing.x,
        y: fixing.y
      })
      ripped = true
    }
    if (ripped && block.fixings.length === 0 && !live.hand)
      this.markFalling(block)
  }

  /** Marks a block as falling: frees its cell, leaves residue, counts the loss, names the cause. */
  markFalling(block: BlockState): void {
    if (block.status === 'falling' || block.status === 'splatted') return
    const state = this.state
    if (!block.cause) {
      const recent =
        block.lastShock !== null &&
        state.simMs - block.lastShockMs <= CAUSE_WINDOW_MS
      // A block sagging off under a feeding fly blames the fly.
      const sag = this.conditions.flyBlock === block.id ? 'fly' : 'sag'
      block.cause = recent ? block.lastShock : sag
    }
    block.status = 'falling'
    block.lostMs = state.simMs
    const cell = state.sections[block.section]?.cells[block.cell]
    if (cell && cell.block === block.id) {
      cell.block = null
      cell.residue = Math.max(cell.residue, FALL_RESIDUE)
    }
    state.stats.blocksLost++
    if (block.firstBiteMs !== null && block.cause !== 'split')
      state.stats.longestHoldMs = Math.max(
        state.stats.longestHoldMs,
        block.lostMs - block.firstBiteMs
      )
    this.events.push({ type: 'fall', blockId: block.id, cause: block.cause! })
  }

  /** Schedules pops for fixings whose piece got too small, after springs tear. */
  private checkPieces(block: BlockState, live: LiveBlock): void {
    const springs = live.body.soft.constraints.length
    if (springs === live.checkedSprings) return
    live.checkedSprings = springs
    for (const fixing of block.fixings) {
      if (live.popAt.has(fixing.id)) continue
      if (pieceSize(live.body, fixing.particle) >= UP_MIN_PARTICLES) continue
      live.popAt.set(fixing.id, this.state.simMs + SCRAP_POP_MS)
      // The nail now holds a scrap: if the block falls, its own tears did it, unless the
      // fly or the cat just tore it.
      const critter =
        (block.lastShock === 'fly' || block.lastShock === 'cat') &&
        this.state.simMs - block.lastShockMs <= CAUSE_WINDOW_MS
      if (!critter) block.lastShock = 'torn'
      block.lastShockMs = this.state.simMs
    }
  }

  private updateFalling(
    block: BlockState,
    live: LiveBlock,
    dtMs: number
  ): void {
    live.fallMs += dtMs
    if (!live.passing && live.fallMs >= PASS_THROUGH_MS) {
      live.passing = true
      passThrough(live.body)
    }
    let sumY = 0
    let maxY = -Infinity
    for (const p of live.body.soft.bodies) {
      sumY += p.position.y
      if (p.position.y > maxY) maxY = p.position.y
    }
    const centreY = sumY / live.body.soft.bodies.length
    const landed =
      centreY > FLOOR_Y - SPLAT_CENTRE_GAP &&
      maxY > FLOOR_Y - PARTICLE_RADIUS - 4
    if (landed || live.fallMs >= FALL_TIMEOUT_MS) this.splat(block, live)
  }

  private splat(block: BlockState, live: LiveBlock): void {
    let sx = 0
    for (const piece of live.body.soft.outline()) {
      sx += piece.centerX * piece.particles
      if (piece.particles < SPLAT_MIN_PARTICLES) continue
      addSplat(
        this.state,
        'wall',
        piece.centerX,
        FLOOR_Y,
        14 + 4 * piece.particles,
        block.flavour,
        block.id * 31 + piece.particles,
        true
      )
    }
    this.removeLive(live)
    block.status = 'splatted'
    this.state.lastSplatMs = this.state.simMs
    this.events.push({
      type: 'splat',
      blockId: block.id,
      x: sx / live.body.soft.bodies.length,
      y: FLOOR_Y
    })
  }

  private removeLive(live: LiveBlock): void {
    this.releaseHand(live)
    for (const pin of live.pins.values())
      Composite.remove(this.engine.world, pin)
    Composite.remove(this.engine.world, live.body.soft.composite)
    for (const p of live.body.soft.bodies) this.bodyBlock.delete(p.id)
    this.live.delete(live.id)
  }

  /** Records the hardest hit between each pair of blocks during a step. */
  private readonly onCollision = (
    event: Matter.IEventCollision<Matter.Engine>
  ) => {
    for (const pair of event.pairs) {
      const a = this.bodyBlock.get(pair.bodyA.id)
      const b = this.bodyBlock.get(pair.bodyB.id)
      if (a === undefined || b === undefined || a === b) continue
      const n = pair.collision.normal
      const speed = Math.abs(
        (pair.bodyA.velocity.x - pair.bodyB.velocity.x) * n.x +
          (pair.bodyA.velocity.y - pair.bodyB.velocity.y) * n.y
      )
      this.noteKnock(a, b, speed)
      this.noteKnock(b, a, speed)
    }
  }

  private noteKnock(source: number, target: number, speed: number): void {
    const key = `${source}:${target}`
    if (speed > (this.knockSpeeds.get(key) ?? 0))
      this.knockSpeeds.set(key, speed)
  }

  /** Falling and one-nail swinging blocks take grip off the pinned blocks they hit. */
  private applyKnocks(): void {
    if (this.knockSpeeds.size === 0) return
    const now = this.state.simMs
    for (const [key, speed] of this.knockSpeeds) {
      const [sourceId, targetId] = key.split(':').map(Number) as [
        number,
        number
      ]
      const source = this.state.blocks.get(sourceId)
      const target = this.state.blocks.get(targetId)
      if (!source || !target || target.fixings.length === 0) continue
      const swinging =
        source.status === 'up' &&
        source.fixings.length === 1 &&
        now - source.lastNailMs >= KNOCK_SWING_GRACE_MS
      if (source.status !== 'falling' && !swinging) continue
      const strength = clamp(
        KNOCK_PER_SPEED * (speed - KNOCK_MIN_SPEED),
        0,
        KNOCK_MAX
      )
      // A whole fall, or a whole spell swinging on one nail, counts as its hardest hit
      // on each neighbour, so a block resting or jiggling against another can't grind it
      // off the wall: one episode takes at most KNOCK_MAX off each neighbour.
      const falling = source.status === 'falling'
      const episode = falling ? -1 : source.lastNailMs
      let window = this.knockWindows.get(key)
      if (window?.episode !== episode) {
        window = {
          episode,
          applied: 0,
          weak: falling ? this.weakFixings(target) : []
        }
        this.knockWindows.set(key, window)
      }
      const extra = Math.max(0, strength - window.applied)
      const loose =
        speed >= KNOCK_LOOSE_SPEED ? this.knockLoose(target, window.weak) : 0
      if (extra <= 0 && loose === 0) continue
      window.applied = Math.max(window.applied, strength)
      this.events.push({
        type: 'knock',
        sourceId,
        targetId,
        impulse: extra,
        loose
      })
      this.impulse(targetId, extra, 'knock')
    }
  }

  /** Ids of a block's fixings below their orange line, the line that warns of hard knocks. */
  private weakFixings(block: BlockState): number[] {
    const lines = blockWarningLines(block, this.state.phase === 'final')
    return block.fixings.filter(f => f.grip < lines.orange).map(f => f.id)
  }

  /**
   * A falling block landing hard on a neighbour rips out the nails that were already
   * below their orange line when it first touched (`weak`, emptied here) and still are.
   * An earlier glancing knock in the same fall can't make a healthy nail count. The
   * impulse that follows pops them. Returns how many nails it loosened.
   */
  private knockLoose(block: BlockState, weak: number[]): number {
    if (weak.length === 0) return 0
    const lines = blockWarningLines(block, this.state.phase === 'final')
    let loose = 0
    for (const fixing of block.fixings)
      if (weak.includes(fixing.id) && fixing.grip < lines.orange) {
        fixing.grip = 0
        loose++
      }
    weak.length = 0
    return loose
  }
}
