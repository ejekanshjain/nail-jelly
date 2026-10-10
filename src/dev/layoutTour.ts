import type { RoomId } from '../game/rooms'
import type { GameState, KitchenView } from '../game/types'
import type { UpgradeId } from '../game/upgrades'
import type { LayoutReport } from './layoutCheck'

/** The parts of `window.__game.jelly` the tour drives. */
export interface TourApi {
  readonly state: GameState
  layout(): LayoutReport
  advance(seconds: number): void
  simulate(seconds: number): void
  goto(room: RoomId): void
  openStation(view: KitchenView): void
  setView(view: 'section' | 'whole'): void
  trigger(event: 'heat'): void
  giveUpgrade(id: UpgradeId): boolean
  addTubs(n: number): number
  readyTray(count?: number): void
  handTray(count?: number): void
  freshBatch(): unknown
  startNoodles(): unknown
  lockAll(quality?: number): boolean
  callUncle(): boolean
  skipTouches(): boolean
  closeVerdict(): void
  sag(amount: number, blockId?: number): void
  positions(): { proxies: { id: number; section: number }[] }
  final(): { stage: string } | null
}

/** What one stop of the tour found: 'ok', or the problems by kind. */
type StopResult = 'ok' | Record<string, string[]>

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Clicks the first button whose label or text starts with `text`. */
function click(text: string): void {
  for (const button of document.querySelectorAll('button'))
    if (
      (button.getAttribute('aria-label') ?? button.textContent).startsWith(text)
    ) {
      button.click()
      return
    }
}

/**
 * Dev only: visits every room, station, dialog and final-test screen at the current
 * screen size and runs `layoutCheck` at each stop. It changes the run (upgrades, a
 * locked wall, a finished game), so reload afterwards. Automation calls it once per
 * screen size.
 */
export async function layoutTour(
  api: TourApi
): Promise<Record<string, StopResult | number>> {
  const out: Record<string, StopResult | number> = {}
  const check = (name: string) => {
    const report = api.layout()
    const problems: Record<string, string[]> = {}
    const kinds = [
      'hudOverDesign',
      'small',
      'spilling',
      'offscreen',
      'scrollers'
    ] as const
    for (const kind of kinds) {
      const found = report[kind]
      if (found.length > 0)
        problems[kind] = found.map(item =>
          'label' in item ? item.label : item.el
        )
    }
    out[name] = Object.keys(problems).length > 0 ? problems : 'ok'
    out.scale = report.scale
  }
  const step = async (seconds: number, settleMs = 150) => {
    api.advance(seconds)
    await wait(settleMs)
  }

  api.giveUpgrade('screws')
  api.giveUpgrade('noodles')
  api.addTubs(2)
  api.readyTray(6)
  await step(0.3)
  check('wall')
  api.setView('whole')
  await step(1)
  check('whole')
  api.setView('section')
  api.trigger('heat')
  await step(0.5)
  check('heat')
  click('Shut Curtains')
  // A running heat wave keeps Call Him disabled, so let it pass.
  api.simulate(100)
  api.goto('kitchen')
  await step(1)
  api.freshBatch()
  api.startNoodles()
  api.state.fridge = {
    id: 'dev-fridge',
    label: 'Jelly setting',
    startedAt: Date.now(),
    endsAt: Date.now() + 60_000,
    durationMs: 60_000
  }
  await step(0.3)
  check('kitchen')
  for (const view of ['stove', 'bowl', 'moulds', 'sink'] as const) {
    api.openStation('overview')
    await step(0.6, 0)
    api.openStation(view)
    await step(0.6)
    check(view)
  }
  api.openStation('overview')
  await step(0.6, 0)
  api.goto('hallway')
  await step(1)
  check('hallway')
  api.goto('kitchen')
  await step(1, 0)
  api.state.fridge = null
  api.handTray(4)
  api.goto('wall')
  await step(1.2)
  check('carry')
  click('Go Back')
  await step(1.2, 0)
  // Go Back keeps the tray in your hands, and the wall would start another carry.
  api.state.tray = null
  api.goto('shop')
  await step(2.5)
  check('shop')
  click('Upgrades')
  await wait(200)
  check('upgrades')
  click('Settings')
  await wait(300)
  check('settings')
  click('Close')
  await wait(200)
  click('Chores')
  await wait(300)
  check('chores')
  click('Close')
  await wait(200)

  api.goto('wall')
  await step(2.5, 0)
  api.lockAll(0.85)
  await step(0.5)
  click('Call Uncle')
  await wait(300)
  check('report')
  click('Close')
  await wait(200)
  if (!api.callUncle()) out.callFailed = 1
  await step(7, 0)
  api.skipTouches()
  await step(1)
  check('testWhole')
  api.setView('section')
  await step(1)
  check('testSection')
  api.setView('whole')
  await step(0.5, 0)
  const victim = api.positions().proxies.find(p => p.section === 0)
  if (victim) api.sag(1, victim.id)
  for (let i = 0; i < 14 && api.final()?.stage !== 'verdict'; i++)
    await step(0.5, 40)
  await wait(300)
  check('itFell')
  out.cornerReplays = document.querySelectorAll(
    'button[aria-label^="Replay:"]'
  ).length
  api.closeVerdict()
  for (let i = 0; i < 20 && api.final()?.stage !== 'rebuild'; i++)
    await step(0.5, 30)
  api.lockAll(0.85)
  await step(0.5, 0)
  api.callUncle()
  await step(7, 0)
  api.skipTouches()
  await step(4, 0)
  for (let i = 0; i < 30 && api.state.phase !== 'ending'; i++)
    await step(0.5, 30)
  await wait(400)
  check('ending')
  out.endingScrollTop =
    document.querySelector('section[role=dialog]')?.parentElement?.scrollTop ??
    -1
  return out
}
