import { useState } from 'react'

import type { Game } from '../scenes/game'
import { Button, isTouchDevice, Modal, SettingsPanel, toast } from '../shared'
import { GearIcon } from './icons'

/**
 * The settings button and its modal. A gear in the phone top bar, a labelled button in
 * the desktop column. The modal pauses the wall while it is open.
 */
export function SettingsButton({ game, wide }: { game: Game; wide: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        aria-label="Settings"
        onClick={() => setOpen(true)}
        className={wide ? 'w-full' : 'shrink-0'}
      >
        {wide ? 'Settings' : <GearIcon className="-mx-[11px] size-6" />}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Settings">
        <p className="mb-3 font-hand text-lg text-ink-soft">
          The wall waits while this is open.
        </p>
        <SettingsPanel
          assistHint="A slower hammer, wider green zones, a steadier tray, slower sagging and earlier alerts."
          extra={<RecalibrateTilt game={game} />}
        />
      </Modal>
    </>
  )
}

/** Treats the phone's current angle as level for the tray carry. */
function RecalibrateTilt({ game }: { game: Game }) {
  const available = game.motion?.available ?? false
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        disabled={!available}
        onClick={() => {
          game.motion?.calibrate()
          toast('Tilt reset. This angle counts as level now.', 'good')
        }}
      >
        Recalibrate Tilt
      </Button>
      <p className="text-base text-ink-soft">
        {available
          ? 'Hold the phone the way you play, then tap.'
          : isTouchDevice()
            ? 'Tilt is off. Slide your thumb to steer the tray.'
            : 'No tilt sensor found. The mouse and keys steer the tray.'}
      </p>
    </div>
  )
}
