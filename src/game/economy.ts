import type { Stock, Wallet } from '../shared'
import { gelatinFor, tubsFor, type BatchOptions } from './kitchen'
import {
  GELATIN_PRICE,
  MESS,
  MOP_LOW,
  NAIL_PACK_PRICE,
  NAILS_LOW,
  ODD_JOB,
  SCREW
} from './tuning'
import type { UpgradeId } from './upgrades'

// The corner shop's rules: supply packs, the restock chores and the odd job that keeps
// a broke run from getting stuck.

/** Stock ids the shop sells. */
export type SupplyId = 'gelatin' | 'nails' | 'screws' | 'mopHeads'

/** One pack on the shelf: `size` units of a supply for `price` coins. */
export interface Pack {
  id: string
  item: SupplyId
  name: string
  size: number
  price: number
  /** Only on the shelf once you own this upgrade. */
  requires?: UpgradeId
}

export const PACKS: readonly Pack[] = [
  {
    id: 'gelatin-1',
    item: 'gelatin',
    name: 'Gelatin',
    size: 1,
    price: GELATIN_PRICE
  },
  {
    id: 'gelatin-5',
    item: 'gelatin',
    name: 'Gelatin x5',
    size: 5,
    price: GELATIN_PRICE * 5
  },
  {
    id: 'nails-10',
    item: 'nails',
    name: 'Nails x10',
    size: 10,
    price: NAIL_PACK_PRICE
  },
  {
    id: 'screws-10',
    item: 'screws',
    name: 'Screws x10',
    size: SCREW.packSize,
    price: SCREW.packPrice,
    requires: 'screws'
  },
  {
    id: 'mop-head',
    item: 'mopHeads',
    name: 'Mop Head',
    size: 1,
    price: MESS.headPrice
  }
]

export type PackResult = { ok: true } | { ok: false; reason: 'poor' | 'full' }

/** Whether a pack would sell: it must fit the shelf at home, then your coins. */
export function checkPack(
  pack: Pack,
  wallet: Wallet,
  stock: Stock
): PackResult {
  const max = stock.get(pack.item).max ?? Infinity
  if (stock.count(pack.item) + pack.size > max)
    return { ok: false, reason: 'full' }
  if (!wallet.canAfford(pack.price)) return { ok: false, reason: 'poor' }
  return { ok: true }
}

/** Pays for a pack and puts it in stock, or says why not and changes nothing. */
export function buyPack(pack: Pack, wallet: Wallet, stock: Stock): PackResult {
  const check = checkPack(pack, wallet, stock)
  if (!check.ok) return check
  wallet.spend(pack.price, `Bought ${pack.name.toLowerCase()}`)
  stock.add(pack.item, pack.size)
  return check
}

/** What you have at home, for the restock chores and the odd job. */
export interface Supplies {
  coins: number
  gelatin: number
  nails: number
  tubs: number
  /** Smears the fitted mop head has left, and spare heads in stock. */
  mopUses: number
  spareHeads: number
  /** Screws in stock, or null before you own the upgrade. */
  screws?: number | null
}

/** Which restock chores should be open. */
export function restockNeeds(
  supplies: Supplies,
  options: BatchOptions = {}
): { gelatin: boolean; nails: boolean; screws: boolean; mopHead: boolean } {
  const screws = supplies.screws ?? null
  return {
    gelatin: supplies.gelatin < gelatinFor(options),
    nails: supplies.nails < NAILS_LOW,
    screws: screws !== null && screws < SCREW.low,
    mopHead: supplies.mopUses < MOP_LOW && supplies.spareHeads === 0
  }
}

/**
 * The shopkeeper offers the odd job while you are nearly broke and stuck: you can't
 * make a batch (no gelatin, no tubs, and too few coins to buy the gelatin you lack),
 * or you are low on nails and can't afford a pack.
 */
export function oddJobOffered(
  supplies: Supplies,
  options: BatchOptions = {}
): boolean {
  const { coins, gelatin, nails, tubs } = supplies
  if (coins >= ODD_JOB.under) return false
  const need = gelatinFor(options)
  const noBatch =
    gelatin < need &&
    tubs < tubsFor(options) &&
    coins < (need - gelatin) * GELATIN_PRICE
  const noNails = nails < NAILS_LOW && coins < NAIL_PACK_PRICE
  return noBatch || noNails
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}
