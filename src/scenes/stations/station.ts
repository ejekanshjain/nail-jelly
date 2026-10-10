import type { PointerKind } from '../../game/hit'
import type { KitchenView } from '../../game/types'

/**
 * One kitchen station's close-up. The kitchen scene forwards the loop and input to the
 * open station. Positions are in design units. Each station creates its cached art in
 * `enter` and frees it in `exit`.
 */
export interface Station {
  readonly view: Exclude<KitchenView, 'overview'>
  readonly hasLayer: boolean
  enter(): void
  exit(): void
  update(dtMs: number): void
  draw(ctx: CanvasRenderingContext2D, timeMs: number): void
  /** `timeMs` is the event's own `timeStamp`, for gestures. */
  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void
  onDrag(x: number, y: number, timeMs: number): void
  onRelease(x: number, y: number): void
  onKey(code: string, down: boolean): void
  tip(): string
  /** Silences running loops while the run pauses; the next update restores them. */
  mute?(): void
}
