import { useState } from 'react'

import { checkPack, PACKS, type Pack } from '../game/economy'
import { ODD_JOB, SHOP_SHEET } from '../game/tuning'
import type { Game } from '../scenes/game'
import {
  Button,
  CoinIcon,
  ShopPanel,
  useCoins,
  useStockCount,
  useStore
} from '../shared'
import { slotStyle } from './slot'

type Tab = 'supplies' | 'upgrades'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'supplies', label: 'Supplies' },
  { id: 'upgrades', label: 'Upgrades' }
]

/**
 * The shop's docked sheet over the counter and the floor, with Supplies and Upgrades
 * tabs. It is never a modal, so the wall keeps sagging while you browse. It hides while
 * you sweep the floor.
 */
export function ShopSheet({ game }: { game: Game }) {
  const layout = useStore(game.layout)
  const scene = useStore(game.hud, s => s.scene)
  const sweeping = useStore(game.hud, s => s.sweeping)
  const covered = useStore(game.hud, s => s.covered)
  const oddJob = useStore(game.hud, s => s.oddJob)
  const [tab, setTab] = useState<Tab>('supplies')
  // Re-render when an upgrade puts new packs on the shelf.
  useStore(game.economy.upgrades.store, s => s.owned.length)
  if (scene !== 'shop' || sweeping || covered) return null
  return (
    <div
      className="absolute flex flex-col gap-1.5 text-ink"
      style={slotStyle(layout, SHOP_SHEET)}
    >
      <div role="tablist" aria-label="Shop" className="flex gap-2">
        {TABS.map(t => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            variant={tab === t.id ? 'primary' : 'ghost'}
            onClick={() => setTab(t.id)}
            className="flex-1"
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="pointer-events-auto min-h-0 flex-1 overflow-y-auto"
      >
        {tab === 'supplies' ? (
          <section className="rounded-sketch-alt border-[3px] border-ink bg-paper p-2">
            {oddJob && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-sketch border-2 border-marker-orange bg-marker-yellow/30 p-2">
                <p className="font-hand text-lg leading-tight">
                  Broke? She pays {ODD_JOB.pay} coins to sweep the floor.
                </p>
                <Button onClick={() => game.shop.startSweep()}>
                  Sweep the Floor
                </Button>
              </div>
            )}
            <ul className="grid grid-cols-2 gap-2">
              {PACKS.filter(p => !p.requires || game.owns(p.requires)).map(
                pack => (
                  <PackCard key={pack.id} game={game} pack={pack} />
                )
              )}
            </ul>
          </section>
        ) : (
          <ShopPanel
            shop={game.economy.upgrades}
            onBuy={upgrade => game.upgraded(upgrade)}
            title=""
          />
        )}
      </div>
    </div>
  )
}

/** One pack: what you have at home, and a buy button that says why it can't sell. */
function PackCard({ game, pack }: { game: Game; pack: Pack }) {
  const { wallet, stock } = game.economy
  const coins = useCoins(wallet)
  const have = useStockCount(stock, pack.item)
  const check = checkPack(pack, wallet, stock)
  return (
    <li className="flex flex-col gap-1 rounded-sketch border-2 border-ink/60 bg-white/60 p-2">
      <span className="flex items-baseline justify-between gap-1">
        <span className="font-marker text-lg leading-tight">{pack.name}</span>
        <span className="font-hand text-base whitespace-nowrap text-ink-soft">
          {pack.item === 'mopHeads' ? `${have} spare` : `Have ${have}`}
        </span>
      </span>
      <Button
        sound={false}
        disabled={!check.ok}
        onClick={() => game.shop.buy(pack)}
        aria-label={
          check.ok
            ? `Buy ${pack.name} for ${pack.price} coins`
            : check.reason === 'full'
              ? `${pack.name}: no room at home`
              : `${pack.name}: need ${pack.price - coins} more coins`
        }
        className="w-full px-1"
      >
        {/* The Button sets text-lg; the label sits a size down so it fits on phones. */}
        <span className="flex items-center gap-1 text-base whitespace-nowrap">
          {check.ok ? (
            <>
              Buy <CoinIcon /> {pack.price}
            </>
          ) : check.reason === 'full' ? (
            'Full'
          ) : (
            <>
              Need <CoinIcon /> {pack.price - coins} More
            </>
          )}
        </span>
      </Button>
    </li>
  )
}
