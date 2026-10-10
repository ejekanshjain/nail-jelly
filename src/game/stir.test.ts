import { describe, expect, it } from 'vitest'

import { CircleGesture } from '../shared'
import { createStir, startStroke, stirCircle, type StirEvent } from './stir'
import { STIR } from './tuning'

const CALM = { assist: false, random: () => 0.9 }

/** Finishes `count` circles of radius 80, each taking `ms`. */
function circles(count: number, ms: number, options = CALM) {
  const stir = createStir()
  startStroke(stir, 0)
  const events: StirEvent[][] = []
  for (let i = 1; i <= count; i++)
    events.push(stirCircle(stir, 80, i * ms, options))
  return { stir, events }
}

describe('stirring', () => {
  it('sloshes circles quicker than 0.45s, or 0.35s in Assist', () => {
    expect(circles(1, 440).events[0]).toContain('slosh')
    expect(circles(1, 450).events[0]).not.toContain('slosh')
    expect(
      circles(1, 400, { assist: true, random: () => 0.9 }).events[0]
    ).not.toContain('slosh')
    expect(
      circles(1, 340, { assist: true, random: () => 0.9 }).events[0]
    ).toContain('slosh')
  })

  it('spills on one slosh in four', () => {
    const { stir } = circles(8, 300, { assist: false, random: () => 0.1 })
    expect(stir.sloshes).toBe(8)
    expect(stir.spills).toBe(8)
    expect(circles(8, 300).stir.spills).toBe(0)
  })

  it('fires beats at 25 and 45 and finishes at 50', () => {
    const { stir, events } = circles(60, 600)
    expect(events[STIR.halfway - 1]).toContain('halfway')
    expect(events[STIR.bend - 1]).toContain('bend')
    expect(events[STIR.circles - 1]).toContain('done')
    expect(events[STIR.circles]).toEqual([])
    expect(stir.circles).toBe(50)
    expect(stir.done).toBe(true)
  })

  it('clacks wide circles on the rim', () => {
    const stir = createStir()
    expect(stirCircle(stir, 160, 1000, CALM)).toContain('clack')
  })

  it('passes the gesture evenness through from drawn circles', () => {
    // Fifty steady circles of radius 80 at 0.6s each, sampled every 10 ms.
    const gesture = new CircleGesture({
      center: { x: 300, y: 400 },
      minRadius: 40
    })
    const stir = createStir()
    startStroke(stir, 0)
    for (let t = 0; !stir.done && t < 60_000; t += 10) {
      const a = (t / 600) * Math.PI * 2
      if (gesture.add(300 + Math.cos(a) * 80, 400 + Math.sin(a) * 80, t) > 0)
        stirCircle(stir, gesture.radius, t, CALM)
    }
    expect(stir.done).toBe(true)
    expect(stir.sloshes).toBe(0)
    expect(gesture.evenness).toBeGreaterThan(0.95)
  })
})
