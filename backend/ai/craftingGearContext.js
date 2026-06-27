const fs = require('fs');
const path = require('path');

function itemSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadCraftingGear() {
  const file = path.join(__dirname, '..', '..', 'src', 'craftingGearData.js');
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/export const CRAFTING_GEAR = (\[.*\])\s*$/s);
  if (!match) throw new Error('CRAFTING_GEAR export not found');
  return JSON.parse(match[1]);
}

let CRAFTING_GEAR = [];
try {
  CRAFTING_GEAR = loadCraftingGear();
} catch (err) {
  console.error('[ai/search] craftingGearData.js missing - run scripts/scrape-crafting-gear.js:', err.message);
}

function extractRequestedLevel(query) {
  const explicit = String(query || '').match(/\b(?:level|lvl|lv)\s*(\d{1,3})\b/i);
  if (explicit) return Number(explicit[1]);
  const shorthand = String(query || '').match(/\b(\d{2,3})\s*(?:crafting|crafter|crafters?|doh)\b/i);
  return shorthand ? Number(shorthand[1]) : null;
}

function queryMentionsCraftingGear(query) {
  return /\b(?:crafting|crafter|crafters?|disciple(?:s)?\s+of\s+the\s+hand|doh|gear|tool|tools|main hand|off hand|armor|accessor(?:y|ies)|saw|hammer|knife|needle|alembic|frypan|skillet|mallet|awl|grinding wheel|spinning wheel|mortar|pliers|file)\b/i
    .test(query || '');
}

function queryWantsPurchaseSource(query) {
  return /\b(?:buy|purchase|purchasable|vendor|merchant|shop|where\s+(?:can|do)\s+i\s+(?:buy|get)|where\s+to\s+(?:buy|get)|source|obtain|get|from)\b/i
    .test(query || '');
}

function queryTokens(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !['where', 'level', 'crafting', 'crafter', 'crafters', 'gear', 'tools', 'item'].includes(token));
}

function gearMatchesTerm(gear, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const hay = `${gear.name} ${gear.slot || ''} ${(gear.jobs || []).join(' ')}`.toLowerCase();
  return tokens.some((token) => hay.includes(token));
}

function sourceRank(gear) {
  if (gear.vendor) return 0;
  if (gear.scrip) return 1;
  return 2;
}

function compactGear(row) {
  const vendor = row.vendor
    ? {
        npc: row.vendor.npc,
        zone: row.vendor.zone,
        coords: row.vendor.coords,
        price: row.vendor.price,
        currency: 'gil',
      }
    : null;
  const scrip = row.scrip
    ? {
        npc: row.scrip.npc,
        zone: row.scrip.zone,
        coords: row.scrip.coords,
        price: row.scrip.price,
        currency: row.scrip.currency,
      }
    : null;

  return {
    id: row.id,
    name: row.name,
    level: row.level,
    slot: row.slot,
    jobs: row.jobs,
    vendor,
    scrip,
    marketBoard: row.id ? { itemId: row.id } : null,
    source_url: `/item/${itemSlug(row.name)}`,
  };
}

function craftingGearContextForQuery(query, rows = CRAFTING_GEAR, limit = 18) {
  if (!queryMentionsCraftingGear(query)) return [];
  const requestedLevel = extractRequestedLevel(query);
  const wantsSource = queryWantsPurchaseSource(query);

  return rows
    .filter((gear) => gear && gear.name && gearMatchesTerm(gear, query))
    .filter((gear) => {
      const level = Number(gear.level);
      if (!Number.isFinite(level)) return false;
      if (!requestedLevel) return true;
      if (wantsSource && level > requestedLevel) return false;
      return Math.abs(level - requestedLevel) <= 5;
    })
    .sort((a, b) => {
      const levelA = Number(a.level) || 0;
      const levelB = Number(b.level) || 0;
      if (requestedLevel) {
        return Math.abs(levelA - requestedLevel) - Math.abs(levelB - requestedLevel)
          || sourceRank(a) - sourceRank(b)
          || levelB - levelA
          || a.name.localeCompare(b.name);
      }
      return sourceRank(a) - sourceRank(b)
        || levelB - levelA
        || a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map(compactGear);
}

module.exports = {
  CRAFTING_GEAR,
  craftingGearContextForQuery,
  extractRequestedLevel,
  itemSlug,
};
