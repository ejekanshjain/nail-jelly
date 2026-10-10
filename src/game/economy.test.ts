import { describe, expect, it } from 'vitest'

import {
  buyPack,
  checkPack,
  oddJobOffered,
  ordinal,
  PACKS,
  restockNeeds,
  type Supplies
} from './economy'
import { startFreshBatch } from './kitchen'
import { createEconomy, createGameState } from './state'
import { GELATIN_MAX, MESS, NAILS_MAX, ODD_JOB } from './tuning'

const pack = (id: string) => PACKS.find(p => p.id === id)!

const supplies = (patch: Partial<Supplies> = {}): Supplies => ({
  coins: 10,
  gelatin: 4,
  nails: 40,
  tubs: 0,
  mopUses: MESS.headSmears,
  spareHeads: 0,
  ...patch
})

describe('supply packs', () => {
  it('pay coins and add the whole pack', () => {
    const { wallet, stock } = createEconomy()
    expect(buyPack(pack('gelatin-5'), wallet, stock)).toEqual({ ok: true })
    expect(wallet.coins()).toBe(0)
    expect(stock.count('gelatin')).toBe(9)
    expect(buyPack(pack('nails-10'), wallet, stock)).toEqual({
      ok: false,
      reason: 'poor'
    })
    expect(stock.count('nails')).toBe(40)
  })

  it("refuse a pack that doesn't fit at home", () => {
    const { wallet, stock } = createEconomy()
    wallet.earn(100, 'Test')
    stock.add('nails', NAILS_MAX - 45)
    expect(checkPack(pack('nails-10'), wallet, stock)).toEqual({
      ok: false,
      reason: 'full'
    })
    stock.add('gelatin', GELATIN_MAX)
    expect(buyPack(pack('gelatin-1'), wallet, stock).ok).toBe(false)
    expect(wallet.coins()).toBe(110)
    for (let i = 0; i < MESS.spareHeadsMax; i++)
      expect(buyPack(pack('mop-head'), wallet, stock).ok).toBe(true)
    expect(checkPack(pack('mop-head'), wallet, stock)).toEqual({
      ok: false,
      reason: 'full'
    })
  })
})

describe('screw packs', () => {
  it('sell 10 for 8 once you own screws, and the chore opens below 4', () => {
    const screws = PACKS.find(p => p.item === 'screws')!
    expect(screws).toMatchObject({ size: 10, price: 8, requires: 'screws' })
    expect(restockNeeds(supplies()).screws).toBe(false)
    expect(restockNeeds(supplies({ screws: 4 })).screws).toBe(false)
    expect(restockNeeds(supplies({ screws: 3 })).screws).toBe(true)
  })
})

describe('restock chores', () => {
  it('open below a batch of gelatin, 10 nails, and a nearly worn head with no spare', () => {
    expect(restockNeeds(supplies())).toEqual({
      gelatin: false,
      nails: false,
      screws: false,
      mopHead: false
    })
    expect(
      restockNeeds(supplies({ gelatin: 1, nails: 9, mopUses: 1 }))
    ).toEqual({ gelatin: true, nails: true, screws: false, mopHead: true })
    expect(restockNeeds(supplies({ mopUses: 0, spareHeads: 1 })).mopHead).toBe(
      false
    )
    expect(
      restockNeeds(supplies({ gelatin: 2 }), { recipe: true }).gelatin
    ).toBe(true)
  })
})

describe('the odd job', () => {
  it('appears only when broke and stuck', () => {
    const stuck = supplies({ coins: 0, gelatin: 0 })
    expect(oddJobOffered(stuck)).toBe(true)
    // Enough coins for the missing gelatin, or tubs for a recycled batch: not stuck.
    expect(oddJobOffered({ ...stuck, coins: 4 })).toBe(false)
    expect(oddJobOffered({ ...stuck, tubs: 4 })).toBe(false)
    expect(oddJobOffered({ ...stuck, gelatin: 2 })).toBe(false)
    // Low on nails and can't afford a pack.
    expect(oddJobOffered(supplies({ coins: 4, nails: 3 }))).toBe(true)
    // Rich players never sweep.
    expect(oddJobOffered(supplies({ coins: ODD_JOB.under, gelatin: 0 }))).toBe(
      false
    )
  })

  it('pays enough to get a run with nothing back to a batch', () => {
    const state = createGameState()
    const { wallet, stock } = createEconomy()
    wallet.spend(wallet.coins())
    stock.use('gelatin', stock.count('gelatin'))
    const now = () =>
      supplies({
        coins: wallet.coins(),
        gelatin: stock.count('gelatin'),
        tubs: state.tubs
      })
    let jobs = 0
    while (!startFreshBatch(state, stock).ok && jobs < 5) {
      if (oddJobOffered(now())) {
        wallet.earn(ODD_JOB.pay, 'Swept the shop')
        jobs++
      }
      buyPack(pack('gelatin-1'), wallet, stock)
      buyPack(pack('gelatin-1'), wallet, stock)
    }
    expect(state.mix).not.toBeNull()
    expect(jobs).toBe(1)
  })
})

describe('ordinal', () => {
  it('names counts the way people say them', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 103].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '14th',
      '21st',
      '22nd',
      '103rd'
    ])
  })
})
