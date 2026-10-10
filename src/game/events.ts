import { randRange, rng, type Rng } from '../shared'
import { impulseLoss } from './grip'
import { toughness } from './quality'
import type { ProxyWall } from './sim/proxies'
import type { WallSim } from './sim/wallSim'
import { DIRECTOR, EVENT_POOLS, HOLD_MS, IMPULSE, TRUCK } from './tuning'
import type { GameState, LossCause } from './types'

// The event director decides when the neighbour slams the door, a truck rumbles past, a
// fly lands or the cat jumps, from each section's schedule, with mercy rules. The effects
// below apply an event's grip loss to the wall; the scenes add the warnings and the juice.

/** Every event the director can start. The heat wave overlaps the others. */
export type EventKind =
  'slam' | 'gentle-slam' | 'truck' | 'fly' | 'cat' | 'heat'
export type PoolKind = 'slam' | 'truck' | 'fly' | 'cat'

/** Events that land while you are away: they need nobody at the wall. */
const AWAY_KINDS: readonly PoolKind[] = ['slam', 'truck']

/** What the director looks at, once per step. */
export interface DirectorInput {
  simMs: number
  section: number
  upCount: number
  holdActive: boolean
  /** Carrying a tray or at the shop: random events wait for you; a hold's doesn't. */
  away: boolean
  /** An event is running; only one runs at a time. */
  busy: boolean
  /** Simulation time the last block fell. */
  lastFallMs: number
  /** The events that exist so far. */
  available: readonly PoolKind[]
  /**
   * How fast the random-event clock runs, 1 by default. The game passes the section's
   * ease, so a sparse or long-running section gets fewer events.
   */
  pace?: number
}

/**
 * Schedules each section's events with a seeded random source. The clock starts when
 * the 4th block goes up; then events come at the section's gaps, never while fewer than
 * 3 blocks are up, within 90s of a fall, or while you are away. Every hold from section
 * 2 gets one event 20s to 50s in, even while you are away (then a slam or a truck), and
 * section 1's hold gets the gentle slam at 40s.
 * Sections with a heat wave get one 1 to 3 minutes after their clock starts; it ignores
 * the other events and the mercy rule, but waits while you are away or a hold runs.
 */
export class Director {
  /**
   * When the next random event is due on the event clock, or null until the section's
   * clock starts. The event clock runs at `pace`, so it lags simulation time.
   */
  nextMs: number | null = null
  /** The event clock: simulation time scaled by each step's `pace`. */
  clockMs = 0
  /** When this section's heat wave is due, or null when it has none left. */
  heatMs: number | null = null
  /** When this hold's event is due, or null when no hold runs or it already struck. */
  holdEventMs: number | null = null
  private readonly random: Rng
  private section = -1
  private holdWasActive = false
  private lastSimMs: number | null = null

  constructor(seed = 11) {
    this.random = rng(seed)
  }

  /** Returns the event to start now, if any. */
  step(input: DirectorInput): EventKind | null {
    const dtMs = this.lastSimMs === null ? 0 : input.simMs - this.lastSimMs
    this.lastSimMs = input.simMs
    this.clockMs += Math.max(0, dtMs) * (input.pace ?? 1)
    if (input.section !== this.section) {
      this.section = input.section
      this.nextMs = null
      this.heatMs = null
      this.holdEventMs = null
      this.holdWasActive = false
    }
    const pool = EVENT_POOLS[input.section] ?? EVENT_POOLS[0]!
    if (input.holdActive && !this.holdWasActive) {
      // Hold times scale with the hold, so ?fast keeps the event inside it.
      const scale = HOLD_MS / 60_000
      const after =
        input.section === 0
          ? DIRECTOR.gentleSlamAtMs
          : randRange(DIRECTOR.holdFromMs, DIRECTOR.holdToMs, this.random)
      this.holdEventMs = input.simMs + after * scale
    } else if (!input.holdActive) this.holdEventMs = null
    this.holdWasActive = input.holdActive

    const heatDue =
      this.heatMs !== null && input.simMs >= this.heatMs && !input.away
    if (heatDue && !input.holdActive) {
      this.heatMs = null
      return 'heat'
    }
    if (input.holdActive) {
      // The hold's event never waits for you, or a trip to the shop would skip it. Away,
      // it is one that needs nobody at the wall: the door slam or the truck.
      if (input.busy || this.holdEventMs === null) return null
      if (input.simMs < this.holdEventMs) return null
      this.holdEventMs = null
      if (input.section === 0) return 'gentle-slam'
      return this.pick(pool.weights, input.available, input.away)
    }
    if (input.section === 0) return null
    if (this.nextMs === null) {
      if (input.upCount < DIRECTOR.armAt) return null
      this.nextMs = this.clockMs + pool.firstMs
      if (pool.heatWave)
        this.heatMs =
          input.simMs +
          randRange(DIRECTOR.heatFromMs, DIRECTOR.heatToMs, this.random)
      return null
    }
    if (input.busy || input.away || this.clockMs < this.nextMs) return null
    if (input.upCount < DIRECTOR.minUp) return null
    if (input.simMs - input.lastFallMs < DIRECTOR.mercyMs) return null
    this.nextMs =
      this.clockMs + randRange(pool.gapMinMs, pool.gapMaxMs, this.random)
    return this.pick(pool.weights, input.available)
  }

  /**
   * A weighted pick among the events that exist; the door slam when none of them do.
   * `away` leaves out the fly and the cat, which need you at the wall.
   */
  private pick(
    weights: Readonly<Partial<Record<PoolKind, number>>>,
    available: readonly PoolKind[],
    away = false
  ): PoolKind {
    const weightOf = (kind: PoolKind) =>
      away && !AWAY_KINDS.includes(kind) ? 0 : (weights[kind] ?? 0)
    let total = 0
    for (const kind of available) total += weightOf(kind)
    let roll = this.random() * total
    for (const kind of available) {
      const weight = weightOf(kind)
      if (weight <= 0) continue
      roll -= weight
      if (roll < 0) return kind
    }
    return 'slam'
  }
}

/**
 * A door slam lands: one impulse on every block up on the wall. Proxies at risk become
 * bodies first, so they break physically.
 */
export function slamImpact(
  state: GameState,
  wall: WallSim,
  proxies: ProxyWall | null,
  strength: number = IMPULSE.slam,
  cause: LossCause = 'slam'
): void {
  proxies?.impulse(strength, cause)
  for (const block of state.blocks.values())
    if (block.status === 'up') wall.impulse(block.id, strength, cause)
}

/**
 * A truck's shake. Its grip loss is worked out once, when the shaking starts, as if it
 * were one impulse, and paid out in equal ticks. So a truck never hits harder than its
 * warning lines promise, however many ticks it takes.
 */
export class TruckShake {
  private readonly perTick = new Map<number, number>()
  private ticksLeft: number

  constructor(
    private readonly state: GameState,
    private readonly wall: WallSim,
    strength: number = IMPULSE.truck,
    ticks: number = Math.round(TRUCK.shakeMs / TRUCK.tickMs)
  ) {
    this.ticksLeft = ticks
    for (const block of state.blocks.values()) {
      if (block.status !== 'up' || block.fixings.length === 0) continue
      const tough = toughness(block.q, block.mesh, block.noodles)
      const count = block.fixings.length
      for (const f of block.fixings)
        this.perTick.set(
          f.id,
          impulseLoss(f.grip, strength, count, tough) / ticks
        )
    }
  }

  get done(): boolean {
    return this.ticksLeft <= 0
  }

  /** One tick: every fixing the truck found at the start loses its share. */
  tick(): void {
    if (this.ticksLeft <= 0) return
    this.ticksLeft--
    for (const block of this.state.blocks.values()) {
      if (block.status !== 'up') continue
      let shaken = false
      for (const f of block.fixings) {
        const loss = this.perTick.get(f.id)
        if (loss === undefined) continue
        f.grip -= loss
        shaken = true
      }
      if (shaken) this.wall.shock(block.id, 'truck')
    }
  }
}
