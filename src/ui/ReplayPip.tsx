import { useState } from 'react'

import type { ReplayInfo } from '../game/hud'
import { PIP_SLOT, REPLAY } from '../game/tuning'
import type { Game } from '../scenes/game'
import {
  cn,
  Modal,
  ReplayPlayer,
  ShareCardButton,
  useStore,
  type ShareCardInput
} from '../shared'
import { slotStyle } from './slot'

/**
 * The latest splat replay: it plays once in slow motion and hides. Tap it to watch it
 * loop large with its blame line and a Share This Splat button. Phones show it over the
 * design's replay corner; desktop shows it in the right column.
 */
export function ReplayPip({ game, wide }: { game: Game; wide: boolean }) {
  const replay = useStore(game.hud, s => s.replay)
  const visiting = useStore(game.hud, s => s.phase === 'final')
  const layout = useStore(game.layout)
  const [doneId, setDoneId] = useState(0)
  const [open, setOpen] = useState<ReplayInfo | null>(null)
  // The It Fell dialog already replays a fall during the uncle's visit, so the corner
  // counts it as watched and never plays it behind the dialog.
  if (visiting && replay && replay.id !== doneId) setDoneId(replay.id)
  return (
    <>
      {replay && replay.id !== doneId && (
        <button
          type="button"
          onClick={() => setOpen(replay)}
          aria-label={`Replay: ${replay.label} ${replay.blame} Open it to watch again and share.`}
          className={cn(
            'pointer-events-auto block animate-pop-in text-left',
            !wide && 'absolute'
          )}
          style={wide ? undefined : slotStyle(layout, PIP_SLOT)}
        >
          <ReplayPlayer
            key={replay.id}
            clip={replay.clip}
            speed={REPLAY.speed}
            onDone={() => setDoneId(replay.id)}
            className="border-2"
          />
          <span
            className={cn(
              'block truncate font-marker text-ink [text-shadow:0_0_4px_var(--color-paper)]',
              wide ? 'mt-1 text-lg' : 'absolute inset-x-1 bottom-1 text-xs'
            )}
          >
            {replay.label}
          </span>
        </button>
      )}
      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Splat Replay"
        footer={
          open && (
            <ShareCardButton
              card={splatCard(open)}
              text={`${open.label} ${open.blame} #NailJellyToAWall`}
              label="Share This Splat"
            />
          )
        }
      >
        {open && (
          <>
            <ReplayPlayer
              clip={open.clip}
              speed={REPLAY.speed}
              label={open.label}
              loop
            />
            <p className="mt-3 text-center font-hand text-xl leading-snug">
              {open.blame}
            </p>
          </>
        )}
      </Modal>
    </>
  )
}

/** The splat share card: the caption, the mid-fall picture and 4 stats. */
function splatCard(replay: ReplayInfo): ShareCardInput {
  return {
    game: 'Nail Jelly to a Wall',
    title: replay.label,
    stats: replay.stats,
    image: replay.picture ?? undefined,
    footer: replay.blame
  }
}
