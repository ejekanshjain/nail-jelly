import type { Game } from '../scenes/game'
import { CoinBadge, useStockCount, useStore } from '../shared'
import { GelatinIcon, MopIcon, NailIcon } from './icons'
import { ChoresButton } from './Chores'
import { SettingsButton } from './Settings'

/**
 * The phone top bar: coins, supplies, chores and the settings gear. The coins, chores
 * and gear keep their size; the supplies chip gets the room left between them and
 * shrinks to fit it, so the gear stays on screen on a 360 px phone.
 */
export function TopBar({ game }: { game: Game }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 px-2 min-[400px]:gap-2">
      <CoinBadge wallet={game.economy.wallet} className="shrink-0" />
      <div className="@container flex min-w-0 flex-1 justify-center">
        <Supplies game={game} />
      </div>
      <ChoresButton game={game} />
      <SettingsButton game={game} wide={false} />
    </header>
  )
}

/**
 * Supplies left, as a small paper chip of icons and counts. The mop shows the smears its
 * head has left, plus any spare heads.
 *
 * Inside the top bar's container it steps down to fit the room it gets: smaller type
 * under 172 px, no spare-head count under 148 px, then the smallest type under 128 px.
 * Those widths fit the widest counts (2-digit gelatin and nails, "5+3" mop). The desktop
 * column has no container, so it always shows the full chip.
 */
export function Supplies({ game }: { game: Game }) {
  const nails = useStockCount(game.economy.stock, 'nails')
  const gelatin = useStockCount(game.economy.stock, 'gelatin')
  const spares = useStockCount(game.economy.stock, 'mopHeads')
  const mop = useStore(game.hud, s => s.mopUses)
  const icon = 'size-5 shrink-0 @max-[172px]:size-4'
  return (
    <p
      className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-sketch border-2 border-ink bg-paper px-2 py-1 font-marker text-lg whitespace-nowrap @max-[172px]:px-1.5 @max-[172px]:text-base @max-[128px]:text-sm"
      aria-label={`${gelatin} gelatin packets, ${nails} nails, and a mop with ${mop} smears left and ${spares} spare heads`}
    >
      <GelatinIcon className={icon} />
      {gelatin}
      <NailIcon className={`ml-1 ${icon}`} />
      {nails}
      <MopIcon
        className={mop === 0 ? `ml-1 ${icon} text-marker-red` : `ml-1 ${icon}`}
      />
      <span className={mop === 0 ? 'text-marker-red' : undefined}>
        {mop}
        {spares > 0 && (
          <span className="@max-[148px]:hidden">{`+${spares}`}</span>
        )}
      </span>
    </p>
  )
}

/** The current hint, as a plain paragraph for the desktop left column. */
export function TipLine({
  game,
  className
}: {
  game: Game
  className?: string
}) {
  const tip = useStore(game.hud, s => s.tip)
  return (
    <p aria-live="polite" className={className}>
      {tip}
    </p>
  )
}
