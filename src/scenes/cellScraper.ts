import { scrapeCell, scrapesLeft } from '../game/mess'
import { cellCentre } from '../game/sim/geometry'
import { MESS } from '../game/tuning'
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

const HANDLE: SketchStyle = { width: 6, color: palette.brown, seed: 711 }
const BLADE: SketchStyle = { width: 6, color: palette.inkSoft, seed: 712 }
const PROGRESS: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.ink,
  outline: palette.paper
}

/**
 * Scrapes old jelly and empty nails off an empty wall cell with a rub. The wall scene
 * starts it when a press on a dirty cell becomes a rub, then feeds it drags in design
 * units with each event's time stamp. `toDesign` maps a world point to design units.
 */
export class CellScraper {
  private section = -1
  private cell = -1
  private readonly rub = new RubGesture({ minAmplitude: MESS.rubAmplitude })
  private turnAtMs = 0
  private flung = false
  private x = 0
  private y = 0

  constructor(
    private readonly game: Game,
    private readonly fx: Fx,
    private readonly toDesign: (
      x: number,
      y: number
    ) => { x: number; y: number }
  ) {}

  get active(): boolean {
    return this.cell >= 0
  }

  /** Starts scraping `cell` of `section` from a press at (x0, y0), now at (x, y). */
  start(
    section: number,
    cell: number,
    x0: number,
    y0: number,
    timeMs: number
  ): void {
    this.section = section
    this.cell = cell
    this.rub.reset()
    this.rub.add(x0, y0)
    this.turnAtMs = timeMs
    this.flung = false
    this.x = x0
    this.y = y0
    sfx.play('scrub', { volume: 0.4, pitch: 0.6 })
  }

  drag(x: number, y: number, timeMs: number): void {
    if (!this.active) return
    this.x = x
    this.y = y
    if (this.rub.add(x, y)) this.stroke(timeMs)
  }

  release(): void {
    if (this.active && this.rub.end()) this.stroke(performance.now())
    this.cell = -1
  }

  private stroke(timeMs: number): void {
    const section = this.game.state.sections[this.section]
    if (!section) return
    const seconds = Math.max(0.001, (timeMs - this.turnAtMs) / 1000)
    this.turnAtMs = timeMs
    const speed = this.rub.lastAmplitude / seconds
    const at = this.centre()
    for (const event of scrapeCell(
      section,
      this.cell,
      speed,
      settings.get().assist,
      !this.flung
    )) {
      if (event.type === 'scrape')
        sfx.play('scrub', { volume: 0.5, pitch: 0.55 + Math.random() * 0.1 })
      else if (event.type === 'fling') {
        this.flung = true
        sfx.play('splat', { volume: 0.5, pitch: 1.4 })
        vibrate(30)
        this.fx.shake(3)
        this.say(
          'Too fast! You flicked it next door.',
          at.x,
          at.y - 70,
          palette.red
        )
      } else {
        sfx.play('ding', { pitch: 1.3 })
        this.say('Scraped clean!', at.x, at.y - 40, palette.green)
        this.cell = -1
      }
    }
  }

  private centre(): { x: number; y: number } {
    const c = cellCentre(this.section, this.cell)
    return this.toDesign(c.x, c.y)
  }

  private say(text: string, x: number, y: number, color: string): void {
    this.fx.caption(text, Math.min(450, Math.max(150, x)), y, {
      world: false,
      size: 26,
      color,
      ttlMs: 1800
    })
  }

  /** The scraper at the pointer, and the strokes left on the cell. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return
    const cell = this.game.state.sections[this.section]?.cells[this.cell]
    if (!cell) return
    const x = this.x
    const y = this.y
    sketchLine(ctx, x + 60, y - 110, x + 6, y - 8, HANDLE)
    sketchLine(ctx, x - 20, y - 2, x + 28, y - 16, BLADE)
    const at = this.centre()
    sketchText(
      ctx,
      `Scrape: ${scrapesLeft(cell)} more`,
      Math.min(500, Math.max(100, at.x)),
      at.y + 40,
      PROGRESS
    )
  }
}
