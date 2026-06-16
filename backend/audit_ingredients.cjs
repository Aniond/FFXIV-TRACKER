require('dotenv').config({ path: '../backend/.env' });
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runAudit() {
  const res = await pool.query('SELECT ingredients FROM recipes');
  const recipes = res.rows;
  const gameData = JSON.parse(fs.readFileSync('./ai/gameData.json', 'utf8'));

  const overridesRes = await pool.query('SELECT item_name FROM ingredient_overrides');
  const overrides = new Set(overridesRes.rows.map(r => r.item_name.toLowerCase()));

  const gatheredSources = ['Botany', 'Mining', 'Fishing', 'botany', 'mining', 'fishing'];

  // Build sets of known gathered items from gameData
  const knownBotany = new Set();
  const knownMining = new Set();
  const knownFishing = new Set();

  for (const node of gameData.botany || []) {
    if (node.items) node.items.forEach(i => knownBotany.add(i.toLowerCase()));
  }
  for (const node of gameData.mining || []) {
    if (node.items) node.items.forEach(i => knownMining.add(i.toLowerCase()));
  }
  for (const spot of gameData.fishing || []) {
    if (spot.fishes) spot.fishes.forEach(f => knownFishing.add(f.toLowerCase()));
  }

  const missing = new Set();
  const missingBySource = { Botany: new Set(), Mining: new Set(), Fishing: new Set() };

  for (const r of recipes) {
    for (const ing of (r.ingredients || [])) {
      const source = (ing.source || '').toLowerCase();
      if (gatheredSources.includes(source)) {
        const name = ing.name.toLowerCase();
        // Check if it exists in overrides
        if (overrides.has(name)) continue;

        // Check if it exists in gameData
        let found = false;
        if (ing.source.toLowerCase() === 'botany' && knownBotany.has(name)) found = true;
        if (ing.source.toLowerCase() === 'mining' && knownMining.has(name)) found = true;
        if (ing.source.toLowerCase() === 'fishing' && knownFishing.has(name)) found = true;

        if (!found) {
          missing.add(ing.name);
          const s = ing.source.charAt(0).toUpperCase() + ing.source.slice(1).toLowerCase();
          missingBySource[s].add(ing.name);
        }
      }
    }
  }

  console.log('--- AUDIT RESULTS ---');
  console.log(`Missing Botany: ${missingBySource.Botany.size}`);
  Array.from(missingBySource.Botany).forEach(x => console.log('  - ' + x));

  console.log(`Missing Mining: ${missingBySource.Mining.size}`);
  Array.from(missingBySource.Mining).forEach(x => console.log('  - ' + x));

  console.log(`Missing Fishing: ${missingBySource.Fishing.size}`);
  Array.from(missingBySource.Fishing).forEach(x => console.log('  - ' + x));

  process.exit(0);
}

runAudit().catch(console.error);
