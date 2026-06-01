/* ============================================================
   miningData.js — mining node catalog + node-type gem system.

   Node shape:
   {
     id, name, zone, expansion: 'Dawntrail' | 'Endwalker',
     type: 'Regular' | 'Unspoiled' | 'Ephemeral' | 'Legendary',
     coords: 'X:.., Y:..', level: '100' | '100★' | '100★★',
     time: string,                       // human label for the window
     window: null | { open:[h,m], close:[h,m] },   // Eorzea time; null = always up
     items: [ { name, tag, icon }, ... ],
   }
   tag ∈ common | collectable | aetherial | legendary   (drives item color)
   icon ∈ 'ore' | 'gem'
   ============================================================ */

/* node type → gem color (CSS var names defined in Mining.css) */
export const NODE_TYPES = {
  Regular:   { gem: 'var(--topaz)',    word: 'Regular' },
  Unspoiled: { gem: 'var(--sapphire)', word: 'Unspoiled' },
  Ephemeral: { gem: 'var(--amethyst)', word: 'Ephemeral' },
  Legendary: { gem: 'var(--diamond)',  word: 'Legendary' },
}
export const TYPE_ORDER = ['All', 'Regular', 'Unspoiled', 'Ephemeral', 'Legendary']

export const ITEM_TAG = { common: 'Common', collectable: 'Collectable', aetherial: 'Aetherial', legendary: 'Legendary' }
export const ITEM_COLOR = { common: 'var(--topaz)', collectable: 'var(--sapphire)', aetherial: 'var(--amethyst)', legendary: 'var(--diamond)' }

export const MINING_NODES = [
  { id: 'urq-ridge', name: 'Worqor Ridge Vein', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:18, Y:9', level: '100', time: 'Any', window: null,
    items: [ { name: 'Bismuth Ore', tag: 'common', icon: 'ore' }, { name: 'Acuity Sand', tag: 'common', icon: 'ore' }, { name: 'Quartz', tag: 'common', icon: 'gem' } ] },
  { id: 'koz-unspoiled', name: 'Hidden Lode', zone: "Kozama'uka", expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:27, Y:14', level: '100★', time: 'ET 4:00 / 16:00', window: { open: [4, 0], close: [6, 0] },
    items: [ { name: 'Dark Chestnut', tag: 'collectable', icon: 'gem' }, { name: 'Magnesite Ore', tag: 'collectable', icon: 'ore' } ] },
  { id: 'yak-ephemeral', name: 'Aetherial Seam', zone: "Yak T'el", expansion: 'Dawntrail',
    type: 'Ephemeral', coords: 'X:22, Y:30', level: '100', time: 'ET 8:00–12:00', window: { open: [8, 0], close: [12, 0] },
    items: [ { name: 'Aetherial Reduction Ore', tag: 'aetherial', icon: 'gem' }, { name: 'Crystalline Sand', tag: 'aetherial', icon: 'ore' } ] },
  { id: 'shaal-regular', name: 'Eshceyaani Outcrop', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:14, Y:20', level: '98', time: 'Any', window: null,
    items: [ { name: 'Iron Ore', tag: 'common', icon: 'ore' }, { name: 'Sunstone', tag: 'common', icon: 'gem' } ] },
  { id: 'hf-legendary', name: 'Lost Allag Core', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Legendary', coords: 'X:31, Y:12', level: '100★★', time: 'ET 0:00 / 12:00', window: { open: [0, 0], close: [2, 0] },
    items: [ { name: 'Allagan Tin Ore', tag: 'legendary', icon: 'gem' }, { name: 'Dimythrite Ore', tag: 'legendary', icon: 'ore' } ] },
  { id: 'lm-unspoiled', name: 'Memory Geode', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:9, Y:17', level: '100★', time: 'ET 20:00 / 8:00', window: { open: [20, 0], close: [22, 0] },
    items: [ { name: 'Ophiotauros Leather Ore', tag: 'collectable', icon: 'gem' }, { name: 'Resonant Quartz', tag: 'collectable', icon: 'gem' } ] },
  // ---- Endwalker ----
  { id: 'thav-regular', name: 'Yedlihmad Quarry', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:24, Y:19', level: '90', time: 'Any', window: null,
    items: [ { name: 'Manganese Ore', tag: 'common', icon: 'ore' }, { name: 'Tourmaline', tag: 'common', icon: 'gem' } ] },
  { id: 'garle-unspoiled', name: 'Frozen Seam', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:20, Y:13', level: '90★', time: 'ET 2:00 / 14:00', window: { open: [2, 0], close: [4, 0] },
    items: [ { name: 'Ash Soot', tag: 'collectable', icon: 'ore' }, { name: 'Star Quartz', tag: 'collectable', icon: 'gem' } ] },
  { id: 'elpis-ephemeral', name: 'Poieten Vein', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Ephemeral', coords: 'X:29, Y:25', level: '90', time: 'ET 16:00–20:00', window: { open: [16, 0], close: [20, 0] },
    items: [ { name: 'Aetherial Quartz', tag: 'aetherial', icon: 'gem' }, { name: 'Purified Ore', tag: 'aetherial', icon: 'ore' } ] },
]
