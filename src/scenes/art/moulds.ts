import { palette, sketchRect } from '../../shared'
import { ROOM_RECT } from './rooms'

/** Where the moulds stand on the tray, in design units. */
export const MOULD_ROW = {
  left: 60,
  right: 540,
  top: 430,
  bottom: 570,
  gap: 16
} as const

/** The rectangle of mould `index` out of `count`. */
export function mouldRect(
  index: number,
  count: number
): { x: number; y: number; width: number; height: number } {
  const span = MOULD_ROW.right - MOULD_ROW.left
  const width = (span - MOULD_ROW.gap * (count - 1)) / count
  return {
    x: MOULD_ROW.left + index * (width + MOULD_ROW.gap),
    y: MOULD_ROW.top,
    width,
    height: MOULD_ROW.bottom - MOULD_ROW.top
  }
}

/** The pour close-up's still parts: tiles, the counter and the tray. */
export function paintMoulds(ctx: CanvasRenderingContext2D): void {
  const { x, y, width, height } = ROOM_RECT
  ctx.fillStyle = '#fff3bf'
  ctx.fillRect(x, y, width, 600 - y)
  ctx.strokeStyle = 'rgba(240, 140, 0, 0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let gx = x; gx < x + width; gx += 50) {
    ctx.moveTo(gx, y)
    ctx.lineTo(gx, 600)
  }
  for (let gy = y; gy < 600; gy += 50) {
    ctx.moveTo(x, gy)
    ctx.lineTo(x + width, gy)
  }
  ctx.stroke()
  sketchRect(ctx, x - 10, 596, width + 20, 30, {
    fill: '#e9ecef',
    width: 3,
    seed: 801
  })
  sketchRect(ctx, x - 10, 626, width + 20, y + height - 626 + 10, {
    fill: '#f7c48a',
    width: 3,
    seed: 802
  })
  // The metal tray the moulds stand on.
  sketchRect(ctx, 40, 566, 520, 30, {
    fill: '#ced4da',
    color: palette.inkSoft,
    width: 3,
    seed: 803
  })
}
