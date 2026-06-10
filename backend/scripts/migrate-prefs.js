const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
async function run() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS pref_view    VARCHAR(10) NOT NULL DEFAULT 'cards',
      ADD COLUMN IF NOT EXISTS pref_accent  VARCHAR(10) NOT NULL DEFAULT '#c9a35b',
      ADD COLUMN IF NOT EXISTS pref_density VARCHAR(10) NOT NULL DEFAULT 'regular'
  `);
  console.log('Migration complete: pref_view, pref_accent, pref_density added.');
  await pool.end();
}
run().catch(err => { console.error(err.message); process.exit(1); });
