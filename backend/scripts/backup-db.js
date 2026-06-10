require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

/**
 * backup-db.js — dump every table to JSON under backend/backups/<timestamp>/.
 *
 * This is the disaster-recovery path for user data (progress, users, jobs —
 * the only tables that can't be regenerated from scrapers). Run it before
 * risky migrations and on a periodic basis:
 *
 *   railway link --project ffxivlog-backend --environment production --service Postgres
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node scripts/backup-db.js'
 *
 * Restore a table by replaying the JSON with an INSERT loop (column names are
 * preserved in each row object). backups/ is gitignored — copy dumps somewhere
 * durable (cloud drive) for real retention.
 */
async function backup() {
  const { rows: tables } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  let total = 0;
  for (const { tablename } of tables) {
    // tablename comes from pg_tables, not user input; quote defensively anyway.
    const { rows } = await pool.query(`SELECT * FROM "${tablename.replace(/"/g, '')}"`);
    fs.writeFileSync(path.join(dir, `${tablename}.json`), JSON.stringify(rows));
    console.log(`  ${tablename}: ${rows.length} rows`);
    total += rows.length;
  }
  console.log(`backup complete → ${dir} (${tables.length} tables, ${total} rows)`);
  await pool.end();
}

backup().catch((err) => { console.error(err); process.exit(1); });
