require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const res = await p.query(`
    UPDATE hunts SET rank = CASE
      WHEN type = 'Elite Dawn Hunt'    THEN 'S'
      WHEN type = 'Advanced Dawn Hunt' THEN 'A'
      ELSE 'B'
    END
  `);
  console.log('Updated', res.rowCount, 'rows');

  const check = await p.query('SELECT id, rank, type, name FROM hunts ORDER BY id');
  check.rows.forEach(h => console.log(h.id, h.rank, h.type, '-', h.name));
  await p.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
