import { formatClock, hash01 } from '../shared'
import { formatHeld } from './labels'
import {
  BLOCK_SPRINGS,
  FINAL,
  HOLD_MS,
  SECTION_COLS,
  SECTION_COUNT,
  SECTION_ORIGINS
} from './tuning'
import type { GameState } from './types'

// The final test as a plain state machine. The uncle arrives, snips the cling film off
// every section, gives you Last Touches, and runs the 60s test with the same fly and
// slam every attempt. A fall ends the attempt: the cascade plays out, the verdict shows,
// and his door slam shakes the weakest section off for you to rebuild.

export type FinalStage =
  /** The doorbell and his walk in, or the return gag on a retry. */
  | 'arrive'
  /** He snips the cling film off each section in turn. */
  | 'snip'
  /** Last Touches: time to re-nail before the clock starts. */
  | 'touches'
  /** The 60s test. */
  | 'test'
  /** A block fell: physics runs on so the cascade plays out. */
  | 'failing'
  /** The replay and his verdict, until you move on. */
  | 'verdict'
  /** "Call me when it's fixed.", and he walks to the door. */
  | 'leave'
  /** His door slam shakes the weakest section off, block by block. */
  | 'drop'
  /** Back to normal play to rebuild, until you call him again. */
  | 'rebuild'
  /** The wall held: he stares, hands over his keys, walks out and slams the door. */
  | 'passed'

/** The final test, kept across attempts. */
export interface FinalTestState {
  /** 1 for the first call, 2 for the first retry, and so on. */
  attempt: number
  stage: FinalStage
  /** Time spent in the current stage. */
  stageMs: number
  /** Sections snipped so far this attempt. */
  snipped: number
  /** Time left on the test clock. */
  holdLeftMs: number
  /** The scripted fly and slam already came this attempt. */
  flown: boolean
  slammed: boolean
  /** Blocks lost per section during this attempt. */
  falls: number[]
  /** Clock time left when the first block fell; null before any fall. */
  failedLeftMs: number | null
  /** The first fall came before the clock started. */
  failedEarly: boolean
  /** The section his door slam shakes off, once the cascade settles. */
  weakest: number | null
  /** Block ids to shake off, in order, and how many already went. */
  dropIds: number[]
  dropped: number
  /** Sections that lost blocks and queue for a refill after the rebuild, in order. */
  refills: number[]
}

/** What the test did this step, for the runner to act on. */
export type FinalEvent =
  | { type: 'snip'; section: number }
  | { type: 'touches' }
  | { type: 'start' }
  | { type: 'fly' }
  | { type: 'slam' }
  | { type: 'held' }
  | { type: 'settle' }
  | { type: 'door' }
  | { type: 'drop'; blockId: number }
  | { type: 'rebuild' }
  | { type: 'keys' }
  | { type: 'exit' }
  | { type: 'shut' }
  | { type: 'collapse'; blockId: number }
  | { type: 'ending' }

/** A fresh attempt: the uncle is at the door. `previous` only sets the attempt number. */
export function startFinal(previous: FinalTestState | null): FinalTestState {
  return {
    attempt: (previous?.attempt ?? 0) + 1,
    stage: 'arrive',
    stageMs: 0,
    snipped: 0,
    holdLeftMs: HOLD_MS,
    flown: false,
    slammed: false,
    falls: Array<number>(SECTION_COUNT).fill(0),
    failedLeftMs: null,
    failedEarly: false,
    weakest: null,
    dropIds: [],
    dropped: 0,
    refills: []
  }
}

function enter(final: FinalTestState, stage: FinalStage): void {
  final.stage = stage
  final.stageMs = 0
}

/** How long the uncle takes to arrive: the doorbell the first time, the gag after that. */
export function arriveMs(attempt: number): number {
  return attempt <= 1 ? FINAL.arriveMs : FINAL.returnMs
}

/** When the scripted fly and slam come, in test ms; they scale with HOLD_MS so `?fast` fits. */
export function scriptedAtMs(kind: 'fly' | 'slam'): number {
  const scale = HOLD_MS / 60_000
  return (kind === 'fly' ? FINAL.flyAtMs : FINAL.slamAtMs) * scale
}

/**
 * Moves the test on by `dtMs` and lists what happened. Stages that wait on you or on
 * the replay (`failing` past its cascade, `verdict`, `rebuild`, `passed`) only count time.
 */
export function stepFinal(
  final: FinalTestState,
  dtMs: number,
  out: FinalEvent[] = []
): FinalEvent[] {
  final.stageMs += dtMs
  switch (final.stage) {
    case 'arrive':
      if (final.stageMs >= arriveMs(final.attempt)) enter(final, 'snip')
      break
    case 'snip': {
      // One section every snipEveryMs, the first one straight away.
      while (
        final.snipped < SECTION_COUNT &&
        final.stageMs >= final.snipped * FINAL.snipEveryMs
      )
        out.push({ type: 'snip', section: final.snipped++ })
      const end = (SECTION_COUNT - 1) * FINAL.snipEveryMs + FINAL.snipEndMs
      if (final.stageMs >= end) {
        enter(final, 'touches')
        out.push({ type: 'touches' })
      }
      break
    }
    case 'touches':
      if (final.stageMs >= FINAL.touchesMs) {
        enter(final, 'test')
        final.holdLeftMs = HOLD_MS
        out.push({ type: 'start' })
      }
      break
    case 'test': {
      final.holdLeftMs = Math.max(0, final.holdLeftMs - dtMs)
      const elapsed = HOLD_MS - final.holdLeftMs
      if (!final.flown && elapsed >= scriptedAtMs('fly')) {
        final.flown = true
        out.push({ type: 'fly' })
      }
      if (!final.slammed && elapsed >= scriptedAtMs('slam')) {
        final.slammed = true
        out.push({ type: 'slam' })
      }
      if (final.holdLeftMs <= 0) {
        enter(final, 'passed')
        out.push({ type: 'held' })
      }
      break
    }
    case 'failing':
      // The cascade gets its time once; the runner then waits for the replay.
      if (
        final.stageMs >= FINAL.cascadeMs &&
        final.stageMs - dtMs < FINAL.cascadeMs
      )
        out.push({ type: 'settle' })
      break
    case 'leave':
      if (final.stageMs >= FINAL.lineMs + FINAL.walkMs) {
        enter(final, 'drop')
        out.push({ type: 'door' })
      }
      break
    case 'passed': {
      const t = final.stageMs
      const crossed = (at: number) => t >= at && t - dtMs < at
      const shut = shutAtMs()
      if (crossed(FINAL.stareMs)) out.push({ type: 'keys' })
      if (crossed(FINAL.stareMs + FINAL.keysMs)) out.push({ type: 'exit' })
      if (crossed(shut)) out.push({ type: 'shut' })
      // After the slam, the whole wall comes down one block at a time.
      const ids = final.dropIds
      while (
        t > shut &&
        final.dropped < ids.length &&
        t - shut >= final.dropped * FINAL.collapseEveryMs
      )
        out.push({ type: 'collapse', blockId: ids[final.dropped++]! })
      if (crossed(shut + FINAL.endingAfterMs)) out.push({ type: 'ending' })
      break
    }
    case 'drop': {
      // One block every dropEveryMs, the first one straight away.
      const ids = final.dropIds
      while (
        final.dropped < ids.length &&
        final.stageMs >= final.dropped * FINAL.dropEveryMs
      )
        out.push({ type: 'drop', blockId: ids[final.dropped++]! })
      const end = ids.length * FINAL.dropEveryMs + FINAL.afterDropMs
      if (final.stageMs >= end) {
        enter(final, 'rebuild')
        out.push({ type: 'rebuild' })
      }
      break
    }
    default:
  }
  return out
}

/**
 * A block fell during the attempt. The first fall stops the clock and starts the cascade.
 * Returns true when this fall failed the attempt.
 */
export function failFinal(final: FinalTestState, section: number): boolean {
  if (section >= 0 && section < final.falls.length) final.falls[section]!++
  if (!['snip', 'touches', 'test'].includes(final.stage)) return false
  final.failedEarly = final.stage !== 'test'
  final.failedLeftMs = final.failedEarly ? HOLD_MS : final.holdLeftMs
  enter(final, 'failing')
  return true
}

/** The replay is ready (or took too long): the verdict shows. */
export function showVerdict(final: FinalTestState): void {
  if (final.stage === 'failing') enter(final, 'verdict')
}

/** You closed the verdict: he says his line and heads for the door. */
export function leaveFinal(final: FinalTestState): void {
  if (final.stage === 'verdict') enter(final, 'leave')
}

/**
 * The section his door slam shakes off: the one with the most falls this attempt, and on
 * a tie the one with the lowest mean of weakest grip times integrity. An empty cell
 * counts as 0, so a section with holes is weaker.
 */
export function weakestSection(
  state: GameState,
  falls: readonly number[]
): number {
  let best = 0
  let bestFalls = -1
  let bestScore = Infinity
  for (const section of state.sections) {
    let sum = 0
    for (const cell of section.cells) {
      const block =
        cell.block === null ? undefined : state.blocks.get(cell.block)
      if (!block || block.fixings.length === 0) continue
      let grip = 1
      for (const f of block.fixings) grip = Math.min(grip, f.grip)
      const integrity = Math.max(0, 1 - block.torn / BLOCK_SPRINGS)
      sum += Math.max(0, grip) * integrity
    }
    const score = sum / Math.max(1, section.cells.length)
    const count = falls[section.index] ?? 0
    if (count > bestFalls || (count === bestFalls && score < bestScore)) {
      best = section.index
      bestFalls = count
      bestScore = score
    }
  }
  return best
}

/** Sections other than the weakest with an empty cell, in wall order, for refills. */
export function refillQueue(state: GameState, weakest: number): number[] {
  const out: number[] = []
  for (const section of state.sections)
    if (
      section.index !== weakest &&
      section.cells.some(cell => cell.block === null)
    )
      out.push(section.index)
  return out
}

/**
 * The cascade settled: the weakest section is chosen, its blocks queue to drop, and the
 * other sections that lost blocks queue for refills.
 */
export function settleFinal(final: FinalTestState, state: GameState): number {
  const weakest = weakestSection(state, final.falls)
  final.weakest = weakest
  final.refills = refillQueue(state, weakest)
  const ids: number[] = []
  for (const cell of state.sections[weakest]?.cells ?? [])
    if (cell.block !== null) ids.push(cell.block)
  final.dropIds = ids
  final.dropped = 0
  return weakest
}

/**
 * The verdict's headline: a fall before the clock even ran, a near miss, or plain defeat.
 * The replay's caption (`verdictCaption`) already says how long it held.
 */
export function verdictLine(final: FinalTestState): string {
  if (final.failedEarly) return 'It fell before he even started the clock.'
  const left = final.failedLeftMs ?? 0
  // Rounded up, so a fall in the last moment still reads "0.1s short".
  if (left <= FINAL.nearMissMs)
    return `${(Math.ceil(left / 100) / 10).toFixed(1)}s short. Uncle keeps his car.`
  return 'Uncle keeps his car.'
}

/**
 * The verdict replay's caption on the uncle's test clock, from the start of his 60s to
 * the first fall: "Held for 23.4s of 60". A fall before the clock ran held for 0s.
 */
export function verdictCaption(final: FinalTestState): string {
  const left = final.failedEarly ? HOLD_MS : (final.failedLeftMs ?? HOLD_MS)
  // Rounded down, as the headline rounds the shortfall up, so the two always add up.
  const held = Math.floor((HOLD_MS - left) / 100) / 10
  return `Held for ${held.toFixed(1)}s of ${HOLD_MS / 1000}`
}

/** When his door slams after the test held, in ms after the clock ran out. */
export function shutAtMs(): number {
  return FINAL.stareMs + FINAL.keysMs + FINAL.exitMs
}

/** How long the wall held in the end: the whole test, then until he shut the door. */
export function heldMs(final: FinalTestState): number {
  if (final.stage !== 'passed') return HOLD_MS - final.holdLeftMs
  return HOLD_MS + Math.min(final.stageMs, shutAtMs())
}

/** The ending replay's caption: "Held for 64.5s. Then he shut the door." */
export function endingLabel(final: FinalTestState): string {
  return `Held for ${(heldMs(final) / 1000).toFixed(1)}s. Then he shut the door.`
}

/**
 * The order the wall comes down after his door slam: the top sections first, each from
 * its top row down, with a stable shuffle inside each row so it ripples.
 */
export function collapseOrder(state: GameState): number[] {
  const out: { id: number; key: number }[] = []
  for (const section of state.sections)
    section.cells.forEach((cell, index) => {
      if (cell.block === null) return
      const row = Math.floor(index / SECTION_COLS)
      const top = SECTION_ORIGINS[section.index]?.[1] ?? 0
      out.push({
        id: cell.block,
        key: top + row * 100 + hash01(cell.block, 3) * 60
      })
    })
  return out.sort((a, b) => a.key - b.key).map(item => item.id)
}

/** The longest any one block held: the ones that fell, and the ones still on the wall. */
export function bestHoldMs(state: GameState): number {
  let best = state.stats.longestHoldMs
  for (const block of state.blocks.values()) {
    const on = ['up', 'locked', 'proxy'].includes(block.status)
    if (on && block.firstBiteMs !== null)
      best = Math.max(best, state.simMs - block.firstBiteMs)
  }
  return best
}

/**
 * The ending's stats, for its screen and the share card. Take them before his door slam
 * brings the wall down, so the blocks lost are your own.
 */
export function endingStats(
  state: GameState
): { label: string; value: string }[] {
  return [
    { label: 'Blocks lost', value: String(state.stats.blocksLost) },
    { label: 'Best hold', value: formatHeld(bestHoldMs(state)) },
    { label: 'Nails in bare wall', value: String(state.stats.bareWallNails) },
    { label: "Uncle's car", value: 'Yours' }
  ]
}

/** What the uncle brings back each time you call him again. */
export type ReturnGag = 'none' | 'snacks' | 'neighbour' | 'crew'

export function returnGag(attempt: number): ReturnGag {
  if (attempt <= 1) return 'none'
  if (attempt === 2) return 'snacks'
  if (attempt === 3) return 'neighbour'
  return 'crew'
}

/** The test's status in a few words, for the nav button and the desktop column. */
export function finalStatus(final: FinalTestState): string {
  switch (final.stage) {
    case 'arrive':
      return 'Uncle is here'
    case 'snip':
      return 'Off come the locks'
    case 'touches':
      return 'Last touches'
    case 'test':
      return `Test ${formatClock(final.holdLeftMs)}`
    case 'passed':
      return 'It held!'
    case 'rebuild':
      return 'Rebuild'
    default:
      return 'It fell'
  }
}
