import { useState } from 'react'

import {
  GameLayout,
  isTouchDevice,
  StartScreen,
  type MotionPermission
} from './shared'
import { JellyDoodle } from './ui/icons'
import { Shell } from './ui/Shell'

/** Dev only: `?skip` jumps past the start screen and the cold open, for automation. */
const SKIP =
  import.meta.env.DEV && new URLSearchParams(location.search).has('skip')

/** The start screen, then the game. Nothing saves, so a reload starts here again. */
export function App() {
  const [motion, setMotion] = useState<MotionPermission | null>(
    SKIP ? 'unsupported' : null
  )
  if (motion === null)
    return (
      <GameLayout>
        <StartScreen
          title="Nail Jelly to a Wall"
          pitch="Nail 60 jellies to a wall. Keep them up for 60 seconds."
          story="Your uncle swears nobody can nail jelly to a wall. You bet him your car."
          motion
          buttonLabel={isTouchDevice() ? 'Tap to Start' : 'Click to Start'}
          onStart={info => setMotion(info.motion)}
        >
          <JellyDoodle className="h-20 animate-[wobble_1.8s_ease-in-out_infinite]" />
          <p className="font-hand text-lg text-ink-soft">
            Nothing saves. Closing the tab starts you over.
          </p>
        </StartScreen>
      </GameLayout>
    )
  return <Shell motion={motion !== 'denied'} skipColdOpen={SKIP} />
}
