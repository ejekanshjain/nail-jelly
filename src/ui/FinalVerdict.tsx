import type { Game } from '../scenes/game'
import { Button, Modal, ReplayPlayer, useStore } from '../shared'

/** The verdict replay plays at this speed: slow, but quicker than the corner replay. */
const VERDICT_SPEED = 0.5

/**
 * A failed final-test attempt: the fall in slow motion, how close you came, and which
 * section his door slam will shake off. Closing it sends him to the door.
 */
export function FinalVerdict({ game }: { game: Game }) {
  const verdict = useStore(game.hud, s => s.verdict)
  const replay = useStore(game.hud, s => s.replay)
  const close = () => game.finalTest.closeVerdict()
  return (
    <Modal
      open={verdict !== null}
      onClose={close}
      title="It Fell"
      footer={<Button onClick={close}>Fix It</Button>}
    >
      {verdict && (
        <>
          {replay && replay.id > verdict.replayAfter && (
            <ReplayPlayer
              key={verdict.id}
              clip={replay.clip}
              speed={VERDICT_SPEED}
              label={verdict.caption}
              loop
            />
          )}
          <p className="mt-3 text-center font-marker text-2xl leading-tight text-marker-red">
            {verdict.line}
          </p>
          <p className="mt-2 text-center leading-snug">{verdict.note}</p>
        </>
      )}
    </Modal>
  )
}
