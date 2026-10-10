import type { Game } from '../scenes/game'
import { cn, useStore } from '../shared'

/** The tip needs this much room above the design, in CSS px, to sit clear of it. */
const ROOM_ABOVE = 36

/**
 * The current hint on phones, over the canvas box. It sits in the spare strip above the
 * design when the screen has one. On short screens it covers the design's top band,
 * which every scene keeps for art, in smaller words so it reaches less far down. Taps
 * pass through it either way.
 */
export function TipBubble({ game }: { game: Game }) {
  const tip = useStore(game.hud, s => s.tip)
  const offsetY = useStore(game.layout, s => s.offsetY)
  if (!tip) return null
  const clear = offsetY >= ROOM_ABOVE
  return (
    <p
      aria-live="polite"
      className={cn(
        'absolute inset-x-2 mx-auto line-clamp-2 max-w-md rounded-sketch border-2 border-ink/60 bg-paper/90 px-3 py-0.5 text-center font-hand leading-tight',
        clear ? 'text-base' : 'text-sm'
      )}
      style={{ top: clear ? Math.max(2, offsetY - ROOM_ABOVE - 2) : 2 }}
    >
      {tip}
    </p>
  )
}
