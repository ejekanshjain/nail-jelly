import type { ReactNode } from 'react'

import type { Game } from '../scenes/game'
import { CoinBadge, cn, TimerChip, useStore } from '../shared'
import { ChoresPanel } from './Chores'
import { Supplies, TipLine } from './TopBar'

/**
 * Width of each desktop side column: the room beside the design, which is 0.75 times the
 * screen height wide, between 220 and 340 CSS px. At 1280 x 800 each column is 340 px
 * and the canvas box is exactly the design.
 */
const COLUMN =
  'w-[clamp(220px,calc((100vw_-_75dvh)/2),340px)] shrink-0 min-h-0 p-4'

/**
 * The desktop left column: coins and supplies, the waits, the tip, then the chores. It
 * never scrolls; only a very long chore list scrolls inside its own box.
 */
export function LeftColumn({ game }: { game: Game }) {
  const fridge = useStore(game.hud, s => s.fridge)
  const noodles = useStore(game.hud, s => s.noodles)
  return (
    <aside className={cn(COLUMN, 'flex flex-col gap-3')}>
      <div className="flex flex-wrap items-center gap-2">
        <CoinBadge wallet={game.economy.wallet} />
        <Supplies game={game} />
      </div>
      {(fridge || noodles) && (
        <div className="flex flex-wrap gap-2">
          {fridge && (
            <TimerChip timer={fridge} label="Fridge" doneLabel="Set!" />
          )}
          {noodles && (
            <TimerChip timer={noodles} label="Noodles" doneLabel="Drain!" />
          )}
        </div>
      )}
      <TipLine
        game={game}
        className="shrink-0 rounded-sketch bg-paper-dark/60 p-3 font-hand text-xl leading-snug empty:hidden"
      />
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 pb-2">
        <ChoresPanel game={game} />
      </div>
    </aside>
  )
}

/** The desktop right column: the room buttons, settings and the replay. */
export function RightColumn({ children }: { children: ReactNode }) {
  return <aside className={cn(COLUMN, 'flex flex-col gap-4')}>{children}</aside>
}
