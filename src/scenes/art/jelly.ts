import {
  BLOCK_COLS,
  BLOCK_ROWS,
  PARTICLE_RADIUS,
  PARTICLE_SPACING
} from '../../game/tuning'
import type { QualityWord } from '../../game/quality'
import type { Flavour, SplatColour } from '../../game/types'
import {
  hash01,
  palette,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRoundRect,
  type SketchStyle
} from '../../shared'

/** Fill colour (red, green, blue, alpha) and outline for each flavour. */
const FLAVOUR_BASE: Record<
  Flavour,
  { rgba: readonly [number, number, number, number]; line: string }
> = {
  strawberry: { rgba: [255, 107, 107, 0.82], line: palette.red },
  lime: { rgba: [105, 219, 124, 0.82], line: palette.green },
  blueberry: { rgba: [116, 143, 252, 0.82], line: palette.blue },
  orange: { rgba: [255, 169, 77, 0.85], line: '#d9480f' },
  grape: { rgba: [177, 151, 252, 0.82], line: palette.purple },
  recycled: { rgba: [141, 110, 80, 0.85], line: palette.inkSoft }
}

const FLAVOURS = Object.keys(FLAVOUR_BASE) as Flavour[]

/** Ink for the quality words on the stool, the moulds and the shelf. */
export const QUALITY_COLOURS: Record<QualityWord, string> = {
  Firm: palette.green,
  Wobbly: '#d9480f',
  Sloppy: palette.red
}

/** Cloudiness steps from clear to fully cloudy, so styles are built once. */
const CLOUD_STEPS = 4

/** A flavour's fill, blended towards white by `t` (0 to 0.5) and a little more opaque. */
function fillFor(flavour: Flavour, t: number): string {
  const [r, g, b, a] = FLAVOUR_BASE[flavour].rgba
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  const alpha = a + (0.95 - a) * t * 2
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha.toFixed(2)})`
}

/** Fill and outline for each flavour. Fills sit at about 0.82 alpha so the wall shows through. */
export const FLAVOUR_COLOURS: Record<Flavour, { fill: string; line: string }> =
  Object.fromEntries(
    FLAVOURS.map(f => [f, { fill: fillFor(f, 0), line: FLAVOUR_BASE[f].line }])
  ) as Record<Flavour, { fill: string; line: string }>

// Styles hoisted per flavour and cloud step so drawing never allocates; only `seed` and
// `passes` change.
const STYLES = Object.fromEntries(
  FLAVOURS.map(f => [
    f,
    Array.from({ length: CLOUD_STEPS + 1 }, (_, step): SketchStyle => ({
      fill: fillFor(f, (0.5 * step) / CLOUD_STEPS),
      color: FLAVOUR_BASE[f].line,
      width: 3,
      seed: 1,
      passes: 2
    }))
  ])
) as Record<Flavour, SketchStyle[]>

function cloudStep(cloud: number): number {
  return Math.round(Math.min(1, Math.max(0, cloud)) * CLOUD_STEPS)
}

/** Fill and outline for floor splats: every flavour, plus soapy suds from the sink. */
export const SPLAT_COLOURS: Record<
  SplatColour,
  { fill: string; line: string }
> = {
  ...FLAVOUR_COLOURS,
  suds: { fill: 'rgba(231, 245, 255, 0.92)', line: '#74c0fc' }
}

/** The fill of a flavour at a cloudiness from 0 (clear) to 1 (half white). */
export function jellyFill(flavour: Flavour, cloud = 0): string {
  return STYLES[flavour][cloudStep(cloud)]!.fill!
}

const SHINE: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.65)',
  width: 0,
  seed: 2
}

/** One outline piece as `SoftBody.outline` or a lock snapshot gives it. */
export interface JellyPiece {
  points: ArrayLike<number>
  count: number
  particles: number
  centerX: number
  centerY: number
}

/** Draws every piece of a block. Big pieces get a shine. */
export function drawJellyPieces(
  ctx: CanvasRenderingContext2D,
  pieces: readonly JellyPiece[],
  flavour: Flavour,
  seed: number,
  passes: 1 | 2 = 2,
  cloud = 0
): void {
  const style = STYLES[flavour][cloudStep(cloud)]!
  style.passes = passes
  let s = seed
  for (const piece of pieces) {
    style.seed = s++
    sketchBlob(ctx, piece.points, style, piece.count)
    if (piece.particles >= 6) {
      const size = Math.sqrt(piece.particles / 12)
      SHINE.seed = s
      sketchEllipse(
        ctx,
        piece.centerX - 24 * size,
        piece.centerY - 14 * size,
        12 * size,
        6 * size,
        SHINE
      )
    }
  }
}

/** Particles the lumps sit on, spread over the 4 x 3 grid, most central first. */
const LUMP_PARTICLES = [5, 10, 2, 7, 4, 9, 1, 11] as const
/** Particles the specks of recycled jelly sit on. */
const SPECK_PARTICLES = [0, 6, 3, 8, 5, 11, 9] as const
const LUMP_STYLES = Object.fromEntries(
  FLAVOURS.map(f => {
    const [r, g, b] = FLAVOUR_BASE[f].rgba
    const dark = (c: number) => Math.round(c * 0.72)
    return [
      f,
      {
        fill: `rgba(${dark(r)}, ${dark(g)}, ${dark(b)}, 0.7)`,
        color: FLAVOUR_BASE[f].line,
        width: 1.5,
        wobble: 1,
        passes: 1,
        seed: 1
      } satisfies SketchStyle
    ]
  })
) as Record<Flavour, SketchStyle>

/**
 * Lumps from an uneven stir, and specks in recycled jelly, inside one block. Each sits on
 * a particle with a small fixed offset, so it moves with the jelly. `positions` holds the
 * 12 particle positions as flat points; `size` scales them for small ghosts.
 */
export function drawInnards(
  ctx: CanvasRenderingContext2D,
  positions: ArrayLike<number>,
  lumps: number,
  flavour: Flavour,
  seed: number,
  size = 1
): void {
  const style = LUMP_STYLES[flavour]
  const count = Math.min(lumps, LUMP_PARTICLES.length)
  for (let i = 0; i < count; i++) {
    const p = LUMP_PARTICLES[i]!
    const x = positions[p * 2]! + (hash01(seed, i * 3) - 0.5) * 12 * size
    const y =
      positions[p * 2 + 1]! + (hash01(seed, i * 3 + 1) - 0.5) * 10 * size
    style.seed = seed + i
    sketchCircle(ctx, x, y, (3.2 + 2.6 * hash01(seed, i * 3 + 2)) * size, style)
  }
  if (flavour !== 'recycled') return
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  for (let i = 0; i < SPECK_PARTICLES.length; i++) {
    const p = SPECK_PARTICLES[i]!
    const x = positions[p * 2]! + (hash01(seed, 40 + i) - 0.5) * 14 * size
    const y = positions[p * 2 + 1]! + (hash01(seed, 60 + i) - 0.5) * 12 * size
    ctx.moveTo(x + 1.8 * size, y)
    ctx.arc(x, y, 1.8 * size, 0, Math.PI * 2)
  }
  ctx.fill()
}

const MESH_LINE = 'rgba(52, 58, 64, 0.5)'
const NOODLE_EDGE = '#d9a400'
const NOODLE_FILL = '#ffe066'
/** Each noodle draws twice: a darker edge, then the pale middle. */
const NOODLE_STROKES = [
  [NOODLE_EDGE, 5.5],
  [NOODLE_FILL, 3.2]
] as const
/** Mesh and noodle lines skip gaps wider than this, where torn pieces drifted apart. */
const REINFORCE_GAP = PARTICLE_SPACING * 2

/** Particle `col`, `row` of a flat 4 x 3 position list. */
function px(positions: ArrayLike<number>, row: number, col: number): number {
  return positions[(row * BLOCK_COLS + col) * 2]!
}
function py(positions: ArrayLike<number>, row: number, col: number): number {
  return positions[(row * BLOCK_COLS + col) * 2 + 1]!
}

/**
 * Upgrades inside the jelly. Mesh backing shows as a grid through the particles, with
 * gaps and frayed ends when the sheet was cut ragged; noodles show as two wavy lines.
 * Both move with the jelly. `size` scales line widths for small ghosts.
 */
export function drawReinforcement(
  ctx: CanvasRenderingContext2D,
  positions: ArrayLike<number>,
  mesh: number,
  noodles: boolean,
  seed: number,
  size = 1
): void {
  if (mesh > 0) drawMesh(ctx, positions, mesh < 1, seed, size)
  if (noodles) drawNoodles(ctx, positions, size)
}

function drawMesh(
  ctx: CanvasRenderingContext2D,
  positions: ArrayLike<number>,
  ragged: boolean,
  seed: number,
  size: number
): void {
  const gap = REINFORCE_GAP * size
  ctx.strokeStyle = MESH_LINE
  ctx.lineWidth = 1.6 * size
  ctx.beginPath()
  let k = 0
  // Each row, with a little overhang past the outer particles.
  for (let row = 0; row < BLOCK_ROWS; row++) {
    const lx = px(positions, row, 0)
    const ly = py(positions, row, 0)
    meshLine(
      ctx,
      lx,
      ly,
      lx + (lx - px(positions, row, 1)) * 0.4,
      ly + (ly - py(positions, row, 1)) * 0.4,
      gap,
      ragged,
      seed,
      k++
    )
    for (let col = 0; col < BLOCK_COLS - 1; col++)
      meshLine(
        ctx,
        px(positions, row, col),
        py(positions, row, col),
        px(positions, row, col + 1),
        py(positions, row, col + 1),
        gap,
        ragged,
        seed,
        k++
      )
    const last = BLOCK_COLS - 1
    const rx = px(positions, row, last)
    const ry = py(positions, row, last)
    meshLine(
      ctx,
      rx,
      ry,
      rx + (rx - px(positions, row, last - 1)) * 0.4,
      ry + (ry - py(positions, row, last - 1)) * 0.4,
      gap,
      ragged,
      seed,
      k++
    )
  }
  // Each column.
  for (let col = 0; col < BLOCK_COLS; col++)
    for (let row = 0; row < BLOCK_ROWS - 1; row++)
      meshLine(
        ctx,
        px(positions, row, col),
        py(positions, row, col),
        px(positions, row + 1, col),
        py(positions, row + 1, col),
        gap,
        ragged,
        seed,
        k++
      )
  ctx.stroke()
}

/**
 * One strand of mesh, added to the current path. It skips gaps wider than `gap`, where
 * torn pieces drifted apart, and a ragged sheet loses about a third of its strands.
 */
function meshLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  gap: number,
  ragged: boolean,
  seed: number,
  index: number
): void {
  if (Math.hypot(bx - ax, by - ay) > gap) return
  if (ragged && hash01(seed, index) < 0.3) return
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
}

function drawNoodles(
  ctx: CanvasRenderingContext2D,
  positions: ArrayLike<number>,
  size: number
): void {
  const gap = REINFORCE_GAP * size
  ctx.lineCap = 'round'
  for (const [colour, width] of NOODLE_STROKES) {
    ctx.strokeStyle = colour
    ctx.lineWidth = width * size
    ctx.beginPath()
    for (let n = 0; n < BLOCK_ROWS - 1; n++) {
      // A noodle wiggles between rows n and n + 1, from one side to the other.
      let lastX = 0
      let lastY = 0
      for (let col = 0; col < BLOCK_COLS; col++) {
        const x = (px(positions, n, col) + px(positions, n + 1, col)) / 2
        const y =
          (py(positions, n, col) + py(positions, n + 1, col)) / 2 +
          (col % 2 === n % 2 ? -4 : 4) * size
        if (col === 0 || Math.hypot(x - lastX, y - lastY) > gap)
          ctx.moveTo(x, y)
        else
          ctx.quadraticCurveTo(
            (lastX + x) / 2,
            (lastY + y) / 2 + (col % 2 ? 6 : -6) * size,
            x,
            y
          )
        lastX = x
        lastY = y
      }
    }
    ctx.stroke()
  }
}

/** Size of a whole block's outline at full scale, for ghosts on the stool and in your hand. */
export const GHOST_W = (BLOCK_COLS - 1) * PARTICLE_SPACING + 2 * PARTICLE_RADIUS
export const GHOST_H = (BLOCK_ROWS - 1) * PARTICLE_SPACING + 2 * PARTICLE_RADIUS

const GHOST: SketchStyle = { width: 3, seed: 1 }
const GRID = new Float64Array(BLOCK_COLS * BLOCK_ROWS * 2)

/**
 * A block that isn't on the wall yet, as a rounded box with its cloud and lumps, and its
 * mesh and noodles when it has them.
 */
export function drawGhostBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  flavour: Flavour,
  cloud: number,
  lumps: number,
  seed: number,
  mesh = 0,
  noodles = false
): void {
  const w = GHOST_W * scale
  const h = GHOST_H * scale
  GHOST.fill = jellyFill(flavour, cloud)
  GHOST.color = FLAVOUR_BASE[flavour].line
  GHOST.seed = seed
  sketchRoundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.3, GHOST)
  const step = PARTICLE_SPACING * scale
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const i = (row * BLOCK_COLS + col) * 2
      GRID[i] = cx + (col - (BLOCK_COLS - 1) / 2) * step
      GRID[i + 1] = cy + (row - (BLOCK_ROWS - 1) / 2) * step
    }
  drawInnards(ctx, GRID, lumps, flavour, seed, scale)
  drawReinforcement(ctx, GRID, mesh, noodles, seed, scale)
}

export type FaceMood = 'calm' | 'happy' | 'worried' | 'scared' | 'falling'

const FACE_LINE: SketchStyle = { width: 2.5, wobble: 0.6, passes: 1, seed: 4 }
const EYE_FILL: SketchStyle = {
  fill: palette.ink,
  width: 0,
  wobble: 0.3,
  seed: 5
}
const EYE_WHITE: SketchStyle = {
  fill: '#ffffff',
  width: 2,
  wobble: 0.5,
  passes: 1,
  seed: 6
}
const SWEAT: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.9)',
  color: palette.blue,
  width: 1.5,
  wobble: 0.4,
  passes: 1,
  seed: 7
}
/** Two drops of sweat sliding down a hot block's face, centred on (x, y). */
export function drawSweat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number,
  seed: number
): void {
  for (let i = 0; i < 2; i++) {
    const t = (timeMs / 1100 + seed * 0.37 + i * 0.5) % 1
    const side = i === 0 ? -1 : 1
    sketchEllipse(ctx, x + side * 30, y - 16 + t * 34, 3, 4.5, SWEAT)
  }
}

const SMILE = new Float64Array(6)
const ARC = new Float64Array(6)

/** Two eyes and a mouth that react to how the block is doing. */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mood: FaceMood,
  seed: number
): void {
  FACE_LINE.seed = seed
  const ex = 13
  const ey = y - 4
  if (mood === 'happy') {
    for (const side of [-1, 1]) {
      ARC[0] = x + side * ex - 5
      ARC[1] = ey + 1
      ARC[2] = x + side * ex
      ARC[3] = ey - 4
      ARC[4] = x + side * ex + 5
      ARC[5] = ey + 1
      sketchPath(ctx, ARC, FACE_LINE)
    }
  } else if (mood === 'falling') {
    // Squeezed shut: > < with the points facing the middle.
    for (const side of [-1, 1]) {
      const tip = x + side * ex - 4 * side
      const open = x + side * ex + 4 * side
      sketchLine(ctx, open, ey - 4, tip, ey, FACE_LINE)
      sketchLine(ctx, tip, ey, open, ey + 4, FACE_LINE)
    }
  } else if (mood === 'calm') {
    sketchCircle(ctx, x - ex, ey, 3.2, EYE_FILL)
    sketchCircle(ctx, x + ex, ey, 3.2, EYE_FILL)
  } else {
    const r = mood === 'scared' ? 7 : 5.5
    for (const side of [-1, 1]) {
      sketchCircle(ctx, x + side * ex, ey, r, EYE_WHITE)
      sketchCircle(ctx, x + side * ex, ey + 1, 2.4, EYE_FILL)
    }
    if (mood === 'scared') sketchEllipse(ctx, x + 26, y - 14, 3.5, 5.5, SWEAT)
  }
  // Mouth: a smile when calm or happy, a wobbly line when worried, an O when scared or falling.
  if (mood === 'scared' || mood === 'falling') {
    sketchEllipse(ctx, x, y + 9, 4, 5, FACE_LINE)
  } else {
    const curve = mood === 'worried' ? -3 : 4
    SMILE[0] = x - 7
    SMILE[1] = y + 8
    SMILE[2] = x
    SMILE[3] = y + 8 + curve
    SMILE[4] = x + 7
    SMILE[5] = y + 8
    sketchPath(ctx, SMILE, FACE_LINE)
  }
}

const NAIL_HEAD: SketchStyle = { width: 2, wobble: 0.4, passes: 1, seed: 9 }
const NAIL_SHAFT: SketchStyle = {
  width: 3,
  color: palette.inkSoft,
  wobble: 0.4,
  passes: 1,
  seed: 8
}

/** A nail head seen from the front, coloured by how close it is to ripping. */
const SCREW_CROSS: SketchStyle = {
  width: 1.8,
  color: palette.ink,
  passes: 1,
  wobble: 0.2,
  seed: 61
}

export function drawNail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  radius = 6,
  screw = false
): void {
  sketchLine(ctx, x, y, x + 3, y + 7, NAIL_SHAFT)
  NAIL_HEAD.fill = colour
  sketchCircle(ctx, x, y, radius, NAIL_HEAD)
  if (screw) {
    // A cross head, so screws read apart from nails.
    const r = radius * 0.65
    sketchLine(ctx, x - r, y, x + r, y, SCREW_CROSS)
    sketchLine(ctx, x, y - r, x, y + r, SCREW_CROSS)
    return
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillRect(x - radius * 0.45, y - radius * 0.5, radius * 0.4, radius * 0.3)
}
