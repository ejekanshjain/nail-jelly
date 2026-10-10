import type { PointerKind } from '../game/hit'
import { startViewWipe, stepWipe, type Wipe } from '../game/rooms'
import {
  canPour,
  fridgeAction,
  gelatinFor,
  type BatchOptions,
  isSetting,
  putInFridge,
  startFreshBatch,
  startRecycledBatch,
  takeTray,
  tubsFor
} from '../game/kitchen'
import {
  drainNoodles,
  noodlesReady,
  startNoodles,
  type DrainResult
} from '../game/noodles'
import { cloudiness, qualityWord, traySummary } from '../game/quality'
import type { Rect } from '../game/sim/geometry'
import { MOULDS, NOODLES } from '../game/tuning'
import type { GameState, KitchenView } from '../game/types'
import {
  bowlsDirty,
  bowlsInUse,
  potInUse,
  sinkStrokesLeft,
  sinkTarget
} from '../game/wash'
import {
  CachedLayer,
  formatClock,
  isDone,
  now,
  palette,
  pick,
  sfx,
  sketchRect,
  timeLeftMs,
  type LoopHandle,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { FLAVOUR_COLOURS, jellyFill, QUALITY_COLOURS } from './art/jelly'
import { drawSplat } from './art/wall'
import { BACK_HOB, paintKitchen, ROOM_RECT } from './art/rooms'
import { Fx } from './fx'
import type { Game } from './game'
import { Mopper, splatAt } from './mopper'
import type { Scene } from './scene'
import { BowlStation } from './stations/bowl'
import { MouldsStation } from './stations/moulds'
import { SinkStation } from './stations/sink'
import type { Station } from './stations/station'
import { StoveStation } from './stations/stove'
import { drawWipe } from './wipe'

/** What you can tap in the kitchen overview, in design units. Each is 48 CSS px or more on phones. */
export const KITCHEN_SPOTS = {
  stove: { x: 8, y: 280, width: 96, height: 106 },
  /** The noodle pot on the back hob, once you own Noodle Reinforcement. */
  noodles: { x: 104, y: 280, width: 78, height: 106 },
  bowl: { x: 184, y: 296, width: 110, height: 90 },
  moulds: { x: 24, y: 172, width: 316, height: 80 },
  sink: { x: 298, y: 300, width: 96, height: 106 },
  fridge: { x: 400, y: 186, width: 180, height: 494 }
} as const satisfies Record<string, Rect>

type Spot = keyof typeof KITCHEN_SPOTS

/** The noodle drain's pouring sound. */
const DRAIN_VOLUME = 0.7
/** Without Noodle Reinforcement the stove's spot covers the back hob too. */
const STOVE_ALL: Rect = { x: 8, y: 280, width: 174, height: 106 }

const NO_CAMERA = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const CUP: SketchStyle = { color: palette.inkSoft, width: 3, seed: 501 }
const CUP_SPOT = 'rgba(92, 92, 92, 0.35)'
const LIQUID: SketchStyle = { width: 2, seed: 502, passes: 1 }
const STEAM: SketchStyle & { smooth: boolean } = {
  width: 3,
  color: 'rgba(92, 92, 92, 0.45)',
  passes: 1,
  seed: 503,
  smooth: true
}
const FROST: SketchStyle = {
  width: 4,
  color: palette.water,
  passes: 1,
  seed: 510
}
const HINT: SketchStyle = {
  width: 5,
  color: palette.orange,
  passes: 1,
  wobble: 2,
  seed: 504
}
const NOTE: SketchStyle = { fill: palette.yellow, width: 2, seed: 505 }
const NOTE_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.ink,
  rotate: -0.06
}
const CUP_WORD: SketchTextStyle = { size: 18, color: palette.inkSoft }
/** The floor-jelly tub on the floor by the cupboards (x, y, width, height). */
const TUB_ART = [262, 622, 84, 56] as const
const TUB: SketchStyle & { smooth: boolean } = {
  fill: '#dee2e6',
  width: 3,
  seed: 520,
  smooth: false
}
const TUB_JELLY: SketchStyle = {
  fill: 'rgba(141, 110, 80, 0.85)',
  color: palette.inkSoft,
  width: 2,
  seed: 521
}
const GUNK: SketchStyle = {
  fill: 'rgba(156, 106, 70, 0.8)',
  width: 0,
  wobble: 1.5,
  seed: 530
}
const CHAR: SketchStyle = { fill: '#212529', width: 0, wobble: 2, seed: 531 }
const STINK: SketchStyle & { smooth: boolean } = {
  width: 3,
  color: 'rgba(55, 178, 77, 0.7)',
  passes: 1,
  seed: 532,
  smooth: true
}
const TUB_LABEL: SketchTextStyle = { font: 'marker', size: 16 }
const XL_STICKER: SketchStyle = { fill: palette.red, width: 2, seed: 540 }
const XL_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: '#ffffff',
  rotate: -0.15
}
const BOWLS_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 22,
  color: palette.inkSoft
}
const TUB_COUNT: SketchTextStyle = { font: 'marker', size: 22 }
const NOODLE_POT: SketchStyle = { fill: '#dee2e6', width: 3, seed: 550 }
const NOODLE_WATER: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.8)',
  color: palette.blue,
  width: 2,
  passes: 1,
  seed: 551
}
const NOODLE: SketchStyle & { smooth: boolean } = {
  width: 4,
  color: '#f2c94c',
  passes: 1,
  wobble: 1,
  seed: 552,
  smooth: true
}
const MUSH: SketchStyle = { fill: '#e6d3a3', width: 2, seed: 553 }
const COLANDER: SketchStyle = { fill: '#e9ecef', width: 3, seed: 554 }
const STREAM: SketchStyle = {
  width: 7,
  color: 'rgba(116, 192, 252, 0.85)',
  passes: 1,
  wobble: 1.5,
  seed: 555
}
const FLAME: SketchStyle = {
  width: 4,
  color: palette.orange,
  passes: 1,
  seed: 560
}
const DRAIN_NOTE: SketchTextStyle = { ...NOTE_TEXT, size: 22 }
const BAR_OUTLINE: SketchStyle = { width: 2, passes: 1, seed: 558 }
const METER_PANEL: SketchStyle = { fill: palette.paper, width: 3, seed: 556 }
const METER_TEXT: SketchTextStyle = { size: 17, color: palette.inkSoft }
const METER_NEEDLE: SketchStyle = {
  width: 4,
  passes: 1,
  wobble: 0.3,
  seed: 557
}
const NOODLE_POINTS = new Float64Array(10)
/** The drain meter's zones: from, to, colour and label. */
const DRAIN_ZONES = [
  [0, NOODLES.drainFrom, palette.water, 'Watery'],
  [NOODLES.drainFrom, NOODLES.drainTo, palette.green, 'Drain'],
  [NOODLES.drainTo, NOODLES.dumpMs, palette.orange, 'Mush']
] as const
/** The drain meter's bar, in design units: it reads 0 to NOODLES.dumpMs left to right. */
const DRAIN_BAR = { x: 34, y: 256, width: 220, height: 16 } as const
const STEAM_POINTS = new Float64Array(8)
/** Fridge captions float up from the lower door, clear of the magnets and the chip. */
const CAPTION_Y = 540

/**
 * The kitchen: the overview, where you start a batch from the recipe card, watch it move
 * from the pot to the bowl to the moulds, and run the tray through the fridge, plus one
 * close-up per station. The next thing to tap glows orange. Tapping it opens its station
 * with a quick wipe; each station has a Kitchen button back.
 */
export class KitchenScene implements Scene {
  readonly id = 'kitchen' as const
  private readonly fx = new Fx()
  private layer: CachedLayer | null = null
  private readonly stations: Partial<
    Record<Exclude<KitchenView, 'overview'>, Station>
  >
  private readonly stove: StoveStation
  /** The open station, or null on the overview. */
  private station: Station | null = null
  private wipe: Wipe<KitchenView> | null = null
  private readonly mopper: Mopper
  /** The noodles being drained: how long you have held, and the pouring sound. */
  private draining: { heldMs: number; sound: LoopHandle } | null = null

  constructor(private readonly game: Game) {
    this.mopper = new Mopper(game, this.fx, splat => splat)
    this.stove = new StoveStation(game, this)
    this.stations = {
      stove: this.stove,
      bowl: new BowlStation(game, this),
      moulds: new MouldsStation(game, this),
      sink: new SinkStation(game, this)
    }
  }

  /** The open station, or null on the overview. */
  get openStation(): Station | null {
    return this.station
  }

  /** Whether the overview's or a station's cached art is alive, for the dev perf report. */
  get hasLayer(): boolean {
    return this.layer !== null || (this.station?.hasLayer ?? false)
  }

  enter(): void {
    const viewport = this.game.viewport
    if (viewport) this.layer ??= this.createLayer(viewport)
  }

  /** Leaving the kitchen closes any station: its progress goes. */
  exit(): void {
    this.mopper.release()
    this.cancelDrain()
    this.station?.exit()
    this.station = null
    this.wipe = null
    this.game.state.kitchenView = 'overview'
    this.layer?.dispose()
    this.layer = null
  }

  tip(): string {
    if (this.station) return this.station.tip()
    if (this.draining) return 'Let go in the green.'
    return kitchenTip(
      this.game.state,
      this.game.economy.stock.count('gelatin'),
      this.game.batchOptions()
    )
  }

  /** Wipes to a station's close-up, or back to the overview. */
  open(view: KitchenView): void {
    if (this.wipe || view === this.game.state.kitchenView) return
    if (view !== 'overview' && !this.stations[view]) return
    this.wipe = startViewWipe(this.game.state.kitchenView, view)
    sfx.play('whoosh', { volume: 0.35, pitch: 1.3 })
  }

  private switchView(view: KitchenView): void {
    this.station?.exit()
    this.station = view === 'overview' ? null : (this.stations[view] ?? null)
    this.game.state.kitchenView = this.station ? view : 'overview'
    if (this.station) {
      // The overview's art waits in memory only while you are on it.
      this.layer?.dispose()
      this.layer = null
      this.station.enter()
    } else this.enter()
  }

  /** Recycled Batch, from its button by the tub or the R key. */
  recycledBatch(): void {
    const options = this.game.batchOptions()
    const result = startRecycledBatch(this.game.state, options)
    const at = KITCHEN_SPOTS.stove
    if (result.ok) {
      sfx.play('squish', { pitch: 0.7 })
      sfx.play('pour', { pitch: 0.8 })
      this.say('Floor jelly in. Mmm.', at.x + 90, at.y - 30, palette.brown)
    } else {
      sfx.play('boing', { volume: 0.5 })
      this.say(
        result.reason === 'busy'
          ? 'One batch at a time.'
          : `Need ${tubsFor(options)} tubs of floor jelly.`,
        at.x + 90,
        at.y - 30,
        palette.red
      )
    }
  }

  /** Try Again after a burn, from the stove's button or the B key. */
  retryBurnt(): void {
    if (this.station === this.stove) this.stove.retry()
  }

  /** Fresh Batch, from the recipe card button or the B key. B also tries a burnt batch again. */
  freshBatch(): void {
    const { state, economy } = this.game
    if (state.mix?.burnt) {
      if (this.station === this.stove) this.retryBurnt()
      else this.open('stove')
      return
    }
    const options = this.game.batchOptions()
    const result = startFreshBatch(state, economy.stock, options)
    const at = KITCHEN_SPOTS.stove
    if (result.ok) {
      sfx.play('pour', { pitch: 1.2 })
      this.say('Gelatin in!', at.x + 80, at.y - 30, palette.green)
    } else if (result.reason === 'busy') {
      sfx.play('boing', { volume: 0.5 })
      this.say('One batch at a time.', at.x + 90, at.y - 30, palette.red)
    } else {
      sfx.play('boing', { volume: 0.5 })
      this.say(
        `Need ${gelatinFor(options)} gelatin.`,
        at.x + 90,
        at.y - 30,
        palette.red
      )
    }
  }

  update(dtMs: number): void {
    this.fx.update(dtMs)
    const draining = this.draining
    if (draining) {
      draining.heldMs += dtMs
      draining.sound.setVolume(DRAIN_VOLUME)
      // Held too long: the noodles slide out of the colander into the sink.
      if (draining.heldMs >= NOODLES.dumpMs) this.finishDrain()
    }
    if (this.wipe) {
      const step = stepWipe(this.wipe, dtMs)
      if (step.switchNow) this.switchView(this.wipe.to)
      if (step.done) this.wipe = null
    }
    this.station?.update(dtMs)
  }

  mute(): void {
    this.draining?.sound.setVolume(0)
    this.station?.mute?.()
  }

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const viewport = this.game.viewport
    if (!viewport) return
    if (this.station) this.station.draw(ctx, timeMs)
    else this.drawOverview(ctx, viewport, timeMs)
    if (this.wipe) drawWipe(ctx, viewport.view, this.wipe, timeMs)
  }

  private drawOverview(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    timeMs: number
  ): void {
    this.layer ??= this.createLayer(viewport)
    this.layer.draw(ctx)
    const state = this.game.state
    for (const splat of state.splats)
      if (splat.room === 'kitchen') drawSplat(ctx, splat, this.game.layers)
    this.drawPot(ctx, state, timeMs)
    this.drawBowl(ctx, state, timeMs)
    this.drawDishes(ctx, state, timeMs)
    this.drawMoulds(ctx, state)
    this.drawTub(ctx, state)
    this.drawFridge(ctx, state, timeMs)
    const owns = this.game.owns('noodles')
    if (owns) this.drawNoodles(ctx, state, timeMs)
    const next = nextSpot(state, now())
    if (next)
      this.drawHint(
        ctx,
        next === 'stove' && !owns ? STOVE_ALL : KITCHEN_SPOTS[next],
        timeMs
      )
    if (this.draining) this.drawDrainMeter(ctx, this.draining.heldMs)
    this.mopper.draw(ctx, timeMs)
    this.fx.drawCaptions(ctx, NO_CAMERA)
  }

  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void {
    if (this.wipe) return
    if (this.station) {
      this.station.onPress(x, y, pointer, timeMs)
      return
    }
    const state = this.game.state
    const scale = this.game.viewport?.scale ?? 1
    const splat = splatAt(state.splats, x, y, Math.max(16, 24 / scale), s =>
      s.room === 'kitchen' ? s : null
    )
    if (splat) {
      this.mopper.press(splat, x, y, timeMs)
      return
    }
    let spot = spotAt(x, y)
    if (spot === 'noodles' && !this.game.owns('noodles')) spot = 'stove'
    if (spot === 'fridge') this.pressFridge()
    else if (spot === 'noodles') this.pressNoodles(x, y)
    else if (spot === 'stove') {
      if (state.mix?.stage === 'boil') this.open('stove')
      else if (!state.mix) this.say('Press Fresh Batch first.', x, y - 30)
      else this.say('The pot is done. Next: the bowl.', x, y - 30)
    } else if (spot === 'bowl') {
      if (state.mix?.stage === 'stir') this.open('bowl')
      else if (state.mix?.stage === 'stirred')
        this.say('Stirred. Pour it into the moulds.', x, y - 30)
      else this.say('The bowl is empty.', x, y - 30)
    } else if (spot === 'sink') this.pressSink(x, y)
    else if (spot === 'moulds') {
      if (canPour(state)) this.open('moulds')
      else if (state.mix?.stage === 'stirred' && !state.tray)
        this.say('Noodles first. The mix waits.', x, y + 60, palette.red)
      else if (state.tray?.location === 'kitchen')
        this.sayLines(traySummary(state.tray.moulds), 182, 290)
      else if (state.tray) this.say('The tray is out.', x, y + 60)
      else this.say('Nothing to pour yet.', x, y + 60)
    } else
      this.say(pick(['Smells like strawberry.', 'Tidy, for now.']), x, y - 20)
  }

  onDrag(x: number, y: number, timeMs: number): void {
    if (this.mopper.active) this.mopper.drag(x, y, timeMs)
    else this.station?.onDrag(x, y, timeMs)
  }

  onRelease(x: number, y: number): void {
    if (this.draining) this.finishDrain()
    else if (this.mopper.active) this.mopper.release()
    else this.station?.onRelease(x, y)
  }

  onKey(code: string, down: boolean): void {
    if (this.station) {
      this.station.onKey(code, down)
      return
    }
    // Space drains ready noodles on the overview, like holding the pot.
    if (code !== 'Space' || this.wipe) return
    if (down && !this.draining && noodlesReady(this.game.state, now()))
      this.startDrain()
    else if (!down && this.draining) this.finishDrain()
  }

  // ---------------------------------------------------------------- Noodles

  /** The noodle pot: start the noodles, say how long they need, or start draining. */
  private pressNoodles(x: number, y: number): void {
    const state = this.game.state
    const mix = state.mix
    const at = now()
    const sayAt = (text: string, colour?: string) =>
      this.say(text, x + 40, y - 40, colour)
    if (!mix) sayAt('Start a batch first.')
    else if (mix.noodles === null) sayAt('This batch skips the noodles.')
    else if (mix.noodles === 'raw') {
      startNoodles(state, at)
      sfx.play('splash', { volume: 0.6, pitch: 1.2 })
      sayAt('Noodles on. One minute.', palette.green)
    } else if (noodlesReady(state, at)) this.startDrain()
    else if (mix.noodles === 'boiling' && state.noodles)
      sayAt(
        `Still boiling. ${formatClock(timeLeftMs(state.noodles, at))} left.`
      )
    else sayAt('Drained. They go in with the pour.')
  }

  private startDrain(): void {
    this.draining = {
      heldMs: 0,
      sound: sfx.loop('pour', { volume: DRAIN_VOLUME, pitch: 1.3 })
    }
  }

  /** Lets go of the pot: the drain's result decides what the noodles do for the batch. */
  private finishDrain(): void {
    const draining = this.draining
    if (!draining) return
    this.draining = null
    draining.sound.stop()
    const result = drainNoodles(this.game.state, draining.heldMs, now())
    if (result) this.drained(result)
  }

  /** Walking away mid-drain puts the pot back down, still full. */
  private cancelDrain(): void {
    this.draining?.sound.stop()
    this.draining = null
  }

  private drained(result: DrainResult): void {
    const { x, y } = BACK_HOB
    const at = (text: string, colour: string, size = 30) =>
      this.fx.caption(text, x + 70, y - 110, {
        world: false,
        size,
        color: colour,
        ttlMs: 1800
      })
    if (result === 'good') {
      sfx.play('ding', { pitch: 1.2 })
      at('Al dente!', palette.green, 36)
    } else if (result === 'watery') {
      sfx.play('drip')
      sfx.play('slosh', { volume: 0.5 })
      at('Still dripping. Watery jelly.', palette.orange)
    } else if (result === 'mush') {
      sfx.play('squish', { pitch: 0.6 })
      at('Mush. No help this batch.', palette.red)
    } else {
      sfx.play('splash')
      sfx.play('fail', { volume: 0.4 })
      this.fx.shake(6)
      at('Down the sink. All of them.', palette.red, 32)
    }
  }

  /** Opens the sink when something in it needs washing, or says why not. */
  private pressSink(x: number, y: number): void {
    const state = this.game.state
    if (sinkTarget(state)) {
      this.open('sink')
      return
    }
    if (bowlsInUse(state) && bowlsDirty(state))
      this.say('The bowl is full. Wash it after you pour.', x - 80, y - 30)
    else
      this.say(pick(['Already clean.', 'Sparkling. For now.']), x - 40, y - 30)
  }

  private pressFridge(): void {
    const state = this.game.state
    const at = now()
    const door = KITCHEN_SPOTS.fridge
    const cx = door.x + door.width / 2
    switch (fridgeAction(state, at)) {
      case 'put-in':
        putInFridge(state, at)
        sfx.play('thud', { volume: 0.6 })
        sfx.play('whoosh', { volume: 0.4 })
        this.say('In it goes.', cx, CAPTION_Y, palette.green)
        break
      case 'take-out':
        takeTray(state, at)
        sfx.play('pop')
        this.say('Set! Take it to the wall.', cx - 80, CAPTION_Y, palette.green)
        if (state.tray)
          this.sayLines(traySummary(state.tray.moulds), cx - 80, CAPTION_Y + 40)
        break
      case 'setting':
        sfx.play('rattle', { volume: 0.4 })
        this.say(
          pick(['Still wobbling.', 'Shut it. The cold gets out.']),
          cx - 60,
          CAPTION_Y
        )
        break
      case 'empty':
        this.say(
          state.tray?.location === 'hand'
            ? 'The tray is in your hands.'
            : 'Just a lemon in here.',
          cx - 60,
          CAPTION_Y
        )
        break
    }
  }

  private say(
    text: string,
    x: number,
    y: number,
    color: string = palette.inkSoft
  ): void {
    this.fx.caption(text, x, y, { world: false, size: 26, color })
  }

  /** Stacks a few short captions, such as a tray's labels. */
  private sayLines(lines: readonly string[], x: number, y: number): void {
    lines.forEach((line, i) =>
      this.fx.caption(line, x, y + i * 32, {
        world: false,
        size: 24,
        color: palette.inkSoft,
        ttlMs: 2200
      })
    )
  }

  // Screens wider or taller than the cached margin show plain paper past it.
  private createLayer(viewport: Viewport): CachedLayer {
    return new CachedLayer(viewport, paintKitchen, ROOM_RECT)
  }

  // ---------------------------------------------------------------- Drawing (design units)

  private drawPot(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    const mix = state.mix
    if (mix?.stage !== 'boil') return
    LIQUID.fill = FLAVOUR_COLOURS[mix.flavour].fill
    LIQUID.color = FLAVOUR_COLOURS[mix.flavour].line
    sketchEllipse(ctx, 60, 300, 36, 7, LIQUID)
    // Lazy steam: the pot is warm, not boiling yet.
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(timeMs * 0.003 + i * 2) * 6
      const x = 46 + i * 28
      STEAM_POINTS[0] = x
      STEAM_POINTS[1] = 288
      STEAM_POINTS[2] = x + sway
      STEAM_POINTS[3] = 272
      STEAM_POINTS[4] = x - sway
      STEAM_POINTS[5] = 256
      STEAM_POINTS[6] = x + sway
      STEAM_POINTS[7] = 240
      STEAM.seed = 503 + i
      sketchPath(ctx, STEAM_POINTS, STEAM)
    }
  }

  private drawBowl(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    const mix = state.mix
    if (!mix || mix.stage === 'boil') return
    const setting = isSetting(mix, state.simMs)
    LIQUID.fill = setting ? '#c9b8a8' : FLAVOUR_COLOURS[mix.flavour].fill
    LIQUID.color = FLAVOUR_COLOURS[mix.flavour].line
    sketchEllipse(ctx, 239, 334, 42, 7, LIQUID)
    if (setting)
      sketchText(ctx, 'Setting!', 239, 300 + Math.sin(timeMs * 0.01) * 2, {
        font: 'marker',
        size: 20,
        color: palette.red
      })
  }

  /** Dried jelly and stink lines on a dirty empty bowl, and char on a burnt pot. */
  private drawDishes(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    if (bowlsDirty(state) && !bowlsInUse(state)) {
      for (let i = 0; i < 4; i++) {
        GUNK.seed = 530 + i
        sketchEllipse(ctx, 204 + i * 22, 334 + (i % 2) * 14, 9, 5, GUNK)
      }
      for (let i = 0; i < 2; i++) {
        const sway = Math.sin(timeMs * 0.004 + i * 2) * 5
        STEAM_POINTS[0] = 226 + i * 26
        STEAM_POINTS[1] = 318
        STEAM_POINTS[2] = 226 + i * 26 + sway
        STEAM_POINTS[3] = 304
        STEAM_POINTS[4] = 226 + i * 26 - sway
        STEAM_POINTS[5] = 290
        STEAM_POINTS[6] = 226 + i * 26 + sway
        STEAM_POINTS[7] = 278
        STINK.seed = 532 + i
        sketchPath(ctx, STEAM_POINTS, STINK)
      }
    }
    if (state.potScrubs > 0 && !potInUse(state))
      for (let i = 0; i < 3; i++) {
        CHAR.seed = 531 + i
        sketchEllipse(ctx, 36 + i * 24, 326 + (i % 2) * 12, 12, 8, CHAR)
      }
  }

  private drawMoulds(ctx: CanvasRenderingContext2D, state: GameState): void {
    const tray = state.tray
    if (tray && tray.location !== 'kitchen') {
      // The tray is away: only its dusty outline is left on the shelf.
      ctx.save()
      ctx.setLineDash([8, 6])
      ctx.strokeStyle = CUP_SPOT
      ctx.lineWidth = 3
      ctx.strokeRect(34, 190, 296, 42)
      ctx.restore()
      return
    }
    const count =
      tray?.moulds.length ??
      state.mix?.moulds ??
      this.game.batchOptions().moulds ??
      MOULDS
    const gap = 296 / count
    for (let i = 0; i < count; i++) {
      const x = 34 + i * gap + 4
      const w = gap - 8
      const mould = tray?.moulds[i]
      CUP.seed = 501 + i
      CUP.fill = mould
        ? jellyFill(tray.flavour, cloudiness(mould.make))
        : palette.paper
      CUP.color = mould ? FLAVOUR_COLOURS[tray.flavour].line : palette.inkSoft
      sketchRoundRect(ctx, x, 192, w, 38, 8, CUP)
      if (!mould) continue
      const word = qualityWord(mould.q)
      CUP_WORD.color = QUALITY_COLOURS[word]
      CUP_WORD.maxWidth = w + 6
      sketchText(ctx, word, x + w / 2, 252, CUP_WORD)
    }
  }

  /** The tub of scraped floor jelly, once you have some. */
  private drawTub(ctx: CanvasRenderingContext2D, state: GameState): void {
    if (state.tubs <= 0) return
    const [x, y, w, h] = TUB_ART
    sketchPath(ctx, [x, y, x + 8, y + h, x + w - 8, y + h, x + w, y], TUB)
    sketchEllipse(ctx, x + w / 2, y, w / 2, 9, TUB_JELLY)
    sketchText(ctx, 'FLOOR', x + w / 2, y + h / 2 + 2, TUB_LABEL)
    sketchText(ctx, `x${state.tubs}`, x + w + 22, y + 10, TUB_COUNT)
  }

  private drawFridge(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    if (this.game.owns('fridge')) {
      sketchCircle(ctx, 490, 626, 28, XL_STICKER)
      sketchText(ctx, 'XL', 490, 628, XL_TEXT)
    }
    if (state.bowls.length > 1) sketchText(ctx, 'x2', 178, 330, BOWLS_TEXT)
    const fridge = state.fridge
    if (!fridge) return
    const door = KITCHEN_SPOTS.fridge
    const cx = door.x + door.width / 2
    if (isDone(fridge)) {
      const bob = Math.sin(timeMs * 0.008) * 3
      sketchRoundRect(ctx, cx - 70, 270 + bob, 140, 54, 10, NOTE)
      sketchText(ctx, 'READY!', cx, 298 + bob, NOTE_TEXT)
    } else {
      // A frosty snowflake on the door while the tray sets.
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3
        FROST.seed = 510 + i
        sketchLine(
          ctx,
          cx - Math.cos(a) * 22,
          296 - Math.sin(a) * 22,
          cx + Math.cos(a) * 22,
          296 + Math.sin(a) * 22,
          FROST
        )
      }
    }
  }

  /**
   * The noodle pot on the back hob: dry noodles waiting, a boil with steam, a DRAIN note
   * once they are done, then what the drain left. While you drain, it tips into a
   * colander.
   */
  private drawNoodles(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    const { x, y } = BACK_HOB
    const noodles = state.mix?.noodles ?? null
    const ready = noodlesReady(state, now())
    const boiling = noodles === 'boiling'
    if (this.draining)
      // The colander waits on the stove top while the pot tips into it.
      sketchEllipse(ctx, x + 36, y - 6, 15, 6, COLANDER)
    ctx.save()
    if (this.draining) {
      // Lifted off the burner and tipped right around its bottom corner.
      ctx.translate(x + 24, y - 20)
      ctx.rotate(0.5)
      ctx.translate(-(x + 24), -(y - 2))
    } else if (boiling)
      for (let i = 0; i < 3; i++) {
        // Flames under the pot while it boils.
        const flick = Math.sin(timeMs * 0.02 + i * 2) * 3
        FLAME.seed = 560 + i
        sketchLine(
          ctx,
          x - 14 + i * 14,
          y + 2,
          x - 14 + i * 14,
          y - 8 + flick,
          FLAME
        )
      }
    sketchRoundRect(ctx, x - 24, y - 44, 48, 42, 8, NOODLE_POT)
    sketchLine(ctx, x - 32, y - 38, x + 32, y - 38, NOODLE_POT)
    if (boiling || noodles === 'watery')
      sketchEllipse(ctx, x, y - 38, 20, boiling ? 5 : 3, NOODLE_WATER)
    if (noodles === 'raw')
      // A bundle of dry noodles poking out: put them on.
      for (let i = 0; i < 4; i++) {
        NOODLE.seed = 552 + i
        sketchLine(ctx, x - 10 + i * 6, y - 30, x - 18 + i * 12, y - 70, NOODLE)
      }
    else if (boiling || noodles === 'good' || noodles === 'watery')
      for (let i = 0; i < 2; i++) {
        const wiggle = boiling ? Math.sin(timeMs * 0.008 + i * 3) * 3 : 0
        for (let k = 0; k < 5; k++) {
          NOODLE_POINTS[k * 2] = x - 18 + k * 9
          NOODLE_POINTS[k * 2 + 1] =
            y - 40 - i * 5 + (k % 2 ? -4 : 3) + wiggle * (k % 2 ? 1 : -1)
        }
        NOODLE.seed = 556 + i
        sketchPath(ctx, NOODLE_POINTS, NOODLE)
      }
    else if (noodles === 'mush') sketchEllipse(ctx, x, y - 42, 18, 7, MUSH)
    ctx.restore()
    if (this.draining) {
      // The water runs out of the lip into the colander.
      const sway = Math.sin(timeMs * 0.03) * 2
      sketchLine(ctx, x + 45, y - 56, x + 38 + sway, y - 10, STREAM)
      return
    }
    if (boiling)
      for (let i = 0; i < (ready ? 3 : 2); i++) {
        const sway = Math.sin(timeMs * 0.004 + i * 2) * 5
        const sx = x - 12 + i * 12
        STEAM_POINTS[0] = sx
        STEAM_POINTS[1] = y - 50
        STEAM_POINTS[2] = sx + sway
        STEAM_POINTS[3] = y - 62
        STEAM_POINTS[4] = sx - sway
        STEAM_POINTS[5] = y - 74
        STEAM_POINTS[6] = sx + sway
        STEAM_POINTS[7] = y - 86
        STEAM.seed = 570 + i
        sketchPath(ctx, STEAM_POINTS, STEAM)
      }
    if (ready) {
      const bob = Math.sin(timeMs * 0.008) * 3
      sketchRoundRect(ctx, x - 44, y - 132 + bob, 88, 36, 8, NOTE)
      sketchText(ctx, 'DRAIN', x, y - 113 + bob, DRAIN_NOTE)
    }
  }

  /** The drain meter over the stove: watery, good and mush zones, and how long you held. */
  private drawDrainMeter(ctx: CanvasRenderingContext2D, heldMs: number): void {
    const bar = DRAIN_BAR
    sketchRoundRect(
      ctx,
      bar.x - 12,
      bar.y - 20,
      bar.width + 24,
      bar.height + 52,
      10,
      METER_PANEL
    )
    const at = (ms: number) => bar.x + (bar.width * ms) / NOODLES.dumpMs
    for (const [from, to, colour, label] of DRAIN_ZONES) {
      ctx.fillStyle = colour
      ctx.fillRect(at(from), bar.y, at(to) - at(from), bar.height)
      sketchText(ctx, label, (at(from) + at(to)) / 2, bar.y + 30, METER_TEXT)
    }
    sketchRect(ctx, bar.x, bar.y, bar.width, bar.height, BAR_OUTLINE)
    const nx = at(Math.min(heldMs, NOODLES.dumpMs))
    sketchLine(ctx, nx, bar.y - 10, nx, bar.y + bar.height + 6, METER_NEEDLE)
  }

  /** A pulsing orange outline and a bobbing arrow on the next thing to tap. */
  private drawHint(
    ctx: CanvasRenderingContext2D,
    spot: Rect,
    timeMs: number
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.006)
    const previous = ctx.globalAlpha
    ctx.globalAlpha = previous * (0.45 + 0.55 * pulse)
    HINT.seed = 504 + Math.floor(timeMs / 200)
    sketchRoundRect(
      ctx,
      spot.x - 4,
      spot.y - 4,
      spot.width + 8,
      spot.height + 8,
      14,
      HINT
    )
    ctx.globalAlpha = previous
  }
}

function spotAt(x: number, y: number): Spot | null {
  for (const [name, r] of Object.entries(KITCHEN_SPOTS) as [Spot, Rect][])
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
      return name
  return null
}

/** The next thing to tap in the kitchen, for the orange hint. */
export function nextSpot(state: GameState, at: number): Spot | null {
  const action = fridgeAction(state, at)
  if (action === 'put-in' || action === 'take-out') return 'fridge'
  // The noodles take a minute, so they go on first.
  if (state.mix?.noodles === 'raw') return 'noodles'
  const stage = state.mix?.stage
  // A burnt batch waits at the stove for Try Again.
  if (state.mix?.burnt) return 'stove'
  // Wash the bowl before the boil fills it with the next batch.
  if (stage === 'boil') return bowlsDirty(state) ? 'sink' : 'stove'
  if (stage === 'stir') return 'bowl'
  if (noodlesReady(state, at)) return 'noodles'
  if (stage === 'stirred' && canPour(state)) return 'moulds'
  return sinkTarget(state) ? 'sink' : null
}

/** The kitchen's tip line, from the batch pipeline's state. */
export function kitchenTip(
  state: GameState,
  gelatin: number,
  options: BatchOptions = {}
): string {
  const at = now()
  const action = fridgeAction(state, at)
  if (state.tray?.location === 'hand') return 'Take the tray to the wall.'
  if (action === 'take-out') return 'The jelly is set. Tap the fridge.'
  if (action === 'put-in') return 'Tap the fridge to put the tray in.'
  const mix = state.mix
  if (mix?.noodles === 'raw')
    return 'Tap the back hob to start the noodles. They take a minute.'
  if (mix?.burnt) return 'The batch burnt. Tap the stove to try again.'
  if (mix?.stage === 'boil')
    return bowlsDirty(state)
      ? 'Wash the bowl in the sink before you boil. Dirty bowls make cloudy jelly.'
      : 'Tap the stove to boil the gelatin.'
  if (mix?.stage === 'stir') return 'Tap the bowl to stir.'
  if (noodlesReady(state, at))
    return 'Hold the noodle pot to drain it. Let go in the green.'
  if (mix?.stage === 'stirred') {
    if (isSetting(mix, state.simMs)) return "It's setting in the bowl. Pour it!"
    if (mix.noodles === 'boiling' && state.noodles)
      return `The noodles need ${formatClock(timeLeftMs(state.noodles, at))} more. The mix waits.`
    return canPour(state)
      ? 'Tap the moulds to pour.'
      : 'The mix waits in the bowl until the tray is back.'
  }
  if (state.splats.some(s => s.room === 'kitchen'))
    return 'Rub the splat on the floor to mop it.'
  if (sinkTarget(state))
    return state.potScrubs > 0
      ? `Tap the sink. The burnt pot needs ${state.potScrubs} scrubs.`
      : `Tap the sink and wash the bowl: ${sinkStrokesLeft(state)} strokes.`
  if (action === 'setting')
    return 'The jelly is setting. Start the next batch while you wait.'
  if (gelatin >= gelatinFor(options)) return 'Press Fresh Batch to start.'
  return state.tubs >= tubsFor(options)
    ? 'Out of gelatin. Recycled Batch uses your floor jelly.'
    : 'Out of gelatin. The shop sells more.'
}

/** Why Recycled Batch is disabled, or null when it works. */
export function recycledBatchBlocker(
  stoveBusy: boolean,
  tubs: number,
  options: BatchOptions = {}
): string | null {
  if (stoveBusy) return 'Stove busy'
  const need = tubsFor(options)
  if (tubs < need) return `${tubs} of ${need} tubs`
  return null
}

/** Why Fresh Batch is disabled, or null when it works. */
export function freshBatchBlocker(
  stoveBusy: boolean,
  gelatin: number,
  options: BatchOptions = {}
): string | null {
  if (stoveBusy) return 'Stove busy'
  const need = gelatinFor(options)
  if (gelatin < need) return `Need ${need} gelatin`
  return null
}
