import {
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText
} from '../../shared'
import { ROOM_RECT } from './rooms'

// The stove close-up, in design units. Static parts paint once into a cached layer;
// the stove station draws the needle, flames, bubbles and steam on top.

// The dial and the progress bar sit low on the stove front, clear of the replay corner
// (top right) and the phone tip band (top).

/** The heat dial's centre and radius. The dial runs left (cold) to right (burnt) over the top. */
export const DIAL = { x: 300, y: 650, r: 130 } as const
/** The pot's body; the liquid surface sits at its top. */
export const POT = { left: 150, right: 450, top: 260, bottom: 430 } as const
/** The hob's top edge, under the pot. */
export const HOB_Y = 440
const STEEL = '#ced4da'

/** The dial's angle for a heat from 0 to 1: pointing left at 0, right at 1. */
export function dialAngle(heat: number): number {
  return Math.PI + heat * Math.PI
}

export function paintStove(ctx: CanvasRenderingContext2D): void {
  const left = ROOM_RECT.x
  const right = ROOM_RECT.x + ROOM_RECT.width
  const top = ROOM_RECT.y
  const bottom = ROOM_RECT.y + ROOM_RECT.height
  ctx.fillStyle = '#fff3bf'
  ctx.fillRect(left, top, right - left, HOB_Y - top)
  ctx.strokeStyle = 'rgba(240, 140, 0, 0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = left; x < right; x += 50) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, HOB_Y)
  }
  for (let y = top; y < HOB_Y; y += 50) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()

  // Hob top and the stove front with its knobs.
  sketchRect(ctx, left - 10, HOB_Y, right - left + 20, 40, {
    fill: '#343a40',
    width: 3,
    seed: 601
  })
  sketchRect(ctx, left - 10, HOB_Y + 40, right - left + 20, bottom - HOB_Y, {
    fill: '#e9ecef',
    width: 3,
    seed: 602
  })
  for (let i = 0; i < 4; i++) {
    const kx = i < 2 ? 50 + i * 60 : 490 + (i - 2) * 60
    sketchCircle(ctx, kx, 512, 13, {
      fill: palette.inkSoft,
      width: 2,
      seed: 603 + i
    })
    sketchLine(ctx, kx, 502, kx, 512, {
      width: 3,
      color: '#ffffff',
      passes: 1,
      seed: 607 + i
    })
  }

  // Burner ring under the pot.
  sketchEllipse(ctx, 300, HOB_Y + 4, 160, 12, {
    fill: '#212529',
    width: 2,
    seed: 613
  })

  // The heat dial's face and ticks. Its coloured zones draw live, since Assist moves them.
  ctx.beginPath()
  ctx.arc(DIAL.x, DIAL.y, DIAL.r + 8, Math.PI, 2 * Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = palette.ink
  ctx.stroke()
  for (let i = 0; i <= 10; i++) {
    const a = dialAngle(i / 10)
    const inner = i % 5 === 0 ? DIAL.r - 26 : DIAL.r - 16
    sketchLine(
      ctx,
      DIAL.x + Math.cos(a) * inner,
      DIAL.y + Math.sin(a) * inner,
      DIAL.x + Math.cos(a) * (DIAL.r - 4),
      DIAL.y + Math.sin(a) * (DIAL.r - 4),
      { width: 3, passes: 1, wobble: 1, seed: 620 + i }
    )
  }
  sketchLine(ctx, DIAL.x - DIAL.r, DIAL.y, DIAL.x + DIAL.r, DIAL.y, {
    width: 4,
    seed: 632
  })
  sketchText(ctx, 'COLD', DIAL.x - DIAL.r - 44, DIAL.y - 14, {
    font: 'marker',
    size: 20,
    color: palette.blue
  })
  sketchText(ctx, 'BURNT', DIAL.x + DIAL.r + 50, DIAL.y - 14, {
    font: 'marker',
    size: 20,
    color: palette.red
  })

  // The pot: steel body, rim and handles.
  sketchRoundRect(
    ctx,
    POT.left,
    POT.top,
    POT.right - POT.left,
    POT.bottom - POT.top,
    18,
    { fill: STEEL, width: 4, seed: 633 }
  )
  for (const side of [-1, 1]) {
    const x = side < 0 ? POT.left - 34 : POT.right + 4
    sketchRoundRect(ctx, x, POT.top + 30, 30, 18, 8, {
      fill: palette.ink,
      width: 2,
      seed: 634 + side
    })
  }
  sketchLine(ctx, POT.left + 30, POT.top + 30, POT.left + 30, POT.bottom - 20, {
    width: 6,
    color: 'rgba(255, 255, 255, 0.6)',
    passes: 1,
    seed: 637
  })
}
