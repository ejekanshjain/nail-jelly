import { toDesign, type CameraView } from '../game/sim/camera'
import { CAPTION_MS, DESIGN_WIDTH, FLOOR_Y, SHAKE_MS } from '../game/tuning'
import {
  boilSeed,
  FONT_MARKER,
  hash01,
  palette,
  settings,
  sketchCircle,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'

/** A floating marker caption. World captions follow the camera; design captions stay put. */
export interface Caption {
  text: string
  x: number
  y: number
  world: boolean
  bornMs: number
  ttlMs: number
  size: number
  color: string
  rotate: number
  /** The text and its outline painted once, so each frame draws one image. */
  stamp: TextStamp | null
}

/**
 * A caption painted into its own small canvas. Stroking the outline of the marker font
 * costs far more than drawing an image, and the replay recorder pays it synchronously.
 */
interface TextStamp {
  canvas: HTMLCanvasElement
  /** Canvas pixels per design unit at full size. */
  density: number
  left: number
  top: number
  width: number
  height: number
}

interface Droplet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
}

export interface CaptionOptions {
  world?: boolean
  size?: number
  color?: string
  ttlMs?: number
}

const DROP_STYLE: SketchStyle = { width: 1.5, wobble: 0.5, passes: 1, seed: 3 }
const POINT = { x: 0, y: 0 }
/** Captions boil: a small seeded tilt that changes 6 times a second. */
const TEXT: SketchTextStyle = {
  font: 'marker',
  outline: palette.paper,
  tilt: 0.04
}
/** At most this many captions at once, so a burst of hits never fills the screen. */
const MAX_CAPTIONS = 6
/** A repeat caption this close to a live one with the same words restarts it. */
const TWIN_REACH = 80
/** The most canvas pixels per design unit a caption stamp paints at. */
const MAX_STAMP_DENSITY = 4
/** A stamp drawn this much sharper than it was painted repaints at the new density. */
const RESTAMP_AT = 1.25
/** Measures text for the stamps. */
let measure: CanvasRenderingContext2D | null = null

/**
 * Captions, screen shake and splat droplets. Time advances with the simulation. Droplets
 * vanish below `floorY`: the wall's floor in world units by default, or a room's floor.
 */
export class Fx {
  readonly captions: Caption[] = []
  private readonly droplets: Droplet[] = []
  private timeMs = 0
  private shakeAmp = 0
  private shakeStart = 0

  constructor(private readonly floorY = FLOOR_Y) {}

  caption(
    text: string,
    x: number,
    y: number,
    options: CaptionOptions = {}
  ): void {
    const world = options.world ?? true
    // The same words again on the same spot restart that caption instead of stacking a
    // second, slightly rotated copy on top of it.
    const twin = this.captions.find(
      c =>
        c.text === text &&
        c.world === world &&
        Math.abs(c.x - x) < TWIN_REACH &&
        Math.abs(c.y - y) < TWIN_REACH
    )
    if (twin) {
      twin.x = x
      twin.y = y
      twin.bornMs = this.timeMs
      return
    }
    if (this.captions.length >= MAX_CAPTIONS) freeStamp(this.captions.shift())
    this.captions.push({
      text,
      x,
      y,
      world,
      bornMs: this.timeMs,
      ttlMs: options.ttlMs ?? CAPTION_MS,
      size: options.size ?? 30,
      color: options.color ?? palette.ink,
      rotate: (Math.random() - 0.5) * 0.24,
      stamp: null
    })
  }

  /** Starts a screen shake of `amount` design units, unless Reduced Motion is on. */
  shake(amount: number): void {
    if (settings.get().reducedMotion) return
    const left = this.shakeLeft()
    if (amount < left) return
    this.shakeAmp = amount
    this.shakeStart = this.timeMs
  }

  /** Throws droplets on ballistic arcs from a splat. */
  splash(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const speed = 160 + Math.random() * 260
      this.droplets.push({
        x,
        y: y - 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        color
      })
    }
  }

  update(dtMs: number): void {
    this.timeMs += dtMs
    const dt = dtMs / 1000
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i]!
      d.vy += 1400 * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      if (d.y > this.floorY + 4) this.droplets.splice(i, 1)
    }
    for (let i = this.captions.length - 1; i >= 0; i--) {
      const c = this.captions[i]!
      if (this.timeMs - c.bornMs <= c.ttlMs) continue
      freeStamp(c)
      this.captions.splice(i, 1)
    }
  }

  /** Current shake offset in design units. */
  shakeOffset(out: { x: number; y: number }): { x: number; y: number } {
    const left = this.shakeLeft()
    out.x = left > 0 ? Math.sin(this.timeMs * 0.09) * left : 0
    out.y = left > 0 ? Math.cos(this.timeMs * 0.11) * left : 0
    return out
  }

  /** Droplets, drawn in world units with the camera applied. */
  drawDroplets(ctx: CanvasRenderingContext2D): void {
    for (const d of this.droplets) {
      DROP_STYLE.fill = d.color
      DROP_STYLE.color = d.color
      sketchCircle(ctx, d.x, d.y, d.r, DROP_STYLE)
    }
  }

  /**
   * Captions, drawn in design units. World captions convert through the camera.
   * `worldOnly` skips the design captions and `scale` sizes the text, for small views
   * such as the replay recorder. Each caption slides sideways to stay inside `width`,
   * so one born near an edge never runs off the canvas.
   */
  drawCaptions(
    ctx: CanvasRenderingContext2D,
    view: CameraView,
    worldOnly = false,
    scale = 1,
    width = DESIGN_WIDTH
  ): void {
    const boil = boilSeed(this.timeMs)
    for (const c of this.captions) {
      if (worldOnly && !c.world) continue
      const age = (this.timeMs - c.bornMs) / c.ttlMs
      if (c.world) toDesign(view, c.x, c.y, POINT)
      else {
        POINT.x = c.x
        POINT.y = c.y
      }
      const pop = age < 0.12 ? 0.7 + (age / 0.12) * 0.3 : 1
      const seed = Math.floor(c.bornMs) + boil
      const alpha = age > 0.7 ? (1 - age) / 0.3 : 1
      const y = POINT.y - age * 36 * scale
      const stamp = stampFor(ctx, c, scale)
      if (!stamp) {
        TEXT.size = c.size * pop * scale
        TEXT.color = c.color
        TEXT.rotate = c.rotate
        TEXT.seed = seed
        TEXT.alpha = alpha
        sketchText(ctx, c.text, POINT.x, y, TEXT)
        continue
      }
      // The same seeded tilt sketchText would give the text.
      const angle = c.rotate + (hash01(seed, 9001) - 0.5) * 2 * TEXT.tilt!
      const k = pop * scale
      const x = insideWidth(POINT.x, (stamp.width / 2) * k, width)
      ctx.save()
      ctx.globalAlpha *= alpha
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.scale(k, k)
      ctx.drawImage(
        stamp.canvas,
        stamp.left,
        stamp.top,
        stamp.width,
        stamp.height
      )
      ctx.restore()
    }
  }

  private shakeLeft(): number {
    const t = (this.timeMs - this.shakeStart) / SHAKE_MS
    return t >= 1 ? 0 : this.shakeAmp * (1 - t)
  }
}

/** Moves a centre `x` so a caption `half` wide on each side fits inside 0 to `width`. */
function insideWidth(x: number, half: number, width: number): number {
  const margin = 6
  if (half * 2 >= width - margin * 2) return width / 2
  return Math.min(Math.max(x, margin + half), width - margin - half)
}

/**
 * The caption's stamp, painted on first use at the density `ctx` draws it, and again if
 * a later drawing needs it sharper. Null until the marker font has loaded, so a stamp
 * never keeps a fallback font.
 */
function stampFor(
  ctx: CanvasRenderingContext2D,
  c: Caption,
  scale: number
): TextStamp | null {
  const m = ctx.getTransform()
  const density = Math.min(MAX_STAMP_DENSITY, Math.hypot(m.a, m.b) * scale)
  if (c.stamp && density <= c.stamp.density * RESTAMP_AT) return c.stamp
  const font = `${c.size}px ${FONT_MARKER}`
  if (!document.fonts.check(font)) return null
  measure ??= document.createElement('canvas').getContext('2d')
  if (!measure) return null
  measure.font = font
  // Room for the outline, which sketchText strokes at 18% of the size.
  const pad = Math.max(2, c.size * 0.18) / 2 + 3
  const width = measure.measureText(c.text).width + pad * 2
  const height = c.size * 1.5 + pad * 2
  freeStamp(c)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * density)
  canvas.height = Math.ceil(height * density)
  const paint = canvas.getContext('2d')
  if (!paint) return null
  paint.setTransform(
    density,
    0,
    0,
    density,
    (width / 2) * density,
    (height / 2) * density
  )
  sketchText(paint, c.text, 0, 0, {
    font: 'marker',
    size: c.size,
    color: c.color,
    outline: palette.paper
  })
  c.stamp = {
    canvas,
    density,
    left: -width / 2,
    top: -height / 2,
    width,
    height
  }
  return c.stamp
}

/** Frees a caption's stamp canvas straight away, rather than at garbage collection. */
function freeStamp(c: Caption | undefined): void {
  if (!c?.stamp) return
  c.stamp.canvas.width = 0
  c.stamp.canvas.height = 0
  c.stamp = null
}
