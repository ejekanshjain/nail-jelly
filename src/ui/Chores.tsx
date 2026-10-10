import { useState } from 'react'

import { choreRoom, CHORES } from '../game/chores'
import type { Game } from '../scenes/game'
import { Button, ChoreList, Modal, useChores } from '../shared'
import { ClipboardIcon } from './icons'

/**
 * Walks to the room where a chore gets done. Mopping under the wall also frames the
 * floor, which the upper sections' view leaves off screen.
 */
function goToChore(game: Game, id: string): void {
  const room = choreRoom(id)
  if (room) game.goto(room)
  if (id === CHORES.mopWall.id) game.showFloor()
}

/**
 * The phone top bar's chores button, opening the list in a modal. It stays 48 px wide;
 * the open count sits inside its top-right corner as a badge.
 */
export function ChoresButton({ game }: { game: Game }) {
  const chores = useChores(game.chores)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        aria-label={`Chores: ${chores.length} open`}
        onClick={() => setOpen(true)}
        className="relative shrink-0"
      >
        <ClipboardIcon className="-mx-[11px] size-6" />
        {chores.length > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-marker-red px-1 text-center text-xs leading-4 text-white">
            {chores.length}
          </span>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Chores">
        <ChoreList
          board={game.chores}
          title=""
          onSelect={chore => {
            setOpen(false)
            goToChore(game, chore.id)
          }}
        />
      </Modal>
    </>
  )
}

/** The desktop left column's chore list. Tapping a chore walks to its room. */
export function ChoresPanel({ game }: { game: Game }) {
  return (
    <ChoreList
      board={game.chores}
      onSelect={chore => goToChore(game, chore.id)}
    />
  )
}
