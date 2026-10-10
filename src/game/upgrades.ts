import type { UpgradeDef } from '../shared'
import type { BatchOptions } from './kitchen'
import { MOULDS, MOULDS_BIG } from './tuning'

/** Every upgrade the shop sells. */
export type UpgradeId = 'recipe' | 'fridge' | 'screws' | 'noodles' | 'mesh'

export interface JellyUpgrade extends UpgradeDef {
  id: UpgradeId
}

/** Each upgrade helps a little and adds a chore. Prices pace them; none needs another. */
export const UPGRADES: readonly JellyUpgrade[] = [
  {
    id: 'recipe',
    name: 'Extra Gelatin Recipe',
    cost: 35,
    helps: 'Firmer blocks that hold longer.',
    newChore: 'Every batch takes more gelatin.'
  },
  {
    id: 'screws',
    name: 'Screws',
    cost: 45,
    helps: 'Hold better than nails and never split. Comes with 10.',
    newChore: 'Screw each one in with 4 slow circles.'
  },
  {
    id: 'fridge',
    name: 'Bigger Fridge',
    cost: 50,
    helps: '6 moulds per batch instead of 4.',
    newChore: 'Two bowls to wash after every stir.'
  },
  {
    id: 'noodles',
    name: 'Noodle Reinforcement',
    cost: 55,
    helps: 'Blocks tear less, take knocks better and never split.',
    newChore: 'Boil noodles for a minute with every batch, then drain them.'
  },
  {
    id: 'mesh',
    name: 'Mesh Backing',
    cost: 60,
    helps: 'Spreads the load: slower sag, fewer tears.',
    newChore: 'Cut a mesh sheet for every block before it goes up.'
  }
]

/** What the owned upgrades change about the next batch. */
export function batchOptions(owned: (id: UpgradeId) => boolean): BatchOptions {
  return {
    moulds: owned('fridge') ? MOULDS_BIG : MOULDS,
    recipe: owned('recipe'),
    noodles: owned('noodles')
  }
}
