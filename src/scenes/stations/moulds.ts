import type { PointerKind } from '../../game/hit'
import { pourTray } from '../../game/kitchen'
import {
  CAUSE_TEXT,
  cloudiness,
  mainCause,
  qualityWord
} from '../../game/quality'
import { createPour, pourAccuracy, stepPour, type Pour } from '../../game/pour'
import { POUR } from '../../game/tuning'
import {
  CachedLayer,
  damp,
  isTouchDevice,
  palette,
  settings,
  sfx,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  sketchText,
  toast,
  vibrate,
  type LoopHandle,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { FLAVOUR_COLOURS, jellyFill, QUALITY_COLOURS } from '../art/jelly'
import { MOULD_ROW, mouldRect, paintMoulds } from '../art/moulds'
import { ROOM_RECT } from '../art/rooms'
import { Fx } from '../fx'
import type { Game } from '../game'
import type { KitchenScene } from '../kitchenScene'
import type { Station } from './station'

/** After the last mould, the close-up stays this long, so you can read each block's label. */
const DONE_HOLD_MS = 2400
/** The jug's lip hangs this far above the moulds. */
const LIP_Y = 330

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const SHAKE = { x: 0, y: 0 }
const MOULD: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.55)',
  color: palette.inkSoft,
  width: 3,
  seed: 820
}
const JELLY: SketchStyle = { width: 0, passes: 1, wobble: 1, seed: 821 }
const STREAM: SketchStyle = { passes: 1, wobble: 1.5, seed: 822 }
const JUG: SketchStyle & { closed: boolean; smooth: boolean } = {
  fill: '#ffffff',
  width: 4,
  seed: 823,
  closed: true,
  smooth: true
}
const JUG_MIX: SketchStyle = { width: 2, passes: 1, seed: 824 }
const SCORE: SketchTextStyle = { font: 'marker', size: 24, color: palette.ink }
const LABEL: SketchTextStyle = { size: 24, color: palette.inkSoft }
const WORD: SketchTextStyle = { font: 'marker', size: 22, color: palette.ink }
const CAUSE: SketchTextStyle = { size: 18, color: palette.inkSoft }

const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
const LINE_LABEL: SketchTextStyle = {
  size: 18,
  color: palette.orange,
  align: 'left'
}
const JUG_POINTS = new Float64Array([
  -80, -40, 80, -40, 70, 10, 30, 40, -30, 40, -70, 10
])

/**
 * The pour close-up. Hold (or Space) to pour into the mould under the jug, and let go
 * at the dashed line. The flow drips on for a moment after you let go. A mould past the
 * brim overflows onto the floor. Half a second after the flow stops, the jug moves on.
 */
export class MouldsStation implements Station {
  readonly view = 'moulds' as const
  private layer: CachedLayer | null = null
  private pour: Pour = createPour(4)
  private loop: LoopHandle | null = null

  mute(): void {
    this.loop?.setVolume(0)
  }
  // Overflow droplets land on the counter top.
  private readonly fx = new Fx(596)
  private pointerHeld = false
  private keyHeld = false
  private jugX = 0
  private leaveInMs = -1

  constructor(
    private readonly game: Game,
    private readonly kitchen: KitchenScene
  ) {}

  get hasLayer(): boolean {
    return this.layer !== null
  }

  /** The pour in progress, for the dev API. */
  get current(): Readonly<Pour> {
    return this.pour
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport)
      this.layer ??= new CachedLayer(viewport, paintMoulds, ROOM_RECT)
    this.pour = createPour(this.game.state.mix?.moulds ?? 4)
    this.jugX = this.mouldCentre(0)
    this.leaveInMs = -1
    this.loop = sfx.loop('pour', { volume: 0 })
  }

  exit(): void {
    this.layer?.dispose()
    this.layer = null
    this.loop?.stop()
    this.loop = null
    this.pointerHeld = false
    this.keyHeld = false
    // The moulds empty back into the bowl until you come back to pour again.
    const poured = this.pour.fills.some(fill => fill > 0)
    if (poured && !this.pour.done && this.game.state.mix?.stage === 'stirred')
      toast('You left mid-pour. The jelly went back in the bowl.', 'info')
  }

  tip(): string {
    if (this.pour.done) return 'Poured. Into the fridge with it.'
    return 'Hold to pour. Let go at the dashed line; it drips a little after.'
  }

  // ---------------------------------------------------------------- Input

  onPress(_x: number, _y: number, _pointer: PointerKind): void {
    this.pointerHeld = true
  }

  onDrag(): void {}

  onRelease(): void {
    this.pointerHeld = false
  }

  onKey(code: string, down: boolean): void {
    if (code === 'Space') this.keyHeld = down
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.fx.update(dtMs)
    this.jugX = damp(
      this.jugX,
      this.mouldCentre(this.pour.index),
      10,
      dtMs / 1000
    )
    if (this.leaveInMs >= 0) {
      this.leaveInMs -= dtMs
      if (this.leaveInMs < 0) this.kitchen.open('overview')
      return
    }
    const { state } = this.game
    const mix = state.mix
    if (mix?.stage !== 'stirred' || this.pour.done) return
    const index = this.pour.index
    const event = stepPour(this.pour, dtMs, this.pointerHeld || this.keyHeld)
    this.loop?.setVolume(this.pour.flow * 0.8)
    if (event === 'spill') {
      sfx.play('splash')
      vibrate(40)
      this.fx.shake(5)
      const r = mouldRect(index, this.pour.fills.length)
      this.fx.splash(r.x + r.width / 2, r.y, FLAVOUR_COLOURS[mix.flavour].fill)
      this.fx.caption('Overflow!', r.x + r.width / 2, r.y - 40, {
        world: false,
        color: palette.red,
        size: 34
      })
      this.game.spill(mix.flavour)
    } else if (event === 'short') {
      sfx.play('boing', { volume: 0.4 })
      const r = mouldRect(index, this.pour.fills.length)
      this.fx.caption('Fill it up!', r.x + r.width / 2, r.y - 40, {
        world: false,
        size: 28,
        color: palette.orange
      })
    } else if (event === 'next' || event === 'done') {
      const fill = this.pour.fills[index]!
      const accuracy = pourAccuracy(fill, settings.get().assist)
      sfx.play('pop', { pitch: 0.8 + accuracy * 0.5 })
      const r = mouldRect(index, this.pour.fills.length)
      this.fx.caption(
        accuracy > 0.85
          ? 'Spot on!'
          : fill < POUR.line
            ? 'Short!'
            : 'Too much!',
        r.x + r.width / 2,
        r.y - 40,
        {
          world: false,
          size: 26,
          color: accuracy > 0.85 ? palette.green : palette.orange
        }
      )
      if (event === 'done') this.finish()
    }
  }

  private finish(): void {
    const { state } = this.game
    const assist = settings.get().assist
    const pours = this.pour.fills.map(fill => pourAccuracy(fill, assist))
    pourTray(state, pours, this.pour.fills)
    const mean = pours.reduce((sum, p) => sum + p, 0) / pours.length
    sfx.play('ding')
    this.fx.caption('Poured!', 300, 200, {
      world: false,
      color: palette.green,
      size: 56,
      ttlMs: DONE_HOLD_MS
    })
    this.fx.caption(`${Math.round(mean * 100)}% on the line`, 300, 250, {
      world: false,
      size: 30,
      ttlMs: DONE_HOLD_MS
    })
    this.leaveInMs = DONE_HOLD_MS
  }

  private mouldCentre(index: number): number {
    const r = mouldRect(index, this.pour.fills.length)
    return r.x + r.width / 2
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= new CachedLayer(viewport, paintMoulds, ROOM_RECT)
    const shake = this.fx.shakeOffset(SHAKE)
    ctx.save()
    ctx.translate(shake.x, shake.y)
    this.layer.draw(ctx)
    // Once poured, the mix is gone and the tray holds the batch.
    const { mix, tray } = this.game.state
    const flavour = mix?.flavour ?? tray?.flavour ?? 'strawberry'
    const first = tray?.moulds[0]
    const cloud = mix ? 1 - mix.bowlClean : first ? cloudiness(first.make) : 0
    const colours = {
      fill: jellyFill(flavour, cloud),
      line: FLAVOUR_COLOURS[flavour].line
    }
    this.drawMoulds(ctx, colours)
    this.drawJug(ctx, colours, timeMs)
    this.drawLabels(ctx, timeMs)
    ctx.restore()
    this.fx.drawDroplets(ctx)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  private drawMoulds(
    ctx: CanvasRenderingContext2D,
    colours: { fill: string; line: string }
  ): void {
    const count = this.pour.fills.length
    const assist = settings.get().assist
    JELLY.fill = colours.fill
    for (let i = 0; i < count; i++) {
      const r = mouldRect(i, count)
      const fill = this.pour.fills[i]!
      const inner = r.height - 10
      if (fill > 0) {
        const h = inner * fill
        JELLY.seed = 821 + i
        sketchRect(ctx, r.x + 5, r.y + 5 + inner - h, r.width - 10, h, JELLY)
      }
      MOULD.seed = 820 + i
      MOULD.color = i === this.pour.index ? palette.ink : palette.inkSoft
      sketchRoundRect(ctx, r.x, r.y, r.width, r.height, 12, MOULD)
      // The dashed fill line.
      const lineY = r.y + 5 + inner * (1 - POUR.line)
      ctx.save()
      ctx.setLineDash([8, 6])
      ctx.strokeStyle = palette.orange
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(r.x + 4, lineY)
      ctx.lineTo(r.x + r.width - 4, lineY)
      ctx.stroke()
      ctx.restore()
      if (i < this.pour.index || this.pour.done)
        sketchText(
          ctx,
          `${Math.round(pourAccuracy(fill, assist) * 100)}%`,
          r.x + r.width / 2,
          // Centred on the grey counter edge, clear of its dark outline.
          MOULD_ROW.bottom + 41,
          SCORE
        )
      this.drawVerdict(ctx, i, r)
    }
    const first = mouldRect(0, count)
    sketchText(
      ctx,
      'Line',
      first.x - 52,
      first.y + 5 + (first.height - 10) * (1 - POUR.line),
      LINE_LABEL
    )
  }

  /** Once poured, each block's word and what cost it most: "Wobbly", "lumpy". */
  private drawVerdict(
    ctx: CanvasRenderingContext2D,
    index: number,
    r: { x: number; width: number }
  ): void {
    const tray = this.game.state.tray
    const mould = this.pour.done ? tray?.moulds[index] : undefined
    if (!mould || tray?.location !== 'kitchen') return
    const word = qualityWord(mould.q)
    WORD.color = QUALITY_COLOURS[word]
    WORD.maxWidth = r.width
    sketchText(ctx, word, r.x + r.width / 2, MOULD_ROW.bottom + 86, WORD)
    const cause = word === 'Firm' ? null : mainCause(mould.make)
    if (!cause) return
    CAUSE.maxWidth = r.width
    sketchText(
      ctx,
      CAUSE_TEXT[cause],
      r.x + r.width / 2,
      MOULD_ROW.bottom + 112,
      CAUSE
    )
  }

  /** The mixing bowl tipped over the current mould, and the stream while it flows. */
  private drawJug(
    ctx: CanvasRenderingContext2D,
    colours: { fill: string; line: string },
    timeMs: number
  ): void {
    const flow = this.pour.flow
    const lipX = this.jugX + 10
    if (flow > 0.02 && !this.pour.done) {
      const r = mouldRect(this.pour.index, this.pour.fills.length)
      const inner = r.height - 10
      const surface = r.y + 5 + inner * (1 - this.pour.fills[this.pour.index]!)
      STREAM.color = colours.fill
      STREAM.width = 4 + 14 * flow
      STREAM.seed = 822 + Math.floor(timeMs / 80)
      sketchLine(ctx, lipX, LIP_Y, this.jugX, surface, STREAM)
    }
    ctx.save()
    ctx.translate(lipX, LIP_Y)
    ctx.rotate(-0.15 - flow * 0.7)
    // The bowl's left rim corner sits on the pivot, so the stream leaves from the lip.
    ctx.translate(80, 40)
    sketchPath(ctx, JUG_POINTS, JUG)
    // The mix shows at the rim, tipping towards the lip.
    JUG_MIX.fill = colours.fill
    JUG_MIX.color = colours.line
    sketchEllipse(ctx, 0, -40, 76, 11, JUG_MIX)
    ctx.restore()
  }

  private drawLabels(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const count = this.pour.fills.length
    if (!this.pour.done)
      sketchText(
        ctx,
        `Mould ${this.pour.index + 1} of ${count}`,
        300,
        684,
        LABEL
      )
    if (this.pointerHeld || this.keyHeld || this.pour.done) return
    const lastType = this.game.pointer?.lastType ?? ''
    const touch = lastType === 'touch' || (lastType === '' && isTouchDevice())
    const bob = Math.sin(timeMs * 0.006) * 4
    sketchText(
      ctx,
      touch ? 'Hold to pour' : 'Hold the mouse or Space',
      390,
      748 + bob,
      HINT
    )
  }
}
