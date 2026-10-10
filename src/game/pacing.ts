import {
  BOIL,
  FINAL,
  FRIDGE_MS,
  MOULDS,
  POUR,
  SECTION_CELLS,
  SECTION_COUNT,
  STIR,
  WASH
} from './tuning'

/**
 * The pacing model from the plan's Pacing section: how long each batch, section and the
 * final test take one kind of player, built from the game's own timings. A dev report
 * only; nothing in the game reads it.
 */

/** The section hold and the final test at normal speed. `HOLD_MS` shrinks with ?fast. */
const HOLD_S = 60
/** The run starts with a tray of this many blocks on the stool. */
const STARTER_BLOCKS = 4

/** How one kind of player paces a run. Seconds unless a name says minutes. */
export interface PacePlayer {
  name: string
  /** Aiming and settling at each mould, on top of the pour's own fill time. */
  pourAimS: number
  /** Share of the boil the needle spends in the green. */
  boilGreenShare: number
  /** One stir circle. The slosh limit is 0.45s. */
  circleS: number
  /** One rub stroke at the sink. */
  strokeS: number
  /** One move between kitchen stations or rooms, and the moves in a batch's prep. */
  moveS: number
  prepMoves: number
  /** The next batch's wash, boil and stir happen during the fridge minute. */
  pipelines: boolean
  /** One carry down the hallway, from the dev carry trials. */
  carryS: number
  /** Placing and nailing one block. */
  nailS: number
  /** Re-nail tours and alerts, shop trips and walking back, per batch. */
  renailS: number
  shopS: number
  walkS: number
  /** Cleaning up after each lost block: the splat and the cell. */
  cleanupS: number
  /** Extra work per block for screws and mesh, and per batch for noodles. */
  screwS: number
  meshS: number
  /** Minutes of each hold, resets included. */
  holdMin: number
  /** Minutes of section 1's cold open and teaching. */
  tutorialMin: number
  /** Blocks lost in each section, from the dev balance runs. */
  lost: readonly number[]
  /** Moulds per batch and upgrades owned in each section. */
  moulds: readonly number[]
  screws: readonly boolean[]
  mesh: readonly boolean[]
  /** Final test: minutes from the report to a pass, and blocks lost rebuilding after a fail. */
  finalPassMin: number
  rebuildLost: number
}

/** Minutes for one segment of the run, and what went into it. */
export interface SectionPace {
  section: number
  minutes: number
  batches: number
  lost: number
}

/** The whole run for one player. */
export interface PaceReport {
  player: string
  /** Minutes per batch, with 4 and 6 moulds. */
  batchMin: { four: number; six: number }
  /** Seconds of each fridge minute with nothing to do. */
  fridgeIdleS: number
  sections: SectionPace[]
  finalPassMin: number
  finalFailMin: number
  /** The run when the final test passes first time, and with `failures` fails first. */
  passMin: number
  failMin: number
  failures: number
}

/** Seconds of the next batch's wash, boil, stir and moves. */
export function prepSeconds(player: PacePlayer, moulds: number): number {
  const bowls = moulds > MOULDS ? 2 : 1
  const wash = bowls * WASH.bowlStrokes * player.strokeS
  const boil =
    (BOIL.riseMs * BOIL.greenFrom) / 1000 +
    BOIL.doneMs / 1000 / player.boilGreenShare
  const stir = STIR.circles * player.circleS
  return wash + boil + stir + player.prepMoves * player.moveS
}

/** Seconds of each fridge minute spent waiting, with nothing left to prepare. */
export function fridgeIdleSeconds(player: PacePlayer, moulds: number): number {
  const fridge = FRIDGE_MS / 1000
  return player.pipelines
    ? Math.max(0, fridge - prepSeconds(player, moulds))
    : fridge
}

/** Seconds of one batch, from the pour to the next pour, for `moulds` moulds. */
export function batchSeconds(player: PacePlayer, moulds: number): number {
  const fridge = FRIDGE_MS / 1000
  const pour =
    moulds *
    (POUR.line / POUR.fillPerSecond + POUR.nextAfterMs / 1000 + player.pourAimS)
  const prep = prepSeconds(player, moulds)
  const waiting = player.pipelines ? Math.max(fridge, prep) : fridge + prep
  return (
    pour +
    waiting +
    player.carryS +
    moulds * player.nailS +
    player.renailS +
    player.shopS +
    player.walkS
  )
}

/**
 * Minutes for one section: the batches its blocks and losses need, cleaning up each
 * loss, upgrade work per block, and the hold. Section 1 adds the cold open and starts
 * with the starter tray.
 */
export function sectionMinutes(
  player: PacePlayer,
  section: number
): SectionPace {
  const lost = player.lost[section] ?? 0
  const moulds = player.moulds[section] ?? MOULDS
  const blocks = SECTION_CELLS + lost
  const fresh = blocks - (section === 0 ? STARTER_BLOCKS : 0)
  const batches = fresh / moulds
  const upgradeS =
    (player.screws[section] ? player.screwS : 0) +
    (player.mesh[section] ? player.meshS : 0)
  const minutes =
    (batches * batchSeconds(player, moulds) +
      lost * player.cleanupS +
      blocks * upgradeS) /
      60 +
    player.holdMin +
    (section === 0 ? player.tutorialMin : 0)
  return { section, minutes, batches, lost }
}

/**
 * Minutes for one failed final test: his slam drops the weakest section, which you
 * rebuild with the biggest batches you have, hold again, and call him back for a retry.
 */
export function finalFailMinutes(player: PacePlayer): number {
  const last = SECTION_COUNT - 1
  const moulds = player.moulds[last] ?? MOULDS
  const blocks = SECTION_CELLS + player.rebuildLost
  const upgradeS =
    (player.screws[last] ? player.screwS : 0) +
    (player.mesh[last] ? player.meshS : 0)
  const retry =
    (FINAL.returnMs + FINAL.touchesMs) / 1000 / 60 + HOLD_S / 60 + 0.4
  return (
    ((blocks / moulds) * batchSeconds(player, moulds) +
      player.rebuildLost * player.cleanupS +
      blocks * upgradeS) /
      60 +
    player.holdMin +
    retry
  )
}

/** The whole run: every section, then the final test passed first time or after fails. */
export function paceReport(player: PacePlayer, failures = 1): PaceReport {
  const sections = Array.from({ length: SECTION_COUNT }, (_, i) =>
    sectionMinutes(player, i)
  )
  const run = sections.reduce((sum, s) => sum + s.minutes, 0)
  const finalFailMin = finalFailMinutes(player)
  return {
    player: player.name,
    batchMin: {
      four: batchSeconds(player, 4) / 60,
      six: batchSeconds(player, 6) / 60
    },
    fridgeIdleS: fridgeIdleSeconds(player, MOULDS),
    sections,
    finalPassMin: player.finalPassMin,
    finalFailMin,
    passMin: run + player.finalPassMin,
    failMin: run + player.finalPassMin + failures * finalFailMin,
    failures
  }
}

/** Upgrades by section on the plan's average path: recipe, screws, fridge, mesh. */
const AVERAGE_PATH = {
  moulds: [4, 4, 4, 6, 6],
  screws: [false, false, true, true, true],
  mesh: [false, false, false, false, true]
} as const

/**
 * The average player: pipelines from section 2, steady hands, answers alerts in 25s.
 * Losses are the mean of 16 seeds of `bun src/dev/balanceCli.ts average all 16`, plus
 * section 1's scripted single-nail lesson. Carries come from the carry trials. After a
 * failed final test the sections decay at the base speed, so the rebuild loses about 1.
 */
export const AVERAGE_PACE: PacePlayer = {
  name: 'average',
  pourAimS: 1.4,
  boilGreenShare: 0.6,
  circleS: 0.65,
  strokeS: 0.5,
  moveS: 3,
  prepMoves: 4,
  pipelines: true,
  carryS: 26,
  nailS: 7.5,
  renailS: 20,
  shopS: 12,
  walkS: 5,
  cleanupS: 20,
  screwS: 6,
  meshS: 6,
  holdMin: 1.7,
  tutorialMin: 1.5,
  lost: [1.6, 4.1, 2.8, 5.1, 3.8],
  ...AVERAGE_PATH,
  finalPassMin: 3.3,
  rebuildLost: 1
}

/**
 * The unskilled player: no pipelining, slow stations, two resets per hold, 4 moulds
 * until section 4 and no screws or mesh. Losses are the mean of 10 seeds of
 * `bun src/dev/balanceCli.ts unskilled all 10`, plus section 1's single-nail lesson.
 * The rebuild after a failed final test is still an assumption.
 */
export const UNSKILLED_PACE: PacePlayer = {
  name: 'unskilled',
  pourAimS: 2.9,
  boilGreenShare: 0.4,
  circleS: 0.9,
  strokeS: 0.8,
  moveS: 5,
  prepMoves: 4,
  pipelines: false,
  carryS: 30,
  nailS: 12.5,
  renailS: 35,
  shopS: 20,
  walkS: 8,
  cleanupS: 35,
  screwS: 9,
  meshS: 9,
  holdMin: 2.7,
  tutorialMin: 2.5,
  lost: [3.3, 12.2, 11.3, 18.9, 16.3],
  moulds: [4, 4, 4, 6, 6],
  screws: [false, false, false, false, false],
  mesh: [false, false, false, false, false],
  finalPassMin: 4,
  rebuildLost: 6
}
