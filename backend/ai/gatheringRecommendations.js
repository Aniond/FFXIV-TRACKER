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
const FISHING_INTENT = /\b(fish|fishing|fisher|fsh|gather|gathering)\b/i;

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

function spotDetail(spot, level) {
  const parts = [
    level ? `Recommended around level ${level}` : null,
    spot.baits?.length ? `Bait: ${spot.baits.slice(0, 2).join(', ')}` : null,
    spot.weather && spot.weather !== 'Any' ? `Weather: ${spot.weather}` : null,
    spot.time && spot.time !== 'Any' ? `Time: ${spot.time}` : null,
    `Fish: ${fishList(spot).slice(0, 5).join(', ')}`,
  ];
  return parts.filter(Boolean).join(' - ');
}

function buildFishingLevelRecommendation(query, gameData) {
  if (!LEVEL_RECOMMENDATION_INTENT.test(query) || !FISHING_INTENT.test(query)) return null;
  const requestedLevel = extractRequestedLevel(query);
  if (!requestedLevel) {
    return {
      type: 'fishing',
      summary: 'Tell me your Fisher level and I can recommend a zone, fishing hole, bait, and target fish from the database.',
      results: [],
      tips: ['Try asking: "I am level 95 Fisher. Where should I fish?"'],
    };
  }

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
  const fish = fishList(best.spot).slice(0, 3).join(', ');
  return {
    type: 'fishing',
    summary: `At Fisher level ${requestedLevel}, start in ${best.spot.zone} at ${best.spot.name}. Good targets there include ${fish}.`,
    results: picks.map(({ spot, level }) => ({
      name: spot.name,
      category: 'fishing',
      zone: spot.zone,
      coords: spot.coords || '',
      timed: false,
      window: '',
      detail: spotDetail(spot, level),
    })),
    tips: [
      'Use Versatile Lure if the spot supports it; it keeps the route simple while leveling.',
      'Move to the next recommended zone once catches slow down or your job quests push you forward.',
    ],
  };
}

module.exports = {
  buildFishingLevelRecommendation,
  extractRequestedLevel,
  spotLevel,
};
