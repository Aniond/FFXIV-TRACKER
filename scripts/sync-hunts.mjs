// Sync hunt data from a published Google Sheet (CSV) into public/data.json.
//
// The sheet is fetched from the SHEET_CSV_URL env var (a "Publish to web" /
// export CSV link). Columns, in any order, are matched by header name:
//   id, name, rank, type, billNumber, zone, area, coords, coordsNote,
//   targets, reward, authority, tips, status
// `id` and `targets` are coerced to numbers; `tips` is a pipe-separated
// string that is split into an array. Output key order is fixed so diffs
// stay minimal.
//
// Run directly (node scripts/sync-hunts.mjs) or import the helpers for tests.

import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const FIELD_ORDER = [
  'id',
  'name',
  'rank',
  'type',
  'billNumber',
  'zone',
  'area',
  'coords',
  'coordsNote',
  'targets',
  'reward',
  'authority',
  'tips',
  'status',
]

const NUMERIC_FIELDS = new Set(['id', 'targets'])

// RFC 4180-style parser: handles quoted fields, embedded commas/newlines,
// and "" escaped quotes. Returns an array of string-cell rows.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r') {
      // ignore; handled with the following \n
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  // Flush trailing field/row if the file did not end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function csvToData(csv) {
  const rows = parseCSV(csv)
  if (rows.length === 0) return { hunts: [] }

  const header = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''))

  const hunts = dataRows.map((cells) => {
    const raw = {}
    header.forEach((key, idx) => {
      raw[key] = cells[idx] ?? ''
    })

    const hunt = {}
    for (const key of FIELD_ORDER) {
      const value = raw[key] ?? ''
      if (key === 'tips') {
        hunt.tips = String(value)
          .split('|')
          .map((t) => t.trim())
          .filter(Boolean)
      } else if (NUMERIC_FIELDS.has(key)) {
        const trimmed = String(value).trim()
        const n = Number(trimmed)
        hunt[key] = trimmed !== '' && Number.isFinite(n) ? n : trimmed
      } else {
        hunt[key] = value
      }
    }
    return hunt
  })

  return { hunts }
}

export function serialize(data) {
  return JSON.stringify(data, null, 2) + '\n'
}

async function main() {
  const url = process.env.SHEET_CSV_URL
  if (!url) {
    console.error('SHEET_CSV_URL is not set. Add it as a GitHub secret.')
    process.exit(1)
  }

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    console.error(`Failed to fetch sheet: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const csv = await res.text()
  if (csv.trimStart().startsWith('<')) {
    console.error(
      'Received HTML instead of CSV. Make sure the sheet is published to the web / publicly readable as CSV.'
    )
    process.exit(1)
  }

  const data = csvToData(csv)
  if (data.hunts.length === 0) {
    console.error('Parsed 0 hunts from the sheet — refusing to overwrite public/data.json.')
    process.exit(1)
  }

  const json = serialize(data)
  const outPath = new URL('../public/data.json', import.meta.url)

  let existing = null
  try {
    existing = await readFile(outPath, 'utf8')
  } catch {
    // file may not exist yet
  }

  if (existing === json) {
    console.log(`No changes — public/data.json already up to date (${data.hunts.length} hunts).`)
    return
  }

  await writeFile(outPath, json)
  console.log(`Updated public/data.json with ${data.hunts.length} hunts.`)
}

// Only run main() when executed directly, not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
