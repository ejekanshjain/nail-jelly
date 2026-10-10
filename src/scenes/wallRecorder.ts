import type { CameraView } from '../game/sim/camera'
import { cellCentre, sectionCentre, type Rect } from '../game/sim/geometry'
import {
  CAMERA_LAMBDA,
  DESIGN_HEIGHT,
  FLOOR_Y,
  REPLAY,
  SECTION_COUNT,
  WALL_RIGHT
} from '../game/tuning'
import {
  damp,
  palette,
  ReplayRecorder,
  setSketchScale,
  type CropRect,
  type ReplayClip,
  type Viewport
} from '../shared'
import { drawWall, type PixelTransform } from './art/wall'
import type { Game } from './game'

/** The recorder's canvas is its own design space: 1 unit is 1 pixel. */
const PX: PixelTransform = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 }
/** Mid-carry, the replay films this band of the hallway, in design units: you and the tray. */
const HALL_TOP = 160
const HALL_HEIGHT = 450
/** Each section's centre, so the camera never allocates. */
const CENTRES = Array.from({ length: SECTION_COUNT }, (_, i) =>
  sectionCentre(i)
)
const POINT = { x: 0, y: 0 }
/** The camera keeps the floor in frame when it follows a block down. */
const FLOOR_MARGIN = 150
/** The whole wall and its floor, for the ending's collapse: its centre and height. */
const WALL_CENTRE = { x: WALL_RIGHT / 2, y: (FLOOR_Y + 60) / 2 } as const
const WALL_SPAN = FLOOR_Y + 140

/**
 * Films the last few seconds for splat replays, every 50 ms of simulation time. Away
 * from a carry it draws the wall into a small off-screen canvas through its own camera,
 * which follows a falling block down to the floor. Mid-carry it copies the hallway from
 * the main canvas instead. It also renders the share card's sharp mid-fall picture.
 */
export class WallRecorder {
  readonly recorder = new ReplayRecorder({
    seconds: REPLAY.seconds,
    fps: REPLAY.fps,
    width: REPLAY.width,
    height: REPLAY.height
  })
  /** Where the replay camera looks. The cutaway borrows its position. */
  readonly view: CameraView = {
    x: 0,
    y: 0,
    zoom: REPLAY.width / REPLAY.worldWidth,
    anchorX: REPLAY.width / 2,
    anchorY: REPLAY.height / 2
  }
  /** The latest mid-fall picture, and the one of the longest-held block lost so far. */
  picture: HTMLCanvasElement | null = null
  bestPicture: HTMLCanvasElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private lastFrameMs = -Infinity
  private followId: number | null = null
  private landedAtMs = -Infinity
  private readonly visible: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private readonly pictureView: CameraView = {
    x: 0,
    y: 0,
    zoom: 1,
    anchorX: REPLAY.pictureWidth / 2,
    anchorY: REPLAY.pictureHeight / 2
  }
  private crop: CropRect | null = null
  private cropKey = ''
  /** Films the whole wall at once, for the ending's collapse. */
  private wide = false

  constructor(private readonly game: Game) {
    this.aim(POINT)
    this.view.x = POINT.x
    this.view.y = POINT.y
  }

  /** Follows a falling block down until it lands, then holds on the splat a moment. */
  follow(blockId: number): void {
    this.followId = blockId
    this.landedAtMs = Infinity
  }

  /** A block landed: if it is the one being followed, the camera holds there briefly. */
  landed(blockId: number): void {
    if (blockId === this.followId) this.landedAtMs = this.game.state.simMs
  }

  /** Frames the whole wall from now on, so the ending films every block coming down. */
  frameWall(): void {
    this.wide = true
    this.followId = null
  }

  /** Eases the camera towards the followed block or the active section. Call every step. */
  update(dtMs: number): void {
    const dt = dtMs / 1000
    const zoom = this.wide
      ? REPLAY.height / WALL_SPAN
      : REPLAY.width / REPLAY.worldWidth
    this.view.zoom = damp(this.view.zoom, zoom, CAMERA_LAMBDA, dt)
    if (!this.aim(POINT)) return
    this.view.x = damp(this.view.x, POINT.x, CAMERA_LAMBDA, dt)
    this.view.y = damp(this.view.y, POINT.y, CAMERA_LAMBDA, dt)
  }

  /**
   * Records a frame when one is due. Call from render, after the scene has drawn.
   * Returns true when it recorded one.
   */
  capture(timeMs: number): boolean {
    const elapsed = timeMs - this.lastFrameMs
    if (elapsed >= 0 && elapsed < 1000 / REPLAY.fps - 2) return false
    this.lastFrameMs = timeMs
    const viewport = this.game.viewport
    if (!viewport) return false
    if (this.game.state.carry) {
      this.recorder.capture(
        viewport.ctx.canvas,
        this.hallCrop(viewport),
        timeMs
      )
      return true
    }
    const ctx = this.context()
    if (!ctx) return false
    this.render(ctx, this.view, timeMs, REPLAY.width, REPLAY.height)
    this.recorder.capture(this.canvas!, undefined, timeMs)
    return true
  }

  /** Hands over the last seconds as a clip; recording carries on. */
  clip(): ReplayClip | null {
    return this.recorder.clip(REPLAY.seconds)
  }

  /**
   * Renders the share picture now: the falling block and the cell it left, framed
   * together at 960 x 720. Returns null when the block has no body.
   */
  takePicture(blockId: number): HTMLCanvasElement | null {
    const { state, wall } = this.game
    const block = state.blocks.get(blockId)
    const body = wall.bodyOf(blockId)
    if (!block || !body || block.section < 0) return null
    const centre = body.soft.center(POINT)
    const cell = cellCentre(block.section, block.cell)
    const span = Math.max(
      REPLAY.worldWidth * 0.75,
      Math.abs(centre.y - cell.y) + 260
    )
    const view = this.pictureView
    view.zoom = REPLAY.pictureHeight / span
    view.x = (centre.x + cell.x) / 2
    view.y = (centre.y + cell.y) / 2
    const canvas = (this.picture ??= makeCanvas(
      REPLAY.pictureWidth,
      REPLAY.pictureHeight
    ))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    this.render(
      ctx,
      view,
      state.simMs,
      REPLAY.pictureWidth,
      REPLAY.pictureHeight,
      true
    )
    return canvas
  }

  /** Renders the whole wall now at 960 x 720, for the ending's share card. */
  takeWallPicture(): HTMLCanvasElement | null {
    const view = this.pictureView
    view.zoom = REPLAY.pictureHeight / WALL_SPAN
    view.x = WALL_CENTRE.x
    view.y = WALL_CENTRE.y
    const canvas = (this.picture ??= makeCanvas(
      REPLAY.pictureWidth,
      REPLAY.pictureHeight
    ))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    this.render(
      ctx,
      view,
      this.game.state.simMs,
      REPLAY.pictureWidth,
      REPLAY.pictureHeight,
      true
    )
    return canvas
  }

  /** Copies `picture` as the best one so far, for the ending's share card. */
  keepBest(picture: CanvasImageSource): void {
    const best = (this.bestPicture ??= makeCanvas(
      REPLAY.pictureWidth,
      REPLAY.pictureHeight
    ))
    const ctx = best.getContext('2d')
    ctx?.drawImage(picture, 0, 0, best.width, best.height)
  }

  /**
   * Draws the wall and its world captions into a canvas `width` x `height` pixels.
   * `sharp` draws nails and splats live, for the share pictures.
   */
  private render(
    ctx: CanvasRenderingContext2D,
    view: CameraView,
    timeMs: number,
    width: number,
    height: number,
    sharp = false
  ): void {
    const game = this.game
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = palette.paper
    ctx.fillRect(0, 0, width, height)
    const v = this.visible
    v.x = view.x - view.anchorX / view.zoom
    v.y = view.y - view.anchorY / view.zoom
    v.width = width / view.zoom
    v.height = height / view.zoom
    drawWall(ctx, view, PX, {
      state: game.state,
      wall: game.wall,
      layers: game.layers,
      proxies: game.proxies,
      timeMs,
      visible: v,
      litNail: null,
      target: null,
      heckleMs: game.heckleMs,
      uncle: game.portrait,
      extras: this.game.drawWallExtras,
      sharp
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    setSketchScale(ctx, 1)
    game.fx.drawCaptions(ctx, view, true, view.zoom, width)
  }

  /**
   * Where the camera should look: the falling block, the splat it just made, or the
   * active section. Returns false to stay put.
   */
  private aim(out: { x: number; y: number }): boolean {
    const { state, wall } = this.game
    if (this.wide) {
      out.x = WALL_CENTRE.x
      out.y = WALL_CENTRE.y
      return true
    }
    if (this.followId !== null) {
      const block = state.blocks.get(this.followId)
      const body = wall.bodyOf(this.followId)
      if (block?.status === 'falling' && body) {
        body.soft.center(out)
        out.y = Math.min(out.y, FLOOR_Y - FLOOR_MARGIN)
        return true
      }
      if (state.simMs - this.landedAtMs < REPLAY.holdMs) return false
      this.followId = null
    }
    const centre = CENTRES[state.section] ?? CENTRES[0]!
    out.x = centre.x
    out.y = centre.y
    return true
  }

  private context(): CanvasRenderingContext2D | null {
    if (this.ctx) return this.ctx
    this.canvas = makeCanvas(REPLAY.width, REPLAY.height)
    this.ctx = this.canvas.getContext('2d', { alpha: false })
    return this.ctx
  }

  /** The hallway band of the main canvas, in canvas pixels, rebuilt when the canvas resizes. */
  private hallCrop(viewport: Viewport): CropRect {
    const canvas = viewport.ctx.canvas
    const key = `${canvas.width}x${canvas.height}x${viewport.scale}`
    if (this.crop && key === this.cropKey) return this.crop
    const rect = viewport.designRect()
    const k = rect.height / DESIGN_HEIGHT
    this.crop = {
      x: rect.x,
      y: rect.y + HALL_TOP * k,
      width: rect.width,
      height: HALL_HEIGHT * k
    }
    this.cropKey = key
    return this.crop
  }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
