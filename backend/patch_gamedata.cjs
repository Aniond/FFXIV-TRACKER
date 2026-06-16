require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function patch() {
  const res = await pool.query('SELECT ingredients FROM recipes');
  const recipes = res.rows;
  
  const gameDataPath = './ai/gameData.json';
  const gameData = JSON.parse(fs.readFileSync(gameDataPath, 'utf8'));

  const overridesRes = await pool.query('SELECT item_name FROM ingredient_overrides');
  const overrides = new Set(overridesRes.rows.map(r => r.item_name.toLowerCase()));

  const gatheredSources = ['botany', 'mining', 'fishing'];

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

  const newNodes = {
    botany: [],
    mining: [],
    fishing: []
  };

  const processed = new Set();

  for (const r of recipes) {
    for (const ing of (r.ingredients || [])) {
      const source = (ing.source || '').toLowerCase();
      if (gatheredSources.includes(source)) {
        const name = ing.name.toLowerCase();
        if (processed.has(name) || overrides.has(name)) continue;

        let found = false;
        if (source === 'botany' && knownBotany.has(name)) found = true;
        if (source === 'mining' && knownMining.has(name)) found = true;
        if (source === 'fishing' && knownFishing.has(name)) found = true;

        if (!found) {
          processed.add(name);
          
          if (source === 'fishing') {
            newNodes.fishing.push({
              zone: ing.zone || 'Unknown Zone',
              name: ing.node_name || 'Unknown Fishing Spot',
              coords: ing.coords || '',
              level: '?',
              window: ing.window || null,
              fishes: [ing.name]
            });
            knownFishing.add(name);
          } else {
            const nodeList = source === 'botany' ? newNodes.botany : newNodes.mining;
            nodeList.push({
              zone: ing.zone || 'Unknown Zone',
              gatherType: source === 'botany' ? 'Logging/Harvesting' : 'Mining/Quarrying',
              expansion: 'Legacy',
              type: ing.node_type || (ing.window ? 'Unspoiled' : 'Regular'),
              coords: ing.coords || '',
              level: '?',
              time: ing.window ? 'Timed' : 'Any',
              window: ing.window || null,
              items: [ing.name]
            });
            source === 'botany' ? knownBotany.add(name) : knownMining.add(name);
          }
        }
      }
    }
  }

  // Merge back
  if (gameData.botany && newNodes.botany.length) gameData.botany.push(...newNodes.botany);
  if (gameData.mining && newNodes.mining.length) gameData.mining.push(...newNodes.mining);
  if (gameData.fishing && newNodes.fishing.length) gameData.fishing.push(...newNodes.fishing);

  fs.writeFileSync(gameDataPath, JSON.stringify(gameData, null, 2));

  console.log(`Patched gameData.json! Added ${newNodes.botany.length} botany, ${newNodes.mining.length} mining, ${newNodes.fishing.length} fishing nodes.`);
  process.exit(0);
}

patch().catch(console.error);
