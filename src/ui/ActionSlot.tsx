import { ACTION_SLOT, DESIGN_HEIGHT } from '../game/tuning'
import type { Game } from '../scenes/game'
import { Button, isTouchDevice, useStockCount, useStore } from '../shared'

/** Space between the stacked buttons, in CSS px. */
const GAP = 4

/**
 * React buttons over the stool strip's right end, placed from the viewport fit the game
 * publishes on resize: Whole Wall, the Nails/Screws toggle once you own screws, and Call
 * Uncle once every section is locked. During a heat wave, Shut Curtains sits just above
 * them until you press it. Each shows its desktop key. They stay during the final test.
 *
 * The column keeps the slot's bottom edge. On a small phone two 48 px buttons are taller
 * than the slot, so the column grows upwards over the floor instead of spilling off it.
 */
export function ActionSlot({ game }: { game: Game }) {
  const layout = useStore(game.layout)
  const view = useStore(game.hud, s => s.view)
  const scene = useStore(game.hud, s => s.scene)
  const phase = useStore(game.hud, s => s.phase)
  const covered = useStore(game.hud, s => s.covered)
  const allLocked = useStore(game.hud, s => s.allLocked)
  const tool = useStore(game.hud, s => s.tool)
  const curtainsOpen = useStore(game.hud, s => s.heat !== null && !s.curtains)
  const screws = useStockCount(game.economy.stock, 'screws')
  const ownsScrews = useStore(game.economy.upgrades.store, s =>
    s.owned.includes('screws')
  )
  if (
    scene !== 'wall' ||
    covered ||
    phase === 'cold-open' ||
    phase === 'ending'
  )
    return null
  const callUncle = phase === 'play' && allLocked
  const showKeys = !isTouchDevice()
  const [x, y, width, height] = ACTION_SLOT
  const { scale, offsetX, offsetY } = layout
  // A narrow slot (phones) gets smaller words, so each button stays one or two lines.
  const narrow = width * scale < 130
  const text = narrow ? 'px-1 text-[15px] leading-none' : 'px-2 leading-tight'
  // The design is centred in the canvas box, so the box ends offsetY below the design.
  const bottom = offsetY + (DESIGN_HEIGHT - y - height) * scale
  return (
    <div
      className="absolute flex flex-col justify-end"
      style={{
        left: offsetX + x * scale,
        width: width * scale,
        bottom,
        gap: GAP
      }}
    >
      {curtainsOpen && (
        <Button
          variant="danger"
          aria-keyshortcuts="C"
          onClick={() => game.events.heat.shutCurtains()}
          className={`mb-2 flex-col gap-0 ${text}`}
        >
          <span>Shut Curtains</span>
          {showKeys && <kbd className="font-hand text-sm">C</kbd>}
        </Button>
      )}
      <div
        className="flex flex-col items-stretch justify-center"
        style={{ minHeight: height * scale, gap: GAP }}
      >
        <Button
          variant="ghost"
          aria-keyshortcuts="W"
          onClick={() => game.toggleView()}
          className={`flex-col gap-0 ${text}`}
        >
          <span>{view === 'whole' ? 'Back to Section' : 'Whole Wall'}</span>
          {showKeys && <kbd className="font-hand text-sm text-ink-soft">W</kbd>}
        </Button>
        {callUncle && (
          <Button
            aria-keyshortcuts="U"
            onClick={() => game.report.set({ open: true })}
            className={`flex-col gap-0 ${text}`}
          >
            <span>Call Uncle</span>
            {showKeys && <kbd className="font-hand text-sm">U</kbd>}
          </Button>
        )}
        {ownsScrews && !callUncle && (
          <Button
            variant={tool === 'screw' ? 'primary' : 'ghost'}
            aria-keyshortcuts="S"
            aria-label={
              tool === 'screw'
                ? `Using screws, ${screws} left. Switch to nails.`
                : 'Using nails. Switch to screws.'
            }
            onClick={() => game.toggleTool()}
            className={`flex-col gap-0 ${text}`}
          >
            <span>{tool === 'screw' ? 'Screws' : 'Nails'}</span>
            <span className="font-hand text-sm text-ink-soft">
              {tool === 'screw'
                ? `${screws} left`
                : showKeys
                  ? 'Click for screws'
                  : 'Tap for screws'}
              {showKeys && ' (S)'}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
