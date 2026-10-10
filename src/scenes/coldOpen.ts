import { COLD_OPEN } from '../game/tuning'
import {
  isTouchDevice,
  palette,
  settings,
  sfx,
  sketchBlob,
  sketchCircle,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import { drawUncleFace } from './art/uncle'

/** The uncle's two lines, broken into bubble rows. */
const LINES: readonly (readonly string[])[] = [
  ['Sixty blocks.', 'Sixty seconds.', 'All at once.'],
  ["Bet you can't", 'even do one.']
]

type Beat = 'enter' | 'line' | 'exit' | 'settle' | 'done'

const DOOR_X = 452
const DOOR_TOP = 150
const DOOR_BOTTOM = 640
const UNCLE_X = 530
const DOORWAY: SketchStyle = { fill: '#4a3426', width: 0, seed: 401 }
const FRAME: SketchStyle = { width: 10, color: palette.brown, seed: 402 }
const BODY: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  width: 3,
  seed: 403
}
const BODY_FILL: SketchStyle = { fill: '#b07b4a', width: 0, seed: 409 }
const BUTTON: SketchStyle = { fill: palette.yellow, width: 2, seed: 404 }
const ARM: SketchStyle = { width: 26, color: palette.brown, seed: 407 }
const HAND: SketchStyle = { fill: '#f4c7a1', width: 3, seed: 408 }
/** A pear of a cardigan, feet at (0, 0), in local units. */
const BODY_POINTS = [
  -78, -280, 78, -280, 112, -200, 126, -110, 104, -24, 0, -4, -104, -24, -126,
  -110, -112, -200
]
const BUBBLE: SketchStyle = { fill: '#ffffff', width: 3, seed: 405 }
const TAIL: SketchStyle = { fill: '#ffffff', width: 3, seed: 406 }
/** Where the bubble's tail points: the uncle's moustache, in design units. */
const MOUTH = { x: 450, y: 300 }
const BUBBLE_X = 240
const BUBBLE_TOP = 110
const TEXT: SketchTextStyle = { font: 'marker', size: 32, color: palette.ink }
const HINT: SketchTextStyle = { size: 26, color: palette.inkSoft }
const TAIL_POINTS = [100, 0, 0, 0, 160, 0]

/**
 * The cold open over the live wall: the uncle leans into a doorway, says his two lines
 * in speech bubbles, jangles his car keys and leaves. A tap or Space moves to the next
 * line. Times run on simulation time.
 */
export class ColdOpen {
  private beat: Beat = 'enter'
  private line = 0
  private beatMs = 0

  get done(): boolean {
    return this.beat === 'done'
  }

  /** Moves on to the next line, or sends him off after the last one. */
  advance(): void {
    if (this.beat === 'enter') this.startLine(0)
    else if (this.beat === 'line') {
      if (this.line + 1 < LINES.length) this.startLine(this.line + 1)
      else this.startExit()
    }
  }

  update(dtMs: number): void {
    if (this.beat === 'done') return
    this.beatMs += dtMs
    if (this.beat === 'enter' && this.beatMs >= COLD_OPEN.enterMs)
      this.startLine(0)
    else if (this.beat === 'line' && this.beatMs >= COLD_OPEN.lineMs)
      this.advance()
    else if (this.beat === 'exit' && this.beatMs >= COLD_OPEN.exitMs) {
      this.beat = 'settle'
      this.beatMs = 0
    } else if (this.beat === 'settle' && this.beatMs >= COLD_OPEN.settleMs)
      this.beat = 'done'
  }

  /** Draws the doorway, the uncle and his bubble, in design units. */
  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    if (this.beat === 'done' || this.beat === 'settle') return
    const t = this.beatMs
    // He slides in from the right, and out again with his keys.
    const slide =
      this.beat === 'enter'
        ? 1 - easeOut(t / COLD_OPEN.enterMs)
        : this.beat === 'exit'
          ? easeIn(t / COLD_OPEN.exitMs)
          : 0
    const doorAlpha = this.beat === 'exit' ? 1 - slide : 1
    ctx.save()
    ctx.globalAlpha = doorAlpha
    sketchRect(
      ctx,
      DOOR_X,
      DOOR_TOP,
      700 - DOOR_X,
      DOOR_BOTTOM - DOOR_TOP,
      DOORWAY
    )
    sketchRect(
      ctx,
      DOOR_X,
      DOOR_TOP,
      700 - DOOR_X,
      DOOR_BOTTOM - DOOR_TOP,
      FRAME
    )
    ctx.restore()

    const x = UNCLE_X + slide * 220
    // A slow lean while he talks.
    const lean = settings.get().reducedMotion
      ? 0
      : Math.sin(timeMs * 0.003) * 0.03
    ctx.save()
    ctx.translate(x, DOOR_BOTTOM)
    ctx.rotate(-0.06 + lean)
    // His arm leans on the door frame.
    sketchLine(ctx, -70, -250, -110, -330, ARM)
    sketchCircle(ctx, -112, -338, 16, HAND)
    sketchBlob(ctx, BODY_POINTS, BODY_FILL)
    sketchBlob(ctx, BODY_POINTS, BODY)
    for (let i = 0; i < 4; i++) sketchCircle(ctx, 0, -230 + i * 52, 6, BUTTON)
    ctx.translate(0, -360)
    ctx.scale(0.85, 0.85)
    // "Bet you can't even do one." gets the eyebrow.
    drawUncleFace(ctx, 0, 0, this.line === 0 ? 'smug' : 'eyebrow', timeMs)
    ctx.restore()

    if (this.beat !== 'line') return
    const rows = LINES[this.line]!
    const pop = Math.min(1, t / 140)
    const height = 40 + rows.length * 40
    const cy = BUBBLE_TOP + height / 2
    ctx.save()
    ctx.translate(BUBBLE_X, cy)
    ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop)
    TAIL.seed = 406 + this.line
    TAIL_POINTS[1] = height / 2 - 4
    TAIL_POINTS[2] = MOUTH.x - BUBBLE_X
    TAIL_POINTS[3] = MOUTH.y - cy
    TAIL_POINTS[5] = height / 2 - 4
    sketchPolygon(ctx, TAIL_POINTS, TAIL)
    BUBBLE.seed = 405 + this.line
    sketchRoundRect(ctx, -200, -height / 2, 400, height, 26, BUBBLE)
    for (let i = 0; i < rows.length; i++)
      sketchText(ctx, rows[i]!, 0, -height / 2 + 40 + i * 40, TEXT)
    ctx.restore()
    const hint = isTouchDevice() ? 'Tap to continue' : 'Click or press Space'
    sketchText(ctx, hint, BUBBLE_X, BUBBLE_TOP + height + 30, HINT)
  }

  private startLine(index: number): void {
    this.beat = 'line'
    this.line = index
    this.beatMs = 0
    sfx.play('pop', { pitch: 0.7 + index * 0.15 })
  }

  private startExit(): void {
    this.beat = 'exit'
    this.beatMs = 0
    sfx.play('rattle')
  }
}

function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) * (1 - c)
}

function easeIn(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c
}
