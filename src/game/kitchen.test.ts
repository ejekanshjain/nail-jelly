import { describe, expect, it } from 'vitest'

import {
  burnMix,
  canRetry,
  retryBurnt,
  retryCost,
  checkRecycledBatch,
  startRecycledBatch,
  canPour,
  checkFreshBatch,
  finishBoil,
  finishStir,
  fridgeAction,
  gelatinFor,
  isSetting,
  nextFlavour,
  pourTray,
  putInFridge,
  startFreshBatch,
  stirScore,
  takeTray,
  unloadTray
} from './kitchen'
import { blockQuality, qualityLabel } from './quality'
import { createEconomy, createGameState } from './state'
import { MIX_POURABLE_MS, START_GELATIN, STOOL_MAX, FRIDGE_MS } from './tuning'

function setup() {
  const state = createGameState()
  const { stock } = createEconomy()
  return { state, stock }
}

/** Runs a batch through boil, stir and pour with average scores. */
function pourBatch(state: ReturnType<typeof setup>['state']) {
  finishBoil(state.mix!, 0.75)
  finishStir(state, 0.8, state.simMs)
  return pourTray(state, [0.8, 0.8, 0.8, 0.8])
}

describe('fresh batches', () => {
  it('use 2 gelatin for 4 moulds and cycle flavours', () => {
    const { state, stock } = setup()
    expect(gelatinFor()).toBe(2)
    expect(gelatinFor({ moulds: 6, recipe: true })).toBe(5)
    expect(startFreshBatch(state, stock)).toEqual({ ok: true })
    expect(stock.count('gelatin')).toBe(START_GELATIN - 2)
    expect(state.mix?.flavour).toBe('lime')
    expect(checkFreshBatch(state, stock)).toEqual({
      ok: false,
      reason: 'busy'
    })
    state.mix = null
    startFreshBatch(state, stock)
    expect(state.batches).toBe(2)
    expect(nextFlavour(state)).toBe('orange')
    state.mix = null
    expect(startFreshBatch(state, stock)).toEqual({
      ok: false,
      reason: 'gelatin'
    })
  })

  it('wait for Try Again after a burn, which pays for a fresh lot', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    state.mix!.boil = 0.4
    expect(burnMix(state, stock)).toBe(true)
    expect(state.mix).toMatchObject({ stage: 'boil', boil: 0, burnt: true })
    // Nothing is paid until you ask, and a burnt batch can't burn twice.
    expect(stock.count('gelatin')).toBe(2)
    expect(burnMix(state, stock)).toBe(false)
    expect(retryBurnt(state, stock)).toBe(true)
    expect(state.mix?.burnt).toBe(false)
    expect(stock.count('gelatin')).toBe(0)
    expect(retryBurnt(state, stock)).toBe(false)
  })

  it('throw the batch out after a burn with too little for another lot', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    stock.use('gelatin', 1)
    expect(canRetry(state, stock)).toBe(false)
    expect(burnMix(state, stock)).toBe(false)
    expect(state.mix).toBeNull()
    expect(stock.count('gelatin')).toBe(1)
  })
})

describe('the tray and the fridge', () => {
  it('allow no pour while the tray is out', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    expect(pourBatch(state)).toBe(true)
    expect(state.tray?.moulds).toHaveLength(4)
    expect(state.tray?.moulds[0]?.q).toBeCloseTo(0.83, 2)
    expect(putInFridge(state, 1_000)).toBe(true)

    startFreshBatch(state, stock)
    finishBoil(state.mix!, 0.75)
    finishStir(state, 0.8, state.simMs)
    expect(canPour(state)).toBe(false)
    expect(pourTray(state, [0.8])).toBe(false)
  })

  it('let you boil and stir during the fridge minute', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    pourBatch(state)
    putInFridge(state, 0)
    expect(startFreshBatch(state, stock).ok).toBe(true)
    finishBoil(state.mix!, 0.7)
    finishStir(state, 0.9, state.simMs)
    expect(state.mix?.stage).toBe('stirred')
    expect(fridgeAction(state, FRIDGE_MS / 2)).toBe('setting')
  })

  it('set for a real-time minute, then hand you the tray', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    pourBatch(state)
    expect(fridgeAction(state, 0)).toBe('put-in')
    putInFridge(state, 10_000)
    const endsAt = state.fridge!.endsAt
    expect(endsAt - 10_000).toBe(state.fridge!.durationMs)
    expect(takeTray(state, endsAt - 1)).toBe(false)
    expect(takeTray(state, endsAt)).toBe(true)
    expect(state.tray?.location).toBe('hand')
    expect(state.fridge).toBeNull()
  })

  it('unloads onto the stool only as far as it has room', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    pourBatch(state)
    state.tray!.location = 'hand'
    state.stool = Array.from({ length: STOOL_MAX - 3 }, (_, i) => 900 + i)
    expect(unloadTray(state)).toBe(3)
    expect(state.tray?.moulds).toHaveLength(1)
    state.stool = []
    expect(unloadTray(state)).toBe(1)
    expect(state.tray).toBeNull()
  })
})

describe('a stirred mix', () => {
  it('waits for the tray, then sets in the bowl after 120s', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    finishBoil(state.mix!, 0.75)
    finishStir(state, 0.8, 5_000)
    const mix = state.mix!
    const pourable = 5_000 + MIX_POURABLE_MS
    expect(isSetting(mix, pourable - 1)).toBe(false)
    expect(stirScore(mix, pourable - 1)).toBe(0.8)
    expect(isSetting(mix, pourable)).toBe(true)
    expect(stirScore(mix, pourable + 29_999)).toBe(0.8)
    expect(stirScore(mix, pourable + 30_000)).toBeCloseTo(0.7)
    expect(stirScore(mix, pourable + 90_000)).toBeCloseTo(0.5)
    expect(stirScore(mix, pourable + 900_000)).toBe(0)
  })

  it('pours blocks that remember their scores, setting included', () => {
    const { state, stock } = setup()
    startFreshBatch(state, stock)
    finishBoil(state.mix!, 0.75)
    finishStir(state, 0.8, 0)
    state.simMs = MIX_POURABLE_MS + 60_000
    pourTray(state, [0.8, 0.4])
    const [first, second] = state.tray!.moulds
    expect(first!.make).toMatchObject({ boil: 0.75, stir: 0.8, pour: 0.8 })
    expect(first!.make.set).toBeCloseTo(0.2)
    expect(first!.q).toBeCloseTo(blockQuality({ ...first!.make }))
    expect(second!.q).toBeLessThan(first!.q)
    state.tray!.location = 'hand'
    unloadTray(state)
    const block = state.blocks.get(state.stool[0]!)!
    expect(block.make).toEqual(first!.make)
    expect(block.q).toBe(first!.q)
  })
})

describe('recycled batches', () => {
  it('use a tub per mould and make weaker grey-brown jelly', () => {
    const { state, stock } = setup()
    expect(checkRecycledBatch(state)).toEqual({ ok: false, reason: 'tubs' })
    state.tubs = 5
    const flavour = nextFlavour(state)
    expect(startRecycledBatch(state)).toEqual({ ok: true })
    expect(state.tubs).toBe(1)
    expect(state.mix).toMatchObject({ flavour: 'recycled', recycled: true })
    expect(nextFlavour(state)).toBe(flavour)
    expect(stock.count('gelatin')).toBe(START_GELATIN)
    pourBatch(state)
    const mould = state.tray!.moulds[0]!
    expect(mould.q).toBeCloseTo(0.83 * 0.7, 2)
    expect(qualityLabel(mould.q, mould.make)).toBe('Wobbly: contains floor')
  })

  it('pay their tubs again to try after a burn, or lose the batch', () => {
    const { state, stock } = setup()
    state.tubs = 8
    startRecycledBatch(state)
    expect(burnMix(state, stock)).toBe(true)
    expect(retryCost(state.mix!)).toEqual({ amount: 4, unit: 'tubs' })
    expect(retryBurnt(state, stock)).toBe(true)
    expect(state.tubs).toBe(0)
    expect(stock.count('gelatin')).toBe(START_GELATIN)
    expect(burnMix(state, stock)).toBe(false)
    expect(state.mix).toBeNull()
  })
})
