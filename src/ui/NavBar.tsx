import { roomStatus, ROOMS } from '../game/rooms'
import type { Game } from '../scenes/game'
import { Button, cn, isTouchDevice, LiveText, useStore } from '../shared'

/**
 * The room buttons: a bottom bar on phones, a column on desktop. Each button shows a
 * live status line, and its number key in the desktop column. The Wall button turns red
 * and pulses while you are away and a nail is past its red line. While you carry a tray
 * down the hallway, Go Back replaces them all.
 */
export function NavBar({ game, wide }: { game: Game; wide: boolean }) {
  const scene = useStore(game.hud, s => s.scene)
  const sagging = useStore(game.hud, s => s.sagging > 0)
  const playing = useStore(game.hud, s => s.phase === 'play')
  const carrying = useStore(game.hud, s => s.carrying)
  // The phone bar has no room for key hints; the keys still work there.
  const showKeys = wide && !isTouchDevice()
  if (carrying)
    return (
      <nav
        aria-label="Rooms"
        className={cn('flex', wide ? 'flex-col' : 'h-16 shrink-0 px-1.5 py-1')}
      >
        <Button
          variant="ghost"
          aria-keyshortcuts="Escape"
          onClick={() => game.goBack()}
          className={cn(
            'flex-col gap-0 leading-none',
            wide ? 'min-h-16 w-full' : 'h-14 w-full'
          )}
        >
          <span className="flex items-baseline gap-1.5">
            Go Back
            {showKeys && (
              <kbd className="font-hand text-sm opacity-70">Esc</kbd>
            )}
          </span>
          <span className="font-hand text-sm">The tray stays safe</span>
        </Button>
      </nav>
    )
  return (
    <nav
      aria-label="Rooms"
      className={cn(
        'flex',
        wide ? 'flex-col gap-3' : 'h-16 shrink-0 items-center gap-1.5 px-1.5'
      )}
    >
      {ROOMS.map(room => {
        const here = room.id === scene
        const alarm = room.id === 'wall' && sagging && !here
        return (
          <Button
            key={room.id}
            variant={alarm ? 'danger' : here ? 'primary' : 'ghost'}
            aria-current={here ? 'page' : undefined}
            aria-keyshortcuts={room.key}
            disabled={!playing}
            onClick={() => game.goto(room.id)}
            className={cn(
              'flex-col gap-0 px-1 leading-none',
              wide ? 'min-h-16 w-full' : 'h-14 min-w-0 flex-1',
              alarm && 'animate-pulse'
            )}
          >
            <span
              className={cn(
                'flex items-baseline gap-1.5',
                !wide && 'text-[15px]'
              )}
            >
              {room.label}
              {showKeys && (
                <kbd className="font-hand text-sm opacity-70">{room.key}</kbd>
              )}
            </span>
            <LiveText
              read={() => roomStatus(game.state, room.id)}
              className="min-h-4 font-hand text-sm leading-4 whitespace-nowrap"
            />
          </Button>
        )
      })}
    </nav>
  )
}
