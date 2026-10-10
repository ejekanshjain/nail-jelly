import type { UncleFace } from '../../game/uncle'
import {
  palette,
  sketchArrow,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { makeBoil } from './boil'
import { drawUncleFace } from './uncle'

// The final test's props, drawn in whatever units the context is in: the uncle in full,
// his deckchair and stopwatch, the return gags, peeling cling film and the arrows that
// point at red blocks. Nothing here allocates per frame.

/** How the uncle stands or sits. */
export type UnclePose = 'stand' | 'walk' | 'sit' | 'laugh'

export interface UncleLook {
  pose: UnclePose
  /** His expression. */
  face: UncleFace
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1
  /** Holding the stopwatch up in front of him. */
  watch: boolean
  /** Walk cycle and bob time. */
  timeMs: number
}

const BODY: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  width: 3,
  seed: 820
}
const BODY_FILL: SketchStyle = { fill: '#b07b4a', width: 0, seed: 821 }
const BUTTON: SketchStyle = { fill: palette.yellow, width: 2, seed: 822 }
const LEG: SketchStyle = { width: 18, color: '#5c4b3a', seed: 823, passes: 1 }
const SHOE: SketchStyle = { fill: palette.ink, width: 2, seed: 824 }
const ARM: SketchStyle = { width: 24, color: palette.brown, seed: 825 }
const HAND: SketchStyle = { fill: '#f4c7a1', width: 3, seed: 826 }
const WATCH: SketchStyle = { fill: '#e9ecef', width: 3, seed: 827 }
const WATCH_BUTTON: SketchStyle = { fill: palette.inkSoft, width: 2, seed: 828 }
const WATCH_HAND: SketchStyle = {
  width: 3,
  color: palette.red,
  passes: 1,
  seed: 829
}
const boilFigure = makeBoil([BODY, BODY_FILL, BUTTON, LEG, SHOE, ARM, HAND])
/** A pear of a cardigan, feet at (0, 0), in local units. */
const BODY_POINTS = [
  -78, -280, 78, -280, 112, -200, 126, -110, 104, -24, 0, -4, -104, -24, -126,
  -110, -112, -200
]

/**
 * The uncle in full at (x, footY), `scale` times his cold-open size: pear-shaped body,
 * flat cap, moustache, and his stopwatch when `look.watch` is set.
 */
export function drawUncleFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  scale: number,
  look: UncleLook
): void {
  const t = look.timeMs
  boilFigure(t)
  const sitting = look.pose === 'sit'
  const walking = look.pose === 'walk'
  const laughing = look.pose === 'laugh'
  const bob = walking
    ? Math.abs(Math.sin(t * 0.012)) * -10
    : laughing
      ? Math.abs(Math.sin(t * 0.03)) * -8
      : 0
  ctx.save()
  ctx.translate(x, footY)
  ctx.scale(scale * look.facing, scale)
  // Legs: knees up on the deckchair, swinging while he walks.
  if (sitting) {
    sketchLine(ctx, -10, -100, 90, -120, LEG)
    sketchLine(ctx, 90, -120, 110, -10, LEG)
    sketchLine(ctx, 20, -90, 130, -100, LEG)
    sketchLine(ctx, 130, -100, 150, 0, LEG)
    sketchEllipse(ctx, 124, 0, 26, 12, SHOE)
    sketchEllipse(ctx, 164, 4, 26, 12, SHOE)
  } else {
    const swing = walking ? Math.sin(t * 0.012) * 26 : 0
    sketchLine(ctx, -34, -40, -34 + swing, 0, LEG)
    sketchLine(ctx, 34, -40, 34 - swing, 0, LEG)
    sketchEllipse(ctx, -24 + swing, 2, 26, 12, SHOE)
    sketchEllipse(ctx, 44 - swing, 2, 26, 12, SHOE)
  }
  ctx.translate(0, (sitting ? -40 : -20) + bob)
  // Sitting, he leans back into the deckchair.
  if (sitting) ctx.rotate(-0.32)
  sketchBlob(ctx, BODY_POINTS, BODY_FILL)
  sketchBlob(ctx, BODY_POINTS, BODY)
  for (let i = 0; i < 4; i++) sketchCircle(ctx, 0, -230 + i * 52, 6, BUTTON)
  // The arm with the stopwatch, held up to his eyes or down at his side.
  if (look.watch) {
    sketchLine(ctx, 80, -220, 150, -300, ARM)
    sketchCircle(ctx, 156, -310, 16, HAND)
    drawStopwatch(ctx, 170, -344, 30, t)
  } else {
    const wave = laughing ? Math.sin(t * 0.03) * 20 : 0
    sketchLine(ctx, 96, -210, 130, -110 + wave, ARM)
    sketchCircle(ctx, 134, -100 + wave, 16, HAND)
  }
  ctx.translate(0, -360)
  ctx.scale(0.85, 0.85)
  drawUncleFace(ctx, 0, 0, look.face, t)
  ctx.restore()
}

/** A stopwatch centred at (x, y) with radius `r`; its hand sweeps with `timeMs`. */
export function drawStopwatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  timeMs: number
): void {
  sketchRect(ctx, x - r * 0.18, y - r * 1.35, r * 0.36, r * 0.3, WATCH_BUTTON)
  sketchCircle(ctx, x, y, r, WATCH)
  const a = (timeMs / 1000) * Math.PI * 2 * 0.25 - Math.PI / 2
  sketchLine(
    ctx,
    x,
    y,
    x + Math.cos(a) * r * 0.75,
    y + Math.sin(a) * r * 0.75,
    WATCH_HAND
  )
}

const CHAIR_WOOD: SketchStyle = { width: 9, color: palette.brown, seed: 830 }
const CHAIR_CLOTH: SketchStyle = {
  fill: '#fff5f5',
  width: 3,
  color: '#c92a2a',
  seed: 831
}
const CHAIR_STRIPE: SketchStyle = {
  width: 14,
  color: palette.red,
  passes: 1,
  seed: 833
}
const CHAIR_POINTS = new Float64Array(8)
/**
 * Deckchair key points (x, y pairs, local units) folded flat and set up: the back's top,
 * the rear foot, the front foot, the seat's front edge and the seat's back.
 */
const CHAIR_FOLDED = [-30, -300, 10, 0, -14, -4, 18, -292, -20, -230]
const CHAIR_OPEN = [-230, -330, 40, 0, -110, 0, 110, -130, -70, -60]
const CHAIR = new Float64Array(10)

/**
 * The striped deckchair at (x, footY), `open` from 0 (folded flat at his side) to 1
 * (set up, facing right). Local units match the uncle figure's. Draw `back` before the
 * uncle and `front`, the near side's frame, after him, so he sits in it.
 */
export function drawDeckchair(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  scale: number,
  open: number,
  part: 'back' | 'front' = 'back'
): void {
  for (let i = 0; i < CHAIR.length; i++)
    CHAIR[i] = CHAIR_FOLDED[i]! + (CHAIR_OPEN[i]! - CHAIR_FOLDED[i]!) * open
  ctx.save()
  ctx.translate(x, footY)
  ctx.scale(scale, scale)
  if (part === 'front') {
    // The near side: the long bar from the back to the rear foot, and the front bar.
    sketchLine(ctx, CHAIR[0]!, CHAIR[1]!, CHAIR[2]!, CHAIR[3]!, CHAIR_WOOD)
    sketchLine(ctx, CHAIR[4]!, CHAIR[5]!, CHAIR[6]!, CHAIR[7]!, CHAIR_WOOD)
    ctx.restore()
    return
  }
  // The sling of striped cloth from the top of the back to the front of the seat.
  CHAIR_POINTS[0] = CHAIR[0]!
  CHAIR_POINTS[1] = CHAIR[1]!
  CHAIR_POINTS[2] = CHAIR[6]!
  CHAIR_POINTS[3] = CHAIR[7]!
  CHAIR_POINTS[4] = CHAIR[8]!
  CHAIR_POINTS[5] = CHAIR[9]!
  CHAIR_POINTS[6] = CHAIR[0]! + 34 * open + 16
  CHAIR_POINTS[7] = CHAIR[1]! + 50 * open
  sketchPolygon(ctx, CHAIR_POINTS, CHAIR_CLOTH)
  // Bold stripes down the sling's length, from its top edge to the seat's.
  const p = CHAIR_POINTS
  for (let k = 0.2; k < 1; k += 0.3) {
    CHAIR_STRIPE.seed = 833 + Math.round(k * 10)
    sketchLine(
      ctx,
      p[0]! + (p[6]! - p[0]!) * k,
      p[1]! + (p[7]! - p[1]!) * k,
      p[4]! + (p[2]! - p[4]!) * k,
      p[5]! + (p[3]! - p[5]!) * k,
      CHAIR_STRIPE
    )
  }
  // The far side's frame peeks out behind.
  sketchLine(
    ctx,
    CHAIR[0]! + 18,
    CHAIR[1]!,
    CHAIR[2]! + 18,
    CHAIR[3]!,
    CHAIR_WOOD
  )
  ctx.restore()
}

const CRISPS: SketchStyle = { fill: palette.yellow, width: 3, seed: 840 }
const CRISPS_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 13,
  color: palette.red,
  rotate: -0.2
}

/** A crisp packet standing at (x, footY): the uncle brought snacks. */
export function drawCrisps(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number
): void {
  sketchRoundRect(ctx, x - 18, footY - 46, 36, 46, 6, CRISPS)
  sketchText(ctx, 'CRISPS', x, footY - 24, CRISPS_TEXT)
}

const TRIPOD: SketchStyle = { width: 4, color: palette.inkSoft, seed: 850 }
const CAMERA: SketchStyle = { fill: palette.ink, width: 3, seed: 851 }
const LENS: SketchStyle = { fill: palette.blue, width: 3, seed: 852 }
const REC: SketchStyle = { fill: palette.red, width: 0, seed: 853 }
const REC_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 15,
  color: palette.red
}

/** A film camera on a tripod at (x, footY), with a blinking REC light. */
export function drawCameraCrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  timeMs: number
): void {
  sketchLine(ctx, x, footY - 70, x - 26, footY, TRIPOD)
  sketchLine(ctx, x, footY - 70, x + 26, footY, TRIPOD)
  sketchLine(ctx, x, footY - 70, x, footY, TRIPOD)
  sketchRoundRect(ctx, x - 34, footY - 112, 62, 42, 6, CAMERA)
  sketchCircle(ctx, x - 44, footY - 91, 12, LENS)
  sketchCircle(ctx, x + 6, footY - 128, 16, CAMERA)
  sketchCircle(ctx, x - 20, footY - 128, 16, CAMERA)
  if (Math.floor(timeMs / 500) % 2 === 0) {
    sketchCircle(ctx, x + 18, footY - 102, 5, REC)
    sketchText(ctx, 'REC', x + 18, footY - 148, REC_TEXT)
  }
}

const FILM: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.6)',
  fillStyle: 'hatch',
  hatchGap: 9,
  hatchAngle: 0.7,
  color: 'rgba(255, 255, 255, 0.95)',
  width: 3,
  seed: 860
}

/**
 * Cling film coming off a section: the sheet at (x, y, width, height) curls down and
 * fades as `t` runs from 0 to 1.
 */
export function drawPeelingFilm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  t: number
): void {
  if (t >= 1) return
  ctx.save()
  ctx.globalAlpha *= 1 - t
  const drop = t * t * height * 0.9
  const squash = 1 - 0.7 * t
  FILM.seed = 860 + Math.floor(t * 6)
  sketchRect(
    ctx,
    x + width * 0.1 * t,
    y + drop,
    width * (1 - 0.2 * t),
    height * squash,
    FILM
  )
  ctx.restore()
}

const RED_ARROW: SketchStyle & { head: number } = {
  width: 6,
  color: palette.red,
  head: 22,
  seed: 870
}

/** A red arrow at (x, y) pointing along (dx, dy), towards a red block off screen. */
export function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  pulse: number
): void {
  const len = Math.hypot(dx, dy) || 1
  const k = (34 + 6 * pulse) / len
  RED_ARROW.seed = 870 + Math.round(x + y)
  sketchArrow(ctx, x - dx * k, y - dy * k, x, y, RED_ARROW)
}

const RED_RING: SketchStyle = {
  width: 5,
  color: palette.red,
  wobble: 2,
  passes: 1,
  seed: 880
}

/** A pulsing red ring around a block in danger, centred at (x, y). */
export function drawDangerRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pulse: number,
  seed: number
): void {
  ctx.save()
  ctx.globalAlpha *= 0.35 + 0.5 * pulse
  RED_RING.seed = 880 + seed
  sketchEllipse(ctx, x, y, 66 + 6 * pulse, 50 + 5 * pulse, RED_RING)
  ctx.restore()
}

const KEY_RING: SketchStyle = { width: 4, color: palette.inkSoft, seed: 890 }
const KEY: SketchStyle = { fill: '#adb5bd', width: 2.5, seed: 891 }
const FOB: SketchStyle = { fill: palette.red, width: 2.5, seed: 892 }

/** His car keys at (x, y), turned by `angle` and `scale`d: a ring, a key and a red fob. */
export function drawCarKeys(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale = 1
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)
  sketchCircle(ctx, 0, 0, 12, KEY_RING)
  sketchRect(ctx, -5, 10, 10, 30, KEY)
  sketchRect(ctx, 5, 28, 8, 5, KEY)
  sketchRoundRect(ctx, 8, -6, 30, 18, 6, FOB)
  ctx.restore()
}
