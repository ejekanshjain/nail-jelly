import { describe, expect, it } from 'vitest'

import { finishBoil, finishStir, startFreshBatch } from '../game/kitchen'
import { createEconomy, createGameState } from '../game/state'
import { kitchenTip, nextSpot } from './kitchenScene'

function setup() {
  const state = createGameState()
  const { stock } = createEconomy()
  return { state, stock }
}

describe('the kitchen hint', () => {
  it('sends you to the sink before a boil fills a dirty bowl', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    expect(nextSpot(state, 0)).toBe('stove')
    state.bowls = [0.4]
    expect(nextSpot(state, 0)).toBe('sink')
    expect(kitchenTip(state, 0)).toMatch(/^Wash the bowl/)
  })

  it('leaves the sink alone while the bowl holds the mix', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    finishBoil(state.mix!, 0.75)
    state.bowls = [0]
    expect(nextSpot(state, 0)).toBe('bowl')
    finishStir(state, 0.8, 0)
    expect(nextSpot(state, 0)).toBe('moulds')
    state.mix = null
    expect(nextSpot(state, 0)).toBe('sink')
  })
})
