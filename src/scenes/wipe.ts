import { wipePosition, type Wipe } from '../game/rooms'
import {
  boilSeed,
  palette,
  sketchEllipse,
  sketchLine,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'

/** A rectangle in design units. */
interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

const EDGE: SketchStyle = { width: 5, wobble: 4, seed: 300 }
const RULE = 'rgba(116, 192, 252, 0.45)'
const MARGIN_RULE = 'rgba(201, 42, 42, 0.45)'
const FOOT: SketchStyle = { fill: palette.inkSoft, width: 0, seed: 301 }
const LABEL: SketchTextStyle = {
  font: 'marker',
  size: 36,
  color: palette.ink,
  tilt: 0.05,
  seed: 302
}
/** Footprints across the sheet while you walk to or from the shop. */
const STEPS = 6

/**
 * Draws the notebook-paper sheet of a room wipe over the whole visible view, in design
 * units. Shop trips add a caption and footprints while the sheet covers the view.
 */
export function drawWipe(
  ctx: CanvasRenderingContext2D,
  view: ViewRect,
  wipe: Wipe<string>,
  timeMs: number
): void {
  const p = wipePosition(wipe)
  const left = view.x + view.width * (1 - p)
  const top = view.y - 10
  const bottom = view.y + view.height + 10
  ctx.fillStyle = palette.paper
  ctx.fillRect(left, top, view.width, bottom - top)
  ctx.lineWidth = 2
  ctx.strokeStyle = RULE
  ctx.beginPath()
  for (let y = Math.ceil(top / 44) * 44; y < bottom; y += 44) {
    ctx.moveTo(left, y)
    ctx.lineTo(left + view.width, y)
  }
  ctx.stroke()
  ctx.strokeStyle = MARGIN_RULE
  ctx.beginPath()
  ctx.moveTo(left + 70, top)
  ctx.lineTo(left + 70, bottom)
  ctx.stroke()
  EDGE.seed = 300 + boilSeed(timeMs)
  sketchLine(ctx, left, top, left, bottom, EDGE)
  sketchLine(ctx, left + view.width, top, left + view.width, bottom, EDGE)

  if (!wipe.label) return
  const cx = left + view.width / 2
  const cy = view.y + view.height / 2
  sketchText(ctx, wipe.label, cx, cy - 60, LABEL)
  // Footprints appear one by one across the sheet, walking the way you go.
  const walkMs = wipe.durationMs - 2 * wipe.slideMs
  const shown = Math.min(
    STEPS,
    Math.floor(((wipe.elapsedMs - wipe.slideMs) / walkMs) * STEPS) + 1
  )
  const dir = wipe.to === 'shop' ? 1 : -1
  for (let i = 0; i < shown; i++) {
    const x = cx + dir * (i - (STEPS - 1) / 2) * 60
    const y = cy + 30 + (i % 2 ? 16 : -16)
    FOOT.seed = 301 + i
    sketchEllipse(ctx, x, y, 14, 8, FOOT)
    sketchEllipse(ctx, x + dir * 16, y, 5, 5, FOOT)
  }
}
