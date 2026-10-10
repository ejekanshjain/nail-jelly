import type { EndingInfo } from '../game/hud'
import { REPLAY } from '../game/tuning'
import type { Game } from '../scenes/game'
import {
  EndingScreen,
  ReplayPlayer,
  useStore,
  type ShareCardInput
} from '../shared'
import { CarKeysIcon } from './icons'

/**
 * The ending: the whole wall coming down in slow motion with how long it held, the car
 * keys, the run's stats, a share card and Play Again.
 */
export function Ending({ game }: { game: Game }) {
  const ending = useStore(game.hud, s => s.ending)
  if (!ending) return null
  return (
    <EndingScreen
      title="Uncle's Car Is Yours"
      stats={ending.stats}
      share={{
        card: endingCard(ending),
        text: `I nailed 60 jellies to a wall. ${ending.label} #NailJellyToAWall`,
        // You won his car: the share dialog isn't about shame this time.
        title: 'Rub It In'
      }}
    >
      {ending.clip && (
        <ReplayPlayer
          clip={ending.clip}
          speed={REPLAY.speed}
          label={ending.label}
          loop
          // At most 40% of the screen tall (the clip is 4:3), so the whole screen fits
          // on a 1280 x 800 laptop.
          className="mx-auto max-w-[53dvh]"
        />
      )}
      <p className="mt-3 flex items-center justify-center gap-2">
        <CarKeysIcon className="size-12 shrink-0" />
        <span>
          He handed over his keys, walked out, and slammed the door. All 60 came
          down anyway.
        </span>
      </p>
    </EndingScreen>
  )
}

/** The ending's share card: the caption, the wall mid-collapse and the run's stats. */
function endingCard(ending: EndingInfo): ShareCardInput {
  return {
    game: 'Nail Jelly to a Wall',
    title: ending.label,
    stats: ending.stats,
    image: ending.picture ?? undefined,
    footer: 'Sixty blocks. Sixty seconds. One door.'
  }
}
