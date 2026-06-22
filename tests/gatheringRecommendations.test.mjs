import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildFishingLevelRecommendation,
  extractRequestedLevel,
  spotLevel,
} = require('../backend/ai/gatheringRecommendations.js')

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
      baits: ['Versatile Lure'],
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
}

test('extracts fishing levels from natural language', () => {
  assert.equal(extractRequestedLevel('I am level 95 Fisher, where should I fish?'), 95)
  assert.equal(extractRequestedLevel('recommend fishing at lvl 91'), 91)
  assert.equal(extractRequestedLevel('95 fsh route'), 95)
})

test('uses zone hints when fishing spots do not carry explicit levels', () => {
  assert.equal(spotLevel({ zone: 'Shaaloani' }), 95)
  assert.equal(spotLevel({ zone: 'Living Memory' }), 99)
  assert.equal(spotLevel({ zone: 'Unknown' }), null)
})

test('asks for a level when recommendation intent is missing the level', () => {
  const answer = buildFishingLevelRecommendation('where should I fish while leveling?', DATA)
  assert.equal(answer.type, 'fishing')
  assert.deepEqual(answer.results, [])
  assert.match(answer.summary, /Fisher level/i)
})

test('recommends a fishing zone and target fish for the requested level', () => {
  const answer = buildFishingLevelRecommendation('I am level 95 fisher, recommend where to gather', DATA)
  assert.equal(answer.type, 'fishing')
  assert.equal(answer.results[0].name, 'Lake Toari')
  assert.equal(answer.results[0].zone, 'Shaaloani')
  assert.match(answer.results[0].detail, /Cloudribbon/)
  assert.match(answer.summary, /Shaaloani/)
})
