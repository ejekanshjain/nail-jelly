import { isDone, startTimer, type Rng, type Stock } from '../shared'
import { blockQuality } from './quality'
import { addSplat } from './mess'
import { noodleHelp, noodlesAllowPour } from './noodles'
import { addStoolBlock, FLAVOURS } from './state'
import {
  FRIDGE_MS,
  GELATIN_PER_MOULD,
  GELATIN_PER_MOULD_RECIPE,
  MIX_POURABLE_MS,
  MIX_SET_STEP,
  MIX_SET_STEP_MS,
  MOULDS,
  SPILL_RADIUS,
  STOOL_MAX,
  TUBS_PER_MOULD,
  WASH
} from './tuning'
import type { Flavour, GameState, SplatColour, StoveMix } from './types'
import { bowlCleanliness, dirtyBowls } from './wash'

// The batch pipeline: the stove mix, the one tray and the fridge are separate, so the
// next batch can boil and stir while the last one sets.

/** Options that change a batch: upgrades, mostly. */
export interface BatchOptions {
  moulds?: number
  recipe?: boolean
  /** Noodle Reinforcement: each batch needs its noodles boiled and drained. */
  noodles?: boolean
}

/** Gelatin packets one fresh batch uses. */
export function gelatinFor({
  moulds = MOULDS,
  recipe = false
}: BatchOptions = {}): number {
  return Math.ceil(
    moulds * (recipe ? GELATIN_PER_MOULD_RECIPE : GELATIN_PER_MOULD)
  )
}

/** The flavour of the next batch. The starter tray was strawberry, so batches start at lime. */
export function nextFlavour(state: GameState): Flavour {
  return FLAVOURS[(state.batches + 1) % FLAVOURS.length]!
}

export type BatchResult =
  { ok: true } | { ok: false; reason: 'busy' | 'gelatin' | 'tubs' }

/** Tubs of floor jelly one recycled batch uses: one per mould. */
export function tubsFor({ moulds = MOULDS }: BatchOptions = {}): number {
  return moulds * TUBS_PER_MOULD
}

/** Why Recycled Batch can't start right now, or ok. */
export function checkRecycledBatch(
  state: GameState,
  options: BatchOptions = {}
): BatchResult {
  if (state.mix) return { ok: false, reason: 'busy' }
  if (state.tubs < tubsFor(options)) return { ok: false, reason: 'tubs' }
  return { ok: true }
}

/**
 * Recycled Batch: the scraped floor jelly goes back in the pot. No gelatin, weaker
 * grey-brown blocks, and it doesn't move the flavour cycle on.
 */
export function startRecycledBatch(
  state: GameState,
  options: BatchOptions = {}
): BatchResult {
  const check = checkRecycledBatch(state, options)
  if (!check.ok) return check
  state.tubs -= tubsFor(options)
  // Floor jelly needs no gelatin, so the recipe has nothing to add.
  state.mix = newMix('recycled', true, { ...options, recipe: false })
  return { ok: true }
}

function newMix(
  flavour: Flavour,
  recycled: boolean,
  options: BatchOptions
): StoveMix {
  return {
    flavour,
    recycled,
    recipe: options.recipe ?? false,
    noodles: options.noodles ? 'raw' : null,
    moulds: options.moulds ?? MOULDS,
    stage: 'boil',
    burnt: false,
    boil: 0,
    stir: 0,
    bowlClean: 1,
    stirredAtMs: 0
  }
}

/** Why Fresh Batch can't start right now, or ok. */
export function checkFreshBatch(
  state: GameState,
  stock: Stock,
  options: BatchOptions = {}
): BatchResult {
  if (state.mix) return { ok: false, reason: 'busy' }
  if (!stock.has('gelatin', gelatinFor(options)))
    return { ok: false, reason: 'gelatin' }
  return { ok: true }
}

/** Fresh Batch: pays the gelatin and puts a new mix on the stove, ready to boil. */
export function startFreshBatch(
  state: GameState,
  stock: Stock,
  options: BatchOptions = {}
): BatchResult {
  const check = checkFreshBatch(state, stock, options)
  if (!check.ok) return check
  stock.use('gelatin', gelatinFor(options))
  state.mix = newMix(nextFlavour(state), false, options)
  state.batches++
  return { ok: true }
}

/** The boil is done: the mix moves on to the bowl. */
export function finishBoil(mix: StoveMix, accuracy: number): void {
  if (mix.stage !== 'boil') return
  mix.boil = accuracy
  mix.stage = 'stir'
}

/** What Try Again costs after a burn: the batch's gelatin, or its tubs of floor jelly. */
export function retryCost(mix: StoveMix): {
  amount: number
  unit: 'gelatin' | 'tubs'
} {
  const sized = { moulds: mix.moulds, recipe: mix.recipe }
  return mix.recycled
    ? { amount: tubsFor(sized), unit: 'tubs' }
    : { amount: gelatinFor(sized), unit: 'gelatin' }
}

/** True when you have enough for Try Again after a burn. */
export function canRetry(state: GameState, stock: Stock): boolean {
  const mix = state.mix
  if (!mix) return false
  const { amount, unit } = retryCost(mix)
  return unit === 'tubs' ? state.tubs >= amount : stock.has('gelatin', amount)
}

/**
 * You burnt it. The gelatin, or the floor jelly, is lost and the pot needs extra
 * scrubbing. With enough for another lot, the batch waits for Try Again
 * (`retryBurnt`); with too little, it is gone, noodles and all. Returns whether it waits.
 */
export function burnMix(state: GameState, stock: Stock): boolean {
  const mix = state.mix
  if (!mix || mix.stage !== 'boil' || mix.burnt) return false
  state.potScrubs += WASH.potStrokes
  mix.boil = 0
  if (canRetry(state, stock)) {
    mix.burnt = true
    return true
  }
  state.mix = null
  state.noodles = null
  return false
}

/** Try Again after a burn: pays for a fresh lot, and the boil starts over. */
export function retryBurnt(state: GameState, stock: Stock): boolean {
  const mix = state.mix
  if (!mix?.burnt || !canRetry(state, stock)) return false
  const { amount, unit } = retryCost(mix)
  if (unit === 'tubs') state.tubs -= amount
  else stock.use('gelatin', amount)
  mix.burnt = false
  return true
}

/**
 * The stir is done at simulation time `atMs`. The mix keeps how clean the bowls were,
 * and the bowls are dirty now. Dev tools can pass their own `bowlClean`.
 */
export function finishStir(
  state: GameState,
  evenness: number,
  atMs: number,
  bowlClean: number = bowlCleanliness(state)
): void {
  const mix = state.mix
  if (mix?.stage !== 'stir') return
  mix.stir = evenness
  mix.bowlClean = bowlClean
  mix.stirredAtMs = atMs
  mix.stage = 'stirred'
  dirtyBowls(state)
}

/** True once a stirred mix has sat long enough to start setting in the bowl. */
export function isSetting(mix: StoveMix, atMs: number): boolean {
  return mix.stage === 'stirred' && atMs - mix.stirredAtMs >= MIX_POURABLE_MS
}

/** The stir score after the mix has sat in the bowl: 0.1 less for every 30s past 120s. */
export function stirScore(mix: StoveMix, atMs: number): number {
  const over = atMs - mix.stirredAtMs - MIX_POURABLE_MS
  if (mix.stage !== 'stirred' || over < 0) return mix.stir
  return Math.max(
    0,
    mix.stir - MIX_SET_STEP * Math.floor(over / MIX_SET_STEP_MS)
  )
}

/**
 * You can pour once the mix is stirred, its noodles (if it has any) are drained, and the
 * tray is empty in the kitchen.
 */
export function canPour(state: GameState): boolean {
  const mix = state.mix
  return (
    mix?.stage === 'stirred' && noodlesAllowPour(mix) && state.tray === null
  )
}

/**
 * Pours the mix into the moulds, one pour accuracy per mould, and each mould's fill when
 * known (a mould short of the line makes a thinner block). The tray then waits on the
 * counter for the fridge, and the stove is free again.
 */
export function pourTray(
  state: GameState,
  pours: readonly number[],
  fills?: readonly number[]
): boolean {
  const mix = state.mix
  if (!mix || !canPour(state) || pours.length === 0) return false
  const set = mix.stir - stirScore(mix, state.simMs)
  const noodles = noodleHelp(mix.noodles)
  state.tray = {
    flavour: mix.flavour,
    recycled: mix.recycled,
    location: 'kitchen',
    moulds: pours.map((pour, i) => {
      const make = {
        fill: fills?.[i],
        boil: mix.boil,
        stir: mix.stir,
        set,
        pour,
        bowlClean: mix.bowlClean,
        recycled: mix.recycled,
        recipe: mix.recipe,
        noodles: noodles.noodles,
        watery: noodles.watery
      }
      return { q: blockQuality(make), make }
    })
  }
  state.mix = null
  return true
}

/** What tapping the fridge does right now. */
export type FridgeAction = 'put-in' | 'take-out' | 'setting' | 'empty'

export function fridgeAction(state: GameState, at: number): FridgeAction {
  const tray = state.tray
  if (tray?.location === 'kitchen' && !state.fridge) return 'put-in'
  if (tray?.location === 'fridge' && state.fridge)
    return isDone(state.fridge, at) ? 'take-out' : 'setting'
  return 'empty'
}

/** Puts the poured tray in the fridge and starts the real-time wait at `at`. */
export function putInFridge(state: GameState, at: number): boolean {
  if (fridgeAction(state, at) !== 'put-in') return false
  state.tray!.location = 'fridge'
  state.fridge = startTimer('Jelly setting', FRIDGE_MS, at)
  return true
}

/** Takes the set tray out of the fridge, into your hands. */
export function takeTray(state: GameState, at: number): boolean {
  if (fridgeAction(state, at) !== 'take-out') return false
  state.tray!.location = 'hand'
  state.fridge = null
  return true
}

/**
 * Unloads the tray in your hands onto the stool, as far as the stool has room.
 * Returns how many blocks went onto the stool. An emptied tray goes back to the kitchen.
 */
export function unloadTray(state: GameState): number {
  const tray = state.tray
  if (tray?.location !== 'hand') return 0
  const room = Math.max(0, STOOL_MAX - state.stool.length)
  const unloaded = tray.moulds.splice(0, room)
  for (const mould of unloaded)
    addStoolBlock(state, mould.q, tray.flavour, mould.make)
  if (tray.moulds.length === 0) state.tray = null
  return unloaded.length
}

/** The batch's scores so far, for the recipe card. */
export function batchNote(mix: StoveMix | null, atMs: number): string {
  if (!mix) return ''
  const pct = (score: number) => `${Math.round(score * 100)}%`
  if (mix.burnt) return 'Burnt'
  if (mix.stage === 'boil') return 'Boil it first'
  if (mix.stage === 'stir') return `Boil ${pct(mix.boil)}`
  return `Boil ${pct(mix.boil)}, stir ${pct(stirScore(mix, atMs))}`
}

/** A spill from the stove or the moulds: a splat on the kitchen floor (design units). */
export function spillOnFloor(
  state: GameState,
  flavour: SplatColour,
  random: Rng,
  radius: number = SPILL_RADIUS
): void {
  addSplat(
    state,
    'kitchen',
    60 + random() * 480,
    712 + random() * 60,
    radius,
    flavour,
    Math.floor(random() * 1000),
    false
  )
}
