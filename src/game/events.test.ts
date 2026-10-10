import { describe, expect, it } from 'vitest'

import { Director, type DirectorInput, type EventKind } from './events'
import { DIRECTOR, EVENT_POOLS } from './tuning'

const STEP = 100

/** A long-running section with `up` blocks up and nothing else going on. */
function input(overrides: Partial<DirectorInput> = {}): DirectorInput {
  return {
    simMs: 0,
    section: 1,
    upCount: 6,
    holdActive: false,
    away: false,
    busy: false,
    lastFallMs: -Infinity,
    available: ['slam', 'truck'],
    ...overrides
  }
}

/** Steps the director for `ms`, returning each event and when it started. */
function run(
  director: Director,
  fromMs: number,
  ms: number,
  overrides: Partial<DirectorInput> | ((at: number) => Partial<DirectorInput>)
): { at: number; kind: EventKind }[] {
  const events: { at: number; kind: EventKind }[] = []
  for (let at = fromMs; at < fromMs + ms; at += STEP) {
    const extra = typeof overrides === 'function' ? overrides(at) : overrides
    const kind = director.step(input({ simMs: at, ...extra }))
    if (kind) events.push({ at, kind })
  }
  return events
}

describe('the event director', () => {
  it('leaves section 1 alone apart from the gentle slam 40s into its hold', () => {
    const director = new Director(1)
    expect(run(director, 0, 600_000, { section: 0, upCount: 11 })).toEqual([])
    const hold = run(director, 600_000, 60_000, {
      section: 0,
      upCount: 12,
      holdActive: true
    })
    expect(hold).toEqual([
      { at: 600_000 + DIRECTOR.gentleSlamAtMs, kind: 'gentle-slam' }
    ])
  })

  it('starts the clock at the 4th block, then keeps to the section gaps', () => {
    const director = new Director(2)
    const pool = EVENT_POOLS[1]!
    expect(run(director, 0, 60_000, { upCount: 3 })).toEqual([])
    const events = run(director, 60_000, 1_200_000, { upCount: 4 })
    expect(events[0]!.at).toBe(60_000 + pool.firstMs)
    for (let i = 1; i < events.length; i++) {
      const gap = events[i]!.at - events[i - 1]!.at
      expect(gap).toBeGreaterThanOrEqual(pool.gapMinMs)
      expect(gap).toBeLessThanOrEqual(pool.gapMaxMs + STEP)
    }
    expect(events.length).toBeGreaterThanOrEqual(5)
  })

  it('runs the random-event clock at the pace it is given', () => {
    const pool = EVENT_POOLS[1]!
    const director = new Director(2)
    const events = run(director, 0, 3 * pool.firstMs, { pace: 0.5 })
    expect(events[0]!.at).toBe(2 * pool.firstMs)
  })

  it('shows mercy after a fall and with fewer than 3 blocks up', () => {
    const director = new Director(3)
    run(director, 0, STEP, { upCount: 4 })
    const due = director.nextMs!
    const fell = due - 10_000
    const events = run(director, due, DIRECTOR.mercyMs + 30_000, at => ({
      lastFallMs: fell,
      upCount: at < due + 40_000 ? 2 : 5
    }))
    expect(events[0]!.at).toBeGreaterThanOrEqual(
      Math.max(fell + DIRECTOR.mercyMs, due + 40_000)
    )
  })

  it('strikes once in every hold from section 2, and nothing else meanwhile', () => {
    for (const seed of [4, 5, 6]) {
      const director = new Director(seed)
      run(director, 0, STEP, { upCount: 12 })
      const events = run(director, 1000, 200_000, at => ({
        upCount: 12,
        holdActive: at < 61_000
      }))
      const inHold = events.filter(e => e.at < 61_000)
      expect(inHold).toHaveLength(1)
      expect(inHold[0]!.at - 1000).toBeGreaterThanOrEqual(DIRECTOR.holdFromMs)
      expect(inHold[0]!.at - 1000).toBeLessThanOrEqual(DIRECTOR.holdToMs)
    }
  })

  it('strikes in every hold while you are away too, with a slam or a truck', () => {
    const kinds = new Set<EventKind>()
    for (let seed = 0; seed < 30; seed++) {
      const director = new Director(seed)
      run(director, 0, STEP, { section: 4, upCount: 12 })
      const events = run(director, 1000, 60_000, {
        section: 4,
        upCount: 12,
        holdActive: true,
        away: true,
        available: ['slam', 'truck', 'fly', 'cat']
      })
      expect(events).toHaveLength(1)
      kinds.add(events[0]!.kind)
    }
    expect([...kinds].sort()).toEqual(['slam', 'truck'])
  })

  it('waits while you carry or shop, then strikes when you are back', () => {
    const director = new Director(7)
    run(director, 0, STEP, { upCount: 6 })
    const due = director.nextMs!
    const back = due + 30_000
    const events = run(director, due, 60_000, at => ({ away: at < back }))
    expect(events[0]!.at).toBe(back)
  })

  it('only picks events that exist, and the door slam without a choice', () => {
    const kinds = new Set<EventKind>()
    for (let seed = 0; seed < 30; seed++) {
      const director = new Director(seed)
      run(director, 0, STEP, { section: 2, upCount: 6 })
      for (const e of run(director, 0, 2_000_000, { section: 2 }))
        kinds.add(e.kind)
    }
    expect([...kinds].sort()).toEqual(['slam', 'truck'])
    const director = new Director(9)
    run(director, 0, STEP, { upCount: 6, available: [] })
    const events = run(director, 0, 400_000, { available: [] })
    expect(events.every(e => e.kind === 'slam')).toBe(true)
  })

  it('sends flies from section 2 and the cat only from section 4', () => {
    const all = ['slam', 'truck', 'fly', 'cat'] as const
    const kindsIn = (section: number) => {
      const kinds = new Set<EventKind>()
      for (let seed = 0; seed < 30; seed++) {
        const director = new Director(seed)
        run(director, 0, STEP, { section, upCount: 6, available: all })
        for (const e of run(director, 0, 2_000_000, {
          section,
          available: all
        }))
          kinds.add(e.kind)
      }
      return [...kinds].sort()
    }
    expect(kindsIn(1)).toEqual(['fly', 'slam'])
    expect(kindsIn(3)).toEqual(['cat', 'fly', 'heat', 'slam', 'truck'])
  })

  it('brings one heat wave 1 to 3 minutes into sections 4 and 5 only', () => {
    for (const section of [1, 2])
      expect(
        run(new Director(1), 0, 900_000, { section, upCount: 6 }).some(
          e => e.kind === 'heat'
        )
      ).toBe(false)
    for (let seed = 0; seed < 10; seed++)
      for (const section of [3, 4]) {
        const heat = run(new Director(seed), 0, 1_800_000, {
          section,
          upCount: 6,
          busy: true
        }).filter(e => e.kind === 'heat')
        expect(heat).toHaveLength(1)
        expect(heat[0]!.at).toBeGreaterThanOrEqual(DIRECTOR.heatFromMs)
        expect(heat[0]!.at).toBeLessThanOrEqual(DIRECTOR.heatToMs + STEP)
      }
  })

  it('holds the heat wave while you are away or a hold runs', () => {
    const director = new Director(3)
    run(director, 0, STEP, { section: 3, upCount: 6 })
    const due = director.heatMs!
    const back = due + 70_000
    const events = run(director, due, 120_000, at => ({
      section: 3,
      away: at < due + 30_000,
      holdActive: at >= due + 30_000 && at < back,
      upCount: 12
    }))
    const heat = events.find(e => e.kind === 'heat')
    expect(heat?.at).toBe(back)
  })
})
