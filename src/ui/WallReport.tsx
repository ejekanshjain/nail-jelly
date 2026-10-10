import type { Grade, SectionState } from '../game/types'
import type { Game } from '../scenes/game'
import { Button, cn, Modal, useStore } from '../shared'

const GRADE_CLASSES: Record<Grade, string> = {
  A: 'bg-marker-green text-white',
  B: 'bg-marker-blue text-white',
  C: 'bg-marker-orange text-ink',
  D: 'bg-marker-red text-white'
}

/** One section's line in the report: blocks, weakest grip and fixings per block. */
function sectionLine(section: SectionState) {
  const blocks = section.snapshot.length
  let fixings = 0
  for (const block of section.snapshot) fixings += block.fixings.length
  return {
    blocks,
    weakest: Math.round(section.weakestGrip * 100),
    perBlock: blocks > 0 ? (fixings / blocks).toFixed(1) : '0'
  }
}

/**
 * The Wall Report: each locked section's grade, weakest grip and fixings per block, and
 * the button that calls your uncle for the final test. It opens from Call Uncle (U).
 */
export function WallReport({ game }: { game: Game }) {
  const open = useStore(game.report, s => s.open)
  const blocker = useStore(game.hud, s => s.callBlocker)
  const attempt = useStore(game.hud, s => s.attempt)
  const close = () => game.report.set({ open: false })
  return (
    <Modal
      open={open}
      onClose={close}
      title="Wall Report"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Not Yet
          </Button>
          <Button
            disabled={blocker !== null}
            onClick={() => {
              close()
              game.finalTest.call()
            }}
          >
            Call Him
          </Button>
        </>
      }
    >
      {open && (
        <>
          <p className="leading-snug">
            {attempt > 0
              ? 'Every section is back under cling film. He snips it all off again, and the same fly and slam come back.'
              : 'Your uncle snips off every lock. All 60 blocks must hold for 60 seconds at once.'}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {game.state.sections.map(section => {
              const line = sectionLine(section)
              return (
                <li
                  key={section.index}
                  className="flex items-center gap-3 rounded-sketch-alt border-2 border-ink/30 px-3 py-1.5"
                >
                  <span
                    aria-label={`Grade ${section.grade ?? 'none'}`}
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink font-marker text-2xl',
                      section.grade
                        ? GRADE_CLASSES[section.grade]
                        : 'bg-paper-dark'
                    )}
                  >
                    {section.grade ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-marker text-lg">
                      Section {section.index + 1}
                    </span>
                    <span className="block text-lg text-ink-soft">
                      Weakest grip {line.weakest}%, {line.perBlock} nails per
                      block
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-lg leading-snug text-ink-soft">
            {blocker ??
              'You get 20 seconds of last touches before his clock starts.'}
          </p>
        </>
      )}
    </Modal>
  )
}
