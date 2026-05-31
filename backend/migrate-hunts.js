require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const dataPath = path.join(__dirname, '..', 'public', 'data.json');
  const { hunts } = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hunts (
      id           SERIAL PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      rank         VARCHAR(5),
      type         VARCHAR(100),
      bill_number  VARCHAR(10),
      zone         VARCHAR(100),
      area         VARCHAR(100),
      coords       VARCHAR(50),
      coords_note  VARCHAR(255),
      targets      INTEGER DEFAULT 1,
      reward       VARCHAR(255),
      authority    VARCHAR(100),
      tips         TEXT[],
      status       VARCHAR(20) DEFAULT 'todo',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  let inserted = 0;
  for (const h of hunts) {
    const result = await pool.query(
      `INSERT INTO hunts (id, name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [h.id, h.name, h.rank, h.type, h.billNumber, h.zone, h.area, h.coords, h.coordsNote, h.targets, h.reward, h.authority, h.tips, h.status]
    );
    if (result.rowCount > 0) inserted++;
  }

  // Reset sequence so future inserts don't collide with the seeded IDs
  await pool.query(`SELECT setval('hunts_id_seq', (SELECT MAX(id) FROM hunts))`);

  console.log(`Migration complete: ${inserted} hunts inserted (${hunts.length - inserted} already existed).`);
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
