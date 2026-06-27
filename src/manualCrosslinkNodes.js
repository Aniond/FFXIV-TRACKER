// Hand-maintained crosslink nodes that are merged into generated crosslinkNodes.js.
// Keep manual rows here so backend/scripts/build-crosslink-nodes.js can regenerate
// the generated catalog without losing local data fixes.
export const MANUAL_EXTRA_BOTANY_NODES = [
  {
    id: 'xl-manual-b-birch-log',
    name: 'Voor Sian Siran',
    gatherType: 'Logging',
    zone: 'The Sea of Clouds',
    expansion: 'Heavensward',
    type: 'Regular',
    coords: 'X:26.7, Y:33.8',
    level: '60',
    time: 'Any',
    window: null,
    items: [{ name: 'Birch Log', tag: 'common', icon: 'herb' }],
  },
  {
    id: 'xl-manual-b-all-purpose-pigment',
    name: 'Bloodshore',
    gatherType: 'Logging',
    zone: 'Eastern La Noscea',
    expansion: 'A Realm Reborn',
    type: 'Regular',
    coords: 'X:27.8, Y:33.7',
    level: '30',
    time: 'Any',
    window: null,
    items: [{ name: 'All-purpose Pigment', tag: 'common', icon: 'herb' }],
  },
]

export const MANUAL_EXTRA_MINING_NODES = [
  {
    id: 'xl-manual-m-titanium-ore',
    name: 'Chocobo Forest',
    gatherType: 'Mining',
    zone: 'The Dravanian Forelands',
    expansion: 'Heavensward',
    type: 'Regular',
    coords: 'X:26.6, Y:27.3',
    level: '55',
    time: 'Any',
    window: null,
    items: [{ name: 'Titanium Ore', tag: 'common', icon: 'ore' }],
  },
  {
    id: 'xl-manual-m-mythrite-ore',
    name: 'Gorgagne Holding',
    gatherType: 'Mining',
    zone: 'Coerthas Western Highlands',
    expansion: 'Heavensward',
    type: 'Regular',
    coords: 'X:31.0, Y:12.4',
    level: '55',
    time: 'Any',
    window: null,
    items: [{ name: 'Mythrite Ore', tag: 'common', icon: 'ore' }],
  },
  {
    id: 'xl-manual-m-all-purpose-pigment',
    name: 'Cedarwood',
    gatherType: 'Quarrying',
    zone: 'Lower La Noscea',
    expansion: 'A Realm Reborn',
    type: 'Regular',
    coords: 'X:31.4, Y:16.1',
    level: '30',
    time: 'Any',
    window: null,
    items: [{ name: 'All-purpose Pigment', tag: 'common', icon: 'gem' }],
  },
]

export const MANUAL_EXTRA_FISHING_SPOTS = []
