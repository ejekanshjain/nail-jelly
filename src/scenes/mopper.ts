import { rubSplat, scraping, strokesFor } from '../game/mess'
import { MESS } from '../game/tuning'
import type { Splat } from '../game/types'
import {
  palette,
  RubGesture,
  settings,
  sfx,
  sketchLine,
  sketchText,
  vibrate,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import type { Fx } from './fx'
import type { Game } from './game'

const HANDLE: SketchStyle = { width: 6, color: palette.brown, seed: 701 }
const STRING: SketchStyle = {
  width: 3,
  color: '#e9ecef',
  passes: 1,
  wobble: 1,
  seed: 702
}
const SCRAPER: SketchStyle = { width: 5, color: palette.inkSoft, seed: 703 }
const PROGRESS: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.ink,
  outline: palette.paper
}

/**
 * Scrapes and mops the splat under a press. A scene starts it when a press lands on a
 * splat, feeds it drags in design units with each event's time stamp, and draws the
 * scraper or mop at the pointer. `locate` gives a splat's spot in design units.
 */
export class Mopper {
  /** The splat being rubbed, or null. */
  splat: Splat | null = null
  private readonly rub = new RubGesture({ minAmplitude: MESS.rubAmplitude })
  private turnAtMs = 0
  private x = 0
  private y = 0
  private toldNoMop = false

  constructor(
    private readonly game: Game,
    private readonly fx: Fx,
    private readonly locate: (splat: Splat) => { x: number; y: number }
  ) {}

  get active(): boolean {
    return this.splat !== null
  }

  press(splat: Splat, x: number, y: number, timeMs: number): void {
    this.splat = splat
    this.rub.reset()
    this.rub.add(x, y)
    this.turnAtMs = timeMs
    this.x = x
    this.y = y
    this.toldNoMop = false
  }

  drag(x: number, y: number, timeMs: number): void {
    if (!this.splat) return
    this.x = x
    this.y = y
    if (this.rub.add(x, y)) this.stroke(timeMs)
  }

  release(): void {
    if (this.splat && this.rub.end()) this.stroke(performance.now())
    this.splat = null
  }

  /** One counted stroke: its speed is its length over the time since the last turn. */
  private stroke(timeMs: number): void {
    const splat = this.splat
    if (!splat) return
    const seconds = Math.max(0.001, (timeMs - this.turnAtMs) / 1000)
    this.turnAtMs = timeMs
    const speed = this.rub.lastAmplitude / seconds
    const { state, economy } = this.game
    const at = this.locate(splat)
    for (const event of rubSplat(
      state,
      splat,
      speed,
      economy.stock,
      settings.get().assist
    )) {
      switch (event.type) {
        case 'scrape':
          sfx.play('scrub', { volume: 0.5, pitch: 0.7 + Math.random() * 0.1 })
          break
        case 'tub':
          sfx.play('pop')
          sfx.play('squish', { volume: 0.5 })
          this.say('+1 tub of floor jelly', at.x, at.y - 50, palette.green)
          break
        case 'mop':
          sfx.play('scrub', { volume: 0.5, pitch: 1.1 + Math.random() * 0.2 })
          break
        case 'spread':
          sfx.play('slosh')
          vibrate(30)
          this.fx.shake(4)
          this.say('Too fast! It spread.', at.x, at.y - 50, palette.red)
          break
        case 'clean':
          sfx.play('ding', { pitch: 1.4 })
          this.say('Clean!', at.x, at.y - 40, palette.green)
          this.splat = null
          break
        case 'worn':
          sfx.play('fail', { volume: 0.6 })
          this.say('Your mop head fell apart.', at.x, at.y - 80, palette.red)
          break
        case 'spare':
          sfx.play('click')
          this.say('A spare head fits itself.', at.x, at.y - 110)
          break
        case 'no-mop':
          if (this.toldNoMop) break
          this.toldNoMop = true
          sfx.play('boing', { volume: 0.5 })
          this.say('No mop head. The shop sells them.', at.x, at.y - 50)
          break
      }
    }
  }

  private say(
    text: string,
    x: number,
    y: number,
    color: string = palette.inkSoft
  ): void {
    this.fx.caption(text, Math.min(460, Math.max(140, x)), y, {
      world: false,
      size: 26,
      color,
      ttlMs: 1800
    })
  }

  /** The scraper or mop at the pointer, and the strokes left on the splat. */
  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const splat = this.splat
    if (!splat) return
    const x = this.x
    const y = this.y
    if (scraping(splat)) {
      sketchLine(ctx, x + 70, y - 120, x + 8, y - 10, HANDLE)
      sketchLine(ctx, x - 20, y - 4, x + 26, y - 18, SCRAPER)
    } else {
      sketchLine(ctx, x + 70, y - 150, x, y - 16, HANDLE)
      for (let i = 0; i < 7; i++) {
        const sway = Math.sin(timeMs * 0.02 + i) * 4
        STRING.seed = 702 + i
        sketchLine(ctx, x, y - 16, x - 24 + i * 8 + sway, y + 10, STRING)
      }
    }
    const at = this.locate(splat)
    const label = scraping(splat)
      ? `Scrape ${splat.strokes}/${MESS.scrapeStrokes}`
      : `Mop ${splat.strokes - (splat.chunk ? MESS.scrapeStrokes : 0)}/${MESS.mopStrokes}`
    const done = splat.strokes / strokesFor(splat)
    PROGRESS.color = done > 0.5 ? palette.green : palette.ink
    // Below the splat, clear of the captions that float up from it.
    sketchText(
      ctx,
      label,
      Math.min(500, Math.max(100, at.x)),
      at.y + 34,
      PROGRESS
    )
  }
}

/**
 * The splat under a press at (x, y), or null. `place` puts each splat in the same units
 * as the press, or skips it with null; `slack` widens every target, for small screens.
 */
export function splatAt(
  splats: readonly Splat[],
  x: number,
  y: number,
  slack: number,
  place: (splat: Splat) => { x: number; y: number } | null,
  radiusScale = 1
): Splat | null {
  let best: Splat | null = null
  let bestD = Infinity
  for (const splat of splats) {
    const p = place(splat)
    if (!p) continue
    const dx = x - p.x
    const dy = (y - p.y) * 1.6
    const d = Math.hypot(dx, dy)
    if (d <= splat.radius * radiusScale + slack && d < bestD) {
      best = splat
      bestD = d
    }
  }
  return best
}
