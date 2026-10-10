import { describe, expect, it } from 'vitest'

import {
  createMeshCut,
  dragMesh,
  grabMesh,
  meshEdge,
  meshHelp,
  meshTolerance,
  type MeshCut,
  type MeshEvent,
  type MeshLimits
} from './mesh'
import { MESH } from './tuning'

const LIMITS: MeshLimits = {
  tolerance: MESH.tolerance,
  speedLimit: MESH.speedLimit
}

/**
 * Traces edges from where the scissors sit at `speed` units per second, sampling every
 * 16 ms. `offset(edge)` pushes the finger that far off the line, to the outside.
 */
function trace(
  cut: MeshCut,
  speed: number,
  offset: (edge: number) => number = () => 0,
  limits = LIMITS
): MeshEvent[] {
  const events: MeshEvent[] = []
  let t = 1000
  const e = meshEdge(cut, cut.edge)
  expect(
    grabMesh(cut, e.ax + e.dx * cut.progress, e.ay + e.dy * cut.progress, t, 40)
  ).toBe(true)
  while (cut.tracing) {
    const edge = meshEdge(cut, cut.edge)
    const along = Math.min(edge.length + 4, cut.progress + speed * 0.016)
    // Outward normal for a clockwise sheet: rotate the direction a quarter turn left.
    const off = offset(cut.edge)
    const x = edge.ax + edge.dx * along + edge.dy * off
    const y = edge.ay + edge.dy * along - edge.dx * off
    t += 16
    events.push(...dragMesh(cut, x, y, t, limits))
    if (t > 60_000) throw new Error('trace never finished')
  }
  return events
}

describe('cutting mesh', () => {
  it('cuts a clean sheet with 4 slow edges', () => {
    const cut = createMeshCut(MESH.sheet)
    const events = trace(cut, 300)
    expect(cut.done).toBe(true)
    expect(events.filter(e => e === 'corner')).toHaveLength(3)
    expect(events.at(-1)).toBe('done')
    expect(events).not.toContain('ragged')
    expect(meshHelp(cut)).toBe(1)
  })

  it('leaves a ragged sheet with half the help when an edge strays', () => {
    const cut = createMeshCut(MESH.sheet)
    const events = trace(cut, 300, edge => (edge === 2 ? 20 : 0))
    expect(cut.done).toBe(true)
    expect(events.filter(e => e === 'ragged')).toHaveLength(1)
    expect(cut.ragged).toEqual([false, false, true, false])
    expect(meshHelp(cut)).toBe(MESH.raggedHelp)
  })

  it('allows the wider Assist tolerance', () => {
    const strict = createMeshCut(MESH.sheet)
    trace(strict, 300, () => 15)
    expect(meshHelp(strict)).toBe(MESH.raggedHelp)
    const assist = createMeshCut(MESH.sheet)
    trace(assist, 300, () => 15, {
      ...LIMITS,
      tolerance: meshTolerance(true, false, 1)
    })
    expect(meshHelp(assist)).toBe(1)
  })

  it('snaps the edge back to its start when traced too fast', () => {
    const cut = createMeshCut(MESH.sheet)
    const events = trace(cut, 900)
    expect(events.at(-1)).toBe('snap')
    expect(cut.done).toBe(false)
    expect(cut.edge).toBe(0)
    expect(cut.progress).toBe(0)
    expect(cut.tracing).toBe(false)
  })

  it('keeps finished edges after a snap on a later one', () => {
    const cut = createMeshCut(MESH.sheet)
    cut.edge = 2
    expect(trace(cut, 1200).at(-1)).toBe('snap')
    expect(cut.edge).toBe(2)
  })

  it('ignores a landing just off the line, but not a whole edge off it', () => {
    const cut = createMeshCut(MESH.sheet)
    // Grab 14 units below the scissors, then slide onto the line.
    expect(grabMesh(cut, MESH.sheet[0], MESH.sheet[1] + 14, 0, 40)).toBe(true)
    let t = 0
    for (let i = 1; i <= 10; i++) {
      t += 16
      dragMesh(
        cut,
        MESH.sheet[0] + i * 1.5,
        MESH.sheet[1] + 14 - i * 1.4,
        t,
        LIMITS
      )
    }
    expect(cut.ragged[0]).toBe(false)
    expect(cut.progress).toBeGreaterThan(10)
  })

  it("won't skip ahead along the edge or follow a finger far off it", () => {
    const cut = createMeshCut(MESH.sheet)
    const [x, y] = MESH.sheet
    grabMesh(cut, x, y, 0, 40)
    dragMesh(cut, x + 200, y, 400, LIMITS)
    expect(cut.progress).toBe(0)
    dragMesh(cut, x + 20, y + 80, 800, LIMITS)
    expect(cut.progress).toBe(0)
  })

  it('needs a press near the scissors', () => {
    const cut = createMeshCut(MESH.sheet)
    expect(grabMesh(cut, MESH.sheet[0] + 100, MESH.sheet[1], 0, 40)).toBe(false)
  })

  it('gives touch a tolerance of at least 10 CSS px', () => {
    expect(meshTolerance(false, false, 0.65)).toBe(MESH.tolerance)
    expect(meshTolerance(false, true, 0.65)).toBeCloseTo(10 / 0.65)
    expect(meshTolerance(false, true, 1)).toBe(MESH.tolerance)
  })
})
