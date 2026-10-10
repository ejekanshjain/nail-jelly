import { useEffect, useState } from 'react'

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/tuning'
import type { SceneId } from '../game/types'
import { Game } from '../scenes/game'
import {
  cn,
  GameLayout,
  startLoop,
  useGameCanvas,
  useLeaveWarning,
  useStore,
  type DevAction
} from '../shared'
import { ActionSlot } from './ActionSlot'
import { Ending } from './Ending'
import { FinalVerdict } from './FinalVerdict'
import { KitchenSlot } from './KitchenSlot'
import { useWideLayout } from './media'
import { NavBar } from './NavBar'
import { ReplayPip } from './ReplayPip'
import { RotatePrompt } from './RotatePrompt'
import { SettingsButton } from './Settings'
import { ShopSheet } from './ShopSheet'
import { LeftColumn, RightColumn } from './SidePanels'
import { TipBubble } from './TipBubble'
import { TopBar } from './TopBar'
import { WallReport } from './WallReport'

/** What the canvas shows, for screen readers. */
const CANVAS_LABELS: Record<SceneId, string> = {
  wall: 'The wall. Drag jelly blocks from the stool and hammer them in.',
  kitchen: 'The kitchen.',
  hallway: 'The hallway between the kitchen and the wall.',
  shop: 'The corner shop.',
  'cold-open': 'Your uncle in the doorway.',
  ending: 'The ending.'
}

/**
 * The play screen. Phones stack the top bar, the canvas and the nav bar, with the tip
 * over the canvas box; wide screens put coins and tips in a left column and the nav in
 * a right one. Either way the
 * HUD sits beside the canvas, never over the design. Owns the Game and the loop.
 */
export function Shell({
  motion,
  skipColdOpen
}: {
  /** Listen to tilt sensors; false when you refused motion access. */
  motion: boolean
  skipColdOpen: boolean
}) {
  const { canvasRef, viewport } = useGameCanvas({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    mode: 'contain'
  })
  const [game] = useState(() => new Game({ motion, skipColdOpen }))
  const [dev, setDev] = useState<DevAction[]>([])
  const wide = useWideLayout()
  const scene = useStore(game.hud, s => s.scene)
  useLeaveWarning(true)

  useEffect(() => {
    const detach = game.attach(viewport)
    const stop = startLoop({
      update: dt => game.update(dt),
      render: (_alpha, timeMs) => game.render(timeMs)
    })
    let disposeDev = () => {}
    let cancelled = false
    if (import.meta.env.DEV) {
      void import('../dev/devApi').then(({ installDevApi }) => {
        if (cancelled) return
        const installed = installDevApi(game)
        disposeDev = installed.dispose
        setDev(installed.actions)
      })
    }
    return () => {
      cancelled = true
      stop()
      detach()
      disposeDev()
    }
  }, [game, viewport])

  // The canvas stays the second child in both layouts, so React never remounts it.
  return (
    <GameLayout dev={dev}>
      <div className={cn('flex size-full', wide ? 'flex-row' : 'flex-col')}>
        {wide ? <LeftColumn game={game} /> : <TopBar game={game} />}
        <div className="relative min-h-0 min-w-0 flex-1" data-canvas-box="">
          <canvas
            ref={canvasRef}
            aria-label={CANVAS_LABELS[scene]}
            className="pointer-events-auto absolute inset-0 block size-full touch-none"
          />
          <ActionSlot game={game} />
          <KitchenSlot game={game} wide={wide} />
          <ShopSheet game={game} />
          {!wide && <TipBubble game={game} />}
          {!wide && <ReplayPip game={game} wide={false} />}
        </div>
        {wide ? (
          <RightColumn>
            <NavBar game={game} wide />
            <SettingsButton game={game} wide />
            <ReplayPip game={game} wide />
          </RightColumn>
        ) : (
          <NavBar game={game} wide={false} />
        )}
      </div>
      <WallReport game={game} />
      <FinalVerdict game={game} />
      <Ending game={game} />
      <RotatePrompt />
    </GameLayout>
  )
}
