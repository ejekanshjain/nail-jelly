import {
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { makeBoil } from './boil'

// The fly and the cat, drawn in whatever units the context is in. Both are small enough
// to draw per frame; nothing here allocates.

const FLY_BODY: SketchStyle = {
  fill: palette.ink,
  width: 1.5,
  wobble: 0.6,
  passes: 1,
  seed: 700
}
const FLY_WING: SketchStyle = {
  fill: 'rgba(208, 235, 255, 0.75)',
  color: palette.inkSoft,
  width: 1.5,
  wobble: 0.5,
  passes: 1,
  seed: 701
}
const FLY_LEG: SketchStyle = { width: 1.5, wobble: 0.3, passes: 1, seed: 702 }
const FLY_SQUASH: SketchStyle = {
  fill: palette.ink,
  width: 1.5,
  wobble: 1.2,
  passes: 1,
  seed: 703
}
const BZZ: SketchTextStyle = { size: 13, color: palette.inkSoft, seed: 704 }
const TRAIL = 'rgba(52, 58, 64, 0.35)'

/** Flies are drawn bigger than life, so you can see one on a phone. */
const FLY_SCALE = 1.9
/** The fly is about this many units long at size 1. */
export const FLY_LENGTH = 26

/**
 * A fly at (x, y): an ink dot with two wings flicking at 12 fps while it flies, a tiny
 * "bzz" beside it. Landed, its wings rest and twitch now and then.
 */
export function drawFly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number,
  flying: boolean,
  size = 1
): void {
  const frame = Math.floor(timeMs / 83)
  const flap = flying ? (frame % 2 === 0 ? 8 : 4) : frame % 24 === 0 ? 6 : 3
  FLY_WING.seed = 701 + (frame % 3)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(FLY_SCALE * size, FLY_SCALE * size)
  sketchEllipse(ctx, -5, -7, 4, flap, FLY_WING)
  sketchEllipse(ctx, 5, -7, 4, flap, FLY_WING)
  if (!flying) {
    sketchLine(ctx, -4, 3, -9, 8, FLY_LEG)
    sketchLine(ctx, 4, 3, 9, 8, FLY_LEG)
  }
  sketchEllipse(ctx, 0, 0, 6.5, 5, FLY_BODY)
  sketchCircle(ctx, 7, -1, 3.5, FLY_BODY)
  if (flying) sketchText(ctx, 'bzz', 18, -14, BZZ)
  ctx.restore()
}

/** Dots left behind by a flying fly: flat points `from` to `to`, oldest first. */
export function drawFlyTrail(
  ctx: CanvasRenderingContext2D,
  points: ArrayLike<number>,
  from: number,
  to: number
): void {
  ctx.fillStyle = TRAIL
  for (let i = from; i < to; i++) {
    const r = 1.5 + ((i - from) / (to - from)) * 2
    ctx.beginPath()
    ctx.arc(points[i * 2]!, points[i * 2 + 1]!, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** A swatted fly, flattened where it was hit. */
export function drawSquashedFly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 1
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(FLY_SCALE * size, FLY_SCALE * size)
  sketchEllipse(ctx, 0, 0, 9, 3.5, FLY_SQUASH)
  sketchLine(ctx, -8, -2, -15, -7, FLY_LEG)
  sketchLine(ctx, 8, -2, 16, -5, FLY_LEG)
  sketchLine(ctx, -3, 2, -7, 8, FLY_LEG)
  ctx.restore()
}

// ---------------------------------------------------------------- The cat

/** How the cat holds itself: sitting, staring, crouched to pounce, mid-leap, hanging, running. */
export type CatPose = 'sit' | 'stare' | 'crouch' | 'leap' | 'hang' | 'run'

/** Per-frame details for the cat drawing. */
export interface CatLook {
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1
  /** Ears flat back: it was shooed, or it is up to no good. */
  earsFlat: boolean
  /** Sideways sway of its rear end, in units, for the butt wiggle. */
  wiggle: number
  /** Body angle in radians for a leap, along the way it flies. */
  tilt: number
  /** Size, 1 for about 80 units tall when sitting. */
  scale: number
}

const FUR: SketchStyle = {
  fill: palette.orange,
  color: palette.ink,
  width: 3,
  seed: 720
}
const STRIPE: SketchStyle = {
  width: 3,
  color: '#c2410c',
  wobble: 0.6,
  passes: 1,
  seed: 721
}
const TAIL_INK: SketchStyle & { smooth: boolean } = {
  width: 10,
  color: palette.ink,
  passes: 1,
  wobble: 0.5,
  smooth: true,
  seed: 722
}
const TAIL_FUR: SketchStyle & { smooth: boolean } = {
  width: 5,
  color: palette.orange,
  passes: 1,
  wobble: 0.5,
  smooth: true,
  seed: 722
}
const EYE: SketchStyle = { fill: palette.ink, width: 0, seed: 723 }
const EYE_WHITE: SketchStyle = {
  fill: '#fff9db',
  width: 2,
  passes: 1,
  seed: 724
}
const PUPIL: SketchStyle = { width: 2.5, wobble: 0.2, passes: 1, seed: 725 }
const WHISKER: SketchStyle = {
  width: 1.5,
  color: palette.inkSoft,
  wobble: 0.4,
  passes: 1,
  seed: 726
}
const LEG: SketchStyle = {
  width: 6,
  color: palette.orange,
  passes: 1,
  wobble: 0.4,
  seed: 727
}
const SPEED: SketchStyle = {
  width: 2.5,
  color: palette.inkSoft,
  passes: 1,
  wobble: 0.8,
  seed: 728
}
const TRI = new Float64Array(6)
const TAIL = new Float64Array(8)
const boilCat = makeBoil([
  FUR,
  STRIPE,
  TAIL_INK,
  TAIL_FUR,
  EYE_WHITE,
  PUPIL,
  WHISKER,
  LEG
])

function tri(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): void {
  TRI[0] = ax
  TRI[1] = ay
  TRI[2] = bx
  TRI[3] = by
  TRI[4] = cx
  TRI[5] = cy
  sketchPolygon(ctx, TRI, FUR)
}

function tail(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
): void {
  TAIL[0] = x0
  TAIL[1] = y0
  TAIL[2] = x1
  TAIL[3] = y1
  TAIL[4] = x2
  TAIL[5] = y2
  TAIL[6] = x3
  TAIL[7] = y3
  sketchPath(ctx, TAIL, TAIL_INK)
  sketchPath(ctx, TAIL, TAIL_FUR)
}

/** A head at (x, y) facing right: ears, eyes, nose and whiskers. */
function head(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  look: CatLook,
  stare: boolean
): void {
  if (look.earsFlat) {
    tri(ctx, x - r * 0.4, y - r * 0.7, x - r * 1.5, y - r * 0.9, x, y - r)
    tri(
      ctx,
      x + r * 0.3,
      y - r * 0.95,
      x - r * 0.6,
      y - r * 1.25,
      x + r * 0.8,
      y - r * 0.7
    )
  } else {
    tri(
      ctx,
      x - r * 0.75,
      y - r * 0.5,
      x - r * 0.55,
      y - r * 1.55,
      x + r * 0.05,
      y - r * 0.85
    )
    tri(
      ctx,
      x + r * 0.1,
      y - r * 0.9,
      x + r * 0.65,
      y - r * 1.6,
      x + r * 0.95,
      y - r * 0.45
    )
  }
  sketchCircle(ctx, x, y, r, FUR)
  const ex = x + r * 0.25
  const ey = y - r * 0.15
  if (stare || look.earsFlat) {
    sketchCircle(ctx, ex - r * 0.35, ey, r * 0.3, EYE_WHITE)
    sketchCircle(ctx, ex + r * 0.35, ey, r * 0.3, EYE_WHITE)
    sketchLine(
      ctx,
      ex - r * 0.35,
      ey - r * 0.2,
      ex - r * 0.35,
      ey + r * 0.2,
      PUPIL
    )
    sketchLine(
      ctx,
      ex + r * 0.35,
      ey - r * 0.2,
      ex + r * 0.35,
      ey + r * 0.2,
      PUPIL
    )
  } else {
    sketchCircle(ctx, ex - r * 0.35, ey, r * 0.13, EYE)
    sketchCircle(ctx, ex + r * 0.35, ey, r * 0.13, EYE)
  }
  sketchCircle(ctx, x + r * 0.55, y + r * 0.25, r * 0.1, EYE)
  sketchLine(ctx, x + r * 0.7, y + r * 0.3, x + r * 1.7, y + r * 0.1, WHISKER)
  sketchLine(ctx, x + r * 0.7, y + r * 0.42, x + r * 1.7, y + r * 0.6, WHISKER)
}

/**
 * The cat: an orange blob with triangle ears and a squiggle tail. (x, y) is the ground
 * under its feet, or its front paws while it hangs from a block.
 */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: CatPose,
  timeMs: number,
  look: CatLook
): void {
  const swish = Math.sin(timeMs * 0.006)
  boilCat(timeMs)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(look.facing * look.scale, look.scale)
  switch (pose) {
    case 'sit':
    case 'stare':
      tail(ctx, -16, -6, -34, -4, -42 + swish * 4, -18, -36 + swish * 8, -32)
      sketchEllipse(ctx, 0, -24, 19, 24, FUR)
      sketchLine(ctx, -12, -36, -4, -31, STRIPE)
      sketchLine(ctx, -15, -25, -6, -21, STRIPE)
      sketchLine(ctx, 8, -12, 8, -1, LEG)
      sketchLine(ctx, 15, -12, 15, -1, LEG)
      head(ctx, 8, -54, 15, look, pose === 'stare')
      break
    case 'crouch': {
      const w = look.wiggle
      tail(
        ctx,
        -30 + w,
        -26,
        -40 + w,
        -42,
        -34 + w * 1.5 + swish * 4,
        -54,
        -42 + w * 2,
        -64
      )
      sketchCircle(ctx, -20 + w, -22, 14, FUR)
      sketchEllipse(ctx, 2 + w * 0.3, -14, 26, 13, FUR)
      sketchLine(ctx, -10 + w * 0.5, -22, -2, -18, STRIPE)
      sketchEllipse(ctx, 24, -2, 7, 3.5, FUR)
      sketchEllipse(ctx, -16 + w, -2, 8, 4, FUR)
      head(ctx, 28, -18, 14, look, true)
      break
    }
    case 'leap':
      ctx.rotate(look.tilt)
      tail(ctx, -30, -14, -46, -14, -58, -8 + swish * 4, -70, -12)
      sketchLine(ctx, -24, -8, -40, 2, LEG)
      sketchEllipse(ctx, 0, -14, 32, 12, FUR)
      sketchLine(ctx, -6, -24, 2, -16, STRIPE)
      sketchLine(ctx, 22, -12, 46, -18, LEG)
      head(ctx, 32, -20, 14, look, true)
      break
    case 'hang': {
      const sway = swish * 6
      tail(ctx, 6, 66, 16 + sway, 82, 8 + sway * 1.5, 98, 16 + sway * 2, 112)
      sketchEllipse(ctx, sway * 0.3, 48, 17, 26, FUR)
      sketchLine(ctx, -10 + sway * 0.3, 40, 6, 44, STRIPE)
      sketchLine(ctx, -8 + sway * 0.4, 70, -10 + sway * 0.6, 84, LEG)
      sketchLine(ctx, 8 + sway * 0.4, 70, 10 + sway * 0.6, 84, LEG)
      sketchLine(ctx, -9, 0, -9, 18, LEG)
      sketchLine(ctx, 9, 0, 9, 18, LEG)
      sketchEllipse(ctx, -9, 0, 6, 4, FUR)
      sketchEllipse(ctx, 9, 0, 6, 4, FUR)
      head(ctx, -2, 22, 14, look, true)
      break
    }
    case 'run': {
      const step = Math.floor(timeMs / 80) % 2 === 0 ? 1 : -1
      sketchLine(ctx, -44, -24, -64, -24, SPEED)
      sketchLine(ctx, -40, -12, -58, -12, SPEED)
      tail(ctx, -26, -22, -40, -30, -50, -36 + swish * 3, -60, -44)
      sketchLine(ctx, -16, -10, -16 - step * 10, 0, LEG)
      sketchLine(ctx, 16, -10, 16 + step * 10, 0, LEG)
      sketchEllipse(ctx, 0, -18, 28, 11, FUR)
      sketchLine(ctx, -8, -27, 0, -20, STRIPE)
      head(ctx, 30, -24, 13, look, false)
      break
    }
  }
  ctx.restore()
}

const PAW: SketchStyle = { width: 0, passes: 1, wobble: 0.5, seed: 730 }

/** A cat's paw print in jelly: a pad and three toes, fading with `alpha`. */
export function drawPawPrint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  alpha: number
): void {
  if (alpha <= 0) return
  const previous = ctx.globalAlpha
  ctx.globalAlpha = previous * alpha * 0.85
  PAW.fill = colour
  PAW.seed = 730 + Math.round(x)
  sketchEllipse(ctx, x, y, 9, 7, PAW)
  sketchCircle(ctx, x - 9, y - 9, 3.5, PAW)
  sketchCircle(ctx, x, y - 12, 3.5, PAW)
  sketchCircle(ctx, x + 9, y - 9, 3.5, PAW)
  ctx.globalAlpha = previous
}
