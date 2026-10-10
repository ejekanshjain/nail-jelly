import type { PointerKind } from '../../game/hit'
import { MESS, WASH } from '../../game/tuning'
import {
  bowlStrokesLeft,
  sinkTarget,
  washStroke,
  type SinkItem,
  type WashEvent
} from '../../game/wash'
import {
  CachedLayer,
  hash01,
  isTouchDevice,
  palette,
  RubGesture,
  settings,
  sfx,
  sketchBlob,
  sketchCircle,
  sketchLine,
  sketchRoundRect,
  sketchText,
  vibrate,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { ROOM_RECT } from '../art/rooms'
import { paintSink, SINK } from '../art/sink'
import { Fx } from '../fx'
import type { Game } from '../game'
import type { KitchenScene } from '../kitchenScene'
import type { Station } from './station'

/** Once everything is clean, the close-up stays this long before going back. */
const DONE_HOLD_MS = 1300
/** Soap bubbles alive at once; each stroke blows a few. */
const MAX_BUBBLES = 24
const BUBBLE_MS = 900

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const SHAKE = { x: 0, y: 0 }
const BOWL_RIM: SketchStyle = { fill: '#ffffff', width: 5, seed: 750 }
const BOWL_INNER: SketchStyle = {
  fill: '#e7f5ff',
  width: 3,
  color: palette.inkSoft,
  seed: 751
}
const GUNK: SketchStyle = {
  fill: 'rgba(156, 106, 70, 0.75)',
  width: 0,
  wobble: 2,
  seed: 752
}
const POT: SketchStyle = { fill: '#dee2e6', width: 5, seed: 753 }
const POT_HANDLE: SketchStyle = { width: 18, color: palette.ink, seed: 754 }
const CHAR: SketchStyle = { fill: '#212529', width: 0, wobble: 3, seed: 755 }
const SPONGE: SketchStyle = { fill: palette.yellow, width: 3, seed: 756 }
const SCOURER: SketchStyle = { fill: palette.green, width: 2, seed: 757 }
const BUBBLE: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.85)',
  color: 'rgba(116, 192, 252, 0.9)',
  width: 1.5,
  passes: 1,
  wobble: 0.5,
  seed: 758
}
const COUNT: SketchTextStyle = {
  font: 'marker',
  size: 40,
  color: palette.ink,
  outline: palette.paper
}
const LABEL: SketchTextStyle = {
  size: 24,
  color: palette.inkSoft,
  outline: palette.paper
}
const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
/**
 * The stroke count's centre, under the sink's steel surround and right of the Kitchen
 * button, in line with the hint below it.
 */
const COUNT_X = 390
const COUNT_Y = 704
const BLOB = new Float64Array(12)

interface Bubble {
  x: number
  y: number
  r: number
  ageMs: number
}

/**
 * The sink close-up. Rub back and forth to wash: a burnt pot sits on top and goes first,
 * then each dirty bowl takes 10 strokes. Scrubbing too fast flings suds onto the kitchen
 * floor, once per press. Progress stays in the game state, so leaving keeps it.
 */
export class SinkStation implements Station {
  readonly view = 'sink' as const
  private layer: CachedLayer | null = null
  private readonly fx = new Fx(700)
  private readonly rub = new RubGesture({ minAmplitude: MESS.rubAmplitude })
  private readonly bubbles: Bubble[] = []
  private pressed = false
  private turnAtMs = 0
  private flung = false
  private strokes = 0
  private spongeX = SINK.right - 90
  private spongeY = SINK.bottom - 40
  private leaveInMs = -1

  constructor(
    private readonly game: Game,
    private readonly kitchen: KitchenScene
  ) {}

  get hasLayer(): boolean {
    return this.layer !== null
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport) this.layer ??= new CachedLayer(viewport, paintSink, ROOM_RECT)
    this.leaveInMs = -1
    this.pressed = false
    this.strokes = 0
    this.bubbles.length = 0
    const target = sinkTarget(this.game.state)
    if (target?.kind === 'pot' && this.game.state.bowls.some(c => c < 1))
      this.say('The burnt pot is on top. It goes first.', 140, palette.ink, 28)
  }

  exit(): void {
    this.layer?.dispose()
    this.layer = null
    this.pressed = false
  }

  tip(): string {
    const target = sinkTarget(this.game.state)
    if (this.leaveInMs >= 0 || !target) return 'Clean. Back to the kitchen.'
    if (target.kind === 'pot')
      return 'Scrub the burnt pot. It sits on the bowl.'
    return 'Rub back and forth to wash the bowl. Too fast flings suds.'
  }

  // ---------------------------------------------------------------- Input

  onPress(x: number, y: number, _pointer: PointerKind, timeMs: number): void {
    this.spongeX = x
    this.spongeY = y
    if (this.leaveInMs >= 0) return
    this.pressed = true
    this.rub.reset()
    this.rub.add(x, y)
    this.turnAtMs = timeMs
    this.flung = false
  }

  onDrag(x: number, y: number, timeMs: number): void {
    this.spongeX = x
    this.spongeY = y
    if (this.pressed && this.rub.add(x, y)) this.stroke(timeMs)
  }

  onRelease(): void {
    if (this.pressed && this.rub.end()) this.stroke(performance.now())
    this.pressed = false
  }

  onKey(): void {}

  /** One counted stroke: its speed is its length over the time since the last turn. */
  private stroke(timeMs: number): void {
    const seconds = Math.max(0.001, (timeMs - this.turnAtMs) / 1000)
    this.turnAtMs = timeMs
    const speed = this.rub.lastAmplitude / seconds
    const events = washStroke(
      this.game.state,
      speed,
      settings.get().assist,
      !this.flung
    )
    if (events.length > 0) this.strokes++
    for (const event of events) this.play(event)
  }

  private play(event: WashEvent): void {
    switch (event.type) {
      case 'pot':
        sfx.play('scrub', { volume: 0.6, pitch: 0.55 + Math.random() * 0.1 })
        this.blow(2)
        break
      case 'pot-clean':
        sfx.play('ding', { pitch: 1.2 })
        this.fx.shake(3)
        this.say(
          this.game.state.bowls.some(c => c < 1)
            ? 'Pot done. Now the bowl.'
            : 'Pot done. Shiny.',
          170,
          palette.green
        )
        break
      case 'bowl':
        sfx.play('scrub', { volume: 0.5, pitch: 1.1 + Math.random() * 0.2 })
        this.blow(3)
        break
      case 'bowl-clean':
        sfx.play('ding', { pitch: 1.4 })
        this.blow(8)
        break
      case 'suds':
        this.flung = true
        sfx.play('splash')
        vibrate(30)
        this.fx.shake(5)
        this.fx.splash(this.spongeX, this.spongeY, '#e7f5ff', 10)
        this.say('Too fast! Suds on the floor.', 110, palette.red, 32)
        this.game.spillSuds()
        break
      case 'done':
        sfx.play('coin', { volume: 0.5, pitch: 1.3 })
        vibrate(20)
        this.fx.caption('Squeaky clean!', SINK.x, 150, {
          world: false,
          color: palette.green,
          size: 52,
          ttlMs: DONE_HOLD_MS
        })
        this.leaveInMs = DONE_HOLD_MS
        this.pressed = false
        break
    }
  }

  /** Blows a few soap bubbles from the sponge. */
  private blow(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.bubbles.length >= MAX_BUBBLES) this.bubbles.shift()
      this.bubbles.push({
        x: this.spongeX + (Math.random() - 0.5) * 80,
        y: this.spongeY + (Math.random() - 0.5) * 50,
        r: 6 + Math.random() * 10,
        ageMs: 0
      })
    }
  }

  private say(text: string, y: number, color: string, size = 30): void {
    this.fx.caption(text, SINK.x, y, { world: false, color, size, ttlMs: 1800 })
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.fx.update(dtMs)
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!
      b.ageMs += dtMs
      b.y -= dtMs * 0.05
      if (b.ageMs > BUBBLE_MS) this.bubbles.splice(i, 1)
    }
    if (this.leaveInMs < 0) return
    this.leaveInMs -= dtMs
    if (this.leaveInMs < 0) this.kitchen.open('overview')
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= new CachedLayer(viewport, paintSink, ROOM_RECT)
    const shake = this.fx.shakeOffset(SHAKE)
    ctx.save()
    ctx.translate(shake.x, shake.y)
    this.layer.draw(ctx)
    const state = this.game.state
    const target = sinkTarget(state)
    // The bowl waiting its turn sits under the pot, nudged aside.
    const bowl = state.bowls.findIndex(c => c < 1)
    const bowlClean = bowl >= 0 ? state.bowls[bowl]! : 1
    if (target?.kind === 'pot') {
      if (bowl >= 0) this.drawBowl(ctx, SINK.x - 70, SINK.y + 40, bowlClean)
      this.drawPot(ctx, SINK.x + 30, SINK.y - 10, state.potScrubs)
    } else this.drawBowl(ctx, SINK.x, SINK.y, bowlClean)
    this.drawBubbles(ctx)
    this.drawSponge(ctx)
    this.drawCount(ctx, target, timeMs)
    ctx.restore()
    this.fx.drawDroplets(ctx)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  /** A bowl from above, with dried jelly that fades as it gets cleaner. */
  private drawBowl(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    clean: number
  ): void {
    sketchCircle(ctx, x, y, SINK.bowlRim, BOWL_RIM)
    sketchCircle(ctx, x, y, SINK.bowlInner, BOWL_INNER)
    const dirt = 1 - clean
    if (dirt <= 0) return
    const previous = ctx.globalAlpha
    ctx.globalAlpha = previous * Math.min(1, 0.25 + dirt)
    // Smaller and fewer smears as you wash.
    const count = Math.ceil(dirt * 9)
    for (let i = 0; i < count; i++) {
      const a = hash01(61, i) * Math.PI * 2
      const r = 30 + hash01(63, i) * 90
      blobAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 12 + 16 * dirt, 64 + i)
      GUNK.seed = 752 + i
      sketchBlob(ctx, BLOB, GUNK)
    }
    ctx.globalAlpha = previous
  }

  /** The burnt pot from above: a handle, and black char that shrinks as you scrub. */
  private drawPot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scrubs: number
  ): void {
    sketchLine(
      ctx,
      x + SINK.pot - 10,
      y,
      x + SINK.pot + 110,
      y - 30,
      POT_HANDLE
    )
    sketchCircle(ctx, x, y, SINK.pot, POT)
    const burnt = Math.min(1, scrubs / WASH.potStrokes)
    const count = Math.max(1, Math.ceil(burnt * 7))
    for (let i = 0; i < count; i++) {
      const a = hash01(71, i) * Math.PI * 2
      const r = hash01(73, i) * 80
      blobAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 14 + 22 * burnt, 74 + i)
      CHAR.seed = 755 + i
      sketchBlob(ctx, BLOB, CHAR)
    }
  }

  private drawBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bubbles) {
      const t = b.ageMs / BUBBLE_MS
      BUBBLE.seed = 758 + Math.floor(b.r)
      sketchCircle(ctx, b.x, b.y, b.r * (0.6 + 0.4 * t), BUBBLE)
    }
  }

  /** A yellow sponge with a green scourer, at your finger while you scrub. */
  private drawSponge(ctx: CanvasRenderingContext2D): void {
    const x = this.spongeX
    const y = this.spongeY
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.25)
    sketchRoundRect(ctx, -46, -26, 92, 52, 12, SPONGE)
    sketchRoundRect(ctx, -46, -38, 92, 16, 6, SCOURER)
    ctx.restore()
  }

  private drawCount(
    ctx: CanvasRenderingContext2D,
    target: SinkItem | null,
    timeMs: number
  ): void {
    const state = this.game.state
    // The hint shows until the first stroke; "Then the bowl" takes its place after.
    const hint = target !== null && !this.pressed && this.strokes === 0
    // The counts sit below the steel surround, whose outline ends at y 680.
    if (target?.kind === 'pot') {
      sketchText(
        ctx,
        `Burnt pot: ${state.potScrubs} more`,
        COUNT_X,
        COUNT_Y,
        COUNT
      )
      if (!hint && state.bowls.some(c => c < 1))
        sketchText(ctx, 'Then the bowl', 390, 748, LABEL)
    } else if (target) {
      const left = bowlStrokesLeft(state.bowls[target.index]!)
      const label =
        state.bowls.length > 1
          ? `Bowl ${target.index + 1}: ${WASH.bowlStrokes - left} / ${WASH.bowlStrokes}`
          : `Wash ${WASH.bowlStrokes - left} / ${WASH.bowlStrokes}`
      sketchText(ctx, label, COUNT_X, COUNT_Y, COUNT)
    }
    if (!hint) return
    const lastType = this.game.pointer?.lastType ?? ''
    const touch = lastType === 'touch' || (lastType === '' && isTouchDevice())
    const bob = Math.sin(timeMs * 0.006) * 4
    sketchText(
      ctx,
      touch ? 'Rub back and forth' : 'Drag back and forth',
      390,
      748 + bob,
      HINT
    )
  }
}

/** Writes a small irregular blob of radius `r` at (x, y) into the shared buffer. */
function blobAt(x: number, y: number, r: number, seed: number): void {
  for (let k = 0; k < 6; k++) {
    const b = (k / 6) * Math.PI * 2
    const wobble = r * (0.7 + 0.3 * hash01(seed, k))
    BLOB[k * 2] = x + Math.cos(b) * wobble
    BLOB[k * 2 + 1] = y + Math.sin(b) * wobble * 0.8
  }
}
