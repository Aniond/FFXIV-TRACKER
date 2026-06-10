require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lifetime_cleared INTEGER NOT NULL DEFAULT 0
  `);
  // Seed from existing progress rows so historical clears count
  const { rowCount } = await pool.query(`
    UPDATE users u SET lifetime_cleared = (
      SELECT COUNT(*) FROM progress p
      WHERE p.user_id = u.id AND p.status = 'done'
    )
    WHERE lifetime_cleared = 0
  `);
  console.log(`Migration complete. ${rowCount} users seeded.`);
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
