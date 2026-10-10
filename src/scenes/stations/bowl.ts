import { worldRadius, type PointerKind } from '../../game/hit'
import { canPour, finishStir } from '../../game/kitchen'
import {
  createStir,
  startStroke,
  stirCircle,
  type Stir,
  type StirEvent
} from '../../game/stir'
import { firstTime } from '../../game/tutorial'
import { CRITTER_HIT, STIR, TUTORIAL } from '../../game/tuning'
import { bowlCleanliness } from '../../game/wash'
import {
  CachedLayer,
  CircleGesture,
  hash01,
  palette,
  settings,
  sfx,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchText,
  toast,
  vibrate,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { BOWL, paintBowl } from '../art/bowl'
import { drawFly, drawSquashedFly } from '../art/critters'
import { FLAVOUR_COLOURS } from '../art/jelly'
import { ROOM_RECT } from '../art/rooms'
import { Fx } from '../fx'
import type { Game } from '../game'
import type { KitchenScene } from '../kitchenScene'
import type { Station } from './station'

/** After the stir finishes, the close-up stays this long before moving on. */
const DONE_HOLD_MS = 1300
/** Lumps in the mix before the first circle; they fade as you stir. */
const START_LUMPS = 8

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const SHAKE = { x: 0, y: 0 }
const LIQUID: SketchStyle = { width: 3, seed: 720 }
const SWIRL: SketchStyle & { smooth: boolean } = {
  width: 4,
  color: 'rgba(255, 255, 255, 0.55)',
  passes: 1,
  seed: 721,
  smooth: true
}
const LUMP: SketchStyle = { width: 2, passes: 1, seed: 722 }
const GUNK: SketchStyle = {
  fill: 'rgba(156, 106, 70, 0.7)',
  width: 0,
  wobble: 2,
  seed: 726
}
const SPOON_HEAD: SketchStyle = { fill: '#adb5bd', width: 3, seed: 723 }
const SPOON_HANDLE: SketchStyle = { width: 12, color: '#868e96', seed: 724 }
const GUIDE: SketchStyle = {
  width: 4,
  color: 'rgba(240, 140, 0, 0.75)',
  passes: 1,
  wobble: 1,
  seed: 725
}
const COUNT: SketchTextStyle = {
  font: 'marker',
  size: 44,
  color: palette.ink,
  outline: palette.paper
}
const LABEL: SketchTextStyle = { size: 24, color: palette.inkSoft }
const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
/** Where the tutorial's fly lands on the mix, in design units. */
const FLY_SPOT = { x: BOWL.x + 70, y: BOWL.y - 60 } as const
/** A swatted fly stays flattened on the mix this long. */
const SQUASHED_MS = 900
const SWIRL_POINTS = new Float64Array(10)
const LUMP_POINTS = new Float64Array(12)
const GUIDE_POINTS = new Float64Array(26)

/**
 * The bowl close-up. Draw 50 circles around the bowl's centre. Steady circles score a
 * high evenness; circles quicker than 0.45s slosh, and some spill onto the floor. The
 * spoon bends at 45. Leaving the bowl starts the count again.
 */
export class BowlStation implements Station {
  readonly view = 'bowl' as const
  private layer: CachedLayer | null = null
  private gesture = this.newGesture()
  private stir: Stir = createStir()
  // Slosh droplets vanish at the bowl's bottom rim, not off the bottom of the screen.
  private readonly fx = new Fx(BOWL.y + BOWL.rim)
  /** How clean the bowl was when you sat down to stir. */
  private clean = 1
  private pressed = false
  private spoonX = BOWL.x + 120
  private spoonY = BOWL.y - 60
  private leaveInMs = -1
  /** The tutorial's fly on the mix, and when it was swatted (or -1 while alive). */
  private fly: { swattedMs: number } | null = null

  constructor(
    private readonly game: Game,
    private readonly kitchen: KitchenScene
  ) {}

  get hasLayer(): boolean {
    return this.layer !== null
  }

  /** The stir in progress and the gesture's evenness, for the dev API. */
  get current(): Readonly<Stir> & { evenness: number } {
    return { ...this.stir, evenness: this.gesture.evenness }
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport) this.layer ??= new CachedLayer(viewport, paintBowl, ROOM_RECT)
    this.gesture = this.newGesture()
    this.stir = createStir()
    this.leaveInMs = -1
    this.pressed = false
    this.fly = null
    this.clean = bowlCleanliness(this.game.state)
    if (this.clean < 1)
      this.fx.caption('Dirty bowl. This will be cloudy.', BOWL.x, 120, {
        world: false,
        color: palette.orange,
        size: 30,
        ttlMs: 2400
      })
  }

  exit(): void {
    this.layer?.dispose()
    this.layer = null
    this.pressed = false
    // The count starts over when you come back, so say so as you walk off.
    const circles = this.stir.circles
    if (circles > 0 && !this.stir.done && this.game.state.mix?.stage === 'stir')
      toast(
        `You walked off at ${circles} circles. The stirring starts over.`,
        'bad'
      )
  }

  tip(): string {
    if (this.fly?.swattedMs === -1) return 'A fly in the bowl! Tap it.'
    if (this.stir.done) return 'Stirred. Off to the moulds.'
    if (this.clean < 1 && this.stir.circles < 5)
      return 'Too late to wash this bowl. Next time, wash it before you boil.'
    if (this.stir.circles >= STIR.halfway)
      return 'Keep going. Walk away now and the count starts over.'
    return 'Draw 50 slow circles around the bowl.'
  }

  // ---------------------------------------------------------------- Input

  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void {
    if (this.swat(x, y, pointer)) return
    this.pressed = true
    startStroke(this.stir, timeMs)
    this.feed(x, y, timeMs)
  }

  onDrag(x: number, y: number, timeMs: number): void {
    this.feed(x, y, timeMs)
  }

  onRelease(): void {
    this.pressed = false
    this.gesture.end()
  }

  onKey(): void {}

  /** A tap on the tutorial's fly swats it into the mix. Returns whether it hit. */
  private swat(x: number, y: number, pointer: PointerKind): boolean {
    if (this.fly?.swattedMs !== -1) return false
    const scale = this.game.viewport?.scale ?? 1
    const reach = worldRadius(CRITTER_HIT, scale, pointer)
    if (Math.hypot(x - FLY_SPOT.x, y - FLY_SPOT.y) > reach) return false
    this.fly.swattedMs = this.game.state.simMs
    sfx.play('thud', { pitch: 1.5, volume: 0.8 })
    sfx.play('squish', { pitch: 1.9, volume: 0.5 })
    this.fx.shake(3)
    this.fx.caption('SWAT!', FLY_SPOT.x, FLY_SPOT.y - 40, {
      world: false,
      color: palette.red,
      size: 40
    })
    this.fx.caption('Extra protein.', BOWL.x, 120, {
      world: false,
      size: 32,
      ttlMs: 1800
    })
    return true
  }

  /** The tutorial's fly lands on the first stir, and sinks if you leave it. */
  private flyAfterCircle(): void {
    const circles = this.stir.circles
    const tutorial = this.game.state.tutorial
    if (
      !this.fly &&
      circles >= TUTORIAL.stirFlyAt &&
      firstTime(tutorial, 'stir-fly')
    ) {
      this.fly = { swattedMs: -1 }
      sfx.play('buzz', { volume: 0.6 })
      this.fx.caption('bzz', FLY_SPOT.x + 30, FLY_SPOT.y - 30, {
        world: false,
        size: 24,
        color: palette.inkSoft
      })
    } else if (
      this.fly?.swattedMs === -1 &&
      circles >= TUTORIAL.stirFlyFallsAt
    ) {
      this.fly = null
      sfx.play('drip', { pitch: 0.7 })
      this.fx.caption('It drowned. Extra protein.', BOWL.x, 120, {
        world: false,
        size: 30,
        ttlMs: 1800
      })
    }
  }

  private newGesture(): CircleGesture {
    return new CircleGesture({ center: BOWL, minRadius: STIR.minRadius })
  }

  private feed(x: number, y: number, timeMs: number): void {
    this.spoonX = x
    this.spoonY = y
    const mix = this.game.state.mix
    if (mix?.stage !== 'stir' || this.stir.done) return
    if (this.gesture.add(x, y, timeMs) === 0) return
    const events = stirCircle(this.stir, this.gesture.radius, timeMs, {
      assist: settings.get().assist,
      random: Math.random
    })
    for (const event of events) this.play(event, x, y)
    if (events.length > 0) this.flyAfterCircle()
  }

  private play(event: StirEvent, x: number, y: number): void {
    const { state } = this.game
    const mix = state.mix
    if (!mix) return
    const say = (text: string, cy: number, color: string, size = 30) =>
      this.fx.caption(text, BOWL.x, cy, {
        world: false,
        color,
        size,
        ttlMs: 1600
      })
    switch (event) {
      case 'tick':
        sfx.play('tick', {
          volume: 0.5,
          pitch: 0.8 + (this.stir.circles / STIR.circles) * 0.9
        })
        break
      case 'clack':
        sfx.play('hammer', { volume: 0.25, pitch: 2.2 })
        this.fx.caption('clack', x, y - 30, {
          world: false,
          size: 22,
          color: palette.inkSoft
        })
        break
      case 'slosh':
        sfx.play('slosh')
        this.fx.shake(4)
        this.fx.splash(x, y, FLAVOUR_COLOURS[mix.flavour].fill, 5)
        say('Slosh! Slower.', 172, palette.orange)
        break
      case 'spill':
        sfx.play('splash')
        vibrate(40)
        this.game.spill(mix.flavour)
        say("That's on the floor now.", 104, palette.red, 26)
        break
      case 'halfway':
        say('Halfway. Your arm hurts.', 120, palette.ink, 34)
        break
      case 'bend':
        sfx.play('boing', { pitch: 0.7 })
        say('The spoon bent.', 120, palette.ink, 34)
        break
      case 'done': {
        const evenness = this.gesture.evenness
        finishStir(state, evenness, state.simMs)
        sfx.play('ding')
        vibrate(20)
        this.fx.caption('Stirred!', BOWL.x, 140, {
          world: false,
          color: palette.green,
          size: 56,
          ttlMs: DONE_HOLD_MS
        })
        this.fx.caption(`${Math.round(evenness * 100)}% even`, BOWL.x, 190, {
          world: false,
          size: 30,
          ttlMs: DONE_HOLD_MS
        })
        if (this.clean < 1)
          this.fx.caption('Dirty bowl: cloudy jelly', BOWL.x, 230, {
            world: false,
            color: palette.orange,
            size: 26,
            ttlMs: DONE_HOLD_MS
          })
        this.leaveInMs = DONE_HOLD_MS
        break
      }
    }
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.fx.update(dtMs)
    const fly = this.fly
    if (fly && fly.swattedMs >= 0)
      if (this.game.state.simMs - fly.swattedMs > SQUASHED_MS) this.fly = null
    if (this.leaveInMs < 0) return
    this.leaveInMs -= dtMs
    // A finished stir goes to the moulds when the tray is free, else back to the overview.
    if (this.leaveInMs < 0)
      this.kitchen.open(canPour(this.game.state) ? 'moulds' : 'overview')
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= new CachedLayer(viewport, paintBowl, ROOM_RECT)
    const shake = this.fx.shakeOffset(SHAKE)
    ctx.save()
    ctx.translate(shake.x, shake.y)
    this.layer.draw(ctx)
    const mix = this.game.state.mix
    if (mix) this.drawMix(ctx, mix.flavour, timeMs)
    this.drawFly(ctx, timeMs)
    this.drawSpoon(ctx)
    this.drawCount(ctx, timeMs)
    ctx.restore()
    this.fx.drawDroplets(ctx)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  private drawFly(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const fly = this.fly
    if (!fly) return
    if (fly.swattedMs >= 0) drawSquashedFly(ctx, FLY_SPOT.x, FLY_SPOT.y)
    else drawFly(ctx, FLY_SPOT.x, FLY_SPOT.y, timeMs, false)
  }

  private drawMix(
    ctx: CanvasRenderingContext2D,
    flavour: keyof typeof FLAVOUR_COLOURS,
    timeMs: number
  ): void {
    const colours = FLAVOUR_COLOURS[flavour]
    this.drawGunk(ctx)
    LIQUID.fill = colours.fill
    LIQUID.color = colours.line
    sketchCircle(ctx, BOWL.x, BOWL.y, BOWL.liquid, LIQUID)
    // The swirl turns with your spoon.
    const spin =
      this.gesture.circles * Math.PI * 2 * this.gesture.direction +
      this.gesture.turn
    for (let arm = 0; arm < 3; arm++) {
      for (let k = 0; k < 5; k++) {
        const a = spin + arm * ((Math.PI * 2) / 3) + k * 0.35
        const r = 30 + k * 26
        SWIRL_POINTS[k * 2] = BOWL.x + Math.cos(a) * r
        SWIRL_POINTS[k * 2 + 1] = BOWL.y + Math.sin(a) * r
      }
      SWIRL.seed = 721 + arm
      sketchPath(ctx, SWIRL_POINTS, SWIRL)
    }
    // Lumps break up as the count rises.
    const lumps = Math.ceil(
      START_LUMPS * (1 - this.stir.circles / STIR.circles)
    )
    LUMP.fill = '#ffffff'
    LUMP.color = colours.line
    for (let i = 0; i < lumps; i++) {
      const a = spin * 0.6 + hash01(51, i) * Math.PI * 2
      const r = 40 + hash01(53, i) * 90
      const size = 8 + hash01(57, i) * 7
      const cx = BOWL.x + Math.cos(a) * r
      const cy = BOWL.y + Math.sin(a) * r
      for (let k = 0; k < 6; k++) {
        const b = (k / 6) * Math.PI * 2
        const wobble = size * (0.75 + 0.25 * hash01(59 + i, k))
        LUMP_POINTS[k * 2] = cx + Math.cos(b) * wobble
        LUMP_POINTS[k * 2 + 1] = cy + Math.sin(b) * wobble
      }
      LUMP.seed = 722 + i
      sketchBlob(ctx, LUMP_POINTS, LUMP)
    }
    if (this.stir.circles === 0 && !this.pressed) this.drawGuide(ctx, timeMs)
  }

  /** Old dried jelly on the bowl's inner wall, above the mix, when it wasn't washed. */
  private drawGunk(ctx: CanvasRenderingContext2D): void {
    const dirt = 1 - this.clean
    if (dirt <= 0) return
    const count = Math.ceil(dirt * 10)
    for (let i = 0; i < count; i++) {
      const a = hash01(81, i) * Math.PI * 2
      const r = BOWL.liquid + 4 + hash01(83, i) * 22
      const size = 9 + hash01(85, i) * 8
      const cx = BOWL.x + Math.cos(a) * r
      const cy = BOWL.y + Math.sin(a) * r
      for (let k = 0; k < 6; k++) {
        const b = (k / 6) * Math.PI * 2
        const wobble = size * (0.7 + 0.3 * hash01(87 + i, k))
        LUMP_POINTS[k * 2] = cx + Math.cos(b) * wobble
        LUMP_POINTS[k * 2 + 1] = cy + Math.sin(b) * wobble
      }
      GUNK.seed = 726 + i
      sketchBlob(ctx, LUMP_POINTS, GUNK)
    }
  }

  /** A dashed circular arrow showing the motion, before the first circle. */
  private drawGuide(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const turn = timeMs * 0.002
    for (let k = 0; k < 13; k++) {
      const a = turn + (k / 12) * Math.PI * 1.6
      GUIDE_POINTS[k * 2] = BOWL.x + Math.cos(a) * 105
      GUIDE_POINTS[k * 2 + 1] = BOWL.y + Math.sin(a) * 105
    }
    sketchPath(ctx, GUIDE_POINTS, GUIDE)
    const end = turn + Math.PI * 1.6
    const tipX = BOWL.x + Math.cos(end) * 105
    const tipY = BOWL.y + Math.sin(end) * 105
    sketchLine(
      ctx,
      tipX,
      tipY,
      tipX + Math.cos(end - 2.3) * 20,
      tipY + Math.sin(end - 2.3) * 20,
      GUIDE
    )
    sketchLine(
      ctx,
      tipX,
      tipY,
      tipX + Math.cos(end + 0.6 + Math.PI) * 20,
      tipY + Math.sin(end + 0.6 + Math.PI) * 20,
      GUIDE
    )
  }

  /** The spoon follows your finger; its handle points away from the bowl's centre. */
  private drawSpoon(ctx: CanvasRenderingContext2D): void {
    const x = this.spoonX
    const y = this.spoonY
    const dx = x - BOWL.x
    const dy = y - BOWL.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const bent = this.stir.circles >= STIR.bend
    const midX = x + ux * 110
    const midY = y + uy * 110
    // A bent spoon kinks sideways halfway up the handle.
    const endX = midX + ux * 110 + (bent ? -uy * 50 : 0)
    const endY = midY + uy * 110 + (bent ? ux * 50 : 0)
    sketchLine(ctx, x, y, midX, midY, SPOON_HANDLE)
    sketchLine(ctx, midX, midY, endX, endY, SPOON_HANDLE)
    sketchEllipse(ctx, x, y, 22, 16, SPOON_HEAD)
  }

  private drawCount(ctx: CanvasRenderingContext2D, timeMs: number): void {
    sketchText(
      ctx,
      `${this.stir.circles} / ${STIR.circles}`,
      BOWL.x,
      662,
      COUNT
    )
    if (this.stir.circles > 0)
      sketchText(
        ctx,
        `Evenness ${Math.round(this.gesture.evenness * 100)}%`,
        BOWL.x + 60,
        708,
        LABEL
      )
    else if (!this.pressed) {
      const bob = Math.sin(timeMs * 0.006) * 4
      sketchText(ctx, 'Draw circles', 390, 748 + bob, HINT)
    }
  }
}
