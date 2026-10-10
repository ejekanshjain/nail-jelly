import { hash01 } from '../shared'
import type { BlockState, KitchenView, LossCause, SceneId } from './types'

/** Replay label for a lost block: how long it held, or why it never did. */
export function heldForLabel(block: BlockState): string {
  if (block.cause === 'split') return 'Held for 0.0s. SPLORCH.'
  if (block.cause === 'carry') return "Didn't even reach the wall."
  if (block.firstBiteMs === null || block.lostMs === null)
    return 'Never touched the wall.'
  return `Held for ${formatHeld(block.lostMs - block.firstBiteMs)}`
}

/** "9.1s" under a minute, "6 min 52s" from a minute on. */
export function formatHeld(ms: number): string {
  const seconds = Math.max(0, ms) / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.floor(seconds - minutes * 60)}s`
}

/** At least 5 blame lines per cause. Each names what actually went wrong. */
export const BLAME: Record<LossCause, readonly string[]> = {
  sag: [
    'Gravity wins again.',
    'It slid off one wobble at a time.',
    'That nail needed a second hit.',
    'Sagged, slumped, splatted.',
    'Jelly gives up slowly, then all at once.'
  ],
  torn: [
    'Hammered the corner clean off.',
    'Too many hits in one spot. It tore.',
    'The nail kept a souvenir. The rest left.',
    'Jelly tears. Now you know.',
    'Nail nearer the middle, not the very edge.'
  ],
  split: [
    'Too hard. Way too hard.',
    'You hit it like it owed you money.',
    'Jelly is not a nail-friendly material.',
    'Gentler. It is jelly.',
    'That was a hammer, not a feeling.'
  ],
  hand: [
    'Your arm gave up before the nail went in.',
    'Nail it before your arm quits.',
    'The hand let go. The jelly did not hang on.',
    'Holding jelly is not a long-term plan.',
    'Hammer first, admire later.'
  ],
  carry: [
    'Tilted the tray. Lost the jelly.',
    'The hallway wins this round.',
    'Level tray, happy jelly.',
    'It slid right off the edge.',
    'Walk smoother. The jelly noticed.'
  ],
  knock: [
    'Its neighbour took it down too.',
    'One falls, two fall.',
    'Knocked off by a falling friend.',
    'Never hang jelly under sagging jelly.',
    'The block above sent its regards.'
  ],
  slam: [
    'The neighbour slammed the door.',
    'KEEP IT DOWN, said the door.',
    'One slam was all it took.',
    'That nail was already sagging.',
    'Doors: 1. Jelly: 0.'
  ],
  truck: [
    'A truck drove past.',
    'Wobble Freight delivered a wobble.',
    'The whole street shook it loose.',
    'Rumble, rumble, splat.',
    'That nail was already orange.'
  ],
  fly: [
    'The fly chewed through it.',
    'Swat the fly next time.',
    'Extra protein, less jelly.',
    'It tore where the fly sat.',
    'Bzz. Splat.'
  ],
  cat: [
    'The cat jumped at it.',
    'Shoo the cat while it wiggles.',
    'The cat regrets nothing.',
    'Meow means trouble.',
    'Cat 1, jelly 0.'
  ],
  'one-nail': [
    'One nail. One.',
    'It spun round its only nail.',
    'A single nail is a hinge.',
    'Two nails. Always two.',
    'It turned, it tore, it fell.'
  ],
  swat: [
    'Got the fly. Lost the block.',
    'The swat finished off a red nail.',
    'You hit the fly and the jelly.',
    'Re-nail first, swat second.',
    'The fly took one with it.'
  ]
}

/** A sag this long after the last nail names it, and where you were instead. */
const NEGLECT_MS = 60_000

/** Where you were when a block fell, for its blame line. Null when you were watching. */
export function whereYouWere(scene: SceneId, view: KitchenView): string | null {
  if (scene === 'kitchen')
    return {
      overview: 'You were in the kitchen.',
      stove: 'You were boiling gelatin.',
      bowl: 'You were stirring.',
      moulds: 'You were pouring.',
      sink: 'You were washing up.'
    }[view]
  if (scene === 'hallway') return 'You were in the hallway.'
  if (scene === 'shop') return 'You were at the shop.'
  return null
}

/**
 * A blame line for a lost block. Stable per block, so a replay doesn't flicker. A block
 * that sagged off long after its last nail names that, and `where` you were instead.
 */
export function blameLine(
  block: BlockState,
  where: string | null = null
): string {
  const cause = block.cause ?? 'sag'
  // Old jelly under a sagging block is the real culprit.
  if (cause === 'sag' && block.residue > 0)
    return "Slid on old jelly you didn't scrape."
  const since = (block.lostMs ?? block.lastNailMs) - block.lastNailMs
  if (cause === 'sag' && where && since >= NEGLECT_MS)
    return `Last re-nailed ${Math.floor(since / 60_000)} min ago. ${where}`
  const lines = BLAME[cause]
  return lines[Math.floor(hash01(block.id, 77) * lines.length)] ?? lines[0]!
}
