import type { EventKind } from '../game/events'
import type { VerdictInfo } from '../game/hud'
import type { SplatStat } from '../game/replays'
import {
  arriveMs,
  collapseOrder,
  endingLabel,
  endingStats,
  failFinal,
  finalStatus,
  leaveFinal,
  returnGag,
  settleFinal,
  showVerdict,
  startFinal,
  stepFinal,
  heldMs,
  shutAtMs,
  verdictCaption,
  verdictLine,
  type FinalEvent,
  type FinalTestState
} from '../game/finalTest'
import { allLocked, isUp } from '../game/section'
import { toDesign } from '../game/sim/camera'
import { cellCentre, sectionCentre, sectionRect } from '../game/sim/geometry'
import {
  FINAL,
  HOLD_MS,
  SECTION_COUNT,
  SHAKE,
  STOOL_LEFT,
  STOOL_SLOT_W,
  STOOL_SLOTS,
  STOOL_TOP
} from '../game/tuning'
import type { BlockState } from '../game/types'
import { testFace } from '../game/uncle'
import { blockNailLevelFor } from '../game/warnings'
import {
  palette,
  settings,
  sfx,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  toast,
  vibrate,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import {
  drawCameraCrew,
  drawCrisps,
  drawDangerRing,
  drawDeckchair,
  drawEdgeArrow,
  drawCarKeys,
  drawPeelingFilm,
  drawUncleFigure,
  type UncleLook
} from './art/final'
import type { Game } from './game'

/** How often the red-block list refreshes, for the pulses and the edge arrows. */
const RED_CHECK_MS = 200
/** Cling film takes this long to fall away after its snip. */
const PEEL_MS = 700
/** The uncle's spot in the strip, in design units. */
const UNCLE_X = 190
const FOOT_Y = 788
const UNCLE_SCALE = 0.34
/** The deckchair draws a size up and a little behind him, so its stripes show. */
const CHAIR_SCALE = UNCLE_SCALE * 1.3
const CHAIR_SHIFT = 26
/** His speech bubble, right of him in the strip. */
const BUBBLE = { x: 244, y: 650, width: 176, height: 84 } as const
/** Arrows stay inside this design rectangle, clear of the replay corner and the strip. */
const ARROW_BOX = { left: 26, right: 574, top: 196, bottom: 612 } as const
const RUG_BASE: SketchStyle = { fill: '#e8c39e', width: 0, seed: 889 }
const RUG: SketchStyle = {
  fill: '#d9a066',
  fillStyle: 'hatch',
  hatchGap: 9,
  hatchAngle: 0.4,
  color: palette.brown,
  width: 3,
  seed: 890
}
const BUBBLE_STYLE: SketchStyle = { fill: '#ffffff', width: 3, seed: 891 }
const BUBBLE_TEXT: SketchTextStyle = { size: 22, color: palette.ink, seed: 892 }
const NEIGHBOUR_TEXT: SketchTextStyle = {
  size: 19,
  color: palette.inkSoft,
  seed: 893
}
const LOOK: UncleLook = {
  pose: 'stand',
  face: 'smug',
  facing: 1,
  watch: false,
  timeMs: 0
}
const POINT = { x: 0, y: 0 }
/** Why Call Uncle waits while an event runs, by the event. */
const CALM_FIRST: Record<EventKind, string> = {
  slam: 'Wait for the wall to stop shaking.',
  'gentle-slam': 'Wait for the wall to stop shaking.',
  truck: 'Wait for the truck to pass.',
  fly: 'Swat the fly first. He hates flies.',
  cat: 'Deal with the cat first.',
  heat: 'Wait for the heat wave to pass. He hates sweating.'
}

/** What the uncle says on arrival, by the gag he brings back. */
const ARRIVALS = {
  none: ['Right then.', "Let's see it."],
  snacks: ['Back already?', 'I brought snacks.'],
  neighbour: ['I brought the', 'neighbour. Say hi.'],
  crew: ['I called a camera', 'crew. Smile.']
} as const
/** Last Touches beats: seconds in, and his line. */
const TOUCHES: readonly { atMs: number; line: readonly string[] }[] = [
  { atMs: 0, line: ['Last touches.', 'Getting comfy.'] },
  { atMs: 7000, line: ["Where's the button", 'on this thing?'] },
  { atMs: 14_000, line: ['Found it.', 'Any second now.'] }
]
/** The neighbour, never seen, chips in from the left edge on the third attempt. */
const NEIGHBOUR_LINES: readonly (readonly string[])[] = [
  ["Don't mind", 'me.'],
  ['Is it', 'holding?'],
  ['I slam doors', 'too.'],
  ['Smells like', 'lime.']
]
const POKES: readonly (readonly string[])[] = [
  ['Eyes on the', 'wall, not me.'],
  ["Don't touch", 'the chair.'],
  ['I can see the', 'red ones too.']
]

/**
 * Runs the final test: the uncle's arrival, the snip, Last Touches, the 60s test with
 * its scripted fly and slam, and a failed attempt's cascade, verdict, door slam and
 * rebuild. It draws him in the stool strip, the cling film coming off, pulses on red
 * blocks and arrows pointing at red blocks in other sections.
 */
export class FinalTestRunner {
  /** Shaking the weakest section off: its splats skip their blame captions. */
  dropping = false
  /** The whole wall is coming down after the win; the ending films it, not the replays. */
  collapsing = false
  /** The verdict to show, while the attempt waits on you. */
  verdict: VerdictInfo | null = null
  private readonly events: FinalEvent[] = []
  private readonly snipAtMs: number[] =
    Array<number>(SECTION_COUNT).fill(-Infinity)
  /** Blocks with a nail past its red line. */
  private red: number[] = []
  private redCheckMs = 0
  private replayIdAtFail = 0
  private verdictId = 0
  private line: {
    rows: readonly string[]
    atMs: number
    ttlMs: number
  } | null = null
  private pokes = 0
  private crunchMs = 0
  /** The whole wall mid-collapse, for the ending's share card. */
  private picture: CanvasImageSource | null = null
  /** The run's stats, taken as his door slams, before the wall comes down. */
  private stats: SplatStat[] = []

  constructor(private readonly game: Game) {}

  get state(): FinalTestState | null {
    return this.game.state.final
  }

  /** True while the uncle runs the test, from the doorbell to his door slam. */
  get running(): boolean {
    return this.game.state.phase === 'final'
  }

  /** Why you can't call him yet, or null when you can. */
  callBlocker(): string | null {
    const game = this.game
    const state = game.state
    if (state.phase !== 'play') return 'He is already here.'
    if (!allLocked(state)) return 'Lock all five sections first.'
    const event = game.events.current
    if (event !== null) return CALM_FIRST[event]
    if (game.events.heat.wave !== null) return CALM_FIRST.heat
    return null
  }

  /** You called him: the doorbell rings and the test begins. */
  call(): boolean {
    if (this.callBlocker() !== null) return false
    const game = this.game
    const state = game.state
    state.final = startFinal(state.final)
    state.phase = 'final'
    // Every section decays at the same speed from now on.
    game.wall.conditions.sectionDecay = false
    this.snipAtMs.fill(-Infinity)
    this.verdict = null
    this.dropping = false
    game.viewWhole()
    sfx.play('doorbell')
    game.fx.caption('Ding dong.', 300, 250, {
      world: false,
      size: 40,
      ttlMs: 1600
    })
    const gag = returnGag(state.final.attempt)
    this.say(ARRIVALS[gag], arriveMs(state.final.attempt) + 600)
    if (gag === 'crew') sfx.play('click', { pitch: 0.6 })
    return true
  }

  update(dtMs: number): void {
    const game = this.game
    const final = this.state
    if (!final || game.state.phase !== 'final') return
    const events = this.events
    events.length = 0
    stepFinal(final, dtMs, events)
    for (const event of events) this.onEvent(final, event)
    if (final.stage === 'failing' && final.stageMs >= FINAL.cascadeMs) {
      const replay = game.hud.get().replay
      const ready = (replay?.id ?? 0) > this.replayIdAtFail
      if (ready || final.stageMs >= FINAL.cascadeMs + FINAL.clipWaitMs)
        this.openVerdict(final)
    }
    if (final.stage === 'touches') {
      for (const beat of TOUCHES)
        if (final.stageMs >= beat.atMs && final.stageMs - dtMs < beat.atMs) {
          this.say(beat.line, 6000)
          if (beat.atMs === 0) sfx.play('creak', { volume: 0.6, pitch: 1.3 })
          else sfx.play('click', { pitch: 1.4 })
        }
    }
    if (final.stage === 'test') this.updateGags(final, dtMs)
    this.redCheckMs -= dtMs
    if (this.redCheckMs <= 0) {
      this.redCheckMs = RED_CHECK_MS
      this.refreshRed()
    }
  }

  private onEvent(final: FinalTestState, event: FinalEvent): void {
    const game = this.game
    const state = game.state
    const fx = game.fx
    switch (event.type) {
      case 'snip': {
        const i = event.section
        if (game.proxies.unlock(i) > 0) game.layers?.forget(i)
        this.snipAtMs[i] = state.simMs
        sfx.play('snip', { pitch: 0.9 + i * 0.06 })
        const c = sectionCentre(i)
        fx.caption('snip!', c.x, c.y, { size: 40, color: palette.inkSoft })
        if (i === 0) this.say(['Off they come.'], 2400)
        break
      }
      case 'touches':
        fx.caption('LAST TOUCHES', 300, 250, {
          world: false,
          size: 44,
          color: palette.orange,
          ttlMs: 2200
        })
        sfx.play('ding', { pitch: 0.9 })
        break
      case 'start':
        sfx.play('click', { pitch: 0.8 })
        sfx.play('ding', { pitch: 1.2 })
        this.say(['Sixty seconds.', 'Starting now.'], 3000)
        fx.caption('GO!', 300, 250, {
          world: false,
          size: 64,
          color: palette.green,
          ttlMs: 1400
        })
        break
      case 'fly': {
        const target = this.weakestBlock()
        if (target !== null && game.proxies.proxies.has(target))
          game.proxies.promote(target, true)
        if (target !== null) game.events.start('fly', { overlap: true, target })
        this.say(['Oh look.', 'A fly.'], 2600)
        break
      }
      case 'slam':
        game.events.start('slam', { overlap: true })
        this.say(["Your neighbour's", 'keen.'], 2600)
        break
      case 'held':
        this.held()
        break
      case 'keys':
        sfx.play('rattle')
        sfx.play('ding', { pitch: 1.4, volume: 0.5 })
        vibrate(30)
        this.say(['Fine.', 'Take the car.'], FINAL.keysMs + 400)
        fx.caption('CAR KEYS!', 300, 560, {
          world: false,
          size: 44,
          color: palette.green,
          ttlMs: 1800
        })
        break
      case 'exit':
        sfx.play('stomp', { volume: 0.4, pitch: 1.2 })
        break
      case 'shut':
        this.shut(final)
        break
      case 'collapse':
        game.proxies.drop(event.blockId, 'slam')
        if (final.dropped === Math.ceil(final.dropIds.length / 2))
          this.picture = game.recorder.takeWallPicture()
        break
      case 'ending':
        this.finish(final)
        break
      case 'settle':
        this.settle(final)
        break
      case 'door':
        sfx.play('slam')
        sfx.play('creak', { volume: 0.8 })
        fx.shake(SHAKE.slam)
        vibrate(80)
        fx.caption('SLAM!', 300, 250, {
          world: false,
          size: 64,
          color: palette.red,
          ttlMs: 1600
        })
        this.dropping = true
        this.line = null
        game.viewWhole()
        break
      case 'drop':
        game.proxies.drop(event.blockId, 'slam')
        break
      case 'rebuild':
        this.rebuild(final)
        break
    }
  }

  /** A block left the wall. The first one during the attempt stops the clock. */
  onFall(block: BlockState): void {
    const final = this.state
    if (!final || this.game.state.phase !== 'final') return
    if (!failFinal(final, block.section)) return
    this.replayIdAtFail = this.game.hud.get().replay?.id ?? 0
    sfx.play('click', { pitch: 0.8 })
    sfx.play('fail')
    this.say(
      final.failedEarly ? ['Ha! Before', 'I even started!'] : ['HA!'],
      2600
    )
    this.game.fx.caption('STOP!', 300, 250, {
      world: false,
      size: 60,
      color: palette.red,
      ttlMs: 1600
    })
  }

  /**
   * The clock ran out with every block up. The wall freezes as it hangs, the fly
   * leaves, and he stares at it in silence.
   */
  private held(): void {
    const game = this.game
    game.events.critters.dismiss()
    game.proxies.demoteAll()
    game.proxies.paused = true
    sfx.play('click', { pitch: 0.7 })
    sfx.play('ding', { pitch: 1.3 })
    game.fx.caption('IT HELD.', 300, 250, {
      world: false,
      size: 64,
      color: palette.green,
      ttlMs: FINAL.stareMs
    })
    this.say(['…'], FINAL.stareMs)
  }

  /** His door slams on the way out, and the whole wall comes down. */
  private shut(final: FinalTestState): void {
    const game = this.game
    sfx.play('slam')
    sfx.play('creak')
    game.fx.shake(SHAKE.slam * 1.5)
    vibrate(120)
    game.fx.caption('SLAM!', 300, 250, {
      world: false,
      size: 72,
      color: palette.red,
      ttlMs: 1600
    })
    this.stats = endingStats(game.state)
    final.dropIds = collapseOrder(game.state)
    final.dropped = 0
    this.collapsing = true
    this.dropping = true
    this.line = null
    game.recorder.frameWall()
    game.viewWhole()
  }

  /** The collapse is filmed: the ending screen takes over. */
  private finish(final: FinalTestState): void {
    const game = this.game
    game.state.phase = 'ending'
    game.hud.set({
      ending: {
        clip: game.recorder.clip(),
        label: endingLabel(final),
        picture: this.picture,
        stats: this.stats
      }
    })
  }

  /** The cascade is over: choose the weakest section and lock the rest as they stand. */
  private settle(final: FinalTestState): void {
    const game = this.game
    const weakest = settleFinal(final, game.state)
    for (const section of game.state.sections) {
      if (section.index === weakest || section.locked) continue
      game.proxies.relock(section.index)
      game.layers?.forget(section.index)
    }
  }

  private openVerdict(final: FinalTestState): void {
    showVerdict(final)
    const weakest = (final.weakest ?? 0) + 1
    const refills = final.refills.length
    this.verdict = {
      id: ++this.verdictId,
      replayAfter: this.replayIdAtFail,
      line: verdictLine(final),
      caption: verdictCaption(final),
      note:
        `Section ${weakest} lost the most. His door slam will finish it off.` +
        (refills > 0
          ? ` ${refills === 1 ? 'One more section has' : `${refills} more sections have`} gaps to fill after.`
          : '')
    }
  }

  /** You closed the verdict: he says his line and walks out. */
  closeVerdict(): void {
    const final = this.state
    if (!final || final.stage !== 'verdict') return
    this.verdict = null
    // The dialog pauses the loop, so tell React now rather than on the next publish.
    this.game.hud.set({ verdict: null })
    leaveFinal(final)
    this.say(['Call me when', "it's fixed."], FINAL.lineMs + FINAL.walkMs)
    sfx.play('laugh', { pitch: 0.9 })
  }

  /** The weakest section is on the floor: back to building, starting with it. */
  private rebuild(final: FinalTestState): void {
    const game = this.game
    const state = game.state
    const weakest = final.weakest ?? 0
    this.dropping = false
    this.line = null
    state.phase = 'play'
    state.section = weakest
    game.viewSection(weakest)
    const refills = final.refills.length
    toast(
      refills > 0
        ? `Rebuild section ${weakest + 1}, then fill the gaps he left. Then call him again.`
        : `Rebuild section ${weakest + 1}. Then call him again.`,
      'info',
      4200
    )
  }

  /**
   * A section just locked with nothing left unlocked. When a refill waits, its section
   * opens for you to fill its gaps and hold it again. Returns true when one opened.
   */
  refill(): boolean {
    const final = this.state
    const game = this.game
    if (!final || game.state.phase !== 'play' || final.refills.length === 0)
      return false
    const index = final.refills.shift()!
    game.proxies.reopen(index)
    game.layers?.forget(index)
    game.state.section = index
    toast(
      `Section ${index + 1} lost blocks in the test. Fill its gaps and hold it again.`,
      'info',
      4200
    )
    return true
  }

  /** A tap on the uncle in his strip. */
  poke(): void {
    if (!this.running) return
    this.say(POKES[this.pokes++ % POKES.length]!, 2200)
    sfx.play('pop', { pitch: 0.8 })
  }

  /** Snacks crunch and the neighbour chips in while the clock runs. */
  private updateGags(final: FinalTestState, dtMs: number): void {
    const gag = returnGag(final.attempt)
    this.crunchMs -= dtMs
    if (this.crunchMs > 0) return
    this.crunchMs = 4200
    if (gag === 'snacks') {
      sfx.play('scrub', { volume: 0.3, pitch: 1.9 })
      this.game.fx.caption('crunch', UNCLE_X + 40, STOOL_TOP + 10, {
        world: false,
        size: 22,
        color: palette.inkSoft
      })
    }
    const left = final.holdLeftMs
    if (left < 10_000 && left + 4200 >= 10_000)
      this.say(['Come on.', 'Fall.'], 2600)
  }

  /** The block with the weakest nail, live or proxy, for the scripted fly. */
  private weakestBlock(): number | null {
    let best: number | null = null
    let grip = Infinity
    for (const block of this.game.state.blocks.values()) {
      if (block.status !== 'proxy' && !isUp(block)) continue
      for (const f of block.fixings)
        if (f.grip < grip) {
          grip = f.grip
          best = block.id
        }
    }
    return best
  }

  private refreshRed(): void {
    const final = this.game.state.phase === 'final'
    this.red.length = 0
    if (!final) return
    for (const block of this.game.state.blocks.values()) {
      if (block.status !== 'proxy' && !isUp(block)) continue
      if (
        block.fixings.some(
          f => blockNailLevelFor(block, f.grip, true) === 'red'
        )
      )
        this.red.push(block.id)
    }
  }

  private say(rows: readonly string[], ttlMs: number): void {
    this.line = { rows, atMs: this.game.state.simMs, ttlMs }
  }

  /** A short hint for the tip line while the test runs. */
  tip(): string | null {
    const final = this.state
    if (!final || !this.running) return null
    switch (final.stage) {
      case 'arrive':
        return 'Your uncle is here for the final test.'
      case 'snip':
        return 'Every lock comes off. All 60 blocks must hold at once.'
      case 'touches':
        return this.red.length > 0
          ? 'Last touches. Hammer the red nails before he starts the clock.'
          : this.game.view === 'whole'
            ? 'Last touches. Tap a section to zoom in, or hold on a nail to hammer it.'
            : 'Last touches. Check every nail before he starts the clock.'
      case 'test':
        return this.red.length > 0
          ? 'A nail is blinking red. Hammer it back in.'
          : 'Hold on. Swat anything that lands on the jelly.'
      case 'failing':
      case 'verdict':
        return 'One fell. The test is over.'
      case 'passed':
        return 'It held! Now your uncle has to pay up.'
      default:
        return 'Your uncle is leaving.'
    }
  }

  /** The clock over the wall: its label, time and colour. Null when none shows. */
  clock(): {
    label: string
    ms: number
    urgent: boolean
    /** Shown instead of the countdown, such as the held time ticking up. */
    text?: string
  } | null {
    const final = this.state
    if (!final || !this.running) return null
    if (final.stage === 'touches')
      return {
        label: 'LAST TOUCHES',
        ms: Math.max(0, FINAL.touchesMs - final.stageMs),
        urgent: false
      }
    if (final.stage === 'test')
      return { label: 'TEST', ms: final.holdLeftMs, urgent: true }
    if (final.stage === 'failing' || final.stage === 'verdict')
      return { label: 'STOPPED', ms: final.failedLeftMs ?? 0, urgent: true }
    if (final.stage === 'passed')
      return {
        label: final.stageMs < shutAtMs() ? 'STILL HOLDING' : 'HELD FOR',
        ms: heldMs(final),
        urgent: false,
        text: `${(heldMs(final) / 1000).toFixed(1)}s`
      }
    return null
  }

  /** The test's status in a few words, for the nav and the desktop column. */
  status(): string | null {
    const final = this.state
    return final && this.running ? finalStatus(final) : null
  }

  // ---------------------------------------------------------------- Drawing

  /** Cling film falling away and rings on red blocks, in world units over the wall. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    const game = this.game
    if (game.state.phase !== 'final') return
    const now = game.state.simMs
    for (let i = 0; i < SECTION_COUNT; i++) {
      const t = (now - this.snipAtMs[i]!) / PEEL_MS
      if (t < 0 || t >= 1) continue
      const r = sectionRect(i)
      drawPeelingFilm(ctx, r.x + 4, r.y + 4, r.width - 8, r.height - 8, t)
    }
    const pulse = this.pulse()
    for (const id of this.red) {
      if (!this.centreOf(id, POINT)) continue
      drawDangerRing(ctx, POINT.x, POINT.y, pulse, id)
    }
  }

  /** Arrows at the edge pointing at red blocks out of view, in design units. */
  drawArrows(ctx: CanvasRenderingContext2D): void {
    const game = this.game
    if (game.state.phase !== 'final' || game.view !== 'section') return
    const pulse = this.pulse()
    for (const id of this.red) {
      if (!this.centreOf(id, POINT)) continue
      const p = toDesign(game.camera, POINT.x, POINT.y, POINT)
      const inside = p.x > 0 && p.x < 600 && p.y > 0 && p.y < STOOL_TOP
      if (inside) continue
      const cx = 300
      const cy = (ARROW_BOX.top + ARROW_BOX.bottom) / 2
      const dx = p.x - cx
      const dy = p.y - cy
      // Walk from the middle towards the block until the box's edge.
      const kx =
        dx === 0
          ? Infinity
          : ((dx > 0 ? ARROW_BOX.right : ARROW_BOX.left) - cx) / dx
      const ky =
        dy === 0
          ? Infinity
          : ((dy > 0 ? ARROW_BOX.bottom : ARROW_BOX.top) - cy) / dy
      const k = Math.min(kx, ky)
      drawEdgeArrow(ctx, cx + dx * k, cy + dy * k, dx, dy, pulse)
    }
  }

  /** The uncle, his deckchair, his gags and his speech bubble, in the stool strip. */
  drawStrip(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const final = this.state
    if (!final || !this.running) return
    // His rug covers the stool strip, so the wall behind doesn't show through.
    const rugW = STOOL_SLOT_W * STOOL_SLOTS + 8
    sketchRect(ctx, STOOL_LEFT - 4, STOOL_TOP + 22, rugW, 118, RUG_BASE)
    sketchRect(ctx, STOOL_LEFT - 4, STOOL_TOP + 22, rugW, 118, RUG)
    const gag = returnGag(final.attempt)
    if (gag === 'crew') drawCameraCrew(ctx, 70, FOOT_Y, timeMs)
    const stage = final.stage
    const ms = final.stageMs
    LOOK.timeMs = timeMs
    LOOK.facing = 1
    LOOK.watch = false
    LOOK.pose = 'stand'
    LOOK.face = 'smug'
    let x = UNCLE_X
    let chair = 1
    let chairX = UNCLE_X
    let shown = true
    if (stage === 'arrive') {
      const t = Math.min(1, ms / arriveMs(final.attempt))
      x = -90 + (UNCLE_X + 90) * (1 - (1 - t) * (1 - t))
      LOOK.pose = t < 1 ? 'walk' : 'stand'
      chair = 0
      chairX = x - 40
    } else if (stage === 'snip') {
      chair = 0
      chairX = x - 40
    } else if (stage === 'touches') {
      chair = Math.min(1, ms / 3000)
      chairX = UNCLE_X - 40 * (1 - chair)
      if (ms > 3600) {
        LOOK.pose = 'sit'
        // He fumbles the stopwatch, then finds the button.
        LOOK.watch = ms > 6000
        LOOK.face = 'eyebrow'
      }
    } else if (stage === 'test') {
      LOOK.pose = 'sit'
      LOOK.watch = true
      LOOK.face = testFace(final.holdLeftMs / HOLD_MS)
    } else if (stage === 'passed') {
      // He stares, gets up, hands over his keys and walks out with his chair.
      const keysAt = FINAL.stareMs
      const exitAt = keysAt + FINAL.keysMs
      // He stares in silence, sweats over the keys, and leaves with a straight face.
      LOOK.face = ms < keysAt ? 'flat' : ms < exitAt ? 'sweating' : 'flat'
      if (ms < keysAt) {
        LOOK.pose = 'sit'
        LOOK.watch = true
      } else if (ms >= exitAt) {
        const walk = (ms - exitAt) / FINAL.exitMs
        x = UNCLE_X + walk * 420
        LOOK.pose = 'walk'
        chair = 0
        chairX = x - 40
        if (walk >= 1) shown = false
      }
      if (ms >= keysAt) this.drawKeys(ctx, ms - keysAt)
    } else if (stage === 'failing' || stage === 'verdict') {
      LOOK.pose = 'laugh'
      LOOK.face = 'laugh'
    } else if (stage === 'leave') {
      LOOK.face = 'smirk'
      // He folds his chair and walks out with it.
      const walk = Math.max(0, ms - FINAL.lineMs) / FINAL.walkMs
      x = UNCLE_X + walk * 420
      LOOK.pose = walk > 0 ? 'walk' : 'stand'
      chair = 0
      chairX = x - 40
    } else shown = false
    if (!shown) return
    if (gag === 'snacks') drawCrisps(ctx, UNCLE_X - 120, FOOT_Y)
    drawDeckchair(ctx, chairX - CHAIR_SHIFT, FOOT_Y, CHAIR_SCALE, chair)
    const reduce = settings.get().reducedMotion
    if (reduce) LOOK.timeMs = 0
    drawUncleFigure(ctx, x, FOOT_Y, UNCLE_SCALE, LOOK)
    drawDeckchair(
      ctx,
      chairX - CHAIR_SHIFT,
      FOOT_Y,
      CHAIR_SCALE,
      chair,
      'front'
    )
    if (gag === 'neighbour') this.drawNeighbour(ctx, timeMs)
    this.drawBubble(ctx, x)
  }

  /** His car keys, tossed from his hand to the corner, where they stay. */
  private drawKeys(ctx: CanvasRenderingContext2D, sinceMs: number): void {
    const t = Math.min(1, sinceMs / 700)
    const x = UNCLE_X + 40 + (360 - UNCLE_X - 40) * t
    const y = 680 - Math.sin(Math.PI * t) * 90 + 40 * t
    drawCarKeys(ctx, x, y, t < 1 ? t * 9 : 0.3, 1.6)
  }

  /** The neighbour is never seen: a bubble from off the left edge. */
  private drawNeighbour(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const rows =
      NEIGHBOUR_LINES[Math.floor(timeMs / 5000) % NEIGHBOUR_LINES.length]!
    sketchLine(ctx, 12, STOOL_TOP + 40, -24, STOOL_TOP + 30, BUBBLE_STYLE)
    sketchRoundRect(ctx, 6, STOOL_TOP + 12, 116, 62, 12, BUBBLE_STYLE)
    for (let i = 0; i < rows.length; i++)
      sketchText(ctx, rows[i]!, 64, STOOL_TOP + 31 + i * 24, NEIGHBOUR_TEXT)
  }

  private drawBubble(ctx: CanvasRenderingContext2D, x: number): void {
    const line = this.line
    if (!line) return
    const age = this.game.state.simMs - line.atMs
    if (age > line.ttlMs) {
      this.line = null
      return
    }
    const b = BUBBLE
    const pop = Math.min(1, age / 140)
    ctx.save()
    ctx.translate(b.x + b.width / 2, b.y + b.height / 2)
    ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop)
    sketchLine(
      ctx,
      -b.width / 2 + 10,
      10,
      x - (b.x + b.width / 2) + 30,
      6,
      BUBBLE_STYLE
    )
    sketchRoundRect(
      ctx,
      -b.width / 2,
      -b.height / 2,
      b.width,
      b.height,
      18,
      BUBBLE_STYLE
    )
    const rows = line.rows
    for (let i = 0; i < rows.length; i++)
      sketchText(
        ctx,
        rows[i]!,
        0,
        (i - (rows.length - 1) / 2) * 28,
        BUBBLE_TEXT
      )
    ctx.restore()
  }

  private pulse(): number {
    if (settings.get().reducedMotion) return 0.5
    return 0.5 + 0.5 * Math.sin(this.game.state.simMs * 0.012)
  }

  /** A block's centre in world units: its body, or its proxy's posed snapshot. */
  private centreOf(id: number, out: { x: number; y: number }): boolean {
    const game = this.game
    const body = game.wall.bodyOf(id)
    if (body) {
      body.soft.center(out)
      return true
    }
    const proxy = game.proxies.proxies.get(id)
    if (proxy) {
      const p = proxy.snapshot.positions
      let sx = 0
      let sy = 0
      for (let i = 0; i < p.length; i += 2) {
        sx += p[i]!
        sy += p[i + 1]!
      }
      out.x = sx / (p.length / 2)
      out.y = sy / (p.length / 2) + proxy.s
      return true
    }
    const block = game.state.blocks.get(id)
    if (!block || block.section < 0) return false
    const c = cellCentre(block.section, block.cell)
    out.x = c.x
    out.y = c.y
    return true
  }
}
