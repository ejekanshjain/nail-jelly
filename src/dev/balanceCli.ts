/**
 * Dev only: prints the M30 balance runs. From the nail-jelly folder:
 * `bun src/dev/balanceCli.ts [average|unskilled] [section] [seeds]`, where seeds is a
 * count (`3`) or a range (`4-6`). Each section takes 10 to 30s.
 */
import {
  AVERAGE_PLAYER,
  balanceSection,
  UNSKILLED_PLAYER,
  type BalanceResult
} from './balance'

const args =
  (globalThis as { Bun?: { argv: string[] } }).Bun?.argv.slice(2) ?? []
const player = args[0] === 'unskilled' ? UNSKILLED_PLAYER : AVERAGE_PLAYER
const sections =
  args[1] === undefined || args[1] === 'all'
    ? [0, 1, 2, 3, 4]
    : [Number(args[1]) - 1]
/** Seeds: a count from 1 (`3`), or a range (`4-6`). */
const [fromSeed, toSeed] = (args[2] ?? '3').includes('-')
  ? (args[2] ?? '').split('-').map(Number)
  : [1, Number(args[2] ?? 3)]
const seeds = Array.from(
  { length: (toSeed ?? 1) - (fromSeed ?? 1) + 1 },
  (_, i) => i + (fromSeed ?? 1)
)
/** A fourth argument, `log`, prints each event and loss as it happens. */
const log = args[3] === 'log' ? (line: string) => console.log(line) : undefined

for (const section of sections) {
  const results: BalanceResult[] = []
  for (const seed of seeds) {
    const result = balanceSection(section, player, seed, log)
    results.push(result)
    console.log(
      `S${section + 1} seed ${seed}: ${result.minutes} min${result.locked ? '' : ' (not locked)'}, lost ${result.lost} ${JSON.stringify(result.causes)}, trays ${result.trays}, re-nails ${result.rehammers}, events ${JSON.stringify(result.events)}`
    )
  }
  const mean = (pick: (r: BalanceResult) => number) =>
    (results.reduce((sum, r) => sum + pick(r), 0) / results.length).toFixed(1)
  console.log(
    `S${section + 1} ${player.name}: lost ${mean(r => r.lost)}, ${mean(r => r.minutes)} min`
  )
}
