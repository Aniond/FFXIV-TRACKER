/**
 * scrape-food-buffs.js - compact crafting/gathering food catalog.
 *
 * Source: FFXIV Teamcraft public data on GitHub.
 * Output: backend/ai/foodBuffs.json
 *
 * Run after patches when food data changes:
 *   node backend/scripts/scrape-food-buffs.js
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/';

const STAT_ABBR = {
  CP: 'CP',
  GP: 'GP',
  Craftsmanship: 'CMS',
  Control: 'CTL',
  Gathering: 'GAT',
  Perception: 'PER',
};

const CRAFT_STATS = new Set(['CMS', 'CTL', 'CP']);
const GATHER_STATS = new Set(['GAT', 'PER', 'GP']);

async function getJson(file) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

function normalizeBonuses(food) {
  return Object.entries(food.Bonuses || {})
    .map(([stat, bonus]) => ({
      stat: STAT_ABBR[stat] || stat,
      relative: !!bonus.Relative,
      value: bonus.Value,
      valueHQ: bonus.ValueHQ ?? bonus.Value,
      max: bonus.Max ?? null,
      maxHQ: bonus.MaxHQ ?? bonus.Max ?? null,
    }))
    .filter((bonus) => CRAFT_STATS.has(bonus.stat) || GATHER_STATS.has(bonus.stat));
}

function categoriesFor(bonuses) {
  const stats = new Set(bonuses.map((b) => b.stat));
  const out = [];
  if ([...stats].some((s) => CRAFT_STATS.has(s))) out.push('crafting');
  if ([...stats].some((s) => GATHER_STATS.has(s))) out.push('gathering');
  return out;
}

async function main() {
  console.log('Fetching Teamcraft food data...');
  const [foods, items, ilvls] = await Promise.all([
    getJson('foods.json'),
    getJson('items.json'),
    getJson('ilvls.json'),
  ]);

  const out = foods
    .map((food) => {
      const bonuses = normalizeBonuses(food);
      if (!bonuses.length) return null;
      const item = items[food.ID];
      if (!item?.en) return null;
      return {
        id: food.ID,
        name: item.en,
        level: food.LevelEquip ?? null,
        itemLevel: ilvls[food.ID] ?? food.LevelItem ?? null,
        categories: categoriesFor(bonuses),
        bonuses,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.level - b.level) || (a.itemLevel - b.itemLevel) || a.name.localeCompare(b.name));

  const dest = path.join(__dirname, '..', 'ai', 'foodBuffs.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');

  const gather = out.filter((f) => f.categories.includes('gathering')).length;
  const craft = out.filter((f) => f.categories.includes('crafting')).length;
  console.log(`Wrote ${dest}`);
  console.log(`Total: ${out.length}; gathering: ${gather}; crafting: ${craft}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
