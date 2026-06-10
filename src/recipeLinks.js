/* ============================================================
   recipeLinks.js — reverse cross-links: gathering item → dishes.

   Builds an index from the live /api/recipes payload (dishes +
   subcrafts) mapping every ingredient name — including ones that
   only appear inside subcraft chains (e.g. Dark Rye → Dark Rye
   Flour → Archon Burger) — to the food dishes that need it.

   Used by the Mining / Botany / Fishing pages to render
   "Used in N recipes" chips that deep-link to
   /crafting/cooking?ingredient=<name>.
   ============================================================ */
import { useEffect, useState } from 'react'
import { fetchRecipes } from './api.js'

const norm = (s) => String(s || '').trim().toLowerCase()
const MAX_DEPTH = 4 // matches the cooking page's sub-recipe drill-down

/**
 * @param recipes raw /api/recipes rows fetched with include_subcraft=1
 * @returns Map<normalized item name, { count, dishes: string[] }>
 */
export function buildUsageIndex(recipes) {
  const byName = new Map(recipes.map((r) => [norm(r.name), r]))
  const dishes = recipes.filter((r) => !r.is_subcraft && Array.isArray(r.food_buff) && r.food_buff.length)
  const index = new Map()

  const collectItems = (recipe, out, depth) => {
    for (const ing of recipe.ingredients || []) {
      out.add(norm(ing.name))
      if (ing.subcraft && depth < MAX_DEPTH) {
        const sub = byName.get(norm(ing.name))
        if (sub) collectItems(sub, out, depth + 1)
      }
    }
  }

  for (const dish of dishes) {
    const items = new Set()
    collectItems(dish, items, 0)
    for (const item of items) {
      if (!index.has(item)) index.set(item, { count: 0, dishes: [] })
      const e = index.get(item)
      e.count += 1
      e.dishes.push(dish.name)
    }
  }
  return index
}

// Module-level promise cache: pages are separate full loads, but within one
// page lifetime every consumer (and remount) shares a single catalog fetch.
let indexPromise = null
function getUsageIndex() {
  if (!indexPromise) {
    indexPromise = fetchRecipes({ job: null, expansion: null, includeSubcraft: true })
      .then((rows) => (rows.length ? buildUsageIndex(rows) : new Map()))
      .catch(() => { indexPromise = null; return new Map() }) // allow retry next mount
  }
  return indexPromise
}

/** Fetch-once hook; returns an empty Map until the payload arrives. */
export function useRecipeUsage() {
  const [index, setIndex] = useState(() => new Map())
  useEffect(() => {
    let alive = true
    getUsageIndex().then((idx) => { if (alive && idx.size) setIndex(idx) })
    return () => { alive = false }
  }, [])
  return index
}

/** Lookup helper — returns { count, dishes } or null. */
export function usageFor(index, itemName) {
  return index.get(norm(itemName)) || null
}

export const cookingLink = (itemName) =>
  `/crafting/cooking?ingredient=${encodeURIComponent(itemName)}`
