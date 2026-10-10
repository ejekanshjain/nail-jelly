import type { UncleFace } from '../../game/uncle'
import {
  boilSeed,
  palette,
  settings,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchText,
  type SketchStyle
} from '../../shared'

const SKIN = '#f4c7a1'
const CAP = '#6b4f3a'

/** Where the portrait's face sits, from the slot's top-left corner. */
export const PORTRAIT_FACE = { x: 245, y: 170 } as const

/**
 * The uncle's empty portrait frame and the car-key hook, drawn in the wall's sixth slot
 * and cached. (x, y) is the slot's top-left corner; the slot is a section's size. Draw
 * his face over it with `drawUncleFace` at `PORTRAIT_FACE`.
 */
export function drawUncleSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  const fx = x + 130
  const fy = y + 20
  const fw = 230
  const fh = 280
  sketchRect(ctx, fx - 14, fy - 14, fw + 28, fh + 28, {
    fill: palette.yellow,
    color: palette.brown,
    width: 5,
    seed: 61
  })
  sketchRect(ctx, fx, fy, fw, fh, {
    fill: palette.paperDark,
    width: 2,
    seed: 62
  })
  // The face draws live over this cached frame, so his mood can change.
  sketchRect(ctx, fx + fw / 2 - 50, fy + fh + 18, 100, 26, {
    fill: '#d4a017',
    width: 2,
    seed: 63
  })
  sketchText(ctx, 'UNCLE', fx + fw / 2, fy + fh + 31, {
    font: 'marker',
    size: 16,
    color: palette.ink
  })

  // The key hook with his car keys: the prize.
  const hx = x + 440
  const hy = y + 120
  sketchLine(ctx, hx - 24, hy, hx + 24, hy, {
    width: 5,
    color: palette.brown,
    seed: 64
  })
  sketchLine(ctx, hx, hy, hx, hy + 18, { width: 3, seed: 65 })
  sketchCircle(ctx, hx, hy + 30, 12, {
    width: 3,
    color: palette.inkSoft,
    seed: 66
  })
  sketchRect(ctx, hx - 8, hy + 42, 16, 34, {
    fill: palette.inkSoft,
    width: 2,
    seed: 67
  })
  sketchRect(ctx, hx + 6, hy + 40, 26, 14, {
    fill: palette.red,
    width: 2,
    seed: 68
  })
  sketchText(ctx, 'THE BET:', hx, hy + 110, {
    font: 'marker',
    size: 16,
    rotate: -0.06
  })
  sketchText(ctx, 'his car', hx, hy + 132, { size: 20, rotate: -0.06 })
}

// His face in local units around (0, 0), the middle of his head. Constant shapes, so
// drawing allocates nothing.
const SHOULDERS = [-100, 130, -80, 70, 80, 70, 100, 130]
const CAP_POINTS = [-66, -40, -50, -82, 40, -86, 78, -52, 92, -40]
const TASH = {
  smug: [-52, 40, -30, 26, 0, 32, 30, 26, 52, 40],
  smirk: [-52, 42, -30, 28, 0, 32, 30, 20, 54, 22],
  droop: [-50, 52, -30, 30, 0, 32, 30, 30, 50, 52],
  flat: [-48, 34, -24, 30, 0, 31, 24, 30, 48, 34],
  laugh: [-54, 34, -30, 20, 0, 26, 30, 20, 54, 34]
} as const
const LAUGH_EYE = [-11, 2, -5, -6, 5, -6, 11, 2]
const SIDES = [-1, 1] as const

const CARDIGAN: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  width: 3,
  seed: 70
}
const HEAD: SketchStyle = { fill: SKIN, width: 3, seed: 71 }
const CAP_STYLE: SketchStyle = { fill: CAP, width: 3, seed: 72 }
const EYE_WHITE: SketchStyle = { fill: '#ffffff', width: 2, seed: 73 }
const PUPIL: SketchStyle = { fill: palette.ink, width: 0, seed: 75 }
const LID: SketchStyle = { width: 3, seed: 76 }
const BROW: SketchStyle = { width: 4, seed: 78 }
const NOSE: SketchStyle = { fill: '#e8a87c', width: 2, seed: 80 }
const MOUSTACHE: SketchStyle & { smooth: boolean } = {
  smooth: true,
  width: 12,
  color: palette.ink,
  seed: 81
}
const TOOTHPICK: SketchStyle = { width: 2.5, color: palette.brown, seed: 82 }
const MOUTH: SketchStyle = { fill: '#7a2e2e', width: 2.5, seed: 83 }
const LIP: SketchStyle = { width: 3, seed: 84 }
const LAUGH_LINE: SketchStyle & { smooth: boolean } = {
  smooth: true,
  width: 3.5,
  seed: 85
}
const DROP: SketchStyle = {
  fill: '#a5d8ff',
  color: palette.blue,
  width: 2,
  seed: 86
}
const BLUSH: SketchStyle = {
  fill: 'rgba(250, 82, 82, 0.35)',
  width: 0,
  seed: 87
}

/** The line boil's seed offset for the face being drawn. */
let faceBoil = 0

/** Sets every style's seed to its base plus the line boil, so the face wobbles alive. */
function boilFace(boil: number): void {
  faceBoil = boil
  CARDIGAN.seed = 70 + boil
  HEAD.seed = 71 + boil
  CAP_STYLE.seed = 72 + boil
  EYE_WHITE.seed = 73 + boil
  LID.seed = 76 + boil
  BROW.seed = 78 + boil
  NOSE.seed = 80 + boil
  MOUSTACHE.seed = 81 + boil
  TOOTHPICK.seed = 82 + boil
  MOUTH.seed = 83 + boil
  LAUGH_LINE.seed = 85 + boil
}

/**
 * The uncle's head and shoulders at (cx, cy): pear-shaped, flat cap, huge moustache,
 * and the expression for his mood. `timeMs` drives the line boil and the moving bits
 * (a twitching eyebrow, a laugh's shake, a running drop of sweat).
 */
export function drawUncleFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  face: UncleFace = 'smug',
  time = 0
): void {
  // Reduced Motion holds the face still: no boil, shake, twitch or running sweat.
  const timeMs = settings.get().reducedMotion ? 0 : time
  boilFace(boilSeed(timeMs) * 7)
  const laughing = face === 'laugh'
  const shake = laughing && timeMs > 0 ? Math.sin(timeMs * 0.045) * 3 : 0
  ctx.save()
  ctx.translate(cx, cy + shake)
  sketchPolygon(ctx, SHOULDERS, CARDIGAN)
  sketchEllipse(ctx, 0, 5, 62, 78, HEAD)
  sketchPolygon(ctx, CAP_POINTS, CAP_STYLE)
  if (face === 'sweating' || laughing) {
    sketchEllipse(ctx, -36, 20, 12, 7, BLUSH)
    sketchEllipse(ctx, 36, 20, 12, 7, BLUSH)
  }
  drawEyes(ctx, face)
  drawBrows(ctx, face, timeMs)
  sketchEllipse(ctx, 0, 12, 10, 13, NOSE)
  drawMouth(ctx, face)
  if (face === 'sweating' || face === 'worried') drawSweat(ctx, face, timeMs)
  if (laughing) drawTears(ctx, timeMs)
  ctx.restore()
}

function drawEyes(ctx: CanvasRenderingContext2D, face: UncleFace): void {
  if (face === 'laugh') {
    // Squeezed shut with laughing.
    for (const side of SIDES) {
      ctx.save()
      ctx.translate(side * 24, -4)
      sketchPath(ctx, LAUGH_EYE, LAUGH_LINE)
      ctx.restore()
    }
    return
  }
  // How open each eye is, and how heavy the lid sits over it.
  const open =
    face === 'flat'
      ? 11
      : face === 'worried' || face === 'sweating'
        ? 9
        : face === 'eyebrow'
          ? 8
          : face === 'smirk'
            ? 4
            : 6
  for (const side of SIDES) {
    const ex = side * 24
    const wide = face === 'twitch' && side === 1 ? 10 : open
    EYE_WHITE.seed = 73 + faceBoil + side
    sketchEllipse(ctx, ex, -6, 11, wide, EYE_WHITE)
    const pupil = wide >= 9 ? 2.5 : 3
    sketchCircle(ctx, ex + (wide >= 9 ? 0 : 2), -4, pupil, PUPIL)
    // Smug half-closed lids, unless the mood has opened his eyes.
    if (wide <= 6) {
      LID.seed = 76 + faceBoil + side
      sketchLine(ctx, ex - 12, -8, ex + 12, -9, LID)
    }
  }
}

function drawBrows(
  ctx: CanvasRenderingContext2D,
  face: UncleFace,
  timeMs: number
): void {
  switch (face) {
    case 'eyebrow':
      sketchLine(ctx, -38, -24, -12, -22, BROW)
      sketchLine(ctx, 12, -40, 38, -48, BROW)
      return
    case 'worried':
    case 'sweating':
      // Inner ends up: worried.
      sketchLine(ctx, -38, -24, -12, -32, BROW)
      sketchLine(ctx, 12, -32, 38, -24, BROW)
      return
    case 'flat':
      sketchLine(ctx, -38, -34, -12, -34, BROW)
      sketchLine(ctx, 12, -34, 38, -34, BROW)
      return
    case 'laugh':
      sketchLine(ctx, -38, -30, -12, -36, BROW)
      sketchLine(ctx, 12, -36, 38, -30, BROW)
      return
    case 'twitch': {
      const jump = timeMs > 0 ? Math.sin(timeMs * 0.09) * 5 - 4 : -4
      sketchLine(ctx, -38, -24, -12, -22, BROW)
      sketchLine(ctx, 12, -32 + jump, 38, -38 + jump, BROW)
      return
    }
    default:
      // Smug and smirking: one brow up.
      sketchLine(ctx, -38, -24, -12, -22, BROW)
      sketchLine(ctx, 12, -30, 38, face === 'smirk' ? -40 : -36, BROW)
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, face: UncleFace): void {
  if (face === 'laugh') sketchEllipse(ctx, 0, 50, 20, 13, MOUTH)
  if (face === 'flat') sketchLine(ctx, -14, 52, 14, 52, LIP)
  const tash =
    face === 'smirk'
      ? TASH.smirk
      : face === 'worried' || face === 'sweating'
        ? TASH.droop
        : face === 'flat'
          ? TASH.flat
          : face === 'laugh'
            ? TASH.laugh
            : TASH.smug
  sketchPath(ctx, tash, MOUSTACHE)
  // His toothpick: jaunty when smug, drooping when worried, dropped in shock, gone in a laugh.
  if (face === 'worried' || face === 'sweating')
    sketchLine(ctx, 12, 52, 40, 66, TOOTHPICK)
  else if (face === 'flat') sketchLine(ctx, 10, 54, 14, 80, TOOTHPICK)
  else if (face !== 'laugh')
    sketchLine(ctx, 12, 50, 46, face === 'smirk' ? 38 : 46, TOOTHPICK)
}

/** Sweat beads on his forehead; the worst of it runs down his temple. */
function drawSweat(
  ctx: CanvasRenderingContext2D,
  face: UncleFace,
  timeMs: number
): void {
  drawDrop(ctx, 44, -30, 1)
  if (face !== 'sweating') return
  drawDrop(ctx, -46, -26, 0.9)
  const run = timeMs > 0 ? ((timeMs / 1400) % 1) * 40 : 10
  drawDrop(ctx, 54, -6 + run, 1.1)
}

function drawDrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size, size)
  sketchEllipse(ctx, 0, 4, 5, 7, DROP)
  ctx.restore()
}

/** Tears of laughter flying off both eyes. */
function drawTears(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const t = timeMs > 0 ? (timeMs / 500) % 1 : 0.5
  for (const side of SIDES) {
    ctx.save()
    ctx.translate(side * (38 + t * 16), -2 + t * t * 30)
    sketchEllipse(ctx, 0, 0, 4, 6, DROP)
    ctx.restore()
  }
}
