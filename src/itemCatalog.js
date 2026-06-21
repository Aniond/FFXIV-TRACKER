import { MINING_NODES } from './miningData.js'
import { BOTANY_NODES } from './botanyData.js'
import { FISHING_SPOTS } from './fishingData.js'
import { EXTRA_BOTANY_NODES, EXTRA_MINING_NODES, EXTRA_FISHING_SPOTS } from './crosslinkNodes.js'

export const normItemName = (s) => String(s || '').trim().toLowerCase()

export function itemSlug(name) {
  return normItemName(name)
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const itemPath = (name) => `/item/${itemSlug(name)}`

const SRC_LABEL = {
  BOTANY: 'Botany',
  MINING: 'Mining',
  FISHING: 'Fishing',
  VENDOR: 'Vendor',
  SCRIP_EXCHANGE: 'Scrip Exchange',
  GEMSTONE: 'Bicolor Gemstone',
  MARKET_BOARD: 'Market Board',
  CRAFTED: 'Crafted',
}

export const SOURCE_PATH = {
  BOTANY: '/gathering/botany',
  MINING: '/gathering/mining',
  FISHING: '/gathering/fishing',
}

export function sourceLabel(source) {
  return SRC_LABEL[source] || 'Source'
}

function sourceKey(source) {
  const raw = String(source || '').trim()
  const upper = raw.toUpperCase()
  const lower = raw.toLowerCase()
  if (SRC_LABEL[upper]) return upper
  if (lower === 'botany') return 'BOTANY'
  if (lower === 'mining') return 'MINING'
  if (lower === 'fishing') return 'FISHING'
  if (lower === 'vendor') return 'VENDOR'
  if (lower === 'scrip') return 'SCRIP_EXCHANGE'
  if (lower === 'gemstone') return 'GEMSTONE'
  if (lower === 'market') return 'MARKET_BOARD'
  if (lower === 'crafted') return 'CRAFTED'
  return 'MARKET_BOARD'
}

function ensureItem(map, name) {
  const key = normItemName(name)
  if (!key) return null
  if (!map.has(key)) {
    map.set(key, {
      name: String(name).trim(),
      slug: itemSlug(name),
      itemId: null,
      sources: [],
      usedIn: [],
      craftedRecipe: null,
    })
  }
  return map.get(key)
}

function addSource(item, source) {
  if (!item) return
  const normalized = { ...source, source: sourceKey(source.source) }
  const key = [
    normalized.source,
    normalized.zone,
    normalized.coords,
    normalized.nodeName,
    normalized.price,
    normalized.currency,
    normalized.itemId,
  ].map((v) => String(v || '')).join('|')
  if (item.sources.some((s) => s._key === key)) return
  item.sources.push({ ...normalized, _key: key })
  if (!item.itemId && normalized.itemId) item.itemId = normalized.itemId
}

function recipeIsDish(recipe) {
  return !recipe.is_subcraft && Array.isArray(recipe.food_buff) && recipe.food_buff.length > 0
}

function collectRecipeItems(recipe, byName, out, depth = 0) {
  for (const ing of recipe.ingredients || []) {
    const key = normItemName(ing.name)
    if (key) out.add(key)
    if (ing.subcraft && depth < 4) {
      const sub = byName.get(key)
      if (sub) collectRecipeItems(sub, byName, out, depth + 1)
    }
  }
}

function addRecipeData(map, recipes) {
  const byName = new Map()
  for (const recipe of recipes || []) {
    byName.set(normItemName(recipe.name), recipe)
    const item = ensureItem(map, recipe.name)
    if (!item) continue
    item.itemId = item.itemId || recipe.id || null
    item.craftedRecipe = recipe
    addSource(item, {
      source: 'CRAFTED',
      itemId: recipe.id,
      recipeName: recipe.name,
      job: recipe.job || 'CUL',
      itemLevel: recipe.item_level,
      stars: recipe.stars || 0,
    })
  }

  for (const recipe of recipes || []) {
    for (const ing of recipe.ingredients || []) {
      const item = ensureItem(map, ing.name)
      addSource(item, {
        source: ing.source,
        itemId: ing.id,
        amount: ing.amount,
        zone: ing.zone,
        coords: ing.coords,
        nodeName: ing.node_name || ing.nodeName,
        nodeType: ing.node_type || ing.nodeType,
        window: ing.window,
        price: ing.price,
        currency: ing.currency,
        notes: ing.notes,
      })
    }
  }

  for (const dish of (recipes || []).filter(recipeIsDish)) {
    const items = new Set()
    collectRecipeItems(dish, byName, items)
    for (const key of items) {
      const item = map.get(key)
      if (!item || item.usedIn.some((r) => r.id === dish.id)) continue
      item.usedIn.push({
        id: dish.id,
        name: dish.name,
        itemLevel: dish.item_level,
        stars: dish.stars || 0,
        buffs: dish.food_buff || [],
      })
    }
  }
}

function addGatherNodes(map, nodes, source) {
  for (const node of nodes || []) {
    for (const gathered of node.items || []) {
      addSource(ensureItem(map, gathered.name), {
        source,
        zone: node.zone,
        coords: node.coords,
        nodeName: node.name,
        nodeType: node.gatherType || node.type,
        nodeLevel: node.level,
        time: node.time,
        window: node.window,
        tag: gathered.tag,
        notes: gathered.note,
      })
    }
  }
}

function addFishingSpots(map, spots) {
  for (const spot of spots || []) {
    for (const fish of spot.fish || []) {
      addSource(ensureItem(map, fish.name), {
        source: 'FISHING',
        zone: spot.zone,
        coords: spot.coords,
        nodeName: spot.name,
        bait: spot.baits?.map((b) => b[0]).join(', '),
        time: spot.time,
        weather: spot.weather,
        tag: fish.rarity,
        notes: fish.note,
      })
    }
  }
}

export function buildItemCatalog(recipes = []) {
  const map = new Map()
  addRecipeData(map, recipes)
  addGatherNodes(map, [...MINING_NODES, ...EXTRA_MINING_NODES], 'MINING')
  addGatherNodes(map, [...BOTANY_NODES, ...EXTRA_BOTANY_NODES], 'BOTANY')
  addFishingSpots(map, [...FISHING_SPOTS, ...EXTRA_FISHING_SPOTS])

  const items = [...map.values()].map((item) => ({
    ...item,
    sources: item.sources.map(({ _key, ...source }) => source),
    usedIn: item.usedIn.sort((a, b) => a.name.localeCompare(b.name)),
  }))
  const bySlug = new Map(items.map((item) => [item.slug, item]))
  const byName = new Map(items.map((item) => [normItemName(item.name), item]))
  return { items, bySlug, byName }
}
