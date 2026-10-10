import type { NailLevel } from '../../game/grip'
import { cloudiness, lumpCount } from '../../game/quality'
import { tornSprings, type BlockBody } from '../../game/sim/blockBody'
import type { CameraView } from '../../game/sim/camera'
import type { Proxy, ProxyWall } from '../../game/sim/proxies'
import { cellRect, sectionRect, type Rect } from '../../game/sim/geometry'
import { blockNailLevelFor as blockNailLevel } from '../../game/warnings'
import type { WallSim } from '../../game/sim/wallSim'
import {
  FACE_MIN_ZOOM,
  FLOOR_Y,
  KNOCK_FX,
  MESS,
  PORTRAIT_ORIGIN,
  SECTION_COUNT,
  SECTION_H,
  SECTION_W,
  SQUASH,
  UNCLE,
  WHOLE_ZOOM
} from '../../game/tuning'
import type {
  BlockSnapshot,
  BlockState,
  GameState,
  Grade,
  SectionState,
  Splat
} from '../../game/types'
import type { UncleFace } from '../../game/uncle'
import {
  blobPoints,
  boilSeed,
  CachedLayer,
  palette,
  setSketchScale,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../../shared'
import {
  drawFace,
  drawSweat,
  drawInnards,
  drawJellyPieces,
  drawReinforcement,
  drawNail,
  SPLAT_COLOURS,
  type FaceMood
} from './jelly'
import { drawUncleFace, drawUncleSlot, PORTRAIT_FACE } from './uncle'

/** How design units map to canvas pixels: the viewport's fit, or a recorder's own. */
export interface PixelTransform {
  /** CSS pixels per design unit. */
  scale: number
  offsetX: number
  offsetY: number
  dpr: number
}

/** Sets `ctx` to draw world units through a camera, and tells the sketch helpers the scale. */
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  view: CameraView,
  px: PixelTransform
): void {
  const k = px.dpr * px.scale * view.zoom
  ctx.setTransform(
    k,
    0,
    0,
    k,
    px.dpr * (px.offsetX + px.scale * (view.anchorX - view.zoom * view.x)),
    px.dpr * (px.offsetY + px.scale * (view.anchorY - view.zoom * view.y))
  )
  setSketchScale(ctx, px.scale * view.zoom)
}

/** Static and per-frame inputs for one wall drawing. */
export interface WallDrawData {
  state: GameState
  wall: WallSim
  layers: WallLayers | null
  /** Blocks of unlocked sections drawn from their snapshots, if any. */
  proxies: ProxyWall | null
  timeMs: number
  /** Visible world rectangle, for culling. */
  visible: Rect
  /** Fixing whose head lights up for a re-hammer press. */
  litNail: number | null
  /** Particle the hammer would hit if released now. */
  target: { blockId: number; particle: number } | null
  /** Simulation time the uncle last heckled a fall; his keys jangle for a moment. */
  heckleMs?: number
  /** The portrait's face and speech bubble right now. */
  uncle?: {
    face: UncleFace
    bubble: { text: string; ageMs: number } | null
  }
  /** Draws extra world-space effects on top, such as droplets. */
  extras?: (ctx: CanvasRenderingContext2D) => void
  /** Draws nails and splats live instead of from stamps, for a sharp share picture. */
  sharp?: boolean
}

const WALLPAPER = '#fbe4ec'
const STRIPE = 'rgba(230, 73, 128, 0.14)'
const FLOOR = '#c9935e'
const FRAME: SketchStyle = {
  width: 6,
  color: palette.brown,
  seed: 1,
  passes: 2
}
const ACTIVE_FILL: SketchStyle = {
  fill: 'rgba(252, 196, 25, 0.14)',
  width: 0,
  seed: 2
}
const SKIRTING: SketchStyle = { fill: palette.brown, width: 3, seed: 3 }
const RESIDUE: SketchStyle = {
  fill: 'rgba(141, 85, 36, 0.35)',
  width: 0,
  wobble: 2,
  seed: 4
}
const EMPTY_NAIL_COLOUR = '#9a9a9a'
const HAND: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 3,
  seed: 5
}
const ARM: SketchStyle = { width: 14, color: '#f4c7a1', seed: 6, passes: 1 }
const ARM_LINE: SketchStyle = { width: 3, seed: 7, passes: 1 }
const FINGER: SketchStyle = { width: 3, seed: 12, passes: 1 }
const TARGET_RING: SketchStyle = {
  width: 3,
  color: palette.blue,
  wobble: 1,
  passes: 1,
  seed: 8
}
const LIT_RING: SketchStyle = {
  width: 4,
  color: palette.yellow,
  wobble: 1,
  passes: 1,
  seed: 9
}
/** The outline a block flashes when a falling neighbour hits it. */
const KNOCK_FLASH: SketchStyle = {
  width: 7,
  color: palette.yellow,
  wobble: 2,
  passes: 1,
  seed: 10
}
const SPLAT_STYLES = new Map<string, SketchStyle>()
/** Particle positions of the block being drawn, reused every frame. */
const POSITIONS = new Float64Array(24)
/**
 * Below this camera zoom the wall is at Whole Wall framing: live blocks draw with one
 * pen stroke, and stamps are painted with lines thickened as live lines would be there.
 */
const WIDE_ZOOM = 0.75

/** Draws the wall, its sections, blocks, nails, hand and floor through a camera. */
export function drawWall(
  ctx: CanvasRenderingContext2D,
  view: CameraView,
  px: PixelTransform,
  data: WallDrawData
): void {
  applyCamera(ctx, view, px)
  const { state, visible } = data
  const left = visible.x
  const right = visible.x + visible.width
  const top = visible.y
  const bottom = visible.y + visible.height

  // Wallpaper stripes, then the floor and skirting board.
  ctx.fillStyle = WALLPAPER
  ctx.fillRect(left, top, right - left, FLOOR_Y - top)
  ctx.fillStyle = STRIPE
  for (let x = Math.floor(left / 48) * 48; x < right; x += 48)
    ctx.fillRect(x, top, 16, FLOOR_Y - top)
  if (bottom > FLOOR_Y - 24) {
    ctx.fillStyle = FLOOR
    ctx.fillRect(left, FLOOR_Y, right - left, bottom - FLOOR_Y)
    for (let x = Math.floor(left / 160) * 160; x < right; x += 160)
      sketchLine(ctx, x, FLOOR_Y + 4, x - 30, bottom, {
        width: 2,
        color: palette.brown,
        passes: 1,
        seed: x
      })
    sketchRect(ctx, left - 10, FLOOR_Y - 22, right - left + 20, 22, SKIRTING)
  }

  for (let i = 0; i < SECTION_COUNT; i++)
    drawSectionBack(ctx, data, i, visible, view.zoom)
  if (overlaps(slotRect(), visible)) {
    if (data.layers) data.layers.portrait.draw(ctx)
    else drawUncleSlot(ctx, PORTRAIT_ORIGIN[0], PORTRAIT_ORIGIN[1])
    drawUncleFace(
      ctx,
      PORTRAIT_ORIGIN[0] + PORTRAIT_FACE.x,
      PORTRAIT_ORIGIN[1] + PORTRAIT_FACE.y,
      data.uncle?.face ?? 'smug',
      data.timeMs
    )
    drawJangle(ctx, state.simMs - (data.heckleMs ?? -Infinity))
    if (data.uncle?.bubble) drawPortraitBubble(ctx, data.uncle.bubble)
  }
  data.layers?.pruneSplats(state)
  for (const splat of state.splats)
    if (
      splat.room === 'wall' &&
      splat.x + splat.radius * 2 > left &&
      splat.x - splat.radius * 2 < right &&
      splat.y + splat.radius > top &&
      splat.y - splat.radius < bottom
    )
      drawSplat(ctx, splat, stampsFor(data), view.zoom)
  if (data.proxies && data.proxies.proxies.size > 0)
    drawProxies(ctx, view, data)
  drawBlocks(ctx, view, data)
  drawHand(ctx, data.wall)
  data.extras?.(ctx)
}

const JANGLE_MS = 1600
const BUBBLE: SketchStyle = { fill: '#ffffff', width: 3, seed: 15 }
const BUBBLE_TEXT: SketchTextStyle = { font: 'marker', size: 30, maxWidth: 220 }
const BUBBLE_TEXT_SMALL: SketchTextStyle = {
  font: 'marker',
  size: 22,
  maxWidth: 220
}
const JANGLE: SketchStyle = {
  width: 3,
  color: palette.inkSoft,
  passes: 1,
  seed: 16
}

/** The uncle's speech bubble by his portrait: a heckle or a taunt. */
function drawPortraitBubble(
  ctx: CanvasRenderingContext2D,
  bubble: { text: string; ageMs: number }
): void {
  const x = PORTRAIT_ORIGIN[0]
  const y = PORTRAIT_ORIGIN[1]
  const pop = Math.min(1, bubble.ageMs / 120)
  ctx.save()
  const fade = UNCLE.bubbleMs - bubble.ageMs
  if (fade < 300) ctx.globalAlpha *= fade / 300
  sketchLine(ctx, x + 190, y + 86, x + 225, y + 150, BUBBLE)
  sketchRoundRect(ctx, x + 20, y + 28, 230 * pop, 62 * pop, 14, BUBBLE)
  const style = bubble.text.length > 12 ? BUBBLE_TEXT_SMALL : BUBBLE_TEXT
  if (pop >= 1) sketchText(ctx, bubble.text, x + 135, y + 60, style)
  ctx.restore()
}

/** His car keys swing and jangle on their hook, just after a fall. */
function drawJangle(ctx: CanvasRenderingContext2D, sinceMs: number): void {
  if (sinceMs < 0 || sinceMs > JANGLE_MS) return
  const x = PORTRAIT_ORIGIN[0]
  const y = PORTRAIT_ORIGIN[1]
  const swing = Math.sin(sinceMs * 0.03) * 8
  sketchLine(ctx, x + 462 + swing, y + 160, x + 474 + swing, y + 150, JANGLE)
  sketchLine(ctx, x + 418 - swing, y + 160, x + 406 - swing, y + 150, JANGLE)
}

function slotRect(): Rect {
  return {
    x: PORTRAIT_ORIGIN[0],
    y: PORTRAIT_ORIGIN[1],
    width: SECTION_W,
    height: SECTION_H
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** A section's frame, its locked picture, and for open sections their cells and leftovers. */
function drawSectionBack(
  ctx: CanvasRenderingContext2D,
  data: WallDrawData,
  index: number,
  visible: Rect,
  zoom: number
): void {
  const rect = sectionRect(index)
  if (!overlaps(rect, visible)) return
  const section = data.state.sections[index]!
  const active = index === data.state.section && !section.locked
  if (active)
    sketchRect(ctx, rect.x, rect.y, rect.width, rect.height, ACTIVE_FILL)
  FRAME.seed = 11 + index
  FRAME.color = active ? palette.orange : palette.brown
  sketchRect(
    ctx,
    rect.x + 6,
    rect.y + 6,
    rect.width - 12,
    rect.height - 12,
    FRAME
  )
  if (section.locked) {
    data.layers?.locked(index)?.draw(ctx)
    return
  }
  section.cells.forEach((cell, i) => {
    const r = cellRect(index, i)
    if (cell.residue > 0) {
      RESIDUE.seed = index * 20 + i
      RESIDUE.alpha = Math.min(1, cell.residue)
      sketchBlob(ctx, residueBlob(r, index * 20 + i), RESIDUE)
    }
    if (active && cell.block === null) {
      ctx.save()
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = 'rgba(34, 34, 34, 0.3)'
      ctx.lineWidth = 2
      ctx.strokeRect(r.x + 10, r.y + 10, r.width - 20, r.height - 20)
      ctx.restore()
    }
    for (const nail of cell.emptyNails)
      stampNail(
        ctx,
        stampsFor(data),
        zoom,
        nail.x,
        nail.y,
        EMPTY_NAIL_COLOUR,
        4.5,
        false
      )
  })
}

/** The layers to stamp nails and splats from, or null to draw them live. */
function stampsFor(data: WallDrawData): WallLayers | null {
  return data.sharp ? null : data.layers
}

/** A nail from its cached stamp when there are layers, otherwise drawn live. */
function stampNail(
  ctx: CanvasRenderingContext2D,
  layers: WallLayers | null,
  zoom: number,
  x: number,
  y: number,
  colour: string,
  radius: number,
  screw: boolean
): void {
  const stamp = layers?.nail(colour, radius, screw, zoom)
  if (stamp) stamp.drawAt(ctx, x, y)
  else drawNail(ctx, x, y, colour, radius, screw)
}

const RESIDUE_CACHE = new Map<number, Float64Array>()
function residueBlob(r: Rect, seed: number): Float64Array {
  let points = RESIDUE_CACHE.get(seed)
  if (!points) {
    points = blobPoints(
      r.x + r.width / 2,
      r.y + r.height / 2 + 6,
      40,
      10,
      seed,
      0.35
    )
    RESIDUE_CACHE.set(seed, points)
  }
  return points
}

const SPLAT_POINTS = new Map<number, Float64Array>()
const CHUNK: SketchStyle = { width: 3, seed: 1 }
const CHUNK_SHINE: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.6)',
  width: 0,
  seed: 2
}

/**
 * A splat lying flat on a floor, in its flavour's colours. Any room uses it. With
 * `layers` it draws from a cached stamp; `zoom` is the camera's, 1 in design units.
 */
export function drawSplat(
  ctx: CanvasRenderingContext2D,
  splat: Splat,
  layers: WallLayers | null = null,
  zoom = 1
): void {
  drawSplatAt(ctx, splat, splat.x, splat.y, layers, zoom)
}

/**
 * A splat drawn at (x, y): a flat smear with a tail towards its smear side, and the set
 * chunk on top until it is scraped. Mopping shrinks and fades the smear. With `layers`
 * it draws from a cached stamp, repainted after each stroke.
 */
export function drawSplatAt(
  ctx: CanvasRenderingContext2D,
  splat: Splat,
  x: number,
  y: number,
  layers: WallLayers | null = null,
  zoom = 1
): void {
  if (layers) layers.splat(splat, zoom).drawAt(ctx, x, y)
  else paintSplat(ctx, splat, x, y)
}

/** Draws a splat live at (x, y). */
function paintSplat(
  ctx: CanvasRenderingContext2D,
  splat: Splat,
  x: number,
  y: number
): void {
  let points = SPLAT_POINTS.get(splat.id)
  if (!points) {
    points = blobPoints(0, 0, splat.radius, 12, splat.seed, 0.35)
    SPLAT_POINTS.set(splat.id, points)
  }
  let style = SPLAT_STYLES.get(splat.flavour)
  if (!style) {
    const c = SPLAT_COLOURS[splat.flavour]
    style = { fill: c.fill, color: c.line, width: 3, seed: 1 }
    SPLAT_STYLES.set(splat.flavour, style)
  }
  const scraped = splat.chunk ? Math.min(splat.strokes, MESS.scrapeStrokes) : 0
  const mopped = (splat.strokes - scraped) / MESS.mopStrokes
  const size = 1 - 0.55 * mopped
  style.seed = splat.seed
  style.alpha = 1 - 0.45 * mopped
  ctx.save()
  ctx.translate(x, y + 6)
  ctx.scale(size, 0.32 * size)
  sketchBlob(ctx, points, style)
  // The smear's tail shows which way it will throw a tray.
  ctx.translate(splat.side * splat.radius * 0.85, 0)
  ctx.scale(0.55, 0.55)
  style.seed = splat.seed + 1
  sketchBlob(ctx, points, style)
  ctx.restore()
  style.alpha = 1
  if (!splat.chunk || splat.strokes >= MESS.scrapeStrokes) return
  // The set chunk sits on top, shrinking as you scrape.
  const left = 1 - splat.strokes / MESS.scrapeStrokes
  const rx = splat.radius * (0.25 + 0.25 * left)
  const c = SPLAT_COLOURS[splat.flavour]
  CHUNK.fill = c.fill
  CHUNK.color = c.line
  CHUNK.seed = splat.seed + 2
  sketchEllipse(ctx, x - splat.side * 4, y - rx * 0.3, rx, rx * 0.55, CHUNK)
  CHUNK_SHINE.seed = splat.seed + 3
  sketchEllipse(
    ctx,
    x - splat.side * 4 - rx * 0.35,
    y - rx * 0.55,
    rx * 0.3,
    rx * 0.14,
    CHUNK_SHINE
  )
}

/** Forgets cached splat outlines that no longer exist. */
export function pruneSplatCache(state: GameState): void {
  if (SPLAT_POINTS.size <= state.splats.length) return
  const alive = new Set(state.splats.map(s => s.id))
  for (const id of SPLAT_POINTS.keys())
    if (!alive.has(id)) SPLAT_POINTS.delete(id)
}

/** The warning colour for one nail on a block. */
export function nailColour(
  block: BlockState,
  grip: number,
  timeMs: number,
  final = false
): string {
  const level = blockNailLevel(block, grip, final)
  if (level === 'red')
    return Math.floor(timeMs / 220) % 2 ? palette.red : '#ff8787'
  if (level === 'orange') return palette.orange
  return palette.ink
}

function moodFor(block: BlockState, now: number, final: boolean): FaceMood {
  if (block.status === 'falling' || block.cause !== null) return 'falling'
  if (now - block.sweetMs < 1200) return 'happy'
  let worst: NailLevel = 'ok'
  for (const f of block.fixings) {
    const level = blockNailLevel(block, f.grip, final)
    if (level === 'red') worst = 'red'
    else if (level === 'orange' && worst === 'ok') worst = 'orange'
  }
  if (worst === 'red') return 'scared'
  if (worst === 'orange' || block.status === 'held') return 'worried'
  return 'calm'
}

function drawBlocks(
  ctx: CanvasRenderingContext2D,
  view: CameraView,
  data: WallDrawData
): void {
  const { state, wall, timeMs } = data
  const final = state.phase === 'final'
  const boil = boilSeed(timeMs)
  for (const id of wall.liveIds()) {
    const block = state.blocks.get(id)
    const body = wall.bodyOf(id)
    if (!block || !body) continue
    const pieces = body.soft.outline()
    let main = pieces[0]
    for (const piece of pieces)
      if (main && piece.particles > main.particles) main = piece
    if (!main) continue
    if (
      main.centerX < data.visible.x - 120 ||
      main.centerX > data.visible.x + data.visible.width + 120 ||
      main.centerY < data.visible.y - 120 ||
      main.centerY > data.visible.y + data.visible.height + 120
    )
      continue

    const squashT = (state.simMs - block.heldAtMs) / SQUASH.ms
    const squashing = block.status === 'held' && squashT < 1
    if (squashing) {
      const e = 1 - (1 - squashT) * (1 - squashT)
      const sx = SQUASH.x + (1 - SQUASH.x) * e
      const sy = SQUASH.y + (1 - SQUASH.y) * e
      ctx.save()
      ctx.translate(main.centerX, main.centerY)
      ctx.scale(sx, sy)
      ctx.translate(-main.centerX, -main.centerY)
    }
    const sinceKnock = state.simMs - block.lastShockMs
    if (block.lastShock === 'knock' && sinceKnock < KNOCK_FX.flashMs) {
      KNOCK_FLASH.alpha = 1 - sinceKnock / KNOCK_FX.flashMs
      sketchBlob(ctx, main.points, KNOCK_FLASH, main.count)
    }
    // At Whole Wall a second pen stroke is too small to see.
    drawJellyPieces(
      ctx,
      pieces,
      block.flavour,
      id * 7 + boil,
      view.zoom < WIDE_ZOOM ? 1 : 2,
      cloudiness(block.make)
    )
    const particles = body.soft.bodies
    for (let i = 0; i < particles.length && i < 12; i++) {
      POSITIONS[i * 2] = particles[i]!.position.x
      POSITIONS[i * 2 + 1] = particles[i]!.position.y
    }
    drawInnards(ctx, POSITIONS, lumpCount(block.make), block.flavour, id)
    drawReinforcement(ctx, POSITIONS, block.mesh, block.noodles, id)
    drawCracks(ctx, body)
    if (view.zoom >= FACE_MIN_ZOOM) {
      drawFace(
        ctx,
        main.centerX,
        main.centerY,
        moodFor(block, state.simMs, final),
        id + boil
      )
      if (wall.conditions.heat !== 'none')
        drawSweat(ctx, main.centerX, main.centerY, timeMs, id)
    }
    if (squashing) ctx.restore()

    for (const fixing of block.fixings) {
      if (data.litNail === fixing.id)
        sketchCircle(ctx, fixing.x, fixing.y, 13, LIT_RING)
      stampNail(
        ctx,
        stampsFor(data),
        view.zoom,
        fixing.x,
        fixing.y,
        nailColour(block, fixing.grip, timeMs, final),
        6,
        fixing.kind === 'screw'
      )
    }
    if (data.target?.blockId === id) {
      const p = body.soft.bodies[data.target.particle]
      if (p) sketchCircle(ctx, p.position.x, p.position.y, 15, TARGET_RING)
    }
  }
}

/**
 * Proxies: each snapshot outline moved down by its sag and turned by its swing around
 * the nails, drawn with one pass and no line boil. With cached layers, each proxy draws
 * from its own stamp; its face and nails stay live. Nails stay where they are in the wall.
 */
function drawProxies(
  ctx: CanvasRenderingContext2D,
  view: CameraView,
  data: WallDrawData
): void {
  const { state, timeMs, layers } = data
  const final = state.phase === 'final'
  const faces = view.zoom >= FACE_MIN_ZOOM
  layers?.pruneProxies(data.proxies!)
  for (const proxy of data.proxies!.proxies.values()) {
    const block = state.blocks.get(proxy.blockId)
    if (!block) continue
    const snapshot = proxy.snapshot
    const first = snapshot.pieces[0]
    if (!first) continue
    if (
      first.centerX < data.visible.x - 120 ||
      first.centerX > data.visible.x + data.visible.width + 120 ||
      first.centerY + proxy.s < data.visible.y - 120 ||
      first.centerY + proxy.s > data.visible.y + data.visible.height + 120
    )
      continue
    const stamp = layers?.proxyStamp(proxy, block)
    // A swing under a fifth of a unit at the block's edge draws unrotated, which is faster.
    if (stamp)
      stamp.drawAt(
        ctx,
        proxy.pivotX,
        proxy.pivotY + proxy.s,
        Math.abs(proxy.a) < 0.003 ? 0 : proxy.a
      )
    if (!stamp || faces) {
      ctx.save()
      ctx.translate(proxy.pivotX, proxy.pivotY + proxy.s)
      ctx.rotate(proxy.a)
      ctx.translate(-proxy.pivotX, -proxy.pivotY)
      if (!stamp) paintProxyBody(ctx, block, snapshot)
      if (faces) {
        let main = first
        for (const piece of snapshot.pieces)
          if (piece.particles > main.particles) main = piece
        drawFace(
          ctx,
          main.centerX,
          main.centerY,
          moodFor(block, state.simMs, final),
          block.id
        )
      }
      ctx.restore()
    }
    for (const fixing of block.fixings)
      stampNail(
        ctx,
        stampsFor(data),
        view.zoom,
        fixing.x,
        fixing.y,
        nailColour(block, fixing.grip, timeMs, final),
        6,
        fixing.kind === 'screw'
      )
  }
}

/** A proxy's jelly from its snapshot, in world units, without its face or nails. */
function paintProxyBody(
  ctx: CanvasRenderingContext2D,
  block: BlockState,
  snapshot: BlockSnapshot
): void {
  drawJellyPieces(
    ctx,
    snapshot.pieces,
    block.flavour,
    block.id * 7,
    1,
    cloudiness(block.make)
  )
  drawInnards(
    ctx,
    snapshot.positions,
    lumpCount(block.make),
    block.flavour,
    block.id
  )
  drawReinforcement(
    ctx,
    snapshot.positions,
    block.mesh,
    block.noodles,
    block.id
  )
}

const CRACK: SketchStyle = {
  width: 2,
  color: 'rgba(34, 34, 34, 0.65)',
  wobble: 0.6,
  passes: 1,
  seed: 14
}
const CRACK_POINTS = new Float64Array(8)

/** A small ink zigzag across each torn spring, so every tear shows. */
function drawCracks(ctx: CanvasRenderingContext2D, body: BlockBody): void {
  const torn = tornSprings(body)
  for (let i = 0; i < torn.length; i++) {
    const a = torn[i]!.bodyA?.position
    const b = torn[i]!.bodyB?.position
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    // Pieces that drifted apart show the gap instead.
    if (len < 1 || len > 48) continue
    const nx = -dy / len
    const ny = dx / len
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const tx = dx / len
    const ty = dy / len
    for (let k = 0; k < 4; k++) {
      const along = (k - 1.5) * 3
      const side = (k % 2 ? 1 : -1) * 5
      CRACK_POINTS[k * 2] = mx + nx * side + tx * along
      CRACK_POINTS[k * 2 + 1] = my + ny * side + ty * along
    }
    CRACK.seed = 14 + i
    sketchPath(ctx, CRACK_POINTS, CRACK)
  }
}

/** The cartoon mitten holding the block until the first nail bites. */
function drawHand(ctx: CanvasRenderingContext2D, wall: WallSim): void {
  const points = wall.handPoints()
  if (!points || points.length < 2) return
  const a = points[0]!
  const b = points[1]!
  const shake = wall.handTrembling()
    ? Math.sin(performance.now() * 0.06) * 2
    : 0
  const mx = (a.x + b.x) / 2 + shake
  const my = Math.min(a.y, b.y) - 18
  sketchLine(ctx, mx + 30, my - 240, mx + 6, my - 10, ARM)
  sketchLine(ctx, mx + 23, my - 240, mx - 1, my - 12, ARM_LINE)
  sketchLine(ctx, mx + 37, my - 240, mx + 13, my - 8, ARM_LINE)
  sketchRoundRect(ctx, mx - 44, my - 10, 88, 26, 12, HAND)
  sketchLine(ctx, a.x + shake, my + 8, a.x + shake, a.y, FINGER)
  sketchLine(ctx, b.x + shake, my + 8, b.x + shake, b.y, FINGER)
}

const GRADE_COLOURS: Record<Grade, string> = {
  A: palette.green,
  B: palette.blue,
  C: palette.orange,
  D: palette.red
}

/** Paints a locked section: frozen blocks, cling film, tape, padlock and grade sticker. */
export function paintLockedSection(
  ctx: CanvasRenderingContext2D,
  section: SectionState
): void {
  const rect = sectionRect(section.index)
  for (const block of section.snapshot) {
    drawJellyPieces(
      ctx,
      block.pieces,
      block.flavour,
      block.blockId * 7,
      1,
      cloudiness(block.make)
    )
    drawInnards(
      ctx,
      block.positions,
      lumpCount(block.make),
      block.flavour,
      block.blockId
    )
    drawReinforcement(
      ctx,
      block.positions,
      block.mesh,
      block.noodles,
      block.blockId
    )
    const main = block.pieces.reduce(
      (best, p) => (p.particles > best.particles ? p : best),
      block.pieces[0]!
    )
    if (main) drawFace(ctx, main.centerX, main.centerY, 'happy', block.blockId)
    for (const fixing of block.fixings)
      drawNail(ctx, fixing.x, fixing.y, palette.ink, 6, fixing.kind === 'screw')
  }
  // Cling film: a white hatch and a shine stripe.
  sketchRect(ctx, rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8, {
    fill: 'rgba(255, 255, 255, 0.55)',
    fillStyle: 'hatch',
    hatchGap: 9,
    hatchAngle: 0.7,
    color: 'rgba(255, 255, 255, 0.9)',
    width: 3,
    seed: 40 + section.index
  })
  sketchLine(
    ctx,
    rect.x + 60,
    rect.y + rect.height - 20,
    rect.x + 200,
    rect.y + 20,
    {
      width: 10,
      color: 'rgba(255, 255, 255, 0.6)',
      seed: 41
    }
  )
  // DO NOT TOUCH tape across the film.
  ctx.save()
  ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2)
  ctx.rotate(-0.12)
  sketchRect(ctx, -rect.width / 2 - 6, -16, rect.width + 12, 32, {
    fill: palette.yellow,
    width: 2,
    seed: 42
  })
  sketchText(ctx, 'DO NOT TOUCH  ·  DO NOT TOUCH', 0, 1, {
    font: 'marker',
    size: 18,
    color: palette.ink
  })
  ctx.restore()
  // Padlock at the bottom of the frame.
  const lx = rect.x + rect.width / 2
  const ly = rect.y + rect.height - 6
  sketchCircle(ctx, lx, ly - 14, 14, {
    width: 5,
    color: palette.inkSoft,
    seed: 43
  })
  sketchRect(ctx, lx - 20, ly - 12, 40, 32, {
    fill: palette.yellow,
    width: 3,
    seed: 44
  })
  sketchCircle(ctx, lx, ly + 2, 4, { fill: palette.ink, width: 0, seed: 45 })
  // Grade sticker, top right.
  if (section.grade) {
    const gx = rect.x + rect.width - 34
    const gy = rect.y + 34
    sketchCircle(ctx, gx, gy, 26, {
      fill: GRADE_COLOURS[section.grade],
      width: 3,
      seed: 46
    })
    sketchText(ctx, section.grade, gx, gy + 2, {
      font: 'marker',
      size: 30,
      color: '#ffffff'
    })
  }
}

/** A proxy's cached picture and the snapshot it shows. */
interface ProxyStamp {
  layer: CachedLayer
  block: BlockState
  snapshot: BlockSnapshot
  pivotX: number
  pivotY: number
}

/** Room around a proxy's particles in its stamp, for the outline, shine and lumps. */
const STAMP_MARGIN = 34

/** A splat's cached picture and the strokes it shows. */
interface SplatStamp {
  layer: CachedLayer
  strokes: number
  /** The prune count when it was last drawn. */
  usedAt: number
}
/** Splat stamps not drawn for this many wall drawings are freed. Off screen, a splat costs nothing. */
const SPLAT_STAMP_IDLE = 300

/**
 * Cached pictures for locked sections, the uncle's slot and each proxy in the final
 * test. Create on scene entry.
 */
export class WallLayers {
  readonly portrait: CachedLayer
  private readonly sections: (CachedLayer | null)[]
  private readonly stamps = new Map<number, ProxyStamp>()
  /** Nail heads by colour, size, kind and framing. Every nail with the same key looks alike. */
  private readonly nails = new Map<string, CachedLayer>()
  /** Splats by id, one map for Section framing and design units, one for Whole Wall. */
  private readonly splats = [
    new Map<number, SplatStamp>(),
    new Map<number, SplatStamp>()
  ] as const
  /** Wall drawings so far, which ages the splat stamps. */
  private drawings = 0

  constructor(
    private readonly viewport: Viewport,
    private readonly state: GameState
  ) {
    this.portrait = new CachedLayer(
      viewport,
      ctx => drawUncleSlot(ctx, PORTRAIT_ORIGIN[0], PORTRAIT_ORIGIN[1]),
      slotRect()
    )
    this.sections = state.sections.map(() => null)
  }

  /** The cached picture of a locked section, painted on first use. */
  locked(index: number): CachedLayer | null {
    const section = this.state.sections[index]
    if (!section?.locked) return null
    let layer = this.sections[index] ?? null
    if (!layer) {
      const rect = sectionRect(index)
      layer = new CachedLayer(
        this.viewport,
        ctx => paintLockedSection(ctx, section),
        {
          x: rect.x - 20,
          y: rect.y - 20,
          width: rect.width + 40,
          height: rect.height + 80
        }
      )
      this.sections[index] = layer
    }
    return layer
  }

  /**
   * A proxy's picture with its (0, 0) on the proxy's pivot, painted on first use and
   * again whenever the proxy comes back with a new snapshot.
   */
  proxyStamp(proxy: Proxy, block: BlockState): CachedLayer {
    const stamp = this.stamps.get(proxy.blockId)
    if (stamp?.snapshot === proxy.snapshot) return stamp.layer
    stamp?.layer.dispose()
    const p = proxy.snapshot.positions
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < p.length; i += 2) {
      minX = Math.min(minX, p[i]!)
      maxX = Math.max(maxX, p[i]!)
      minY = Math.min(minY, p[i + 1]!)
      maxY = Math.max(maxY, p[i + 1]!)
    }
    const next: ProxyStamp = {
      block,
      snapshot: proxy.snapshot,
      pivotX: proxy.pivotX,
      pivotY: proxy.pivotY,
      layer: new CachedLayer(
        this.viewport,
        ctx => {
          ctx.translate(-next.pivotX, -next.pivotY)
          paintProxyBody(ctx, next.block, next.snapshot)
        },
        {
          x: minX - proxy.pivotX - STAMP_MARGIN,
          y: minY - proxy.pivotY - STAMP_MARGIN,
          width: maxX - minX + STAMP_MARGIN * 2,
          height: maxY - minY + STAMP_MARGIN * 2
        }
      )
    }
    this.stamps.set(proxy.blockId, next)
    return next.layer
  }

  /** A nail head's picture with its (0, 0) on the nail, for a camera `zoom`. */
  nail(
    colour: string,
    radius: number,
    screw: boolean,
    zoom: number
  ): CachedLayer {
    const wide = zoom < WIDE_ZOOM
    const key = `${colour} ${radius} ${screw} ${wide}`
    let layer = this.nails.get(key)
    if (!layer) {
      // Room for the head, its shaft and lines thickened on a small screen.
      const r = radius + 12
      layer = new CachedLayer(
        this.viewport,
        ctx => {
          if (wide) setSketchScale(ctx, this.viewport.scale * WHOLE_ZOOM)
          drawNail(ctx, 0, 0, colour, radius, screw)
        },
        { x: -r, y: -r, width: r * 2, height: r * 2 + 8 }
      )
      this.nails.set(key, layer)
    }
    return layer
  }

  /**
   * A splat's picture with its (0, 0) on the splat, for a camera `zoom` (1 in design
   * units). It repaints after each scrape or mop stroke.
   */
  splat(splat: Splat, zoom: number): CachedLayer {
    const wide = zoom < WIDE_ZOOM
    const stamps = this.splats[wide ? 1 : 0]
    const stamp = stamps.get(splat.id)
    if (stamp) {
      stamp.usedAt = this.drawings
      if (stamp.strokes !== splat.strokes) {
        stamp.strokes = splat.strokes
        stamp.layer.invalidate()
      }
      return stamp.layer
    }
    const r = splat.radius
    const layer = new CachedLayer(
      this.viewport,
      ctx => {
        if (wide) setSketchScale(ctx, this.viewport.scale * WHOLE_ZOOM)
        paintSplat(ctx, splat, 0, 0)
      },
      // The smear, its tail to either side, and the chunk on top, with thick lines.
      {
        x: -(1.7 * r + 14),
        y: -(0.6 * r + 16),
        width: 2 * (1.7 * r + 14),
        height: 1.15 * r + 36
      }
    )
    stamps.set(splat.id, {
      layer,
      strokes: splat.strokes,
      usedAt: this.drawings
    })
    return layer
  }

  /**
   * Call once per wall drawing. Every so often it frees the pictures of splats that were
   * cleaned up or have not been drawn for a while, such as those off screen.
   */
  pruneSplats(state: GameState): void {
    this.drawings++
    if (this.drawings % 60 !== 0) return
    let alive: Set<number> | null = null
    for (const stamps of this.splats)
      for (const [id, stamp] of stamps) {
        if (this.drawings - stamp.usedAt < SPLAT_STAMP_IDLE) {
          alive ??= new Set(state.splats.map(s => s.id))
          if (alive.has(id)) continue
        }
        stamp.layer.dispose()
        stamps.delete(id)
      }
  }

  /** Frees the pictures of blocks that are no longer proxies. */
  pruneProxies(proxies: ProxyWall): void {
    if (this.stamps.size <= proxies.proxies.size) return
    for (const [id, stamp] of this.stamps)
      if (!proxies.proxies.has(id)) {
        stamp.layer.dispose()
        this.stamps.delete(id)
      }
  }

  /** Frees a section's picture, for example when the final test unlocks it. */
  forget(index: number): void {
    this.sections[index]?.dispose()
    this.sections[index] = null
  }

  dispose(): void {
    this.portrait.dispose()
    for (const layer of this.sections) layer?.dispose()
    for (const stamp of this.stamps.values()) stamp.layer.dispose()
    this.stamps.clear()
    for (const layer of this.nails.values()) layer.dispose()
    this.nails.clear()
    for (const stamps of this.splats) {
      for (const stamp of stamps.values()) stamp.layer.dispose()
      stamps.clear()
    }
  }
}
