import type { PointerKind } from '../game/hit'
import type { SceneId } from '../game/types'

/**
 * One room or full-screen moment. The Game forwards the loop and input to the current
 * scene. Pointer positions are in design units.
 */
export interface Scene {
  readonly id: SceneId
  enter(): void
  exit(): void
  update(dtMs: number): void
  draw(ctx: CanvasRenderingContext2D, timeMs: number): void
  /** The one most useful hint for this scene right now, for the tip line. */
  tip(): string
  /** `timeMs` is the event's own `timeStamp`, for gestures. */
  onPress(x: number, y: number, pointer: PointerKind, timeMs: number): void
  onDrag(x: number, y: number, timeMs: number): void
  onRelease(x: number, y: number): void
  /** Space and other hold keys. `down` is false on release. */
  onKey(code: string, down: boolean): void
  /** Silences running loops while the run pauses; the next update restores them. */
  mute?(): void
}
