/**
 * scrape-crafting-gear.js - Crafting gear reference with vendor info.
 *
 * Source: FFXIV Teamcraft. Enumerates equipment that carries crafting stats
 * and resolves NPC gil-shop vendors plus SpecialShop crafters' scrip exchanges
 * (seller name + zone + map coords + cost).
 *
 * Output: src/craftingGearData.js
 * Run:    node backend/scripts/scrape-crafting-gear.js
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/';
const CRAFT_STATS = {
  70: 'craftsmanship',
  71: 'control',
  11: 'cp',
};
const SLOT_ORDER = ['Main Hand', 'Off Hand', 'Head', 'Body', 'Hands', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrists', 'Finger'];
const SLOT_LABELS = {
  MainHand: 'Main Hand',
  OffHand: 'Off Hand',
  Head: 'Head',
  Body: 'Body',
  Gloves: 'Hands',
  Legs: 'Legs',
  Feet: 'Feet',
  Ears: 'Ears',
  Neck: 'Neck',
  Wrists: 'Wrists',
  FingerL: 'Finger',
  FingerR: 'Finger',
};

const getJson = async (f) => {
  const r = await fetch(BASE + f);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.json();
};

const coordStr = (x, y) => `X:${Number(x).toFixed(1)}, Y:${Number(y).toFixed(1)}`;

function npcLocation(npcId, npcs, places) {
  const npc = npcs[npcId];
  const pos = npc?.position;
  return {
    npc: npc?.en || 'Vendor',
    zone: pos ? (places[pos.zoneid]?.en || null) : null,
    coords: pos && pos.x != null ? coordStr(pos.x, pos.y) : null,
  };
}

function slotName(categoryId, slotCategories) {
  const row = slotCategories[categoryId] || {};
  const raw = Object.entries(row).find(([key, enabled]) => enabled && SLOT_LABELS[key])?.[0];
  return SLOT_LABELS[raw] || 'Gear';
}

function currencyRank(name) {
  const n = String(name || '').toLowerCase();
  if (/orange crafters'? scrip/.test(n)) return 0;
  if (/purple crafters'? scrip/.test(n)) return 1;
  if (/crafters'? scrip/.test(n)) return 2;
  if (/scrip/.test(n)) return 3;
  return 4;
}

function statBlock(rows) {
  const stats = { craftsmanship: 0, control: 0, cp: 0 };
  for (const row of rows || []) {
    const key = CRAFT_STATS[row.ID];
    if (key) stats[key] = Math.max(stats[key] || 0, Number(row.HQ || row.NQ || 0));
  }
  return stats;
}

function hasCraftStats(stats) {
  return stats.craftsmanship > 0 || stats.control > 0 || stats.cp > 0;
}

async function main() {
  console.log('Fetching Teamcraft data...');
  const [items, equipment, itemStats, shops, npcs, places, slotCategories] = await Promise.all([
    getJson('items.json'),
    getJson('equipment.json'),
    getJson('item-stats.json'),
    getJson('shops.json'),
    getJson('npcs.json'),
    getJson('places.json'),
    getJson('equip-slot-categories.json'),
  ]);

  const vmap = new Map();
  const smap = new Map();
  for (const shop of Object.values(shops)) {
    const npcId = (shop.npcs || [])[0];
    for (const t of (shop.trades || [])) {
      if (shop.type === 'GilShop') {
        const gil = (t.currencies || []).find((c) => c.id === 1);
        if (!gil) continue;
        for (const it of (t.items || [])) {
          const prev = vmap.get(it.id);
          if (!prev || gil.amount < prev.price) vmap.set(it.id, { price: gil.amount, npcId });
        }
        continue;
      }
      if (shop.type !== 'SpecialShop') continue;
      const currency = (t.currencies || [])
        .filter((c) => c.id !== 1)
        .map((c) => ({ id: c.id, amount: c.amount, name: items[c.id]?.en || String(c.id) }))
        .sort((a, b) => currencyRank(a.name) - currencyRank(b.name) || a.amount - b.amount)[0];
      if (!currency || currencyRank(currency.name) > 2) continue;
      for (const it of (t.items || [])) {
        const prev = smap.get(it.id);
        const next = { ...currency, npcId };
        if (!prev || currencyRank(next.name) < currencyRank(prev.name) || (
          currencyRank(next.name) === currencyRank(prev.name) && next.amount < prev.amount
        )) {
          smap.set(it.id, next);
        }
      }
    }
  }

  const rows = Object.entries(equipment)
    .map(([id, equip]) => {
      const stats = statBlock(itemStats[id]);
      if (!hasCraftStats(stats)) return null;
      const name = items[id]?.en;
      if (!name) return null;
      const v = vmap.get(Number(id));
      const s = smap.get(Number(id));
      return {
        id: Number(id),
        name,
        level: Number(equip.level) || 1,
        slot: slotName(equip.equipSlotCategory, slotCategories),
        jobs: Array.isArray(equip.jobs) ? equip.jobs : [],
        stats,
        vendor: v ? { ...npcLocation(v.npcId, npcs, places), price: v.price } : null,
        scrip: s ? { ...npcLocation(s.npcId, npcs, places), price: s.amount, currency: s.name } : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.level - a.level ||
      SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) ||
      b.stats.craftsmanship - a.stats.craftsmanship ||
      a.name.localeCompare(b.name)
    ));

  const withV = rows.filter((g) => g.vendor).length;
  const withS = rows.filter((g) => g.scrip).length;
  console.log(`Crafting gear items: ${rows.length} (with gil vendor: ${withV}, with crafters' scrip: ${withS})`);

  const dest = path.join(__dirname, '..', '..', 'src', 'craftingGearData.js');
  const body =
    '/* Generated by backend/scripts/scrape-crafting-gear.js from FFXIV Teamcraft.\n' +
    '   Each entry: { id, name, level, slot, jobs, stats, vendor, scrip }.\n' +
    '   Re-run the scraper to refresh. */\n' +
    'export const CRAFTING_GEAR = ' + JSON.stringify(rows) + '\n';
  fs.writeFileSync(dest, body, 'utf8');
  console.log(`Wrote ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
