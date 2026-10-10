import {
  nailLevel,
  warningLines,
  type NailLevel,
  type WarningLines
} from './grip'
import { toughness } from './quality'
import { FINAL, SECTION_IMPULSE_POOLS } from './tuning'
import type { BlockState } from './types'

/**
 * Orange and red lines for a block's nails, from its section's event pool. In the final
 * test every block faces the same scripted slam and fly, so `final` uses that pool.
 */
export function blockWarningLines(
  block: BlockState,
  final = false
): WarningLines {
  const pool = final
    ? FINAL.pool
    : (SECTION_IMPULSE_POOLS[block.section] ?? SECTION_IMPULSE_POOLS[0]!)
  return warningLines(
    pool,
    block.fixings.length,
    toughness(block.q, block.mesh, block.noodles)
  )
}

/** How worried a nail at `grip` on this block should look. */
export function blockNailLevelFor(
  block: BlockState,
  grip: number,
  final = false
): NailLevel {
  return nailLevel(grip, blockWarningLines(block, final))
}
