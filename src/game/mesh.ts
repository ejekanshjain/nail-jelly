import { MESH } from './tuning'

// Mesh Backing: before a block goes up, you cut its mesh sheet by tracing 4 dotted
// edges with the scissors. Wander off the line and the sheet comes out ragged, with half
// the help. Rush it and the mesh snaps back to the start of the edge.

/** One sheet being cut. Edges run clockwise from the top-left corner. */
export interface MeshCut {
  /** The sheet's 4 corners, clockwise from the top left, as flat design points. */
  corners: readonly number[]
  /** The edge being cut, 0 to 3. */
  edge: number
  /** How far along the current edge the scissors are. */
  progress: number
  /** Which edges came out ragged. */
  ragged: boolean[]
  /** A press holds the scissors. */
  tracing: boolean
  /** Progress when this press or corner began; the lead-in after it doesn't count. */
  leadFrom: number
  lastX: number
  lastY: number
  /** The speed window: when it started and the path drawn since. */
  windowMs: number
  windowPath: number
  /** Cut since the last snip sound. */
  snipPath: number
  done: boolean
}

/** What one move did, for sounds and captions. */
export type MeshEvent = 'snip' | 'ragged' | 'corner' | 'snap' | 'done'

/** How strict the cut is: tolerance and speed limit, in design units. */
export interface MeshLimits {
  tolerance: number
  speedLimit: number
}

/** A fresh sheet over the rectangle (x, y, width, height). */
export function createMeshCut(
  rect: readonly [number, number, number, number]
): MeshCut {
  const [x, y, w, h] = rect
  return {
    corners: [x, y, x + w, y, x + w, y + h, x, y + h],
    edge: 0,
    progress: 0,
    ragged: [false, false, false, false],
    tracing: false,
    leadFrom: 0,
    lastX: 0,
    lastY: 0,
    windowMs: 0,
    windowPath: 0,
    snipPath: 0,
    done: false
  }
}

/** One edge as a start point, unit direction and length. */
export interface MeshEdge {
  ax: number
  ay: number
  dx: number
  dy: number
  length: number
}

const EDGE: MeshEdge = { ax: 0, ay: 0, dx: 0, dy: 0, length: 0 }

/** Edge `index` of the sheet. Reuses `out`, so copy what you keep. */
export function meshEdge(
  cut: MeshCut,
  index: number,
  out: MeshEdge = EDGE
): MeshEdge {
  const c = cut.corners
  const a = (index % 4) * 2
  const b = ((index + 1) % 4) * 2
  out.ax = c[a]!
  out.ay = c[a + 1]!
  const vx = c[b]! - out.ax
  const vy = c[b + 1]! - out.ay
  out.length = Math.hypot(vx, vy)
  out.dx = vx / out.length
  out.dy = vy / out.length
  return out
}

/** Where the scissors sit: the current edge's start plus the progress. */
export function scissorsAt(
  cut: MeshCut,
  out: { x: number; y: number }
): { x: number; y: number } {
  const e = meshEdge(cut, Math.min(cut.edge, 3))
  const along = cut.done ? e.length : cut.progress
  out.x = e.ax + e.dx * along
  out.y = e.ay + e.dy * along
  return out
}

const SCISSORS = { x: 0, y: 0 }

/** A press within `grabRadius` of the scissors picks them up. Returns whether it did. */
export function grabMesh(
  cut: MeshCut,
  x: number,
  y: number,
  timeMs: number,
  grabRadius: number
): boolean {
  if (cut.done) return false
  const s = scissorsAt(cut, SCISSORS)
  if (Math.hypot(x - s.x, y - s.y) > grabRadius) return false
  cut.tracing = true
  cut.leadFrom = cut.progress
  cut.lastX = x
  cut.lastY = y
  cut.windowMs = timeMs
  cut.windowPath = 0
  return true
}

/** The press ended: the scissors stay where they are. */
export function releaseMesh(cut: MeshCut): void {
  cut.tracing = false
}

/**
 * Moves the held scissors towards (x, y) at event time `timeMs`. They cut along the
 * current edge as far as the finger has gone, turning corners as they reach them.
 */
export function dragMesh(
  cut: MeshCut,
  x: number,
  y: number,
  timeMs: number,
  limits: MeshLimits
): MeshEvent[] {
  if (!cut.tracing || cut.done) return []
  cut.windowPath += Math.hypot(x - cut.lastX, y - cut.lastY)
  cut.lastX = x
  cut.lastY = y
  const span = timeMs - cut.windowMs
  if (span >= MESH.speedWindowMs) {
    if ((cut.windowPath / span) * 1000 > limits.speedLimit) {
      // Too fast: the mesh springs back and you start this edge again.
      cut.progress = 0
      cut.ragged[cut.edge] = false
      cut.tracing = false
      cut.snipPath = 0
      return ['snap']
    }
    cut.windowMs = timeMs
    cut.windowPath = 0
  }
  const events: MeshEvent[] = []
  for (;;) {
    const e = meshEdge(cut, cut.edge)
    const rx = x - e.ax
    const ry = y - e.ay
    const along = rx * e.dx + ry * e.dy
    const off = Math.abs(ry * e.dx - rx * e.dy)
    // Off the line or jumping ahead: the scissors wait for you.
    if (off > MESH.snag || along > cut.progress + MESH.maxJump) break
    if (along <= cut.progress) break
    if (
      along - cut.leadFrom > MESH.leadIn &&
      off > limits.tolerance &&
      !cut.ragged[cut.edge]
    ) {
      cut.ragged[cut.edge] = true
      events.push('ragged')
    }
    const to = Math.min(along, e.length)
    cut.snipPath += to - cut.progress
    cut.progress = to
    if (cut.snipPath >= MESH.snipEvery) {
      cut.snipPath = 0
      events.push('snip')
    }
    if (cut.progress < e.length - MESH.endGap) break
    cut.edge++
    cut.progress = 0
    cut.leadFrom = 0
    if (cut.edge >= 4) {
      cut.edge = 3
      cut.done = true
      cut.tracing = false
      events.push('done')
      break
    }
    // The finger may already be past the corner, along the next edge.
    events.push('corner')
  }
  return events
}

/** The finished sheet's help: all of it, or half when any edge came out ragged. */
export function meshHelp(cut: MeshCut): number {
  return cut.ragged.some(Boolean) ? MESH.raggedHelp : 1
}

/** The tolerance for a cut: Assist widens it, and touch never asks for under a CSS minimum. */
export function meshTolerance(
  assist: boolean,
  touch: boolean,
  cssPerUnit: number
): number {
  const base = assist ? MESH.assistTolerance : MESH.tolerance
  return touch ? Math.max(base, MESH.touchTolerancePx / cssPerUnit) : base
}
