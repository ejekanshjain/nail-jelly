import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { makeBoil } from './boil'
import { ROOM_RECT } from './rooms'

// The hallway: one cached segment repeats along the route, and the per-frame parts
// (you, the tray, the end doors, the level bubble and the route strip) draw on top.

/** Width of the repeating hallway segment, in design units. */
export const HALL_SEGMENT = 800
/** The cached segment's area: one segment wide, as tall as every room. */
export const HALL_SEGMENT_RECT = {
  x: 0,
  y: ROOM_RECT.y,
  width: HALL_SEGMENT,
  height: ROOM_RECT.height
}
/** The floor line, where feet stand and splats lie. */
export const HALL_FLOOR_Y = 560
/** Where you stand on screen; the hallway scrolls past you. */
export const YOU_X = 300
/** The tray's centre, in your mitts. */
export const TRAY_Y = 352

const TOP = HALL_SEGMENT_RECT.y
const BOTTOM = HALL_SEGMENT_RECT.y + HALL_SEGMENT_RECT.height

/** The neighbour's door in each segment, from the segment's left edge. */
export const NEIGHBOUR_DOOR = {
  x: 470,
  y: 130,
  width: 150,
  height: 430
} as const

/**
 * Paints one segment of hallway, from x 0 to HALL_SEGMENT. The framed jelly doodle
 * gains a prop for each section locked so far.
 */
export function paintHallSegment(
  ctx: CanvasRenderingContext2D,
  locks = 0
): void {
  const right = HALL_SEGMENT
  ctx.fillStyle = palette.paperDark
  ctx.fillRect(0, TOP, right, HALL_FLOOR_Y - TOP)
  ctx.fillStyle = 'rgba(141, 85, 36, 0.1)'
  ctx.fillRect(0, 420, right, HALL_FLOOR_Y - 420)
  sketchLine(ctx, -10, 420, right + 10, 420, {
    width: 4,
    color: palette.brown,
    wobble: 1,
    seed: 120
  })

  // Floorboards and the skirting board.
  ctx.fillStyle = '#c9935e'
  ctx.fillRect(0, HALL_FLOOR_Y, right, BOTTOM - HALL_FLOOR_Y)
  for (let y = 600; y < BOTTOM; y += 46)
    sketchLine(ctx, -10, y, right + 10, y, {
      width: 2,
      color: palette.brown,
      wobble: 1,
      passes: 1,
      seed: 121 + y
    })
  for (let x = 90; x < right; x += 260)
    sketchLine(ctx, x, 604, x - 20, 640, {
      width: 2,
      color: palette.brown,
      passes: 1,
      seed: 140 + x
    })
  ctx.fillStyle = palette.brown
  ctx.fillRect(0, HALL_FLOOR_Y - 12, right, 16)

  // The long hallway runner.
  ctx.fillStyle = '#d64545'
  ctx.fillRect(0, 588, right, 54)
  ctx.fillStyle = '#ffe3e3'
  ctx.fillRect(0, 596, right, 3)
  ctx.fillRect(0, 631, right, 3)

  paintDoodle(ctx, locks)

  // The neighbour's door.
  sketchRect(ctx, 470, 130, 150, 430, {
    fill: '#a9744f',
    width: 4,
    seed: 130
  })
  sketchRect(ctx, 492, 160, 106, 150, {
    color: palette.brown,
    width: 2,
    seed: 131
  })
  sketchRect(ctx, 492, 340, 106, 180, {
    color: palette.brown,
    width: 2,
    seed: 132
  })
  sketchCircle(ctx, 600, 360, 8, { fill: palette.yellow, width: 2, seed: 133 })
  sketchRect(ctx, 520, 92, 50, 30, { fill: '#ffffff', width: 2, seed: 134 })
  sketchText(ctx, '4B', 545, 108, { font: 'marker', size: 20 })

  // A wall lamp between the frame and the door.
  sketchLine(ctx, 360, 150, 360, 196, { width: 3, seed: 135 })
  sketchPolygon(ctx, [334, 196, 386, 196, 400, 236, 320, 236], {
    fill: palette.yellow,
    width: 3,
    seed: 136
  })
}

/**
 * The framed jelly doodle: a block on one nail, worried at first. Each lock adds a prop:
 * a smile, a second nail, a padlock sticker, a crown, and his car keys.
 */
function paintDoodle(ctx: CanvasRenderingContext2D, locks: number): void {
  sketchRect(ctx, 80, 70, 170, 130, {
    fill: '#ffffff',
    color: palette.brown,
    width: 6,
    seed: 125
  })
  sketchRoundRect(ctx, 122, 112, 86, 62, 18, {
    fill: 'rgba(255, 107, 107, 0.82)',
    color: palette.red,
    width: 3,
    seed: 126
  })
  sketchCircle(ctx, 150, 138, 3, { fill: palette.ink, width: 0, seed: 127 })
  sketchCircle(ctx, 178, 138, 3, { fill: palette.ink, width: 0, seed: 128 })
  const mouth = { width: 2.5, passes: 1, seed: 141 } as const
  if (locks >= 1)
    sketchPath(ctx, [154, 152, 164, 158, 174, 152], { ...mouth, smooth: true })
  else
    sketchPath(ctx, [154, 154, 159, 151, 164, 154, 169, 151, 174, 154], mouth)
  sketchLine(ctx, 165, 112, 165, 92, { width: 3, seed: 129 })
  if (locks >= 2) sketchLine(ctx, 136, 114, 132, 94, { width: 3, seed: 142 })
  if (locks >= 3) {
    // A padlock sticker: this section is done.
    sketchRect(ctx, 212, 152, 24, 20, {
      fill: palette.yellow,
      width: 2,
      seed: 143
    })
    sketchPath(ctx, [216, 152, 216, 144, 224, 140, 232, 144, 232, 152], {
      width: 2.5,
      passes: 1,
      seed: 144
    })
  }
  if (locks >= 4)
    sketchPolygon(
      ctx,
      [182, 114, 184, 98, 192, 106, 198, 94, 204, 106, 212, 98, 210, 114],
      { fill: palette.yellow, width: 2, seed: 145 }
    )
  if (locks >= 5) {
    // His car keys, hung on the frame. Nearly yours.
    sketchCircle(ctx, 100, 186, 7, { width: 2.5, passes: 1, seed: 146 })
    sketchRect(ctx, 96, 192, 8, 18, {
      fill: palette.inkSoft,
      width: 1.5,
      seed: 147
    })
  }
}

const SIDES = [-1, 1] as const
const DOOR_GAP: SketchStyle = { fill: '#2b2118', width: 0, seed: 162 }
const PEEK_EYE: SketchStyle = { fill: '#ffffff', width: 1.5, seed: 163 }
const PEEK_PUPIL: SketchStyle = { fill: palette.ink, width: 0, seed: 164 }
const SLAM_LINE: SketchStyle = {
  width: 4,
  color: palette.inkSoft,
  passes: 1,
  seed: 165
}

/**
 * The neighbour's door over a cached segment, `x` its segment's left edge. While a slam
 * stomps closer (`ajar` 0 to 1) it opens a crack and someone peeks out; for a moment
 * after the slam (`slamMs`) it rattles with motion lines.
 */
export function drawNeighbourDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  ajar: number,
  slamMs: number
): void {
  const d = NEIGHBOUR_DOOR
  const right = x + d.x + d.width
  if (ajar > 0) {
    const gap = 6 + ajar * 20
    sketchRect(ctx, right - gap, d.y + 8, gap, d.height - 16, DOOR_GAP)
    // One eye peeks out through the crack.
    if (ajar > 0.4) {
      sketchEllipse(ctx, right - gap / 2, d.y + 150, 5, 3.5, PEEK_EYE)
      sketchCircle(ctx, right - gap / 2 + 1, d.y + 150, 2, PEEK_PUPIL)
    }
  }
  if (slamMs >= 0 && slamMs < 500) {
    const k = 1 - slamMs / 500
    for (const side of SIDES) {
      const sx = side < 0 ? x + d.x - 14 : right + 14
      for (let i = 0; i < 3; i++) {
        const y = d.y + 90 + i * 110
        sketchLine(ctx, sx, y, sx + side * 26 * k, y - 10, SLAM_LINE)
      }
    }
  }
}

const DOOR: SketchStyle = { fill: '#f1e3c6', width: 4, seed: 160 }
const DOOR_SIGN: SketchTextStyle = { font: 'marker', size: 22, rotate: -0.04 }

/** A room door at the end of the route, with a sign. `x` is its left edge. */
export function drawEndDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  label: string,
  seed: number
): void {
  DOOR.seed = seed
  sketchRect(ctx, x, 120, 160, HALL_FLOOR_Y - 120, DOOR)
  sketchCircle(ctx, x + 136, 360, 8, { fill: palette.ink, width: 0, seed })
  sketchRect(ctx, x + 20, 170, 120, 44, { fill: '#ffffff', width: 2, seed })
  sketchText(ctx, label, x + 80, 192, DOOR_SIGN)
}

const SKIN = '#f4c7a1'
const LEG: SketchStyle = { width: 12, color: palette.ink, passes: 1, seed: 170 }
const SHOE: SketchStyle = { fill: palette.ink, width: 0, seed: 171 }
const SHIRT: SketchStyle = { fill: '#74c0fc', width: 3, seed: 172 }
const APRON: SketchStyle = { fill: '#ffffff', width: 3, seed: 173 }
const STAIN: SketchStyle = {
  fill: 'rgba(255, 107, 107, 0.7)',
  width: 0,
  seed: 174
}
const HEAD: SketchStyle = { fill: SKIN, width: 3, seed: 175 }
const FEATURE: SketchStyle = { width: 3, wobble: 0.6, passes: 1, seed: 176 }
const EYE: SketchStyle = { fill: palette.ink, width: 0, seed: 177 }
const ARM: SketchStyle = { width: 16, color: '#74c0fc', passes: 1, seed: 178 }
const MITT: SketchStyle = { fill: palette.orange, width: 3, seed: 179 }
const SWEAT: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.9)',
  color: palette.blue,
  width: 1.5,
  passes: 1,
  seed: 180
}
const boilYou = makeBoil([SHOE, SHIRT, APRON, STAIN, FEATURE, SWEAT])
const BROW = new Float64Array(4)

/**
 * You, carrying the tray: legs stepping with `phase` (0 to 1 per stride), eyes on the
 * tray, eyebrows and sweat rising with `worry` (0 to 1). The mitts hold the tray tilted
 * by `trayDeg`. `timeMs` drives the line boil.
 */
export function drawYou(
  ctx: CanvasRenderingContext2D,
  x: number,
  phase: number,
  worry: number,
  carrying: boolean,
  seed: number,
  trayDeg = 0,
  timeMs = 0
): void {
  // Line boil: every seed moves on 6 times a second.
  const boil = boilSeed(timeMs) * 7
  boilYou(timeMs)
  const swing = Math.sin(phase * Math.PI * 2) * 18
  const hip = 470
  for (const side of [-1, 1]) {
    const footX = x + side * 20 + swing * side
    LEG.seed = 170 + side + boil
    sketchLine(ctx, x + side * 18, hip, footX, HALL_FLOOR_Y - 8, LEG)
    sketchEllipse(ctx, footX + 8, HALL_FLOOR_Y - 6, 18, 8, SHOE)
  }
  const bounce = Math.abs(Math.sin(phase * Math.PI * 2)) * -4
  sketchRoundRect(ctx, x - 62, 290 + bounce, 124, 190, 30, SHIRT)
  sketchRoundRect(ctx, x - 46, 330 + bounce, 92, 150, 16, APRON)
  sketchEllipse(ctx, x + 14, 440 + bounce, 12, 8, STAIN)
  sketchEllipse(ctx, x - 18, 412 + bounce, 7, 5, STAIN)

  // Arms out to the tray, ending in big oven mitts.
  const tilt = Math.sin((trayDeg * Math.PI) / 180)
  for (const side of [-1, 1]) {
    // The mitts ride under the tray, rising and dipping with its ends.
    const handY = carrying ? TRAY_Y + 10 + tilt * side * 56 : 420 + bounce
    ARM.seed = 178 + side + boil
    sketchLine(ctx, x + side * 52, 316 + bounce, x + side * 56, handY - 6, ARM)
    MITT.seed = 179 + side + boil
    sketchRoundRect(ctx, x + side * 56 - 20, handY - 12, 40, 30, 12, MITT)
  }

  // Head with worried eyebrows, eyes down on the tray.
  const hy = 232 + bounce
  HEAD.seed = seed + boil
  sketchCircle(ctx, x, hy, 44, HEAD)
  sketchCircle(ctx, x - 15, hy + 4, 4.5, EYE)
  sketchCircle(ctx, x + 15, hy + 4, 4.5, EYE)
  const lift = 4 + worry * 8
  for (const side of [-1, 1]) {
    BROW[0] = x + side * 8
    BROW[1] = hy - 10 - lift
    BROW[2] = x + side * 24
    BROW[3] = hy - 8 + worry * 2
    sketchPath(ctx, BROW, FEATURE)
  }
  if (worry > 0.5) sketchEllipse(ctx, x, hy + 22, 6, 7, FEATURE)
  else sketchLine(ctx, x - 9, hy + 22, x + 9, hy + 20, FEATURE)
  if (worry > 0.3) sketchEllipse(ctx, x + 40, hy - 12, 4, 7, SWEAT)
}

const TRAY: SketchStyle = { fill: '#ced4da', color: palette.inkSoft, width: 3 }
const TRAY_LIP: SketchStyle = { width: 4, color: palette.inkSoft, passes: 1 }

/** The tray in its own frame (call it after rotating): a plate `half` units each side. */
export function drawTray(
  ctx: CanvasRenderingContext2D,
  half: number,
  seed: number
): void {
  TRAY.seed = seed
  sketchRoundRect(ctx, -half - 12, 0, half * 2 + 24, 12, 5, TRAY)
  TRAY_LIP.seed = seed + 1
  sketchLine(ctx, -half - 12, 0, -half - 12, -10, TRAY_LIP)
  sketchLine(ctx, half + 12, 0, half + 12, -10, TRAY_LIP)
}

const TUBE: SketchStyle = { fill: '#e7f5ff', width: 3, seed: 190 }
const BUBBLE: SketchStyle = { fill: '#ffffff', width: 2.5, seed: 191 }
const LEVEL_LABEL: SketchTextStyle = { size: 22, color: palette.inkSoft }

/**
 * The spirit level under you: the bubble runs to the tray's high end. Green while the
 * jelly grips, orange when it slides, red past `dangerDeg`.
 */
export function drawLevel(
  ctx: CanvasRenderingContext2D,
  angle: number,
  gripDeg: number,
  dangerDeg: number
): void {
  const cx = 300
  const cy = 676
  const half = 170
  sketchRoundRect(ctx, cx - half, cy - 18, half * 2, 36, 18, TUBE)
  // The grip zone in the middle of the tube.
  const zone = (gripDeg / 20) * (half - 18)
  ctx.fillStyle = 'rgba(55, 178, 77, 0.25)'
  ctx.fillRect(cx - zone, cy - 14, zone * 2, 28)
  sketchLine(ctx, cx - zone, cy - 18, cx - zone, cy + 18, {
    width: 2,
    color: palette.green,
    passes: 1,
    seed: 192
  })
  sketchLine(ctx, cx + zone, cy - 18, cx + zone, cy + 18, {
    width: 2,
    color: palette.green,
    passes: 1,
    seed: 193
  })
  const tilt = Math.max(-20, Math.min(20, angle))
  const bx = cx - (tilt / 20) * (half - 18)
  const abs = Math.abs(angle)
  BUBBLE.color =
    abs < gripDeg
      ? palette.green
      : abs < dangerDeg
        ? palette.orange
        : palette.red
  sketchEllipse(ctx, bx, cy, 22, 11, BUBBLE)
  sketchText(ctx, 'Level', cx - half - 44, cy, LEVEL_LABEL)
}

const ROUTE_LINE: SketchStyle = {
  width: 4,
  color: palette.inkSoft,
  passes: 1,
  seed: 194
}
const ROUTE_YOU: SketchStyle = { fill: palette.blue, width: 2, seed: 195 }
const ROUTE_SPLAT: SketchStyle = { fill: palette.red, width: 0, seed: 196 }
const ROUTE_TEXT: SketchTextStyle = { size: 20, color: palette.inkSoft }

/** The route strip from the kitchen to the wall, with you and any splats on it. */
export function drawRoute(
  ctx: CanvasRenderingContext2D,
  pos: number,
  length: number,
  splats: readonly number[]
): void {
  const left = 120
  const right = 480
  const y = 744
  sketchLine(ctx, left, y, right, y, ROUTE_LINE)
  sketchText(ctx, 'Kitchen', left - 54, y, ROUTE_TEXT)
  sketchText(ctx, 'Wall', right + 36, y, ROUTE_TEXT)
  for (const at of splats) {
    const sx = left + (right - left) * Math.min(1, at / length)
    sketchCircle(ctx, sx, y, 6, ROUTE_SPLAT)
  }
  const yx = left + (right - left) * Math.min(1, pos / length)
  sketchCircle(ctx, yx, y, 11, ROUTE_YOU)
}
