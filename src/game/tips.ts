import { blockNailLevelFor } from './warnings'
import { allLocked, isUp } from './section'
import type { FixingKind, GameState } from './types'

/**
 * The one most useful hint for the wall right now. `uncut` says a block on the stool
 * still needs its mesh sheet cut. `floorShown` says the camera shows the floor, where
 * fallen jelly lies.
 */
export function wallTip(
  state: GameState,
  handBusy: boolean,
  tool: FixingKind = 'nail',
  uncut = false,
  floorShown = true
): string {
  if (state.phase === 'cold-open') return 'Your uncle has something to say.'
  if (allLocked(state)) return 'Every section is locked. Your uncle is next.'
  if (handBusy)
    return tool === 'screw'
      ? 'Tap the jelly, then circle the screw 4 times. Slowly.'
      : 'Press on the jelly, hold, and let go in the green.'
  const section = state.sections[state.section]
  let single: FixingKind | null = null
  let red = false
  for (const cell of section?.cells ?? []) {
    const block = cell.block === null ? undefined : state.blocks.get(cell.block)
    if (!block || !isUp(block)) continue
    if (block.fixings.length === 1) single = block.fixings[0]!.kind
    for (const f of block.fixings)
      if (blockNailLevelFor(block, f.grip, state.phase === 'final') === 'red')
        red = true
  }
  if (red) return 'A nail is blinking red. Hammer it back in.'
  if (single)
    return `One ${single} lets it swing. Add a second near the other top corner.`
  if (section?.holdActive) return 'Keep all 12 up until the countdown ends.'
  if (uncut) return 'Tap a block on the stool to cut its mesh sheet first.'
  if (state.stool.length > 0)
    return 'Drag a block from the stool onto the wall.'
  if (state.splats.some(s => s.room === 'wall'))
    return floorShown
      ? 'Jelly on the floor. Rub it to scrape it up, then mop.'
      : 'Press Whole Wall to see the floor, then rub the splats.'
  return state.tray?.location === 'fridge' || state.tray?.location === 'hand'
    ? 'The stool is empty. Your next tray is in the kitchen.'
    : 'The stool is empty. Make more jelly in the kitchen.'
}
