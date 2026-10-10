import {
  biteTears,
  catTears,
  createCat,
  createFly,
  pickCatBlock,
  pickFlyBlock,
  shooCat,
  stepCat,
  stepFly,
  swatFly,
  type CatEvent,
  type CatState,
  type FlyEvent,
  type FlyState
} from '../game/critters'
import type { CritterCandidate } from '../game/hit'
import { isUp } from '../game/section'
import { toDesign } from '../game/sim/camera'
import {
  cellCentre,
  ledgeBelow,
  sectionCentre,
  sectionRect
} from '../game/sim/geometry'
import { BLOCK_COLS, CAT, FLOOR_Y, FLY, IMPULSE, SHAKE } from '../game/tuning'
import type { BlockState } from '../game/types'
import {
  lerp,
  palette,
  settings,
  sfx,
  sketchLine,
  sketchRect,
  vibrate,
  type SketchStyle
} from '../shared'
import {
  drawCat,
  drawFly,
  drawFlyTrail,
  FLY_LENGTH,
  drawPawPrint,
  drawSquashedFly,
  type CatLook,
  type CatPose
} from './art/critters'
import { SPLAT_COLOURS } from './art/jelly'
import type { Game } from './game'

/** Particles in the middle of the lower two rows, where a fly lands on the jelly's face. */
const FLY_SPOTS = [5, 6, 9, 10] as const
/** Trail dots kept behind a flying fly, and how often one is dropped. */
const TRAIL_DOTS = 7
const TRAIL_EVERY_MS = 60
/** The bottom-middle particles the cat grabs. */
const GRAB_SPOTS = [BLOCK_COLS * 2 + 1, BLOCK_COLS * 2 + 2] as const
/** Where the cat sits on the windowsill of the window inset, in design units. */
export const SILL = { x: 528, y: 138 } as const
/** A falling or running cat: gravity and speeds in units per second. */
const CAT_FALL_G = 2400
const CAT_RUN = 460
const CAT_FLEE = 720
/** The swatter shows this long after a swat. */
const SWATTER_MS = 260
const SWATTER_HEAD: SketchStyle = {
  fill: 'rgba(240, 62, 62, 0.85)',
  width: 3,
  seed: 740
}
const SWATTER_HANDLE: SketchStyle = {
  width: 6,
  color: palette.brown,
  seed: 741
}
const POINT = { x: 0, y: 0 }
const LOOK: CatLook = {
  facing: 1,
  earsFlat: false,
  wiggle: 0,
  tilt: 0,
  scale: 1
}
/** The cat on the wall is drawn a little bigger than on the windowsill, to read on phones. */
const WALL_CAT_SCALE = 1.2
/** The fly never draws shorter than this on screen. */
const FLY_MIN_CSS = 16
const CANDIDATES: CritterCandidate[] = []
/** Paw prints: how far apart, how far past a splat the cat keeps printing, how long they last. */
const PRINT_GAP = 30
const PRINT_RUN = 240
const PRINT_MS = 30_000
const PRINTS_MAX = 24

/** A paw print from the cat running through a splat. World units. */
interface PawPrint {
  x: number
  y: number
  colour: string
  bornMs: number
}

/** A fly on its way in, sitting on a block, leaving, or squashed. World units. */
interface FlyRun {
  state: FlyState
  x: number
  y: number
  startX: number
  startY: number
  /** Where it started to leave from, and which way it goes. */
  fromX: number
  fromY: number
  dir: 1 | -1
  trail: Float64Array
  trailCount: number
  trailMs: number
  buzzMs: number
}

/** The cat, from the windowsill to its exit. World units. */
interface CatRun {
  state: CatState
  /** The point under its feet while it crouches, and which way it faces. */
  perchX: number
  perchY: number
  facing: 1 | -1
  /** Where it let go or started running from. */
  fromX: number
  fromY: number
  /** The particle its claws hold while it hangs on. */
  grab: number
}

/**
 * The fly and the cat at the wall. The fly flies in, lands on a weak block, bites it
 * every 4s and leaves after 30s; tap it to swat it. The cat waits on the windowsill until
 * you are in the wall room, stares, hops down, wiggles and jumps at a bottom-row block;
 * tap it while it wiggles to shoo it.
 */
export class Critters {
  fly: FlyRun | null = null
  cat: CatRun | null = null
  private swatter: { x: number; y: number; atMs: number } | null = null
  /** Paw prints on the floor, oldest first. */
  private readonly prints: PawPrint[] = []

  /** How many paw prints are on the floor. */
  get pawPrints(): number {
    return this.prints.length
  }
  /** The splat colour on the running cat's paws, and how far it still prints. */
  private paws: { colour: string; left: number; lastX: number } | null = null
  private readonly flyEvents: FlyEvent[] = []
  private readonly catEvents: CatEvent[] = []

  constructor(private readonly game: Game) {}

  /** A fly or the cat is about. Only one event runs at a time. */
  get busy(): boolean {
    return this.fly !== null || this.cat !== null
  }

  /**
   * You can see and answer them: in the wall room during play or the final test, between
   * wipes and cutaways.
   */
  present(): boolean {
    const game = this.game
    const phase = game.state.phase
    return (
      game.state.scene === 'wall' &&
      (phase === 'play' || phase === 'final') &&
      !game.wipe &&
      !game.cutaway
    )
  }

  /** Up blocks of the active section. */
  private upBlocks(): BlockState[] {
    const state = this.game.state
    const out: BlockState[] = []
    for (const cell of state.sections[state.section]?.cells ?? []) {
      const block =
        cell.block === null ? undefined : state.blocks.get(cell.block)
      if (block && isUp(block) && this.game.wall.bodyOf(block.id))
        out.push(block)
    }
    return out
  }

  // ---------------------------------------------------------------- Starting

  /**
   * A fly heads for a weak block of the active section, or for `target` when given (the
   * final test's fly on the weakest block). False when no such block is up with a body.
   */
  startFly(target?: number): boolean {
    if (this.fly) return false
    const game = this.game
    const random = game.wall.random
    const chosen =
      target === undefined ? undefined : game.state.blocks.get(target)
    const block =
      target === undefined
        ? pickFlyBlock(this.upBlocks(), random)
        : chosen && isUp(chosen) && game.wall.bodyOf(chosen.id)
          ? chosen
          : null
    if (!block) return false
    const rect = sectionRect(block.section)
    const side = random() < 0.5 ? -1 : 1
    const startX =
      side < 0 ? rect.x - FLY.entryGap : rect.x + rect.width + FLY.entryGap
    const startY = rect.y + random() * rect.height * 0.5
    this.fly = {
      state: createFly(block.id, this.flySpot(block, random)),
      x: startX,
      y: startY,
      startX,
      startY,
      fromX: startX,
      fromY: startY,
      dir: side < 0 ? -1 : 1,
      trail: new Float64Array(TRAIL_DOTS * 2),
      trailCount: 0,
      trailMs: 0,
      buzzMs: 0
    }
    return true
  }

  /** A spot on the jelly's face away from the nails. */
  private flySpot(block: BlockState, random: () => number): number {
    const free = FLY_SPOTS.filter(
      p => !block.fixings.some(f => f.particle === p)
    )
    const spots = free.length > 0 ? free : FLY_SPOTS
    return spots[Math.floor(random() * spots.length)]!
  }

  /** The block the fly is after or sits on, while it can still bite. */
  get flyTarget(): number | null {
    const phase = this.fly?.state.phase
    return phase === 'arrive' || phase === 'landed'
      ? this.fly!.state.blockId
      : null
  }

  /** Sends the fly off and the cat away, as when the uncle declares the test won. */
  dismiss(): void {
    const fly = this.fly
    if (fly && (fly.state.phase === 'arrive' || fly.state.phase === 'landed')) {
      fly.state.phase = 'leave'
      fly.state.phaseMs = 0
      fly.fromX = fly.x
      fly.fromY = fly.y
    }
    const cat = this.cat
    if (cat && shooCat(cat.state)) {
      cat.fromX = cat.perchX
      cat.fromY = cat.perchY
    }
  }

  /** The cat climbs onto the windowsill. False when no block is up to jump at. */
  startCat(): boolean {
    if (this.busy || this.upBlocks().length === 0) return false
    this.cat = {
      state: createCat(),
      perchX: 0,
      perchY: 0,
      facing: 1,
      fromX: 0,
      fromY: 0,
      grab: GRAB_SPOTS[0]
    }
    if (!this.present())
      this.game.alert("The cat is at the window. It's waiting for you.")
    return true
  }

  // ---------------------------------------------------------------- Loop

  update(dtMs: number): void {
    this.updateFly(dtMs)
    this.updateCat(dtMs)
    const fly = this.fly
    this.game.wall.conditions.flyBlock =
      fly?.state.phase === 'landed' ? fly.state.blockId : null
  }

  private particle(
    blockId: number,
    index: number
  ): { x: number; y: number } | null {
    return this.game.wall.bodyOf(blockId)?.soft.bodies[index]?.position ?? null
  }

  private updateFly(dtMs: number): void {
    const run = this.fly
    if (!run) return
    const game = this.game
    const state = run.state
    // A fly still on its way picks another block if its target went.
    if (
      state.phase === 'arrive' &&
      !isUp(game.state.blocks.get(state.blockId))
    ) {
      const next = pickFlyBlock(this.upBlocks(), game.wall.random)
      if (next) {
        state.blockId = next.id
        state.particle = this.flySpot(next, game.wall.random)
      }
    }
    const events = this.flyEvents
    events.length = 0
    stepFly(state, dtMs, isUp(game.state.blocks.get(state.blockId)), events)
    for (const event of events) this.onFlyEvent(run, event)
    if (!this.fly) return
    this.moveFly(run)
    const flying = state.phase === 'arrive' || state.phase === 'leave'
    if (flying) {
      run.trailMs += dtMs
      if (run.trailMs >= TRAIL_EVERY_MS) {
        run.trailMs = 0
        run.trail.copyWithin(0, 2)
        run.trail[TRAIL_DOTS * 2 - 2] = run.x
        run.trail[TRAIL_DOTS * 2 - 1] = run.y
        run.trailCount = Math.min(TRAIL_DOTS, run.trailCount + 1)
      }
    } else run.trailCount = 0
    // Buzzing you can hear from the wall room: loud in flight, now and then while it eats.
    run.buzzMs -= dtMs
    if (run.buzzMs <= 0 && state.phase !== 'swatted') {
      run.buzzMs = flying ? FLY.buzzEveryMs : FLY.buzzEveryMs * 4
      if (this.present())
        sfx.play('buzz', {
          volume: flying ? 0.5 : 0.18,
          pitch: 0.92 + Math.random() * 0.16
        })
    }
  }

  /** Where the fly is this step, in world units. */
  private moveFly(run: FlyRun): void {
    const state = run.state
    const at = this.particle(state.blockId, state.particle)
    switch (state.phase) {
      case 'arrive': {
        const t = Math.min(1, state.phaseMs / FLY.arriveMs)
        const e = 1 - (1 - t) * (1 - t)
        const tx = at ? at.x : run.startX
        const ty = at ? at.y - 4 : run.startY
        const loop = 70 * (1 - t)
        run.x = lerp(run.startX, tx, e) + Math.sin(t * 17) * loop
        run.y = lerp(run.startY, ty, e) + Math.cos(t * 13) * loop * 0.7
        break
      }
      case 'landed':
        if (at) {
          run.x = at.x + Math.sin(state.phaseMs * 0.004) * 1.5
          run.y = at.y - 4
        }
        break
      case 'leave': {
        const t = state.phaseMs / FLY.leaveMs
        run.x = run.fromX + run.dir * t * 320 + Math.sin(t * 15) * 25
        run.y = run.fromY - t * 360 + Math.cos(t * 11) * 20
        break
      }
      default:
    }
  }

  private onFlyEvent(run: FlyRun, event: FlyEvent): void {
    const game = this.game
    const block = game.state.blocks.get(run.state.blockId)
    switch (event) {
      case 'land':
        if (!this.present())
          game.alert("A fly landed on the jelly. It's eating it.")
        else
          game.fx.caption('*lands*', run.x, run.y - 30, {
            size: 20,
            color: palette.inkSoft
          })
        break
      case 'bite': {
        if (!block) break
        const tears = game.wall.tearAt(
          block.id,
          run.state.particle,
          biteTears(block, game.wall.random),
          'fly'
        )
        if (!this.present()) break
        sfx.play('squish', { volume: 0.35, pitch: 1.7 })
        game.fx.caption(tears > 0 ? 'nom' : 'nom?', run.x + 14, run.y - 26, {
          size: 20,
          color: tears > 0 ? palette.red : palette.inkSoft
        })
        break
      }
      case 'leave': {
        run.fromX = run.x
        run.fromY = run.y
        const centre = sectionCentre(Math.max(0, block?.section ?? 0))
        run.dir = run.x < centre.x ? -1 : 1
        break
      }
      case 'gone':
        this.fly = null
        break
    }
  }

  private updateCat(dtMs: number): void {
    const run = this.cat
    if (!run) return
    const game = this.game
    const events = this.catEvents
    events.length = 0
    stepCat(
      run.state,
      dtMs,
      {
        present: this.present(),
        pick: () =>
          pickCatBlock(game.state, game.state.section, game.wall.random),
        isUp: id => isUp(game.state.blocks.get(id)) && !!game.wall.bodyOf(id)
      },
      events
    )
    for (const event of events) this.onCatEvent(run, event)
    // Halfway through the wiggle it gets louder: last chance.
    const { phase, phaseMs } = run.state
    const half = CAT.wiggleMs / 2
    if (phase === 'wiggle' && phaseMs >= half && phaseMs - dtMs < half) {
      game.fx.caption('WIGGLE WIGGLE', run.perchX, run.perchY - 100, {
        size: 30,
        color: palette.red,
        ttlMs: CAT.wiggleMs / 2
      })
      if (this.present()) sfx.play('meow', { volume: 0.6, pitch: 1.5 })
    }
    // Hanging on drags the block down.
    if (this.cat?.state.phase === 'hang' && run.state.blockId !== null)
      game.wall.pull(run.state.blockId, 0, CAT.pull)
    this.leavePrints(run)
  }

  /** A cat running across the floor through a splat prints its paws for a while after. */
  private leavePrints(run: CatRun): void {
    const now = this.game.state.simMs
    while (this.prints.length > 0 && now - this.prints[0]!.bornMs > PRINT_MS)
      this.prints.shift()
    if (!runPosition(run, POINT) || POINT.y < FLOOR_Y - 4) {
      this.paws = null
      return
    }
    const x = POINT.x
    let inSplat = false
    for (const splat of this.game.state.splats) {
      if (splat.room !== 'wall' || Math.abs(x - splat.x) > splat.radius)
        continue
      inSplat = true
      const colour = SPLAT_COLOURS[splat.flavour].line
      if (this.paws) this.paws.colour = colour
      else this.paws = { colour, left: PRINT_RUN, lastX: x }
      this.paws.left = PRINT_RUN
      this.paws.lastX = x
    }
    const paws = this.paws
    // Prints only show on bare floor, after the cat has run out of the splat.
    if (!paws || inSplat) return
    const moved = Math.abs(x - paws.lastX)
    if (moved < PRINT_GAP) return
    paws.left -= moved
    paws.lastX = x
    if (paws.left <= 0) {
      this.paws = null
      return
    }
    // Left and right paws, a little apart.
    const side = this.prints.length % 2 === 0 ? -1 : 1
    this.prints.push({
      x,
      y: FLOOR_Y + 12 + side * 5,
      colour: paws.colour,
      bornMs: now
    })
    if (this.prints.length > PRINTS_MAX) this.prints.shift()
  }

  private onCatEvent(run: CatRun, event: CatEvent): void {
    const game = this.game
    const fx = game.fx
    switch (event) {
      case 'stare':
        sfx.play('meow')
        fx.caption('Meow.', SILL.x - 60, SILL.y + 20, {
          world: false,
          size: 26,
          color: palette.orange
        })
        break
      case 'hop': {
        const block = game.state.blocks.get(run.state.blockId!)
        if (!block) break
        const cell = cellCentre(block.section, block.cell)
        const centre = sectionCentre(block.section)
        run.facing = cell.x <= centre.x ? 1 : -1
        run.perchX = cell.x - run.facing * 22
        run.perchY = ledgeBelow(block.section)
        run.grab = GRAB_SPOTS[game.wall.random() < 0.5 ? 0 : 1]
        sfx.play('whoosh', { volume: 0.4, pitch: 1.3 })
        break
      }
      case 'wiggle':
        sfx.play('meow', { volume: 0.5, pitch: 1.25 })
        fx.caption('wiggle wiggle', run.perchX, run.perchY - 90, {
          size: 24,
          color: palette.orange,
          ttlMs: CAT.wiggleMs / 2
        })
        break
      case 'jump':
        sfx.play('whoosh', { volume: 0.6, pitch: 1.1 })
        break
      case 'grab': {
        const id = run.state.blockId!
        const block = game.state.blocks.get(id)
        if (!block) break
        game.wall.impulse(id, IMPULSE.cat, 'cat')
        game.wall.tearAt(id, run.grab, catTears(block), 'cat')
        sfx.play('meow', { pitch: 1.35 })
        sfx.play('squish', { pitch: 0.8 })
        fx.shake(SHAKE.hard)
        vibrate(50)
        const at = this.particle(id, run.grab)
        if (at)
          fx.caption('MRAOW!', at.x, at.y - 40, {
            size: 40,
            color: palette.red
          })
        if (!this.present()) game.alert('The cat jumped at the jelly.')
        break
      }
      case 'drop':
      case 'bored': {
        const at =
          event === 'drop' && run.state.blockId !== null
            ? this.particle(run.state.blockId, run.grab)
            : null
        run.fromX = at?.x ?? run.perchX
        run.fromY = at ? at.y : run.perchY
        run.facing = run.fromX < sectionCentre(game.state.section).x ? -1 : 1
        if (event === 'bored' && this.present())
          fx.caption('The cat lost interest.', 300, 200, {
            world: false,
            size: 26,
            color: palette.inkSoft
          })
        break
      }
      case 'gone':
        this.cat = null
        break
    }
  }

  // ---------------------------------------------------------------- Input

  /** Fly and cat targets you can tap now, in world units. */
  candidates(): readonly CritterCandidate[] {
    CANDIDATES.length = 0
    const fly = this.fly
    if (fly && (fly.state.phase === 'arrive' || fly.state.phase === 'landed'))
      CANDIDATES.push({ critter: 'fly', id: 1, x: fly.x, y: fly.y })
    const cat = this.cat
    const phase = cat?.state.phase
    if (cat && (phase === 'hop' || phase === 'wiggle'))
      CANDIDATES.push({
        critter: 'cat',
        id: 2,
        x: cat.perchX + cat.facing * 8,
        y: cat.perchY - 24
      })
    return CANDIDATES
  }

  /** A tap on the fly swats it; a tap on the cat shoos it. (x, y) is the press in design units. */
  hit(critter: 'fly' | 'cat', x: number, y: number): void {
    const game = this.game
    const fx = game.fx
    if (critter === 'fly') {
      const run = this.fly
      if (!run) return
      const where = swatFly(run.state)
      if (!where) return
      run.fromX = run.x
      run.fromY = run.y
      if (where === 'jelly')
        game.wall.impulse(run.state.blockId, IMPULSE.swat, 'swat')
      this.swatter = { x, y, atMs: game.state.simMs }
      sfx.play('thud', { pitch: 1.5, volume: 0.8 })
      sfx.play('squish', { pitch: 1.9, volume: 0.5 })
      fx.shake(SHAKE.hit)
      vibrate(25)
      fx.caption('SWAT!', run.x, run.y - 30, { size: 38, color: palette.red })
      fx.caption(
        where === 'air' ? 'Clean kill.' : 'Got it. The jelly felt that.',
        run.x,
        run.y + 30,
        { size: 22, color: palette.inkSoft, ttlMs: 1600 }
      )
      return
    }
    const run = this.cat
    if (!run || !shooCat(run.state)) return
    run.fromX = run.perchX
    run.fromY = run.perchY
    run.facing = run.perchX < sectionCentre(this.game.state.section).x ? -1 : 1
    sfx.play('meow', { pitch: 0.6 })
    fx.shake(SHAKE.hit)
    fx.caption('Shoo!', run.perchX, run.perchY - 70, {
      size: 38,
      color: palette.green
    })
  }

  /** A hint while one of them needs you. */
  tip(): string | null {
    const cat = this.cat?.state.phase
    if (cat === 'hop' || cat === 'wiggle')
      return 'The cat is about to jump. Tap it to shoo it!'
    const fly = this.fly?.state.phase
    if (fly === 'landed') return 'A fly is eating the jelly. Tap it to swat it.'
    if (fly === 'arrive') return 'A fly! Tap it to swat it.'
    return null
  }

  // ---------------------------------------------------------------- Drawing

  /** How the cat sits in the window inset, or null when it is not there. */
  sillPose(): 'sit' | 'stare' | null {
    const phase = this.cat?.state.phase
    return phase === 'sill' ? 'sit' : phase === 'stare' ? 'stare' : null
  }

  /** The cat on the windowsill, in design units. The window inset draws it. */
  drawOnSill(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const pose = this.sillPose()
    if (!pose) return
    LOOK.facing = -1
    LOOK.earsFlat = false
    LOOK.wiggle = 0
    LOOK.tilt = 0
    LOOK.scale = 1
    drawCat(ctx, SILL.x, SILL.y, pose, timeMs, LOOK)
  }

  /** The fly and the cat on the wall, in world units: the main view, cutaways and replays. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    const timeMs = this.game.state.simMs
    for (const print of this.prints)
      drawPawPrint(
        ctx,
        print.x,
        print.y,
        print.colour,
        1 - (timeMs - print.bornMs) / PRINT_MS
      )
    const fly = this.fly
    if (fly) {
      // Zoomed out on a small phone the fly would be a speck: keep it 16 CSS px long.
      const cssPerUnit = ctx.getTransform().a / (this.game.viewport?.dpr ?? 1)
      const size = Math.max(1, FLY_MIN_CSS / (FLY_LENGTH * cssPerUnit))
      const phase = fly.state.phase
      if (phase === 'swatted')
        drawSquashedFly(ctx, fly.fromX, fly.fromY + 6, size)
      else {
        drawFlyTrail(ctx, fly.trail, TRAIL_DOTS - fly.trailCount, TRAIL_DOTS)
        drawFly(ctx, fly.x, fly.y, timeMs, phase !== 'landed', size)
      }
    }
    const cat = this.cat
    if (!cat) return
    const state = cat.state
    LOOK.facing = cat.facing
    LOOK.earsFlat = state.phase === 'shooed'
    LOOK.wiggle = 0
    LOOK.tilt = 0
    LOOK.scale = WALL_CAT_SCALE
    let pose: CatPose = 'crouch'
    let x = cat.perchX
    let y = cat.perchY
    switch (state.phase) {
      case 'wiggle': {
        // The wiggle speeds up as the jump nears.
        const t = state.phaseMs / CAT.wiggleMs
        const reduce = settings.get().reducedMotion ? 0.4 : 1
        LOOK.wiggle =
          Math.sin(state.phaseMs * (0.018 + 0.022 * t)) * CAT.wiggleAmp * reduce
        break
      }
      case 'jump': {
        const to = this.particle(state.blockId!, cat.grab)
        if (!to) return
        const t = Math.min(1, state.phaseMs / CAT.jumpMs)
        x = lerp(cat.perchX, to.x, t)
        y = lerp(cat.perchY, to.y, t) - Math.sin(Math.PI * t) * 40
        pose = 'leap'
        LOOK.tilt = Math.atan2(
          to.y - cat.perchY,
          (to.x - cat.perchX) * cat.facing
        )
        break
      }
      case 'hang': {
        const at = this.particle(state.blockId!, cat.grab)
        if (!at) return
        x = at.x
        y = at.y
        pose = 'hang'
        break
      }
      case 'leave':
      case 'shooed':
        runPosition(cat, POINT)
        x = POINT.x
        y = POINT.y
        pose = 'run'
        break
      default:
        // On the windowsill or hopping down: drawn in design units instead.
        return
    }
    // A cat that gave up on the windowsill left through the window.
    if (state.blockId === null) return
    drawCat(ctx, x, y, pose, timeMs, LOOK)
  }

  /** The cat hopping down from the windowsill and the swatter, in design units. */
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const game = this.game
    const timeMs = game.state.simMs
    const cat = this.cat
    if (cat?.state.phase === 'hop') {
      const t = Math.min(1, cat.state.phaseMs / CAT.hopMs)
      const to = toDesign(game.camera, cat.perchX, cat.perchY, POINT)
      const x = lerp(SILL.x, to.x, t)
      const y = lerp(SILL.y, to.y, t) - Math.sin(Math.PI * t) * 60
      LOOK.facing = cat.facing
      LOOK.earsFlat = false
      LOOK.wiggle = 0
      LOOK.tilt = lerp(-0.6, 0.4, t)
      LOOK.scale = lerp(1, game.camera.zoom * WALL_CAT_SCALE, t)
      drawCat(ctx, x, y, 'leap', timeMs, LOOK)
    }
    const swat = this.swatter
    if (!swat) return
    const age = timeMs - swat.atMs
    if (age > SWATTER_MS) {
      this.swatter = null
      return
    }
    // The swatter comes down from above and slaps.
    const down = Math.min(1, age / 90)
    const y = swat.y - (1 - down) * 50
    sketchLine(ctx, swat.x + 20, y + 12, swat.x + 70, y + 90, SWATTER_HANDLE)
    sketchRect(ctx, swat.x - 22, y - 22, 44, 40, SWATTER_HEAD)
  }
}

/**
 * Where a cat running off is, written into `out`: it drops from where it let go to the
 * floor, through any splat there, and runs. Returns false while it isn't running.
 */
function runPosition(cat: CatRun, out: { x: number; y: number }): boolean {
  const state = cat.state
  if (state.phase !== 'leave' && state.phase !== 'shooed') return false
  const t = state.phaseMs / 1000
  const speed = state.phase === 'shooed' ? CAT_FLEE : CAT_RUN
  out.x = cat.fromX + cat.facing * speed * t
  out.y = Math.min(FLOOR_Y, cat.fromY + 0.5 * CAT_FALL_G * t * t)
  return true
}
