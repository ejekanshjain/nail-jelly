import { describe, expect, it } from 'vitest'

import { decayPerSecond, type DecayInputs } from './grip'
import { heatLevel, heatPhase, wallHeat, type HeatWave } from './heat'
import { HEAT } from './tuning'

const START = 10_000
const HOT_AT = START + HEAT.warnMs
const OVER_AT = HOT_AT + HEAT.durationMs

describe('the heat wave', () => {
  it('warns for 5s, stays hot for 90s, then ends', () => {
    const wave: HeatWave = { startMs: START, curtains: false }
    expect(heatPhase(wave, START)).toBe('coming')
    expect(heatPhase(wave, HOT_AT - 1)).toBe('coming')
    expect(heatPhase(wave, HOT_AT)).toBe('hot')
    expect(heatPhase(wave, OVER_AT - 1)).toBe('hot')
    expect(heatPhase(wave, OVER_AT)).toBe('over')
  })

  it('heats the wall only while hot, and less with the curtains shut', () => {
    const wave: HeatWave = { startMs: START, curtains: false }
    expect(wallHeat(null, HOT_AT)).toBe('none')
    expect(wallHeat(wave, START + 1000)).toBe('none')
    expect(wallHeat(wave, HOT_AT + 1000)).toBe('wave')
    wave.curtains = true
    expect(wallHeat(wave, HOT_AT + 1000)).toBe('curtains')
    expect(wallHeat(wave, OVER_AT)).toBe('none')
  })

  it('triples decay, or 1.8 times it with the curtains shut', () => {
    const inputs: DecayInputs = {
      q: 0.8,
      fixings: 2,
      residue: 0,
      heat: 'none',
      mesh: 0,
      screw: false,
      fly: false,
      holes: 2,
      integrity: 1,
      section: null
    }
    const cool = decayPerSecond(inputs)
    expect(decayPerSecond({ ...inputs, heat: 'wave' }) / cool).toBeCloseTo(3)
    expect(decayPerSecond({ ...inputs, heat: 'curtains' }) / cool).toBeCloseTo(
      1.8
    )
  })

  it('looks hotter over the warning, fades at the end, and halves behind curtains', () => {
    const wave: HeatWave = { startMs: START, curtains: false }
    expect(heatLevel(null, HOT_AT)).toBe(0)
    expect(heatLevel(wave, START + HEAT.warnMs / 2)).toBeCloseTo(0.5)
    expect(heatLevel(wave, HOT_AT + 20_000)).toBe(1)
    expect(heatLevel(wave, OVER_AT - 1500)).toBeCloseTo(0.5)
    wave.curtains = true
    expect(heatLevel(wave, HOT_AT + 20_000)).toBe(0.5)
  })
})
