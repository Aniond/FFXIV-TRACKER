'use strict';
const cheerio = require('cheerio');

const BASE = 'https://na.finalfantasyxiv.com/lodestone';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Job/class name → abbreviation.
// Base classes (Gladiator, Pugilist, etc.) map to their job abbr since they
// share the same level once a job is unlocked, and Lodestone only shows one.
const JOB_ABBR = {
  'Paladin': 'PLD',     'Gladiator': 'PLD',
  'Warrior': 'WAR',     'Marauder': 'WAR',
  'Dark Knight': 'DRK',
  'Gunbreaker': 'GNB',
  'White Mage': 'WHM',  'Conjurer': 'WHM',
  'Scholar': 'SCH',
  'Astrologian': 'AST',
  'Sage': 'SGE',
  'Monk': 'MNK',        'Pugilist': 'MNK',
  'Dragoon': 'DRG',     'Lancer': 'DRG',
  'Ninja': 'NIN',       'Rogue': 'NIN',
  'Samurai': 'SAM',
  'Reaper': 'RPR',
  'Viper': 'VPR',
  'Bard': 'BRD',        'Archer': 'BRD',
  'Machinist': 'MCH',
  'Dancer': 'DNC',
  'Black Mage': 'BLM',  'Thaumaturge': 'BLM',
  'Summoner': 'SMN',    'Arcanist': 'SMN',
  'Red Mage': 'RDM',
  'Pictomancer': 'PCT',
  'Blue Mage': 'BLU',
  'Carpenter': 'CRP',   'Blacksmith': 'BSM',
  'Armorer': 'ARM',     'Goldsmith': 'GSM',
  'Leatherworker': 'LTW', 'Weaver': 'WVR',
  'Alchemist': 'ALC',   'Culinarian': 'CUL',
  'Miner': 'MIN',       'Botanist': 'BTN',
  'Fisher': 'FSH',
};

async function lodestoneGet(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Parse "Zalera [Crystal]" → { server: "Zalera", dc: "Crystal" }
function parseWorld(text) {
  const m = text.trim().match(/^(.+?)\s*\[([^\]]+)\]\s*$/);
  if (m) return { server: m[1].trim(), dc: m[2].trim() };
  return { server: text.trim() || null, dc: null };
}

// ── Search ─────────────────────────────────────────────────────────────────
// Returns { results: [{ id, name, server, dc, portrait }] }
async function searchCharacter(name, server) {
  // Lodestone search is at /lodestone/character/?q=NAME&worldname=SERVER
  const url = new URL(`${BASE}/character/`);
  url.searchParams.set('q', name);
  if (server) url.searchParams.set('worldname', server);

  const res = await lodestoneGet(url.toString());
  if (!res.ok) throw new Error(`Lodestone search returned HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const results = [];

  $('.entry').each((_, el) => {
    const href = $(el).find('a[href*="/character/"]').first().attr('href') || '';
    const idMatch = href.match(/\/character\/(\d+)\//);
    if (!idMatch) return;

    const charName = $(el).find('.entry__name').text().trim();
    if (!charName) return;

    // World node may be plain text "Zalera [Crystal]"
    const worldText = $(el).find('.entry__world').text().trim();
    const { server: charServer, dc: charDc } = parseWorld(worldText);
    const portrait = $(el).find('img').first().attr('src') || null;

    results.push({ id: idMatch[1], name: charName, server: charServer, dc: charDc, portrait });
  });

  return { results };
}

// ── Character detail ───────────────────────────────────────────────────────
// Returns { id, name, title, server, dc, portrait, gc, jobs } or null (404)
async function fetchCharacter(id) {
  // Fetch main page (identity) and class/job subpage (levels) in parallel
  const [mainRes, jobRes] = await Promise.all([
    lodestoneGet(`${BASE}/character/${id}/`),
    lodestoneGet(`${BASE}/character/${id}/class_job/`),
  ]);

  if (mainRes.status === 404) return null;
  if (!mainRes.ok) throw new Error(`Lodestone character returned HTTP ${mainRes.status}`);

  const $ = cheerio.load(await mainRes.text());

  // Identity
  const name  = $('p.frame__chara__name').text().trim();
  const title = $('p.frame__chara__title').text().trim() || null;

  // Portrait — prefer full-body art
  const portrait = $('.character__detail__image img').first().attr('src')
    || $('.frame__chara__face img').first().attr('src')
    || null;

  // World: "Zalera [Crystal]" as a single text node after an <i> icon
  const { server, dc } = parseWorld($('p.frame__chara__world').text());

  // Grand Company — find a character-block whose title text includes "Grand Company"
  let gc = null;
  $('[class*="character-block"]').each((_, el) => {
    if (/grand.?company/i.test($(el).find('[class*="__title"]').text())) {
      const raw = $(el).find('[class*="__name"]').text().trim();
      const parts = raw.split('/');
      if (parts.length >= 2) {
        gc = { name: parts[0].trim(), rank: parts[1].trim() };
        return false; // break
      }
    }
  });

  // Job levels from class/job subpage
  // Structure: ul.character__job > li > .character__job__name + .character__job__level
  const jobs = {};
  if (jobRes.ok) {
    const $j = cheerio.load(await jobRes.text());
    $j('.character__job li').each((_, el) => {
      const jobName = $j(el).find('.character__job__name').text().trim();
      const abbr    = JOB_ABBR[jobName];
      if (!abbr) return;
      const levelText = $j(el).find('.character__job__level').text().trim();
      const level = parseInt(levelText, 10);
      // Keep highest if the same abbr appears twice (base class + job both shown)
      if (Number.isFinite(level)) jobs[abbr] = Math.max(jobs[abbr] || 0, level);
    });
  }

  return { id, name, title, server, dc, portrait, gc, jobs };
}

module.exports = { searchCharacter, fetchCharacter };
