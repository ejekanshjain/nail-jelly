import { useCallback, useSyncExternalStore } from 'react'

/** Desktop landscape screens get side columns; everything else stacks the HUD. */
const WIDE_QUERY = '(min-width: 900px) and (orientation: landscape)'
/**
 * Phones held sideways get the rotate prompt. A touch screen only, the same test as the
 * shared `isTouchDevice`, so a short desktop window keeps playing with the mouse.
 */
const SIDEWAYS_PHONE_QUERY =
  '(orientation: landscape) and (max-height: 500px) and (hover: none) and (pointer: coarse)'

/** True while a CSS media query matches. Re-renders only when that changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false
  )
}

/** True while the side-column layout applies. */
export function useWideLayout(): boolean {
  return useMediaQuery(WIDE_QUERY)
}

/** True while a phone is held sideways. */
export function useSidewaysPhone(): boolean {
  return useMediaQuery(SIDEWAYS_PHONE_QUERY)
}
