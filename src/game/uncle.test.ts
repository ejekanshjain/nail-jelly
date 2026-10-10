import { describe, expect, it } from 'vitest'

import { UNCLE } from './tuning'
import {
  bareWallTaunt,
  baseFace,
  bubbleAt,
  countHit,
  createUncle,
  lossTaunt,
  react,
  say,
  uncleFace
} from './uncle'

describe('the uncle portrait', () => {
  it('loses his smugness as sections lock', () => {
    expect([0, 1, 2, 3, 4, 5].map(baseFace)).toEqual([
      'smug',
      'eyebrow',
      'eyebrow',
      'worried',
      'sweating',
      'sweating'
    ])
  })

  it('shows a reaction for its time, then goes back to his base mood', () => {
    const uncle = createUncle()
    react(uncle, 'smirk', 1000)
    expect(uncleFace(uncle, 3, 1000 + UNCLE.smirkMs - 1)).toBe('smirk')
    expect(uncleFace(uncle, 3, 1000 + UNCLE.smirkMs)).toBe('worried')
  })

  it('keeps laughing at a cascade when a smaller reaction comes in', () => {
    const uncle = createUncle()
    react(uncle, 'laugh', 0)
    react(uncle, 'smirk', 500)
    expect(uncleFace(uncle, 0, 600)).toBe('laugh')
    // Once the laugh is over, a new smirk shows.
    react(uncle, 'smirk', UNCLE.laughMs + 10)
    expect(uncleFace(uncle, 0, UNCLE.laughMs + 20)).toBe('smirk')
  })

  it('twitches after a streak of sweet hits, and any other hit resets it', () => {
    const uncle = createUncle()
    expect(countHit(uncle, true, 0)).toBe(false)
    expect(countHit(uncle, true, 10)).toBe(false)
    expect(countHit(uncle, false, 20)).toBe(false)
    const twitches = [30, 40, 50].map(t => countHit(uncle, true, t))
    expect(twitches).toEqual([false, false, true])
    expect(uncleFace(uncle, 0, 60)).toBe('twitch')
  })

  it('holds his bubble for a while, then drops it', () => {
    const uncle = createUncle()
    say(uncle, 'Heh.', 100)
    expect(bubbleAt(uncle, 100 + UNCLE.bubbleMs)).toEqual({
      text: 'Heh.',
      ageMs: UNCLE.bubbleMs
    })
    expect(bubbleAt(uncle, 101 + UNCLE.bubbleMs)).toBeNull()
  })

  it('taunts only at the milestones', () => {
    expect(lossTaunt(9)).toBeNull()
    expect(lossTaunt(10)).toBe("10 down. I'm counting.")
    expect(lossTaunt(11)).toBeNull()
    expect(bareWallTaunt(1)).toBe('Nice nail. Wrong wall.')
    expect(bareWallTaunt(2)).toBeNull()
    expect(bareWallTaunt(5)).toBe('5 nails. Zero jelly.')
  })
})
