import { gelatinFor, retryCost } from '../game/kitchen'
import {
  FRIDGE_SLOT,
  NOODLE_SLOT,
  RECIPE_SLOT,
  RETRY_SLOT,
  STATION_BACK_SLOT,
  TUB_SLOT
} from '../game/tuning'
import type { Game } from '../scenes/game'
import { freshBatchBlocker, recycledBatchBlocker } from '../scenes/kitchenScene'
import {
  Button,
  cn,
  isTouchDevice,
  TimerChip,
  useStockCount,
  useStore
} from '../shared'
import { slotStyle } from './slot'

/**
 * React controls over the kitchen: on the overview, Fresh Batch on the recipe card and,
 * on phones, the fridge countdown on the fridge door and the noodle countdown under the
 * stove (desktop shows both in the left column); in a station, the Kitchen back button.
 */
export function KitchenSlot({ game, wide }: { game: Game; wide: boolean }) {
  const layout = useStore(game.layout)
  const scene = useStore(game.hud, s => s.scene)
  const view = useStore(game.hud, s => s.kitchenView)
  const covered = useStore(game.hud, s => s.covered)
  const busy = useStore(game.hud, s => s.mix !== null)
  const burnt = useStore(game.hud, s => s.burnt)
  const note = useStore(game.hud, s => s.batchNote)
  const fridge = useStore(game.hud, s => s.fridge)
  const noodles = useStore(game.hud, s => s.noodles)
  const gelatin = useStockCount(game.economy.stock, 'gelatin')
  const tubs = useStore(game.hud, s => s.tubs)
  // Re-render when an upgrade changes the batch size or the recipe.
  useStore(game.economy.upgrades.store, s => s.owned.length)
  const options = game.batchOptions()
  // A wipe or the cutaway to the wall covers the room, buttons included.
  if (scene !== 'kitchen' || covered) return null
  const keys = !isTouchDevice()
  if (view !== 'overview')
    return (
      <>
        <div
          className="absolute flex items-center"
          style={slotStyle(layout, STATION_BACK_SLOT)}
        >
          <Button variant="ghost" onClick={() => game.kitchen.open('overview')}>
            Kitchen
          </Button>
        </div>
        {view === 'stove' && burnt && (
          <RetryButton game={game} keys={keys} gelatin={gelatin} tubs={tubs} />
        )}
      </>
    )
  const blocker = freshBatchBlocker(busy, gelatin, options)
  const recycled = recycledBatchBlocker(busy, tubs, options)
  // On small phones the tub slot is narrower than the label, so it wraps in smaller words.
  const narrowTub = TUB_SLOT[2] * layout.scale < 150
  return (
    <>
      <div
        className="absolute flex items-center justify-center"
        style={slotStyle(layout, RECIPE_SLOT)}
      >
        <Button
          aria-keyshortcuts="B"
          disabled={blocker !== null}
          onClick={() => game.kitchen.freshBatch()}
          className="max-w-full flex-col gap-0 px-3 leading-tight"
        >
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            Fresh Batch
            {keys && <kbd className="font-hand text-sm opacity-70">B</kbd>}
          </span>
          <span className="font-hand text-sm">
            {busy ? note : (blocker ?? `${gelatinFor(options)} gelatin`)}
          </span>
        </Button>
      </div>
      {tubs > 0 && (
        <div
          className="absolute flex items-center justify-start"
          style={slotStyle(layout, TUB_SLOT)}
        >
          <Button
            variant="ghost"
            aria-keyshortcuts="R"
            disabled={recycled !== null}
            onClick={() => game.kitchen.recycledBatch()}
            className={cn(
              'max-w-full flex-col gap-0 leading-tight',
              narrowTub ? 'px-2 text-[15px]' : 'px-3'
            )}
          >
            <span
              className={cn(
                'flex items-baseline gap-1.5',
                !narrowTub && 'whitespace-nowrap'
              )}
            >
              Recycled Batch
              {keys && <kbd className="font-hand text-sm opacity-70">R</kbd>}
            </span>
            <span className="font-hand text-sm">
              {recycled ?? 'Contains: floor'}
            </span>
          </Button>
        </div>
      )}
      {fridge && !wide && (
        <div
          className="absolute flex items-center justify-center"
          style={slotStyle(layout, FRIDGE_SLOT)}
        >
          {/* The chip is at least 144 px wide, wider than the fridge door on phones. */}
          <div
            className="shrink-0"
            style={{
              scale: Math.min(1, (FRIDGE_SLOT[2] * layout.scale) / 150)
            }}
          >
            <TimerChip timer={fridge} label="Fridge" doneLabel="Set!" />
          </div>
        </div>
      )}
      {noodles && !wide && (
        <div
          className="absolute flex items-center justify-start"
          style={slotStyle(layout, NOODLE_SLOT)}
        >
          <div
            className="shrink-0 origin-left"
            style={{
              scale: Math.min(1, (NOODLE_SLOT[2] * layout.scale) / 150)
            }}
          >
            <TimerChip timer={noodles} label="Noodles" doneLabel="Drain!" />
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Try Again after a burn, with what it costs. The boil only starts over when you press
 * it, so a press held through the smoke alarm can't burn a second batch.
 */
function RetryButton({
  game,
  keys,
  gelatin,
  tubs
}: {
  game: Game
  keys: boolean
  gelatin: number
  tubs: number
}) {
  const layout = useStore(game.layout)
  const mix = game.state.mix
  if (!mix) return null
  const { amount, unit } = retryCost(mix)
  const short = (unit === 'tubs' ? tubs : gelatin) < amount
  return (
    <div
      className="absolute flex items-center justify-end"
      style={slotStyle(layout, RETRY_SLOT)}
    >
      <Button
        aria-keyshortcuts="B"
        disabled={short}
        onClick={() => game.kitchen.retryBurnt()}
        className="max-w-full flex-col gap-0 px-3 leading-tight"
      >
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          Try Again
          {keys && <kbd className="font-hand text-sm opacity-70">B</kbd>}
        </span>
        <span className="font-hand text-sm">
          {short
            ? `Need ${amount} ${unit === 'tubs' ? 'tubs' : 'gelatin'}`
            : `${amount} ${unit === 'tubs' ? 'tubs of floor jelly' : 'gelatin'}`}
        </span>
      </Button>
    </div>
  )
}
