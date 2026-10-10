import { useEffect } from 'react'

import { blockGameInput } from '../shared'
import { PhoneIcon } from './icons'
import { useSidewaysPhone } from './media'

/**
 * Covers the game while a phone is held sideways. It blocks game input, which pauses
 * the wall, so turning the phone never costs a block.
 */
export function RotatePrompt() {
  const sideways = useSidewaysPhone()
  useEffect(() => (sideways ? blockGameInput() : undefined), [sideways])
  if (!sideways) return null
  return (
    <div
      role="alert"
      className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-paper p-6 text-center text-ink"
    >
      <PhoneIcon className="size-20 animate-wobble" />
      <h2 className="font-marker text-3xl">Turn Your Phone Upright</h2>
      <p className="font-hand text-xl">The wall waits for you.</p>
    </div>
  )
}
