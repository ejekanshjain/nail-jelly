import type { Wallet } from '../shared'
import type { WallSim } from './sim/wallSim'
import {
  BLOCK_PAY,
  FINAL,
  GRADES,
  HOLD_MS,
  LOCK_BONUS_BASE,
  LOCK_BONUS_STEP,
  PAY_HELD_MS,
  SECTION_CELLS,
  SECTION_COUNT
} from './tuning'
import type { BlockState, GameState, Grade } from './types'

/** Things the section flow did this step, for sounds and captions. */
export type SectionEvent =
  | { type: 'hold-start'; section: number }
  | { type: 'hold-reset'; section: number }
  | { type: 'pay'; blockId: number; coins: number }
  | { type: 'lock'; section: number; grade: Grade; bonus: number }
  | { type: 'all-locked' }

/** True for a block that is up and not already doomed. */
export function isUp(block: BlockState | undefined): boolean {
  return (
    block !== undefined &&
    block.status === 'up' &&
    block.cause === null &&
    block.fixings.length > 0
  )
}

/** Blocks up in a section's cells. */
export function upCount(state: GameState, section: number): number {
  const cells = state.sections[section]?.cells ?? []
  let up = 0
  for (const cell of cells)
    if (cell.block !== null && isUp(state.blocks.get(cell.block))) up++
  return up
}

/** Grade from the weakest grip at lock. */
export function gradeFor(weakestGrip: number): Grade {
  for (const [grade, from] of GRADES) if (weakestGrip >= from) return grade
  return 'D'
}

/** Coins for locking section `index` (0-based): 15, 20, 25, 30, 35. */
export function lockBonus(index: number): number {
  return LOCK_BONUS_BASE + LOCK_BONUS_STEP * (index + 1)
}

/**
 * Runs the active section's hold countdown and block payouts. The countdown starts with
 * 12 blocks up and no block in the hand, resets on any drop below 12, and locks at zero.
 */
export function updateSection(
  state: GameState,
  wall: WallSim,
  wallet: Wallet,
  dtMs: number
): SectionEvent[] {
  const events: SectionEvent[] = []
  for (const block of state.blocks.values()) {
    if (block.paid || !isUp(block) || block.firstBiteMs === null) continue
    if (state.simMs - block.firstBiteMs < PAY_HELD_MS) continue
    block.paid = true
    wallet.earn(BLOCK_PAY, 'Block held for 60 seconds')
    events.push({ type: 'pay', blockId: block.id, coins: BLOCK_PAY })
  }

  const section = state.sections[state.section]
  if (!section || section.locked) return events
  const ready =
    upCount(state, section.index) === SECTION_CELLS && wall.handBlock === null
  if (ready && !section.holdActive) {
    section.holdActive = true
    section.holdLeftMs = HOLD_MS
    events.push({ type: 'hold-start', section: section.index })
  } else if (!ready && section.holdActive) {
    section.holdActive = false
    section.holdLeftMs = HOLD_MS
    events.push({ type: 'hold-reset', section: section.index })
  } else if (section.holdActive) {
    section.holdLeftMs -= dtMs
    if (section.holdLeftMs <= 0)
      events.push(...lockSection(state, wall, wallet))
  }
  return events
}

/** Locks the active section now: snapshot, grade, bonus, and the next section becomes active. */
export function lockSection(
  state: GameState,
  wall: WallSim,
  wallet: Wallet
): SectionEvent[] {
  const section = state.sections[state.section]
  if (!section || section.locked) return []
  const snapshot = wall.lockSection(section.index)
  let weakest = 1
  for (const block of snapshot)
    for (const fixing of block.fixings) weakest = Math.min(weakest, fixing.grip)
  section.snapshot = snapshot
  section.locked = true
  section.holdActive = false
  section.holdLeftMs = 0
  section.weakestGrip = weakest
  section.grade = gradeFor(weakest)
  // Locking again after a failed final test pays the smaller re-lock bonus.
  const bonus = section.lockedOnce
    ? FINAL.relockBonus
    : lockBonus(section.index)
  section.lockedOnce = true
  wallet.earn(bonus, `Section ${section.index + 1} locked`)
  const events: SectionEvent[] = [
    { type: 'lock', section: section.index, grade: section.grade, bonus }
  ]
  const next = state.sections.findIndex(s => !s.locked)
  if (next >= 0) state.section = next
  else events.push({ type: 'all-locked' })
  return events
}

/** True once every section is locked. */
export function allLocked(state: GameState): boolean {
  return (
    state.sections.length === SECTION_COUNT &&
    state.sections.every(s => s.locked)
  )
}
