import type { RealTimer } from '../shared'
import { HIDDEN_CATCH_UP_MS } from './tuning'

/** A wall-clock wait pushed later by a pause, so pausing never runs a wait down. */
export function shiftTimer(timer: RealTimer, pausedMs: number): RealTimer {
  return {
    ...timer,
    startedAt: timer.startedAt + pausedMs,
    endsAt: timer.endsAt + pausedMs
  }
}

/** How much of a hidden span turns into grip loss: all of it, up to the cap. */
export function hiddenCatchUpMs(hiddenMs: number): number {
  return Math.min(Math.max(hiddenMs, 0), HIDDEN_CATCH_UP_MS)
}

/**
 * Wall-clock bookkeeping for the two kinds of pause. A dialog or the rotate prompt
 * freezes the wall, and its length later pushes the waits back. A hidden tab also
 * freezes the wall, because browsers stop animation frames, so its length later
 * becomes grip loss instead. Time hidden behind an open dialog counts as dialog time.
 */
export class PauseClock {
  private pausedAt: number | null = null
  private hiddenAt: number | null = null

  get paused(): boolean {
    return this.pausedAt !== null
  }

  /**
   * Call once per step with whether something blocks play. Returns how long the pause
   * lasted on the step it ends, otherwise 0.
   */
  step(blocked: boolean, at: number): number {
    if (blocked) {
      this.pausedAt ??= at
      this.hiddenAt = null
      return 0
    }
    if (this.pausedAt === null) return 0
    const pausedMs = at - this.pausedAt
    this.pausedAt = null
    return pausedMs
  }

  /** The tab went into the background. */
  hide(at: number): void {
    if (this.pausedAt === null) this.hiddenAt = at
  }

  /** The tab came back. Returns the grip-loss time to apply, already capped. */
  show(at: number): number {
    if (this.hiddenAt === null) return 0
    const hiddenMs = at - this.hiddenAt
    this.hiddenAt = null
    return hiddenCatchUpMs(hiddenMs)
  }
}
