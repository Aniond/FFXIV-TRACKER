const ZONE_LEVEL_HINTS = {
  'Old Sharlayan': 80,
  Labyrinthos: 81,
  'Radz-at-Han': 80,
  Thavnair: 82,
  Garlemald: 83,
  'Mare Lamentorum': 84,
  Elpis: 86,
  'Ultima Thule': 89,
  Elysion: 90,
  Tuliyollal: 90,
  Urqopacha: 91,
  "Kozama'uka": 92,
  "Yak T'el": 94,
  Shaaloani: 95,
  'Heritage Found': 97,
  'Solution Nine': 99,
  'Living Memory': 99,
};

const LEVEL_RECOMMENDATION_INTENT =
  /\b(recommend|suggest|where should|what should|best|leveling|level|lvl|route)\b/i;
const FISHING_INTENT = /\b(fish|fishing|fisher|fsh)\b/i;
const MINING_INTENT = /\b(mining|miner|min|ore|quarry)\b/i;
const BOTANY_INTENT = /\b(botany|botanist|btn|log|logging|harvest|herb)\b/i;
const GATHERING_INTENT = /\b(gather|gathering|gatherer|dol)\b/i;

const GATHER_STATS = new Set(['GAT', 'PER', 'GP']);
const CRAFT_STATS = new Set(['CMS', 'CTL', 'CP']);
const DEFAULT_BAIT = 'Versatile Lure';
const normKey = (s) => String(s || '').trim().toLowerCase();
const STAT_ALIASES = {
  GAT: ['gathering', 'gat'],
  PER: ['perception', 'per'],
  GP: ['gp'],
  CMS: ['craftsmanship', 'craft', 'cms'],
  CTL: ['control', 'ctl'],
  CP: ['cp'],
};

function extractRequestedLevel(query) {
  const text = String(query || '');
  const patterns = [
    /\b(?:level|lvl|lv|fisher|fsh|gather(?:ing)?)\s*(?:is|am|at|:)?\s*(\d{1,3})\b/i,
    /\b(?:i(?:'| a)?m|im|i am)\s*(?:level\s*)?(\d{1,3})\b/i,
    /\b(\d{2,3})\s*(?:fisher|fsh|fishing|gather(?:ing)?|level|lvl)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const level = Number(match[1]);
    if (Number.isInteger(level) && level >= 1 && level <= 100) return level;
  }
  return null;
}

function fishList(spot) {
  const fish = spot.fish || spot.fishes || [];
  return fish.map((f) => String(f).trim()).filter(Boolean);
}

function baitCatalogRow(spot, baitCatalog) {
  const key = `${normKey(spot.zone)}|${normKey(spot.name)}`;
  return baitCatalog?.spots?.[key] || null;
}

function baitsForSpot(spot, baitCatalog) {
  const row = baitCatalogRow(spot, baitCatalog);
  const catalogBaits = row?.baits || [];
  const spotBaits = spot.baits || [];
  const baits = catalogBaits.length ? catalogBaits : spotBaits;
  return baits.map((bait) => (Array.isArray(bait) ? bait[0] : bait)).filter(Boolean);
}

function recommendedBait(spot, baitCatalog) {
  const baits = baitsForSpot(spot, baitCatalog);
  const preferred = baits.find((bait) => bait !== DEFAULT_BAIT) || baits[0] || DEFAULT_BAIT;
  return {
    name: preferred,
    baits,
    source: baitCatalogRow(spot, baitCatalog) ? 'catalog' : 'fallback',
  };
}

function itemList(node) {
  return (node.items || []).map((item) => (
    typeof item === 'string' ? item : item?.name
  )).map((name) => String(name || '').trim()).filter(Boolean);
}

function spotLevel(spot) {
  const raw = String(spot.level || '').match(/\d+/)?.[0];
  if (raw) return Number(raw);
  return ZONE_LEVEL_HINTS[spot.zone] || null;
}

function spotScore(spot, requestedLevel) {
  const level = spotLevel(spot);
  if (!level) return Number.MAX_SAFE_INTEGER;
  const distance = Math.abs(level - requestedLevel);
  const abovePenalty = level > requestedLevel ? 3 : 0;
  const expansionBonus = spot.expansion === 'Dawntrail' ? -0.2 : spot.expansion === 'Endwalker' ? 0 : 0.2;
  return (distance * 10) + abovePenalty + expansionBonus;
}

function foodStats(food) {
  if (!food) return '';
  return (food.bonuses || [])
    .map((b) => `${b.stat} +${b.valueHQ ?? b.value}${b.maxHQ ? ` (max ${b.maxHQ})` : ''}`)
    .join(', ');
}

function statValue(stats, stat) {
  const aliases = STAT_ALIASES[stat] || [String(stat || '').toLowerCase()];
  for (const key of aliases) {
    const value = Number(stats?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function foodBonusGain(bonus, stats) {
  if (!bonus) return 0;
  const value = Number(bonus.valueHQ ?? bonus.value) || 0;
  if (!bonus.relative) return value;
  const base = statValue(stats, bonus.stat);
  if (!base) return 0;
  const percentGain = Math.floor((base * value) / 100);
  const cap = Number(bonus.maxHQ ?? bonus.max);
  return Number.isFinite(cap) && cap > 0 ? Math.min(percentGain, cap) : percentGain;
}

function foodGain(food, stats, statSet) {
  return (food?.bonuses || []).reduce((sum, bonus) => (
    sum + (statSet.has(bonus.stat) ? foodBonusGain(bonus, stats) : 0)
  ), 0);
}

function foodTierLevel(food) {
  const listed = Number(food?.level) || 0;
  if (listed > 1) return listed;
  const ilvl = Number(food?.itemLevel) || 0;
  if (ilvl >= 720) return 100;
  if (ilvl >= 650) return 95;
  if (ilvl >= 590) return 90;
  if (ilvl >= 520) return 85;
  if (ilvl >= 460) return 80;
  if (ilvl >= 400) return 75;
  if (ilvl >= 320) return 70;
  if (ilvl >= 265) return 65;
  if (ilvl >= 210) return 60;
  if (ilvl >= 130) return 55;
  if (ilvl >= 90) return 50;
  return 1;
}

function recommendFood(foods, category, requestedLevel, playerStats = null) {
  const statSet = category === 'crafting' ? CRAFT_STATS : GATHER_STATS;
  const hasStats = statSet.size && [...statSet].some((stat) => statValue(playerStats, stat) > 0);
  const candidates = (foods || [])
    .filter((food) => food.categories?.includes(category))
    .filter((food) => (food.bonuses || []).some((b) => statSet.has(b.stat)))
    .map((food) => {
      const tierLevel = foodTierLevel(food);
      const above = tierLevel > requestedLevel;
      const distance = Math.abs(tierLevel - requestedLevel);
      const statScore = (food.bonuses || []).reduce((sum, b) => sum + (statSet.has(b.stat) ? 1 : 0), 0);
      const ilvl = Number(food.itemLevel) || 0;
      const gain = hasStats ? foodGain(food, playerStats, statSet) : 0;
      const score = hasStats
        ? -gain + (above ? 20 : 0) + (distance * 0.1) - (statScore * 0.01) - (ilvl / 100000)
        : (above ? 1000 : 0) + (distance * 10) - (statScore * 0.25) - (ilvl / 10000);
      return { food, score, gain };
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0]?.food || null;
}

function targetFish(spot) {
  return fishList(spot).find((fish) => !/\(rare\)|legendary/i.test(fish)) || fishList(spot)[0] || spot.name;
}

function targetFishNotSeen(spot, seen) {
  const fish = fishList(spot);
  const target = fish.find((name) => !seen.has(name) && !/\(rare\)|legendary/i.test(name))
    || fish.find((name) => !seen.has(name))
    || targetFish(spot);
  seen.add(target);
  return target;
}

function targetItem(node) {
  return itemList(node).find((item) => !/crystal|shard|cluster|aetherial/i.test(item)) || itemList(node)[0] || node.name;
}

function spotDetail(spot, level, food, baitInfo, playerStats = null) {
  const baits = baitInfo?.baits?.length ? baitInfo.baits : baitsForSpot(spot);
  const otherBaits = baits.filter((b) => b !== baitInfo?.name).slice(0, 3);
  const gain = food ? foodGain(food, playerStats, GATHER_STATS) : 0;
  const parts = [
    `Spot: ${spot.name}`,
    level ? `Recommended around level ${level}` : null,
    baitInfo?.name ? `Recommended bait: ${baitInfo.name}` : null,
    otherBaits.length ? `Other bait options: ${otherBaits.join(', ')}` : null,
    food ? `Food: ${food.name} (${foodStats(food)}${gain ? `, +${gain} total at your stats` : ''})` : null,
    spot.weather && spot.weather !== 'Any' ? `Weather: ${spot.weather}` : null,
    spot.time && spot.time !== 'Any' ? `Time: ${spot.time}` : null,
    `Fish: ${fishList(spot).slice(0, 5).join(', ')}`,
  ];
  return parts.filter(Boolean).join(' - ');
}

function nodeDetail(node, level, food, playerStats = null) {
  const gain = food ? foodGain(food, playerStats, GATHER_STATS) : 0;
  const parts = [
    `Node: ${node.name || node.zone}`,
    level ? `Recommended around level ${level}` : null,
    node.gatherType || node.type ? [node.gatherType, node.type].filter(Boolean).join(' ') : null,
    food ? `Food: ${food.name} (${foodStats(food)}${gain ? `, +${gain} total at your stats` : ''})` : null,
    node.time && node.time !== 'Any' ? `Time: ${node.time}` : null,
    `Items: ${itemList(node).slice(0, 5).join(', ')}`,
  ];
  return parts.filter(Boolean).join(' - ');
}

function recommendationKind(query) {
  if (FISHING_INTENT.test(query)) return 'fishing';
  if (MINING_INTENT.test(query)) return 'mining';
  if (BOTANY_INTENT.test(query)) return 'botany';
  if (GATHERING_INTENT.test(query)) return 'gathering';
  return null;
}

function missingLevelAnswer(kind) {
  const label = kind === 'fishing' ? 'Fisher' : kind === 'mining' ? 'Miner' : kind === 'botany' ? 'Botanist' : 'gathering';
  return {
    type: kind === 'gathering' ? 'mixed' : kind,
    summary: `Tell me your ${label} level and I can recommend a zone, target item, and food from the database.`,
    results: [],
    tips: [`Try asking: "I am level 95 ${label}. Where should I gather?"`],
  };
}

function buildFishingAnswer(requestedLevel, gameData, foods, baitCatalog, playerStats = null) {
  const food = recommendFood(foods, 'gathering', requestedLevel, playerStats);
  const spots = (gameData?.fishing || [])
    .filter((spot) => spot?.zone && spot?.name && fishList(spot).length)
    .map((spot) => ({ spot, level: spotLevel(spot) }))
    .filter(({ level }) => level && level <= requestedLevel + 2)
    .sort((a, b) => spotScore(a.spot, requestedLevel) - spotScore(b.spot, requestedLevel));

  const picks = spots.slice(0, 3);
  if (!picks.length) {
    return {
      type: 'fishing',
      summary: `I could not find a fishing recommendation near level ${requestedLevel} in the current database.`,
      results: [],
      tips: ['Try a higher level range or ask for a specific expansion.'],
    };
  }

  const best = picks[0];
  const fish = targetFish(best.spot);
  const bait = recommendedBait(best.spot, baitCatalog);
  const gain = food ? foodGain(food, playerStats, GATHER_STATS) : 0;
  const foodText = food ? ` Eat ${food.name} for ${foodStats(food)}${gain ? `; at your stats that is +${gain} total.` : '.'}` : '';
  const seenFish = new Set();
  return {
    type: 'fishing',
    summary: `At Fisher level ${requestedLevel}, fish in ${best.spot.zone} at ${best.spot.name}. Focus on ${fish}, use ${bait.name}.${foodText}`,
    results: picks.map(({ spot, level }) => {
      const name = targetFishNotSeen(spot, seenFish);
      const baitInfo = recommendedBait(spot, baitCatalog);
      return {
        name,
        category: 'fishing',
        zone: spot.zone,
        coords: spot.coords || '',
        timed: false,
        window: '',
        detail: spotDetail(spot, level, food, baitInfo, playerStats),
      };
    }),
    tips: [
      'Use the listed bait first; Versatile Lure is the simple fallback when the spot supports it.',
      'Move to the next recommended zone once catches slow down or your job quests push you forward.',
    ],
  };
}

function buildNodeAnswer(kind, requestedLevel, gameData, foods, playerStats = null) {
  const food = recommendFood(foods, 'gathering', requestedLevel, playerStats);
  const nodes = (gameData?.[kind] || [])
    .filter((node) => node?.zone && itemList(node).length)
    .map((node) => ({ node, level: spotLevel(node) }))
    .filter(({ level }) => level && level <= requestedLevel + 2)
    .sort((a, b) => spotScore(a.node, requestedLevel) - spotScore(b.node, requestedLevel));

  const picks = nodes.slice(0, 3);
  if (!picks.length) {
    return {
      type: kind,
      summary: `I could not find a ${kind} recommendation near level ${requestedLevel} in the current database.`,
      results: [],
      tips: ['Try a higher level range or ask for a specific expansion.'],
    };
  }

  const best = picks[0];
  const item = targetItem(best.node);
  const gain = food ? foodGain(food, playerStats, GATHER_STATS) : 0;
  const foodText = food ? ` Eat ${food.name} for ${foodStats(food)}${gain ? `; at your stats that is +${gain} total.` : '.'}` : '';
  return {
    type: kind,
    summary: `At level ${requestedLevel}, gather in ${best.node.zone}. Focus on ${item}.${foodText}`,
    results: picks.map(({ node, level }) => ({
      name: targetItem(node),
      category: kind,
      zone: node.zone,
      coords: node.coords || '',
      timed: !!node.window,
      window: node.time && node.time !== 'Any' ? node.time : '',
      detail: nodeDetail(node, level, food, playerStats),
    })),
    tips: [
      'Prioritize the target item first, then fill inventory space with the other listed node items.',
      'If a timed node appears in the results, route around its Eorzea-time window.',
    ],
  };
}

function buildGatheringLevelRecommendation(query, gameData, foods = [], baitCatalog = null, playerStats = null) {
  if (!LEVEL_RECOMMENDATION_INTENT.test(query)) return null;
  const kind = recommendationKind(query);
  if (!kind) return null;
  const requestedLevel = extractRequestedLevel(query);
  if (!requestedLevel) return missingLevelAnswer(kind);
  if (kind === 'fishing') return buildFishingAnswer(requestedLevel, gameData, foods, baitCatalog, playerStats);
  if (kind === 'mining' || kind === 'botany') return buildNodeAnswer(kind, requestedLevel, gameData, foods, playerStats);
  return buildNodeAnswer('botany', requestedLevel, gameData, foods, playerStats);
}

module.exports = {
  buildGatheringLevelRecommendation,
  extractRequestedLevel,
  foodTierLevel,
  foodGain,
  recommendFood,
  recommendedBait,
  spotLevel,
};
