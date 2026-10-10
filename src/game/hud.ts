import {
  createStore,
  type RealTimer,
  type ReplayClip,
  type Store
} from '../shared'
import type { FinalStage } from './finalTest'
import type { HeatPhase } from './heat'
import type { SplatStat } from './replays'
import type { Framing } from './sim/camera'

import type {
  FixingKind,
  GameState,
  KitchenView,
  MixStage,
  SceneId,
  TrayLocation
} from './types'

/** The ending: the filmed collapse, its caption, the share picture and the run's stats. */
export interface EndingInfo {
  clip: ReplayClip | null
  /** "Held for 64.5s. Then he shut the door." */
  label: string
  picture: CanvasImageSource | null
  stats: SplatStat[]
}

/** A failed final-test attempt's verdict, for its dialog. */
export interface VerdictInfo {
  id: number
  /** "0.8s short. Uncle keeps his car." */
  line: string
  /** The replay's caption on his test clock: "Held for 23.4s of 60". */
  caption: string
  /** Which section his door slam will shake off, and what happens next. */
  note: string
  /** Only a replay with a higher id shows this attempt's fall. */
  replayAfter: number
}

/** The latest splat replay: its clip, caption, blame line and share card parts. */
export interface ReplayInfo {
  id: number
  clip: ReplayClip
  label: string
  blame: string
  /** The share card picture: a sharp mid-fall render, or the clip's still. */
  picture: CanvasImageSource | null
  stats: SplatStat[]
}

/** Discrete game facts React shows. The loop publishes it; it only notifies on change. */
export interface HudSnapshot {
  phase: GameState['phase']
  /** The room on screen. It changes halfway through a wipe. */
  scene: SceneId
  /** The kitchen overview or the open station. */
  kitchenView: KitchenView
  /** The batch on the stove, by stage. */
  mix: MixStage | null
  /** The batch burnt and waits for Try Again. */
  burnt: boolean
  /** The batch's scores so far, for the recipe card. */
  batchNote: string
  /** Where the poured tray is. */
  tray: TrayLocation | null
  /** Walking the tray down the hallway: the nav bar shows only Go Back. */
  carrying: boolean
  /** The fridge's real-time wait, for `TimerChip`. */
  fridge: RealTimer | null
  /** The noodles' real-time wait on the back hob, for `TimerChip`. */
  noodles: RealTimer | null
  /** Blocks up with a nail past its red line; the Wall nav button pulses while above 0. */
  sagging: number
  section: number
  blocksUp: number
  holdActive: boolean
  view: Framing
  stool: number
  handBusy: boolean
  allLocked: boolean
  /** Smears the fitted mop head can still mop. */
  mopUses: number
  /** Tubs of scraped floor jelly, for Recycled Batch. */
  tubs: number
  /** The shopkeeper offers the odd job: you are broke and stuck. */
  oddJob: boolean
  /** Sweeping the shop floor; the supplies sheet hides meanwhile. */
  sweeping: boolean
  /** What new presses on the jelly drive in: nails, or screws once you own them. */
  tool: FixingKind
  /**
   * A room wipe or the "Meanwhile, at the Wall…" cutaway covers the room; its buttons
   * hide meanwhile, so they never float over the paper sheet.
   */
  covered: boolean
  /** A heat wave on its way or under way, for the Shut Curtains button. */
  heat: HeatPhase | null
  /** The curtains are shut for this heat wave. */
  curtains: boolean
  /** Where the final test is while the uncle visits, or null. */
  finalStage: FinalStage | null
  /** Times you have called the uncle so far. */
  attempt: number
  /** Why you can't call the uncle yet, or null when you can. */
  callBlocker: string | null
  /** A failed attempt's verdict, while it waits for you. */
  verdict: VerdictInfo | null
  /** The ending, once the wall held and came down. */
  ending: EndingInfo | null
  /** The latest splat replay, for the corner player. A new one replaces it. */
  replay: ReplayInfo | null
  tip: string
}

/** The viewport's fit, published on resize so React can place buttons over the canvas. */
export interface LayoutSnapshot {
  /** CSS px per design unit. */
  scale: number
  /** CSS position of the design origin inside the canvas box. */
  offsetX: number
  offsetY: number
}

export function createHud(): Store<HudSnapshot> {
  return createStore<HudSnapshot>({
    phase: 'cold-open',
    scene: 'wall',
    kitchenView: 'overview',
    mix: null,
    burnt: false,
    batchNote: '',
    tray: null,
    carrying: false,
    fridge: null,
    noodles: null,
    sagging: 0,
    section: 0,
    blocksUp: 0,
    holdActive: false,
    view: 'section',
    stool: 0,
    handBusy: false,
    allLocked: false,
    mopUses: 0,
    tubs: 0,
    oddJob: false,
    sweeping: false,
    tool: 'nail',
    covered: false,
    heat: null,
    curtains: false,
    finalStage: null,
    attempt: 0,
    callBlocker: null,
    verdict: null,
    ending: null,
    replay: null,
    tip: ''
  })
}

export function createLayout(): Store<LayoutSnapshot> {
  return createStore<LayoutSnapshot>({ scale: 1, offsetX: 0, offsetY: 0 })
}
