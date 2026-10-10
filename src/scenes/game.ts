import {
  createHud,
  createLayout,
  type HudSnapshot,
  type LayoutSnapshot
} from '../game/hud'
import { carryRoute, createCarry } from '../game/carry'
import { hallwayCatAt } from '../game/critters'
import { CHORES, MOP_CHORES } from '../game/chores'
import { oddJobOffered, restockNeeds, type Supplies } from '../game/economy'
import type { BatchOptions } from '../game/kitchen'
import {
  batchOptions,
  type JellyUpgrade,
  type UpgradeId
} from '../game/upgrades'
import { dirtyCells, messyRooms, routePuddles } from '../game/mess'
import { longSectionEase } from '../game/grip'
import { blameLine, heldForLabel, whereYouWere } from '../game/labels'
import {
  AlertLimiter,
  clipDue,
  clipLabel,
  splatStats,
  wantsCutaway,
  type PendingClip
} from '../game/replays'
import { blockNailLevelFor } from '../game/warnings'
import { batchNote, spillOnFloor, unloadTray } from '../game/kitchen'
import {
  currentTip,
  firstTime,
  lessonRip,
  nextTip,
  scriptedSagBlock,
  scriptedSagGrip,
  showTip,
  watchLesson,
  type TipId
} from '../game/tutorial'
import { bowlsDirty } from '../game/wash'
import { noodlesReady } from '../game/noodles'
import { PauseClock, shiftTimer } from '../game/pause'
import { AVERAGE_INPUTS, blockQuality } from '../game/quality'
import {
  ROOMS,
  saggingCount,
  startWipe,
  stepWipe,
  type RoomId,
  type Wipe
} from '../game/rooms'
import {
  allLocked,
  isUp,
  updateSection,
  upCount,
  type SectionEvent
} from '../game/section'
import {
  aimCamera,
  createCamera,
  sectionView,
  showsFloor,
  snapCamera,
  toDesign,
  updateCamera,
  wholeView,
  type Camera,
  type CameraView,
  type Framing
} from '../game/sim/camera'
import { cellCentre, sectionCentre } from '../game/sim/geometry'
import { ProxyWall } from '../game/sim/proxies'
import { WallSim, type SimEvent } from '../game/sim/wallSim'
import {
  addStoolBlock,
  createEconomy,
  createGameState,
  type Economy
} from '../game/state'
import {
  CUTAWAY_AFTER_SPLAT_MS,
  CUTAWAY_MAX_MS,
  CUTAWAY_MS,
  DESIGN_WIDTH,
  FLOOR_Y,
  KNOCK_FX,
  LAUGH_GAP_MS,
  PORTRAIT_ORIGIN,
  SCREW,
  SHAKE,
  STOOL_MAX,
  STOOL_TOP,
  WASH
} from '../game/tuning'
import type { BlockState, FixingKind, Flavour, GameState } from '../game/types'
import {
  bareWallTaunt,
  bubbleAt,
  countHit,
  createUncle,
  heckleLine,
  lossTaunt,
  react,
  say,
  uncleFace,
  type UncleFace
} from '../game/uncle'
import {
  createChoreBoard,
  createMotion,
  createStore,
  isDone,
  isGameInputBlocked,
  Keyboard,
  now,
  palette,
  PointerTracker,
  settings,
  sfx,
  sketchRect,
  sketchText,
  timerProgress,
  toast,
  vibrate,
  type ChoreBoard,
  type Motion,
  type SketchStyle,
  type SketchTextStyle,
  type Rng,
  type Store,
  type ToastKind,
  type Viewport
} from '../shared'
import { PORTRAIT_FACE } from './art/uncle'
import { drawWall, WallLayers } from './art/wall'
import { FLAVOUR_COLOURS } from './art/jelly'
import { ColdOpen } from './coldOpen'
import { Fx } from './fx'
import { HallwayScene } from './hallwayScene'
import { KitchenScene } from './kitchenScene'
import type { Scene } from './scene'
import { ShopScene } from './shopScene'
import { EventRunner } from './eventRunner'
import { FinalTestRunner } from './finalTestRunner'
import { WallRecorder } from './wallRecorder'
import { WallScene } from './wallScene'
import { drawWipe } from './wipe'

/** Delay between a section locking and the camera panning to the next one. */
const PAN_AFTER_LOCK_MS = 1400
/** How often away alerts check for nails past their red line. */
const SAG_CHECK_MS = 500
/** Hold captions float up from here, between the active section and the stool. */
const HOLD_CAPTION_Y = 540
/** Whole Wall in normal play, and lowered while the uncle watches. */
const WHOLE = wholeView()
const WHOLE_LOWERED = wholeView(true)
const CUT_VIEW: CameraView = { x: 0, y: 0, zoom: 1, anchorX: 300, anchorY: 360 }
const CUT_VISIBLE = { x: 0, y: 0, width: 0, height: 0 }
const CUT_BANNER: SketchStyle = { fill: palette.yellow, width: 4, seed: 90 }
const CUT_FRAME: SketchStyle = { width: 10, color: palette.ink, seed: 91 }
const CUT_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 34,
  color: palette.ink,
  rotate: -0.03,
  // Inside the banner's 496 units, so the words never spill past its ends.
  maxWidth: 460
}
const OUT = { x: 0, y: 0 }

/** How a run starts. */
export interface GameOptions {
  random?: Rng
  /** Listen to tilt sensors. False when you refused motion access. */
  motion?: boolean
  /** Dev only: start in normal play, without the uncle's cold open. */
  skipColdOpen?: boolean
}

/**
 * Owns the run: simulation state, the wall physics, the camera, input and the current
 * scene. The loop calls `update` at 60 Hz and `render` once per frame.
 */
export class Game {
  readonly state: GameState = createGameState()
  readonly economy: Economy = createEconomy()
  readonly wall: WallSim
  /** Unlocked sections run as proxies; only blocks at risk get bodies. */
  readonly proxies: ProxyWall
  readonly camera: Camera = createCamera(0)
  readonly fx = new Fx()
  readonly hud: Store<HudSnapshot> = createHud()
  /** Open chores, such as mopping a floor. */
  readonly chores: ChoreBoard = createChoreBoard()
  readonly layout: Store<LayoutSnapshot> = createLayout()
  /** The Wall Report dialog, opened by Call Uncle (U) once every section is locked. */
  readonly report: Store<{ open: boolean }> = createStore<{ open: boolean }>({
    open: false
  })
  readonly wallScene: WallScene
  readonly kitchen: KitchenScene
  readonly hallway: HallwayScene
  readonly shop: ShopScene
  /** Every room you can walk to. Only the current one draws and takes input. */
  readonly scenes: Record<RoomId, Scene>
  scene: Scene
  /** The paper wipe between rooms, while one plays. */
  wipe: Wipe | null = null
  view: Framing = 'section'
  /** What new presses on the jelly drive in. Screws need the upgrade. */
  tool: FixingKind = 'nail'
  viewport: Viewport | null = null
  pointer: PointerTracker | null = null
  keys: Keyboard | null = null
  layers: WallLayers | null = null
  /** The uncle's lines over the live wall, until they finish. */
  readonly coldOpen = new ColdOpen()
  /** Tilt and jolt sensors, while attached. Null when you refused motion access. */
  motion: Motion | null = null
  /** Smoothed timings for the dev perf report. */
  readonly timings = { physicsMs: 0, drawMs: 0, recordMs: 0 }
  /** Films the wall, or the hallway mid-carry, for splat replays. */
  readonly recorder: WallRecorder
  /** The neighbour's door slams and passing trucks, scheduled by the event director. */
  readonly events = new EventRunner(this)
  /** The uncle's final test, once you call him. */
  readonly finalTest = new FinalTestRunner(this)
  /** Simulation time the last block fell off the wall, for the director's mercy rule. */
  private lastFallMs = -Infinity
  /** "Meanwhile, at the Wall…": the block it follows and when it ends, while one plays. */
  cutaway: {
    blockId: number
    startMs: number
    untilMs: number
    /** With Reduced Motion, a still framing of the block's cell and the floor below. */
    still: { x: number; y: number; zoom: number }
  } | null = null
  /** Simulation time the uncle last heckled a fall, for his jangling keys. */
  heckleMs = -Infinity
  /** His portrait's mood, streak and speech bubble. */
  readonly uncle = createUncle()
  /** What his portrait shows this step, read by every wall drawing. */
  readonly portrait: {
    face: UncleFace
    bubble: { text: string; ageMs: number } | null
  } = { face: 'smug', bubble: null }
  /** Blocks falling right now, filmed as one clip once they land. */
  private pending: PendingClip | null = null
  private pictureTaken = false
  private replayId = 0
  private bestHeldMs = -1
  /** No block has fallen off the wall yet: the first one always cuts away. */
  private firstFall = true
  private readonly alerts = new AlertLimiter()
  /** Nails already alerted past their warning line, until they recover. */
  private readonly sagAlerted = new Set<number>()
  private sagCheckMs = 0
  /** The section `sectionEase` last saw, and when it became the active one. */
  private easeSection = -1
  private sectionStartMs = 0
  /** World-space effects drawn over the wall: splat droplets, the fly and the cat. */
  readonly drawWallExtras = (ctx: CanvasRenderingContext2D) => {
    this.finalTest.drawWorld(ctx)
    this.fx.drawDroplets(ctx)
    this.events.critters.drawWorld(ctx)
  }
  private readonly pauses = new PauseClock()
  /** The fridge and noodle timers that already rang, so each dings once. */
  private dingedFridge: string | null = null
  private dingedNoodles: string | null = null
  private readonly useMotion: boolean
  private panAtMs = Infinity
  /** The wipe under way leads into a carry down the hallway. */
  private carryNext = false
  /** Splats on every floor when the mop chores were last checked. */
  private splatCount = 0
  /** Dirty wall cells when the scrape chore was last checked. */
  private dirtyCount = 0
  /** The wash chores' state when they were last checked: dirty bowls, burnt pot. */
  private washKey = ''
  /** The restock chores' state when they were last checked. */
  private restockKey = ''
  /** The noodle and mesh chores' state when they were last checked. */
  private upgradeKey = ''

  constructor({
    random = Math.random,
    motion = true,
    skipColdOpen = false
  }: GameOptions = {}) {
    this.useMotion = motion
    if (skipColdOpen) this.state.phase = 'play'
    this.wall = new WallSim(this.state, random)
    this.proxies = new ProxyWall(this.state, this.wall, random)
    this.recorder = new WallRecorder(this)
    this.wallScene = new WallScene(this)
    this.kitchen = new KitchenScene(this)
    this.hallway = new HallwayScene(this)
    this.shop = new ShopScene(this)
    this.scenes = {
      wall: this.wallScene,
      kitchen: this.kitchen,
      hallway: this.hallway,
      shop: this.shop
    }
    this.scene = this.wallScene
    // Bodies stay bodies while you hammer or screw them, or while the fly is after them.
    this.proxies.keep = id =>
      this.wallScene.working(id) ||
      this.events.critters.flyTarget === id ||
      this.events.critters.cat?.state.blockId === id
    // The starter tray: average jelly, made "last night".
    for (let i = 0; i < 4; i++)
      addStoolBlock(
        this.state,
        blockQuality(AVERAGE_INPUTS),
        'strawberry',
        AVERAGE_INPUTS
      )
    snapCamera(this.camera)
    this.publish()
  }

  /** Connects input and cached art to a canvas. Returns a cleanup function. */
  attach(viewport: Viewport): () => void {
    this.viewport = viewport
    const canvas = viewport.ctx.canvas
    const pointer = new PointerTracker(canvas, {
      toLogical: (x, y, out) => viewport.toLogical(x, y, out)
    })
    const kind = (e: PointerEvent) =>
      e.pointerType === 'touch' ? 'touch' : 'mouse'
    pointer.onPress((p, e) => {
      sfx.unlock()
      // Presses during a wipe or a cutaway go nowhere; you are between rooms.
      if (!this.wipe && !this.cutaway)
        this.scene.onPress(p.x, p.y, kind(e), e.timeStamp)
    })
    // The room behind a cutaway is frozen: drags wait too, releases still end holds.
    pointer.onDrag((p, e) => {
      if (!this.cutaway) this.scene.onDrag(p.x, p.y, e.timeStamp)
    })
    pointer.onRelease(p => this.scene.onRelease(p.x, p.y))
    const keys = new Keyboard()
    keys.onPress('Space', () => {
      sfx.unlock()
      if (!this.cutaway) this.scene.onKey('Space', true)
    })
    keys.onRelease('Space', () => this.scene.onKey('Space', false))
    keys.onPress('KeyW', () => {
      if (this.scene.id === 'wall' && !this.wipe) this.toggleView()
    })
    keys.onPress('KeyS', () => {
      if (this.scene.id === 'wall' && !this.wipe) this.toggleTool()
    })
    keys.onPress('KeyU', () => {
      if (this.scene.id === 'wall' && !this.wipe && this.hud.get().allLocked)
        this.report.set({ open: this.state.phase === 'play' })
    })
    keys.onPress('KeyC', () => {
      if (this.scene.id === 'wall' && !this.wipe && !this.cutaway)
        this.events.heat.shutCurtains()
    })
    for (const room of ROOMS) keys.onPress(room.code, () => this.goto(room.id))
    keys.onPress('KeyB', () => {
      if (this.scene === this.kitchen && !this.wipe) this.kitchen.freshBatch()
    })
    keys.onPress('KeyR', () => {
      if (this.scene === this.kitchen && !this.wipe)
        this.kitchen.recycledBatch()
    })
    keys.onPress('Escape', () => this.goBack())
    this.pointer = pointer
    this.keys = keys
    // The wall's locked-section pictures stay alive in every room: the replay recorder
    // films the wall from anywhere. Room backgrounds come and go with their scene.
    this.layers = new WallLayers(viewport, this.state)
    this.scene.enter()
    this.motion = this.useMotion ? createMotion() : null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') this.hidden(now())
      else this.shown(now())
    }
    document.addEventListener('visibilitychange', onVisibility)
    const publishLayout = () =>
      this.layout.set({
        scale: viewport.scale,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY
      })
    publishLayout()
    const stopResize = viewport.onResize(publishLayout)
    return () => {
      stopResize()
      document.removeEventListener('visibilitychange', onVisibility)
      this.motion?.dispose()
      this.motion = null
      pointer.dispose()
      keys.dispose()
      this.scene.exit()
      this.layers?.dispose()
      this.layers = null
      this.pointer = null
      this.keys = null
      this.viewport = null
    }
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    // Dialogs and the rotate prompt pause everything, so reading settings never costs a
    // block.
    const pausedMs = this.pauses.step(isGameInputBlocked(), now())
    if (this.pauses.paused) {
      this.events.mute()
      this.scene.mute?.()
      return
    }
    if (pausedMs > 0) this.resume(pausedMs)
    const state = this.state
    state.simMs += dtMs
    this.wall.conditions.assist = settings.get().assist
    this.wall.conditions.ease = this.sectionEase()
    const t0 = performance.now()
    this.wall.update(dtMs)
    this.proxies.update(dtMs)
    this.timings.physicsMs = smooth(
      this.timings.physicsMs,
      performance.now() - t0
    )
    for (const event of this.wall.events.splice(0)) this.onWallEvent(event)
    // The final test runs its own clock; no section holds or locks meanwhile.
    if (state.phase !== 'final')
      for (const event of updateSection(
        state,
        this.wall,
        this.economy.wallet,
        dtMs
      ))
        this.onSectionEvent(event)
    this.finalTest.update(dtMs)
    if (state.simMs >= this.panAtMs) {
      this.panAtMs = Infinity
      if (this.view === 'section') this.viewSection(state.section)
    }
    if (this.wipe) {
      const step = stepWipe(this.wipe, dtMs)
      if (step.switchNow) this.switchTo(this.wipe.to)
      if (step.done) this.wipe = null
    }
    this.checkFridge()
    this.checkNoodles()
    this.syncMopChores()
    this.syncScrapeChore()
    this.syncWashChores()
    this.syncRestockChores()
    this.syncUpgradeChores()
    if (
      state.scene === 'wall' &&
      state.tray?.location === 'hand' &&
      state.stool.length < STOOL_MAX &&
      !this.wipe
    )
      this.unloadTray(false)
    if (state.phase === 'cold-open') {
      this.coldOpen.update(dtMs)
      if (this.coldOpen.done) state.phase = 'play'
    }
    this.events.update(this.lastFallMs, dtMs)
    this.updateTutorial()
    this.updateReplay()
    this.recorder.update(dtMs)
    this.checkSagAlerts(dtMs)
    this.updateCutaway()
    // A cutaway freezes the room behind it, so a station keeps its progress and goes quiet.
    if (!this.cutaway) this.scene.update(dtMs)
    else this.scene.mute?.()
    // A fall ends the uncle's watch, so Whole Wall eases back up to show the floor.
    if (this.view === 'whole')
      aimCamera(this.camera, this.uncleWatching() ? WHOLE_LOWERED : WHOLE)
    updateCamera(this.camera, dtMs)
    this.fx.update(dtMs)
    this.updatePortrait()
    this.publish()
  }

  render(timeMs: number): void {
    const viewport = this.viewport
    if (!viewport) return
    const t0 = performance.now()
    const ctx = viewport.begin(palette.paper)
    if (this.cutaway) this.drawCutaway(ctx, viewport, timeMs)
    else this.scene.draw(ctx, timeMs)
    if (this.wipe && !this.cutaway) {
      viewport.apply(ctx)
      drawWipe(ctx, viewport.view, this.wipe, timeMs)
    }
    this.timings.drawMs = smooth(this.timings.drawMs, performance.now() - t0)
    // Dialogs pause the run, and the replay modal must not film over its own clip.
    if (this.pauses.paused) return
    const t1 = performance.now()
    if (this.recorder.capture(timeMs))
      this.timings.recordMs = smooth(
        this.timings.recordMs,
        performance.now() - t1
      )
  }

  /**
   * "Meanwhile, at the Wall…": the wall full screen, following the falling block, with a
   * caption, while the room behind waits.
   */
  private drawCutaway(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    timeMs: number
  ): void {
    const cut = this.cutaway!
    const t = Math.min(1, (this.state.simMs - cut.startMs) / CUTAWAY_MS)
    // A slow push in that follows the block down, unless Reduced Motion is on.
    if (settings.get().reducedMotion) {
      CUT_VIEW.zoom = cut.still.zoom
      CUT_VIEW.x = cut.still.x
      CUT_VIEW.y = cut.still.y
    } else {
      CUT_VIEW.zoom = 0.8 + 0.15 * t
      CUT_VIEW.x = this.recorder.view.x
      CUT_VIEW.y = this.recorder.view.y
    }
    const v = viewport.view
    CUT_VISIBLE.x = (v.x - CUT_VIEW.anchorX) / CUT_VIEW.zoom + CUT_VIEW.x
    CUT_VISIBLE.y = (v.y - CUT_VIEW.anchorY) / CUT_VIEW.zoom + CUT_VIEW.y
    CUT_VISIBLE.width = v.width / CUT_VIEW.zoom
    CUT_VISIBLE.height = v.height / CUT_VIEW.zoom
    drawWall(ctx, CUT_VIEW, viewport, {
      state: this.state,
      wall: this.wall,
      layers: this.layers,
      proxies: this.proxies,
      timeMs,
      visible: CUT_VISIBLE,
      litNail: null,
      target: null,
      heckleMs: this.heckleMs,
      uncle: this.portrait,
      extras: this.drawWallExtras
    })
    viewport.apply(ctx)
    this.fx.drawCaptions(ctx, CUT_VIEW, true)
    sketchRect(ctx, v.x + 8, v.y + 8, v.width - 16, v.height - 16, CUT_FRAME)
    sketchRect(ctx, 24, 676, 496, 70, CUT_BANNER)
    sketchText(ctx, 'Meanwhile, at the Wall…', 272, 711, CUT_TEXT)
  }

  // ---------------------------------------------------------------- Rooms

  /**
   * Walks to another room with a paper wipe. The wall keeps simulating while you are
   * away. Walking off while the hand holds an unnailed block drops it.
   */
  goto(room: RoomId): void {
    const state = this.state
    // During a carry only Go Back leaves the hallway, and the uncle's visits keep you
    // at the wall.
    if (this.wipe || this.cutaway || state.carry || state.phase !== 'play')
      return
    // Heading for the wall with the set tray in your hands walks it down the hallway.
    const carry =
      state.tray?.location === 'hand' &&
      (room === 'wall' || room === 'hallway') &&
      this.scene.id !== 'wall'
    if (carry) room = 'hallway'
    else if (this.scene.id === room) return
    const held = this.wall.handBlock
    if (this.scene.id === 'wall' && held !== null) {
      this.wall.drop(held, 'hand')
      toast('You walked off mid-nail. The block fell.', 'bad')
    }
    this.carryNext = carry
    this.wipe = startWipe(this.scene.id, room)
    sfx.play('whoosh', { volume: 0.5, pitch: room === 'shop' ? 0.8 : 1 })
  }

  private switchTo(id: RoomId): void {
    const next = this.scenes[id]
    if (next !== this.scene) {
      this.scene.exit()
      this.scene = next
      this.state.scene = id
      next.enter()
    }
    if (id === 'wall') this.unloadTray(true)
    if (id === 'hallway' && this.carryNext) this.startCarry()
    this.carryNext = false
  }

  // ---------------------------------------------------------------- The carry

  /** Starts the walk down the hallway with the tray in your hands. */
  private startCarry(): void {
    const state = this.state
    const tray = state.tray
    if (tray?.location !== 'hand' || state.carry) return
    tray.location = 'carry'
    const length = carryRoute(state.carries)
    const puddles = routePuddles(state, length)
    state.carry = createCarry(
      tray.moulds,
      length,
      puddles,
      hallwayCatAt(state.section, length, puddles, Math.random)
    )
    state.carries++
    this.hallway.beginCarry()
  }

  /** The survivors stay on the tray in your hands, and the carry ends. */
  private endCarry(): number {
    const state = this.state
    const carry = state.carry
    const tray = state.tray
    state.carry = null
    if (!carry || !tray) return 0
    tray.moulds = carry.blocks.map(b => b.mould)
    tray.location = 'hand'
    if (tray.moulds.length === 0) state.tray = null
    return tray.moulds.length
  }

  /** You reached the wall-room door: in you go, and the blocks go on the stool. */
  finishCarry(): void {
    const total = this.state.tray?.moulds.length ?? 0
    const kept = this.endCarry()
    this.wipe = startWipe('hallway', 'wall')
    this.fx.caption(
      kept === total ? 'Made it!' : `${kept} of ${total} made it.`,
      300,
      560,
      {
        world: false,
        size: 40,
        color: kept === total ? palette.green : palette.orange,
        ttlMs: 2200
      }
    )
  }

  /** Every block slid off: nothing left to carry, so back to the kitchen. */
  emptyCarry(): void {
    this.endCarry()
    toast('The tray is empty. Back to the kitchen.', 'bad')
    this.wipe = startWipe('hallway', 'kitchen')
  }

  /** Go Back: the carry stops and you return to the kitchen with the tray safe. */
  goBack(): void {
    if (!this.state.carry || this.wipe) return
    this.endCarry()
    sfx.play('whoosh', { volume: 0.5, pitch: 0.9 })
    this.wipe = startWipe('hallway', 'kitchen')
  }

  /**
   * Puts the tray's blocks on the stool, as far as it has room: on arrival at the wall,
   * and again each time a stool slot frees up. Only the arrival says the stool is full.
   */
  private unloadTray(arrival: boolean): void {
    if (this.state.tray?.location !== 'hand') return
    const count = unloadTray(this.state)
    if (count > 0) {
      sfx.play('squish', { pitch: 1.1 })
      toast(
        `${count} fresh ${count === 1 ? 'block' : 'blocks'} on the stool.`,
        'good'
      )
    }
    if (arrival && this.state.tray)
      toast('The stool is full. Nail some blocks first.', 'bad')
  }

  /** Jelly hits the kitchen floor: a splat, and the mop chore opens. */
  spill(flavour: Flavour): void {
    spillOnFloor(this.state, flavour, Math.random)
    this.syncMopChores()
  }

  /** Scrubbing too fast in the sink: suds on the kitchen floor, which need mopping. */
  spillSuds(): void {
    spillOnFloor(this.state, 'suds', Math.random, WASH.sudsRadius)
    this.syncMopChores()
  }

  /** True once you own an upgrade. */
  owns(id: UpgradeId): boolean {
    return this.economy.upgrades.owned(id)
  }

  /** True when this stool block still needs its mesh sheet cut before it can go up. */
  needsMesh(blockId: number): boolean {
    const block = this.state.blocks.get(blockId)
    return this.owns('mesh') && block?.status === 'stool' && block.mesh === 0
  }

  /** What the owned upgrades change about the next batch: moulds, recipe and noodles. */
  batchOptions(): BatchOptions {
    return batchOptions(id => this.owns(id))
  }

  /** An upgrade was just bought from the shop sheet: set up what it changes. */
  upgraded(upgrade: JellyUpgrade): void {
    this.firstTip(`upgrade-${upgrade.id}`)
    // The bigger fridge's batches need a second bowl, which arrives clean.
    if (upgrade.id === 'fridge') this.state.bowls.push(1)
    // Screws come with a starter box and go straight into your hand.
    if (upgrade.id === 'screws') {
      this.economy.stock.add('screws', SCREW.starterBox)
      this.tool = 'screw'
    }
    this.shop.admire()
  }

  /** Swaps between nails and screws, once you own screws. */
  toggleTool(): void {
    if (!this.owns('screws')) return
    this.tool = this.tool === 'nail' ? 'screw' : 'nail'
    // A screw tapped in but not turned goes back in the box.
    if (this.tool === 'nail') this.wallScene.cancelScrew(null)
    sfx.play('click', { pitch: this.tool === 'screw' ? 1.3 : 0.9 })
  }

  /** What you have at home, for the restock chores and the odd job. */
  supplies(): Supplies {
    const { stock, wallet } = this.economy
    return {
      coins: wallet.coins(),
      gelatin: stock.count('gelatin'),
      nails: stock.count('nails'),
      tubs: this.state.tubs,
      mopUses: this.state.mopUses,
      spareHeads: stock.count('mopHeads'),
      screws: this.owns('screws') ? stock.count('screws') : null
    }
  }

  /** Buy gelatin, Buy nails and Buy a mop head open and close with your supplies. */
  private syncRestockChores(): void {
    const needs = restockNeeds(this.supplies(), this.batchOptions())
    const key = `${needs.gelatin}${needs.nails}${needs.screws}${needs.mopHead}`
    if (key === this.restockKey) return
    this.restockKey = key
    const pairs = [
      [needs.gelatin, CHORES.buyGelatin],
      [needs.nails, CHORES.buyNails],
      [needs.screws, CHORES.buyScrews],
      [needs.mopHead, CHORES.buyMopHead]
    ] as const
    for (const [open, chore] of pairs)
      if (open) this.chores.add(chore)
      else this.chores.complete(chore.id)
  }

  /**
   * Boil the noodles while the batch's noodles wait, Drain the noodles once they have
   * boiled, and Cut mesh while a block on the stool has no sheet.
   */
  private syncUpgradeChores(): void {
    const state = this.state
    const raw = state.mix?.noodles === 'raw'
    const ready = noodlesReady(state, now())
    const uncut = state.stool.some(id => this.needsMesh(id))
    const key = `${raw}${ready}${uncut}`
    if (key === this.upgradeKey) return
    this.upgradeKey = key
    const pairs = [
      [raw, CHORES.boilNoodles],
      [ready, CHORES.drainNoodles],
      [uncut, CHORES.cutMesh]
    ] as const
    for (const [open, chore] of pairs)
      if (open) this.chores.add(chore)
      else this.chores.complete(chore.id)
  }

  /** The wash chores are open while a bowl is dirty, and while the pot is burnt. */
  private syncWashChores(): void {
    const dirty = bowlsDirty(this.state)
    const burnt = this.state.potScrubs > 0
    const bowls = this.state.bowls.length
    const key = `${dirty}${burnt}${bowls}`
    if (key === this.washKey) return
    this.washKey = key
    // Reopen the chore so its label follows the number of bowls.
    this.chores.complete(CHORES.washBowl.id)
    if (dirty) this.chores.add(bowls > 1 ? CHORES.washBowls : CHORES.washBowl)
    if (burnt) this.chores.add(CHORES.scrubPot)
    else this.chores.complete(CHORES.scrubPot.id)
  }

  /** The scrape chore is open exactly while an empty cell has old jelly or nails. */
  private syncScrapeChore(): void {
    const dirty = dirtyCells(this.state)
    if (dirty === this.dirtyCount) return
    this.dirtyCount = dirty
    if (dirty > 0) this.chores.add(CHORES.scrapeWall)
    else this.chores.complete(CHORES.scrapeWall.id)
  }

  /** Each room's mop chore is open exactly while splats lie on its floor. */
  private syncMopChores(): void {
    if (this.state.splats.length === this.splatCount) return
    this.splatCount = this.state.splats.length
    const messy = messyRooms(this.state)
    for (const [room, chore] of Object.entries(MOP_CHORES))
      if (messy.has(room as keyof typeof MOP_CHORES)) this.chores.add(chore)
      else this.chores.complete(chore.id)
  }

  /** Rings once when the tray in the fridge has set, wherever you are. */
  private checkFridge(): void {
    const fridge = this.state.fridge
    if (!fridge || fridge.id === this.dingedFridge || !isDone(fridge)) return
    this.dingedFridge = fridge.id
    sfx.play('ding')
    toast('The jelly is set. Take the tray out of the fridge.', 'good')
  }

  /** Rings once when the noodles have boiled, wherever you are. */
  private checkNoodles(): void {
    const noodles = this.state.noodles
    if (!noodles || noodles.id === this.dingedNoodles || !isDone(noodles))
      return
    this.dingedNoodles = noodles.id
    sfx.play('ding', { pitch: 0.8 })
    toast('The noodles are done. Drain them before the pour.', 'good')
  }

  // ---------------------------------------------------------------- Replays and alerts

  /**
   * A block started falling off the wall. It joins the clip being filmed, or starts one,
   * the uncle heckles, and away from the wall the game may cut away to show it.
   */
  private onFall(block: BlockState): void {
    const state = this.state
    this.lastFallMs = state.simMs
    this.finalTest.onFall(block)
    // The ending films the wall's collapse itself, with its own caption.
    if (this.finalTest.collapsing) return
    const cascade = this.pending !== null && !this.pending.carry
    if (cascade) this.pending!.blocks.push(block.id)
    else {
      if (this.pending) this.finishClip()
      this.pending = {
        blocks: [block.id],
        landedMs: null,
        carry: false,
        where: whereYouWere(state.scene, state.kitchenView)
      }
      this.pictureTaken = false
      this.recorder.follow(block.id)
    }
    const cut = wantsCutaway({
      firstFall: this.firstFall,
      cascade,
      holdActive: state.sections[block.section]?.holdActive ?? false,
      away: state.scene !== 'wall',
      carrying: state.carry !== null
    })
    this.firstFall = false
    if (cut) this.startCutaway(block.id)
    this.heckle(cascade)
  }

  /** A block dropped off the tray in the hallway and splatted on the runner. */
  carryLoss(block: BlockState): void {
    if (this.pending?.carry) this.pending.blocks.push(block.id)
    else {
      if (this.pending) this.finishClip()
      this.pending = {
        blocks: [block.id],
        landedMs: this.state.simMs,
        carry: true,
        where: null
      }
    }
    this.heckle(false)
  }

  /**
   * The uncle's "heh" and his car keys, at most every `LAUGH_GAP_MS`: he smirks at a
   * fall and laughs at a cascade. Every 10th, 25th and 50th lost block earns a taunt.
   */
  private heckle(cascade: boolean): void {
    const now = this.state.simMs
    react(this.uncle, cascade ? 'laugh' : 'smirk', now)
    const taunt = lossTaunt(this.state.stats.blocksLost)
    if (taunt) {
      this.taunt(taunt)
      return
    }
    if (now - this.heckleMs < LAUGH_GAP_MS) return
    this.heckleMs = now
    say(this.uncle, heckleLine(now), now)
    sfx.play('laugh', { pitch: cascade ? 0.85 : 1 })
    sfx.play('rattle', { volume: 0.35 })
  }

  /**
   * A milestone line from the uncle: in his portrait's bubble, with a laugh, and as a
   * toast when his portrait is out of view.
   */
  taunt(text: string): void {
    const now = this.state.simMs
    say(this.uncle, text, now)
    react(this.uncle, 'smirk', now)
    this.heckleMs = now
    sfx.play('laugh', { pitch: 1.1 })
    sfx.play('rattle', { volume: 0.35 })
    if (!this.portraitInView()) toast(`Uncle: ${text}`, 'info')
  }

  /** True while his portrait's face is on screen in the wall room. */
  private portraitInView(): boolean {
    if (this.state.scene !== 'wall' || this.wipe || this.cutaway) return false
    const face = toDesign(
      this.camera,
      PORTRAIT_ORIGIN[0] + PORTRAIT_FACE.x,
      PORTRAIT_ORIGIN[1] + PORTRAIT_FACE.y,
      OUT
    )
    return (
      face.x > 0 && face.x < DESIGN_WIDTH && face.y > 0 && face.y < STOOL_TOP
    )
  }

  private startCutaway(blockId: number): void {
    const now = this.state.simMs
    if (this.cutaway) {
      this.cutaway.untilMs = Math.max(
        this.cutaway.untilMs,
        now + CUTAWAY_MS / 2
      )
      return
    }
    // Reduced Motion holds the camera still on the cell and the floor below it, instead
    // of following the block down.
    const block = this.state.blocks.get(blockId)
    const from = block
      ? cellCentre(block.section, block.cell)
      : { x: this.recorder.view.x, y: this.recorder.view.y }
    const drop = FLOOR_Y - from.y + 160
    this.cutaway = {
      blockId,
      startMs: now,
      untilMs: now + CUTAWAY_MS,
      still: {
        x: from.x,
        y: (from.y + FLOOR_Y) / 2,
        zoom: Math.min(0.9, 640 / drop)
      }
    }
    sfx.play('whoosh', { pitch: 0.7 })
  }

  /** Ends the cutaway on time, unless its block is still on its way to the floor. */
  private updateCutaway(): void {
    const cut = this.cutaway
    const now = this.state.simMs
    if (!cut || now < cut.untilMs) return
    const falling = this.state.blocks.get(cut.blockId)?.status === 'falling'
    if (falling && now - cut.startMs < CUTAWAY_MAX_MS) return
    this.cutaway = null
  }

  /** Takes the share picture mid-fall, then the clip once the blocks have landed. */
  private updateReplay(): void {
    const pending = this.pending
    if (!pending) return
    const state = this.state
    const first = state.blocks.get(pending.blocks[0]!)
    // A game with no screen, such as a dev balance run, takes no pictures.
    if (
      this.viewport &&
      !pending.carry &&
      !this.pictureTaken &&
      first?.status === 'falling'
    ) {
      const body = this.wall.bodyOf(first.id)
      if (body && first.section >= 0) {
        const fromY = cellCentre(first.section, first.cell).y
        if (body.soft.center(OUT).y >= (fromY + FLOOR_Y) / 2)
          this.pictureTaken = this.recorder.takePicture(first.id) !== null
      }
    }
    const falling = pending.blocks.some(
      id => state.blocks.get(id)?.status === 'falling'
    )
    if (clipDue(pending, state.simMs, falling)) this.finishClip()
  }

  /** Hands the filmed fall to the corner replay with its label, blame line and card. */
  private finishClip(): void {
    const pending = this.pending
    this.pending = null
    if (!pending) return
    const state = this.state
    const first = state.blocks.get(pending.blocks[0]!)
    const clip = this.recorder.clip()
    if (!first || !clip) return
    const picture =
      !pending.carry && this.pictureTaken ? this.recorder.picture : clip.still
    const held =
      first.firstBiteMs !== null && first.lostMs !== null
        ? first.lostMs - first.firstBiteMs
        : 0
    if (picture && held >= this.bestHeldMs) {
      this.bestHeldMs = held
      this.recorder.keepBest(picture)
    }
    this.hud.set({
      replay: {
        id: ++this.replayId,
        clip,
        label: clipLabel(first, pending.blocks.length),
        blame: blameLine(first, pending.where),
        picture,
        stats: splatStats(first, state)
      }
    })
  }

  /** Shows a first-time tip over the room's hint, once per run, with a soft ding. */
  firstTip(id: TipId): void {
    if (showTip(this.state.tutorial, id, this.state.simMs))
      sfx.play('ding', { volume: 0.35, pitch: 1.5 })
  }

  /**
   * The guided first section's scripted beats: the single-nail lesson rips its block,
   * the first set tray brings the pipelining tip, and a block on the wall sags past its
   * red line so you learn to re-hammer.
   */
  private updateTutorial(): void {
    const state = this.state
    const tutorial = state.tutorial
    if (nextTip(tutorial, state.simMs))
      sfx.play('ding', { volume: 0.35, pitch: 1.5 })
    const lesson = lessonRip(state, tutorial)
    if (lesson) {
      lesson.cause = 'one-nail'
      this.wall.sag(1, lesson.id)
      this.firstTip('lesson')
    }
    if (state.fridge) this.firstTip('pipeline')
    const sag = state.fridge
      ? scriptedSagBlock(state, tutorial, timerProgress(state.fridge))
      : null
    if (sag) {
      const fixing = sag.fixings[0]!
      fixing.grip = Math.min(fixing.grip, scriptedSagGrip(sag))
      firstTime(tutorial, 'sag-alert')
      this.firstTip('scripted-sag')
    }
  }

  /**
   * How much the active section eases off in normal play: slower decay and fewer events
   * once it has run long, so a slow player always gets there. 1 in the final test.
   */
  private sectionEase(): number {
    const state = this.state
    if (state.section !== this.easeSection) {
      this.easeSection = state.section
      this.sectionStartMs = state.simMs
    }
    const section = state.sections[state.section]
    if (state.phase !== 'play' || !section || section.locked) return 1
    return longSectionEase(state.simMs - this.sectionStartMs)
  }

  /** An away alert as a toast, at most one every `ALERT_GAP_MS`. */
  alert(message: string, kind: ToastKind = 'bad'): void {
    if (this.alerts.allow(this.state.simMs)) toast(message, kind)
  }

  /**
   * Away from the wall, a nail slipping past its red line alerts once. Assist Mode
   * alerts at the orange line, a minute sooner.
   */
  private checkSagAlerts(dtMs: number): void {
    this.sagCheckMs += dtMs
    if (this.sagCheckMs < SAG_CHECK_MS) return
    this.sagCheckMs = 0
    const away = this.state.scene !== 'wall'
    const final = this.state.phase === 'final'
    const early = settings.get().assist
    for (const block of this.state.blocks.values()) {
      if (!isUp(block)) continue
      for (const fixing of block.fixings) {
        const level = blockNailLevelFor(block, fixing.grip, final)
        if (level !== 'red' && !(early && level === 'orange')) {
          this.sagAlerted.delete(fixing.id)
          continue
        }
        if (this.sagAlerted.has(fixing.id)) continue
        this.sagAlerted.add(fixing.id)
        this.firstTip('sag-alert')
        if (away) this.alert('A nail is slipping. Get back to the wall.')
      }
    }
  }

  // ---------------------------------------------------------------- Pauses

  /** A dialog or the rotate prompt closed after `pausedMs`: the waits finish later. */
  private resume(pausedMs: number): void {
    const state = this.state
    if (state.fridge) state.fridge = shiftTimer(state.fridge, pausedMs)
    if (state.noodles) state.noodles = shiftTimer(state.noodles, pausedMs)
  }

  /** The tab went into the background at wall-clock time `at`. */
  hidden(at: number): void {
    this.pauses.hide(at)
  }

  /**
   * The tab came back at `at`. Every live nail loses the grip it would have lost while
   * hidden, capped, without physics. Nails past rip-out come out in front of you.
   */
  shown(at: number): void {
    const ms = this.pauses.show(at)
    if (ms <= 0) return
    this.wall.catchUp(ms)
    this.proxies.catchUp(ms)
    if (!this.wall.events.some(e => e.type === 'rip')) return
    this.fx.caption('While you were away…', 300, 150, {
      world: false,
      color: palette.red,
      size: 36,
      ttlMs: 2600
    })
    toast('While you were away, nails slipped out.', 'bad')
  }

  // ---------------------------------------------------------------- Camera

  /**
   * Frames one section at full size. During the final test the section you zoom to
   * becomes the one your presses work on.
   */
  viewSection(index: number): void {
    if (this.state.phase === 'final') this.state.section = index
    this.view = 'section'
    aimCamera(this.camera, sectionView(index))
  }

  /** Shows all five sections at half size. */
  viewWhole(): void {
    this.view = 'whole'
    aimCamera(this.camera, this.uncleWatching() ? WHOLE_LOWERED : WHOLE)
  }

  /** From his arrival to the end of the test, Whole Wall uses the lowered framing. */
  private uncleWatching(): boolean {
    const stage = this.state.phase === 'final' ? this.state.final?.stage : null
    return (
      stage === 'arrive' ||
      stage === 'snip' ||
      stage === 'touches' ||
      stage === 'test'
    )
  }

  /**
   * Frames the wall-room floor for mopping: Whole Wall, unless the current framing
   * already shows the floor. Only in normal play, so the final test keeps its framing.
   */
  showFloor(): void {
    if (this.state.phase === 'play' && !showsFloor(this.camera.target))
      this.viewWhole()
  }

  toggleView(): void {
    if (this.view === 'whole') this.viewSection(this.state.section)
    else this.viewWhole()
  }

  // ---------------------------------------------------------------- Events

  /** What his portrait shows: a reaction, or his mood from the sections locked so far. */
  private updatePortrait(): void {
    let locks = 0
    for (const section of this.state.sections) if (section.lockedOnce) locks++
    const now = this.state.simMs
    this.portrait.face = uncleFace(this.uncle, locks, now)
    this.portrait.bubble = bubbleAt(this.uncle, now)
  }

  private publish(): void {
    const state = this.state
    const section = state.sections[state.section]
    const handBusy = this.wall.handBlock !== null
    this.hud.set({
      phase: state.phase,
      scene: state.scene,
      kitchenView: state.kitchenView,
      mix: state.mix?.stage ?? null,
      burnt: state.mix?.burnt ?? false,
      batchNote: batchNote(state.mix, state.simMs),
      tray: state.tray?.location ?? null,
      carrying: state.carry !== null,
      fridge: state.fridge,
      noodles: state.noodles,
      sagging: saggingCount(state),
      section: state.section,
      blocksUp: upCount(state, state.section),
      holdActive: section?.holdActive ?? false,
      view: this.view,
      stool: state.stool.length,
      handBusy,
      allLocked: allLocked(state),
      mopUses: state.mopUses,
      tubs: state.tubs,
      oddJob: oddJobOffered(this.supplies(), this.batchOptions()),
      sweeping: this.shop.sweeping,
      tool: this.tool,
      covered: this.cutaway !== null || this.wipe !== null,
      heat: this.events.heat.current,
      curtains: this.events.heat.wave?.curtains ?? false,
      finalStage: state.phase === 'final' ? (state.final?.stage ?? null) : null,
      attempt: state.final?.attempt ?? 0,
      callBlocker: this.finalTest.callBlocker(),
      verdict: this.finalTest.verdict,
      tip:
        this.finalTest.tip() ??
        currentTip(state.tutorial, state.simMs) ??
        this.scene.tip()
    })
  }

  private blockCentre(block: BlockState): { x: number; y: number } {
    const body = this.wall.bodyOf(block.id)
    if (body) return body.soft.center()
    return block.section >= 0
      ? cellCentre(block.section, block.cell)
      : { x: 0, y: 0 }
  }

  private onWallEvent(event: SimEvent): void {
    const fx = this.fx
    switch (event.type) {
      case 'hit': {
        const o = event.outcome
        const y = o.y - 34
        countHit(this.uncle, o.kind === 'sweet', this.state.simMs)
        if (o.kind === 'weak') {
          fx.caption('boing', o.x, y, { color: palette.inkSoft })
          sfx.play('boing')
        } else if (o.kind === 'loose') {
          fx.caption('tink', o.x, y, { size: 24 })
          sfx.play('hammer', { volume: 0.5, pitch: 1.3 })
          fx.shake(SHAKE.hit * 0.6)
        } else if (o.kind === 'sweet') {
          fx.caption('THUNK', o.x, y, { color: palette.green, size: 38 })
          sfx.play('hammer')
          fx.shake(SHAKE.hit)
          vibrate(20)
        } else if (o.kind === 'hard') {
          fx.caption('Too hard!', o.x, y, { color: palette.orange, size: 32 })
          sfx.play('hammer', { pitch: 0.8 })
          fx.shake(SHAKE.hard)
          vibrate(30)
        } else if (o.kind === 'split') {
          fx.caption('SPLORCH', o.x, y, { color: palette.red, size: 46 })
          sfx.play('splat')
          sfx.play('squish', { pitch: 0.7 })
          fx.shake(SHAKE.split)
          vibrate(60)
        } else {
          fx.caption('You nailed the wall.', o.x, y, { size: 26 })
          fx.caption('The wall is fine.', o.x, y + 30, {
            size: 22,
            color: palette.inkSoft
          })
          sfx.play('hammer', { pitch: 0.7, volume: 0.7 })
          fx.shake(SHAKE.hit)
          const taunt = bareWallTaunt(this.state.stats.bareWallNails)
          if (taunt) this.taunt(taunt)
        }
        if (o.kind !== 'split' && o.kind !== 'wall' && o.tears > 0)
          sfx.play('squish', { volume: 0.35, pitch: 1.3 })
        break
      }
      case 'screw': {
        const tight = event.grip >= 0.85
        fx.caption(
          tight ? 'Tight!' : event.strips > 0 ? 'Chewed up.' : 'Snug.',
          event.x,
          event.y - 34,
          {
            color: tight ? palette.green : palette.orange,
            size: tight ? 36 : 30
          }
        )
        sfx.play('ding', { pitch: tight ? 1.3 : 0.9, volume: 0.6 })
        fx.shake(SHAKE.hit * 0.6)
        vibrate(20)
        break
      }
      case 'rip':
        sfx.play('pop')
        fx.caption('pop!', event.x, event.y - 22, {
          size: 22,
          color: palette.inkSoft
        })
        break
      case 'fall': {
        const block = this.state.blocks.get(event.blockId)
        if (!block) break
        const at = this.blockCentre(block)
        fx.caption(heldForLabel(block), at.x, at.y - 40, {
          color: palette.red,
          size: 28,
          ttlMs: 2200
        })
        sfx.play('whoosh', { volume: 0.4 })
        this.onFall(block)
        break
      }
      case 'splat': {
        const block = this.state.blocks.get(event.blockId)
        sfx.play('splat')
        fx.shake(SHAKE.fall)
        vibrate(80)
        const pending = this.pending
        if (pending?.blocks.includes(event.blockId))
          pending.landedMs ??= this.state.simMs
        this.recorder.landed(event.blockId)
        const cut = this.cutaway
        if (cut?.blockId === event.blockId)
          cut.untilMs = Math.max(
            cut.untilMs,
            this.state.simMs + CUTAWAY_AFTER_SPLAT_MS
          )
        if (this.state.scene !== 'wall')
          this.alert('SPLAT. A block fell off the wall.')
        this.firstTip('first-splat')
        if (block) {
          fx.splash(event.x, event.y, FLAVOUR_COLOURS[block.flavour].fill)
          // A cascade gets one blame line, from the block its replay leads with.
          const headline = !pending || pending.blocks[0] === event.blockId
          if (headline && !this.finalTest.dropping)
            fx.caption(
              blameLine(block, pending?.where),
              event.x,
              FLOOR_Y - 70,
              {
                size: 24,
                color: palette.inkSoft,
                ttlMs: 2600
              }
            )
        }
        break
      }
      case 'tremble': {
        const points = this.wall.handPoints()
        const p = points?.[0]
        if (p)
          fx.caption('My arm…', p.x + 40, p.y - 60, {
            color: palette.orange,
            size: 28
          })
        break
      }
      case 'knock': {
        sfx.play('thud', { volume: 0.6 })
        const block = this.state.blocks.get(event.targetId)
        if (!block) break
        const at = this.blockCentre(block)
        // Under the "Held for" caption its fall brings, so the chain reads in order.
        if (event.loose > 0) {
          sfx.play('boing', { volume: 0.7 })
          fx.shake(SHAKE.hard)
          vibrate(40)
          fx.caption('Knocked loose!', at.x, at.y + 10, {
            color: palette.orange,
            size: 30,
            ttlMs: 2000
          })
        } else if (event.impulse >= KNOCK_FX.bonk)
          fx.caption('Bonk!', at.x, at.y, {
            color: palette.inkSoft,
            size: 24
          })
        break
      }
      case 'bite':
        watchLesson(this.state, this.state.tutorial, event.blockId)
        break
    }
  }

  private onSectionEvent(event: SectionEvent): void {
    const fx = this.fx
    switch (event.type) {
      case 'hold-start':
        sfx.play('ding', { pitch: 0.8 })
        // Under the active section, clear of the countdown above it.
        fx.caption('Hold all 12 for 60 seconds!', 300, HOLD_CAPTION_Y, {
          world: false,
          size: 30,
          ttlMs: 2200
        })
        break
      case 'hold-reset':
        sfx.play('fail')
        fx.caption('Hold reset!', 300, HOLD_CAPTION_Y, {
          world: false,
          color: palette.red,
          size: 40,
          ttlMs: 1800
        })
        break
      case 'pay': {
        const block = this.state.blocks.get(event.blockId)
        if (!block) break
        this.firstTip('first-pay')
        const at = this.blockCentre(block)
        sfx.play('coin')
        fx.caption(`+${event.coins}`, at.x, at.y - 20, {
          color: palette.green,
          size: 30
        })
        break
      }
      case 'lock': {
        const centre = sectionCentre(event.section)
        react(this.uncle, 'flat', this.state.simMs)
        sfx.play('thud')
        sfx.play('ding')
        fx.shake(6)
        fx.caption('LOCKED', centre.x, centre.y, {
          color: palette.red,
          size: 96,
          ttlMs: 2000
        })
        fx.caption(
          `Grade ${event.grade}  +${event.bonus} coins`,
          centre.x,
          centre.y + 80,
          {
            size: 30,
            ttlMs: 2000
          }
        )
        this.panAtMs = this.state.simMs + PAN_AFTER_LOCK_MS
        break
      }
      case 'all-locked':
        // After a failed final test, sections that lost blocks open one by one.
        if (this.finalTest.refill()) break
        fx.caption('All five sections locked!', 300, 200, {
          world: false,
          size: 34,
          ttlMs: 3000
        })
        sfx.play('ding', { pitch: 1.2 })
        fx.caption('Call your uncle when you are ready.', 300, 250, {
          world: false,
          size: 26,
          color: palette.inkSoft,
          ttlMs: 3000
        })
        break
    }
  }
}

function smooth(previous: number, sample: number): number {
  return previous === 0 ? sample : previous * 0.9 + sample * 0.1
}
