import {
  hash01,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchPath,
  sketchRoundRect
} from '../../shared'
import { ROOM_RECT } from './rooms'

/** The sink close-up seen from above: the basin, the plug hole and where the dishes sit. */
export const SINK = {
  left: 40,
  top: 206,
  right: 560,
  bottom: 640,
  /** Where the bowl or the pot sits in the water. */
  x: 300,
  y: 430,
  /** The bowl's rim and inner wall, a little smaller than in the stir close-up. */
  bowlRim: 158,
  bowlInner: 140,
  /** The pot's radius, sitting on top of the bowl. */
  pot: 132
} as const

const TILE = '#d0ebff'
const TILE_LINE = 'rgba(28, 126, 214, 0.18)'
const STEEL = '#ced4da'
const BASIN = '#adb5bd'
const WATER = 'rgba(165, 216, 255, 0.55)'

/** The sink close-up's still parts: tiles, the steel sink, the tap and the soapy water. */
export function paintSink(ctx: CanvasRenderingContext2D): void {
  const { x, y, width, height } = ROOM_RECT
  ctx.fillStyle = TILE
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = TILE_LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let tx = x; tx < x + width; tx += 50) {
    ctx.moveTo(tx, y)
    ctx.lineTo(tx, y + height)
  }
  for (let ty = y; ty < y + height; ty += 50) {
    ctx.moveTo(x, ty)
    ctx.lineTo(x + width, ty)
  }
  ctx.stroke()

  const { left, top, right, bottom } = SINK
  // The steel surround, then the basin set into it.
  sketchRoundRect(ctx, left - 26, top - 46, right - left + 52, 520, 28, {
    fill: STEEL,
    width: 4,
    seed: 730
  })
  sketchRoundRect(ctx, left, top, right - left, bottom - top, 40, {
    fill: BASIN,
    width: 4,
    color: palette.inkSoft,
    seed: 731
  })
  // Soapy water fills the basin, with suds around the edge.
  sketchRoundRect(ctx, left + 14, top + 14, right - left - 28, 406, 32, {
    fill: WATER,
    width: 0,
    seed: 732
  })
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    const edge = i % 2 === 0
    const sx = left + 30 + t * (right - left - 60)
    const sy = edge
      ? top + 28 + hash01(91, i) * 18
      : bottom - 30 - hash01(93, i) * 18
    sketchCircle(ctx, sx, sy, 9 + hash01(95, i) * 10, {
      fill: 'rgba(255, 255, 255, 0.8)',
      width: 1.5,
      color: 'rgba(116, 192, 252, 0.8)',
      passes: 1,
      seed: 740 + i
    })
  }
  // The plug hole, peeking out in the corner.
  sketchCircle(ctx, right - 64, bottom - 64, 18, {
    fill: palette.inkSoft,
    width: 3,
    seed: 733
  })
  // The tap over the top edge, left of the replay corner.
  sketchPath(ctx, [196, 150, 196, 196, 236, 196, 236, 232], {
    width: 16,
    color: '#868e96',
    seed: 734
  })
  sketchEllipse(ctx, 196, 150, 22, 12, {
    fill: STEEL,
    width: 3,
    seed: 735
  })
}
