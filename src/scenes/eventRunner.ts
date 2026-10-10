import {
  Director,
  slamImpact,
  TruckShake,
  type EventKind,
  type PoolKind
} from '../game/events'
import { upCount } from '../game/section'
import { IMPULSE, SHAKE, SHOVE, SLAM, TRUCK } from '../game/tuning'
import {
  palette,
  sfx,
  sketchCircle,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  vibrate,
  type LoopHandle,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import { Critters } from './critters'
import type { Game } from './game'
import { HeatWaveRunner } from './heatWave'

/** Every event the director can pick. */
const AVAILABLE: readonly PoolKind[] = ['slam', 'truck', 'fly', 'cat']
/**
 * The room's window, as an inset in the replay corner (art only). It shows whenever the
 * window matters: a truck going past, the cat on the sill, a heat wave.
 */
const WINDOW = { x: 404, y: 24, width: 176, height: 124 } as const
const SKY: SketchStyle = {
  fill: '#d0ebff',
  width: 5,
  color: palette.brown,
  seed: 300
}
const PANE: SketchStyle = {
  width: 4,
  color: palette.brown,
  passes: 1,
  seed: 304
}
const SILL: SketchStyle = { fill: palette.brown, width: 3, seed: 305 }
const TRUCK_BOX: SketchStyle = { fill: '#e9ecef', width: 3, seed: 301 }
const TRUCK_CAB: SketchStyle = { fill: palette.red, width: 3, seed: 302 }
const WHEEL: SketchStyle = { fill: palette.ink, width: 2, seed: 303 }
const TRUCK_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 15,
  color: palette.ink
}

/** An event in progress: when it started, and the truck's shake once it begins. */
interface Running {
  kind: EventKind
  startMs: number
  /** Stomps played so far, or truck ticks applied. */
  beats: number
  truck: TruckShake | null
  rumble: LoopHandle | null
  /** Shove direction, flipped every truck tick. */
  side: 1 | -1
}

/**
 * Runs the wall's events: asks the director when to start one, plays the neighbour's
 * door slams and the trucks (warning, impact, sounds, shake and hallway kick), and hands
 * the fly and the cat to `critters` and the heat wave to `heat`. The wall scene draws
 * the window inset.
 */
export class EventRunner {
  /** Picks the events. The dev balance runs swap in a differently seeded one. */
  director = new Director()
  running: Running | null = null
  /** Simulation time the last door slam landed, for the hallway's rattling door. */
  lastSlamMs = -Infinity
  readonly critters: Critters
  readonly heat: HeatWaveRunner

  constructor(private readonly game: Game) {
    this.critters = new Critters(game)
    this.heat = new HeatWaveRunner(game)
  }

  /** How far a coming door slam's stomping has got, 0 to 1, or 0 when none is coming. */
  get slamComing(): number {
    const run = this.running
    if (!run || (run.kind !== 'slam' && run.kind !== 'gentle-slam')) return 0
    return Math.min(1, (this.game.state.simMs - run.startMs) / SLAM.warnMs)
  }

  /** The event under way, if any. Only one runs at a time; a heat wave overlaps them. */
  get current(): EventKind | null {
    if (this.running) return this.running.kind
    if (this.critters.fly) return 'fly'
    if (this.critters.cat) return 'cat'
    return null
  }

  /**
   * Starts an event now: the director's pick, the final test's script, or a dev trigger.
   * Returns whether it started. The first of each kind brings its first-time tip.
   * `options.overlap` lets a slam come while the fly or the cat is about, and
   * `options.target` sends the fly to one block.
   */
  start(
    kind: EventKind,
    options: { overlap?: boolean; target?: number } = {}
  ): boolean {
    const started = this.begin(kind, options)
    if (started)
      this.game.firstTip(
        kind === 'gentle-slam' ? 'event-slam' : `event-${kind}`
      )
    return started
  }

  private begin(
    kind: EventKind,
    { overlap = false, target }: { overlap?: boolean; target?: number }
  ): boolean {
    if (kind === 'heat') return this.heat.start()
    if (this.running || (this.critters.busy && !overlap)) return false
    if (kind === 'fly') return this.critters.startFly(target)
    if (kind === 'cat') return this.critters.startCat()
    this.running = {
      kind,
      startMs: this.game.state.simMs,
      beats: 0,
      truck: null,
      rumble: null,
      side: 1
    }
    if (kind === 'truck') {
      this.running.rumble = sfx.loop('rumble', { volume: 0 })
      this.say('Rumble rumble…', palette.inkSoft, 26)
    }
    return true
  }

  /**
   * Starts what the director picks, or moves the running event on. `lastFallMs` feeds
   * the mercy rule. The director hears every step, so a hold that starts mid-event still
   * gets its event on time.
   */
  update(lastFallMs: number, dtMs: number): void {
    const game = this.game
    const state = game.state
    // The final test runs its own script, and a locked wall has nothing to shake.
    const directing =
      state.phase === 'play' && !state.sections[state.section]?.locked
    const kind =
      directing &&
      this.director.step({
        simMs: state.simMs,
        section: state.section,
        upCount: upCount(state, state.section),
        holdActive: state.sections[state.section]?.holdActive ?? false,
        away: state.carry !== null || state.scene === 'shop',
        busy: this.current !== null,
        lastFallMs,
        available: AVAILABLE,
        pace: game.wall.conditions.ease
      })
    if (kind) this.start(kind)
    this.critters.update(dtMs)
    this.heat.update()
    const run = this.running
    if (!run) return
    const elapsed = state.simMs - run.startMs
    if (run.kind === 'truck') this.updateTruck(run, elapsed)
    else this.updateSlam(run, elapsed)
  }

  /** Stomping from upstairs, then the door. */
  private updateSlam(run: Running, elapsed: number): void {
    const game = this.game
    const gentle = run.kind === 'gentle-slam'
    if (elapsed < SLAM.warnMs) {
      // Blocks the slam will rip become bodies one per step, not all on its step.
      game.proxies.brace(gentle ? IMPULSE.gentleSlam : IMPULSE.slam)
      if (elapsed < run.beats * SLAM.stompEveryMs) return
      run.beats++
      sfx.play('stomp', { volume: (gentle ? 0.35 : 0.55) + run.beats * 0.1 })
      game.fx.shake(gentle ? 1 : 1.5)
      game.fx.caption('Stomp', run.beats % 2 ? 140 : 460, 210, {
        world: false,
        size: 24 + run.beats * 3,
        color: palette.inkSoft
      })
      return
    }
    this.running = null
    this.lastSlamMs = game.state.simMs
    const state = game.state
    slamImpact(
      state,
      game.wall,
      game.proxies,
      gentle ? IMPULSE.gentleSlam : IMPULSE.slam
    )
    game.wall.shove(1, -0.35, gentle ? SHOVE.gentleSlam : SHOVE.slam)
    sfx.play('slam', { volume: gentle ? 0.6 : 1 })
    sfx.play('creak', { volume: gentle ? 0.4 : 0.8 })
    game.fx.shake(gentle ? SHAKE.slam / 2 : SHAKE.slam)
    vibrate(gentle ? 30 : 60)
    this.say(gentle ? 'slam.' : 'SLAM!', palette.red, gentle ? 34 : 56)
    game.fx.caption('KEEP IT DOWN', 300, 300, {
      world: false,
      size: gentle ? 20 : 26,
      color: palette.inkSoft,
      ttlMs: 1800
    })
    if (state.carry)
      state.carry.drift += (Math.random() < 0.5 ? -1 : 1) * SLAM.carryKickDeg
    if (!gentle && state.scene !== 'wall')
      game.alert('The neighbour slammed the door. The wall shook.', 'info')
  }

  /** A rumble that fades in, then 6s of shaking ticks while it rises and falls. */
  private updateTruck(run: Running, elapsed: number): void {
    const game = this.game
    const state = game.state
    const total = TRUCK.warnMs + TRUCK.shakeMs
    if (elapsed < TRUCK.warnMs) {
      run.rumble?.setVolume(0.6 * (elapsed / TRUCK.warnMs))
      return
    }
    if (!run.truck && state.scene !== 'wall')
      game.alert('A truck rumbled past. The wall is shaking.', 'info')
    run.truck ??= new TruckShake(state, game.wall)
    const shaking = elapsed - TRUCK.warnMs
    // Loudest in the middle of the shake.
    run.rumble?.setVolume(
      0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, shaking / TRUCK.shakeMs))
    )
    while (run.beats * TRUCK.tickMs <= shaking && !run.truck.done) {
      run.beats++
      run.truck.tick()
      run.side = run.side === 1 ? -1 : 1
      game.wall.shove(run.side, 0.2, SHOVE.truck)
      if (run.beats % 5 === 0) game.fx.shake(2)
      if (state.carry)
        state.carry.drift += (Math.random() * 2 - 1) * TRUCK.carryJitterDeg
    }
    if (elapsed < total) return
    run.rumble?.stop(500)
    this.running = null
  }

  /** Silences the truck's rumble while a dialog pauses the run; the next step brings it back. */
  mute(): void {
    this.running?.rumble?.setVolume(0)
    this.heat.mute()
  }

  /** A big caption over the wall, in design units. */
  private say(text: string, colour: string, size: number): void {
    this.game.fx.caption(text, 300, 250, {
      world: false,
      size,
      color: colour,
      ttlMs: 1600
    })
  }

  /**
   * The window inset while the window matters: a truck sliding past, the cat on the
   * sill. Design units. Whole Wall skips it, since the inset would cover the uncle's
   * portrait.
   */
  drawWindow(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const run = this.running
    const truck = run?.kind === 'truck' ? run : null
    const cat = this.critters.sillPose() !== null
    const hot = this.heat.wave !== null
    if ((!truck && !cat && !hot) || this.game.view !== 'section') return
    const w = WINDOW
    if (!this.heat.drawSky(ctx, w.x, w.y, w.width, w.height))
      sketchRect(ctx, w.x, w.y, w.width, w.height, SKY)
    if (truck) {
      const t =
        (this.game.state.simMs - truck.startMs) / (TRUCK.warnMs + TRUCK.shakeMs)
      ctx.save()
      ctx.beginPath()
      ctx.rect(w.x + 4, w.y + 4, w.width - 8, w.height - 8)
      ctx.clip()
      const x = w.x + w.width + 20 - t * (w.width + 260)
      const y = w.y + 40 + Math.sin(t * 90) * 1.5
      sketchRoundRect(ctx, x, y, 170, 56, 6, TRUCK_BOX)
      sketchText(ctx, 'WOBBLE FREIGHT', x + 85, y + 28, TRUCK_TEXT)
      sketchRoundRect(ctx, x - 44, y + 18, 46, 38, 8, TRUCK_CAB)
      sketchCircle(ctx, x - 14, y + 60, 9, WHEEL)
      sketchCircle(ctx, x + 132, y + 60, 9, WHEEL)
      ctx.restore()
    }
    sketchLine(
      ctx,
      w.x + w.width / 2,
      w.y + 4,
      w.x + w.width / 2,
      w.y + w.height - 4,
      PANE
    )
    this.heat.drawCurtains(ctx, w.x, w.y, w.width, w.height)
    sketchRect(ctx, w.x - 8, w.y + w.height - 10, w.width + 16, 14, SILL)
    this.critters.drawOnSill(ctx, timeMs)
  }
}
