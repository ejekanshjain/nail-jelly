import type { NewChore } from '../shared'
import type { RoomId } from './rooms'
import type { Room } from './types'

/** A chore the game can open, and the room where you do it. */
export interface ChoreDef extends NewChore {
  room: RoomId
}

/** Every chore the game opens, and the room where you do it. */
export const CHORES = {
  mopKitchen: {
    id: 'mop-kitchen',
    label: 'Mop the kitchen floor',
    detail: 'Splats make you slip with the next tray.',
    room: 'kitchen'
  },
  mopHallway: {
    id: 'mop-hallway',
    label: 'Mop the hallway',
    detail: 'You walk the tray right through it.',
    room: 'hallway'
  },
  mopWall: {
    id: 'mop-wall',
    label: 'Mop under the wall',
    detail: 'Fallen jelly. Scrape it into a tub first.',
    room: 'wall'
  },
  scrapeWall: {
    id: 'scrape-wall',
    label: 'Scrape the wall',
    detail: 'Old jelly makes new blocks slide off faster.',
    room: 'wall'
  },
  washBowl: {
    id: 'wash-bowl',
    label: 'Wash the bowl',
    detail: 'Dirty bowls make cloudy, weaker jelly.',
    room: 'kitchen'
  },
  washBowls: {
    id: 'wash-bowl',
    label: 'Wash the bowls',
    detail: 'Two after every stir. Dirty bowls make cloudy, weaker jelly.',
    room: 'kitchen'
  },
  scrubPot: {
    id: 'scrub-pot',
    label: 'Scrub the burnt pot',
    detail: 'It sits on the bowl in the sink, so it goes first.',
    room: 'kitchen'
  },
  boilNoodles: {
    id: 'boil-noodles',
    label: 'Boil the noodles',
    detail: 'A minute on the back hob. The batch waits for them.',
    room: 'kitchen'
  },
  drainNoodles: {
    id: 'drain-noodles',
    label: 'Drain the noodles',
    detail: 'Hold the pot and let go in the green.',
    room: 'kitchen'
  },
  cutMesh: {
    id: 'cut-mesh',
    label: 'Cut mesh',
    detail: 'Every block on the stool needs its own sheet.',
    room: 'wall'
  },
  buyGelatin: {
    id: 'buy-gelatin',
    label: 'Buy gelatin',
    detail: 'Not enough for another batch.',
    room: 'shop'
  },
  buyNails: {
    id: 'buy-nails',
    label: 'Buy nails',
    detail: 'Under 10 left. Two per block.',
    room: 'shop'
  },
  buyScrews: {
    id: 'buy-screws',
    label: 'Buy screws',
    detail: 'Nearly out. Nails still work.',
    room: 'shop'
  },
  buyMopHead: {
    id: 'buy-mop-head',
    label: 'Buy a mop head',
    detail: 'Yours is nearly worn out, and you have no spare.',
    room: 'shop'
  }
} as const satisfies Record<string, ChoreDef>

/** The mop chore for each room with a floor. */
export const MOP_CHORES = {
  kitchen: CHORES.mopKitchen,
  hallway: CHORES.mopHallway,
  wall: CHORES.mopWall
} as const satisfies Record<Room, ChoreDef>

/** The room to walk to for a chore, or null for an unknown id. */
export function choreRoom(id: string): RoomId | null {
  for (const chore of Object.values(CHORES))
    if (chore.id === id) return chore.room
  return null
}
