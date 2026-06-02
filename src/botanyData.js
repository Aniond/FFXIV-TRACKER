/* ============================================================
   botanyData.js — botanical node catalog + leaf-type color system.

   Node shape:
   {
     id, name, zone, expansion: 'Dawntrail' | 'Endwalker',
     type: 'Regular' | 'Unspoiled' | 'Ephemeral' | 'Legendary',
     coords: 'X:.., Y:..',
     level: '100' | '100★' | '100★★',
     time: string,
     window: null | { open:[h,m], close:[h,m] },
     items: [ { name, tag, icon }, ... ],
   }

   tag  ∈ common | collectable | aetherial | legendary
   icon ∈ 'leaf' | 'herb'
   ============================================================ */

export const NODE_TYPES = {
  Regular:   { color: 'var(--moss)',    word: 'Regular'   },
  Unspoiled: { color: 'var(--pollen)',  word: 'Unspoiled' },
  Ephemeral: { color: 'var(--blossom)', word: 'Ephemeral' },
  Legendary: { color: 'var(--verdant)', word: 'Legendary' },
}

export const TYPE_ORDER = ['All', 'Regular', 'Unspoiled', 'Ephemeral', 'Legendary']

export const ITEM_TAG = {
  common: 'Common', collectable: 'Collectable', aetherial: 'Aetherial', legendary: 'Legendary',
}

export const ITEM_COLOR = {
  common: 'var(--moss)', collectable: 'var(--pollen)', aetherial: 'var(--blossom)', legendary: 'var(--verdant)',
}

export const BOTANY_NODES = [

  // ================================================================
  // ENDWALKER
  // ================================================================

  // ---- Labyrinthos ----
  { id: 'logging-labyrinthos-integral-log', name: 'Labyrinthos', gatherType: 'Logging', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:21.4, Y:9.2', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Integral Log',              tag: 'common', icon: 'leaf' },
      { name: 'Sharlayan Kudzu Vine',      tag: 'common', icon: 'herb' },
      { name: 'Aetheroconductive Fiber',   tag: 'common', icon: 'herb' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-labyrinthos-apricot', name: 'Labyrinthos', gatherType: 'Harvesting', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:16.2, Y:23.5', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Apricot',                   tag: 'common', icon: 'herb' },
      { name: 'Poppyseed',                 tag: 'common', icon: 'herb' },
      { name: 'Sharlayan Staple',          tag: 'common', icon: 'herb' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-labyrinthos-rarefied-apricot', name: 'Labyrinthos', gatherType: 'Harvesting', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:23.8, Y:18.4', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Rarefied Apricot',          tag: 'collectable', icon: 'herb' },
    ] },

  // ---- Thavnair ----
  { id: 'logging-thavnair-turali-wood', name: 'Thavnair', gatherType: 'Logging', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:24.7, Y:7.8', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Turali Wood',               tag: 'common', icon: 'leaf' },
      { name: 'Hannish Flax',              tag: 'common', icon: 'herb' },
      { name: 'Water Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-thavnair-thavnairian-mistletoe', name: 'Thavnair', gatherType: 'Harvesting', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:31, Y:18', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Thavnairian Mistletoe',     tag: 'common', icon: 'herb' },
      { name: 'Star Anise',                tag: 'common', icon: 'herb' },
      { name: 'Water Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-thavnair-rarefied-turali-wood', name: 'Thavnair', gatherType: 'Logging', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:14.9, Y:26.1', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Rarefied Turali Wood',      tag: 'collectable', icon: 'leaf' },
    ] },

  // ---- Garlemald ----
  { id: 'logging-garlemald-garlean-fiber', name: 'Garlemald', gatherType: 'Logging', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:22.4, Y:14.3', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Garlean Fiber',             tag: 'common', icon: 'herb' },
      { name: 'Eblan Dandelion',           tag: 'common', icon: 'herb' },
      { name: 'Garlean Staple',            tag: 'common', icon: 'herb' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-garlemald-frost-cotton', name: 'Garlemald', gatherType: 'Harvesting', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:15.3, Y:28.1', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Frost Cotton Boll',         tag: 'common', icon: 'herb' },
      { name: 'Bleached Bark',             tag: 'common', icon: 'leaf' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-garlemald-frozen-grove', name: 'Garlemald', gatherType: 'Logging', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:18, Y:15', level: '90★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Bleached Bark',    tag: 'collectable', icon: 'leaf' },
      { name: 'Rarefied Frost Cotton Boll',tag: 'collectable', icon: 'herb' },
    ] },
  { id: 'harvesting-garlemald-ghostly-umbral-bloom', name: 'Garlemald', gatherType: 'Harvesting', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Ephemeral', coords: 'X:8.7, Y:19.2', level: '90', time: 'ET 8:00–12:00', window: { open: [8, 0], close: [12, 0] },
    items: [
      { name: 'Ghostly Umbral Bloom',      tag: 'aetherial', icon: 'herb' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },

  // ---- Mare Lamentorum ----
  { id: 'logging-mare-lamentorum-lunar-log', name: 'Mare Lamentorum', gatherType: 'Logging', zone: 'Mare Lamentorum', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:17.5, Y:9.3', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Lunar Log',                 tag: 'common', icon: 'leaf' },
      { name: 'Lunar Staple',              tag: 'common', icon: 'herb' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-mare-lamentorum-selenite-bark', name: 'Mare Lamentorum', gatherType: 'Harvesting', zone: 'Mare Lamentorum', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:30.4, Y:21.6', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Selenite Bark',             tag: 'common', icon: 'leaf' },
      { name: 'Moongrass',                 tag: 'common', icon: 'herb' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-mare-lamentorum-lunar-flower', name: 'Mare Lamentorum', gatherType: 'Harvesting', zone: 'Mare Lamentorum', expansion: 'Endwalker',
    type: 'Ephemeral', coords: 'X:24.8, Y:33.1', level: '90', time: 'ET 0:00–6:00', window: { open: [0, 0], close: [6, 0] },
    items: [
      { name: 'Lunar Flower',              tag: 'aetherial', icon: 'herb' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },

  // ---- Elpis ----
  { id: 'logging-elpis-ambrosial-wood', name: 'Elpis', gatherType: 'Logging', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:19.9, Y:7.4', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Ambrosial Wood',            tag: 'common', icon: 'leaf' },
      { name: 'Elpis Staple',              tag: 'common', icon: 'herb' },
      { name: 'Fire Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-elpis-poieten-bloom', name: 'Elpis', gatherType: 'Harvesting', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Ephemeral', coords: 'X:26, Y:22', level: '90', time: 'ET 14:00–18:00', window: { open: [14, 0], close: [18, 0] },
    items: [
      { name: 'Aetherial Pollen',          tag: 'aetherial', icon: 'herb' },
      { name: 'Ambrosia Leaf',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-elpis-rarefied-ambrosial-wood', name: 'Elpis', gatherType: 'Logging', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:31.2, Y:15.4', level: '90★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Ambrosial Wood',   tag: 'collectable', icon: 'leaf' },
      { name: 'Rarefied Elpis Staple',     tag: 'collectable', icon: 'herb' },
    ] },

  // ---- Ultima Thule ----
  { id: 'logging-ultima-thule-primal-hardwood', name: 'Ultima Thule', gatherType: 'Logging', zone: 'Ultima Thule', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:11.3, Y:29.4', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Primal Hardwood',           tag: 'common', icon: 'leaf' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-ultima-thule-deepvoid-blossom', name: 'Ultima Thule', gatherType: 'Harvesting', zone: 'Ultima Thule', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:25.7, Y:11.8', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Deepvoid Blossom',          tag: 'common', icon: 'herb' },
      { name: 'Void Vine',                 tag: 'common', icon: 'herb' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-ultima-thule-rarefied-primal-hardwood', name: 'Ultima Thule', gatherType: 'Logging', zone: 'Ultima Thule', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:19.4, Y:17.2', level: '90★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Primal Hardwood',  tag: 'collectable', icon: 'leaf' },
    ] },

  // ================================================================
  // DAWNTRAIL
  // ================================================================

  // ---- Urqopacha ----
  { id: 'logging-urqopacha-worqor-bark', name: 'Worqor Lar Dor Glade', gatherType: 'Logging', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:23, Y:15', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Worqor Bark',               tag: 'common', icon: 'leaf' },
      { name: 'Old World Fig Leaf',        tag: 'common', icon: 'leaf' },
      { name: 'Moongrass',                 tag: 'common', icon: 'herb' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-urqopacha-turali-hemp', name: 'Urqopacha', gatherType: 'Harvesting', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:29.1, Y:27.3', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Turali Hemp',               tag: 'common', icon: 'herb' },
      { name: 'Mountain Herb',             tag: 'common', icon: 'herb' },
      { name: 'Wind Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-urqopacha-rarefied-turali-hemp', name: 'Urqopacha', gatherType: 'Harvesting', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:36.1, Y:29.2', level: '100★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Turali Hemp',      tag: 'collectable', icon: 'herb' },
    ] },

  // ---- Kozama'uka ----
  { id: 'harvesting-kozamauka-jungle-thicket', name: "Uw'ghann Jungle Thicket", gatherType: 'Harvesting', zone: "Kozama'uka", expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:19, Y:28', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Cotton Boll',               tag: 'common', icon: 'herb' },
      { name: 'Tropical Resin',            tag: 'common', icon: 'leaf' },
      { name: 'Water Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-kozamauka-teak-log', name: "Kozama'uka", gatherType: 'Logging', zone: "Kozama'uka", expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:7.5, Y:19.2', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Teak Log',                  tag: 'common', icon: 'leaf' },
      { name: "Kozama'uka Staple",         tag: 'common', icon: 'herb' },
      { name: 'Water Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-kozamauka-rarefied-teak-log', name: "Kozama'uka", gatherType: 'Logging', zone: "Kozama'uka", expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:6.8, Y:7.3', level: '95★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Teak Log',         tag: 'collectable', icon: 'leaf' },
    ] },

  // ---- Yak T'el ----
  { id: 'logging-yak-tel-ancient-stand', name: 'Ancient Stand', gatherType: 'Logging', zone: "Yak T'el", expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:21, Y:32', level: '100★', time: 'ET 10:00 / 22:00', window: { open: [10, 0], close: [12, 0] },
    items: [
      { name: "Yak T'el Hardwood Log",     tag: 'collectable', icon: 'leaf' },
      { name: 'Spirit Bark',               tag: 'collectable', icon: 'leaf' },
    ] },
  { id: 'harvesting-yak-tel-forest-herbs', name: "Yak T'el", gatherType: 'Harvesting', zone: "Yak T'el", expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:11.6, Y:19.3', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Forest Fiber',              tag: 'common', icon: 'herb' },
      { name: 'Jade Vine',                 tag: 'common', icon: 'herb' },
      { name: 'Ice Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-yak-tel-canopy-wood', name: "Yak T'el", gatherType: 'Logging', zone: "Yak T'el", expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:32.7, Y:8.5', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Canopy Wood',               tag: 'common', icon: 'leaf' },
      { name: 'Heartwood',                 tag: 'common', icon: 'leaf' },
      { name: 'Ice Crystal',               tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-yak-tel-rarefied-forest-fiber', name: "Yak T'el", gatherType: 'Harvesting', zone: "Yak T'el", expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:9.1, Y:23.5', level: '100★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Forest Fiber',     tag: 'collectable', icon: 'herb' },
      { name: 'Rarefied Jade Vine',        tag: 'collectable', icon: 'herb' },
    ] },

  // ---- Shaaloani ----
  { id: 'harvesting-shaaloani-aetherial-bloom', name: 'Aetherial Bloom', gatherType: 'Harvesting', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Ephemeral', coords: 'X:32, Y:27', level: '100', time: 'ET 4:00–8:00', window: { open: [4, 0], close: [8, 0] },
    items: [
      { name: 'Aetherial Sap',             tag: 'aetherial', icon: 'herb' },
      { name: 'Spirit Pollen',             tag: 'aetherial', icon: 'herb' },
    ] },
  { id: 'logging-shaaloani-amber-locust-wood', name: 'Shaaloani', gatherType: 'Logging', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:32.2, Y:5.8', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Locust Wood',               tag: 'common', icon: 'leaf' },
      { name: 'Amber Resin',               tag: 'common', icon: 'leaf' },
      { name: 'Fire Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-shaaloani-desert-sage', name: 'Shaaloani', gatherType: 'Harvesting', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:13.1, Y:8.8', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Desert Sage',               tag: 'common', icon: 'herb' },
      { name: 'Sun-Dried Fiber',           tag: 'common', icon: 'herb' },
      { name: 'Fire Crystal',              tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-shaaloani-rarefied-locust-wood', name: 'Shaaloani', gatherType: 'Logging', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:9.1, Y:23.7', level: '100★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Locust Wood',      tag: 'collectable', icon: 'leaf' },
      { name: 'Rarefied Amber Resin',      tag: 'collectable', icon: 'leaf' },
    ] },

  // ---- Heritage Found ----
  { id: 'logging-heritage-found-primordial-grove', name: 'Primordial Grove', gatherType: 'Logging', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Legendary', coords: 'X:28, Y:19', level: '100★★', time: 'ET 2:00 / 14:00', window: { open: [2, 0], close: [4, 0] },
    items: [
      { name: 'Primordial Resin',          tag: 'legendary', icon: 'leaf' },
      { name: 'Allagan Timber',            tag: 'legendary', icon: 'leaf' },
    ] },
  { id: 'logging-heritage-found-ancient-oak', name: 'Heritage Found', gatherType: 'Logging', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:28.3, Y:21.4', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Ancient Oak Log',           tag: 'common', icon: 'leaf' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-heritage-found-starbloom', name: 'Heritage Found', gatherType: 'Harvesting', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:15.3, Y:22.1', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Starbloom',                 tag: 'common', icon: 'herb' },
      { name: "Ra'Kaznar Fiber",           tag: 'common', icon: 'herb' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-heritage-found-dewdrop-cotton', name: 'Heritage Found', gatherType: 'Harvesting', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Ephemeral', coords: 'X:26.2, Y:12.1', level: '100', time: 'ET 20:00–0:00', window: { open: [20, 0], close: [0, 0] },
    items: [
      { name: 'Dewdrop Cotton Boll',       tag: 'aetherial', icon: 'herb' },
      { name: 'Earth Crystal',             tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'logging-heritage-found-rarefied-ancient-oak', name: 'Heritage Found', gatherType: 'Logging', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:33.9, Y:8.2', level: '100★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Ancient Oak Log',  tag: 'collectable', icon: 'leaf' },
      { name: "Rarefied Ra'Kaznar Fiber",  tag: 'collectable', icon: 'herb' },
    ] },

  // ---- Living Memory ----
  { id: 'logging-living-memory-dreaming-stand', name: 'Dreaming Stand', gatherType: 'Logging', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:12, Y:23', level: '100★', time: 'ET 18:00 / 6:00', window: { open: [18, 0], close: [20, 0] },
    items: [
      { name: 'Memory Blossom',            tag: 'collectable', icon: 'herb' },
      { name: 'Resonant Fiber',            tag: 'collectable', icon: 'herb' },
    ] },
  { id: 'logging-living-memory-echo-wood', name: 'Living Memory', gatherType: 'Logging', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:9.2, Y:14.8', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Echo Wood',                 tag: 'common', icon: 'leaf' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-living-memory-remembrance-herb', name: 'Living Memory', gatherType: 'Harvesting', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:34.7, Y:17.8', level: '100', time: 'Any', window: null,
    items: [
      { name: 'Remembrance Herb',          tag: 'common', icon: 'herb' },
      { name: 'Soft Ash Fiber',            tag: 'common', icon: 'herb' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },
  { id: 'harvesting-living-memory-rarefied-remembrance-herb', name: 'Living Memory', gatherType: 'Harvesting', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:24.3, Y:17.1', level: '100★', time: 'See Unspoiled Nodes list', window: null,
    items: [
      { name: 'Rarefied Remembrance Herb', tag: 'collectable', icon: 'herb' },
    ] },
  { id: 'harvesting-living-memory-brightleaf', name: 'Living Memory', gatherType: 'Harvesting', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Ephemeral', coords: 'X:10.4, Y:10.9', level: '100', time: 'ET 0:00–6:00', window: { open: [0, 0], close: [6, 0] },
    items: [
      { name: 'Brightleaf',                tag: 'aetherial', icon: 'herb' },
      { name: 'Lightning Crystal',         tag: 'aetherial', icon: 'leaf' },
    ] },
]
