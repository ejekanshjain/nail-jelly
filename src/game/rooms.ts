import { formatClock, isDone, now, timeLeftMs } from '../shared'
import { finalStatus } from './finalTest'
import { noodlesReady } from './noodles'
import { isUp, upCount } from './section'
import { SECTION_CELLS, SHOP_WALK_MS, WIPE_MS } from './tuning'
import type { GameState, SceneId } from './types'
import { sinkTarget } from './wash'
import { blockNailLevelFor } from './warnings'

/** The four rooms the nav bar switches between. */
export type RoomId = 'kitchen' | 'hallway' | 'wall' | 'shop'

/** Nav order, label and desktop key for each room. */
export const ROOMS: readonly {
  id: RoomId
  label: string
  key: string
  code: string
}[] = [
  { id: 'kitchen', label: 'Kitchen', key: '1', code: 'Digit1' },
  { id: 'hallway', label: 'Hallway', key: '2', code: 'Digit2' },
  { id: 'wall', label: 'Wall', key: '3', code: 'Digit3' },
  { id: 'shop', label: 'Shop', key: '4', code: 'Digit4' }
]

/** The short live status a nav button shows under its label, at wall-clock time `at`. */
export function roomStatus(
  state: GameState,
  room: RoomId,
  at: number = now()
): string {
  if (room === 'kitchen') {
    const fridge = state.fridge
    if (fridge)
      return isDone(fridge, at)
        ? 'Ready!'
        : `Fridge ${formatClock(timeLeftMs(fridge, at))}`
    if (noodlesReady(state, at)) return 'Drain me'
    const stage = state.mix?.stage
    if (stage === 'stirred' && state.noodles)
      return `Noodles ${formatClock(timeLeftMs(state.noodles, at))}`
    return stage === 'boil'
      ? state.mix?.burnt
        ? 'Burnt'
        : 'Boil me'
      : stage === 'stir'
        ? 'Stir me'
        : stage === 'stirred'
          ? 'Pour me'
          : sinkTarget(state)
            ? 'Wash up'
            : ''
  }
  if (room === 'wall') {
    if (state.phase === 'final' && state.final) return finalStatus(state.final)
    // The phone top bar has no section label, so the Wall button names the section.
    const counting =
      !state.sections.every(s => s.locked) &&
      !state.sections[state.section]?.holdActive
    const status = sectionStatus(state)
    return counting ? `S${state.section + 1} ${status}` : status
  }
  if (room === 'hallway') {
    let splats = 0
    for (const splat of state.splats) if (splat.room === 'hallway') splats++
    return splats === 0 ? '' : splats === 1 ? '1 splat' : `${splats} splats`
  }
  return ''
}

/** The active section's progress in words, for the desktop column. */
export function sectionStatus(state: GameState): string {
  if (state.phase === 'final' && state.final) return finalStatus(state.final)
  if (state.sections.every(s => s.locked)) return 'All locked'
  const section = state.sections[state.section]
  if (section?.holdActive) return `Hold ${formatClock(section.holdLeftMs)}`
  return `${upCount(state, state.section)}/${SECTION_CELLS} up`
}

/** Blocks up on the wall with at least one nail past its red line. */
export function saggingCount(state: GameState): number {
  let count = 0
  for (const block of state.blocks.values()) {
    if (!isUp(block)) continue
    if (
      block.fixings.some(
        f => blockNailLevelFor(block, f.grip, state.phase === 'final') === 'red'
      )
    )
      count++
  }
  return count
}

/**
 * A paper wipe between rooms. The sheet slides in from the right, the scene switches
 * once it covers the view, and it slides off to the left. Trips to and from the shop
 * hold the sheet with a caption, since the shop is out the front door.
 */
export interface Wipe<T extends string = RoomId> {
  from: string
  to: T
  elapsedMs: number
  durationMs: number
  /** Time to cover the view, and time to uncover it at the end. */
  slideMs: number
  /** Caption shown while the sheet covers the view, or null. */
  label: string | null
  switched: boolean
}

export function startWipe(from: SceneId, to: RoomId): Wipe<RoomId> {
  const shopTrip = from === 'shop' || to === 'shop'
  return {
    from,
    to,
    elapsedMs: 0,
    durationMs: shopTrip ? SHOP_WALK_MS : WIPE_MS,
    slideMs: shopTrip ? WIPE_MS : WIPE_MS / 2,
    label:
      to === 'shop'
        ? 'Walking to the shop…'
        : from === 'shop'
          ? 'Walking back…'
          : null,
    switched: false
  }
}

/** A quick wipe inside a room, such as from the kitchen overview to the stove. */
export function startViewWipe<T extends string>(from: string, to: T): Wipe<T> {
  return {
    from,
    to,
    elapsedMs: 0,
    durationMs: WIPE_MS,
    slideMs: WIPE_MS / 2,
    label: null,
    switched: false
  }
}

/** What one step of a wipe asks the game to do. */
export interface WipeStep {
  /** Switch scenes now: the sheet just covered the view. True once per wipe. */
  switchNow: boolean
  done: boolean
}

/** Absorbs rounding in 16.67 ms steps, so 72 steps make exactly 1200 ms. */
const EPSILON_MS = 1e-6

export function stepWipe(wipe: Wipe<string>, dtMs: number): WipeStep {
  let t = wipe.elapsedMs + dtMs
  if (t > wipe.durationMs - EPSILON_MS) t = wipe.durationMs
  wipe.elapsedMs = t
  const switchNow = !wipe.switched && t >= wipe.slideMs - EPSILON_MS
  if (switchNow) wipe.switched = true
  return { switchNow, done: t >= wipe.durationMs }
}

/**
 * Where the sheet is, from 0 (off to the right) through 1 (covering the view) to 2 (off
 * to the left).
 */
export function wipePosition(wipe: Wipe<string>): number {
  const t = wipe.elapsedMs
  if (t < wipe.slideMs) return easeInOut(t / wipe.slideMs)
  const uncoverFrom = wipe.durationMs - wipe.slideMs
  if (t < uncoverFrom) return 1
  return 1 + easeInOut((t - uncoverFrom) / wipe.slideMs)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}
