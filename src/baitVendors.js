/* ============================================================
   baitVendors — where to buy each fishing bait / tackle.
   Resolved from FFXIV Teamcraft gil-shop data (shops.json +
   npcs.json). Versatile Lure is the Dawntrail universal lure,
   sold by Merchant & Mender NPCs in every city/hub.
   Add more baits here as the fishing dataset grows.
   ============================================================ */
export const BAIT_VENDORS = {
  'Versatile Lure': {
    vendor: 'Merchant & Mender',
    zone: 'Most cities & DT hubs',
    coords: 'X:3.3, Y:12.9', // e.g. Limsa Lominsa Lower Decks
    price: 300,
  },
}
