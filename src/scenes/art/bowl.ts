import { hash01, palette, sketchCircle, sketchLine } from '../../shared'
import { ROOM_RECT } from './rooms'

/** The mixing bowl seen from above: centre, rim, inner wall and the liquid's edge. */
export const BOWL = {
  x: 300,
  y: 400,
  rim: 215,
  inner: 192,
  liquid: 160
} as const

/** The bowl close-up's still parts: the counter top and the empty bowl. */
export function paintBowl(ctx: CanvasRenderingContext2D): void {
  const { x, y, width, height } = ROOM_RECT
  ctx.fillStyle = '#e9ecef'
  ctx.fillRect(x, y, width, height)
  // Speckles, so the counter reads as stone.
  ctx.fillStyle = 'rgba(92, 92, 92, 0.18)'
  for (let i = 0; i < 260; i++)
    ctx.fillRect(
      x + hash01(31, i) * width,
      y + hash01(37, i) * height,
      3 + hash01(41, i) * 4,
      3
    )
  // A tea towel peeking in, for some colour.
  ctx.fillStyle = 'rgba(201, 42, 42, 0.18)'
  ctx.fillRect(x, 720, 260 - x, 120)
  for (let i = 0; i < 4; i++)
    sketchLine(ctx, x, 740 + i * 26, 250, 740 + i * 26, {
      width: 6,
      color: 'rgba(201, 42, 42, 0.45)',
      passes: 1,
      seed: 700 + i
    })

  sketchCircle(ctx, BOWL.x + 10, BOWL.y + 14, BOWL.rim, {
    fill: 'rgba(34, 34, 34, 0.12)',
    width: 0,
    seed: 705
  })
  sketchCircle(ctx, BOWL.x, BOWL.y, BOWL.rim, {
    fill: '#ffffff',
    width: 5,
    seed: 706
  })
  sketchCircle(ctx, BOWL.x, BOWL.y, BOWL.inner, {
    fill: '#e7f5ff',
    width: 3,
    color: palette.inkSoft,
    seed: 707
  })
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(BOWL.x, BOWL.y, BOWL.rim - 11, Math.PI * 1.1, Math.PI * 1.45)
  ctx.stroke()
}
