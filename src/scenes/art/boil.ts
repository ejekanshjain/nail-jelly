import { boilSeed, type SketchStyle } from '../../shared'

/**
 * Line boil for a character drawn every frame: returns a function that moves each
 * style's seed on from where it started, 6 times a second, so the outlines wobble
 * alive. Call it with the render time before drawing. Reduced Motion holds it still.
 * Cached art never boils.
 */
export function makeBoil(
  styles: readonly SketchStyle[]
): (timeMs: number) => void {
  const bases = styles.map(style => style.seed ?? 1)
  return timeMs => {
    const boil = boilSeed(timeMs) * 7
    for (let i = 0; i < styles.length; i++) styles[i]!.seed = bases[i]! + boil
  }
}
