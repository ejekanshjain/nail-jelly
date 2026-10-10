import {
  carryOptions,
  HALLWAY_SPLAT_Y,
  loseCarried,
  shooHallwayCat,
  steerOrigin,
  stepCarry,
  type CarryEvent
} from '../game/carry'
import { routeX } from '../game/mess'
import { worldRadius, type PointerKind } from '../game/hit'
import { blameLine, heldForLabel } from '../game/labels'
import { cloudiness, lumpCount } from '../game/quality'
import { CARRY, CAT, CRITTER_HIT } from '../game/tuning'
import type { CarryBlock, Flavour, TrayMould } from '../game/types'
import {
  CachedLayer,
  damp,
  isHeld,
  isTouchDevice,
  JoltMeter,
  palette,
  pick,
  prefersMotion,
  settings,
  sfx,
  sketchCircle,
  sketchLine,
  sketchText,
  TiltAxis,
  vibrate,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import {
  drawEndDoor,
  drawLevel,
  drawNeighbourDoor,
  drawRoute,
  drawTray,
  drawYou,
  HALL_FLOOR_Y,
  HALL_SEGMENT,
  HALL_SEGMENT_RECT,
  paintHallSegment,
  TRAY_Y,
  YOU_X
} from './art/hallway'
import {
  drawFace,
  drawGhostBlock,
  FLAVOUR_COLOURS,
  GHOST_H,
  type FaceMood
} from './art/jelly'
import { drawCat, type CatLook } from './art/critters'
import { drawSplatAt } from './art/wall'
import { Fx } from './fx'
import type { Game } from './game'
import { Mopper, splatAt } from './mopper'
import type { Scene } from './scene'

/** Blocks ride the tray at this fraction of their wall size, so 4 fill it edge to edge. */
const BLOCK_SCALE = CARRY.pitch / 100
const BLOCK_H = GHOST_H * BLOCK_SCALE
/** Walking, from the pointer or these keys. */
const WALK_KEYS = ['KeyW', 'ArrowUp', 'Space'] as const
/** A dropped block falls with this gravity (units/s^2) and splats on the runner. */
const FALL_G = 2600
const LAND_Y = 600
/** Past this tilt the level bubble turns red. */
const DANGER_DEG = 10
/** The idle hallway shows the route from here. */
const IDLE_POS = 600
/** The idle hallway stops with the next splat this far ahead of you. */
const IDLE_AHEAD = 130
/** Route position where a hallway segment starts. */
const SEGMENT_PHASE = -200

/** A block in the air after sliding off the tray, in route space. */
interface Falling {
  mould: TrayMould
  flavour: Flavour
  routeX: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  seed: number
}

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const RING: SketchStyle = {
  width: 3,
  color: palette.blue,
  passes: 1,
  wobble: 0.8,
  seed: 601
}
const AIM: SketchStyle = {
  width: 3,
  color: 'rgba(28, 126, 214, 0.6)',
  passes: 1,
  wobble: 0.5,
  seed: 602
}
const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
const SPLAT_AT: number[] = []
const SHAKE = { x: 0, y: 0 }
/** The cat on the runner: where its feet stand, and how fast it bolts. */
const CAT_Y = 600
const CAT_FLEE = 700
const CAT_FLEE_MS = 1000
const CAT_LOOK: CatLook = {
  facing: -1,
  earsFlat: false,
  wiggle: 0,
  tilt: 0,
  scale: 1.1
}

/**
 * The hallway. With a set tray in your hands it is the carry: hold to walk while the
 * tray drifts, steer it level with tilt, a thumb, the mouse or keys, and keep the jelly
 * from sliding off. Without one it is a quiet corridor with any splats on its floor.
 */
export class HallwayScene implements Scene {
  readonly id = 'hallway' as const
  /** Dev override for the steering input, from -1 to 1, or null. */
  tiltOverride: number | null = null
  private layer: CachedLayer | null = null
  private readonly fx = new Fx(LAND_Y + 30)
  private tilt: TiltAxis | null = null
  /** Which input steered the tray on the last step: motion, keys, pointer or none. */
  get steering(): string {
    return this.tilt?.source ?? 'none'
  }
  private readonly jolt = new JoltMeter()
  private readonly events: CarryEvent[] = []
  private falling: Falling[] = []
  /** Stride phase, 0 to 1, for the legs. */
  private stride = 0
  /** Blocks already warned about the edge this carry. */
  private readonly warned = new Set<TrayMould>()
  private walkedOnce = false
  /**
   * Where the mouse sat when the carry began, until it moves. It is wherever you clicked
   * to leave the kitchen, so it steers nothing until you move it.
   */
  private staleMouse: { x: number; y: number } | null = null
  /** Where the idle hallway looks: it walks you to the next splat to mop. */
  private idlePos = IDLE_POS
  /** The cat bolting off the runner: from where on the route, and for how long so far. */
  private fleeing: { at: number; ms: number } | null = null
  private readonly mopper: Mopper

  constructor(private readonly game: Game) {
    this.mopper = new Mopper(game, this.fx, splat => this.place(splat))
  }

  /** A hallway splat's spot on screen while idle, in design units: just ahead of you. */
  private place(splat: { x: number; y: number }): { x: number; y: number } {
    return { x: YOU_X + IDLE_AHEAD + splat.x - this.idlePos, y: splat.y }
  }

  /** The first hallway splat along the route, or null. */
  private nextSplat(): number | null {
    let best: number | null = null
    for (const splat of this.game.state.splats)
      if (splat.room === 'hallway' && (best === null || splat.x < best))
        best = splat.x
    return best
  }

  /** Whether the hallway's cached art is alive, for the dev perf report. */
  get hasLayer(): boolean {
    return this.layer !== null
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport) this.layer ??= this.createLayer(viewport)
    this.idlePos = this.nextSplat() ?? IDLE_POS
  }

  /** Leaving lands anything still in the air, so every drop leaves its splat. */
  exit(): void {
    this.mopper.release()
    this.fleeing = null
    for (const fall of this.falling) this.land(fall)
    this.falling = []
    this.layer?.dispose()
    this.layer = null
  }

  /** A carry starts: level the sensors where the phone is now. */
  beginCarry(): void {
    this.game.motion?.calibrate()
    this.jolt.reset()
    this.warned.clear()
    this.walkedOnce = false
    this.stride = 0
    const pointer = this.game.pointer
    this.staleMouse =
      pointer && pointer.lastType !== 'touch'
        ? { x: pointer.x, y: pointer.y }
        : null
  }

  tip(): string {
    const carry = this.game.state.carry
    if (carry?.catAt != null && carry.catAt - carry.pos < 500)
      return 'A cat on the runner! Tap it to shoo it, or you trip.'
    if (!carry)
      return this.nextSplat() === null
        ? 'Nothing to carry. Take a set tray from the fridge.'
        : 'Rub the splat to scrape it up, then keep rubbing to mop.'
    const pointer = this.game.pointer
    const motion = this.game.motion
    if (motion && pointer && prefersMotion(motion, pointer))
      return 'Hold anywhere to walk. Tilt the phone to keep the tray level.'
    if (this.touchSteering())
      return 'Hold to walk. Slide your thumb left or right to level the tray.'
    return 'Hold the mouse or W to walk. Steer with the mouse, or A and D.'
  }

  // ---------------------------------------------------------------- Input

  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void {
    const carry = this.game.state.carry
    if (carry) {
      if (this.pressCat(x, y, pointer)) return
      if (this.tilt) this.tilt.originX = steerOrigin(pointer, x, YOU_X)
      return
    }
    const scale = this.game.viewport?.scale ?? 1
    const splat = splatAt(
      this.game.state.splats,
      x,
      y,
      Math.max(16, 24 / scale),
      s => (s.room === 'hallway' ? this.place(s) : null)
    )
    if (splat) {
      this.mopper.press(splat, x, y, timeMs)
      return
    }
    this.fx.caption(
      pick(['Creak.', 'KEEP IT DOWN', 'Echo… echo…']),
      x,
      y - 20,
      { world: false, size: 26, color: palette.inkSoft }
    )
  }

  onDrag(x: number, y: number, timeMs: number): void {
    this.mopper.drag(x, y, timeMs)
  }

  /** A tap on the cat sitting on the runner shoos it. Returns whether it was there. */
  private pressCat(x: number, y: number, pointer: PointerKind): boolean {
    const carry = this.game.state.carry
    if (carry?.catAt == null) return false
    const scale = this.game.viewport?.scale ?? 1
    const cx = YOU_X + carry.catAt - carry.pos
    const reach = worldRadius(CRITTER_HIT, scale, pointer)
    if (Math.hypot(x - cx, y - (CAT_Y - 30)) > reach) return false
    const at = carry.catAt
    shooHallwayCat(carry)
    this.fleeing = { at, ms: 0 }
    sfx.play('meow', { pitch: 0.6 })
    this.fx.caption('Shoo!', cx, CAT_Y - 90, {
      world: false,
      size: 36,
      color: palette.green
    })
    return true
  }

  onRelease(): void {
    this.mopper.release()
  }
  onKey(): void {}

  private touchSteering(): boolean {
    const pointer = this.game.pointer
    const type = pointer?.lastType ?? ''
    return type === 'touch' || (type === '' && isTouchDevice())
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.fx.update(dtMs)
    this.updateFalling(dtMs)
    if (this.fleeing) {
      this.fleeing.ms += dtMs
      if (this.fleeing.ms >= CAT_FLEE_MS) this.fleeing = null
    }
    const game = this.game
    const carry = game.state.carry
    if (!carry) {
      // Idle: stroll to the next splat once the current one is clean.
      if (!this.mopper.active)
        this.idlePos = damp(
          this.idlePos,
          this.nextSplat() ?? this.idlePos,
          3,
          dtMs / 1000
        )
      return
    }
    if (carry.arrived) return
    const pointer = game.pointer
    const keys = game.keys
    if (pointer && !this.tilt)
      this.tilt = new TiltAxis({
        motion: game.motion,
        keys,
        pointer,
        pointerRange: CARRY.pointerRange
      })
    // A mouse steers from the tray's ring; a thumb from where it pressed.
    if (this.tilt && pointer?.lastType !== 'touch') this.tilt.originX = YOU_X
    const stale = this.staleMouse
    if (stale && pointer && (pointer.x !== stale.x || pointer.y !== stale.y))
      this.staleMouse = null
    const override = import.meta.env.DEV ? this.tiltOverride : null
    let steer = override ?? this.tilt?.update(dtMs) ?? 0
    if (override === null && this.staleMouse && this.tilt?.source === 'pointer')
      steer = 0
    this.feedJolt(dtMs)
    const walking = pointer && keys ? isHeld(pointer, keys, WALK_KEYS) : false
    const assist = settings.get().assist
    this.events.length = 0
    stepCarry(
      carry,
      dtMs,
      { walking, steer, jolt: this.jolt.over },
      Math.random,
      carryOptions(game.state.section, assist),
      this.events
    )
    if (carry.walking) {
      this.walkedOnce = true
      this.stride = (this.stride + dtMs / (CARRY.stepMs * 2)) % 1
    }
    for (const event of this.events) this.onCarryEvent(event)
    this.warnNearEdge()
  }

  private feedJolt(dtMs: number): void {
    const { motion, pointer } = this.game
    if (motion && pointer && prefersMotion(motion, pointer))
      this.jolt.feedMotion(motion.jolt, dtMs)
    else if (pointer && (pointer.isDown || pointer.lastType === 'mouse'))
      this.jolt.feedPointer(pointer.vx, pointer.vy, dtMs)
    else this.jolt.feed(0, dtMs)
  }

  private onCarryEvent(event: CarryEvent): void {
    const game = this.game
    const carry = game.state.carry!
    switch (event.type) {
      case 'step':
        sfx.play('tick', { volume: 0.18, pitch: 0.45 + Math.random() * 0.1 })
        break
      case 'hop':
        sfx.play('boing', { volume: 0.45, pitch: 1.3 })
        this.fx.caption('Whoa!', YOU_X, TRAY_Y - 110, {
          world: false,
          size: 30,
          color: palette.orange
        })
        vibrate(15)
        break
      case 'drop': {
        const a = (carry.angle * Math.PI) / 180
        const flavour = game.state.tray?.flavour ?? 'strawberry'
        this.falling.push({
          mould: event.mould,
          flavour,
          routeX: carry.pos + Math.cos(a) * event.x,
          y: TRAY_Y + Math.sin(a) * event.x - BLOCK_H / 2,
          vx: Math.cos(a) * event.v + event.side * 50,
          vy: Math.sin(a) * Math.abs(event.v) - 160,
          angle: a,
          spin: event.side * 5,
          seed: Math.floor(Math.random() * 1000)
        })
        sfx.play('whoosh', { volume: 0.5, pitch: 1.2 })
        this.fx.caption('NOOO', YOU_X, TRAY_Y - 150, {
          world: false,
          size: 40,
          color: palette.red
        })
        break
      }
      case 'slip':
        sfx.play('slosh')
        sfx.play('boing', { volume: 0.4, pitch: 0.7 })
        vibrate(40)
        this.fx.shake(6)
        this.fx.caption('WHOA', YOU_X + event.side * 90, TRAY_Y - 120, {
          world: false,
          size: 44,
          color: palette.red
        })
        this.fx.caption('Should have mopped that.', YOU_X, 150, {
          world: false,
          size: 24,
          color: palette.inkSoft,
          ttlMs: 2000
        })
        break
      case 'trip': {
        const at = carry.pos + CAT.tripReach
        this.fleeing = { at, ms: 0 }
        sfx.play('meow', { pitch: 1.4 })
        sfx.play('boing', { volume: 0.4, pitch: 0.7 })
        vibrate(40)
        this.fx.shake(6)
        this.fx.caption('MRROW!', YOU_X + 70, CAT_Y - 100, {
          world: false,
          size: 40,
          color: palette.red
        })
        this.fx.caption('You tripped over the cat.', YOU_X, 150, {
          world: false,
          size: 24,
          color: palette.inkSoft,
          ttlMs: 2000
        })
        break
      }
      case 'arrive':
        sfx.play('ding')
        game.finishCarry()
        break
      case 'empty':
        sfx.play('fail', { volume: 0.6 })
        game.emptyCarry()
        break
    }
  }

  /** "Careful…" once per block as it nears an end. */
  private warnNearEdge(): void {
    const carry = this.game.state.carry
    if (!carry) return
    for (const block of carry.blocks) {
      if (Math.abs(block.x) < carry.edge - 22 || this.warned.has(block.mould))
        continue
      this.warned.add(block.mould)
      sfx.play('squish', { volume: 0.4, pitch: 1.5 })
      this.fx.caption(
        'Careful…',
        YOU_X + Math.sign(block.x) * 150,
        TRAY_Y - 90,
        {
          world: false,
          size: 26,
          color: palette.orange
        }
      )
    }
  }

  private updateFalling(dtMs: number): void {
    if (this.falling.length === 0) return
    const dt = dtMs / 1000
    this.falling = this.falling.filter(fall => {
      fall.vy += FALL_G * dt
      fall.routeX += fall.vx * dt
      fall.y += fall.vy * dt
      fall.angle += fall.spin * dt
      if (fall.y < LAND_Y) return true
      this.land(fall)
      return false
    })
  }

  /** A falling block hits the runner: lost, splatted, blamed. */
  private land(fall: Falling): void {
    const game = this.game
    const block = loseCarried(
      game.state,
      fall.mould,
      fall.flavour,
      fall.routeX,
      fall.seed
    )
    game.carryLoss(block)
    const pos = game.state.carry?.pos ?? this.idlePos
    const x = YOU_X + fall.routeX - pos
    sfx.play('splat')
    vibrate(80)
    this.fx.shake(8)
    this.fx.splash(x, LAND_Y, FLAVOUR_COLOURS[fall.flavour].fill)
    this.fx.caption(heldForLabel(block), YOU_X, 120, {
      world: false,
      size: 30,
      color: palette.red,
      ttlMs: 2400
    })
    this.fx.caption(blameLine(block), YOU_X, 160, {
      world: false,
      size: 24,
      color: palette.inkSoft,
      ttlMs: 2600
    })
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= this.createLayer(viewport)
    const state = this.game.state
    const carry = state.carry
    const pos = carry?.pos ?? this.idlePos
    const shake = this.fx.shakeOffset(SHAKE)
    ctx.save()
    ctx.translate(shake.x, shake.y)

    // The repeating segment, scrolled so you stay at YOU_X. Its phase keeps the
    // neighbours' doors clear of the doors at both ends of the route.
    const view = viewport.view
    const length = carry?.length ?? CARRY.route
    const scroll = pos - YOU_X
    let x =
      Math.floor((view.x + scroll - SEGMENT_PHASE) / HALL_SEGMENT) *
        HALL_SEGMENT +
      SEGMENT_PHASE -
      scroll
    const events = this.game.events
    const ajar = events.slamComing
    const slamMs = state.simMs - events.lastSlamMs
    for (; x < view.x + view.width; x += HALL_SEGMENT) {
      ctx.save()
      ctx.translate(x, 0)
      this.layer.draw(ctx)
      ctx.restore()
      drawNeighbourDoor(ctx, x, ajar, slamMs)
    }
    drawEndDoor(ctx, YOU_X - pos - 230, 'Kitchen', 610)
    drawEndDoor(ctx, YOU_X + length - pos + 70, 'Wall', 611)

    // Splats on the runner at their route positions. During a carry the kitchen's and
    // the wall room's splats lie at the route's ends, since you walk through them too.
    SPLAT_AT.length = 0
    for (const splat of state.splats) {
      if (!carry && splat.room !== 'hallway') continue
      const at = routeX(splat, length)
      if (at === null) continue
      SPLAT_AT.push(at)
      if (Math.abs(at - pos) < view.width)
        drawSplatAt(
          ctx,
          splat,
          YOU_X + at - pos + (carry ? 0 : IDLE_AHEAD),
          HALLWAY_SPLAT_Y,
          this.game.layers
        )
    }

    this.drawCat(ctx, pos, timeMs)
    if (carry) this.drawCarry(ctx, timeMs)
    else drawYou(ctx, YOU_X, 0, 0, false, 600, 0, timeMs)
    this.drawFalling(ctx, pos)
    this.mopper.draw(ctx, timeMs)
    ctx.restore()

    if (carry) {
      drawLevel(
        ctx,
        carry.angle,
        carryOptions(state.section, settings.get().assist).gripDeg,
        DANGER_DEG
      )
      drawRoute(ctx, carry.pos, carry.length, SPLAT_AT)
      this.drawHint(ctx, timeMs)
    } else drawRoute(ctx, this.idlePos, length, SPLAT_AT)
    this.fx.drawDroplets(ctx)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  /** The cat sitting on the runner ahead, or bolting off it. */
  private drawCat(
    ctx: CanvasRenderingContext2D,
    pos: number,
    timeMs: number
  ): void {
    const at = this.game.state.carry?.catAt
    if (at != null) {
      CAT_LOOK.facing = -1
      CAT_LOOK.earsFlat = false
      drawCat(ctx, YOU_X + at - pos, CAT_Y, 'sit', timeMs, CAT_LOOK)
    }
    const flee = this.fleeing
    if (!flee) return
    CAT_LOOK.facing = 1
    CAT_LOOK.earsFlat = true
    const x = YOU_X + flee.at - pos + (CAT_FLEE * flee.ms) / 1000
    drawCat(ctx, x, CAT_Y, 'run', timeMs, CAT_LOOK)
  }

  private drawCarry(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const carry = this.game.state.carry!
    let worry = Math.min(1, Math.abs(carry.angle) / DANGER_DEG)
    for (const block of carry.blocks)
      worry = Math.max(worry, slidOut(block, carry.edge))
    drawYou(ctx, YOU_X, this.stride, worry, true, 600, carry.angle, timeMs)
    this.drawSteering(ctx)

    ctx.save()
    ctx.translate(YOU_X, TRAY_Y)
    ctx.rotate((carry.angle * Math.PI) / 180)
    drawTray(ctx, carry.edge - CARRY.edgeMargin / 2, 620)
    const flavour = this.game.state.tray?.flavour ?? 'strawberry'
    for (const block of carry.blocks)
      this.drawBlock(ctx, block, flavour, carry.edge, timeMs)
    ctx.restore()
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    block: CarryBlock,
    flavour: Flavour,
    edge: number,
    timeMs: number
  ): void {
    const hop =
      block.hopMs > 0 ? Math.sin((block.hopMs / CARRY.hopMs) * Math.PI) * 22 : 0
    const y = -BLOCK_H / 2 - 1 - hop
    const seed = Math.floor(block.mould.q * 1000)
    drawGhostBlock(
      ctx,
      block.x,
      y,
      BLOCK_SCALE,
      flavour,
      cloudiness(block.mould.make),
      lumpCount(block.mould.make),
      seed,
      0,
      block.mould.make.noodles
    )
    const mood: FaceMood =
      slidOut(block, edge) > 0.5 || hop > 0
        ? 'scared'
        : Math.abs(block.v) > 12
          ? 'worried'
          : 'calm'
    ctx.save()
    ctx.translate(block.x, y + 2)
    ctx.scale(BLOCK_SCALE * 1.3, BLOCK_SCALE * 1.3)
    drawFace(ctx, 0, 0, mood, seed + Math.floor(timeMs / 160))
    ctx.restore()
  }

  /** The mouse's target ring at the tray, or the thumb's origin, with a line to the pointer. */
  private drawSteering(ctx: CanvasRenderingContext2D): void {
    const tilt = this.tilt
    const pointer = this.game.pointer
    if (!tilt || !pointer || tilt.source !== 'pointer' || this.staleMouse)
      return
    const y = TRAY_Y + 64
    const px = Math.max(
      tilt.originX - CARRY.pointerRange,
      Math.min(tilt.originX + CARRY.pointerRange, pointer.x)
    )
    const oy = pointer.lastType === 'touch' ? pointer.y : y
    sketchCircle(ctx, tilt.originX, oy, 18, RING)
    sketchLine(ctx, tilt.originX, oy, px, oy, AIM)
    sketchCircle(ctx, px, oy, 6, AIM)
  }

  private drawFalling(ctx: CanvasRenderingContext2D, pos: number): void {
    for (const fall of this.falling) {
      ctx.save()
      ctx.translate(YOU_X + fall.routeX - pos, fall.y)
      ctx.rotate(fall.angle)
      drawGhostBlock(
        ctx,
        0,
        0,
        BLOCK_SCALE,
        fall.flavour,
        cloudiness(fall.mould.make),
        lumpCount(fall.mould.make),
        fall.seed,
        0,
        fall.mould.make.noodles
      )
      ctx.scale(BLOCK_SCALE * 1.3, BLOCK_SCALE * 1.3)
      drawFace(ctx, 0, 2, 'falling', fall.seed)
      ctx.restore()
    }
  }

  /** "Hold to walk" until you take your first step. */
  private drawHint(ctx: CanvasRenderingContext2D, timeMs: number): void {
    if (this.walkedOnce) return
    const bob = Math.sin(timeMs * 0.006) * 4
    const motion = this.game.motion
    const pointer = this.game.pointer
    const text =
      (motion && pointer && prefersMotion(motion, pointer)) ||
      this.touchSteering()
        ? 'Hold to walk'
        : 'Hold the mouse or W to walk'
    sketchText(ctx, text, YOU_X, HALL_FLOOR_Y + 60 + bob, HINT)
  }

  /** The repeating segment, its doodle showing the sections locked so far. */
  private createLayer(viewport: Viewport): CachedLayer {
    let locks = 0
    for (const section of this.game.state.sections)
      if (section.lockedOnce) locks++
    return new CachedLayer(
      viewport,
      ctx => paintHallSegment(ctx, locks),
      HALL_SEGMENT_RECT
    )
  }
}

/** How far a block has slid into the margin before the tray's end, 0 at its start, 1 off. */
function slidOut(block: CarryBlock, edge: number): number {
  return Math.max(
    0,
    (Math.abs(block.x) - (edge - CARRY.edgeMargin)) / CARRY.edgeMargin
  )
}
