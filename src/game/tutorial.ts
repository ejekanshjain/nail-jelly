import { isUp } from './section'
import { TUTORIAL } from './tuning'
import type { BlockState, GameState } from './types'
import { blockNailLevelFor, blockWarningLines } from './warnings'

// The guided first section and the first-time tips. Section 1 already decays at half
// speed and fills the hammer slower; these are its scripted lessons, plus one tip the
// first time each new thing happens.

/** Every first-time tip and tutorial beat. Each shows once per run. */
export type TipId =
  | 'lesson'
  | 'first-pay'
  | 'stir-fly'
  | 'pipeline'
  | 'scripted-sag'
  | 'first-splat'
  | 'sag-alert'
  | 'event-slam'
  | 'event-truck'
  | 'event-fly'
  | 'event-cat'
  | 'event-heat'
  | 'upgrade-recipe'
  | 'upgrade-fridge'
  | 'upgrade-screws'
  | 'upgrade-mesh'
  | 'upgrade-noodles'

/** The words for each tip. */
export const TIPS: Record<TipId, string> = {
  lesson: 'One nail lets it spin. Use two, one near each top corner.',
  'first-pay':
    'Every block that holds for 60 seconds pays. You need 12, so make more jelly.',
  'stir-fly': 'A fly in the bowl! Tap it.',
  pipeline: 'Start the next batch while this one sets.',
  'scripted-sag':
    'A nail on the wall is slipping. Go back and hammer it in again.',
  'first-splat': 'Jelly on the floor. Rub it to scrape it up, then mop it.',
  'sag-alert':
    'Orange nails are slipping, red ones are about to go. Re-hammer them.',
  'event-slam':
    'Stomping means a door slam is coming. Nails above orange survive it.',
  'event-truck': 'A truck shakes the wall for 6 seconds. Weak nails go first.',
  'event-fly': 'A fly eats the jelly it sits on. Tap it to swat it.',
  'event-cat': 'The cat waits for you, then jumps. Tap it while it wiggles.',
  'event-heat':
    'Heat softens the jelly. Shut the curtains, then re-nail what sags.',
  'upgrade-recipe': 'Stiffer jelly now. Each batch takes more gelatin.',
  'upgrade-fridge': 'Six moulds per batch now, and two bowls to wash.',
  'upgrade-screws':
    'Screws are in your hand. Tap the jelly, then circle slowly.',
  'upgrade-mesh': 'Tap a block on the stool to cut its mesh before it goes up.',
  'upgrade-noodles': 'Tap the back pot to boil noodles with every batch.'
}

/** The tutorial's progress, kept in the game state. */
export interface TutorialState {
  /** Tips already shown, so each shows once. */
  shown: TipId[]
  /** The tip showing over the room's own hint, and until when (simulation ms). */
  tip: string | null
  tipUntilMs: number
  /** Tips waiting for the one showing to finish, oldest first. */
  queue: TipId[]
  /** The block the single-nail lesson watches: the first block to take a nail. */
  lessonBlock: number | null
  /** The lesson has picked its block, so it never watches another. */
  lessonStarted: boolean
}

export function createTutorial(): TutorialState {
  return {
    shown: [],
    tip: null,
    tipUntilMs: 0,
    queue: [],
    lessonBlock: null,
    lessonStarted: false
  }
}

/** Marks a beat that has no tip of its own as done. Returns true the first time. */
export function firstTime(tutorial: TutorialState, id: TipId): boolean {
  if (tutorial.shown.includes(id)) return false
  tutorial.shown.push(id)
  return true
}

/**
 * Shows a tip the first time only, or queues it behind the tip showing now. Returns
 * whether it showed at once.
 */
export function showTip(
  tutorial: TutorialState,
  id: TipId,
  simMs: number
): boolean {
  if (!firstTime(tutorial, id)) return false
  if (currentTip(tutorial, simMs) !== null) {
    tutorial.queue.push(id)
    return false
  }
  tutorial.tip = TIPS[id]
  tutorial.tipUntilMs = simMs + TUTORIAL.tipMs
  return true
}

/** Shows the next queued tip once the one before has had its time. Returns whether it did. */
export function nextTip(tutorial: TutorialState, simMs: number): boolean {
  if (currentTip(tutorial, simMs) !== null) return false
  const id = tutorial.queue.shift()
  if (!id) return false
  tutorial.tip = TIPS[id]
  tutorial.tipUntilMs = simMs + TUTORIAL.tipMs
  return true
}

/** The tip showing now, or null once its time is up. */
export function currentTip(
  tutorial: TutorialState,
  simMs: number
): string | null {
  return simMs < tutorial.tipUntilMs ? tutorial.tip : null
}

/**
 * The single-nail lesson. The first block to take a nail in section 1 is watched: still
 * on one nail `TUTORIAL.lessonMs` after its first bite, it turns on its nail and rips.
 * Returns that block when it should rip now.
 */
export function lessonRip(
  state: GameState,
  tutorial: TutorialState
): BlockState | null {
  const id = tutorial.lessonBlock
  if (id === null) return null
  const block = state.blocks.get(id)
  if (!block || !isUp(block) || block.firstBiteMs === null) {
    tutorial.lessonBlock = null
    return null
  }
  if (block.fixings.length > 1) {
    // Two nails: lesson learnt the easy way.
    tutorial.lessonBlock = null
    return null
  }
  if (state.simMs - block.firstBiteMs < TUTORIAL.lessonMs) return null
  tutorial.lessonBlock = null
  return block
}

/** Starts watching a block for the lesson when it is section 1's first to take a nail. */
export function watchLesson(
  state: GameState,
  tutorial: TutorialState,
  blockId: number
): void {
  if (tutorial.lessonStarted || state.section !== 0) return
  tutorial.lessonStarted = true
  tutorial.lessonBlock = blockId
}

/**
 * The scripted sag: halfway through the first time the tray sets in section 1, one
 * healthy block on the wall slips just past its red line, so you learn to go back and
 * re-hammer. `fridgeProgress` is how far the fridge wait has run, 0 to 1. Returns the
 * block to sag, or null when there is none, it is too early, or it already happened.
 */
export function scriptedSagBlock(
  state: GameState,
  tutorial: TutorialState,
  fridgeProgress: number
): BlockState | null {
  if (state.section !== 0 || state.fridge === null) return null
  if (fridgeProgress < TUTORIAL.sagAtFridge) return null
  if (tutorial.shown.includes('scripted-sag')) return null
  for (const cell of state.sections[0]?.cells ?? []) {
    const block = cell.block === null ? undefined : state.blocks.get(cell.block)
    if (!block || !isUp(block) || block.fixings.length < 2) continue
    if (block.fixings.some(f => blockNailLevelFor(block, f.grip) !== 'ok'))
      continue
    return block
  }
  return null
}

/** The grip the scripted sag leaves a block's first nail at: just past its red line. */
export function scriptedSagGrip(block: BlockState): number {
  return blockWarningLines(block).red - TUTORIAL.sagBelowRed
}
