import {
  boilAccuracy,
  createBoil,
  greenZone,
  stepBoil,
  type Boil
} from '../../game/boil'
import type { PointerKind } from '../../game/hit'
import { burnMix, finishBoil, retryBurnt } from '../../game/kitchen'
import { TAUNTS } from '../../game/uncle'
import { BOIL } from '../../game/tuning'
import {
  CachedLayer,
  hash01,
  isTouchDevice,
  palette,
  settings,
  sfx,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchText,
  toast,
  vibrate,
  type LoopHandle,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { DIAL, dialAngle, HOB_Y, paintStove, POT } from '../art/stove'
import { FLAVOUR_COLOURS } from '../art/jelly'
import { ROOM_RECT } from '../art/rooms'
import { Fx } from '../fx'
import type { Game } from '../game'
import type { KitchenScene } from '../kitchenScene'
import type { Station } from './station'

/** After the boil finishes, the close-up stays this long before moving on. */
const DONE_HOLD_MS = 1300
/** Smoke hangs around this long after a burn. */
const SMOKE_MS = 2600

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const SHAKE = { x: 0, y: 0 }
const ZONE_COLOURS = {
  cold: 'rgba(116, 192, 252, 0.7)',
  green: palette.green,
  hot: palette.orange,
  burnt: palette.red
}
const NEEDLE: SketchStyle = { width: 6, wobble: 0.6, passes: 1, seed: 650 }
const HUB: SketchStyle = { fill: palette.ink, width: 0, seed: 651 }
const LIQUID: SketchStyle = { width: 3, seed: 652 }
const BURNT_FILL = '#4a3328'
const BUBBLE: SketchStyle = {
  width: 2,
  color: 'rgba(255, 255, 255, 0.9)',
  passes: 1,
  wobble: 0.5,
  seed: 653
}
const STEAM: SketchStyle & { smooth: boolean } = {
  width: 4,
  color: 'rgba(92, 92, 92, 0.4)',
  passes: 1,
  seed: 654,
  smooth: true
}
const FLAME_OUTER: SketchStyle = {
  fill: palette.orange,
  width: 0,
  wobble: 1.5,
  seed: 655
}
const FLAME_INNER: SketchStyle = {
  fill: '#74c0fc',
  width: 0,
  wobble: 1,
  seed: 656
}
const BAR_BACK: SketchStyle = { fill: '#ffffff', width: 3, seed: 657 }
const BAR_FILL: SketchStyle = { fill: palette.green, width: 0, seed: 658 }
const SMOKE: SketchStyle = { fill: '#868e96', width: 0, wobble: 4, seed: 659 }
const LABEL: SketchTextStyle = { size: 22, color: palette.inkSoft }
const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
const WARN: SketchTextStyle = {
  font: 'marker',
  size: 34,
  color: palette.red,
  outline: palette.paper
}
const STEAM_POINTS = new Float64Array(8)
const FLAME_POINTS = new Float64Array(6)

/**
 * The stove close-up. Hold anywhere (or Space) to heat, keep the needle in the green
 * for 8 seconds. A second in a row past 0.9 burns the batch: smoke and the smoke alarm.
 * The boil only starts over when you press Try Again, which pays for a fresh lot, so a
 * held press can't burn a second batch.
 */
export class StoveStation implements Station {
  readonly view = 'stove' as const
  private boil: Boil = createBoil()
  private layer: CachedLayer | null = null
  private loop: LoopHandle | null = null

  mute(): void {
    this.loop?.setVolume(0)
  }
  private readonly fx = new Fx()
  private pointerHeld = false
  private keyHeld = false
  private smokeMs = 0
  /** Counts down after the boil finishes or the last gelatin burns, then leaves. */
  private leaveInMs = -1

  constructor(
    private readonly game: Game,
    private readonly kitchen: KitchenScene
  ) {}

  get hasLayer(): boolean {
    return this.layer !== null
  }

  /** The boil in progress, for the dev API. */
  get current(): Readonly<Boil> {
    return this.boil
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport)
      this.layer ??= new CachedLayer(viewport, paintStove, ROOM_RECT)
    this.boil = createBoil()
    this.leaveInMs = -1
    this.loop = sfx.loop('boil', { volume: 0.05 })
  }

  exit(): void {
    this.layer?.dispose()
    this.layer = null
    this.loop?.stop()
    this.loop = null
    this.pointerHeld = false
    this.keyHeld = false
    // The pot is off the heat until you come back, and the boil starts over then.
    const boil = this.boil
    if (
      boil.greenMs > 0 &&
      !boil.done &&
      !boil.burnt &&
      this.game.state.mix?.stage === 'boil'
    )
      toast('You left the stove. It went cold, so the boil starts over.', 'bad')
  }

  tip(): string {
    const mix = this.game.state.mix
    if (!mix) return 'Out of gelatin. The shop sells more.'
    if (mix.burnt) return 'Burnt to the bottom. Try again with a fresh lot.'
    if (this.boil.done) return 'Boiled. Off to the bowl.'
    if (this.boil.heat > BOIL.burnAbove)
      return 'Too hot! Let go before it burns.'
    return 'Hold to heat. Keep the needle in the green for 8 seconds.'
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
    this.smokeMs = Math.max(0, this.smokeMs - dtMs)
    if (this.leaveInMs >= 0) {
      this.leaveInMs -= dtMs
      // A finished boil goes straight to the bowl; a lost batch goes back to the overview.
      if (this.leaveInMs < 0)
        this.kitchen.open(this.boil.done ? 'bowl' : 'overview')
      return
    }
    const { state } = this.game
    const mix = state.mix
    if (mix?.stage !== 'boil') return
    if (mix.burnt) {
      // The hob is off until Try Again: the flames die down and the needle falls back.
      this.boil.heat = Math.max(0, this.boil.heat - dtMs / BOIL.drainMs)
      this.loop?.setVolume(0.05 + 0.6 * this.boil.heat)
      return
    }
    const event = stepBoil(this.boil, dtMs, this.pointerHeld || this.keyHeld, {
      zone: greenZone(settings.get().assist),
      random: Math.random
    })
    this.loop?.setVolume(0.05 + 0.6 * this.boil.heat)
    if (event === 'bubble')
      sfx.play('pop', { volume: 0.35, pitch: 0.5 + Math.random() * 0.3 })
    else if (event === 'burn') this.burn()
    else if (event === 'done') {
      const accuracy = boilAccuracy(this.boil)
      finishBoil(mix, accuracy)
      sfx.play('ding')
      vibrate(20)
      this.fx.caption('Boiled!', 300, 200, {
        world: false,
        color: palette.green,
        size: 56,
        ttlMs: DONE_HOLD_MS
      })
      this.fx.caption(`${Math.round(accuracy * 100)}% in the green`, 300, 250, {
        world: false,
        size: 30,
        ttlMs: DONE_HOLD_MS
      })
      this.leaveInMs = DONE_HOLD_MS
    }
  }

  private burn(): void {
    const { state, economy } = this.game
    sfx.play('alarm')
    sfx.play('fail', { volume: 0.5 })
    vibrate([60, 40, 60])
    this.fx.shake(8)
    this.smokeMs = SMOKE_MS
    this.fx.caption('You burnt jelly.', 300, 170, {
      world: false,
      color: palette.red,
      size: 44,
      ttlMs: SMOKE_MS
    })
    this.fx.caption('Nobody has ever done that.', 300, 220, {
      world: false,
      size: 28,
      ttlMs: SMOKE_MS
    })
    const recycled = state.mix?.recycled ?? false
    if (!burnMix(state, economy.stock)) {
      const left = recycled ? state.tubs : economy.stock.count('gelatin')
      toast(
        recycled
          ? 'Not enough floor jelly for another try. The batch went in the bin.'
          : left > 0
            ? 'Not enough gelatin for another try. The shop sells more.'
            : 'You burnt your last gelatin. The shop sells more.',
        'bad'
      )
      this.leaveInMs = SMOKE_MS
    }
    this.game.taunt(TAUNTS.burnt)
  }

  /**
   * Try Again after a burn, from its button or the B key: pays for a fresh lot and the
   * boil starts over cold. A press held through the burn doesn't count; press again.
   */
  retry(): boolean {
    const { state, economy } = this.game
    if (!retryBurnt(state, economy.stock)) return false
    this.boil = createBoil()
    this.pointerHeld = false
    this.keyHeld = false
    this.smokeMs = Math.min(this.smokeMs, 400)
    sfx.play('pour', { pitch: state.mix?.recycled ? 0.8 : 1.2 })
    this.fx.caption('Fresh lot in. Gently this time.', 300, 200, {
      world: false,
      color: palette.green,
      size: 34
    })
    return true
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= new CachedLayer(viewport, paintStove, ROOM_RECT)
    const shake = this.fx.shakeOffset(SHAKE)
    ctx.save()
    ctx.translate(shake.x, shake.y)
    this.layer.draw(ctx)
    const mix = this.game.state.mix
    const heat = this.boil.heat
    this.drawFlames(ctx, heat, timeMs)
    if (mix) this.drawPotContents(ctx, mix.flavour, heat, timeMs)
    this.drawDial(ctx, heat)
    // A burnt batch has no progress to show, and Try Again sits over the bar's label.
    if (!mix?.burnt) this.drawProgress(ctx)
    this.drawPrompt(ctx, heat, timeMs)
    ctx.restore()
    this.drawSmoke(ctx, timeMs)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  private drawFlames(
    ctx: CanvasRenderingContext2D,
    heat: number,
    timeMs: number
  ): void {
    if (heat < 0.02) return
    for (let i = 0; i < 9; i++) {
      const x = POT.left + 12 + i * ((POT.right - POT.left - 24) / 8)
      const flicker = 0.75 + 0.25 * Math.sin(timeMs * 0.03 + i * 1.7)
      const h = (14 + 46 * heat) * flicker
      FLAME_POINTS[0] = x - 11
      FLAME_POINTS[1] = HOB_Y + 2
      FLAME_POINTS[2] = x
      FLAME_POINTS[3] = HOB_Y + 2 - h
      FLAME_POINTS[4] = x + 11
      FLAME_POINTS[5] = HOB_Y + 2
      FLAME_OUTER.seed = 655 + i
      sketchPolygon(ctx, FLAME_POINTS, FLAME_OUTER)
      FLAME_POINTS[0] = x - 5
      FLAME_POINTS[3] = HOB_Y + 2 - h * 0.5
      FLAME_POINTS[4] = x + 5
      sketchPolygon(ctx, FLAME_POINTS, FLAME_INNER)
    }
  }

  private drawPotContents(
    ctx: CanvasRenderingContext2D,
    flavour: keyof typeof FLAVOUR_COLOURS,
    heat: number,
    timeMs: number
  ): void {
    const cx = (POT.left + POT.right) / 2
    const surface = POT.top + 8
    // A burnt batch sits in the pot as black-brown sludge until Try Again.
    const burnt = this.game.state.mix?.burnt ?? false
    LIQUID.fill = burnt ? BURNT_FILL : FLAVOUR_COLOURS[flavour].fill
    LIQUID.color = burnt ? palette.ink : FLAVOUR_COLOURS[flavour].line
    sketchEllipse(ctx, cx, surface, 138, 20, LIQUID)
    // Bubbles: more and bigger as it heats. Each one rises and pops on a loop.
    const count = Math.floor(heat * 14)
    for (let i = 0; i < count; i++) {
      const phase = (timeMs * (0.0006 + heat * 0.0012) + hash01(7, i)) % 1
      const x = cx - 120 + hash01(11, i) * 240
      const y = surface - 6 + hash01(13, i) * 14
      BUBBLE.seed = 653 + i
      sketchCircle(ctx, x, y, 2 + phase * (4 + 8 * heat), BUBBLE)
    }
    // Steam squiggles rise faster and thicker with heat.
    const plumes = Math.floor(heat * 5)
    for (let i = 0; i < plumes; i++) {
      const x = cx - 100 + i * 50
      const rise = (timeMs * 0.06 + i * 37) % 60
      const sway = Math.sin(timeMs * 0.004 + i) * 10
      STEAM_POINTS[0] = x
      STEAM_POINTS[1] = surface - 20 - rise
      STEAM_POINTS[2] = x + sway
      STEAM_POINTS[3] = surface - 50 - rise
      STEAM_POINTS[4] = x - sway
      STEAM_POINTS[5] = surface - 80 - rise
      STEAM_POINTS[6] = x + sway
      STEAM_POINTS[7] = surface - 110 - rise
      STEAM.seed = 654 + i
      sketchPath(ctx, STEAM_POINTS, STEAM)
    }
  }

  private drawDial(ctx: CanvasRenderingContext2D, heat: number): void {
    const zone = greenZone(settings.get().assist)
    const r = DIAL.r - 40
    ctx.lineWidth = 26
    ctx.lineCap = 'butt'
    const band = (from: number, to: number, colour: string) => {
      ctx.strokeStyle = colour
      ctx.beginPath()
      ctx.arc(DIAL.x, DIAL.y, r, dialAngle(from), dialAngle(to))
      ctx.stroke()
    }
    band(0, zone.from, ZONE_COLOURS.cold)
    band(zone.from, zone.to, ZONE_COLOURS.green)
    band(zone.to, BOIL.burnAbove, ZONE_COLOURS.hot)
    band(BOIL.burnAbove, 1, ZONE_COLOURS.burnt)
    const a = dialAngle(heat)
    NEEDLE.color = heat > BOIL.burnAbove ? palette.red : palette.ink
    sketchLine(
      ctx,
      DIAL.x,
      DIAL.y,
      DIAL.x + Math.cos(a) * (DIAL.r - 10),
      DIAL.y + Math.sin(a) * (DIAL.r - 10),
      NEEDLE
    )
    sketchCircle(ctx, DIAL.x, DIAL.y, 12, HUB)
  }

  private drawProgress(ctx: CanvasRenderingContext2D): void {
    const x = 180
    const y = 664
    const w = 240
    sketchRect(ctx, x, y, w, 26, BAR_BACK)
    const done = Math.min(1, this.boil.greenMs / BOIL.doneMs)
    if (done > 0) sketchRect(ctx, x + 3, y + 3, (w - 6) * done, 20, BAR_FILL)
    sketchText(
      ctx,
      `In the green ${(this.boil.greenMs / 1000).toFixed(1)} / 8s`,
      300,
      y + 46,
      LABEL
    )
  }

  private drawPrompt(
    ctx: CanvasRenderingContext2D,
    heat: number,
    timeMs: number
  ): void {
    if (this.leaveInMs >= 0 || this.game.state.mix?.burnt) return
    if (heat > BOIL.burnAbove) {
      const pulse = 1 + 0.12 * Math.sin(timeMs * 0.03)
      WARN.size = 34 * pulse
      sketchText(ctx, 'TOO HOT!', 300, 210, WARN)
      return
    }
    if (this.pointerHeld || this.keyHeld) return
    const bob = Math.sin(timeMs * 0.006) * 4
    const lastType = this.game.pointer?.lastType ?? ''
    const touch = lastType === 'touch' || (lastType === '' && isTouchDevice())
    sketchText(
      ctx,
      touch ? 'Hold to heat' : 'Hold the mouse or Space',
      390,
      748 + bob,
      HINT
    )
  }

  private drawSmoke(ctx: CanvasRenderingContext2D, timeMs: number): void {
    if (this.smokeMs <= 0) return
    const fade = Math.min(1, this.smokeMs / (SMOKE_MS * 0.5))
    const previous = ctx.globalAlpha
    ctx.globalAlpha = previous * 0.75 * fade
    const view = this.game.viewport?.view
    const left = view?.x ?? 0
    const width = view?.width ?? 600
    for (let i = 0; i < 14; i++) {
      const x = left + hash01(21, i) * width
      const y = 120 + hash01(23, i) * 520 - ((timeMs * 0.04 + i * 50) % 160)
      SMOKE.seed = 659 + i
      sketchCircle(ctx, x, y, 70 + hash01(25, i) * 60, SMOKE)
    }
    ctx.globalAlpha = previous
  }
}
