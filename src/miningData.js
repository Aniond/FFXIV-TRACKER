/* ============================================================
   miningData.js — mining node catalog (auto-generated).
   Sources: consolegameswiki.com Miner_Node_Locations + Unspoiled_Nodes
   Weather defaults to null; enrich timed entries as needed.
   ============================================================ */

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
  { id: 'reg-urqopacha-mineral-deposit-95', name: 'Urqopacha Mineral Deposit', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:15, Y:29', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Lar Ore', tag: 'common', icon: 'ore' },
      { name: 'Wind Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-urqopacha-rocky-outcrop-95', name: 'Urqopacha Rocky Outcrop', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:28, Y:30', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Mountain Rock Salt', tag: 'common', icon: 'gem' },
      { name: 'Wind Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-urqopacha-mineral-deposit-95', name: 'Urqopacha Mineral Deposit', zone: 'Urqopacha', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:13, Y:13', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Mountain Chromite Ore', tag: 'common', icon: 'ore' },
      { name: 'Wind Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-kozama-uka-mineral-deposit-95', name: 'Kozama\'uka Mineral Deposit', zone: 'Kozama\'uka', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:9, Y:13', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Raw Ihuykanite', tag: 'common', icon: 'ore' },
      { name: 'Water Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-kozama-uka-mineral-deposit-95', name: 'Kozama\'uka Mineral Deposit', zone: 'Kozama\'uka', expansion: 'Dawntrail',
    type: 'Regular', coords: 'X:38, Y:22', level: '95', time: 'Any', window: null,
    items: [
      { name: 'Rarefied Raw Ihuykanite', tag: 'common', icon: 'ore' },
    ] },
  { id: 'unspoiled-living-memory-rarefied-ash-soil', name: 'Living Memory Unspoiled Node', zone: 'Living Memory', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:25, Y:17', level: '100★', time: 'ET 0:00 / 12:00', window: { open: [0,0], close: [4,0] },
    items: [
      { name: 'Rarefied Ash Soil ', tag: 'collectable', icon: 'gem' },
    ] },
  { id: 'unspoiled-heritage-found-rarefied-ra-kaznar-ore', name: 'Heritage Found Unspoiled Node', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:34, Y:8', level: '100★', time: 'ET 4:00 / 16:00', window: { open: [4,0], close: [8,0] },
    items: [
      { name: 'Rarefied Ra\'Kaznar Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-heritage-found-rarefied-white-gold-ore', name: 'Heritage Found Unspoiled Node', zone: 'Heritage Found', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:38, Y:8', level: '98', time: 'ET 4:00 / 16:00', window: { open: [4,0], close: [8,0] },
    items: [
      { name: 'Rarefied White Gold Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-shaaloani-rarefied-magnesite-ore', name: 'Shaaloani Unspoiled Node', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:9, Y:24', level: '100', time: 'ET 8:00 / 20:00', window: { open: [8,0], close: [12,0] },
    items: [
      { name: 'Rarefied Magnesite Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-shaaloani-rarefied-titanium-gold-ore', name: 'Shaaloani Unspoiled Node', zone: 'Shaaloani', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:9, Y:24', level: '96', time: 'ET 8:00 / 20:00', window: { open: [8,0], close: [12,0] },
    items: [
      { name: 'Rarefied Titanium Gold Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-kozama-uka-rarefied-raw-dark-amber', name: 'Kozama\'uka Unspoiled Node', zone: 'Kozama\'uka', expansion: 'Dawntrail',
    type: 'Unspoiled', coords: 'X:6, Y:7', level: '93', time: 'ET 10:00 / 22:00', window: { open: [10,0], close: [14,0] },
    items: [
      { name: 'Rarefied Raw Dark Amber ', tag: 'collectable', icon: 'gem' },
    ] },
  { id: 'reg-labyrinthos-rocky-outcrop-85', name: 'Labyrinthos Rocky Outcrop', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:23, Y:10', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Chloroschist', tag: 'common', icon: 'ore' },
      { name: 'High Durium Sand', tag: 'common', icon: 'ore' },
      { name: 'Water Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-labyrinthos-mineral-deposit-85', name: 'Labyrinthos Mineral Deposit', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:30, Y:9', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Raw Ametrine', tag: 'common', icon: 'ore' },
      { name: 'Sharlayan Rock Salt', tag: 'common', icon: 'gem' },
      { name: 'Water Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-thavnair-rocky-outcrop-85', name: 'Thavnair Rocky Outcrop', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:11, Y:14', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Pewter Ore', tag: 'common', icon: 'ore' },
      { name: 'Ice Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-thavnair-mineral-deposit-85', name: 'Thavnair Mineral Deposit', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:18, Y:28', level: '85', time: 'Any', window: null,
    items: [
      { name: 'High Durium Ore', tag: 'common', icon: 'ore' },
      { name: 'Ice Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-garlemald-rocky-outcrop-85', name: 'Garlemald Rocky Outcrop', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:20, Y:27', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Eblan Alumen', tag: 'common', icon: 'gem' },
      { name: 'Phrygian Gold Ore', tag: 'common', icon: 'ore' },
      { name: 'Lightning Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-mare-lamentorum-mineral-deposit-85', name: 'Mare Lamentorum Mineral Deposit', zone: 'Mare Lamentorum', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:29, Y:35', level: '85', time: 'Any', window: null,
    items: [
      { name: 'Bismuth Ore', tag: 'common', icon: 'ore' },
      { name: 'Earth Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-elpis-mineral-deposit-90', name: 'Elpis Mineral Deposit', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:27, Y:11', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Manganese Ore', tag: 'common', icon: 'ore' },
      { name: 'Fire Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-elpis-rocky-outcrop-90', name: 'Elpis Rocky Outcrop', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:14, Y:19', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Ambrosial Water', tag: 'common', icon: 'ore' },
      { name: 'Annite', tag: 'common', icon: 'ore' },
      { name: 'Raw Blue Zircon', tag: 'common', icon: 'ore' },
      { name: 'Fire Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-ultima-thule-rocky-outcrop-90', name: 'Ultima Thule Rocky Outcrop', zone: 'Ultima Thule', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:21, Y:33', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Raw Star Quartz', tag: 'common', icon: 'gem' },
      { name: 'Wind Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'reg-ultima-thule-mineral-deposit-90', name: 'Ultima Thule Mineral Deposit', zone: 'Ultima Thule', expansion: 'Endwalker',
    type: 'Regular', coords: 'X:19, Y:13', level: '90', time: 'Any', window: null,
    items: [
      { name: 'Chondrite', tag: 'common', icon: 'ore' },
      { name: 'Wind Crystal', tag: 'common', icon: 'gem' },
    ] },
  { id: 'unspoiled-labyrinthos-rarefied-sharlayan-rock-sa', name: 'Labyrinthos Unspoiled Node', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:32, Y:21', level: '85', time: 'ET 0:00 / 12:00', window: { open: [0,0], close: [4,0] },
    items: [
      { name: 'Rarefied Sharlayan Rock Salt ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-labyrinthos-rarefied-raw-ametrine', name: 'Labyrinthos Unspoiled Node', zone: 'Labyrinthos', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:32, Y:21', level: '81', time: 'ET 0:00 / 12:00', window: { open: [0,0], close: [4,0] },
    items: [
      { name: 'Rarefied Raw Ametrine ', tag: 'collectable', icon: 'gem' },
    ] },
  { id: 'unspoiled-garlemald-rarefied-eblan-alumen', name: 'Garlemald Unspoiled Node', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:12, Y:21', level: '90', time: 'ET 2:00 / 14:00', window: { open: [2,0], close: [6,0] },
    items: [
      { name: 'Rarefied Eblan Alumen ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-garlemald-rarefied-phrygian-gold-ore', name: 'Garlemald Unspoiled Node', zone: 'Garlemald', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:12, Y:21', level: '87', time: 'ET 2:00 / 14:00', window: { open: [2,0], close: [6,0] },
    items: [
      { name: 'Rarefied Phrygian Gold Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-thavnair-rarefied-pewter-ore', name: 'Thavnair Unspoiled Node', zone: 'Thavnair', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:32, Y:25', level: '90★', time: 'ET 4:00 / 16:00', window: { open: [4,0], close: [8,0] },
    items: [
      { name: 'Rarefied Pewter Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-mare-lamentorum-rarefied-bismuth-ore', name: 'Mare Lamentorum Unspoiled Node', zone: 'Mare Lamentorum', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:16, Y:32', level: '83', time: 'ET 6:00 / 18:00', window: { open: [6,0], close: [10,0] },
    items: [
      { name: 'Rarefied Bismuth Ore ', tag: 'collectable', icon: 'ore' },
    ] },
  { id: 'unspoiled-elpis-rarefied-annite', name: 'Elpis Unspoiled Node', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:8, Y:36', level: '90★', time: 'ET 10:00 / 22:00', window: { open: [10,0], close: [14,0] },
    items: [
      { name: 'Rarefied Annite ', tag: 'collectable', icon: 'gem' },
    ] },
  { id: 'unspoiled-elpis-rarefied-blue-zircon', name: 'Elpis Unspoiled Node', zone: 'Elpis', expansion: 'Endwalker',
    type: 'Unspoiled', coords: 'X:8, Y:36', level: '89', time: 'ET 10:00 / 22:00', window: { open: [10,0], close: [14,0] },
    items: [
      { name: 'Rarefied Blue Zircon ', tag: 'collectable', icon: 'gem' },
    ] }
];
