import { waitMs } from '../shared'

// Every gameplay number lives here, one comment each. PLAN.md explains where each comes from.

// ---------------------------------------------------------------- Design and wall geometry

/** Logical design size every scene draws in. */
export const DESIGN_WIDTH = 600
export const DESIGN_HEIGHT = 800

/** Particles across and down in one jelly block. */
export const BLOCK_COLS = 4
export const BLOCK_ROWS = 3
/** Distance between neighbouring particle centres, in world units. */
export const PARTICLE_SPACING = 26
/** Radius of each particle circle. Below half the spacing, so a block can't fold into itself. */
export const PARTICLE_RADIUS = 11
/** Springs in one intact 4 x 3 block (structural plus shear). */
export const BLOCK_SPRINGS = 29
/** Spring damping inside a block. */
export const BLOCK_DAMPING = 0.06
/** Particle friction against other bodies. */
export const PARTICLE_FRICTION = 0.4
/** Particle air drag; also caps falling speed at about 9 units per step. */
export const PARTICLE_AIR = 0.03

/** One wall cell holds one block. */
export const CELL_W = 124
export const CELL_H = 100
/** Cells across and down in one section. */
export const SECTION_COLS = 4
export const SECTION_ROWS = 3
/** Cells in one section. */
export const SECTION_CELLS = SECTION_COLS * SECTION_ROWS
/** Width of the frame around a section's cells. */
export const SECTION_FRAME = 16
/** Outer size of a section, frame included. */
export const SECTION_W = SECTION_COLS * CELL_W + SECTION_FRAME * 2
export const SECTION_H = SECTION_ROWS * CELL_H + SECTION_FRAME * 2
/** Top-left corner of each section: S1 bottom left, S2 bottom right, S3 and S4 middle, S5 top left. */
export const SECTION_ORIGINS: readonly (readonly [number, number])[] = [
  [0, 752],
  [576, 752],
  [0, 376],
  [576, 376],
  [0, 0]
]
/** Number of sections on the wall. */
export const SECTION_COUNT = SECTION_ORIGINS.length
/** The sixth slot, top right, holds the uncle's portrait. */
export const PORTRAIT_ORIGIN: readonly [number, number] = [576, 0]
/** The wall's right edge. */
export const WALL_RIGHT = 576 + SECTION_W
/** The floor line. Falling jelly splats here. */
export const FLOOR_Y = 1184
/** Invisible side walls keep falling jelly on screen. */
export const SIDE_WALL_LEFT = -40
export const SIDE_WALL_RIGHT = WALL_RIGHT + 40

// ---------------------------------------------------------------- Camera

/** Section framing: zoom and where the section centre sits in design units. */
export const SECTION_ZOOM = 1
export const SECTION_ANCHOR: readonly [number, number] = [300, 330]
/** Whole Wall framing. */
export const WHOLE_ZOOM = 0.5
export const WHOLE_ANCHOR: readonly [number, number] = [300, 320]
/**
 * While the uncle watches (his arrival to the end of the test), Whole Wall sits this much
 * lower. The wall's top then clears a two-line phone tip over the design's top band, and
 * the floor hides behind his strip, where nothing needs mopping meanwhile.
 */
export const FINAL_WHOLE_ANCHOR_Y = 372
/** Camera smoothing rate per second (damp lambda). */
export const CAMERA_LAMBDA = 6
/** Faces and other small details draw only at this zoom or closer. */
export const FACE_MIN_ZOOM = 0.8

// ---------------------------------------------------------------- Stool strip (design units)

/** Top of the stool strip, below the play area. */
export const STOOL_TOP = 640
/** Stool slots shown; the last one stacks the rest with a "+N" label. */
export const STOOL_SLOTS = 4
/**
 * Width of one stool slot: 64 CSS px on a 0.625-scale phone, and 55 px at 0.535, an
 * iPhone SE with Safari's toolbars showing.
 */
export const STOOL_SLOT_W = 102
/** Left edge of the first stool slot. */
export const STOOL_LEFT = 8
/** The stool holds at most this many waiting blocks. */
export const STOOL_MAX = 12
/** Ghost blocks on the stool draw at this fraction of their wall size. */
export const STOOL_GHOST_SCALE = 0.7
/** The kitchen's Fresh Batch button sits on the recipe card, over this design rectangle. */
export const RECIPE_SLOT: readonly [number, number, number, number] = [
  40, 66, 284, 100
]
/** Recycled Batch sits over the cupboards, beside the floor-jelly tub. */
export const TUB_SLOT: readonly [number, number, number, number] = [
  20, 596, 230, 84
]
/** The fridge countdown chip sits on the fridge's lower door. */
export const FRIDGE_SLOT: readonly [number, number, number, number] = [
  412, 380, 156, 80
]
/** The noodle countdown chip sits on the cupboard under the stove, on phones. */
export const NOODLE_SLOT: readonly [number, number, number, number] = [
  4, 420, 220, 80
]
/** Each kitchen station's Kitchen back button sits here, bottom left. */
export const STATION_BACK_SLOT: readonly [number, number, number, number] = [
  16, 708, 176, 80
]
/** After a burn, Try Again sits beside the Kitchen button in the stove close-up. */
export const RETRY_SLOT: readonly [number, number, number, number] = [
  212, 712, 376, 84
]
/** The shop's supplies sheet docks over the counter front and the floor. */
export const SHOP_SHEET: readonly [number, number, number, number] = [
  10, 296, 580, 496
]
/**
 * The React action slot covers this design rectangle (x, y, width, height): tall enough
 * for two 48 px buttons on an iPhone 12 Pro. On smaller screens it grows upwards, and
 * Shut Curtains stacks on top of it during a heat wave.
 */
export const ACTION_SLOT: readonly [number, number, number, number] = [
  424, 640, 168, 156
]

// ---------------------------------------------------------------- Kitchen

/** Moulds in one batch, and with the Bigger Fridge. */
export const MOULDS = 4
export const MOULDS_BIG = 6
/** Gelatin packets per mould: 2 packets for 4 moulds. The Extra Gelatin Recipe uses 0.75. */
export const GELATIN_PER_MOULD = 0.5
export const GELATIN_PER_MOULD_RECIPE = 0.75
/** A recycled batch uses this many tubs of scraped floor jelly per mould. */
export const TUBS_PER_MOULD = 1
/** Gelatin packets at the start of a run, and the most you can keep. */
export const START_GELATIN = 4
export const GELATIN_MAX = 20
/** Price of one gelatin packet. */
export const GELATIN_PRICE = 2
/** A tray sets in the fridge for this long, in real time. ?fast makes it 3s. */
export const FRIDGE_MS = 60_000
/** A stirred mix stays pourable this long in the bowl (simulation time)… */
export const MIX_POURABLE_MS = 120_000
/** …then every further 30s takes 0.1 off its stir score. */
export const MIX_SET_STEP_MS = 30_000
export const MIX_SET_STEP = 0.1

/** The boil: the heat number, its noise and bubbles, the green zone and the burn rule. */
export const BOIL = {
  /** Holding raises heat from 0 to 1 over this long… */
  riseMs: 2600,
  /** …and letting go drains it from 1 to 0 over this long. */
  drainMs: 4200,
  /** Every 100 ms the heat jumps by a normal random amount with this spread. */
  noise: 0.015,
  noiseEveryMs: 100,
  /** Above half heat a bubble kicks the heat up by 0.04, every 1 to 2s. */
  bubble: 0.04,
  bubbleAbove: 0.5,
  bubbleMinMs: 1000,
  bubbleMaxMs: 2000,
  /** The green zone, and Assist Mode's wider one. */
  greenFrom: 0.58,
  greenTo: 0.74,
  assistGreenFrom: 0.54,
  assistGreenTo: 0.78,
  /** Time in the green that finishes the boil. */
  doneMs: 8000,
  /** Staying above this heat for burnMs in a row burns the batch. */
  burnAbove: 0.9,
  burnMs: 1000
} as const

/** The stir: 50 circles around the bowl's centre, with beats, sloshes and spills. */
export const STIR = {
  circles: 50,
  /** "Halfway. Your arm hurts." */
  halfway: 25,
  /** The spoon bends. */
  bend: 45,
  /** A circle quicker than this sloshes; Assist Mode allows quicker ones. */
  sloshBelowMs: 450,
  assistSloshBelowMs: 350,
  /** Odds that a slosh spills a splat onto the kitchen floor. */
  spillOdds: 0.25,
  /** Circles wider than this clack the spoon on the rim. */
  clackAbove: 150,
  /** Samples closer to the centre than this don't count towards a circle. */
  minRadius: 40
} as const
/** The pour: hold to pour into each mould, aiming for the fill line. */
export const POUR = {
  /** Flow ramps from 0 to full over this long while you hold… */
  rampMs: 300,
  /** …and drips on for this long after you let go, adding about 0.05. */
  decayMs: 250,
  /** A mould fills this fraction per second at full flow. */
  fillPerSecond: 0.38,
  /** The fill line, and the fill that overflows. */
  line: 0.8,
  spillAbove: 1,
  /** The jug won't move on from a mould filled less than this: "Fill it up!" */
  minFill: 0.4,
  /**
   * A mould short of the line makes a thinner, weaker block: quality times
   * 1 - thin x (shortfall / line). Half-full (0.4) keeps 0.7 of it.
   */
  thin: 0.6,
  /** Accuracy drops to 0 this far from the line (wider in Assist Mode). */
  window: 0.25,
  assistWindow: 0.35,
  /** The jug moves to the next mould this long after the pour stops. */
  nextAfterMs: 500
} as const
/**
 * Noodle Reinforcement: the noodles boil on the back hob for a real-time minute, then
 * you hold to drain them and let go inside the window.
 */
export const NOODLES = {
  /** The real-time boil. ?fast makes it 3s. */
  boilMs: 60_000,
  /** Letting go before this leaves them watery… */
  drainFrom: 1200,
  /** …and after this turns them to mush. */
  drainTo: 2200,
  /** Holding this long tips the whole lot into the sink. */
  dumpMs: 3500,
  /** Watery noodles take this much off the batch's quality. */
  wateryQ: 0.1
} as const
/** Radius of a kitchen spill splat. */
export const SPILL_RADIUS = 26
/** Washing up in the sink. Scrubbing faster than MESS.rubLimit flings suds on the floor. */
export const WASH = {
  /** Strokes that take one bowl from dirty to clean. */
  bowlStrokes: 10,
  /** Extra strokes each burn leaves on the pot. */
  potStrokes: 6,
  /** Radius of the suds splat that fast scrubbing leaves on the kitchen floor. */
  sudsRadius: 22
} as const

// ---------------------------------------------------------------- Hallway carry

/** The walk down the hallway with the tray. Angles are in degrees. */
export const CARRY = {
  /** Route length from the kitchen door to the wall-room door… */
  route: 2400,
  /** …and the first carry's shorter one. */
  firstRoute: 1200,
  /** Walking speed while you hold to walk, in units per second. */
  walkSpeed: 110,
  /** Full steering input tilts the tray this far. */
  steerDeg: 25,
  /** The tray follows its target angle at this damp rate. */
  angleLambda: 10,
  /** The drift you fight is pulled back to level at this rate per second… */
  driftPull: 0.6,
  /** …and jitters by this much noise (degrees per root second) in section 1… */
  driftNoise: 3,
  /** …plus this much for each later section, so section 5 has 7. */
  driftNoisePerSection: 1,
  /** Standing still scales the noise by this. */
  standingNoise: 0.5,
  /** Assist Mode scales the noise by this. */
  assistNoise: 0.6,
  /** Each footstep bobs the tray by this much, alternating every stepMs while walking. */
  bobDeg: 1.2,
  stepMs: 420,
  /** Blocks slide with a = slideAccel x sin(angle) - slideDrag x v (units/s^2). */
  slideAccel: 900,
  slideDrag: 4,
  /** The jelly grips the tray below this tilt, and below the wider Assist one. */
  gripDeg: 4,
  assistGripDeg: 6,
  /** A gripping block slower than this (units/s) stops dead. */
  stickSpeed: 2,
  /** Block centres sit this far apart on the tray; blocks can't pass each other. */
  pitch: 58,
  /** The outer block falls off once it slides this far from where it started. */
  edgeMargin: 53,
  /** A jolt over the limit hops every block and kicks it by up to this speed… */
  hopKick: 40,
  /** …for this long, and the next hop can't come sooner than hopCooldownMs. */
  hopMs: 260,
  hopCooldownMs: 400,
  /** Mouse and thumb steering: this far from the origin is full input (design units). */
  pointerRange: 150,
  /** An empty tray ends the carry after this long. */
  emptyEndMs: 1500,
  /** Radius of the splat a dropped block leaves on the hallway floor. */
  splatRadius: 40
} as const

// ---------------------------------------------------------------- Floor cleaning

/** Scraping and mopping splats, and the mop head. */
export const MESS = {
  /** Strokes that scrape a set chunk into the tub, then strokes that mop the smear. */
  scrapeStrokes: 5,
  mopStrokes: 7,
  /** A rub stroke must be at least this long (design units). */
  rubAmplitude: 40,
  /** Mopping faster than this (design units per second) spreads the smear once. */
  rubLimit: 2400,
  assistRubLimit: 3600,
  /** The spread smear lands this far to the smear's side, at this fraction of its size. */
  spreadDistance: 70,
  spreadScale: 0.6,
  /** One mop head mops this many smears, then falls apart. */
  headSmears: 5,
  /** Spare mop heads you can keep. */
  spareHeadsMax: 3,
  /** Price of one spare mop head. */
  headPrice: 4,
  /** Kitchen splats lie in the carry route's first stretch, wall-room ones in its last. */
  roomStretch: 300,
  /** Scraping strokes that take a cell's residue from 1 to 0 and prise out its nails. */
  cellStrokes: 12,
  /** Scraping too fast flings this much residue onto the empty cell next door. */
  flingResidue: 0.25
} as const

/** A slip on a puddle during a carry. */
export const SLIP = {
  /** The drift jumps this many degrees towards the smear's side… */
  kickDeg: 22,
  /** …over this long… */
  kickMs: 150,
  /** …and you can't walk for this long. */
  stopMs: 800
} as const

// ---------------------------------------------------------------- Rooms

/** A paper wipe between rooms takes this long, half covering and half uncovering. */
export const WIPE_MS = 250
/** Walking to or from the shop: the wipe holds "Walking to the shop…" for this long in total. */
export const SHOP_WALK_MS = 1200
/** Room backgrounds cache the design plus this margin on each side, for wide and tall screens. */
export const ROOM_MARGIN = 200

// ---------------------------------------------------------------- Cold open

/**
 * The uncle's cold open: slide in, each line's time on screen, the walk off, and a
 * moment after it that swallows taps, so a tap meant to skip his lines never nails the
 * bare wall.
 */
export const COLD_OPEN = {
  enterMs: 500,
  lineMs: 2800,
  exitMs: 700,
  settleMs: 500
} as const

// ---------------------------------------------------------------- Pauses

/** Time spent in a hidden tab turns into at most this much grip loss on return. */
export const HIDDEN_CATCH_UP_MS = 120_000

// ---------------------------------------------------------------- Input and hit testing

/** A press that moves further than this (CSS px) becomes a rub and spends no nail. */
export const RUB_THRESHOLD_CSS = 12
/** Nail-head re-hammer radius: world units, and CSS px minimums for touch and mouse. */
export const NAIL_HIT = { world: 30, touch: 24, mouse: 12 } as const
/** New-nail radius around jelly particles. */
export const JELLY_HIT = { world: 30, touch: 16, mouse: 8 } as const
/**
 * With no jelly under the hammer when it lands, the block you pressed still takes the
 * nail within this many jelly radii, since it may have swung on its first nail.
 */
export const PRESSED_JELLY_REACH = 2
/** Fly and cat tap radius. */
export const CRITTER_HIT = { world: 50, touch: 30, mouse: 20 } as const

// ---------------------------------------------------------------- Quality

/** Spring stiffness at quality 0, and how much quality adds. */
export const STIFFNESS_BASE = 0.025
export const STIFFNESS_PER_Q = 0.055
/** Heat waves multiply spring stiffness by this. */
export const HEAT_STIFFNESS = 0.7
/** Odds of one extra torn spring per tear: 0.9 - 0.8 q, capped at 0.8. */
export const EXTRA_TEAR_BASE = 0.9
export const EXTRA_TEAR_PER_Q = 0.8
export const EXTRA_TEAR_MAX = 0.8
/** Mesh backing multiplies the extra-tear odds by this. */
export const MESH_EXTRA_TEAR = 0.6
/** Toughness divides impulse grip loss: 0.7 + 0.3 q, times the upgrade factors. */
export const TOUGH_BASE = 0.7
export const TOUGH_PER_Q = 0.3
export const MESH_TOUGHNESS = 1.2
export const NOODLE_TOUGHNESS = 1.15
/** The split threshold: 0.86 + 0.08 q. Noodles never split. */
export const SPLIT_BASE = 0.86
export const SPLIT_PER_Q = 0.08
/** Assist Mode adds this to the split threshold. */
export const ASSIST_SPLIT_BONUS = 0.04
/** Quality inputs: base plus weights for boil, stir and pour scores. */
export const Q_BASE = 0.2
export const Q_BOIL = 0.25
export const Q_STIR = 0.45
export const Q_POUR = 0.1
/** A dirty bowl scales quality down to this fraction. */
export const Q_DIRTY_BOWL = 0.6
/** Recycled jelly keeps this fraction of its quality. */
export const Q_RECYCLED = 0.7
/** The Extra Gelatin Recipe adds this much quality. */
export const Q_RECIPE = 0.08
/** Quality never drops below this. */
export const Q_MIN = 0.05
/** Labels: "Firm" from this quality up, "Wobbly" from the next, otherwise "Sloppy". */
export const FIRM_FROM = 0.75
export const WOBBLY_FROM = 0.5
/** A label names a cause only when that input cost at least this much quality. */
export const CAUSE_MIN_LOSS = 0.02
/** A stir score of 0 leaves this many lumps in the jelly. */
export const MAX_LUMPS = 8

// ---------------------------------------------------------------- Hammer

/** Time for the hammer charge to fill, in ms. */
export const HAMMER_FILL_MS = 900
/** Section 1 fills slower while you learn. */
export const HAMMER_FILL_S1_MS = 1300
/** Assist Mode multiplies the fill time by this. */
export const ASSIST_FILL_SCALE = 1.3
/** Below this charge the nail bounces out. */
export const WEAK_BELOW = 0.4
/** The sweet zone, and its centre where grip is a perfect 1. */
export const SWEET_FROM = 0.58
export const SWEET_TO = 0.8
export const SWEET_CENTRE = 0.69
/** Assist Mode widens the sweet zone by this factor around its centre. */
export const ASSIST_SWEET_SCALE = 1.4
/** Grip at the edges of the sweet zone. */
export const SWEET_EDGE_GRIP = 0.9
/** Grip from a loose hit and a hard hit. */
export const LOOSE_GRIP = 0.55
export const HARD_GRIP = 0.85
/** Springs torn by each outcome before the extra-tear roll. */
export const TEARS = { weak: 0, loose: 1, sweet: 1, hard: 3 } as const
/** Re-hammers tear this many: loose and sweet 0, hard 1. */
export const REHAMMER_TEARS = { weak: 0, loose: 0, sweet: 0, hard: 1 } as const
/** Each earlier re-hammer of a nail cuts the outcome grip by this fraction… */
export const REHAMMER_FALLOFF = 0.1
/** …but never below this share of it, so an old block can always be kept up. */
export const REHAMMER_FLOOR = 0.75

// ---------------------------------------------------------------- Grip

/** Base decay per second: an average block on 2 sweet nails reaches grip 0.3 in about 7.3 min. */
export const DECAY_BASE = 1 / 540
/** Quality factor: 2 - 1.5 q. */
export const DECAY_Q_BASE = 2
export const DECAY_Q_SLOPE = 1.5
/** Load factor for 1, 2, 3 and 4+ live fixings on a block. */
export const LOAD = [2.2, 1.0, 0.8, 0.7] as const
/** Residue factor: 1 + r, so an unscraped cell doubles the next block's decay. */
export const RESIDUE_DECAY = 1
/** Heat multipliers: heat wave, and heat wave with the curtains shut. */
export const HEAT_DECAY = 3
export const CURTAIN_DECAY = 1.8
/**
 * Screws: tap a spot on the jelly, then draw slow circles around it. Grip comes from how
 * even the circles were; a circle quicker than stripBelowMs strips the jelly.
 */
export const SCREW = {
  /** Circles that drive one screw home. */
  circles: 4,
  /** A circle quicker than this strips the jelly, and the quicker Assist limit. */
  stripBelowMs: 600,
  assistStripBelowMs: 450,
  /** Each strip tears this many springs and takes this much off the screw's grip. */
  stripTears: 2,
  stripGrip: 0.15,
  /** Grip = base + evenness x this, before strips. */
  baseGrip: 0.6,
  evennessGrip: 0.4,
  /** Circles must stay at least this far from the screw (design units). */
  minRadius: 24,
  /** A pack of screws, its price, the most you can keep, and the box the upgrade comes with. */
  packSize: 10,
  packPrice: 8,
  max: 60,
  starterBox: 10,
  /** The Buy screws chore opens below this many, once you own screws. */
  low: 4
} as const
/**
 * Mesh Backing: trace the 4 dotted edges of a sheet before each block goes up. Lengths
 * and speeds are in design units, so 1 unit is 1 CSS px on a 1280 x 800 desktop.
 */
export const MESH = {
  /** The sheet you cut, on its mat over the wall (x, y, width, height). */
  sheet: [140, 236, 320, 250] as const,
  /** The cutting mat around it. A press outside the mat puts the sheet down. */
  mat: [96, 182, 408, 344] as const,
  /** An edge traced further off the line than this is ragged; Assist allows more… */
  tolerance: 12,
  assistTolerance: 18,
  /** …and touch never asks for less than this many CSS px. */
  touchTolerancePx: 10,
  /** The first stretch after each press or corner doesn't count, so a finger can land. */
  leadIn: 16,
  /** Further off the line than this, the scissors stop following. */
  snag: 44,
  /** The scissors can't jump ahead along the edge by more than this in one move. */
  maxJump: 40,
  /** A press this close to the scissors picks them up (units, and touch CSS px). */
  grab: 40,
  grabTouchPx: 30,
  /** Tracing faster than this snaps the mesh back to the start of the edge. */
  speedLimit: 600,
  /** Speed is measured over windows at least this long. */
  speedWindowMs: 80,
  /** An edge counts as cut this close to its end. */
  endGap: 6,
  /** A ragged sheet gives this fraction of the mesh's help. */
  raggedHelp: 0.5,
  /** A snip sound plays every this many units of cut. */
  snipEvery: 28
} as const
/** Mesh and screws each multiply decay by this; together they never go below the floor. */
export const MESH_DECAY = 0.8
export const SCREW_DECAY = 0.8
export const UPGRADE_DECAY_FLOOR = 0.6
/** A fly sitting on a block multiplies its decay by this. */
export const FLY_DECAY = 1.5
/** Each hole past the second adds this much decay. */
export const HOLES_FREE = 2
export const HOLES_STEP = 0.3
/** Damage factor: 1 + 2 x the fraction of springs torn. */
export const DAMAGE_DECAY = 2
/**
 * Decay by section in normal play. Section 1 halves it while you learn. From section 2 a
 * fresh nail reaches its orange line in about 3 to 4 minutes, so the wall needs looking
 * after between batches; section 3 assumes screws, section 5 screws and mesh. The final
 * test uses 1 for every block. Measured with the balance harness (PLAN.md, Pacing).
 */
export const SECTION_DECAY: readonly number[] = [0.5, 2.05, 1.95, 2.75, 2.55]
/**
 * A section that runs long eases off, so a slow player always gets there. From `fromMs`
 * after the section became the active one, decay and the random-event clock slow evenly,
 * down to `min` at `toMs`. A third of average sections lock before it starts.
 */
export const LONG_SECTION = {
  fromMs: 8 * 60_000,
  toMs: 18 * 60_000,
  min: 0.1
} as const
/** Assist Mode multiplies all decay by this. */
export const ASSIST_DECAY = 0.5
/** A fixing at or below this grip rips out. */
export const RIP_OUT = 0.12
/** Pin length at grip 0, and the curve exponent: slack = 26 (1 - g)^1.5. */
export const SLACK_MAX = 26
export const SLACK_POWER = 1.5
/** Pin constraint stiffness. Stiff pins keep the look; grip decides when they break. */
export const PIN_STIFFNESS = 0.7
/** Lowest orange and red warning lines. */
export const ORANGE_MIN = 0.4
export const RED_MIN = 0.25
/** Warning lines sit this far above the grip an event would rip. */
export const WARNING_MARGIN = 0.08
/** A block counts as up while its largest pinned piece keeps this many particles. */
export const UP_MIN_PARTICLES = 6
/** Fixings on a block that lost its piece pop this long after, so the scrap clears. */
export const SCRAP_POP_MS = 1000

// ---------------------------------------------------------------- Impulses

/** Impulse strengths (grip loss scale) for each kind of shock. */
export const IMPULSE = {
  slam: 0.35,
  gentleSlam: 0.14,
  truck: 0.28,
  cat: 0.5,
  swat: 0.1
} as const
/**
 * The strongest and weakest event impulse in each section's pool, for warning lines.
 * S1: the scripted gentle slam. S2: slam and swat. S3: adds the truck. S4 and S5: adds the cat.
 */
export const SECTION_IMPULSE_POOLS: readonly {
  strongest: number
  weakest: number
}[] = [
  { strongest: IMPULSE.gentleSlam, weakest: IMPULSE.gentleSlam },
  { strongest: IMPULSE.slam, weakest: IMPULSE.swat },
  { strongest: IMPULSE.slam, weakest: IMPULSE.swat },
  { strongest: IMPULSE.cat, weakest: IMPULSE.swat },
  { strongest: IMPULSE.cat, weakest: IMPULSE.swat }
]
/**
 * Each section's random events: weights per event, the first event's delay after the
 * 4th block goes up, the gap between events (simulation ms), and whether the section
 * gets one heat wave. Section 1 has none.
 */
export const EVENT_POOLS: readonly {
  weights: Readonly<Partial<Record<'slam' | 'truck' | 'fly' | 'cat', number>>>
  firstMs: number
  gapMinMs: number
  gapMaxMs: number
  heatWave?: boolean
}[] = [
  { weights: {}, firstMs: Infinity, gapMinMs: Infinity, gapMaxMs: Infinity },
  {
    weights: { slam: 0.6, fly: 0.4 },
    firstMs: 90_000,
    gapMinMs: 120_000,
    gapMaxMs: 200_000
  },
  {
    weights: { slam: 0.35, fly: 0.35, truck: 0.3 },
    firstMs: 60_000,
    gapMinMs: 100_000,
    gapMaxMs: 170_000
  },
  {
    weights: { slam: 0.25, fly: 0.25, truck: 0.2, cat: 0.3 },
    firstMs: 60_000,
    gapMinMs: 60_000,
    gapMaxMs: 100_000,
    heatWave: true
  },
  {
    weights: { slam: 0.2, fly: 0.25, truck: 0.2, cat: 0.35 },
    firstMs: 45_000,
    gapMinMs: 70_000,
    gapMaxMs: 120_000,
    heatWave: true
  }
]
/** The director's rules: blocks up before the first event, mercy after a fall, the hold event. */
export const DIRECTOR = {
  /** The section's event clock starts when this many blocks are up… */
  armAt: 4,
  /** …and nothing fires while fewer than this many are up… */
  minUp: 3,
  /** …or within this long after a block fell, so a loss isn't followed by another. */
  mercyMs: 90_000,
  /** From section 2, one event strikes this far into every hold (of a 60s hold). */
  holdFromMs: 20_000,
  holdToMs: 50_000,
  /** Section 1's scripted gentle slam lands this far into its hold (of a 60s hold). */
  gentleSlamAtMs: 40_000,
  /**
   * A section with a heat wave gets it this long after its event clock starts, early
   * enough that it lands before an average section locks.
   */
  heatFromMs: 60_000,
  heatToMs: 180_000
} as const
/** The guided first section and the first-time tips. */
export const TUTORIAL = {
  /** A first-time tip shows over the room's own hint for this long (simulation ms). */
  tipMs: 9000,
  /** The single-nail lesson: still on one nail this long after its first bite, it rips. */
  lessonMs: 9000,
  /** The scripted sag comes this far into the first fridge wait (0 to 1)… */
  sagAtFridge: 0.5,
  /** …and leaves a nail this far below its red line. */
  sagBelowRed: 0.02,
  /** The fly lands in the bowl on this circle of the first stir… */
  stirFlyAt: 20,
  /** …and falls in on this one if you leave it. */
  stirFlyFallsAt: 30
} as const
/** The heat wave: a warning, then the heat. Decay and softening use HEAT_DECAY and HEAT_STIFFNESS. */
export const HEAT = {
  /** The toast and the orange sky come this long before the heat. */
  warnMs: 5000,
  durationMs: 90_000,
  /** The orange tint over the wall at full heat. The curtains halve it. */
  tint: 0.1
} as const
/** The door slam: stomping first, then the slam. */
export const SLAM = {
  /** Stomping before the slam, and the gap between stomps. */
  warnMs: 1200,
  stompEveryMs: 300,
  /** A slam kicks a carried tray's drift by this many degrees. */
  carryKickDeg: 8
} as const
/** The truck: a rumble that fades in, then ticks that shake the wall. */
export const TRUCK = {
  warnMs: 2000,
  shakeMs: 6000,
  tickMs: 100,
  /** Each tick jitters a carried tray's drift by up to this many degrees. */
  carryJitterDeg: 2
} as const
/** The fly: buzzing flight before it lands, its bites, and how long it stays. */
export const FLY = {
  /** Flying in before it lands: the warning. */
  arriveMs: 3000,
  /** A bite every this long after landing, each tearing biteTears springs plus a roll. */
  biteEveryMs: 4000,
  biteTears: 1,
  /** It leaves on its own this long after landing… */
  stayMs: 30_000,
  /** …flying off over this long. */
  leaveMs: 1500,
  /** A swatted fly stays squashed on screen this long. */
  squashMs: 900,
  /** How far off the section it starts, in world units. */
  entryGap: 140,
  /** The buzz repeats this often while it flies. */
  buzzEveryMs: 700,
  /** Lower quality pulls the fly: each block's weight is this minus its quality. */
  pickBias: 1.15
} as const
/** The cat: it stares from the windowsill, hops down, wiggles, jumps and hangs on. */
export const CAT = {
  stareMs: 1500,
  hopMs: 600,
  /** The butt wiggle before the jump: your window to shoo it. */
  wiggleMs: 3000,
  jumpMs: 350,
  hangMs: 1000,
  /** Walking off after it lets go, or after losing interest. */
  leaveMs: 1200,
  /** Bolting off after you shoo it. */
  fleeMs: 900,
  /** Springs its claws tear when it lands. Noodles halve it, rounding down. */
  tears: 3,
  /** While it hangs on, each step pulls its block down by this speed (units/step). */
  pull: 0.12,
  /** The wiggle sways the cat's rear by this many units. */
  wiggleAmp: 7,
  /** From this section index (S4) the cat also sits in the hallway on every carry… */
  hallFromSection: 3,
  /** …somewhere in this stretch of the route… */
  hallFrom: 0.4,
  hallTo: 0.75,
  /** …at least this far from a puddle… */
  puddleGap: 160,
  /** …and you trip over it when you walk within this many units. */
  tripReach: 46
} as const
/**
 * Knock-on: impulse per unit/step of impact speed above the minimum, capped. One fall, or
 * one spell swinging on a single nail, knocks each neighbour once, at its hardest hit.
 */
export const KNOCK_PER_SPEED = 0.25
export const KNOCK_MIN_SPEED = 0.5
export const KNOCK_MAX = 0.4
/**
 * A falling block that hits a neighbour at least this hard (units/step) knocks loose its
 * nails below their orange line. A one-cell drop lands at about 4, a swing at 1.7 to 2.6.
 */
export const KNOCK_LOOSE_SPEED = 2
/**
 * A block on one nail knocks nothing for this long after its last nail went in, so the
 * swing while you aim its second nail never knocks the old blocks beside it loose.
 */
export const KNOCK_SWING_GRACE_MS = 3000
/** An impulse within this window before a fall names the fall's cause. */
export const CAUSE_WINDOW_MS = 1500
/** Shared shove speeds (units per step) for the visible jiggle. */
export const SHOVE = { slam: 3.5, truck: 1.2, gentleSlam: 1.4 } as const
/** Each block's shove varies by at most this fraction. */
export const SHOVE_VARIATION = 0.1

// ---------------------------------------------------------------- Hand, falls and splats

/** The hand's pins on a held block. */
export const HAND_STIFFNESS = 0.25
/** Your arm trembles after this long holding a block… */
export const HAND_TREMBLE_MS = 5000
/** …and drops it after this long (15s in section 1). */
export const HAND_TIRE_MS = 8000
export const HAND_TIRE_S1_MS = 15000
/** Tremble amplitude of the hand pins, in world units. */
export const HAND_TREMBLE = 2.5
/** After this long without fixings, a block stops colliding with other blocks. */
export const PASS_THROUGH_MS = 2500
/** A falling block splats once its centre is this close to the floor. */
export const SPLAT_CENTRE_GAP = 60
/** A falling block that never lands splats after this long anyway. */
export const FALL_TIMEOUT_MS = 6000
/** Pieces this big leave a splat decal; smaller ones leave droplets. */
export const SPLAT_MIN_PARTICLES = 3
/** Residue left on a cell when its block falls. */
export const FALL_RESIDUE = 1

// ---------------------------------------------------------------- Section flow and coins

/** The section hold, and the held time after which a block pays. ?fast makes both 3s. */
export const HOLD_MS = waitMs(60_000)
export const PAY_HELD_MS = waitMs(60_000)
/** The drum roll plays over the last part of the hold. */
export const DRUM_ROLL_MS = Math.min(10_000, HOLD_MS / 2)
/** Coins per block that holds for PAY_HELD_MS. */
export const BLOCK_PAY = 4
/** Lock bonus: 10 + 5 x section number. */
export const LOCK_BONUS_BASE = 10
export const LOCK_BONUS_STEP = 5
/** Grade thresholds on the weakest grip at lock. */
export const GRADES = [
  ['A', 0.75],
  ['B', 0.6],
  ['C', 0.45]
] as const
/** Starting coins and nails. */
export const START_COINS = 10
export const START_NAILS = 40
/** Nail stock limit. */
export const NAILS_MAX = 60
/** Price of a pack of 10 nails. */
export const NAIL_PACK_PRICE = 5
/** The Buy nails chore opens below this many nails. */
export const NAILS_LOW = 10
/** The Buy a mop head chore opens when the fitted head has fewer smears left than this. */
export const MOP_LOW = 2
/**
 * The odd job: sweep the shop floor for coins. It is offered while you have fewer
 * coins than `under` and can't make a batch or restock nails.
 */
export const ODD_JOB = { pay: 6, strokes: 24, under: 10 } as const
/** The shopkeeper looks up from her phone for this long after you buy something. */
export const LOOK_UP_MS = 1600

// ---------------------------------------------------------------- Replays and alerts

/** Splat replays: an off-screen recorder that films the wall, or the hallway mid-carry. */
export const REPLAY = {
  /** Frame size in pixels, frames per second of simulation time, and seconds kept. */
  width: 300,
  height: 225,
  fps: 20,
  seconds: 3,
  /** The replay camera frames this many world units across. */
  worldWidth: 600,
  /** A clip is taken this long after the first block lands… */
  afterLandMs: 800,
  /** …or at most this long while more blocks are still falling. */
  maxAfterLandMs: 1600,
  /** The camera waits on a landed block this long, then goes back to the section. */
  holdMs: 1200,
  /** The corner replay plays at this speed, once. */
  speed: 0.35,
  /** The share card's picture, rendered mid-fall. */
  pictureWidth: 960,
  pictureHeight: 720
} as const
/**
 * "Meanwhile, at the Wall…" cuts away from other rooms for this long, longer while its
 * block is still falling, but never longer than the cap. It lingers a moment after the splat.
 */
export const CUTAWAY_MS = 2500
export const CUTAWAY_MAX_MS = 5000
export const CUTAWAY_AFTER_SPLAT_MS = 700
/** Away alerts show at most one toast this often. */
export const ALERT_GAP_MS = 2500
/** The uncle laughs at most this often, so a cascade isn't a wall of noise. */
export const LAUGH_GAP_MS = 1500
/** The replay picture-in-picture covers this design rectangle on phones: the PiP-safe zone. */
export const PIP_SLOT: readonly [number, number, number, number] = [
  360, 0, 240, 180
]

// ---------------------------------------------------------------- Juice

/** Screen shake amplitudes (design units). */
export const SHAKE = {
  hit: 3,
  hard: 6,
  split: 10,
  fall: 8,
  slam: 10
} as const
/** Screen shake fades over this long. */
export const SHAKE_MS = 400
/** Captions float for this long. */
export const CAPTION_MS = 1100
/** A placed block squashes to this and springs back. */
export const SQUASH = { x: 1.15, y: 0.85, ms: 200 } as const
/**
 * A block a falling neighbour hits flashes a yellow outline for `flashMs`. A hit of at
 * least `bonk` impulse that loosens nothing still gets a small "Bonk!" caption.
 */
export const KNOCK_FX = { flashMs: 450, bonk: 0.15 } as const

/**
 * The uncle's portrait. Reactions show over his base mood for a moment; a streak of
 * sweet hits makes his eyebrow twitch; his speech bubble holds a heckle or a taunt.
 */
export const UNCLE = {
  /** A fall: he smirks. */
  smirkMs: 1600,
  /** A cascade: he laughs and wipes a tear. */
  laughMs: 2600,
  /** A streak of sweet hits: his eyebrow twitches. */
  twitchMs: 1500,
  /** A section locks: the smirk drops. */
  flatMs: 2500,
  /** Sweet hits in a row that set off the twitch. */
  streak: 3,
  /** How long his speech bubble stays. */
  bubbleMs: 2200,
  /** Lost blocks that earn a taunt. */
  tauntLosses: [10, 25, 50],
  /** Nails in the bare wall that earn a taunt. */
  tauntBareWall: [1, 5, 10, 20]
} as const

// ---------------------------------------------------------------- Final test proxies

/** Most soft bodies alive at once while sections run as proxies. */
export const PROXY_CAP = 10
/** Proxy sag spring and damping: s'' = -40 (s - s0) - 5 vs. */
export const PROXY_SAG_K = 40
export const PROXY_SAG_DAMP = 5
/** Proxy swing spring with 2 or more fixings, with 1, and the swing damping. */
export const PROXY_SWING_K = 30
export const PROXY_SWING_K_ONE = 6
export const PROXY_SWING_DAMP = 4
/** A slam kicks each proxy's sag speed by 60 to 120 units/s and its swing by up to 0.8 rad/s. */
export const PROXY_SLAM_SAG_MIN = 60
export const PROXY_SLAM_SAG_MAX = 120
export const PROXY_SLAM_SWING = 0.8
/** A promoted body counts as calm while every particle moves slower than this (units/s)… */
export const CALM_SPEED = 4
/** …and turns back into a proxy after this long calm. */
export const DEMOTE_CALM_MS = 2000
/** A falling body this close above a proxy promotes it. */
export const PROXY_FALL_REACH = 60
/** Gravity for a proxy that falls without a body because the cap was full (units/s^2). */
export const SCRIPTED_FALL_G = 1800

// ---------------------------------------------------------------- The final test

/**
 * The final test: the uncle arrives, snips the cling film off every section, gives you
 * Last Touches, then runs a 60s hold (HOLD_MS) with the same fly and slam every attempt.
 * Times are simulation ms.
 */
export const FINAL = {
  /** The doorbell and his walk in with the deckchair, the first time… */
  arriveMs: 2600,
  /** …and the return gag on every retry. */
  returnMs: 3000,
  /** He snips one section's cling film this often, then pauses after the last. */
  snipEveryMs: 550,
  snipEndMs: 700,
  /** Last Touches: time to re-nail while he unfolds the deckchair. */
  touchesMs: 20_000,
  /** The scripted fly and slam, this far into a 60s test (scaled with HOLD_MS). */
  flyAtMs: 12_000,
  slamAtMs: 35_000,
  /** Physics runs on this long after the first fall, so the cascade plays out… */
  cascadeMs: 2000,
  /** …then the verdict waits at most this long for the replay clip. */
  clipWaitMs: 2500,
  /** Falling with less than this left on the clock reads as a near miss. */
  nearMissMs: 10_000,
  /** "Call me when it's fixed." shows this long, then he walks to the door. */
  lineMs: 1800,
  walkMs: 900,
  /** His door slam shakes the weakest section off one block this often… */
  dropEveryMs: 80,
  /** …and you get the wall back this long after the last one. */
  afterDropMs: 1800,
  /** A section that locks again after a failed test pays this, not its full bonus. */
  relockBonus: 10,
  /** The wall held: he stares in silence, hands over his keys, then walks out… */
  stareMs: 2000,
  keysMs: 1600,
  exitMs: 900,
  /** …and his door slam drops one block this often, so the whole wall goes in 1.8s… */
  collapseEveryMs: 30,
  /**
   * …and the ending screen opens this long after the slam, so the 3s replay starts
   * just before the slam and ends with every block on the floor.
   */
  endingAfterMs: 2900,
  /** The warning lines in the final test: its slam is the strongest event, a swat the weakest. */
  pool: { strongest: IMPULSE.slam, weakest: IMPULSE.swat }
} as const
