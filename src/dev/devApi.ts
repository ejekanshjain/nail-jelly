import Matter from 'matter-js'

import type { EventKind } from '../game/events'
import { pickTarget } from '../game/hit'
import {
  finishBoil,
  finishStir,
  pourTray,
  startFreshBatch
} from '../game/kitchen'
import { scissorsAt } from '../game/mesh'
import { noodlesDrained, noodlesReady, startNoodles } from '../game/noodles'
import type { RoomId } from '../game/rooms'
import { UPGRADES, type UpgradeId } from '../game/upgrades'
import { allLocked, lockSection, upCount } from '../game/section'
import { toDesign } from '../game/sim/camera'
import { cellCentre } from '../game/sim/geometry'
import type { KitchenView } from '../game/types'
import type { HitOutcome } from '../game/sim/wallSim'
import { addSplat } from '../game/mess'
import { blockWarningLines } from '../game/warnings'
import { AVERAGE_PACE, paceReport, UNSKILLED_PACE } from '../game/pacing'
import { inputsForQuality } from '../game/quality'
import { addStoolBlock, FLAVOURS } from '../game/state'
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  FINAL,
  FLOOR_Y,
  SECTION_CELLS,
  SECTION_COUNT,
  STOOL_LEFT,
  STOOL_SLOT_W,
  STOOL_SLOTS,
  STOOL_TOP
} from '../game/tuning'
import type { Game } from '../scenes/game'
import { BowlStation } from '../scenes/stations/bowl'
import { MouldsStation } from '../scenes/stations/moulds'
import { StoveStation } from '../scenes/stations/stove'
import { endSession, exposeDev, now, type DevAction } from '../shared'
import { canvasMemory } from './canvasMemory'
import { commits } from './commits'
import { fakeSafeArea, layoutCheck } from './layoutCheck'
import { layoutTour } from './layoutTour'
import { perfProbe } from './perfProbe'

const STEP = 1000 / 60
let trayCount = 0

/**
 * Installs `window.__game.jelly`, the scripting API browser automation uses, and returns
 * the dev panel actions. Dev builds only: the Shell imports this behind a DEV check.
 */
export function installDevApi(game: Game): {
  actions: DevAction[]
  dispose: () => void
} {
  const { state, wall, economy } = game

  /** Client (CSS px) position of a design point, for dispatching pointer events. */
  const designToClient = (x: number, y: number) => {
    const viewport = game.viewport
    if (!viewport?.canvas) return { x: 0, y: 0 }
    const rect = viewport.canvas.getBoundingClientRect()
    return {
      x: rect.left + viewport.offsetX + x * viewport.scale,
      y: rect.top + viewport.offsetY + y * viewport.scale
    }
  }
  const toClient = (worldX: number, worldY: number) => {
    const p = toDesign(game.camera, worldX, worldY)
    return designToClient(p.x, p.y)
  }

  /** Puts blocks on the stool: `count` at one quality, or one per quality in a list. */
  const readyTray = (count = 4, quality: number | number[] = 0.83) => {
    const flavour = FLAVOURS[trayCount++ % FLAVOURS.length]!
    const qualities = Array.isArray(quality)
      ? quality
      : Array<number>(count).fill(quality)
    for (const q of qualities) addStoolBlock(state, q, flavour)
  }

  /** Puts nailed blocks (two sweet nails each) in every empty cell of the active section. */
  const fillSection = (quality = 0.85) => {
    const section = state.sections[state.section]
    if (!section || section.locked || wall.handBlock !== null) return
    section.cells.forEach((cell, index) => {
      if (cell.block !== null) return
      const block = addStoolBlock(
        state,
        quality,
        FLAVOURS[index % FLAVOURS.length]!
      )
      wall.place(block.id, index)
      wall.hammer(block.id, 0, 0.69)
      wall.hammer(block.id, 3, 0.69)
    })
  }

  /** Hits at a world point: re-hammers a nail in range, otherwise nails the nearest particle. */
  const hit = (
    blockId: number,
    x: number,
    y: number,
    charge: number
  ): HitOutcome | null => {
    const block = state.blocks.get(blockId)
    const body = wall.bodyOf(blockId)
    if (!block || !body) return null
    const target = pickTarget({
      x,
      y,
      cssPerUnit: (game.viewport?.scale ?? 1) * game.camera.zoom,
      pointer: 'mouse',
      nails: block.fixings.map(f => ({
        blockId,
        fixingId: f.id,
        x: f.x,
        y: f.y
      })),
      jelly: body.soft.bodies.map((p, particle) => ({
        blockId,
        particle,
        x: p.position.x,
        y: p.position.y
      }))
    })
    if (target.kind === 'nail')
      return wall.rehammer(blockId, target.fixingId, charge)
    if (target.kind === 'jelly') {
      economy.stock.use('nails')
      state.stats.nailsUsed++
      return wall.hammer(blockId, target.particle, charge)
    }
    return null
  }

  /** Puts a set tray in your hands, as if you just took it out of the fridge. */
  const handTray = (count = 4, quality = 0.83) => {
    const make = inputsForQuality(quality)
    state.tray = {
      flavour: FLAVOURS[trayCount++ % FLAVOURS.length]!,
      recycled: false,
      location: 'hand',
      moulds: Array.from({ length: count }, () => ({ q: quality, make }))
    }
    state.fridge = null
  }

  /** Pays for an upgrade with dev coins and buys it, so its setup runs. */
  const giveUpgrade = (id: UpgradeId) => {
    const upgrade = economy.upgrades.get(id)
    if (economy.upgrades.owned(id)) return false
    economy.wallet.earn(upgrade.cost, 'Dev')
    if (!economy.upgrades.buy(id).ok) return false
    game.upgraded(upgrade)
    return true
  }

  /** Scores a dev-finished station uses unless you pass your own. */
  interface BatchScores {
    boil: number
    stir: number
    pour: number
    /** How clean the bowl was for the stir. */
    bowl: number
  }
  /**
   * Finishes whatever station the batch is at: the boil, the stir, or the pour into an
   * empty tray. Returns the stage it finished, or null when nothing was waiting.
   */
  const completeStation = (scores: Partial<BatchScores> = {}) => {
    const mix = state.mix
    if (!mix) return null
    const stage = mix.stage
    if (stage === 'boil') finishBoil(mix, scores.boil ?? 0.75)
    else if (stage === 'stir')
      finishStir(state, scores.stir ?? 0.8, state.simMs, scores.bowl)
    else {
      // The pour needs drained noodles: dev drains them perfectly.
      if (mix.noodles !== null && !noodlesDrained(mix.noodles)) {
        mix.noodles = 'good'
        state.noodles = null
      }
      if (!pourTray(state, Array(mix.moulds).fill(scores.pour ?? 0.8)))
        return null
    }
    return stage
  }

  /** Makes the fridge and the noodles finish now. */
  const finishWaits = () => {
    const fridge = state.fridge
    if (fridge) state.fridge = { ...fridge, endsAt: Date.now() }
    const noodles = state.noodles
    if (noodles) state.noodles = { ...noodles, endsAt: Date.now() }
  }

  /** Cuts mesh for stool blocks without the tracing: one block, or all of them. */
  const cutMesh = (blockId?: number, help = 1) => {
    for (const id of blockId === undefined ? state.stool : [blockId]) {
      const block = state.blocks.get(id)
      if (block?.status === 'stool') block.mesh = help
    }
  }

  /** Proxy spike: turns locked sections back into proxies, as the final test will. */
  const unlockSection = (index: number) => {
    const count = game.proxies.unlock(index)
    if (count > 0) game.layers?.forget(index)
    return count
  }
  const unlockAll = () =>
    state.sections.reduce(
      (sum, section) =>
        sum + (section.locked ? unlockSection(section.index) : 0),
      0
    )
  const relockSection = (index: number) => game.proxies.relock(index).length
  const relockAll = () => {
    for (const section of state.sections) {
      const unlocked =
        !section.locked &&
        section.cells.some(c => {
          const b = c.block === null ? undefined : state.blocks.get(c.block)
          return (
            b?.status === 'proxy' ||
            (b?.status === 'up' && section.index !== state.section)
          )
        })
      if (unlocked) relockSection(section.index)
    }
  }

  const simulate = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) game.update(STEP)
  }

  /**
   * Fills and locks every section that isn't locked yet, letting each settle for a
   * moment first, as a real hold would. Ready for Call Uncle.
   */
  const lockAll = (quality = 0.85) => {
    if (state.phase === 'cold-open') state.phase = 'play'
    for (let guard = 0; guard < SECTION_COUNT && !allLocked(state); guard++) {
      fillSection(quality)
      simulate(1.2)
      lockSection(state, wall, economy.wallet)
    }
    game.viewSection(state.section)
    return allLocked(state)
  }

  /** The final test: stage, clock, falls per section and what the door slam will do. */
  const finalState = () => {
    const final = state.final
    return (
      final && {
        phase: state.phase,
        stage: final.stage,
        stageMs: final.stageMs,
        attempt: final.attempt,
        holdLeftMs: final.holdLeftMs,
        flown: final.flown,
        slammed: final.slammed,
        falls: [...final.falls],
        failedLeftMs: final.failedLeftMs,
        weakest: final.weakest,
        dropIds: [...final.dropIds],
        refills: [...final.refills],
        verdict: game.finalTest.verdict,
        section: state.section,
        locked: state.sections.map(s => s.locked),
        proxies: game.proxies.proxies.size,
        live: wall.liveCount
      }
    )
  }

  /** Lowers a block's grip, whether it has a body or is still a proxy. */
  const sag = (amount: number, blockId?: number) => {
    for (const block of state.blocks.values()) {
      if (blockId !== undefined && block.id !== blockId) continue
      if (block.status !== 'proxy') wall.sag(amount, block.id)
      else for (const f of block.fixings) f.grip = Math.max(0, f.grip - amount)
    }
  }

  const positions = () => {
    const blocks = []
    for (const id of wall.liveIds()) {
      const block = state.blocks.get(id)!
      const c = wall.bodyOf(id)!.soft.center()
      blocks.push({
        id,
        status: block.status,
        section: block.section,
        cell: block.cell,
        x: c.x,
        y: c.y,
        client: toClient(c.x, c.y),
        fixings: block.fixings.map(f => ({
          id: f.id,
          particle: f.particle,
          grip: f.grip,
          x: f.x,
          y: f.y,
          client: toClient(f.x, f.y)
        })),
        particles: wall
          .bodyOf(id)!
          .soft.bodies.map(p => toClient(p.position.x, p.position.y))
      })
    }
    const stool = state.stool.slice(0, STOOL_SLOTS).map((blockId, index) => ({
      index,
      blockId,
      client: designToClient(
        STOOL_LEFT + (index + 0.5) * STOOL_SLOT_W,
        STOOL_TOP + 84
      )
    }))
    // Proxies in the final test: centre and nails in client px, for taps.
    const proxies = [...game.proxies.proxies.values()].map(proxy => {
      const block = state.blocks.get(proxy.blockId)!
      const c = cellCentre(block.section, block.cell)
      return {
        id: proxy.blockId,
        section: block.section,
        cell: block.cell,
        client: toClient(c.x, c.y + proxy.s),
        fixings: block.fixings.map(f => ({
          id: f.id,
          grip: f.grip,
          client: toClient(f.x, f.y)
        }))
      }
    })
    const section = state.sections[state.section]!
    const cells = section.cells.map((cell, index) => {
      const c = cellCentre(section.index, index)
      return { cell: index, block: cell.block, client: toClient(c.x, c.y) }
    })
    return {
      blocks,
      proxies,
      stool,
      cells,
      zoom: game.camera.zoom,
      scale: game.viewport?.scale ?? 1
    }
  }

  /**
   * Sets up a scene for the M29 performance checks. `warm` drops two blocks with every
   * frame drawn, so both replay frame sets exist as they would an hour in. `s5` gives
   * every upgrade, locks sections 1 to 4 and fills section 5, all meshed and noodled.
   * `final` goes on to call the uncle and start his test. `brink` puts one block in
   * `every` between its red and orange lines, so the next slam rips them. Returns the
   * soft bodies and proxies alive.
   */
  const perfScene = (name: 'warm' | 's5' | 'final' | 'brink', every = 2) => {
    const loop = window.__game?.loop as { step(n: number): void } | undefined
    const reinforce = () => {
      for (const block of state.blocks.values()) {
        block.mesh = 1
        block.noodles = true
      }
    }
    if (state.phase === 'cold-open') state.phase = 'play'
    if (name === 'warm')
      for (let i = 0; i < 2; i++) {
        fillSection(0.7)
        simulate(1)
        const id = wall.liveIds().next().value
        if (id !== undefined) wall.drop(id, 'sag')
        loop?.step(240)
      }
    if (name === 's5' || name === 'final') {
      for (const upgrade of UPGRADES) giveUpgrade(upgrade.id)
      while (!allLocked(state) && state.section < SECTION_COUNT - 1) {
        fillSection(0.7)
        reinforce()
        simulate(1.2)
        lockSection(state, wall, economy.wallet)
      }
      fillSection(0.7)
      reinforce()
      simulate(1.2)
      game.viewSection(state.section)
    }
    if (name === 'final') {
      lockSection(state, wall, economy.wallet)
      game.finalTest.call()
      for (let i = 0; i < 300 && state.final?.stage !== 'touches'; i++)
        simulate(0.1)
      if (state.final) state.final.stageMs = FINAL.touchesMs
      loop?.step(5)
    }
    if (name === 'brink') {
      let k = 0
      for (const block of state.blocks.values()) {
        if (block.status !== 'proxy' && block.status !== 'up') continue
        if (k++ % every) continue
        const lines = blockWarningLines(block, state.phase === 'final')
        for (const f of block.fixings)
          f.grip = lines.red + (lines.orange - lines.red) * 0.3
      }
    }
    return { bodies: wall.liveCount, proxies: game.proxies.proxies.size }
  }

  const api = {
    get state() {
      return state
    },
    /** The live `Game`, for benchmarks that call its parts directly. */
    get game() {
      return game
    },
    snapshot: () => game.hud.get(),
    /** Acts as if the tab sat hidden for `ms`, then came back. */
    hideFor: (ms: number) => {
      const at = Date.now()
      game.hidden(at - ms)
      game.shown(at)
    },
    /** Silences the leave warning, so automation can reload the page. */
    allowLeave: () => endSession(),
    /** Walks to a room with the usual wipe. */
    goto: (room: RoomId) => game.goto(room),
    /** Opens a kitchen close-up (or the overview) while you are in the kitchen. */
    openStation: (view: KitchenView) => game.kitchen.open(view),
    /** The tilt sensors as the game reads them, or null without motion access. */
    motion: () =>
      game.motion && {
        available: game.motion.available,
        tiltX: game.motion.tiltX,
        tiltY: game.motion.tiltY
      },
    /** Checks the layout rules on the screen as it is now. */
    layout: () => {
      const a = designToClient(0, 0)
      const b = designToClient(DESIGN_WIDTH, DESIGN_HEIGHT)
      const design = {
        x: Math.round(a.x),
        y: Math.round(a.y),
        w: Math.round(b.x - a.x),
        h: Math.round(b.y - a.y)
      }
      return layoutCheck(design, game.viewport?.scale ?? 1)
    },
    fakeSafeArea,
    /** Adds coins, or spends them when `n` is negative. */
    addCoins: (n: number) =>
      n >= 0
        ? economy.wallet.earn(n, 'Dev')
        : economy.wallet.spend(Math.min(-n, economy.wallet.coins()), 'Dev'),
    /** Adds stock, or throws it away when `n` is negative. */
    addStock: (id: 'nails' | 'gelatin' | 'screws' | 'mopHeads', n: number) =>
      n >= 0
        ? economy.stock.add(id, n)
        : economy.stock.use(id, Math.min(-n, economy.stock.count(id))),
    /** Adds tubs of scraped floor jelly, for Recycled Batch. */
    addTubs: (n: number) => (state.tubs += n),
    /** Leaves a splat: kitchen x in design units, hallway x on the route, wall x in world units. */
    splat: (room: 'kitchen' | 'hallway' | 'wall', x?: number, seed = 2) =>
      room === 'kitchen'
        ? addSplat(state, room, x ?? 300, 740, 26, 'lime', seed, false)
        : room === 'hallway'
          ? addSplat(state, room, x ?? 900, 604, 40, 'grape', seed, true)
          : addSplat(state, room, x ?? 260, FLOOR_Y, 62, 'orange', seed, true),
    readyTray,
    handTray,
    /** The carry under way: route, position, tray angle, drift and blocks. */
    carry: () =>
      state.carry && {
        length: state.carry.length,
        pos: state.carry.pos,
        angle: state.carry.angle,
        drift: state.carry.drift,
        walking: state.carry.walking,
        blocks: state.carry.blocks.map(b => ({ x: b.x, v: b.v })),
        edge: state.carry.edge,
        /** The input steering the tray: motion, keys, pointer or none. */
        steering: game.hallway.steering,
        catAt: state.carry.catAt,
        /** The cat on the runner in client px, for dispatching a tap. */
        catClient:
          state.carry.catAt === null
            ? null
            : designToClient(300 + state.carry.catAt - state.carry.pos, 570)
      },
    /** Sits the cat on the runner `ahead` units in front of you, mid-carry. */
    hallwayCat: (ahead = 300) => {
      if (!state.carry) return false
      state.carry.catAt = state.carry.pos + ahead
      return true
    },
    /** Overrides the carry's steering input (-1 to 1), or null to use the real input. */
    setTilt: (value: number | null) => {
      game.hallway.tiltOverride = value
    },
    freshBatch: () =>
      startFreshBatch(state, economy.stock, game.batchOptions()),
    /** The batch's noodles: their state, the time left and whether they are ready. */
    noodles: () => ({
      state: state.mix?.noodles ?? null,
      leftMs: state.noodles ? Math.max(0, state.noodles.endsAt - now()) : null,
      ready: noodlesReady(state, now())
    }),
    /** The corner replay: its id, caption, blame line, frames and card stats. */
    replay: () => {
      const replay = game.hud.get().replay
      return (
        replay && {
          id: replay.id,
          label: replay.label,
          blame: replay.blame,
          frames: replay.clip.frames.length,
          picture: replay.picture !== null,
          stats: replay.stats
        }
      )
    },
    /** The "Meanwhile, at the Wall…" cutaway while one plays. */
    cutaway: () => game.cutaway && { ...game.cutaway },
    /** Puts the batch's noodles on the back hob. */
    startNoodles: () => startNoodles(state, now()),
    cutMesh,
    /** The mesh sheet being cut: edge, progress, ragged edges, and client points. */
    mesh: () => {
      const cutter = game.wallScene.meshCut
      if (!cutter) return null
      const cut = cutter.cut
      const corners = []
      for (let i = 0; i < 4; i++)
        corners.push(
          designToClient(cut.corners[i * 2]!, cut.corners[i * 2 + 1]!)
        )
      const s = scissorsAt(cut, { x: 0, y: 0 })
      return {
        blockId: cutter.blockId,
        edge: cut.edge,
        progress: cut.progress,
        ragged: [...cut.ragged],
        tracing: cut.tracing,
        done: cut.done,
        corners,
        scissors: designToClient(s.x, s.y)
      }
    },
    /** Gives an upgrade for free, as if bought. */
    giveUpgrade,
    /** The pour at the open moulds: fills, the current mould and the flow. */
    pour: () => {
      const station = game.kitchen.openStation
      return station instanceof MouldsStation
        ? JSON.parse(JSON.stringify(station.current))
        : null
    },
    /** The stir in the open bowl: circles, sloshes, spills and evenness. */
    stir: () => {
      const station = game.kitchen.openStation
      return station instanceof BowlStation ? station.current : null
    },
    /** The boil on the open stove: heat, time in the green, done or burnt. */
    boil: () => {
      const station = game.kitchen.openStation
      return station instanceof StoveStation ? { ...station.current } : null
    },
    completeStation,
    finishWaits,
    fillSection,
    lockSection: () => lockSection(state, wall, economy.wallet),
    hit,
    sag,
    drop: (blockId: number) => wall.drop(blockId, 'sag'),
    /** Nails or screws for new presses on the jelly. */
    setTool: (tool: 'nail' | 'screw') => {
      game.tool = tool
    },
    /**
     * Starts an event now, warning and all. Returns false while another one runs. A
     * `target` sends the fly to that block, promoting it first if it is a proxy.
     */
    trigger: (event: EventKind, target?: number) => {
      if (target !== undefined && game.proxies.proxies.has(target))
        game.proxies.promote(target, true)
      return game.events.start(event, {
        target,
        overlap: target !== undefined
      })
    },
    /**
     * The event under way, the director's next due times, and the fly and the cat with
     * their phase, block and tap point in client px.
     */
    events: () => {
      const { fly, cat } = game.events.critters
      const tap = game.events.critters.candidates()
      const at = (critter: 'fly' | 'cat') => {
        const c = tap.find(t => t.critter === critter)
        return c ? toClient(c.x, c.y) : null
      }
      return {
        running: game.events.current,
        nextMs: game.events.director.nextMs,
        holdEventMs: game.events.director.holdEventMs,
        simMs: state.simMs,
        flyBlock: wall.conditions.flyBlock,
        fly: fly && {
          phase: fly.state.phase,
          blockId: fly.state.blockId,
          bites: fly.state.bites,
          client: at('fly')
        },
        cat: cat && {
          phase: cat.state.phase,
          blockId: cat.state.blockId,
          client: at('cat')
        },
        /** Paw prints the cat left on the floor. */
        pawPrints: game.events.critters.pawPrints,
        heat: game.events.heat.wave && {
          phase: game.events.heat.current,
          curtains: game.events.heat.wave.curtains,
          wallHeat: wall.conditions.heat,
          sinceMs: state.simMs - game.events.heat.wave.startMs
        },
        heatDueMs: game.events.director.heatMs
      }
    },
    setView: (view: 'section' | 'whole') =>
      view === 'whole' ? game.viewWhole() : game.viewSection(state.section),
    simulate,
    advance: (seconds: number) => {
      const loop = window.__game?.loop as { step(n: number): void } | undefined
      loop?.step(Math.round(seconds * 60))
    },
    toClient,
    designToClient,
    positions,
    upCount: () => upCount(state, state.section),
    unlockSection,
    unlockAll,
    relockSection,
    relockAll,
    promote: (blockId: number) => game.proxies.promote(blockId),
    lockAll,
    /** Calls the uncle, as the Wall Report's Call Him button does. */
    callUncle: () => game.finalTest.call(),
    final: finalState,
    /** Closes a failed attempt's verdict, as Fix It does. */
    closeVerdict: () => game.finalTest.closeVerdict(),
    /** Ends Last Touches now, so the clock starts on the next step. */
    skipTouches: () => {
      const final = state.final
      if (final?.stage !== 'touches') return false
      final.stageMs = FINAL.touchesMs
      return true
    },
    perf: () => ({
      ...wall.perf(),
      proxies: game.proxies.proxies.size,
      promoted: game.proxies.promotedCount,
      engineBodies: Matter.Composite.allBodies(wall.engine.world).length,
      roomLayers: Object.values(game.scenes).filter(
        s => 'hasLayer' in s && s.hasLayer
      ).length,
      physicsMs: game.timings.physicsMs,
      drawMs: game.timings.drawMs,
      recordMs: game.timings.recordMs
    }),
    perfScene,
    /** Steps the loop and times physics, drawing and the recorder per step (M29). */
    probe: (steps = 120) => perfProbe(game, steps),
    /** Pixel memory of every live canvas, grouped by size (M29). */
    canvasMemory,
    /** React commits since the page loaded. */
    commits: () => commits.count,
    /**
     * The pacing model (M30): minutes per section and for the run, for the average
     * player failing the final test `failures` times and the unskilled one failing twice.
     */
    paceReport: (failures = 1) => ({
      average: paceReport(AVERAGE_PACE, failures),
      unskilled: paceReport(UNSKILLED_PACE, 2)
    })
  }
  const dispose = exposeDev('jelly', {
    ...api,
    /** Runs the layout checks in every room and dialog. Reload afterwards. */
    layoutTour: () => layoutTour(api)
  })

  const actions: DevAction[] = [
    { label: '+100 Coins', run: () => economy.wallet.earn(100, 'Dev') },
    { label: '+20 Nails', run: () => economy.stock.add('nails', 20) },
    { label: '+10 Gelatin', run: () => economy.stock.add('gelatin', 10) },
    {
      label: 'All Upgrades',
      run: () => UPGRADES.forEach(u => giveUpgrade(u.id))
    },
    { label: 'Ready Tray', run: () => readyTray() },
    { label: 'Cut All Mesh', run: () => cutMesh() },
    { label: 'Mixed Tray', run: () => readyTray(3, [0.2, 0.5, 0.9]) },
    { label: 'Tray in Hand', run: () => handTray() },
    {
      label: 'Splat Every Room',
      run: () => {
        addSplat(state, 'kitchen', 200, 740, 26, 'lime', 2, false)
        addSplat(state, 'hallway', 700, 604, 40, 'grape', 3, true)
        addSplat(state, 'wall', 260, FLOOR_Y, 62, 'orange', 4, true)
      }
    },
    { label: '+1 Mop Head', run: () => economy.stock.add('mopHeads', 1) },
    { label: '+4 Tubs', run: () => (state.tubs += 4) },
    { label: 'Finish Station', run: () => completeStation() },
    { label: 'Finish Waits', run: () => finishWaits() },
    { label: 'Fill Section', run: () => fillSection() },
    {
      label: 'Lock Section',
      run: () => lockSection(state, wall, economy.wallet)
    },
    { label: 'Slam', run: () => game.events.start('slam') },
    { label: 'Truck', run: () => game.events.start('truck') },
    { label: 'Fly', run: () => game.events.start('fly') },
    { label: 'Cat', run: () => game.events.start('cat') },
    { label: 'Heat Wave', run: () => game.events.start('heat') },
    {
      label: 'Hallway Cat',
      run: () => {
        if (state.carry) state.carry.catAt = state.carry.pos + 300
      }
    },
    { label: 'Unlock Locked Sections', run: () => unlockAll() },
    { label: 'Relock Sections', run: () => relockAll() },
    { label: 'Sag All', run: () => wall.sag(0.25) },
    {
      label: 'Drop Random Block',
      run: () => {
        const up = [...wall.liveIds()].filter(
          id => state.blocks.get(id)?.status === 'up'
        )
        const id = up[Math.floor(Math.random() * up.length)]
        if (id !== undefined) wall.drop(id, 'sag')
      }
    },
    { label: 'Lock All Sections', run: () => lockAll() },
    {
      label: 'Start Final Test',
      run: () => {
        lockAll()
        game.finalTest.call()
      }
    },
    {
      label: 'Fill and Lock Section',
      run: () => {
        fillSection()
        if (upCount(state, state.section) === SECTION_CELLS)
          lockSection(state, wall, economy.wallet)
      }
    }
  ]
  return { actions, dispose }
}
