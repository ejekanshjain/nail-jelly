import {
  createShop,
  createStock,
  createWallet,
  type Shop,
  type Stock,
  type Wallet
} from '../shared'
import { inputsForQuality, type QualityInputs } from './quality'
import {
  MESS,
  GELATIN_MAX,
  GELATIN_PRICE,
  HOLD_MS,
  NAILS_MAX,
  SCREW,
  SECTION_CELLS,
  SECTION_COUNT,
  START_COINS,
  START_GELATIN,
  START_NAILS
} from './tuning'
import { createTutorial } from './tutorial'
import type { BlockState, Flavour, GameState, SectionState } from './types'
import { UPGRADES, type JellyUpgrade } from './upgrades'

/** Builds a fresh run's simulation state. Nothing is saved, so this is the whole game. */
export function createGameState(): GameState {
  const sections: SectionState[] = []
  for (let index = 0; index < SECTION_COUNT; index++) {
    sections.push({
      index,
      cells: Array.from({ length: SECTION_CELLS }, () => ({
        block: null,
        residue: 0,
        emptyNails: []
      })),
      locked: false,
      holdLeftMs: HOLD_MS,
      holdActive: false,
      grade: null,
      weakestGrip: 1,
      snapshot: [],
      lockedOnce: false
    })
  }
  return {
    simMs: 0,
    phase: 'cold-open',
    scene: 'wall',
    section: 0,
    sections,
    blocks: new Map(),
    stool: [],
    splats: [],
    kitchenView: 'overview',
    mix: null,
    tray: null,
    fridge: null,
    noodles: null,
    carry: null,
    carries: 0,
    batches: 0,
    mopUses: MESS.headSmears,
    tubs: 0,
    bowls: [1],
    potScrubs: 0,
    stats: { blocksLost: 0, nailsUsed: 0, bareWallNails: 0, longestHoldMs: 0 },
    lastSplatMs: 0,
    tutorial: createTutorial(),
    final: null,
    nextId: 1
  }
}

/** Hands out the next id for blocks, fixings and splats. */
export function nextId(state: GameState): number {
  return state.nextId++
}

/** The run's coins, supplies and upgrades, built on the shared economy stores. */
export interface Economy {
  wallet: Wallet
  stock: Stock
  upgrades: Shop<JellyUpgrade>
}

export function createEconomy(): Economy {
  const wallet = createWallet({ coins: START_COINS })
  return {
    wallet,
    upgrades: createShop(UPGRADES, wallet),
    stock: createStock([
      {
        id: 'nails',
        name: 'Nails',
        price: 5,
        start: START_NAILS,
        max: NAILS_MAX
      },
      {
        id: 'gelatin',
        name: 'Gelatin',
        price: GELATIN_PRICE,
        start: START_GELATIN,
        max: GELATIN_MAX
      },
      {
        id: 'screws',
        name: 'Screws',
        price: SCREW.packPrice,
        start: 0,
        max: SCREW.max
      },
      {
        id: 'mopHeads',
        name: 'Mop heads',
        price: MESS.headPrice,
        start: 0,
        max: MESS.spareHeadsMax
      }
    ])
  }
}

/**
 * Puts a new block on the stool and returns it. Without the scores it was made from,
 * it gets made-up ones that explain `q`.
 */
export function addStoolBlock(
  state: GameState,
  q: number,
  flavour: Flavour,
  make: QualityInputs = inputsForQuality(q)
): BlockState {
  const block = createBlock(state, q, flavour, make)
  state.stool.push(block.id)
  return block
}

/** Registers a new block that isn't anywhere yet. Most callers want `addStoolBlock`. */
export function createBlock(
  state: GameState,
  q: number,
  flavour: Flavour,
  make: QualityInputs
): BlockState {
  const block: BlockState = {
    id: nextId(state),
    q,
    make,
    flavour,
    status: 'stool',
    section: -1,
    cell: -1,
    fixings: [],
    holes: 0,
    torn: 0,
    residue: 0,
    mesh: 0,
    noodles: make.noodles ?? false,
    heldAtMs: 0,
    firstBiteMs: null,
    lostMs: null,
    lastNailMs: 0,
    paid: false,
    lastShock: null,
    lastShockMs: -Infinity,
    cause: null,
    sweetMs: -Infinity
  }
  state.blocks.set(block.id, block)
  return block
}

/** Flavours cycle in this order, batch by batch. */
export const FLAVOURS: readonly Flavour[] = [
  'strawberry',
  'lime',
  'blueberry',
  'orange',
  'grape'
]
