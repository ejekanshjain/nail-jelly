import type { CSSProperties } from 'react'

import type { LayoutSnapshot } from '../game/hud'

/** CSS position for a React element covering a design rectangle (x, y, width, height). */
export function slotStyle(
  layout: LayoutSnapshot,
  [x, y, width, height]: readonly [number, number, number, number]
): CSSProperties {
  return {
    left: layout.offsetX + x * layout.scale,
    top: layout.offsetY + y * layout.scale,
    width: width * layout.scale,
    height: height * layout.scale
  }
}
