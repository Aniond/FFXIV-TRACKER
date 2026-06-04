/* ============================================================
   cookingData.js — food-stat metadata, source meta, and an
   adapter that maps the live /api/recipes payload into the
   shape Cooking.jsx expects. Categories reflect REAL FFXIV food
   buffs (substats + VIT, plus crafter/gatherer stats) — the
   handoff mock's STR/DEX food doesn't exist in the game.
   Ingredient location (source/zone/coords/window) comes baked in the API
   payload now (Teamcraft nodes + overrides — see backend/scrape-cooking.js).
   ============================================================ */

// Filter/accent categories, keyed by the recipe's primary (headline) stat.
export const STAT_TYPES = {
  crt: { label: 'CRT', color: '#e8608a', statName: 'Critical Hit', desc: 'Critical Hit' },
  det: { label: 'DET', color: '#e0a24a', statName: 'Determination', desc: 'Determination' },
  dh:  { label: 'DH',  color: '#d98a6a', statName: 'Direct Hit',   desc: 'Direct Hit' },
  sks: { label: 'SKS', color: '#d4b84a', statName: 'Skill Speed',  desc: 'Skill Speed' },
  sps: { label: 'SPS', color: '#9a6ad4', statName: 'Spell Speed',  desc: 'Spell Speed' },
  ten: { label: 'TEN', color: '#6aa6c0', statName: 'Tenacity',     desc: 'Tank' },
  pie: { label: 'PIE', color: '#5ec0a0', statName: 'Piety',        desc: 'Healer' },
  vit: { label: 'VIT', color: '#c0696e', statName: 'Vitality',     desc: 'Tank' },
  cp:  { label: 'CP',  color: '#d4923a', statName: 'CP',           desc: 'Crafting' },
  gp:  { label: 'GP',  color: '#5aaa72', statName: 'GP',           desc: 'Gathering' },
}

export const STAT_ORDER = ['all', 'crt', 'det', 'dh', 'sks', 'sps', 'ten', 'pie', 'vit', 'cp', 'gp']

export const SRC = {
  botany:  { label: 'Botany',  icon: 'leaf', path: '/gathering/botany' },
  mining:  { label: 'Mining',  icon: 'pick', path: '/gathering/mining' },
  fishing: { label: 'Fishing', icon: 'fish', path: '/gathering/fishing' },
  market:  { label: 'Market',  icon: 'cart', path: null },
}

// Backend stat abbreviation -> filter category key, and -> full display name.
const STAT_KEY = {
  CRT: 'crt', DET: 'det', DH: 'dh', SKS: 'sks', SPS: 'sps', TEN: 'ten', PIE: 'pie', VIT: 'vit',
  CP: 'cp', CMS: 'cp', CTL: 'cp', GP: 'gp', GAT: 'gp', PER: 'gp',
}
const STAT_FULL = {
  CRT: 'Critical Hit', DET: 'Determination', DH: 'Direct Hit', SKS: 'Skill Speed', SPS: 'Spell Speed',
  TEN: 'Tenacity', PIE: 'Piety', VIT: 'Vitality', CP: 'CP', GP: 'GP',
  CMS: 'Craftsmanship', CTL: 'Control', GAT: 'Gathering', PER: 'Perception',
}
const API_SRC = { FISHING: 'fishing', MINING: 'mining', BOTANY: 'botany', MARKET_BOARD: 'market' }

/**
 * Adapt the /api/recipes payload to Cooking.jsx's recipe shape.
 * Only food with a buff is included (the catalog's other CUL entries are
 * intermediate subcrafts, not meals).
 */
export function adaptRecipes(apiRecipes) {
  return (apiRecipes || [])
    .filter((r) => Array.isArray(r.food_buff) && r.food_buff.length)
    .map((r) => ({
      id: String(r.id),
      name: r.name,
      ilvl: r.item_level,
      stars: r.stars || 0,
      rlevel: 100, // DT endgame crafting level (cosmetic; class level not in the API)
      primaryStat: STAT_KEY[r.food_buff[0].stat] || 'crt',
      buffDur: 30, // FFXIV food is 30 min (HQ 45)
      buffs: r.food_buff.map((b) => ({
        stat: STAT_FULL[b.stat] || b.stat,
        val: b.relative ? `+${b.valueHQ}%` : `+${b.valueHQ}`,
        cap: b.maxHQ,
      })),
      ingredients: r.ingredients.map((ing) => {
        const source = API_SRC[ing.source] || 'market'
        const located = source !== 'market' && (ing.coords || ing.zone)
        return {
          name: ing.name,
          qty: ing.amount,
          source,
          // nodeId presence enables the "go to gathering page" arrow.
          nodeId: located ? String(ing.id) : null,
          nodeName: ing.zone || ing.node_name || null,
          coords: ing.coords || null,
          nodeType: ing.node_type || null,
          window: ing.window || null,
        }
      }),
    }))
}

// Empty fallback — Cooking.jsx fetches live data and passes it in.
export const RECIPES = []
