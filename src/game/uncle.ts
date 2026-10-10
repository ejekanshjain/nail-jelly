import { hash01 } from '../shared'
import { UNCLE } from './tuning'

/**
 * What his face shows. The first four are base moods, which follow the sections you
 * lock; the rest are short reactions over them.
 */
export type UncleFace =
  | 'smug'
  | 'eyebrow'
  | 'worried'
  | 'sweating'
  | 'smirk'
  | 'laugh'
  | 'twitch'
  | 'flat'

export type UncleReaction = 'smirk' | 'laugh' | 'twitch' | 'flat'

/** The uncle's portrait: his latest reaction, the sweet-hit streak and his bubble. */
export interface UncleState {
  reaction: UncleReaction | null
  reactionAtMs: number
  /** Sweet hits in a row; any other hit resets it. */
  sweetStreak: number
  /** His latest line: a heckle at a fall or a taunt at a milestone. */
  bubble: { text: string; atMs: number } | null
}

const REACTION_MS: Record<UncleReaction, number> = {
  smirk: UNCLE.smirkMs,
  laugh: UNCLE.laughMs,
  twitch: UNCLE.twitchMs,
  flat: UNCLE.flatMs
}

/** Which reaction wins while another one still shows. */
const PRIORITY: Record<UncleReaction, number> = {
  twitch: 0,
  smirk: 1,
  flat: 2,
  laugh: 3
}

const HECKLES = ['Heh.', 'Heh heh.', 'Told you.', 'My car stays.', 'Ha!']

/** His milestone lines. */
export const TAUNTS = {
  burnt: 'Smells like my car is safe.',
  bareWall: (n: number) =>
    n === 1 ? 'Nice nail. Wrong wall.' : `${n} nails. Zero jelly.`,
  lost: (n: number) => `${n} down. I'm counting.`
} as const

export function createUncle(): UncleState {
  return {
    reaction: null,
    reactionAtMs: -Infinity,
    sweetStreak: 0,
    bubble: null
  }
}

/** His mood between reactions: smug, then a raised eyebrow, worried, and sweating. */
export function baseFace(locks: number): UncleFace {
  if (locks >= 4) return 'sweating'
  if (locks >= 3) return 'worried'
  if (locks >= 1) return 'eyebrow'
  return 'smug'
}

/**
 * His face in the deckchair as the test clock runs down, from the fraction left: smug,
 * then an eyebrow, worried for the last quarter, and sweating for the last tenth.
 */
export function testFace(left: number): UncleFace {
  if (left > 0.5) return 'smug'
  if (left > 0.25) return 'eyebrow'
  if (left > 0.1) return 'worried'
  return 'sweating'
}

/** The face to draw now: a reaction while it lasts, otherwise his base mood. */
export function uncleFace(
  uncle: UncleState,
  locks: number,
  nowMs: number
): UncleFace {
  const reaction = uncle.reaction
  if (reaction && nowMs - uncle.reactionAtMs < REACTION_MS[reaction])
    return reaction
  return baseFace(locks)
}

/** Starts a reaction, unless a stronger one is still showing. */
export function react(
  uncle: UncleState,
  reaction: UncleReaction,
  nowMs: number
): void {
  const current = uncle.reaction
  const showing =
    current !== null && nowMs - uncle.reactionAtMs < REACTION_MS[current]
  if (showing && PRIORITY[current] > PRIORITY[reaction]) return
  uncle.reaction = reaction
  uncle.reactionAtMs = nowMs
}

/**
 * Counts a hammer hit. Every `UNCLE.streak` sweet hits in a row make his eyebrow
 * twitch; any other outcome resets the count. Returns whether it twitched.
 */
export function countHit(
  uncle: UncleState,
  sweet: boolean,
  nowMs: number
): boolean {
  if (!sweet) {
    uncle.sweetStreak = 0
    return false
  }
  uncle.sweetStreak++
  if (uncle.sweetStreak % UNCLE.streak !== 0) return false
  react(uncle, 'twitch', nowMs)
  return true
}

/** Puts a line in his speech bubble. */
export function say(uncle: UncleState, text: string, nowMs: number): void {
  uncle.bubble = { text, atMs: nowMs }
}

/** A heckle for a fall, picked by the time it happened. */
export function heckleLine(nowMs: number): string {
  return HECKLES[Math.floor(hash01(Math.floor(nowMs), 5) * HECKLES.length)]!
}

/** His bubble and how long it has shown, or null once it is gone. */
export function bubbleAt(
  uncle: UncleState,
  nowMs: number
): { text: string; ageMs: number } | null {
  const bubble = uncle.bubble
  if (!bubble) return null
  const ageMs = nowMs - bubble.atMs
  if (ageMs < 0 || ageMs > UNCLE.bubbleMs) return null
  return { text: bubble.text, ageMs }
}

/** The taunt for reaching this many lost blocks, or null between milestones. */
export function lossTaunt(lost: number): string | null {
  return (UNCLE.tauntLosses as readonly number[]).includes(lost)
    ? TAUNTS.lost(lost)
    : null
}

/** The taunt for this many nails in the bare wall, or null between milestones. */
export function bareWallTaunt(nails: number): string | null {
  return (UNCLE.tauntBareWall as readonly number[]).includes(nails)
    ? TAUNTS.bareWall(nails)
    : null
}
