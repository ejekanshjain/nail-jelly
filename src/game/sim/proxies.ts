import { randRange, type Rng } from '../../shared'
import { decayPerSecond, impulseLoss, slackFor } from '../grip'
import { toughness } from '../quality'
import { gradeFor } from '../section'
import {
  ASSIST_DECAY,
  BLOCK_SPRINGS,
  CALM_SPEED,
  DEMOTE_CALM_MS,
  FLOOR_Y,
  PARTICLE_RADIUS,
  PROXY_CAP,
  PROXY_FALL_REACH,
  PROXY_SAG_DAMP,
  PROXY_SAG_K,
  PROXY_SLAM_SAG_MAX,
  PROXY_SLAM_SAG_MIN,
  PROXY_SLAM_SWING,
  PROXY_SWING_DAMP,
  PROXY_SWING_K,
  PROXY_SWING_K_ONE,
  RIP_OUT,
  SCRIPTED_FALL_G
} from '../tuning'
import type { BlockSnapshot, BlockState, GameState, LossCause } from '../types'
import { blockWarningLines } from '../warnings'
import type { WallSim } from './wallSim'

/**
 * A block with no body: its lock snapshot plus a sag spring and a swing spring. It
 * becomes a soft body before anything can break, so every fall stays physical.
 */
export interface Proxy {
  blockId: number
  snapshot: BlockSnapshot
  /** Mean pin slack when the snapshot was taken; extra sag counts from there. */
  baseSlack: number
  /** Swing pivot: the centroid of the fixings. */
  pivotX: number
  pivotY: number
  /** Sag below the picture, and its speed (units/s). */
  s: number
  vs: number
  /** Swing angle (radians) and its speed. */
  a: number
  va: number
  /** True while it falls without a body: the cap was full, or a slam shook it off. */
  falling: boolean
}

/** A proxy under a press, and whether the press landed on one of its nails. */
export interface ProxyHit {
  blockId: number
  nail: boolean
}

/** Keeps whole sections as cheap proxies and promotes only the blocks at risk. */
export class ProxyWall {
  readonly proxies = new Map<number, Proxy>()
  /** Bodies that started as proxies, with how long each has been calm (ms). */
  private readonly promoted = new Map<number, number>()
  /**
   * Blocks that must stay bodies for now, such as the one under your hammer or the
   * fly's target. They never demote while this says so.
   */
  keep: (blockId: number) => boolean = () => false
  /**
   * Holds the wall still: no grip decay, no promotions, no demotions. Sag and swing
   * settle and shaken-off blocks still fall. The ending sets it once the test is won.
   */
  paused = false

  constructor(
    private readonly state: GameState,
    private readonly wall: WallSim,
    private readonly random: Rng = Math.random
  ) {}

  /** Bodies promoted from proxies and still alive. */
  get promotedCount(): number {
    return this.promoted.size
  }

  /** Turns a locked section back into live proxies. Returns how many blocks it unlocked. */
  unlock(sectionIndex: number): number {
    const section = this.state.sections[sectionIndex]
    if (!section?.locked) return 0
    let count = 0
    for (const snapshot of section.snapshot) {
      const block = this.state.blocks.get(snapshot.blockId)
      if (!block) continue
      block.status = 'proxy'
      block.fixings = snapshot.fixings.map(f => ({ ...f }))
      this.proxies.set(block.id, makeProxy(snapshot, block))
      count++
    }
    section.locked = false
    section.snapshot = []
    section.grade = null
    return count
  }

  /** Locks a section again as it stands, from its proxies and promoted bodies. */
  relock(sectionIndex: number): BlockSnapshot[] {
    const section = this.state.sections[sectionIndex]
    if (!section || section.locked) return []
    const out: BlockSnapshot[] = []
    for (const cell of section.cells) {
      if (cell.block === null) continue
      const id = cell.block
      const proxy = this.proxies.get(id)
      let snapshot: BlockSnapshot | null = null
      if (proxy) {
        snapshot = posedSnapshot(proxy)
        this.proxies.delete(id)
      } else {
        snapshot = this.wall.freezeBlock(id, 'locked')
        this.promoted.delete(id)
      }
      const block = this.state.blocks.get(id)
      if (!snapshot || !block) continue
      block.status = 'locked'
      snapshot.fixings = block.fixings.map(f => ({ ...f }))
      out.push(snapshot)
    }
    let weakest = 1
    for (const snapshot of out)
      for (const fixing of snapshot.fixings)
        weakest = Math.min(weakest, fixing.grip)
    section.snapshot = out
    section.locked = true
    section.holdActive = false
    section.weakestGrip = weakest
    section.grade = gradeFor(weakest)
    return out
  }

  /**
   * Opens a locked section for a refill: every block in it becomes a soft body again, for
   * good, so its empty cells can be filled and the section held and locked as usual.
   * Returns how many blocks went back up.
   */
  reopen(sectionIndex: number): number {
    const section = this.state.sections[sectionIndex]
    if (!section?.locked) return 0
    let count = 0
    for (const snapshot of section.snapshot) {
      const block = this.state.blocks.get(snapshot.blockId)
      if (!block) continue
      block.fixings = snapshot.fixings.map(f => ({ ...f }))
      if (this.wall.thawBlock(snapshot)) count++
    }
    section.locked = false
    section.snapshot = []
    section.grade = null
    return count
  }

  /** Applies `ms` of grip decay to every proxy at once, for time the tab spent hidden. */
  catchUp(ms: number): void {
    if (this.paused) return
    for (const proxy of this.proxies.values()) {
      const block = this.state.blocks.get(proxy.blockId)
      if (block && !proxy.falling) this.decay(block, ms)
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000
    for (const proxy of [...this.proxies.values()]) {
      const block = this.state.blocks.get(proxy.blockId)
      if (!block) continue
      if (proxy.falling) {
        this.updateScriptedFall(proxy, block, dt)
        continue
      }
      if (this.paused) {
        this.move(proxy, block, dt)
        continue
      }
      this.decay(block, dtMs)
      this.move(proxy, block, dt)
      if (this.atRisk(proxy, block) && !this.promote(proxy.blockId)) {
        if (block.fixings.some(f => f.grip <= RIP_OUT))
          this.startScriptedFall(proxy, block)
      }
    }
    if (this.paused) return
    for (const [id, calmMs] of this.promoted) {
      const block = this.state.blocks.get(id)
      if (!block || block.status !== 'up') {
        this.promoted.delete(id)
        continue
      }
      const calm = this.wall.maxSpeed(id) < CALM_SPEED ? calmMs + dtMs : 0
      if (this.keep(id)) {
        this.promoted.set(id, 0)
        continue
      }
      this.promoted.set(id, calm)
      if (calm < DEMOTE_CALM_MS || block.fixings.length < 2) continue
      const lines = blockWarningLines(block, this.state.phase === 'final')
      if (block.fixings.every(f => f.grip >= lines.orange)) this.demote(id)
    }
  }

  /**
   * Turns a proxy into a soft body. When the cap is full it first demotes the calmest
   * promoted body; if none is calm, it refuses and returns false. `force`, for your own
   * presses, demotes the slowest body instead, calm or not.
   */
  promote(blockId: number, force = false): boolean {
    const proxy = this.proxies.get(blockId)
    if (!proxy || proxy.falling) return false
    if (
      this.wall.liveCount >= PROXY_CAP &&
      !this.demoteCalmest() &&
      !(force && this.demoteSlowest())
    )
      return false
    const thawed = this.wall.thawBlock(proxy.snapshot, {
      sag: proxy.s,
      sagSpeed: proxy.vs,
      angle: proxy.a,
      angleSpeed: proxy.va,
      pivotX: proxy.pivotX,
      pivotY: proxy.pivotY
    })
    if (!thawed) return false
    this.proxies.delete(blockId)
    this.promoted.set(blockId, 0)
    return true
  }

  /** Turns a promoted body back into a proxy, posed as it hangs now. */
  demote(blockId: number): boolean {
    const block = this.state.blocks.get(blockId)
    const snapshot = this.wall.freezeBlock(blockId, 'proxy')
    if (!block || !snapshot) return false
    this.promoted.delete(blockId)
    this.proxies.set(blockId, makeProxy(snapshot, block))
    return true
  }

  /**
   * An impulse on every proxy, such as a door slam. Proxies it would rip are promoted
   * first, so the caller's live impulse breaks them physically. Others take the grip
   * loss and a kick to their sag and swing.
   */
  impulse(strength: number, cause: LossCause): void {
    for (const proxy of [...this.proxies.values()]) {
      if (proxy.falling) continue
      const block = this.state.blocks.get(proxy.blockId)
      if (!block || block.fixings.length === 0) continue
      const tough = toughness(block.q, block.mesh, block.noodles)
      const count = block.fixings.length
      if (wouldRip(block, strength) && this.promote(block.id)) continue
      for (const f of block.fixings)
        f.grip -= impulseLoss(f.grip, strength, count, tough)
      block.lastShock = cause
      block.lastShockMs = this.state.simMs
      proxy.vs += randRange(PROXY_SLAM_SAG_MIN, PROXY_SLAM_SAG_MAX, this.random)
      proxy.va += randRange(-PROXY_SLAM_SWING, PROXY_SLAM_SWING, this.random)
    }
  }

  /**
   * Promotes one proxy that a coming impulse of `strength` would rip, if any and if the
   * cap allows. Call it every step of a slam's warning, so its promotions spread out
   * instead of all landing on the impact's step. Returns whether it promoted one.
   */
  brace(strength: number): boolean {
    for (const proxy of this.proxies.values()) {
      if (proxy.falling) continue
      const block = this.state.blocks.get(proxy.blockId)
      if (block && wouldRip(block, strength)) return this.promote(block.id)
    }
    return false
  }

  /**
   * The proxy under a press at (x, y): the nearest nail within `nailRadius`, otherwise
   * the nearest posed particle within `jellyRadius`. World units.
   */
  nearest(
    x: number,
    y: number,
    nailRadius: number,
    jellyRadius: number
  ): ProxyHit | null {
    let best: ProxyHit | null = null
    let bestDist = nailRadius * nailRadius
    for (const proxy of this.proxies.values()) {
      if (proxy.falling) continue
      for (const f of this.state.blocks.get(proxy.blockId)?.fixings ?? []) {
        const d = (f.x - x) ** 2 + (f.y - y) ** 2
        if (d <= bestDist) {
          bestDist = d
          best = { blockId: proxy.blockId, nail: true }
        }
      }
    }
    if (best) return best
    bestDist = jellyRadius * jellyRadius
    for (const proxy of this.proxies.values()) {
      if (proxy.falling) continue
      const p = proxy.snapshot.positions
      const cos = Math.cos(proxy.a)
      const sin = Math.sin(proxy.a)
      for (let i = 0; i < p.length; i += 2) {
        const dx = p[i]! - proxy.pivotX
        const dy = p[i + 1]! - proxy.pivotY
        const px = proxy.pivotX + dx * cos - dy * sin
        const py = proxy.pivotY + dx * sin + dy * cos + proxy.s
        const d = (px - x) ** 2 + (py - y) ** 2
        if (d <= bestDist) {
          bestDist = d
          best = { blockId: proxy.blockId, nail: false }
        }
      }
    }
    return best
  }

  /**
   * Shakes a block off the wall without a body, as the uncle's door slam does: a live
   * body turns back into a proxy first, then it falls and splats with `cause`.
   */
  drop(blockId: number, cause: LossCause): boolean {
    if (this.promoted.has(blockId) && !this.demote(blockId)) return false
    const proxy = this.proxies.get(blockId)
    const block = this.state.blocks.get(blockId)
    if (!proxy || !block || proxy.falling) return false
    block.cause = cause
    proxy.va = randRange(-1.6, 1.6, this.random)
    this.startScriptedFall(proxy, block)
    return true
  }

  /** Turns every promoted body back into a proxy, posed as it hangs now. */
  demoteAll(): void {
    for (const id of [...this.promoted.keys()]) this.demote(id)
  }

  /** Demotes the slowest promoted body that isn't kept, moving or not. */
  private demoteSlowest(): boolean {
    let slowest = -1
    let speed = Infinity
    for (const id of this.promoted.keys()) {
      if (this.keep(id)) continue
      const v = this.wall.maxSpeed(id)
      if (v < speed) {
        speed = v
        slowest = id
      }
    }
    return slowest >= 0 && this.demote(slowest)
  }

  private demoteCalmest(): boolean {
    let calmest = -1
    let slowest = CALM_SPEED
    for (const id of this.promoted.keys()) {
      if (this.keep(id)) continue
      const speed = this.wall.maxSpeed(id)
      if (speed < slowest) {
        slowest = speed
        calmest = id
      }
    }
    return calmest >= 0 && this.demote(calmest)
  }

  private decay(block: BlockState, dtMs: number): void {
    const count = block.fixings.length
    const integrity =
      1 -
      (this.proxies.get(block.id)?.snapshot.tornSprings.length ?? 0) /
        BLOCK_SPRINGS
    for (const fixing of block.fixings) {
      fixing.grip -=
        (decayPerSecond({
          q: block.q,
          fixings: count,
          residue: block.residue,
          heat: this.wall.conditions.heat,
          mesh: block.mesh,
          screw: fixing.kind === 'screw',
          fly: false,
          holes: block.holes,
          integrity,
          section: null,
          scale: this.wall.conditions.assist ? ASSIST_DECAY : 1
        }) *
          dtMs) /
        1000
    }
  }

  /** The sag spring follows the extra slack since the picture; the swing spring returns to 0. */
  private move(proxy: Proxy, block: BlockState, dt: number): void {
    const s0 = Math.max(0, meanSlack(block) - proxy.baseSlack)
    proxy.vs += (-PROXY_SAG_K * (proxy.s - s0) - PROXY_SAG_DAMP * proxy.vs) * dt
    proxy.s += proxy.vs * dt
    const k = block.fixings.length >= 2 ? PROXY_SWING_K : PROXY_SWING_K_ONE
    proxy.va += (-k * proxy.a - PROXY_SWING_DAMP * proxy.va) * dt
    proxy.a += proxy.va * dt
  }

  private atRisk(proxy: Proxy, block: BlockState): boolean {
    if (block.fixings.length <= 1) return true
    const lines = blockWarningLines(block, this.state.phase === 'final')
    if (block.fixings.some(f => f.grip < lines.red)) return true
    return this.fallingAbove(proxy)
  }

  /** True when a falling body is about to land on this proxy. */
  private fallingAbove(proxy: Proxy): boolean {
    const p = proxy.snapshot.positions
    let top = Infinity
    let cx = 0
    for (let i = 0; i < p.length; i += 2) {
      top = Math.min(top, p[i + 1]!)
      cx += p[i]!
    }
    cx /= p.length / 2
    top += proxy.s
    for (const id of this.wall.liveIds()) {
      if (this.state.blocks.get(id)?.status !== 'falling') continue
      const body = this.wall.bodyOf(id)
      if (!body) continue
      let bottom = -Infinity
      let bx = 0
      for (const q of body.soft.bodies) {
        bottom = Math.max(bottom, q.position.y)
        bx += q.position.x
      }
      bx /= body.soft.bodies.length
      if (
        Math.abs(bx - cx) < 110 &&
        top - bottom < PROXY_FALL_REACH &&
        top > bottom - 40
      )
        return true
    }
    return false
  }

  private startScriptedFall(proxy: Proxy, block: BlockState): void {
    proxy.falling = true
    const cell = this.state.sections[block.section]?.cells[block.cell]
    for (const f of block.fixings) cell?.emptyNails.push({ x: f.x, y: f.y })
    block.fixings = []
    this.wall.markFalling(block)
  }

  private updateScriptedFall(
    proxy: Proxy,
    block: BlockState,
    dt: number
  ): void {
    proxy.vs += SCRIPTED_FALL_G * dt
    proxy.s += proxy.vs * dt
    proxy.a += proxy.va * dt
    const p = proxy.snapshot.positions
    let bottom = -Infinity
    let cx = 0
    for (let i = 0; i < p.length; i += 2) {
      bottom = Math.max(bottom, p[i + 1]!)
      cx += p[i]!
    }
    if (bottom + proxy.s + PARTICLE_RADIUS < FLOOR_Y) return
    this.proxies.delete(proxy.blockId)
    this.wall.splatWithoutBody(block, cx / (p.length / 2))
  }
}

function meanSlack(block: BlockState): number {
  if (block.fixings.length === 0) return 0
  let sum = 0
  for (const f of block.fixings) sum += slackFor(f.grip)
  return sum / block.fixings.length
}

function makeProxy(snapshot: BlockSnapshot, block: BlockState): Proxy {
  let px = 0
  let py = 0
  for (const f of block.fixings) {
    px += f.x
    py += f.y
  }
  const n = Math.max(1, block.fixings.length)
  return {
    blockId: block.id,
    snapshot,
    baseSlack: meanSlack(block),
    pivotX: px / n,
    pivotY: py / n,
    s: 0,
    vs: 0,
    a: 0,
    va: 0,
    falling: false
  }
}

/** The proxy's snapshot with its current sag and swing baked into the points. */
export function posedSnapshot(proxy: Proxy): BlockSnapshot {
  const { snapshot, s, a, pivotX, pivotY } = proxy
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const pose = (src: ArrayLike<number>, count: number) => {
    const out = new Float64Array(count * 2)
    for (let i = 0; i < count; i++) {
      const dx = src[i * 2]! - pivotX
      const dy = src[i * 2 + 1]! - pivotY
      out[i * 2] = pivotX + dx * cos - dy * sin
      out[i * 2 + 1] = pivotY + dx * sin + dy * cos + s
    }
    return out
  }
  return {
    ...snapshot,
    positions: pose(snapshot.positions, snapshot.positions.length / 2),
    pieces: snapshot.pieces.map(piece => {
      const points = pose(piece.points, piece.count)
      const centre = pose([piece.centerX, piece.centerY], 1)
      return {
        ...piece,
        points,
        centerX: centre[0]!,
        centerY: centre[1]!
      }
    })
  }
}

/** True when an impulse of `strength` would rip one of the block's nails. */
function wouldRip(block: BlockState, strength: number): boolean {
  const count = block.fixings.length
  if (count === 0) return false
  const tough = toughness(block.q, block.mesh, block.noodles)
  return block.fixings.some(
    f => f.grip - impulseLoss(f.grip, strength, count, tough) <= RIP_OUT
  )
}
