import type { RealTimer } from '../shared'
import type { FinalTestState } from './finalTest'
import type { QualityInputs } from './quality'
import type { TutorialState } from './tutorial'

/** Rooms and full-screen moments. The kitchen, hallway and shop are placeholders so far. */
export type SceneId =
  'wall' | 'kitchen' | 'hallway' | 'shop' | 'cold-open' | 'ending'

export type Flavour =
  'strawberry' | 'lime' | 'blueberry' | 'orange' | 'grape' | 'recycled'

/** What a floor splat is made of: jelly, or suds flung from the sink. */
export type SplatColour = Flavour | 'suds'

export type FixingKind = 'nail' | 'screw'

/** One nail or screw holding a block to the wall. */
export interface Fixing {
  id: number
  kind: FixingKind
  /** Particle index in the block grid (row * cols + col). */
  particle: number
  /** Where the nail sits in the wall, in world units. */
  x: number
  y: number
  /** 0 to 1. Rips out at or below RIP_OUT. */
  grip: number
  /** Earlier re-hammers of this nail; each one weakens the next. */
  rehammers: number
}

/** Where a block is in its life. */
/** `proxy`: unlocked for the final test but still drawn from its snapshot, with no body. */
export type BlockStatus =
  'stool' | 'held' | 'up' | 'falling' | 'splatted' | 'locked' | 'proxy'

/** Why a block was lost, for its replay label and blame line. */
export type LossCause =
  | 'sag'
  | 'torn'
  | 'split'
  | 'hand'
  | 'carry'
  | 'knock'
  | 'slam'
  | 'truck'
  | 'fly'
  | 'cat'
  /** Your own swat at a fly sitting on the block. */
  | 'swat'
  /** The tutorial's single nail: it turned on its only nail and tore free. */
  | 'one-nail'

export interface BlockState {
  id: number
  q: number
  /** The scores it was made from, for its label and looks. */
  make: QualityInputs
  flavour: Flavour
  status: BlockStatus
  /** Section and cell index while on the wall. */
  section: number
  cell: number
  fixings: Fixing[]
  /** Nails and screws ever driven into it. */
  holes: number
  /** Springs torn so far. */
  torn: number
  /** Residue on the cell when the block went up. */
  residue: number
  /** Mesh backing: 0 without, MESH.raggedHelp for a ragged sheet, 1 for a clean one. */
  mesh: number
  /** Reinforced with noodles: fewer tears, tougher, never splits. */
  noodles: boolean
  /** Simulation time the hand started holding it. */
  heldAtMs: number
  /** Simulation time of the first bite, or null if no nail ever held. */
  firstBiteMs: number | null
  /** Simulation time the last fixing went. */
  lostMs: number | null
  /** Simulation time of the last nail or re-hammer, for blame lines. */
  lastNailMs: number
  /** Paid its coins for holding PAY_HELD_MS. */
  paid: boolean
  /** The latest shock and when it hit, so a fall can name its cause. */
  lastShock: LossCause | null
  lastShockMs: number
  /** Why it was lost, once it was. */
  cause: LossCause | null
  /** Simulation time of the latest sweet hit, for the happy face. */
  sweetMs: number
}

/** A nail left in the wall after its block ripped off. */
export interface EmptyNail {
  x: number
  y: number
}

export interface CellState {
  block: number | null
  /** Leftover jelly from a fall, 0 to 1. Raises decay on the next block here. */
  residue: number
  emptyNails: EmptyNail[]
}

export type Grade = 'A' | 'B' | 'C' | 'D'

/** One outline piece of a locked block, copied from the soft body. */
export interface SnapshotPiece {
  points: Float64Array
  count: number
  particles: number
  centerX: number
  centerY: number
}

/** Everything needed to redraw a locked block and rebuild it as a soft body later. */
export interface BlockSnapshot {
  blockId: number
  cell: number
  q: number
  make: QualityInputs
  flavour: Flavour
  /** The 12 particle positions as flat world points. */
  positions: Float64Array
  /** Indices into the block's original spring list that were torn. */
  tornSprings: number[]
  fixings: Fixing[]
  holes: number
  mesh: number
  noodles: boolean
  pieces: SnapshotPiece[]
}

export interface SectionState {
  index: number
  cells: CellState[]
  locked: boolean
  /** Hold countdown left, in simulation ms. */
  holdLeftMs: number
  holdActive: boolean
  grade: Grade | null
  /** Weakest grip at lock, for the grade sticker. */
  weakestGrip: number
  snapshot: BlockSnapshot[]
  /** It has locked before, so locking it again after a failed final test pays less. */
  lockedOnce: boolean
}

export type Room = 'wall' | 'hallway' | 'kitchen'

/** Jelly on a floor, waiting for the mop. */
export interface Splat {
  id: number
  room: Room
  /** Design units in the kitchen and wall room; the route position in the hallway. */
  x: number
  y: number
  radius: number
  flavour: SplatColour
  seed: number
  /** Set jelly with a chunk to scrape first; kitchen spills are only a smear. */
  chunk: boolean
  /** Which way the smear points, and so which way it throws a carried tray. */
  side: 1 | -1
  /** Rub strokes done so far. */
  strokes: number
  /** Already spread once by mopping too fast; it can't spread again. */
  spread: boolean
}

/** The kitchen overview, or one station's close-up. */
export type KitchenView = 'overview' | 'stove' | 'bowl' | 'moulds' | 'sink'

/** Where a batch is on the stove: boiling, then stirring, then waiting to be poured. */
export type MixStage = 'boil' | 'stir' | 'stirred'

/**
 * A batch's noodles on the back hob: not started, boiling (ready once the timer ends),
 * then drained well, too early (watery) or too late (mush, no help).
 */
export type NoodleState = 'raw' | 'boiling' | 'good' | 'watery' | 'mush'

/** The batch in the pot and bowl, before it goes into the moulds. */
export interface StoveMix {
  flavour: Flavour
  recycled: boolean
  /** Made with the Extra Gelatin Recipe: more gelatin, firmer blocks. */
  recipe: boolean
  /** Its noodles, or null when the batch started without Noodle Reinforcement. */
  noodles: NoodleState | null
  /** Moulds this batch fills. */
  moulds: number
  stage: MixStage
  /** It burnt on the boil and waits for Try Again, which pays for a fresh lot. */
  burnt: boolean
  /** Boil accuracy, 0 to 1, once boiled. */
  boil: number
  /** Stir evenness, 0 to 1, once stirred. */
  stir: number
  /** How clean the bowl was for the stir, 0 to 1. */
  bowlClean: number
  /** Simulation time the stir finished. The mix starts setting in the bowl later. */
  stirredAtMs: number
}

/** One poured mould: the scores it was made from (its pour included) and its quality. */
export interface TrayMould {
  q: number
  make: QualityInputs
}

/**
 * Where the one tray is: poured on the counter, setting in the fridge, in your hands, or
 * on its way down the hallway.
 */
export type TrayLocation = 'kitchen' | 'fridge' | 'hand' | 'carry'

/** The tray once poured. An empty tray in the kitchen is `null`. */
export interface TrayState {
  flavour: Flavour
  recycled: boolean
  location: TrayLocation
  moulds: TrayMould[]
}

/** One block riding on the tray down the hallway. */
export interface CarryBlock {
  mould: TrayMould
  /** Position along the tray from its centre, in units; positive is right. */
  x: number
  /** Sliding speed along the tray, in units per second. */
  v: number
  /** Time left of the current hop. */
  hopMs: number
}

/** The walk down the hallway with the tray. */
export interface CarryState {
  /** Route length and how far you have walked, in units. */
  length: number
  pos: number
  /** Tray angle in degrees; positive dips the right end. */
  angle: number
  /** The random lean you fight, in degrees. */
  drift: number
  /** Footstep bob side, and time to the next footstep. */
  bob: 1 | -1
  stepInMs: number
  walking: boolean
  /** Blocks still on the tray, left to right. */
  blocks: CarryBlock[]
  /** Distance from the tray centre where a block falls off. */
  edge: number
  hopCooldownMs: number
  arrived: boolean
  /** Time the tray has been empty. */
  emptyMs: number
  /** Splats on the route, in order, and the next one you will step in. */
  puddles: { at: number; side: 1 | -1 }[]
  nextPuddle: number
  /** A slip in progress: time left of the drift kick, and its side. */
  slipMs: number
  slipSide: 1 | -1
  /** Time left before you can walk again after a slip. */
  stopMs: number
  /** Route position of the cat sitting on the runner, or null when it is not there. */
  catAt: number | null
}

export interface RunStats {
  blocksLost: number
  nailsUsed: number
  bareWallNails: number
  longestHoldMs: number
}

/** All simulation state. The Game owns it; the loop and input handlers write to it. */
export interface GameState {
  simMs: number
  /** The uncle's cold open, normal play, the final test with every lock off, the ending. */
  phase: 'cold-open' | 'play' | 'final' | 'ending'
  scene: SceneId
  /** Active section, 0 to 4. */
  section: number
  sections: SectionState[]
  blocks: Map<number, BlockState>
  /** Block ids waiting at the wall, oldest first. */
  stool: number[]
  splats: Splat[]
  /** The kitchen overview, or the station close-up on screen. */
  kitchenView: KitchenView
  /** The batch on the stove, if any. */
  mix: StoveMix | null
  /** The poured tray, if any. */
  tray: TrayState | null
  /** The real-time wait while the tray sets. */
  fridge: RealTimer | null
  /** The real-time wait while the batch's noodles boil on the back hob. */
  noodles: RealTimer | null
  /** The walk down the hallway, while you carry the tray. */
  carry: CarryState | null
  /** Carries started, so the first one takes the short route. */
  carries: number
  /** Batches started, for the flavour cycle. */
  batches: number
  /** Smears the fitted mop head can still mop. Spare heads live in stock. */
  mopUses: number
  /** Tubs of scraped floor jelly, for recycled batches. */
  tubs: number
  /** How clean each mixing bowl is, 0 to 1. Every stir dirties them all. */
  bowls: number[]
  /** Scrub strokes the burnt pot still needs; 0 when it is clean. */
  potScrubs: number
  stats: RunStats
  /** Simulation time a block last splatted, for "Minutes without a splat". */
  lastSplatMs: number
  /** The guided first section's lessons and the first-time tips shown so far. */
  tutorial: TutorialState
  /** The final test, from the first call to the uncle on; it keeps its attempts. */
  final: FinalTestState | null
  /** Next id for blocks, fixings and splats. */
  nextId: number
}
