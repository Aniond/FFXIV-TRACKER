const BASE = 'https://xivapi.com';
async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'ffxivlog.com/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

// Working formula derived from verifying against known in-game coords:
// Scholar's Harbor (FishingSpot 252): xivapi raw X=1074, sf=200 → in-game X:11
// Central Shroud Crayfish (FishingSpot 2): raw X=1094, sf=100 → in-game X:~23
function toCoord(raw, sizeFactor) {
  if (raw == null || sizeFactor == null || sizeFactor === 0) return null;
  const scale = 100.0 / sizeFactor;
  return Math.round((1 + 40 * raw * scale / 2048) * 10) / 10;
}

(async () => {
  // Full raw response for a DT mining point — see all fields without column filter
  const raw = await get('/GatheringPoint/34749');
  console.log('Full GatheringPoint/34749 (all fields):');
  // Extract only coord-relevant keys
  const extract = (obj, prefix='') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'number' || typeof v === 'string') {
        if (/[XYxy]/.test(k) && v !== null) console.log(`  ${key}: ${v}`);
      } else if (v && typeof v === 'object') {
        extract(v, key);
      }
    }
  };
  extract(raw);

  // Verify coord formula with known fishing spots
  console.log('\n=== Coord formula verification ===');
  const spots = [
    { id: 252, wiki: 'X:11, Y:15', zone: 'Old Sharlayan' },  // Scholar's Harbor
    { id: 2,   wiki: 'X:23, Y:?',  zone: 'Central Shroud' },  // Crayfish
  ];
  for (const s of spots) {
    const d = await get(`/FishingSpot/${s.id}?columns=PlaceName.Name,TerritoryType.PlaceName.Name,TerritoryType.Map.SizeFactor,X,Y`);
    const sf = d.TerritoryType?.Map?.SizeFactor;
    const x  = toCoord(d.X, sf);
    const y  = toCoord(d.Y, sf);
    console.log(`  FishingSpot ${s.id} (${s.zone}): sf=${sf} rawX=${d.X} rawY=${d.Y} → X:${x}, Y:${y} | wiki: ${s.wiki}`);
  }

  // Spot-check a DT mining point with ExportedGatheringPoint coords
  console.log('\n=== Mining coord check ===');
  const gp = await get('/GatheringPoint/34749?columns=ExportedGatheringPoint.X,ExportedGatheringPoint.Y,TerritoryType.Map.SizeFactor,TerritoryType.PlaceName.Name');
  const sf  = gp.TerritoryType?.Map?.SizeFactor;
  const ex  = gp.ExportedGatheringPoint;
  const x   = toCoord(parseFloat(ex?.X), sf);
  const y   = toCoord(parseFloat(ex?.Y), sf);
  console.log(`  GP 34749 (${gp.TerritoryType?.PlaceName?.Name}): sf=${sf} rawX=${ex?.X} rawY=${ex?.Y}`);
  console.log(`  → X:${x}, Y:${y} (wiki: this is Urqopacha Mountain Chromite Ore, expect ~X:13,Y:13)`);
})().catch(e => console.error(e.message));
