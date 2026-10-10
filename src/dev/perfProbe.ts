import type { Game } from '../scenes/game'
import { commits } from './commits'

/** Milliseconds across a probe's samples, and the steps of the 3 slowest. */
export interface Spread {
  mean: number
  p95: number
  max: number
  worstSteps: number[]
}

/** What one probe measured, unthrottled. Multiply by 4 for a 4x CPU throttle. */
export interface ProbeReport {
  steps: number
  /** Matter and proxy updates, per 60 Hz step. */
  physicsMs: Spread
  /** The whole update step, physics included. */
  updateMs: Spread
  /** The scene's drawing per frame, without the replay recorder. */
  drawMs: Spread
  /** The replay recorder's frames, one every third step. */
  recordMs: Spread
  /** The most soft bodies alive at once. */
  maxBodies: number
  /** Soft bodies and splats at each of the slowest steps, as `step: bodies/splats`. */
  around: Record<number, string>
  /** Times the HUD store told React something changed. */
  hudChanges: number
  /** React commits while the probe ran. */
  commits: number
}

/**
 * Dev only: runs `steps` loop steps, rendering after each, and times the physics, the
 * drawing and the recorder separately. It yields after every step, so React commits
 * whatever the HUD published, as it would between real frames.
 */
export async function perfProbe(game: Game, steps = 120): Promise<ProbeReport> {
  const loop = window.__game?.loop as { step(n: number): void } | undefined
  if (!loop)
    throw new Error('perfProbe: the dev loop is missing, so nothing can step')
  const physics: number[] = []
  const updates: number[] = []
  const draw: number[] = []
  /** Recorder samples, and the step each one came from. */
  const record: number[] = []
  const recordSteps: number[] = []
  let stepPhysics = 0
  let captureMs = 0
  let maxBodies = 0
  let hudChanges = 0
  const marks: string[] = []

  const { wall, proxies, recorder } = game
  const wallUpdate = wall.update
  const proxyUpdate = proxies.update
  const render = game.render
  const update = game.update
  const capture = recorder.capture
  wall.update = dt => {
    const t = performance.now()
    wallUpdate.call(wall, dt)
    stepPhysics += performance.now() - t
  }
  proxies.update = dt => {
    const t = performance.now()
    proxyUpdate.call(proxies, dt)
    stepPhysics += performance.now() - t
  }
  recorder.capture = timeMs => {
    const t = performance.now()
    const took = capture.call(recorder, timeMs)
    captureMs = performance.now() - t
    if (took) {
      record.push(captureMs)
      recordSteps.push(draw.length)
    }
    return took
  }
  game.update = dt => {
    const t = performance.now()
    update.call(game, dt)
    updates.push(performance.now() - t)
  }
  game.render = timeMs => {
    captureMs = 0
    const t = performance.now()
    render.call(game, timeMs)
    draw.push(performance.now() - t - captureMs)
  }
  const unsubscribe = game.hud.subscribe(() => hudChanges++)
  const commitsBefore = commits.count
  try {
    for (let i = 0; i < steps; i++) {
      stepPhysics = 0
      loop.step(1)
      physics.push(stepPhysics)
      maxBodies = Math.max(maxBodies, wall.liveCount)
      marks.push(`${wall.liveCount}/${game.state.splats.length}`)
      await yieldToReact()
    }
  } finally {
    // Deleting the own properties brings the class methods back.
    delete (wall as Partial<typeof wall>).update
    delete (proxies as Partial<typeof proxies>).update
    delete (recorder as Partial<typeof recorder>).capture
    delete (game as Partial<Game>).render
    delete (game as Partial<Game>).update
    unsubscribe()
  }
  const report = {
    physicsMs: spread(physics),
    updateMs: spread(updates),
    drawMs: spread(draw),
    recordMs: spread(record, recordSteps)
  }
  const around: Record<number, string> = {}
  for (const spreadOf of Object.values(report))
    for (const step of spreadOf.worstSteps) around[step] = marks[step] ?? ''
  return {
    steps,
    ...report,
    around,
    maxBodies,
    hudChanges,
    commits: commits.count - commitsBefore
  }
}

/** A macrotask that background tabs don't throttle, so React flushes its updates. */
function yieldToReact(): Promise<void> {
  return new Promise(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(0)
  })
}

/** Summarises samples; `steps` names the step of each sample, by default its index. */
function spread(samples: number[], steps?: number[]): Spread {
  if (samples.length === 0) return { mean: 0, p95: 0, max: 0, worstSteps: [] }
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = samples.reduce((sum, s) => sum + s, 0) / samples.length
  const worst = samples
    .map((ms, i) => ({ ms, step: steps?.[i] ?? i }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
  return {
    mean: round(mean),
    p95: round(sorted[Math.floor(sorted.length * 0.95)] ?? sorted.at(-1)!),
    max: round(sorted.at(-1)!),
    worstSteps: worst.map(w => w.step)
  }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100
}
