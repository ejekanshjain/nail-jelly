import {
  carryOptions,
  createCarry,
  stepCarry,
  type CarryEvent
} from '../game/carry'
import { Director } from '../game/events'
import { gaussian } from '../game/noise'
import { blockWarningLines } from '../game/warnings'
import { inputsForQuality } from '../game/quality'
import { screwGrip } from '../game/screw'
import { pieceSize } from '../game/sim/blockBody'
import { isUp, lockSection, upCount } from '../game/section'
import { addStoolBlock, FLAVOURS } from '../game/state'
import {
  CARRY,
  SECTION_CELLS,
  SWEET_CENTRE,
  UP_MIN_PARTICLES
} from '../game/tuning'
import type { LossCause } from '../game/types'
import { UPGRADES, type UpgradeId } from '../game/upgrades'
import { Game } from '../scenes/game'
import { rng, settings } from '../shared'

const STEP = 1000 / 60

/**
 * How a scripted player plays one section: how often trays arrive, how well they nail,
 * how quickly they answer alerts. Times are in seconds of simulation time.
 */
export interface BalancePlayer {
  name: string
  /** A tray of `moulds` blocks reaches the wall this often: one batch. */
  batchS: number
  /** Batch time with the bigger fridge's 6 moulds. */
  batchBigS: number
  /** Quality of each block, before the recipe's bonus. */
  q: number
  /**
   * Where you let go of the hammer: the sweet centre plus `aimBias`, spread by `aimSpread`
   * (both in charge, 0 to 1). The game's own zones sort it, Assist Mode's included.
   */
  aimBias: number
  aimSpread: number
  /** Plays with Assist Mode on. */
  assist: boolean
  /** Odds you hit a nail again straight away when it went in loose ("tink"). */
  fixLooseOdds: number
  /** Seconds of each batch spent at the wall: per block placed, and per visit. */
  nailS: number
  renailS: number
  /** Seconds to come back to the wall after an alert while in the kitchen. */
  alertS: number
  /** Seconds to react to a fly, the cat or a nail turning orange while at the wall. */
  reactS: number
  /** Odds of shooing the cat during its wiggle. */
  shooOdds: number
  /** Odds of scraping old jelly off a cell before nailing a new block there. */
  scrapeOdds: number
  /** Odds of noticing each orange or red nail on a re-nail tour. */
  noticeOdds: number
  /** Odds a cut mesh sheet comes out ragged, giving half the help. */
  raggedOdds: number
  /** Screw evenness, 0 to 1, and the odds a screw strips once. */
  screwEvenness: number
  screwStripOdds: number
  /** Upgrades owned in each section, by index. */
  upgrades: readonly (readonly UpgradeId[])[]
  /** Carrying: how late you see the tray's tilt, how hard you correct it, how shaky. */
  carryDelayS: number
  carryGain: number
  carryShake: number
  /** Stop walking while blocks slide, until the tray settles. */
  carryStops: boolean
}

/** The plan's average player: pipelines, nails well and answers alerts in 20s. */
export const AVERAGE_PLAYER: BalancePlayer = {
  name: 'average',
  batchS: 180,
  batchBigS: 207,
  q: 0.83,
  aimBias: 0,
  aimSpread: 0.1,
  assist: false,
  fixLooseOdds: 0.6,
  nailS: 7.5,
  renailS: 20,
  alertS: 25,
  reactS: 1.5,
  shooOdds: 0.6,
  scrapeOdds: 0.8,
  noticeOdds: 0.85,
  raggedOdds: 0.25,
  screwEvenness: 0.7,
  screwStripOdds: 0.25,
  upgrades: [
    [],
    ['recipe'],
    ['recipe', 'screws'],
    ['recipe', 'screws', 'fridge'],
    ['recipe', 'screws', 'fridge', 'mesh']
  ],
  carryDelayS: 0.25,
  carryGain: 0.15,
  carryShake: 0.01,
  carryStops: true
}

/** The plan's unskilled player: no pipelining, sloppier jelly and hits, slow to answer. */
export const UNSKILLED_PLAYER: BalancePlayer = {
  name: 'unskilled',
  batchS: 345,
  batchBigS: 372,
  q: 0.62,
  aimBias: 0.02,
  aimSpread: 0.14,
  assist: false,
  fixLooseOdds: 0.2,
  nailS: 12.5,
  renailS: 35,
  alertS: 50,
  reactS: 3,
  shooOdds: 0.35,
  scrapeOdds: 0.4,
  noticeOdds: 0.6,
  raggedOdds: 0.5,
  screwEvenness: 0.5,
  screwStripOdds: 0.5,
  upgrades: [[], [], ['recipe'], ['recipe', 'fridge'], ['recipe', 'fridge']],
  carryDelayS: 0.35,
  carryGain: 0.1,
  carryShake: 0.02,
  carryStops: true
}

/** What one section's run measured. */
export interface BalanceResult {
  section: number
  seed: number
  player: string
  /** Simulation minutes from the section's start to its lock, or to the time limit. */
  minutes: number
  locked: boolean
  /** Blocks lost on the wall, by cause. */
  lost: number
  causes: Partial<Record<LossCause, number>>
  trays: number
  /** Nails and screws driven again on re-nail tours. */
  rehammers: number
  /** Events that started, by kind. */
  events: Record<string, number>
}

/** Seconds each action takes at the wall. */
const COST = {
  walk: 2,
  place: 2,
  nail: 1.8,
  screw: 4,
  mesh: 6,
  scrape: 6,
  rehammer: 1.5,
  linger: 4
} as const

/** A section that hasn't locked after this long is reported as it stands. */
const LIMIT_S = 45 * 60

/**
 * Dev only: plays one section headless at normal speed with the real game, events and
 * all, under a scripted `player`, and reports the blocks lost and the time to lock. The
 * player re-nails every fixing below its orange line on each visit, comes back after
 * alerts, swats flies, shoos the cat at its odds and shuts the curtains. Carries, the
 * kitchen and the shop are not simulated: trays arrive every batch. Takes about 10 to
 * 30s of CPU per section.
 */
export function balanceSection(
  section: number,
  player: BalancePlayer = AVERAGE_PLAYER,
  seed = 1,
  log?: (line: string) => void
): BalanceResult {
  const random = rng(seed)
  const game = new Game({
    random: rng(seed * 7919 + 1),
    motion: false,
    skipColdOpen: true
  })
  const { state, wall, economy } = game
  game.events.director = new Director(seed)

  // Earlier sections lock straight away, as a run would have left them.
  for (let i = 0; i < section; i++) {
    for (let cell = 0; cell < SECTION_CELLS; cell++) {
      const block = addStoolBlock(state, player.q, 'lime')
      wall.place(block.id, cell)
      wall.hammer(block.id, 0, SWEET_CENTRE)
      wall.hammer(block.id, 3, SWEET_CENTRE)
    }
    for (let k = 0; k < 72; k++) game.update(STEP)
    lockSection(state, wall, economy.wallet)
  }
  // The run's starter tray belongs to section 1.
  if (section > 0) state.stool = []
  for (const id of player.upgrades[section] ?? []) {
    const upgrade = UPGRADES.find(u => u.id === id)!
    economy.wallet.earn(upgrade.cost, 'Balance')
    if (economy.upgrades.buy(id).ok) game.upgraded(upgrade)
  }
  const owns = (id: UpgradeId) => economy.upgrades.owned(id)
  const q = Math.min(1, player.q + (owns('recipe') ? 0.08 : 0))
  const moulds = owns('fridge') ? 6 : 4
  const batchS = owns('fridge') ? player.batchBigS : player.batchS

  settings.set({ assist: player.assist })
  const startMs = state.simMs
  const lostBefore = state.stats.blocksLost
  const result: BalanceResult = {
    section,
    seed,
    player: player.name,
    minutes: 0,
    locked: false,
    lost: 0,
    causes: {},
    trays: 0,
    rehammers: 0,
    events: {}
  }
  let nextTrayS = 0
  let kitchenS = 0
  let alertAtS: number | null = null
  let lastEvent: string | null = null
  let flySeenS: number | null = null
  let catRolled: unknown = null
  let catShooAtS: number | null = null
  let heatSeenS: number | null = null
  const elapsedS = () => (state.simMs - startMs) / 1000
  const active = () => state.sections[section]!
  const done = () => active().locked || elapsedS() > LIMIT_S

  /** Steps the game for `seconds`, answering the fly, the cat and the heat when at the wall. */
  const advance = (seconds: number) => {
    const steps = Math.round(seconds * 60)
    for (let i = 0; i < steps && !done(); i++) {
      game.update(STEP)
      watch()
    }
  }

  let lostSeen = state.stats.blocksLost
  const seen = new Map<number, string>()
  /** Counts events and plays the critters and the curtains as the player would. */
  const watch = () => {
    const current = game.events.current
    const now = elapsedS()
    if (current && current !== lastEvent) {
      result.events[current] = (result.events[current] ?? 0) + 1
      log?.(
        `${now.toFixed(1)}s ${current}, grips ${activeBlocks()
          .map(b => {
            const lines = blockWarningLines(b)
            return `${b.cell}:${b.fixings.map(f => f.grip.toFixed(2)).join('/')}>${lines.orange.toFixed(2)}`
          })
          .join(' ')}`
      )
    }
    lastEvent = current
    if (log)
      for (const block of state.blocks.values()) {
        if (block.section !== section) continue
        const key = `${block.status} ${block.fixings.length} ${block.cause}`
        if (seen.get(block.id) === key) continue
        seen.set(block.id, key)
        log(
          `${now.toFixed(1)}s block ${block.id} cell ${block.cell}: ${key} ${block.fixings.map(f => f.grip.toFixed(2)).join('/')} shock ${block.lastShock}`
        )
      }
    if (log && state.stats.blocksLost !== lostSeen) {
      lostSeen = state.stats.blocksLost
      const falling = [...state.blocks.values()].filter(
        b => b.status === 'falling' && b.section === section
      )
      log(
        `${now.toFixed(1)}s lost ${lostSeen - lostBefore} in ${state.scene}: ${falling.map(b => `cell ${b.cell} ${b.cause}`).join(', ')}`
      )
    }
    const present = state.scene === 'wall' && !game.wipe
    const critters = game.events.critters
    const fly = critters.fly
    if (!fly) flySeenS = null
    else if (present && flySeenS === null) flySeenS = now
    if (fly && flySeenS !== null && now - flySeenS >= player.reactS) {
      critters.hit('fly', 0, 0)
      flySeenS = null
    }
    const cat = critters.cat
    const phase = cat?.state.phase
    if (cat && present && phase === 'wiggle' && catRolled !== cat) {
      catRolled = cat
      catShooAtS = random() < player.shooOdds ? now + player.reactS : null
    }
    if (cat && catShooAtS !== null && now >= catShooAtS) {
      critters.hit('cat', 0, 0)
      catShooAtS = null
    }
    const heat = game.events.heat
    if (!heat.current) heatSeenS = null
    else if (present && heatSeenS === null) heatSeenS = now
    if (heat.wave && !heat.wave.curtains && heatSeenS !== null)
      if (now - heatSeenS >= player.reactS) heat.shutCurtains()
  }

  const goto = (room: 'wall' | 'kitchen') => {
    if (state.scene === room) return
    game.goto(room)
    advance(COST.walk)
  }

  /**
   * Something on the wall wants you back: a red nail (orange in Assist Mode), a critter,
   * a heat wave or a splat.
   */
  const alerting = (splatsBefore: number) => {
    if (game.events.critters.busy || game.events.heat.current) return true
    if (state.splats.length > splatsBefore) return true
    return activeBlocks().some(b => {
      const lines = blockWarningLines(b)
      const line = player.assist ? lines.orange : lines.red
      return b.fixings.some(f => f.grip < line)
    })
  }

  const activeBlocks = () => {
    const out = []
    for (const cell of active().cells) {
      const block =
        cell.block === null ? undefined : state.blocks.get(cell.block)
      if (block && isUp(block)) out.push(block)
    }
    return out
  }

  /** The charge you let go at. */
  const aim = () =>
    Math.max(
      0,
      Math.min(
        1,
        SWEET_CENTRE + player.aimBias + gaussian(random) * player.aimSpread
      )
    )

  /**
   * Drives one fixing into a block: a screw with screws, otherwise a nail, hit again at
   * once when it went in loose. Returns false when the block split or nothing went in.
   */
  const fix = (blockId: number, particle: number): boolean => {
    if (owns('screws')) {
      const strips = random() < player.screwStripOdds ? 1 : 0
      const grip = screwGrip(player.screwEvenness, strips)
      advance(COST.screw)
      return wall.screw(blockId, particle, grip, strips) !== null
    }
    for (let tries = 0; tries < 4; tries++) {
      advance(COST.nail)
      const outcome = wall.hammer(blockId, particle, aim())
      if (!outcome || outcome.kind === 'split') return false
      if (outcome.kind === 'weak') continue
      if (
        outcome.kind === 'loose' &&
        outcome.fixingId !== null &&
        random() < player.fixLooseOdds
      ) {
        advance(COST.rehammer)
        wall.rehammer(blockId, outcome.fixingId, aim())
      }
      return true
    }
    return false
  }

  /** Puts stool blocks into empty cells and fixes each with two nails or screws. */
  const placeBlocks = () => {
    for (const [cell, slot] of active().cells.entries()) {
      if (state.stool.length === 0 || done()) return
      if (slot.block !== null || wall.handBlock !== null) continue
      if (
        (slot.residue > 0 || slot.emptyNails.length > 0) &&
        random() < player.scrapeOdds
      ) {
        advance(COST.scrape)
        slot.residue = 0
        slot.emptyNails = []
      }
      const id = state.stool[0]!
      const block = state.blocks.get(id)!
      if (owns('mesh')) {
        advance(COST.mesh)
        block.mesh = random() < player.raggedOdds ? 0.5 : 1
      }
      advance(COST.place)
      if (!wall.place(id, cell)) continue
      if (fix(id, 0)) fix(id, 3)
    }
  }

  /**
   * Re-hammers every fixing below its orange line, as the policy says, and gives a block
   * hanging on one nail its second one, as the tip tells you.
   */
  const renailTour = () => {
    for (const block of activeBlocks()) {
      if (block.fixings.length < 2) {
        // A top particle still in the block's main piece, not a torn-off corner.
        const body = wall.bodyOf(block.id)
        const used = new Set(block.fixings.map(f => f.particle))
        const free = [0, 3, 1, 2, 4, 7].find(
          p => !used.has(p) && body && pieceSize(body, p) >= UP_MIN_PARTICLES
        )
        if (free !== undefined) fix(block.id, free)
      }
      const lines = blockWarningLines(block)
      for (const fixing of [...block.fixings]) {
        if (fixing.grip >= lines.orange || !isUp(block)) continue
        if (random() >= player.noticeOdds) continue
        advance(COST.rehammer)
        if (wall.rehammer(block.id, fixing.id, aim())) result.rehammers++
      }
    }
  }

  // The kitchen only moves on while you are in it: a batch's time at the wall (placing
  // and nailing its blocks, one re-nail tour) is already part of `batchS`.
  const kitchenPerTrayS = batchS - moulds * player.nailS - player.renailS
  game.goto('kitchen')
  advance(1)
  let splatsSeen = state.splats.length
  while (!done()) {
    if (kitchenS >= nextTrayS) {
      for (let i = 0; i < moulds; i++)
        addStoolBlock(
          state,
          q,
          FLAVOURS[result.trays % FLAVOURS.length]!,
          inputsForQuality(q)
        )
      result.trays++
      nextTrayS += kitchenPerTrayS
      log?.(
        `${elapsedS().toFixed(1)}s tray ${result.trays}, ${upCount(state, section)} up`
      )
    }
    const room = upCount(state, section) < SECTION_CELLS
    const visit =
      (state.stool.length > 0 && room) ||
      active().holdActive ||
      (alertAtS !== null && elapsedS() >= alertAtS)
    if (!visit) {
      if (alertAtS === null && alerting(splatsSeen))
        alertAtS = elapsedS() + player.alertS
      advance(0.5)
      kitchenS += 0.5
      continue
    }
    goto('wall')
    alertAtS = null
    placeBlocks()
    // Torn-off corners pop a second after the hit, so look the wall over after that.
    advance(COST.linger)
    renailTour()
    // During a hold you stay and watch, re-nailing whatever turns orange.
    while (active().holdActive && !done()) {
      advance(player.reactS)
      renailTour()
    }
    splatsSeen = state.splats.length
    if (!done()) goto('kitchen')
  }

  result.minutes = Math.round(elapsedS() / 6) / 10
  result.locked = active().locked
  result.lost = state.stats.blocksLost - lostBefore
  for (const block of state.blocks.values())
    if (block.section === section && block.cause && block.status === 'splatted')
      result.causes[block.cause] = (result.causes[block.cause] ?? 0) + 1
  return result
}

/** Runs every section for each seed and averages the losses and minutes. */
export function balanceReport(
  player: BalancePlayer = AVERAGE_PLAYER,
  seeds: readonly number[] = [1, 2, 3],
  onResult?: (result: BalanceResult) => void
): { section: number; lost: number; minutes: number }[] {
  const out = []
  for (let section = 0; section < 5; section++) {
    let lost = 0
    let minutes = 0
    for (const seed of seeds) {
      const result = balanceSection(section, player, seed)
      onResult?.(result)
      lost += result.lost
      minutes += result.minutes
    }
    out.push({
      section,
      lost: lost / seeds.length,
      minutes: minutes / seeds.length
    })
  }
  return out
}

/** What a batch of carries measured: blocks dropped per carry and seconds per carry. */
export interface CarryTrial {
  section: number
  player: string
  carries: number
  dropsPerCarry: number
  seconds: number
}

/** The player corrects the tray this often, like a hand on a phone. */
const CORRECT_EVERY_MS = 50

/**
 * Dev only: walks `carries` trays down the full hallway with the pure carry model and a
 * scripted hand. The hand sees the tray's tilt `carryDelayS` late, nudges the steering
 * against it every 50 ms by `carryGain`, shakes by `carryShake`, and stops while blocks
 * slide if `carryStops`. `puddles` are unmopped splats on the route; no cat. Measures
 * drops and time per carry.
 */
export function carryTrial(
  section: number,
  player: BalancePlayer = AVERAGE_PLAYER,
  seed = 1,
  carries = 20,
  puddles: readonly { at: number; side: 1 | -1 }[] = []
): CarryTrial {
  const random = rng(seed)
  const options = carryOptions(section, false)
  const moulds = (player.upgrades[section] ?? []).includes('fridge') ? 6 : 4
  const tray = Array.from({ length: moulds }, () => ({
    q: player.q,
    make: inputsForQuality(player.q)
  }))
  const delaySteps = Math.round((player.carryDelayS * 1000) / STEP)
  const events: CarryEvent[] = []
  let drops = 0
  let totalMs = 0
  for (let n = 0; n < carries; n++) {
    const carry = createCarry(tray, CARRY.route, puddles)
    const seen: number[] = []
    let steer = 0
    let sinceMs = 0
    let ms = 0
    while (!carry.arrived && ms < 120_000) {
      seen.push(carry.angle)
      const late =
        seen.length > delaySteps ? seen[seen.length - 1 - delaySteps]! : 0
      sinceMs += STEP
      if (sinceMs >= CORRECT_EVERY_MS) {
        sinceMs -= CORRECT_EVERY_MS
        steer -= (player.carryGain * late) / CARRY.steerDeg
        steer += gaussian(random) * player.carryShake
        steer = Math.max(-1, Math.min(1, steer))
      }
      const sliding = carry.blocks.some(b => Math.abs(b.v) > 20)
      const walking = !(player.carryStops && (sliding || Math.abs(late) > 5))
      events.length = 0
      stepCarry(
        carry,
        STEP,
        { walking, steer, jolt: false },
        random,
        options,
        events
      )
      for (const event of events) if (event.type === 'drop') drops++
      ms += STEP
    }
    totalMs += ms
  }
  return {
    section,
    player: player.name,
    carries,
    dropsPerCarry: drops / carries,
    seconds: totalMs / carries / 1000
  }
}
