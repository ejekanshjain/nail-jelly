import {
  heatLevel,
  heatPhase,
  wallHeat,
  type HeatPhase,
  type HeatWave
} from '../game/heat'
import { HEAT } from '../game/tuning'
import {
  palette,
  settings,
  sfx,
  sketchCircle,
  sketchPath,
  sketchRect,
  toast,
  type LoopHandle,
  type SketchStyle
} from '../shared'
import type { Game } from './game'

const HOT_SKY: SketchStyle = {
  fill: '#ffc078',
  width: 5,
  color: palette.brown,
  seed: 310
}
const SUN: SketchStyle = {
  fill: palette.yellow,
  color: palette.orange,
  seed: 311
}
const CURTAIN: SketchStyle = {
  fill: palette.purple,
  fillStyle: 'hatch',
  hatchGap: 7,
  hatchAngle: 1.45,
  width: 3,
  seed: 312
}
const CURTAIN_ROD: SketchStyle = { width: 5, color: palette.brown, seed: 313 }
const HEAT_LINE: SketchStyle & { smooth: boolean } = {
  width: 3,
  color: 'rgba(240, 140, 0, 0.35)',
  passes: 1,
  wobble: 0.5,
  smooth: true,
  seed: 314
}
/** Rising heat lines over the wall, in design units. */
const LINE_XS = [70, 220, 380, 530] as const
const LINE = new Float64Array(12)
/** The rising gust loop's loudest volume. */
const GUST_VOLUME = 0.22

/**
 * The heat wave: a warning toast and an orange sky, then 90s of heat that softens every
 * block and speeds up decay. **Shut Curtains** (C) halves the extra decay. It overlaps
 * the other events.
 */
export class HeatWaveRunner {
  wave: HeatWave | null = null
  private phase: HeatPhase | null = null
  private gust: LoopHandle | null = null

  constructor(private readonly game: Game) {}

  /** Starts the warning now. False while one runs already. */
  start(): boolean {
    if (this.wave) return false
    this.wave = { startMs: this.game.state.simMs, curtains: false }
    this.phase = 'coming'
    toast('A heat wave is coming. Shut the curtains!', 'bad', 3600)
    sfx.play('wind', { pitch: 0.7, volume: 0.6 })
    if (this.game.state.scene === 'wall')
      this.game.fx.caption("It's getting hot…", 300, 250, {
        world: false,
        size: 34,
        color: palette.orange,
        ttlMs: 2200
      })
    return true
  }

  /** Draws the curtains across the window. Returns whether they were open. */
  shutCurtains(): boolean {
    const wave = this.wave
    if (!wave || wave.curtains) return false
    wave.curtains = true
    sfx.play('whoosh', { pitch: 0.7, volume: 0.6 })
    sfx.play('scrub', { volume: 0.3, pitch: 1.4 })
    this.game.fx.caption('Curtains shut. A bit cooler.', 300, 200, {
      world: false,
      size: 28,
      color: palette.ink,
      ttlMs: 1800
    })
    return true
  }

  /** Where the heat wave is now, for the HUD: none, coming or hot. */
  get current(): HeatPhase | null {
    return this.phase
  }

  /** Sets the wall's heat and plays the moments where it starts and ends. */
  update(): void {
    const game = this.game
    const wave = this.wave
    game.wall.setHeat(wallHeat(wave, game.state.simMs))
    if (!wave) return
    const phase = heatPhase(wave, game.state.simMs)
    const was = this.phase
    this.phase = phase === 'over' ? null : phase
    if (phase === 'hot' && was === 'coming') {
      sfx.play('wind', { pitch: 0.6 })
      this.gust = sfx.loop('wind', { pitch: 0.6, volume: 0 })
      if (game.state.scene === 'wall')
        game.fx.caption('HEAT WAVE!', 300, 250, {
          world: false,
          size: 52,
          color: palette.red,
          ttlMs: 1800
        })
      else game.alert('The heat wave hit. The jelly is going soft.')
    }
    if (phase === 'over') {
      this.wave = null
      this.gust?.stop(800)
      this.gust = null
      sfx.play('ding', { pitch: 1.2, volume: 0.6 })
      toast('The heat wave is over. The curtains are open again.', 'good')
      return
    }
    const present = game.state.scene === 'wall'
    this.gust?.setVolume(
      present ? GUST_VOLUME * heatLevel(wave, game.state.simMs) : 0
    )
  }

  /** Silences the gust while a dialog pauses the run; the next step brings it back. */
  mute(): void {
    this.gust?.setVolume(0)
  }

  /** The hint while it is hot. */
  tip(): string | null {
    if (!this.wave) return null
    return this.wave.curtains
      ? 'The curtains help. Re-nail anything that sags.'
      : 'Heat wave! Shut the curtains, then re-nail what sags.'
  }

  /** The window's sky and sun while it is hot, in design units. */
  drawSky(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    if (!this.wave) return false
    sketchRect(ctx, x, y, width, height, HOT_SKY)
    sketchCircle(ctx, x + 40, y + 36, 20, SUN)
    return true
  }

  /** The curtains, open at the sides or drawn across, in design units. */
  drawCurtains(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const wave = this.wave
    if (!wave) return
    const half = wave.curtains ? width / 2 + 4 : 26
    sketchRect(ctx, x - 6, y - 4, half, height, CURTAIN)
    sketchRect(ctx, x + width + 6 - half, y - 4, half, height, CURTAIN)
    sketchPath(ctx, rod(x, y, width), CURTAIN_ROD)
  }

  /**
   * An orange tint and rising heat lines over the room, in design units. They build
   * over the warning and halve once the curtains are shut.
   */
  drawOverlay(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const level = heatLevel(this.wave, this.game.state.simMs)
    if (level <= 0) return
    const view = this.game.viewport?.view
    if (!view) return
    ctx.fillStyle = `rgba(255, 146, 43, ${(HEAT.tint * level).toFixed(3)})`
    ctx.fillRect(view.x, view.y, view.width, view.height)
    const t = settings.get().reducedMotion ? 0 : timeMs / 1000
    HEAT_LINE.color = `rgba(240, 140, 0, ${(0.35 * level).toFixed(3)})`
    for (const x of LINE_XS) {
      // Each line rises from the floor and wiggles as it goes.
      const rise = (t * 60 + x) % 120
      for (let i = 0; i < 6; i++) {
        const y = 600 - i * 70 - rise
        LINE[i * 2] = x + Math.sin(t * 3 + y * 0.03) * 10
        LINE[i * 2 + 1] = y
      }
      sketchPath(ctx, LINE, HEAT_LINE)
    }
  }
}

const ROD = new Float64Array(4)

function rod(x: number, y: number, width: number): Float64Array {
  ROD[0] = x - 12
  ROD[1] = y - 4
  ROD[2] = x + width + 12
  ROD[3] = y - 4
  return ROD
}
