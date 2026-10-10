import type { Rng } from '../shared'

/** A standard normal sample (Box-Muller), for the boil's heat noise and the tray's drift. */
export function gaussian(random: Rng): number {
  const u = Math.max(random(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}
