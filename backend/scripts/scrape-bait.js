/**
 * scrape-bait.js — Fishing Tackle (bait/lure) reference with vendor info.
 *
 * Source: FFXIV Teamcraft. Enumerates every item in UI category 33
 * (Fishing Tackle) and resolves NPC gil-shop vendors plus SpecialShop
 * scrip/currency exchanges (seller name + zone + map coords + cost).
 *
 * Output: src/baitTackleData.js  (export const BAIT_TACKLE = [...])
 * Run:    node backend/scripts/scrape-bait.js
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/';
const TACKLE_CATEGORY = 33;
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

function currencyRank(name) {
  const n = String(name || '').toLowerCase();
  if (/orange gatherers'? scrip/.test(n)) return 0;
  if (/purple gatherers'? scrip/.test(n)) return 1;
  if (/scrip/.test(n)) return 2;
  return 3;
}

async function main() {
  console.log('Fetching Teamcraft data…');
  const [items, ui, shops, npcs, places] = await Promise.all([
    getJson('items.json'),
    getJson('ui-categories.json'),
    getJson('shops.json'),
    getJson('npcs.json'),
    getJson('places.json'),
  ]);

  // Cheapest gil-shop vendor per item.
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
      if (!currency) continue;
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

  const tackleIds = Object.entries(ui).filter(([, c]) => c === TACKLE_CATEGORY).map(([id]) => Number(id));
  const raw = tackleIds
    .map((id) => {
      const name = items[id]?.en;
      if (!name) return null;
      const v = vmap.get(id);
      const s = smap.get(id);
      let vendor = null;
      if (v) {
        vendor = {
          ...npcLocation(v.npcId, npcs, places),
          price: v.price,
        };
      }
      let scrip = null;
      if (s) {
        scrip = {
          ...npcLocation(s.npcId, npcs, places),
          price: s.amount,
          currency: s.name,
        };
      }
      return { name, vendor, scrip };
    })
    .filter(Boolean);

  const byName = new Map();
  for (const row of raw) {
    const prev = byName.get(row.name);
    if (!prev) {
      byName.set(row.name, row);
      continue;
    }
    if (row.vendor && (!prev.vendor || row.vendor.price < prev.vendor.price)) prev.vendor = row.vendor;
    if (row.scrip && (!prev.scrip || currencyRank(row.scrip.currency) < currencyRank(prev.scrip.currency) || (
      currencyRank(row.scrip.currency) === currencyRank(prev.scrip.currency) && row.scrip.price < prev.scrip.price
    ))) {
      prev.scrip = row.scrip;
    }
  }

  const out = [...byName.values()]
    .sort((a, b) => {
      // Vendor/scrip-buyable first (cheapest), then the rest alphabetically.
      const aBuy = !!(a.vendor || a.scrip), bBuy = !!(b.vendor || b.scrip);
      if (aBuy !== bBuy) return aBuy ? -1 : 1;
      if (a.vendor && b.vendor) return a.vendor.price - b.vendor.price || a.name.localeCompare(b.name);
      if (a.scrip && b.scrip) return currencyRank(a.scrip.currency) - currencyRank(b.scrip.currency)
        || a.scrip.price - b.scrip.price || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  const withV = out.filter((b) => b.vendor).length;
  const withS = out.filter((b) => b.scrip).length;
  console.log(`Fishing Tackle items: ${out.length} (with gil vendor: ${withV}, with scrip/currency: ${withS})`);

  const dest = path.join(__dirname, '..', '..', 'src', 'baitTackleData.js');
  const body =
    '/* Generated by backend/scrape-bait.js from FFXIV Teamcraft (UI category 33,\n' +
    '   Fishing Tackle). Each entry: { name, vendor: { npc, zone, coords, price } | null,\n' +
    '   scrip: { npc, zone, coords, price, currency } | null }.\n' +
    '   Re-run the scraper to refresh. */\n' +
    'export const BAIT_TACKLE = ' + JSON.stringify(out) + '\n';
  fs.writeFileSync(dest, body, 'utf8');
  console.log(`Wrote ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
