import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildGatheringLevelRecommendation,
  extractRequestedLevel,
  recommendFood,
  spotLevel,
} = require('../backend/ai/gatheringRecommendations.js')

const FOODS = [
  {
    name: 'Lowland Soup',
    level: 91,
    itemLevel: 650,
    categories: ['gathering'],
    bonuses: [{ stat: 'GP', valueHQ: 7, maxHQ: 20 }],
  },
  {
    name: 'Highland Supper',
    level: 95,
    itemLevel: 690,
    categories: ['gathering'],
    bonuses: [{ stat: 'GAT', valueHQ: 10, maxHQ: 80 }, { stat: 'PER', valueHQ: 10, maxHQ: 80 }],
  },
  {
    name: 'Crafter Stew',
    level: 95,
    itemLevel: 690,
    categories: ['crafting'],
    bonuses: [{ stat: 'CP', valueHQ: 10, maxHQ: 90 }],
  },
]

const DATA = {
  fishing: [
    {
      name: 'Downripple',
      zone: 'Tuliyollal',
      expansion: 'Dawntrail',
      coords: 'X:11.0, Y:12.0',
      baits: ['Versatile Lure'],
      fish: ['Goldfin Trout', 'Harbor Herring'],
    },
    {
      name: 'Lake Toari',
      zone: 'Shaaloani',
      expansion: 'Dawntrail',
      coords: 'X:32.0, Y:18.0',
      baits: ['Metal Spinner'],
      fish: ['Cloudribbon', 'Toari Bass'],
    },
    {
      name: 'The Knowable',
      zone: 'Living Memory',
      expansion: 'Dawntrail',
      coords: 'X:8.0, Y:9.0',
      baits: ['Versatile Lure'],
      fish: ['Archive Fish'],
    },
  ],
  mining: [
    {
      name: 'Lake Toari',
      zone: 'Shaaloani',
      expansion: 'Dawntrail',
      coords: 'X:20.0, Y:21.0',
      level: '95',
      gatherType: 'Mining',
      type: 'Regular',
      time: 'Any',
      items: [{ name: 'Raw Black Star' }, { name: 'Lightning Crystal (aetherial)' }],
    },
  ],
}

test('extracts gathering levels from natural language', () => {
  assert.equal(extractRequestedLevel('I am level 95 Fisher, where should I fish?'), 95)
  assert.equal(extractRequestedLevel('recommend fishing at lvl 91'), 91)
  assert.equal(extractRequestedLevel('95 fsh route'), 95)
})

test('uses zone hints when fishing spots do not carry explicit levels', () => {
  assert.equal(spotLevel({ zone: 'Shaaloani' }), 95)
  assert.equal(spotLevel({ zone: 'Living Memory' }), 99)
  assert.equal(spotLevel({ zone: 'Unknown' }), null)
})

test('selects the best food for the requested gathering level', () => {
  assert.equal(recommendFood(FOODS, 'gathering', 95).name, 'Highland Supper')
  assert.equal(recommendFood(FOODS, 'crafting', 95).name, 'Crafter Stew')
})

test('asks for a level when recommendation intent is missing the level', () => {
  const answer = buildGatheringLevelRecommendation('where should I fish while leveling?', DATA, FOODS)
  assert.equal(answer.type, 'fishing')
  assert.deepEqual(answer.results, [])
  assert.match(answer.summary, /Fisher level/i)
})

test('recommends a fishing zone, target fish, bait, and food for the requested level', () => {
  const answer = buildGatheringLevelRecommendation('I am level 95 fisher, recommend where to gather', DATA, FOODS)
  assert.equal(answer.type, 'fishing')
  assert.equal(answer.results[0].name, 'Cloudribbon')
  assert.equal(answer.results[0].zone, 'Shaaloani')
  assert.match(answer.results[0].detail, /Bait: Metal Spinner/)
  assert.match(answer.results[0].detail, /Food: Highland Supper/)
  assert.match(answer.summary, /Focus on Cloudribbon/)
})

test('recommends a mining zone, target item, and food for the requested level', () => {
  const answer = buildGatheringLevelRecommendation('level 95 miner recommendation', DATA, FOODS)
  assert.equal(answer.type, 'mining')
  assert.equal(answer.results[0].name, 'Raw Black Star')
  assert.equal(answer.results[0].zone, 'Shaaloani')
  assert.match(answer.results[0].detail, /Food: Highland Supper/)
})
