/**
 * Dev only: counts the memory held by every canvas the page made, for the M29 budget of
 * 100 MB on a phone. `trackCanvases` must run before the game starts, so `main.tsx` calls
 * it behind a DEV check.
 */

/** Canvases made since tracking started. Weak, so tracking never keeps one alive. */
const made: WeakRef<HTMLCanvasElement>[] = []

/** Records every canvas made through `document.createElement` from now on. */
export function trackCanvases(): void {
  const create = document.createElement.bind(document)
  document.createElement = ((tag: string, options?: ElementCreationOptions) => {
    const element = create(tag, options)
    if (element instanceof HTMLCanvasElement) made.push(new WeakRef(element))
    return element
  }) as typeof document.createElement
}

/** One size of canvas and how many of it are alive. */
export interface CanvasGroup {
  width: number
  height: number
  count: number
  mb: number
}

/**
 * The pixel memory of every canvas still alive, at 4 bytes a pixel, grouped by size,
 * biggest share first. Canvases freed to 0 x 0 count as nothing. A canvas dropped but
 * not yet garbage collected still counts, so this is an upper bound.
 */
export function canvasMemory(): {
  canvases: number
  mb: number
  groups: CanvasGroup[]
} {
  const alive = new Set<HTMLCanvasElement>(document.querySelectorAll('canvas'))
  for (let i = made.length - 1; i >= 0; i--) {
    const canvas = made[i]!.deref()
    if (canvas) alive.add(canvas)
    else made.splice(i, 1)
  }
  const groups = new Map<string, CanvasGroup>()
  let bytes = 0
  let canvases = 0
  for (const canvas of alive) {
    const size = canvas.width * canvas.height * 4
    if (size === 0) continue
    canvases++
    bytes += size
    const key = `${canvas.width}x${canvas.height}`
    const group = groups.get(key) ?? {
      width: canvas.width,
      height: canvas.height,
      count: 0,
      mb: 0
    }
    group.count++
    group.mb += size / 1e6
    groups.set(key, group)
  }
  return {
    canvases,
    mb: round(bytes / 1e6),
    groups: [...groups.values()]
      .map(g => ({ ...g, mb: round(g.mb) }))
      .sort((a, b) => b.mb - a.mb)
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
