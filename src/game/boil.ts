import type { Rng } from '../shared'
import { gaussian } from './noise'
import { BOIL } from './tuning'

/** The green zone on the heat dial. */
export interface Zone {
  from: number
  to: number
}

/** The green zone, wider in Assist Mode. */
export function greenZone(assist: boolean): Zone {
  return assist
    ? { from: BOIL.assistGreenFrom, to: BOIL.assistGreenTo }
    : { from: BOIL.greenFrom, to: BOIL.greenTo }
}

/** The boil owns its heat number. Holding heats, letting go cools, noise and bubbles nudge. */
export interface Boil {
  heat: number
  /** Time spent inside the green zone. */
  greenMs: number
  /** Time since the heat first reached the green, or 0 before that. */
  sinceGreenMs: number
  enteredGreen: boolean
  /** Time above the burn line in a row. */
  overMs: number
  noiseInMs: number
  bubbleInMs: number
  done: boolean
  burnt: boolean
}

export function createBoil(): Boil {
  return {
    heat: 0,
    greenMs: 0,
    sinceGreenMs: 0,
    enteredGreen: false,
    overMs: 0,
    noiseInMs: BOIL.noiseEveryMs,
    bubbleInMs: BOIL.bubbleMinMs,
    done: false,
    burnt: false
  }
}

/** What one step of the boil did, for sounds and captions. */
export type BoilEvent = 'bubble' | 'done' | 'burn' | null

export interface BoilStepOptions {
  zone: Zone
  random: Rng
  /** Spread of the heat noise. Tests pass 0 for a clean curve. */
  noise?: number
}

/**
 * Advances the boil by `dtMs` with the hob held or not. It finishes after 8s in the green
 * and burns after 1s in a row above 0.9. Both end the boil; check `done` and `burnt`.
 */
export function stepBoil(
  boil: Boil,
  dtMs: number,
  holding: boolean,
  { zone, random, noise = BOIL.noise }: BoilStepOptions
): BoilEvent {
  if (boil.done || boil.burnt) return null
  let event: BoilEvent = null
  boil.heat += holding ? dtMs / BOIL.riseMs : -dtMs / BOIL.drainMs
  boil.noiseInMs -= dtMs
  if (boil.noiseInMs <= 0) {
    boil.noiseInMs += BOIL.noiseEveryMs
    boil.heat += gaussian(random) * noise
  }
  if (boil.heat > BOIL.bubbleAbove) {
    boil.bubbleInMs -= dtMs
    if (boil.bubbleInMs <= 0) {
      boil.bubbleInMs =
        BOIL.bubbleMinMs + random() * (BOIL.bubbleMaxMs - BOIL.bubbleMinMs)
      boil.heat += BOIL.bubble
      event = 'bubble'
    }
  }
  boil.heat = Math.min(1, Math.max(0, boil.heat))

  const green = boil.heat >= zone.from && boil.heat <= zone.to
  if (green) boil.enteredGreen = true
  if (boil.enteredGreen) boil.sinceGreenMs += dtMs
  if (green) boil.greenMs += dtMs

  boil.overMs = boil.heat > BOIL.burnAbove ? boil.overMs + dtMs : 0
  // A small epsilon keeps 60 steps of 16.67 ms from falling a hair short of 1000 ms.
  if (boil.overMs >= BOIL.burnMs - 1e-6) {
    boil.burnt = true
    return 'burn'
  }
  if (boil.greenMs >= BOIL.doneMs - 1e-6) {
    boil.done = true
    return 'done'
  }
  return event
}

/** Time in the green over time since first reaching it, 0 to 1. */
export function boilAccuracy(boil: Boil): number {
  return boil.sinceGreenMs > 0 ? boil.greenMs / boil.sinceGreenMs : 0
}
