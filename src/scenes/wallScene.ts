import { hammerFillMs, hammerZones, type HammerZones } from '../game/hammer'
import {
  isRub,
  nailTarget,
  pickTarget,
  worldRadius,
  type JellyCandidate,
  type NailCandidate,
  type PointerKind
} from '../game/hit'
import {
  cloudiness,
  lumpCount,
  qualityLabel,
  qualityWord
} from '../game/quality'
import {
  createMeshCut,
  dragMesh,
  grabMesh,
  meshEdge,
  meshHelp,
  meshTolerance,
  releaseMesh,
  scissorsAt,
  type MeshCut,
  type MeshEvent
} from '../game/mesh'
import {
  createScrewJob,
  screwCircle,
  screwGrip,
  type ScrewJob
} from '../game/screw'
import {
  showsFloor,
  toDesign,
  toWorld,
  type CameraView
} from '../game/sim/camera'
import { wallTip } from '../game/tips'
import {
  cellAt,
  cellCentre,
  cellRect,
  sectionAt,
  sectionRect
} from '../game/sim/geometry'
import { dirtyCell } from '../game/mess'
import { minutesWithoutSplat } from '../game/replays'
import {
  ACTION_SLOT,
  CELL_H,
  CELL_W,
  DRUM_ROLL_MS,
  JELLY_HIT,
  MESH,
  NAIL_HIT,
  PORTRAIT_ORIGIN,
  SCREW,
  STOOL_GHOST_SCALE,
  STOOL_LEFT,
  STOOL_SLOT_W,
  STOOL_SLOTS,
  STOOL_TOP,
  WEAK_BELOW
} from '../game/tuning'
import type { Splat } from '../game/types'
import {
  CachedLayer,
  CircleGesture,
  formatClock,
  HoldCharge,
  palette,
  randRange,
  settings,
  sfx,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import { drawWall, pruneSplatCache } from './art/wall'
import { drawGhostBlock, GHOST_H, QUALITY_COLOURS } from './art/jelly'
import type { Game } from './game'
import { CellScraper } from './cellScraper'
import { Mopper, splatAt } from './mopper'
import type { Scene } from './scene'

/** A hammer press in progress. */
interface Press {
  kind: 'hammer' | 'rehammer'
  /** Press point in design units, for the meter and the rub threshold. */
  startX: number
  startY: number
  /** Aim point in world units. */
  aimX: number
  aimY: number
  blockId: number | null
  fixingId: number | null
  pointer: PointerKind
  charge: HoldCharge
  zones: HammerZones
  rub: boolean
  /** At Whole Wall in the final test, a quick tap zooms in; only a hold hammers. */
  zoomTap: boolean
}

/** A screw going in: tapped into a particle, then turned with circles around it. */
interface ScrewWork {
  blockId: number
  particle: number
  /** The circle centre, in design units: where the screw sat when you tapped. */
  x: number
  y: number
  gesture: CircleGesture
  job: ScrewJob
  pressed: boolean
  fingerX: number
  fingerY: number
}

/** A mesh sheet being cut for a block on the stool. */
interface Cutter {
  blockId: number
  cut: MeshCut
  /** The latest press was a finger, which gets a wider tolerance. */
  touch: boolean
  /** Simulation time the mesh last snapped back, for its wobble. */
  snapAtMs: number
}

/** A ghost block being dragged from the stool. */
interface Drag {
  blockId: number
  x: number
  y: number
}

const POINT = { x: 0, y: 0 }
/** The press point in world units; kept apart from POINT, which the hit helpers reuse. */
const WORLD = { x: 0, y: 0 }
const MOP_POINT = { x: 0, y: 0 }
const VIEW: CameraView = { x: 0, y: 0, zoom: 1, anchorX: 0, anchorY: 0 }
const SHAKE = { x: 0, y: 0 }
const VISIBLE = { x: 0, y: 0, width: 0, height: 0 }
const STOOL_BG: SketchStyle = { fill: '#d9a066', width: 3, seed: 21 }
/** The stool strip's cached area: its label, the stool and the "+N" stack. */
const STOOL_RECT = {
  x: STOOL_LEFT - 14,
  y: STOOL_TOP - 8,
  width: STOOL_SLOT_W * STOOL_SLOTS + 28,
  height: 160
}
const STOOL_SLOT: SketchStyle = {
  fill: 'rgba(255, 255, 255, 0.35)',
  width: 2,
  color: palette.brown,
  passes: 1,
  seed: 22
}
const WORD: SketchTextStyle = { size: 21, color: palette.ink, seed: 28 }
const DRAG_LABEL: SketchTextStyle = {
  font: 'marker',
  size: 22,
  color: palette.ink,
  outline: palette.paper,
  seed: 29
}
const METER_TRACK: SketchStyle = {
  width: 10,
  color: 'rgba(34, 34, 34, 0.15)',
  passes: 1,
  wobble: 0.5,
  seed: 24
}
const HAMMER_HEAD: SketchStyle = { fill: palette.inkSoft, width: 2.5, seed: 25 }
const HAMMER_HANDLE: SketchStyle = { width: 7, color: palette.brown, seed: 26 }
const CELL_OK = 'rgba(35, 122, 51, 0.8)'
const NEEDLE: SketchStyle = { width: 4, wobble: 0.3, passes: 1, seed: 27 }
const GREY_BAND = 'rgba(92, 92, 92, 0.45)'
const SCREW_HEAD: SketchStyle = { fill: '#ced4da', width: 2.5, seed: 40 }
const SCREW_SLOT: SketchStyle = { width: 2.5, passes: 1, wobble: 0.3, seed: 41 }
const SHAFT: SketchStyle = { width: 5, color: '#868e96', passes: 1, seed: 42 }
const GRIP: SketchStyle = { fill: palette.red, width: 2.5, seed: 43 }
const GUIDE: SketchStyle = {
  width: 3,
  color: 'rgba(240, 140, 0, 0.75)',
  passes: 1,
  wobble: 1,
  seed: 44
}
const SCREW_LABEL: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.ink,
  outline: palette.paper
}
const MAT: SketchStyle = { fill: 'rgba(47, 133, 90, 0.94)', width: 3, seed: 70 }
const MAT_GRID = 'rgba(255, 255, 255, 0.18)'
const SHEET: SketchStyle = {
  fill: 'rgba(206, 212, 218, 0.55)',
  fillStyle: 'hatch',
  hatchGap: 10,
  hatchAngle: 0.8,
  color: 'rgba(206, 212, 218, 0.8)',
  width: 0,
  seed: 71
}
const SHEET_CROSS: SketchStyle = { ...SHEET, hatchAngle: -0.8, seed: 72 }
const CUT_LINE: SketchStyle = { width: 3, color: palette.ink, seed: 73 }
const RAGGED_LINE: SketchStyle = {
  width: 3,
  color: palette.orange,
  wobble: 7,
  seed: 74
}
const BLADE: SketchStyle = { fill: '#dee2e6', width: 2.5, seed: 75 }
const LOOP: SketchStyle = { color: palette.red, width: 5, seed: 76 }
const CUT_LABEL: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: '#ffffff'
}
const CUT_HELP: SketchTextStyle = { size: 20, color: '#e6fcf5' }
const NEEDS_MESH = 'rgba(240, 140, 0, 0.9)'
/** The hold countdown's centre, right of the splat sign and left of the replay corner. */
const HOLD_X = 262
/** The final test's clock replaces the splat sign, top left. */
const FINAL_CLOCK_X = 96
/** At Whole Wall the clock's plate covers the portrait's middle (world units). */
const CLOCK_PLATE_X = PORTRAIT_ORIGIN[0] + 245
const CLOCK_PLATE_Y = PORTRAIT_ORIGIN[1] + 170
const CLOCK_PLATE: SketchStyle = {
  fill: 'rgba(253, 246, 227, 0.92)',
  width: 3,
  seed: 82
}
const SIGN: SketchStyle = { fill: '#fff3bf', width: 3, seed: 80 }
/** The splat sign's cached area, with room for its strings and wobble. */
const SIGN_RECT = { x: 6, y: 34, width: 168, height: 124 }
const SIGN_STRING: SketchStyle = {
  width: 2,
  color: palette.inkSoft,
  passes: 1,
  seed: 81
}
const SIGN_SMALL: SketchTextStyle = { font: 'marker', size: 15 }
const SIGN_COUNT: SketchTextStyle = { font: 'marker', size: 38 }
const SCISSORS = { x: 0, y: 0 }

/** The wall: place blocks from the stool, hammer, re-hammer, and watch them sag. */
export class WallScene implements Scene {
  readonly id = 'wall' as const
  private press: Press | null = null
  private drag: Drag | null = null
  /** The stool strip's cached picture, and what it showed when painted. */
  private stoolLayer: CachedLayer | null = null
  private stoolKey = ''
  /** The splat sign's cached picture, and the minutes it showed. */
  private signLayer: CachedLayer | null = null
  private signMinutes = -1
  /** When the last hammer swing started, for the swing-down animation. */
  private swingAtMs = -Infinity
  private swingX = 0
  private swingY = 0
  private lastDrumMs = 0
  private readonly mopper: Mopper
  private readonly scraper: CellScraper
  /** The screw being turned in, if any. */
  private screwing: ScrewWork | null = null
  /** The mesh sheet being cut, if any. */
  private cutter: Cutter | null = null

  constructor(private readonly game: Game) {
    this.mopper = new Mopper(game, game.fx, splat =>
      toDesign(game.camera, splat.x, splat.y, MOP_POINT)
    )
    this.scraper = new CellScraper(game, game.fx, (x, y) =>
      toDesign(game.camera, x, y, MOP_POINT)
    )
  }

  /** The wall-room splat under a press in design units, above the stool strip. */
  private splatAt(x: number, y: number): Splat | null {
    if (y >= STOOL_TOP) return null
    const game = this.game
    const zoom = game.camera.zoom
    return splatAt(
      game.state.splats,
      x,
      y,
      Math.max(12, 24 / (game.viewport?.scale ?? 1)),
      s => (s.room === 'wall' ? toDesign(game.camera, s.x, s.y, POINT) : null),
      zoom
    )
  }

  enter(): void {}

  exit(): void {
    this.stoolLayer?.dispose()
    this.stoolLayer = null
    this.signLayer?.dispose()
    this.signLayer = null
    if (this.press) this.letGo(this.press)
    this.press = null
    this.drag = null
    this.mopper.release()
    this.scraper.release()
    this.cancelScrew(null)
    this.cutter = null
  }

  tip(): string {
    const game = this.game
    const critter = game.events.critters.tip() ?? game.events.heat.tip()
    if (critter) return critter
    if (this.cutter)
      return 'Drag the scissors along each dotted edge. Slowly, and on the line.'
    const stool = game.state.stool
    return wallTip(
      game.state,
      game.wall.handBlock !== null,
      game.tool,
      stool.length > 0 && stool.every(id => game.needsMesh(id)),
      showsFloor(game.camera.target)
    )
  }

  /** The block whose mesh sheet is being cut, for the dev API. */
  get meshCut(): Readonly<Cutter> | null {
    return this.cutter
  }

  // ---------------------------------------------------------------- Input

  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void {
    const game = this.game
    const phase = game.state.phase
    if (phase === 'cold-open') {
      game.coldOpen.advance()
      return
    }
    const final = phase === 'final'
    // The fly and the cat come first, except on the stool strip and the cutting mat.
    if (y < STOOL_TOP && !this.onMat(x, y) && this.pressCritter(x, y, pointer))
      return
    if (this.screwing) {
      this.pressScrew(x, y, timeMs)
      return
    }
    // During the final test the uncle sits in the stool strip.
    if (final && y >= STOOL_TOP) {
      if (x < ACTION_SLOT[0]) game.finalTest.poke()
      return
    }
    if (this.cutter) {
      if (y >= STOOL_TOP) this.pressStool(x)
      else if (this.onMat(x, y)) this.pressMesh(x, y, pointer, timeMs)
      else this.closeCutter()
      return
    }
    const w = toWorld(game.camera, x, y, WORLD)
    if (game.view === 'whole') {
      // In the final test a nail head re-hammers at Whole Wall too.
      if (final) {
        this.promoteUnder(w.x, w.y, pointer, false)
        const target = pickTarget({
          x: w.x,
          y: w.y,
          cssPerUnit: this.cssPerUnit(),
          pointer,
          nails: this.nailCandidates()
        })
        if (target.kind === 'nail') {
          this.beginPress(x, y, pointer, {
            kind: 'rehammer',
            aimX: w.x,
            aimY: w.y,
            blockId: target.blockId,
            fixingId: target.fixingId,
            zoomTap: true
          })
          return
        }
      } else {
        const splat = this.splatAt(x, y)
        if (splat) {
          this.mopper.press(splat, x, y, timeMs)
          return
        }
      }
      const section = sectionAt(w.x, w.y)
      if (section >= 0) game.viewSection(section)
      return
    }
    if (y >= STOOL_TOP) {
      this.pressStool(x)
      return
    }
    if (final) this.promoteUnder(w.x, w.y, pointer, true)
    const target = pickTarget({
      x: w.x,
      y: w.y,
      cssPerUnit: this.cssPerUnit(),
      pointer,
      nails: this.nailCandidates(),
      jelly: this.jellyCandidates()
    })
    if (target.kind === 'nail') {
      this.beginPress(x, y, pointer, {
        kind: 'rehammer',
        aimX: w.x,
        aimY: w.y,
        blockId: target.blockId,
        fixingId: target.fixingId
      })
      return
    }
    if (target.kind === 'jelly' && game.tool === 'screw') {
      this.startScrew(target.blockId, target.particle, x, y, timeMs)
      return
    }
    if (target.kind === 'jelly') {
      this.beginPress(x, y, pointer, {
        kind: 'hammer',
        aimX: w.x,
        aimY: w.y,
        blockId: target.blockId,
        fixingId: null
      })
      game.wall.steady(target.blockId, target.particle)
      return
    }
    const splat = this.splatAt(x, y)
    if (splat) {
      this.mopper.press(splat, x, y, timeMs)
      return
    }
    // Bare wall: only inside the active section, where a nail would go.
    const rect = sectionRect(game.state.section)
    const inside =
      w.x >= rect.x &&
      w.x <= rect.x + rect.width &&
      w.y >= rect.y &&
      w.y <= rect.y + rect.height
    if (final && (!inside || cellAt(game.state.section, w.x, w.y) < 0)) {
      // In the final test, tapping another section zooms to it; its frame zooms out.
      const other = sectionAt(w.x, w.y)
      if (other >= 0 && other !== game.state.section) game.viewSection(other)
      else game.viewWhole()
      return
    }
    if (!inside) return
    this.beginPress(x, y, pointer, {
      kind: 'hammer',
      aimX: w.x,
      aimY: w.y,
      blockId: null,
      fixingId: null
    })
  }

  /** Starts charging the hammer for a new nail or a re-hammer. */
  private beginPress(
    x: number,
    y: number,
    pointer: PointerKind,
    press: Omit<
      Press,
      'charge' | 'zones' | 'rub' | 'startX' | 'startY' | 'pointer' | 'zoomTap'
    > & { zoomTap?: boolean }
  ): void {
    const game = this.game
    const q =
      press.blockId === null
        ? 0.8
        : (game.state.blocks.get(press.blockId)?.q ?? 0.8)
    const assist = settings.get().assist
    const block =
      press.blockId === null ? undefined : game.state.blocks.get(press.blockId)
    // Section 1's slower hammer is for learning; the final test uses the normal one.
    const section = game.state.phase === 'final' ? -1 : game.state.section
    const charge = new HoldCharge({ fillMs: hammerFillMs(section, assist) })
    charge.start()
    this.press = {
      ...press,
      startX: x,
      startY: y,
      pointer,
      charge,
      zones: hammerZones(q, {
        assist,
        noodles: block?.noodles ?? false,
        rehammer: press.kind === 'rehammer'
      }),
      rub: false,
      zoomTap: press.zoomTap ?? false
    }
  }

  onDrag(x: number, y: number, timeMs: number): void {
    if (this.screwing) {
      this.turnScrew(x, y, timeMs)
      return
    }
    if (this.cutter) {
      this.dragCut(x, y, timeMs)
      return
    }
    if (this.mopper.active) {
      this.mopper.drag(x, y, timeMs)
      return
    }
    if (this.scraper.active) {
      this.scraper.drag(x, y, timeMs)
      return
    }
    if (this.drag) {
      this.drag.x = x
      this.drag.y = y
    }
    const press = this.press
    if (press && !press.rub) {
      const scale = this.game.viewport?.scale ?? 1
      if (isRub((x - press.startX) * scale, (y - press.startY) * scale)) {
        // A moving press is a rub: no hammer, no nail spent. On a dirty empty cell it
        // scrapes the old jelly off.
        press.rub = true
        press.charge.reset()
        this.letGo(press)
        if (press.kind === 'hammer' && press.blockId === null)
          this.startScraping(press, x, y, timeMs)
      }
    }
  }

  onRelease(x: number, y: number): void {
    if (this.screwing) {
      this.screwing.pressed = false
      this.screwing.gesture.end()
      return
    }
    if (this.cutter) {
      releaseMesh(this.cutter.cut)
      return
    }
    if (this.mopper.active) {
      this.mopper.release()
      return
    }
    if (this.scraper.active) {
      this.scraper.release()
      return
    }
    if (this.drag) {
      this.dropGhost(x, y)
      this.drag = null
    }
    const press = this.press
    this.press = null
    if (!press || press.rub) return
    const level = press.charge.release()
    // A quick tap on a nail at Whole Wall zooms to its section; a hold hammers it.
    if (press.zoomTap && level < WEAK_BELOW) {
      const section = sectionAt(press.aimX, press.aimY)
      if (section >= 0) this.game.viewSection(section)
      return
    }
    this.hit(press, level)
    this.letGo(press)
  }

  /** Your free hand lets go of the block a hammer press steadied. */
  private letGo(press: Press): void {
    if (press.kind === 'hammer' && press.blockId !== null)
      this.game.wall.letGo(press.blockId)
  }

  onKey(code: string, down: boolean): void {
    if (code !== 'Space') return
    if (this.game.state.phase === 'cold-open') {
      if (down) this.game.coldOpen.advance()
      return
    }
    const pointer = this.game.pointer
    if (!pointer) return
    if (down && !this.press && !this.drag && pointer.y < STOOL_TOP)
      this.onPress(pointer.x, pointer.y, 'mouse', performance.now())
    else if (!down && this.press) this.onRelease(pointer.x, pointer.y)
  }

  /** A rub that began on a dirty empty cell of the active section scrapes it. */
  private startScraping(
    press: Press,
    x: number,
    y: number,
    timeMs: number
  ): void {
    const state = this.game.state
    const cell = cellAt(state.section, press.aimX, press.aimY)
    const slot = state.sections[state.section]?.cells[cell]
    if (!slot || slot.block !== null || !dirtyCell(slot)) return
    this.press = null
    this.scraper.start(state.section, cell, press.startX, press.startY, timeMs)
    this.scraper.drag(x, y, timeMs)
  }

  /** Whether a press lands on the open cutting mat. */
  private onMat(x: number, y: number): boolean {
    if (!this.cutter) return false
    const [mx, my, mw, mh] = MESH.mat
    return x >= mx && x <= mx + mw && y >= my && y <= my + mh
  }

  /**
   * In the final test, a press on a proxy's nail (or, with `jelly`, on its jelly) turns
   * it into a soft body first, so the hammer works on it like any other block.
   */
  private promoteUnder(
    x: number,
    y: number,
    pointer: PointerKind,
    jelly: boolean
  ): void {
    const proxies = this.game.proxies
    if (proxies.proxies.size === 0) return
    const css = this.cssPerUnit()
    const hit = proxies.nearest(
      x,
      y,
      worldRadius(NAIL_HIT, css, pointer),
      jelly ? worldRadius(JELLY_HIT, css, pointer) : 0
    )
    if (hit) proxies.promote(hit.blockId, true)
  }

  /** True while a press or a screw works on this block, so it stays a soft body. */
  working(blockId: number): boolean {
    return this.press?.blockId === blockId || this.screwing?.blockId === blockId
  }

  /** Swats the fly or shoos the cat under a press. Returns whether one was there. */
  private pressCritter(x: number, y: number, pointer: PointerKind): boolean {
    const critters = this.game.events.critters
    if (!critters.busy) return false
    const w = toWorld(this.game.camera, x, y, POINT)
    const target = pickTarget({
      x: w.x,
      y: w.y,
      cssPerUnit: this.cssPerUnit(),
      pointer,
      critters: critters.candidates()
    })
    if (target.kind !== 'critter') return false
    critters.hit(target.critter, x, y)
    return true
  }

  /** Starts dragging the block in a stool slot. */
  private pressStool(x: number): void {
    const game = this.game
    const slot = Math.floor((x - STOOL_LEFT) / STOOL_SLOT_W)
    if (slot < 0 || slot >= STOOL_SLOTS) return
    const blockId = game.state.stool[slot]
    if (blockId === undefined) return
    if (game.wall.handBlock !== null) {
      game.fx.caption('One block at a time.', 210, STOOL_TOP - 10, {
        world: false,
        size: 26,
        color: palette.red
      })
      sfx.play('boing', { volume: 0.4, pitch: 1.4 })
      return
    }
    // With Mesh Backing, a block needs its sheet cut before it can go up.
    if (game.needsMesh(blockId)) {
      if (this.cutter?.blockId === blockId) this.closeCutter()
      else this.openCutter(blockId)
      return
    }
    this.cutter = null
    this.drag = { blockId, x, y: STOOL_TOP + 70 }
    sfx.play('squish', { volume: 0.4, pitch: 1.2 })
  }

  private dropGhost(x: number, y: number): void {
    const game = this.game
    const drag = this.drag!
    const w = toWorld(game.camera, x, y, POINT)
    const cell = cellAt(game.state.section, w.x, w.y)
    const residue =
      game.state.sections[game.state.section]?.cells[cell]?.residue ?? 0
    if (cell >= 0 && game.wall.place(drag.blockId, cell)) {
      sfx.play('squish', { pitch: 0.9 })
      if (residue > 0) {
        const c = cellCentre(game.state.section, cell)
        game.fx.caption('On old jelly? It will slide.', c.x, c.y - 70, {
          size: 24,
          color: palette.orange
        })
      }
      return
    }
    sfx.play('whoosh', { volume: 0.4 })
  }

  private hit(press: Press, charge: number): void {
    const game = this.game
    this.swingAtMs = game.state.simMs
    this.swingX = press.startX
    this.swingY = press.startY
    if (press.kind === 'rehammer') {
      game.wall.rehammer(press.blockId!, press.fixingId!, charge)
      return
    }
    if (game.tool === 'screw') {
      // Screws only go into jelly; a tap on bare wall spends nothing.
      game.fx.caption('Screws go in the jelly.', press.aimX, press.aimY - 30, {
        size: 24,
        color: palette.inkSoft
      })
      sfx.play('boing', { volume: 0.3, pitch: 1.5 })
      return
    }
    const stock = game.economy.stock
    if (!stock.has('nails')) {
      game.fx.caption('Out of nails!', press.aimX, press.aimY, {
        color: palette.red
      })
      sfx.play('fail', { volume: 0.5 })
      return
    }
    stock.use('nails')
    game.state.stats.nailsUsed++
    const target = this.aimParticle(press)
    if (target) game.wall.hammer(target.blockId, target.particle, charge)
    else {
      game.state.stats.bareWallNails++
      game.wall.nailWall(press.aimX, press.aimY)
    }
  }

  // ---------------------------------------------------------------- Mesh

  /** Lays a fresh sheet on the cutting mat for a stool block. */
  private openCutter(blockId: number): void {
    this.cutter = {
      blockId,
      cut: createMeshCut(MESH.sheet),
      touch: false,
      snapAtMs: -Infinity
    }
    sfx.play('whoosh', { volume: 0.3, pitch: 1.4 })
  }

  /** Puts the sheet down. A half-cut sheet is thrown away. */
  private closeCutter(): void {
    if (!this.cutter) return
    this.cutter = null
    sfx.play('whoosh', { volume: 0.25, pitch: 0.8 })
  }

  /** A press on the mat picks up the scissors, if it lands near them. */
  private pressMesh(
    x: number,
    y: number,
    pointer: PointerKind,
    timeMs: number
  ): void {
    const cutter = this.cutter!
    cutter.touch = pointer === 'touch'
    const scale = this.game.viewport?.scale ?? 1
    const grab = cutter.touch
      ? Math.max(MESH.grab, MESH.grabTouchPx / scale)
      : MESH.grab
    if (grabMesh(cutter.cut, x, y, timeMs, grab)) {
      sfx.play('snip', { volume: 0.5 })
      return
    }
    const s = scissorsAt(cutter.cut, SCISSORS)
    this.game.fx.caption('Start at the scissors.', s.x, s.y - 40, {
      world: false,
      size: 26,
      color: palette.red
    })
    sfx.play('boing', { volume: 0.3, pitch: 1.5 })
  }

  private dragCut(x: number, y: number, timeMs: number): void {
    const cutter = this.cutter!
    const scale = this.game.viewport?.scale ?? 1
    const events = dragMesh(cutter.cut, x, y, timeMs, {
      tolerance: meshTolerance(settings.get().assist, cutter.touch, scale),
      speedLimit: MESH.speedLimit
    })
    for (const event of events) this.onCutEvent(cutter, event, x, y)
  }

  private onCutEvent(
    cutter: Cutter,
    event: MeshEvent,
    x: number,
    y: number
  ): void {
    const game = this.game
    const fx = game.fx
    const say = (text: string, colour: string, size = 28) =>
      fx.caption(text, x, y - 50, { world: false, size, color: colour })
    switch (event) {
      case 'snip':
        sfx.play('snip', { volume: 0.45, pitch: randRange(0.9, 1.15) })
        break
      case 'corner':
        sfx.play('click', { pitch: 1.3 })
        break
      case 'ragged':
        sfx.play('squish', { volume: 0.4, pitch: 1.6 })
        say('Ragged.', palette.orange)
        break
      case 'snap':
        cutter.snapAtMs = game.state.simMs
        sfx.play('boing')
        fx.shake(4)
        say('Too fast! It snapped back.', palette.red, 30)
        break
      case 'done': {
        const block = game.state.blocks.get(cutter.blockId)
        const help = meshHelp(cutter.cut)
        if (block) block.mesh = help
        this.cutter = null
        const clean = help === 1
        sfx.play(clean ? 'ding' : 'tick', { pitch: clean ? 1.2 : 0.7 })
        fx.caption(
          clean ? 'Mesh cut!' : 'Ragged. Half the help.',
          300,
          STOOL_TOP - 30,
          {
            world: false,
            size: clean ? 36 : 30,
            color: clean ? palette.green : palette.orange
          }
        )
        break
      }
    }
  }

  // ---------------------------------------------------------------- Screws

  /** A tap on jelly with screws in hand: the screw goes in the spot, ready to turn. */
  private startScrew(
    blockId: number,
    particle: number,
    x: number,
    y: number,
    timeMs: number
  ): void {
    const game = this.game
    if (!game.economy.stock.use('screws')) {
      game.fx.caption('Out of screws! Switch to nails.', x, y - 40, {
        world: false,
        size: 26,
        color: palette.red
      })
      sfx.play('fail', { volume: 0.5 })
      return
    }
    const p = game.wall.bodyOf(blockId)?.soft.bodies[particle]?.position
    const at = p ? toDesign(game.camera, p.x, p.y, POINT) : { x, y }
    this.screwing = {
      blockId,
      particle,
      x: at.x,
      y: at.y,
      gesture: new CircleGesture({
        center: { x: at.x, y: at.y },
        minRadius: SCREW.minRadius
      }),
      job: createScrewJob(timeMs),
      pressed: true,
      fingerX: x,
      fingerY: y
    }
    sfx.play('click', { pitch: 0.7 })
    this.turnScrew(x, y, timeMs)
  }

  /** A new press while a screw waits: keep turning, timing the circle from now. */
  private pressScrew(x: number, y: number, timeMs: number): void {
    const work = this.screwing!
    work.pressed = true
    if (work.gesture.progress < 0.05) work.job.circleStartMs = timeMs
    this.turnScrew(x, y, timeMs)
  }

  private turnScrew(x: number, y: number, timeMs: number): void {
    const work = this.screwing
    if (!work?.pressed) return
    work.fingerX = x
    work.fingerY = y
    if (work.gesture.add(x, y, timeMs) === 0) return
    const game = this.game
    const assist = settings.get().assist
    for (const event of screwCircle(work.job, timeMs, assist)) {
      if (event === 'turn')
        sfx.play('crank', { volume: 0.6, pitch: 0.9 + 0.12 * work.job.circles })
      else if (event === 'strip') {
        const tears = game.wall.strip(work.blockId, work.particle)
        sfx.play('squish', { pitch: 0.8 })
        game.fx.shake(3)
        game.fx.caption('Stripped it. Slower!', work.x, work.y - 70, {
          world: false,
          size: 28,
          color: palette.red
        })
        if (tears > 0) sfx.play('squish', { volume: 0.4, pitch: 1.4 })
      } else {
        const grip = screwGrip(work.gesture.evenness, work.job.strips)
        game.wall.screw(work.blockId, work.particle, grip, work.job.strips)
        this.screwing = null
      }
    }
  }

  /** Drops the screw job, with a caption when the block went with it. */
  cancelScrew(caption: string | null): void {
    const work = this.screwing
    if (!work) return
    this.screwing = null
    if (caption)
      this.game.fx.caption(caption, work.x, work.y - 50, {
        world: false,
        size: 26,
        color: palette.red
      })
    // A block still on the wall keeps the screw you never turned: back in the box.
    else this.game.economy.stock.add('screws', 1)
  }

  /** The particle a new nail would go into if the hammer came down now. */
  /** Where a new nail would go if the hammer landed now (see `nailTarget`). */
  private aimParticle(press: Press): JellyCandidate | null {
    return nailTarget(
      this.jellyCandidates(),
      press.aimX,
      press.aimY,
      worldRadius(JELLY_HIT, this.cssPerUnit(), press.pointer),
      press.blockId
    )
  }

  private cssPerUnit(): number {
    return (this.game.viewport?.scale ?? 1) * this.game.camera.zoom
  }

  private nailCandidates(): NailCandidate[] {
    const out: NailCandidate[] = []
    for (const id of this.game.wall.liveIds()) {
      const block = this.game.state.blocks.get(id)
      if (!block || block.cause !== null) continue
      for (const f of block.fixings)
        out.push({ blockId: id, fixingId: f.id, x: f.x, y: f.y })
    }
    return out
  }

  private jellyCandidates(): JellyCandidate[] {
    const out: JellyCandidate[] = []
    const { state, wall } = this.game
    for (const id of wall.liveIds()) {
      const block = state.blocks.get(id)
      if (!block || block.cause !== null) continue
      if (block.status !== 'held' && block.status !== 'up') continue
      wall
        .bodyOf(id)
        ?.soft.bodies.forEach((p, particle) =>
          out.push({ blockId: id, particle, x: p.position.x, y: p.position.y })
        )
    }
    return out
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.press?.charge.update(dtMs)
    // The sheet goes when its block leaves the stool, needs no cutting any more, or the
    // uncle arrives for the final test.
    if (
      this.cutter &&
      (!this.game.needsMesh(this.cutter.blockId) ||
        this.game.state.phase !== 'play')
    )
      this.cutter = null
    const work = this.screwing
    if (work) {
      const block = this.game.state.blocks.get(work.blockId)
      const alive =
        block?.cause === null &&
        (block.status === 'held' || block.status === 'up')
      if (!alive) this.cancelScrew('It fell off the screwdriver.')
    }
    // Drum roll over the last stretch of the hold or the final test: ticks that speed up
    // and rise in pitch.
    const left = this.holdLeftMs()
    if (left !== null && left < DRUM_ROLL_MS) {
      const progress = 1 - left / DRUM_ROLL_MS
      const gap = 260 - 170 * progress
      if (this.game.state.simMs - this.lastDrumMs >= gap) {
        this.lastDrumMs = this.game.state.simMs
        sfx.play('tick', {
          pitch: 0.7 + progress * 0.9,
          volume: 0.5 + progress * 0.5
        })
      }
    }
  }

  /** Time left on the running hold or final test, or null when neither runs. */
  private holdLeftMs(): number | null {
    const state = this.game.state
    if (state.phase === 'final')
      return state.final?.stage === 'test' ? state.final.holdLeftMs : null
    const section = state.sections[state.section]
    return section?.holdActive ? section.holdLeftMs : null
  }

  draw(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const game = this.game
    const viewport = game.viewport
    if (!viewport) return
    const cam = game.camera
    game.fx.shakeOffset(SHAKE)
    VIEW.x = cam.x - SHAKE.x / cam.zoom
    VIEW.y = cam.y - SHAKE.y / cam.zoom
    VIEW.zoom = cam.zoom
    VIEW.anchorX = cam.anchorX
    VIEW.anchorY = cam.anchorY
    const v = viewport.view
    VISIBLE.x = (v.x - VIEW.anchorX) / VIEW.zoom + VIEW.x
    VISIBLE.y = (v.y - VIEW.anchorY) / VIEW.zoom + VIEW.y
    VISIBLE.width = v.width / VIEW.zoom
    VISIBLE.height = v.height / VIEW.zoom

    const press = this.press
    const aim =
      press && !press.rub && press.kind === 'hammer'
        ? this.aimParticle(press)
        : null
    pruneSplatCache(game.state)
    drawWall(ctx, VIEW, viewport, {
      state: game.state,
      wall: game.wall,
      layers: game.layers,
      proxies: game.proxies,
      timeMs,
      visible: VISIBLE,
      litNail:
        press && !press.rub && press.kind === 'rehammer'
          ? press.fixingId
          : null,
      target: aim ? { blockId: aim.blockId, particle: aim.particle } : null,
      heckleMs: game.heckleMs,
      uncle: game.portrait,
      extras: game.drawWallExtras
    })
    viewport.apply(ctx)
    game.events.heat.drawOverlay(ctx, timeMs)
    // During the final test his clock hangs where the splat sign was. At Whole Wall the
    // sign would cover section 5, so it stays at Section framing.
    if (game.state.phase !== 'final' && game.view === 'section')
      this.drawSign(ctx)
    game.events.drawWindow(ctx, timeMs)
    this.drawHold(ctx)
    if (game.state.phase === 'final') {
      game.finalTest.drawArrows(ctx)
      game.finalTest.drawStrip(ctx, timeMs)
    } else this.drawStool(ctx, timeMs)
    this.drawGhost(ctx)
    this.drawHammer(ctx)
    this.drawScrew(ctx, timeMs)
    this.drawCutter(ctx, timeMs)
    this.mopper.draw(ctx, timeMs)
    this.scraper.draw(ctx)
    game.events.critters.drawOverlay(ctx)
    if (game.state.phase === 'cold-open') game.coldOpen.draw(ctx, timeMs)
    game.fx.drawCaptions(ctx, VIEW)
  }

  // ---------------------------------------------------------------- Overlays (design units)

  /** "Minutes without a splat", hanging top left. Every splat resets it to 0. */
  private drawSign(ctx: CanvasRenderingContext2D): void {
    const viewport = this.game.viewport
    if (!viewport) return
    const minutes = minutesWithoutSplat(this.game.state)
    this.signLayer ??= new CachedLayer(
      viewport,
      layer => this.paintSign(layer, this.signMinutes),
      SIGN_RECT
    )
    if (minutes !== this.signMinutes) {
      this.signMinutes = minutes
      this.signLayer.invalidate()
    }
    this.signLayer.draw(ctx)
  }

  private paintSign(ctx: CanvasRenderingContext2D, minutes: number): void {
    sketchLine(ctx, 50, 40, 36, 66, SIGN_STRING)
    sketchLine(ctx, 124, 40, 138, 66, SIGN_STRING)
    sketchRoundRect(ctx, 14, 64, 150, 86, 8, SIGN)
    sketchText(ctx, 'MINUTES WITHOUT', 89, 80, SIGN_SMALL)
    sketchText(ctx, 'A SPLAT', 89, 97, SIGN_SMALL)
    SIGN_COUNT.color = minutes === 0 ? palette.red : palette.ink
    sketchText(ctx, String(minutes), 89, 126, SIGN_COUNT)
  }

  /** The hold countdown, or the final test's clock while the uncle visits. */
  private drawHold(ctx: CanvasRenderingContext2D): void {
    const state = this.game.state
    const section = state.sections[state.section]
    const clock =
      state.phase === 'final'
        ? this.game.finalTest.clock()
        : section?.holdActive
          ? { label: 'HOLD', ms: section.holdLeftMs, urgent: true }
          : null
    if (!clock) return
    let x = state.phase === 'final' ? FINAL_CLOCK_X : HOLD_X
    let y = 72
    if (this.game.view === 'whole') {
      // At Whole Wall the top left is section 5, so the clock hangs on a plate over the
      // uncle's portrait instead.
      const c = toDesign(this.game.camera, CLOCK_PLATE_X, CLOCK_PLATE_Y, POINT)
      sketchRoundRect(ctx, c.x - 100, c.y - 56, 200, 112, 12, CLOCK_PLATE)
      x = c.x
      y = c.y - 28
    }
    const stopped = clock.label === 'STOPPED'
    const drum = clock.urgent && (stopped || clock.ms < DRUM_ROLL_MS)
    const pulse = drum && !stopped ? 1 + 0.08 * Math.sin(state.simMs * 0.03) : 1
    // Low enough to stay clear of the phone tip bubble over the design's top band.
    sketchText(ctx, clock.label, x, y, {
      font: 'marker',
      size: clock.label.length > 6 ? 22 : 26,
      color: stopped ? palette.red : palette.inkSoft
    })
    sketchText(ctx, clock.text ?? formatClock(clock.ms), x, y + 44, {
      font: 'marker',
      size: 56 * pulse,
      color: drum ? palette.red : palette.ink,
      outline: palette.paper
    })
  }

  /**
   * The stool strip from its cached picture, repainted when the blocks on it, the hand
   * or a drag change. Only the "Nail it first" wobble draws live.
   */
  private drawStool(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const { state, wall, viewport } = this.game
    if (!viewport) return
    const busy = wall.handBlock !== null
    let key = `${busy} ${state.stool.length} ${this.drag?.blockId} ${this.cutter?.blockId}`
    for (let i = 0; i < STOOL_SLOTS && i < state.stool.length; i++) {
      const id = state.stool[i]!
      const block = state.blocks.get(id)
      key += ` ${id} ${block?.mesh} ${block?.noodles} ${this.game.needsMesh(id)}`
    }
    this.stoolLayer ??= new CachedLayer(
      viewport,
      layer => this.paintStool(layer),
      STOOL_RECT
    )
    if (key !== this.stoolKey) {
      this.stoolKey = key
      this.stoolLayer.invalidate()
    }
    this.stoolLayer.draw(ctx)
    if (busy)
      sketchText(ctx, 'Nail it first', 210, STOOL_TOP + 84, {
        font: 'marker',
        size: 26,
        color: palette.red,
        outline: palette.paper,
        rotate: -0.05 + Math.sin(timeMs * 0.004) * 0.02
      })
  }

  /** The stool strip as it stands: the stool, its slots, the blocks and their words. */
  private paintStool(ctx: CanvasRenderingContext2D): void {
    const { state, wall } = this.game
    const busy = wall.handBlock !== null
    sketchRect(
      ctx,
      STOOL_LEFT - 4,
      STOOL_TOP + 22,
      STOOL_SLOT_W * STOOL_SLOTS + 8,
      118,
      STOOL_BG
    )
    sketchText(ctx, 'Stool', STOOL_LEFT + 30, STOOL_TOP + 12, {
      size: 20,
      color: palette.inkSoft
    })
    const previous = ctx.globalAlpha
    if (busy) ctx.globalAlpha = previous * 0.5
    for (let i = 0; i < STOOL_SLOTS; i++) {
      const x = STOOL_LEFT + i * STOOL_SLOT_W
      STOOL_SLOT.seed = 30 + i
      sketchRoundRect(
        ctx,
        x + 6,
        STOOL_TOP + 34,
        STOOL_SLOT_W - 12,
        94,
        10,
        STOOL_SLOT
      )
      const id = state.stool[i]
      if (id === undefined || id === this.drag?.blockId) continue
      const block = state.blocks.get(id)
      if (!block) continue
      const stacked =
        i === STOOL_SLOTS - 1 ? state.stool.length - STOOL_SLOTS : 0
      const cx = x + STOOL_SLOT_W / 2
      const cy = STOOL_TOP + 78
      const cloud = cloudiness(block.make)
      const lumps = lumpCount(block.make)
      if (stacked > 0)
        drawGhostBlock(
          ctx,
          cx + 4,
          cy - 8,
          STOOL_GHOST_SCALE,
          block.flavour,
          cloud,
          lumps,
          id + 1
        )
      drawGhostBlock(
        ctx,
        cx,
        cy,
        STOOL_GHOST_SCALE,
        block.flavour,
        cloud,
        lumps,
        id,
        block.mesh,
        block.noodles
      )
      if (this.game.needsMesh(id)) {
        // A dashed outline: this one still needs its mesh cut.
        ctx.save()
        ctx.setLineDash([7, 5])
        ctx.strokeStyle = this.cutter?.blockId === id ? palette.red : NEEDS_MESH
        ctx.lineWidth = 3
        ctx.strokeRect(x + 10, STOOL_TOP + 40, STOOL_SLOT_W - 20, 62)
        ctx.restore()
      }
      const word = qualityWord(block.q)
      WORD.color = QUALITY_COLOURS[word]
      sketchText(ctx, word, cx, STOOL_TOP + 116, WORD)
      if (stacked > 0)
        sketchText(ctx, `+${stacked}`, cx + 18, cy - 34, {
          font: 'marker',
          size: 22,
          outline: palette.paper
        })
    }
    ctx.globalAlpha = previous
    if (!busy && state.stool.length === 0)
      sketchText(ctx, 'Stool is empty', 210, STOOL_TOP + 84, {
        size: 24,
        color: palette.inkSoft
      })
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    const drag = this.drag
    if (!drag) return
    const game = this.game
    const block = game.state.blocks.get(drag.blockId)
    if (!block) return
    const w = toWorld(game.camera, drag.x, drag.y, POINT)
    const cell = cellAt(game.state.section, w.x, w.y)
    const free =
      cell >= 0 &&
      game.state.sections[game.state.section]?.cells[cell]?.block === null
    if (free) {
      const r = cellRect(game.state.section, cell)
      const p = toDesign(game.camera, r.x, r.y, POINT)
      ctx.save()
      ctx.setLineDash([10, 6])
      ctx.strokeStyle = CELL_OK
      ctx.lineWidth = 4
      ctx.strokeRect(
        p.x + 6,
        p.y + 6,
        (CELL_W - 12) * game.camera.zoom,
        (CELL_H - 12) * game.camera.zoom
      )
      ctx.restore()
    }
    const zoom = game.camera.zoom
    const previous = ctx.globalAlpha
    ctx.globalAlpha = previous * 0.85
    drawGhostBlock(
      ctx,
      drag.x,
      drag.y,
      zoom,
      block.flavour,
      cloudiness(block.make),
      lumpCount(block.make),
      block.id,
      block.mesh,
      block.noodles
    )
    ctx.globalAlpha = previous
    // What you are holding, above your finger: "Wobbly: lumpy".
    DRAG_LABEL.color = QUALITY_COLOURS[qualityWord(block.q)]
    sketchText(
      ctx,
      qualityLabel(block.q, block.make),
      drag.x,
      drag.y - (GHOST_H * zoom) / 2 - 26,
      DRAG_LABEL
    )
  }

  /** The charge arc around the press point and the hammer winding up, then swinging down. */
  private drawHammer(ctx: CanvasRenderingContext2D): void {
    const press = this.press
    const now = this.game.state.simMs
    let x: number
    let y: number
    let angle: number
    if (press && !press.rub) {
      x = press.startX
      y = press.startY
      const level = press.charge.level
      this.drawMeter(ctx, x, y, level, press.zones)
      angle = -0.3 - level * 1.3
    } else if (now - this.swingAtMs < 160) {
      x = this.swingX
      y = this.swingY
      angle = 0.35
    } else return
    const hx = x + 34
    const hy = y - 30
    ctx.save()
    ctx.translate(hx, hy)
    ctx.rotate(angle)
    sketchLine(ctx, 0, 0, 0, -70, HAMMER_HANDLE)
    sketchRect(ctx, -26, -88, 52, 22, HAMMER_HEAD)
    ctx.restore()
  }

  /**
   * The cutting mat with the mesh sheet, its edges (cut, ragged or still dotted), the
   * scissors and how many edges are left.
   */
  private drawCutter(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const cutter = this.cutter
    if (!cutter) return
    const cut = cutter.cut
    const [mx, my, mw, mh] = MESH.mat
    sketchRoundRect(ctx, mx, my, mw, mh, 14, MAT)
    ctx.strokeStyle = MAT_GRID
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let gx = mx + 24; gx < mx + mw; gx += 24) {
      ctx.moveTo(gx, my + 8)
      ctx.lineTo(gx, my + mh - 8)
    }
    for (let gy = my + 24; gy < my + mh; gy += 24) {
      ctx.moveTo(mx + 8, gy)
      ctx.lineTo(mx + mw - 8, gy)
    }
    ctx.stroke()
    sketchText(
      ctx,
      `Mesh: edge ${cut.edge + 1} of 4`,
      mx + mw / 2 + 20,
      my + 24,
      CUT_LABEL
    )
    sketchText(
      ctx,
      'Tap off the mat to put it down',
      mx + mw / 2,
      my + mh - 18,
      CUT_HELP
    )
    // The sheet wobbles for a moment after it snaps back.
    const since = this.game.state.simMs - cutter.snapAtMs
    const wobble =
      since < 400 ? Math.sin(since * 0.06) * (1 - since / 400) * 6 : 0
    const [sx, sy, sw, sh] = MESH.sheet
    sketchRect(ctx, sx, sy + wobble, sw, sh, SHEET)
    sketchRect(ctx, sx, sy + wobble, sw, sh, SHEET_CROSS)
    for (let i = 0; i < 4; i++) {
      const e = meshEdge(cut, i)
      const ex = e.ax + e.dx * e.length
      const ey = e.ay + e.dy * e.length
      if (i < cut.edge || cut.done) {
        const style = cut.ragged[i] ? RAGGED_LINE : CUT_LINE
        style.seed = 73 + i
        sketchLine(ctx, e.ax, e.ay, ex, ey, style)
        continue
      }
      // The part still to cut is dotted; the current edge's cut part is solid.
      const from = i === cut.edge ? cut.progress : 0
      if (from > 0) {
        const style = cut.ragged[i] ? RAGGED_LINE : CUT_LINE
        style.seed = 77 + i
        sketchLine(
          ctx,
          e.ax,
          e.ay,
          e.ax + e.dx * from,
          e.ay + e.dy * from,
          style
        )
      }
      ctx.save()
      ctx.setLineDash([10, 9])
      ctx.lineDashOffset = i === cut.edge ? -timeMs * 0.02 : 0
      ctx.strokeStyle = i === cut.edge ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = i === cut.edge ? 4 : 3
      ctx.beginPath()
      ctx.moveTo(
        e.ax + e.dx * from,
        e.ay + e.dy * from + (i === cut.edge ? wobble : 0)
      )
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.restore()
    }
    this.drawScissors(ctx, cutter, timeMs)
  }

  /** Open scissors at the cut, pointing along the edge; they chop while you trace. */
  private drawScissors(
    ctx: CanvasRenderingContext2D,
    cutter: Cutter,
    timeMs: number
  ): void {
    const cut = cutter.cut
    const s = scissorsAt(cut, SCISSORS)
    const e = meshEdge(cut, cut.edge)
    const open = cut.tracing
      ? 0.18 + 0.16 * Math.abs(Math.sin(timeMs * 0.02))
      : 0.3
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(Math.atan2(e.dy, e.dx))
    for (let side = -1; side <= 1; side += 2) {
      ctx.save()
      ctx.rotate(side * open)
      BLADE.seed = 75 + side
      sketchEllipse(ctx, 18, 0, 22, 5, BLADE)
      LOOP.seed = 76 + side
      sketchCircle(ctx, -18, side * 10, 9, LOOP)
      ctx.restore()
    }
    ctx.restore()
    if (!cut.tracing) {
      // A pulsing ring says where to press.
      const pulse = 1 + 0.15 * Math.sin(timeMs * 0.008)
      GUIDE.seed = 45
      sketchCircle(ctx, s.x, s.y, 30 * pulse, GUIDE)
    }
  }

  /** The screw in the jelly, a crank from it to your finger, and the circles left. */
  private drawScrew(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const work = this.screwing
    if (!work) return
    const game = this.game
    const p = game.wall.bodyOf(work.blockId)?.soft.bodies[work.particle]
      ?.position
    const at = p ? toDesign(game.camera, p.x, p.y, POINT) : work
    const x = at.x
    const y = at.y
    const g = work.gesture
    if (g.circles === 0 && !work.pressed) {
      // A dashed circle shows where to turn, before the first circle.
      ctx.save()
      ctx.setLineDash([10, 8])
      ctx.lineDashOffset = -timeMs * 0.03
      GUIDE.seed = 44
      sketchCircle(ctx, x, y, 64, GUIDE)
      ctx.restore()
    }
    if (work.pressed) {
      sketchLine(ctx, x, y, work.fingerX, work.fingerY, SHAFT)
      sketchCircle(ctx, work.fingerX, work.fingerY, 16, GRIP)
    }
    sketchCircle(ctx, x, y, 9, SCREW_HEAD)
    const a = g.turn + g.circles * Math.PI
    const cx = Math.cos(a) * 6
    const cy = Math.sin(a) * 6
    sketchLine(ctx, x - cx, y - cy, x + cx, y + cy, SCREW_SLOT)
    sketchLine(ctx, x + cy, y - cx, x - cy, y + cx, SCREW_SLOT)
    SCREW_LABEL.color = work.job.strips > 0 ? palette.orange : palette.ink
    sketchText(
      ctx,
      g.circles === 0 && !work.pressed
        ? 'Circle it slowly'
        : `Screw ${g.circles} / ${SCREW.circles}`,
      Math.min(480, Math.max(120, x)),
      y + 84,
      SCREW_LABEL
    )
  }

  private drawMeter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    level: number,
    zones: HammerZones
  ): void {
    const r = 58
    const start = Math.PI * 0.8
    const sweep = Math.PI * 1.4
    const at = (v: number) => start + sweep * Math.min(1, v)
    sketchCircle(ctx, x, y, r, METER_TRACK)
    const split = Math.min(1, zones.split)
    ctx.lineWidth = 9
    ctx.lineCap = 'butt'
    const band = (from: number, to: number, colour: string) => {
      if (to <= from) return
      ctx.strokeStyle = colour
      ctx.beginPath()
      ctx.arc(x, y, r, at(from), at(to))
      ctx.stroke()
    }
    band(0, zones.loose, GREY_BAND)
    band(zones.loose, zones.sweetFrom, palette.yellow)
    band(zones.sweetFrom, zones.sweetTo, palette.green)
    band(zones.sweetTo, split, palette.orange)
    band(split, 1, palette.red)
    const a = at(level)
    sketchLine(
      ctx,
      x + Math.cos(a) * (r - 14),
      y + Math.sin(a) * (r - 14),
      x + Math.cos(a) * (r + 12),
      y + Math.sin(a) * (r + 12),
      NEEDLE
    )
  }
}
