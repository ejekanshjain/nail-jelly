import { buyPack, ordinal, type Pack, type PackResult } from '../game/economy'
import type { PointerKind } from '../game/hit'
import { fitSpareHead } from '../game/mess'
import { LOOK_UP_MS, MESS, ODD_JOB } from '../game/tuning'
import {
  CachedLayer,
  hash01,
  isTouchDevice,
  palette,
  pick,
  RubGesture,
  settings,
  sfx,
  sketchBlob,
  sketchCircle,
  sketchLine,
  sketchRoundRect,
  sketchText,
  toast,
  vibrate,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { makeBoil } from './art/boil'
import { paintShop, ROOM_RECT, SHOPKEEPER } from './art/rooms'
import { Fx } from './fx'
import type { Game } from './game'
import type { Scene } from './scene'

/** A speech bubble stays this long. */
const QUIP_MS = 2400
/** Where the dust piles lie on the shop floor, and how big each one starts. */
const DUST = [
  [120, 470, 34],
  [300, 520, 40],
  [470, 460, 30],
  [190, 640, 38],
  [420, 660, 36],
  [300, 740, 30]
] as const

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const HOOD: SketchStyle = { fill: palette.purple, width: 3, seed: 177 }
const FACE: SketchStyle = { fill: '#f4c7a1', width: 3, seed: 178 }
const FEATURE: SketchStyle = { width: 3, passes: 1, wobble: 0.6, seed: 179 }
const EYE: SketchStyle = { fill: palette.ink, width: 0, seed: 180 }
const boilHead = makeBoil([HOOD, FACE, FEATURE])
const BUBBLE: SketchStyle = { fill: '#ffffff', width: 3, seed: 190 }
const BUBBLE_TEXT: SketchTextStyle = {
  size: 24,
  color: palette.ink,
  maxWidth: 270
}
const DUST_STYLE: SketchStyle = {
  fill: 'rgba(134, 142, 150, 0.55)',
  width: 0,
  passes: 1,
  wobble: 3,
  seed: 191
}
const HANDLE: SketchStyle = { width: 6, color: palette.brown, seed: 192 }
const BRISTLE: SketchStyle = {
  width: 3,
  color: '#e8a33d',
  passes: 1,
  wobble: 1,
  seed: 193
}
const COUNT: SketchTextStyle = {
  font: 'marker',
  size: 36,
  color: palette.ink,
  outline: palette.paper
}
const HINT: SketchTextStyle = {
  font: 'marker',
  size: 28,
  color: palette.ink,
  outline: palette.paper
}
const BLOB = new Float64Array(16)

/**
 * The corner shop. The supplies sheet is React, docked over the floor; this scene draws
 * the shop, the bored shopkeeper (she looks up only when you buy something) and her
 * quips. When you are broke and stuck she offers the odd job: sweep her floor for coins.
 */
export class ShopScene implements Scene {
  readonly id = 'shop' as const
  private readonly fx = new Fx()
  private layer: CachedLayer | null = null
  private readonly rub = new RubGesture({ minAmplitude: MESS.rubAmplitude })
  /** Sweeping the floor for the odd job, and the strokes so far. */
  sweeping = false
  private strokes = 0
  private pressed = false
  private turnAtMs = 0
  private broomX = 300
  private broomY = 600
  private quip: string | null = null
  private quipMs = 0
  private lookUpMs = 0
  /** Gelatin packets bought this run, for "That's your 14th packet today." */
  private packets = 0

  constructor(private readonly game: Game) {}

  /** Whether the shop's background layer is alive, for the dev perf report. */
  get hasLayer(): boolean {
    return this.layer !== null
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport) this.layer ??= this.createLayer(viewport)
    if (Math.random() < 0.5)
      this.say(pick(['Jelly again?', 'Oh. You.', 'Back already?']))
  }

  exit(): void {
    this.layer?.dispose()
    this.layer = null
    this.sweeping = false
    this.pressed = false
    this.quip = null
  }

  tip(): string {
    if (this.sweeping)
      return 'Sweep back and forth. Too fast just throws the dust around.'
    if (this.game.hud.get().oddJob)
      return `Broke? Sweep the floor for ${ODD_JOB.pay} coins.`
    return 'Buy supplies. The wall keeps sagging while you shop.'
  }

  /** Buys a pack from the sheet, with her reaction. A new mop head fits itself. */
  buy(pack: Pack): PackResult {
    const { state, economy } = this.game
    const result = buyPack(pack, economy.wallet, economy.stock)
    if (!result.ok) {
      sfx.play('fail', { volume: 0.4 })
      toast(
        result.reason === 'full'
          ? `No room at home for ${pack.name.toLowerCase()}.`
          : 'Not enough coins.',
        'bad'
      )
      return result
    }
    sfx.play('coin')
    vibrate(15)
    this.lookUpMs = LOOK_UP_MS
    if (pack.item === 'gelatin') {
      this.packets += pack.size
      this.say(
        this.packets >= 3
          ? `That's your ${ordinal(this.packets)} packet today.`
          : 'Jelly again?'
      )
    } else if (pack.item === 'nails')
      this.say(pick(['Nails. For jelly. Sure.', 'Most people use glue.']))
    else {
      this.say(pick(['You go through a lot of those.', 'Mop heads. Again.']))
      if (fitSpareHead(state, economy.stock))
        toast('New mop head fitted.', 'good')
    }
    return result
  }

  /** She looks up at an upgrade purchase. */
  admire(): void {
    this.lookUpMs = LOOK_UP_MS * 1.5
    this.say(pick(['Big spender.', 'Fancy.', 'No refunds on that either.']))
  }

  /** Starts the odd job: the sheet hides and you sweep the floor. */
  startSweep(): void {
    if (this.sweeping) return
    this.sweeping = true
    this.strokes = 0
    this.lookUpMs = LOOK_UP_MS
    this.say(`Broom's there. ${ODD_JOB.pay} coins. Properly.`)
  }

  private say(text: string): void {
    this.quip = text
    this.quipMs = QUIP_MS
  }

  update(dtMs: number): void {
    this.fx.update(dtMs)
    this.quipMs = Math.max(0, this.quipMs - dtMs)
    if (this.quipMs === 0) this.quip = null
    this.lookUpMs = Math.max(0, this.lookUpMs - dtMs)
  }

  // ---------------------------------------------------------------- Input

  onPress(x: number, y: number, _pointer: PointerKind, timeMs: number): void {
    if (this.sweeping) {
      this.pressed = true
      this.broomX = x
      this.broomY = y
      this.rub.reset()
      this.rub.add(x, y)
      this.turnAtMs = timeMs
      return
    }
    if (Math.abs(x - SHOPKEEPER.x) < 70 && y > 140 && y < 320) {
      this.say(
        pick(['No refunds.', "I'm on my break.", 'Did you read the sign?'])
      )
      sfx.play('boing', { volume: 0.3, pitch: 1.6 })
    } else if (y < 300)
      this.say(pick(['Look with your eyes.', "Don't squeeze the packets."]))
  }

  onDrag(x: number, y: number, timeMs: number): void {
    if (!this.pressed) return
    this.broomX = x
    this.broomY = y
    if (this.rub.add(x, y)) this.stroke(timeMs)
  }

  onRelease(): void {
    if (this.pressed && this.rub.end()) this.stroke(performance.now())
    this.pressed = false
  }

  onKey(): void {}

  /** One sweep stroke. Too fast throws the dust around and doesn't count. */
  private stroke(timeMs: number): void {
    if (!this.sweeping) return
    const seconds = Math.max(0.001, (timeMs - this.turnAtMs) / 1000)
    this.turnAtMs = timeMs
    const speed = this.rub.lastAmplitude / seconds
    const limit = settings.get().assist ? MESS.assistRubLimit : MESS.rubLimit
    if (speed > limit) {
      sfx.play('sneeze')
      this.fx.shake(4)
      this.fx.splash(this.broomX, this.broomY, 'rgba(134, 142, 150, 0.7)', 8)
      this.fx.caption('Too fast! Dust everywhere.', 300, 420, {
        world: false,
        color: palette.red,
        size: 30
      })
      this.lookUpMs = LOOK_UP_MS
      this.say('ACHOO. Again. Slower.')
      return
    }
    this.strokes++
    sfx.play('scrub', { volume: 0.5, pitch: 0.8 + Math.random() * 0.2 })
    if (this.strokes < ODD_JOB.strokes) return
    this.sweeping = false
    this.pressed = false
    this.game.economy.wallet.earn(ODD_JOB.pay, 'Swept the shop')
    sfx.play('coin')
    sfx.play('ding', { pitch: 1.2 })
    this.lookUpMs = LOOK_UP_MS
    this.say(`Fine. ${ODD_JOB.pay} coins.`)
    this.fx.caption(`+${ODD_JOB.pay} coins`, 300, 520, {
      world: false,
      color: palette.green,
      size: 44,
      ttlMs: 1800
    })
  }

  // ---------------------------------------------------------------- Drawing (design units)

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    this.layer ??= this.createLayer(viewport)
    this.layer.draw(ctx)
    boilHead(timeMs)
    this.drawShopkeeper(ctx)
    if (this.quip) this.drawBubble(ctx, this.quip)
    if (this.sweeping) {
      this.drawDust(ctx)
      this.drawBroom(ctx)
      sketchText(
        ctx,
        `Sweep ${this.strokes} / ${ODD_JOB.strokes}`,
        300,
        776,
        COUNT
      )
      if (this.strokes === 0 && !this.pressed) {
        const touch =
          this.game.pointer?.lastType === 'touch' ||
          (this.game.pointer?.lastType === '' && isTouchDevice())
        const bob = Math.sin(timeMs * 0.006) * 4
        sketchText(
          ctx,
          touch ? 'Rub back and forth' : 'Drag back and forth',
          300,
          724 + bob,
          HINT
        )
      }
    }
    this.fx.drawDroplets(ctx)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  /** Her head: eyes down on her phone, or up at you for a moment after you buy. */
  private drawShopkeeper(ctx: CanvasRenderingContext2D): void {
    const x = SHOPKEEPER.x
    const y = SHOPKEEPER.headY
    sketchCircle(ctx, x, y, 40, HOOD)
    sketchCircle(ctx, x, y + 4, 30, FACE)
    if (this.lookUpMs > 0) {
      sketchCircle(ctx, x - 10, y - 2, 4, EYE)
      sketchCircle(ctx, x + 10, y - 2, 4, EYE)
      sketchLine(ctx, x - 17, y - 14, x - 5, y - 16, FEATURE)
      sketchLine(ctx, x + 5, y - 16, x + 17, y - 14, FEATURE)
    } else {
      sketchLine(ctx, x - 16, y + 8, x - 6, y + 10, FEATURE)
      sketchLine(ctx, x + 6, y + 10, x + 16, y + 8, FEATURE)
    }
    if (this.quip) sketchCircle(ctx, x, y + 22, 4, FEATURE)
    else sketchLine(ctx, x - 8, y + 24, x + 8, y + 24, FEATURE)
  }

  /** A speech bubble to her left, clear of the replay corner. */
  private drawBubble(ctx: CanvasRenderingContext2D, text: string): void {
    const right = SHOPKEEPER.x - 48
    sketchRoundRect(ctx, right - 300, 188, 300, 52, 14, BUBBLE)
    sketchLine(ctx, right, 206, right + 18, 200, BUBBLE)
    sketchText(ctx, text, right - 150, 214, BUBBLE_TEXT)
  }

  /** Dust piles that shrink as you sweep. */
  private drawDust(ctx: CanvasRenderingContext2D): void {
    const left = 1 - this.strokes / ODD_JOB.strokes
    for (let i = 0; i < DUST.length; i++) {
      const pile = DUST[i]!
      const size = pile[2] * (0.2 + 0.8 * left)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        const wobble = size * (0.7 + 0.3 * hash01(201 + i, k))
        BLOB[k * 2] = pile[0] + Math.cos(a) * wobble
        BLOB[k * 2 + 1] = pile[1] + Math.sin(a) * wobble * 0.45
      }
      DUST_STYLE.seed = 191 + i
      sketchBlob(ctx, BLOB, DUST_STYLE)
    }
  }

  /** The broom at your finger: a long handle and a fan of bristles. */
  private drawBroom(ctx: CanvasRenderingContext2D): void {
    const x = this.broomX
    const y = this.broomY
    sketchLine(ctx, x + 50, y - 150, x, y - 16, HANDLE)
    for (let i = 0; i < 7; i++) {
      BRISTLE.seed = 193 + i
      sketchLine(ctx, x - 6 + i * 2, y - 16, x - 30 + i * 10, y + 10, BRISTLE)
    }
  }

  // Screens wider or taller than the cached margin show plain paper past it.
  private createLayer(viewport: Viewport): CachedLayer {
    return new CachedLayer(viewport, paintShop, ROOM_RECT)
  }
}
