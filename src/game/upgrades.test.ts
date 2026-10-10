import { describe, expect, it } from 'vitest'

import { decayPerSecond, type DecayInputs } from './grip'
import { extraTearOdds, toughness } from './quality'
import {
  burnMix,
  canPour,
  finishBoil,
  finishStir,
  gelatinFor,
  pourTray,
  retryBurnt,
  startFreshBatch,
  startRecycledBatch,
  unloadTray
} from './kitchen'
import {
  drainNoodles,
  drainResult,
  noodlesReady,
  startNoodles
} from './noodles'
import { createEconomy, createGameState } from './state'
import { MESH, MOULDS_BIG, NOODLES, Q_RECIPE } from './tuning'
import type { GameState } from './types'
import { batchOptions, UPGRADES, type UpgradeId } from './upgrades'

function setup(owned: UpgradeId[] = []) {
  const state = createGameState()
  const { stock } = createEconomy()
  stock.add('gelatin', 16)
  const options = batchOptions(id => owned.includes(id))
  return { state, stock, options }
}

/** Boils, stirs and pours the batch on the stove with average scores. */
function pour(state: GameState) {
  finishBoil(state.mix!, 0.75)
  finishStir(state, 0.8, state.simMs)
  pourTray(state, Array(state.mix!.moulds).fill(0.8))
  return state.tray!.moulds
}

describe('the Extra Gelatin Recipe', () => {
  it('costs 3 gelatin a batch and adds 0.08 quality', () => {
    const plain = setup()
    const recipe = setup(['recipe'])
    expect(gelatinFor(recipe.options)).toBe(3)
    startFreshBatch(plain.state, plain.stock, plain.options)
    startFreshBatch(recipe.state, recipe.stock, recipe.options)
    expect(recipe.stock.count('gelatin')).toBe(17)
    const [a] = pour(plain.state)
    const [b] = pour(recipe.state)
    expect(b!.q - a!.q).toBeCloseTo(Q_RECIPE)
    expect(b!.make.recipe).toBe(true)
  })

  it('pays the bigger recipe again after a burn, and skips recycled batches', () => {
    const { state, stock, options } = setup(['recipe'])
    startFreshBatch(state, stock, options)
    burnMix(state, stock)
    expect(retryBurnt(state, stock)).toBe(true)
    expect(stock.count('gelatin')).toBe(14)
    const recycled = setup(['recipe'])
    recycled.state.tubs = 4
    startRecycledBatch(recycled.state, recycled.options)
    expect(recycled.state.mix?.recipe).toBe(false)
  })
})

describe('the Bigger Fridge', () => {
  it('makes 6 moulds a batch, for 3 gelatin, or 5 with the recipe', () => {
    const fridge = setup(['fridge'])
    expect(fridge.options.moulds).toBe(MOULDS_BIG)
    expect(gelatinFor(fridge.options)).toBe(3)
    expect(gelatinFor(setup(['fridge', 'recipe']).options)).toBe(5)
    startFreshBatch(fridge.state, fridge.stock, fridge.options)
    expect(pour(fridge.state)).toHaveLength(MOULDS_BIG)
  })

  it('needs 6 tubs for a recycled batch', () => {
    const { state, options } = setup(['fridge'])
    state.tubs = 5
    expect(startRecycledBatch(state, options).ok).toBe(false)
    state.tubs = 6
    expect(startRecycledBatch(state, options).ok).toBe(true)
  })
})

describe('the upgrade shop', () => {
  it('sells the recipe and the fridge from the shared wallet', () => {
    const { wallet, upgrades } = createEconomy()
    expect(UPGRADES.map(u => u.id)).toEqual([
      'recipe',
      'screws',
      'fridge',
      'noodles',
      'mesh'
    ])
    expect(upgrades.check('recipe')).toEqual({ ok: false, reason: 'poor' })
    wallet.earn(90, 'Test')
    expect(upgrades.buy('recipe').ok).toBe(true)
    expect(upgrades.buy('fridge').ok).toBe(true)
    expect(wallet.coins()).toBe(15)
  })
})

describe('Noodle Reinforcement', () => {
  /** A noodle batch boiled and stirred, its noodles started at wall-clock time 0. */
  function stirred() {
    const { state, stock, options } = setup(['noodles'])
    startFreshBatch(state, stock, options)
    expect(state.mix?.noodles).toBe('raw')
    expect(startNoodles(state, 0)).toBe(true)
    finishBoil(state.mix!, 0.75)
    finishStir(state, 0.8, state.simMs)
    return state
  }
  const done = 60_001

  it('sorts a drain by how long you held', () => {
    expect(drainResult(NOODLES.drainFrom - 1)).toBe('watery')
    expect(drainResult(NOODLES.drainFrom)).toBe('good')
    expect(drainResult(NOODLES.drainTo)).toBe('good')
    expect(drainResult(NOODLES.drainTo + 1)).toBe('mush')
    expect(drainResult(NOODLES.dumpMs)).toBe('dumped')
  })

  it('waits a real minute, then needs draining before the pour', () => {
    const state = stirred()
    expect(state.noodles?.label).toBe('Noodles boiling')
    expect(canPour(state)).toBe(false)
    expect(noodlesReady(state, 30_000)).toBe(false)
    expect(drainNoodles(state, 1500, 30_000)).toBeNull()
    expect(noodlesReady(state, done)).toBe(true)
    expect(drainNoodles(state, 1500, done)).toBe('good')
    expect(state.noodles).toBeNull()
    expect(canPour(state)).toBe(true)
  })

  it('reinforces the blocks when drained in the window', () => {
    const state = stirred()
    drainNoodles(state, 1500, done)
    pourTray(state, [0.8, 0.8, 0.8, 0.8])
    const plain = setup()
    startFreshBatch(plain.state, plain.stock, plain.options)
    const [a] = pour(plain.state)
    const [b] = state.tray!.moulds
    expect(b!.make.noodles).toBe(true)
    expect(b!.q).toBeCloseTo(a!.q)
    state.tray!.location = 'hand'
    unloadTray(state)
    expect(state.blocks.get(state.stool[0]!)?.noodles).toBe(true)
  })

  it('waters the jelly down when drained early', () => {
    const state = stirred()
    expect(drainNoodles(state, 600, done)).toBe('watery')
    pourTray(state, [0.8, 0.8, 0.8, 0.8])
    const plain = setup()
    startFreshBatch(plain.state, plain.stock, plain.options)
    const [a] = pour(plain.state)
    const [b] = state.tray!.moulds
    expect(b!.make.noodles).toBe(true)
    expect(a!.q - b!.q).toBeCloseTo(NOODLES.wateryQ)
  })

  it('gives no help when drained late or dumped in the sink', () => {
    for (const held of [2800, NOODLES.dumpMs]) {
      const state = stirred()
      drainNoodles(state, held, done)
      expect(state.mix?.noodles).toBe('mush')
      expect(canPour(state)).toBe(true)
      pourTray(state, [0.8, 0.8, 0.8, 0.8])
      expect(state.tray!.moulds[0]!.make.noodles).toBe(false)
    }
  })

  it('skips batches started before you bought it, and goes with a lost batch', () => {
    const before = setup()
    startFreshBatch(before.state, before.stock, before.options)
    expect(before.state.mix?.noodles).toBeNull()
    finishBoil(before.state.mix!, 0.75)
    finishStir(before.state, 0.8, 0)
    expect(canPour(before.state)).toBe(true)
    const { state, stock, options } = setup(['noodles'])
    startFreshBatch(state, stock, options)
    startNoodles(state, 0)
    stock.use('gelatin', stock.count('gelatin'))
    expect(burnMix(state, stock)).toBe(false)
    expect(state.noodles).toBeNull()
  })

  it('makes blocks tougher, without extra tears', () => {
    expect(toughness(0.8, 0, true) / toughness(0.8)).toBeCloseTo(1.15)
  })
})

describe('Mesh Backing', () => {
  const decay = (mesh: number) =>
    decayPerSecond({
      q: 0.83,
      fixings: 2,
      residue: 0,
      heat: 'none',
      mesh,
      screw: false,
      fly: false,
      holes: 2,
      integrity: 1,
      section: null
    } satisfies DecayInputs)

  it('slows decay, toughens and cuts extra tears, by half for a ragged sheet', () => {
    const ragged = MESH.raggedHelp
    expect(decay(1) / decay(0)).toBeCloseTo(0.8)
    expect(decay(ragged) / decay(0)).toBeCloseTo(0.9)
    expect(toughness(0.8, 1) / toughness(0.8)).toBeCloseTo(1.2)
    expect(toughness(0.8, ragged) / toughness(0.8)).toBeCloseTo(1.1)
    expect(extraTearOdds(0.5, 1) / extraTearOdds(0.5)).toBeCloseTo(0.6)
    expect(extraTearOdds(0.5, ragged) / extraTearOdds(0.5)).toBeCloseTo(0.8)
  })
})
