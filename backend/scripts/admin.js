/**
 * Centurio Ledger — admin CLI
 *
 * Usage (run via Railway so it hits the production DB):
 *   railway run node backend/admin.js <command> [target]
 *
 * Commands:
 *   status                      — show user/progress/job counts
 *   list-users                  — show all registered users
 *   reset-progress <user|all>   — clear hunt progress (board resets); does NOT touch lifetime_cleared
 *   reset-lifetime <user|all>   — zero out the lifetime cleared counter
 *   reset-all <user|all>        — reset-progress + reset-lifetime together
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function resolveUser(target) {
  if (!target) { console.error('A username (or "all") is required.'); process.exit(1); }
  if (target === 'all') return null;
  const r = await pool.query(
    'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) OR slug = LOWER($1)',
    [target]
  );
  if (!r.rows[0]) { console.error(`No user found: ${target}`); process.exit(1); }
  return r.rows[0];
}

const COMMANDS = {
  status: async () => {
    const [u, p, j, h] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM progress'),
      pool.query('SELECT COUNT(*) FROM user_jobs'),
      pool.query('SELECT COUNT(*) FROM hunts'),
    ]);
    console.log(`Users           : ${u.rows[0].count}`);
    console.log(`Progress rows   : ${p.rows[0].count}`);
    console.log(`Job level rows  : ${j.rows[0].count}`);
    console.log(`Hunts in DB     : ${h.rows[0].count}`);
  },

  'list-users': async () => {
    const r = await pool.query(
      `SELECT id, username, slug, world, lodestone_id IS NOT NULL AS linked,
              lifetime_cleared, created_at::date AS joined
       FROM users ORDER BY id`
    );
    if (!r.rows.length) { console.log('No users.'); return; }
    r.rows.forEach(u =>
      console.log(
        `[${u.id}] ${u.username} | slug: ${u.slug || '-'} | lodestone: ${u.linked ? 'yes' : 'no'}` +
        ` | lifetime: ${u.lifetime_cleared} | joined: ${u.joined}`
      )
    );
  },

  'reset-progress': async (target) => {
    const user = await resolveUser(target);
    let r;
    if (!user) {
      r = await pool.query('DELETE FROM progress');
      console.log(`Cleared ALL progress (${r.rowCount} rows). lifetime_cleared unchanged.`);
    } else {
      r = await pool.query('DELETE FROM progress WHERE user_id = $1', [user.id]);
      console.log(`Cleared progress for ${user.username} (${r.rowCount} rows). lifetime_cleared unchanged.`);
    }
  },

  'reset-lifetime': async (target) => {
    const user = await resolveUser(target);
    let r;
    if (!user) {
      r = await pool.query('UPDATE users SET lifetime_cleared = 0');
      console.log(`Reset lifetime_cleared to 0 for all ${r.rowCount} users.`);
    } else {
      r = await pool.query('UPDATE users SET lifetime_cleared = 0 WHERE id = $1', [user.id]);
      console.log(`Reset lifetime_cleared to 0 for ${user.username}.`);
    }
  },

  'reset-all': async (target) => {
    await COMMANDS['reset-progress'](target);
    await COMMANDS['reset-lifetime'](target);
  },
};

const [,, command, target] = process.argv;

if (!command || !COMMANDS[command]) {
  console.log('Centurio Ledger admin\n');
  console.log('Commands:');
  console.log('  railway run node backend/admin.js status');
  console.log('  railway run node backend/admin.js list-users');
  console.log('  railway run node backend/admin.js reset-progress <username|all>');
  console.log('  railway run node backend/admin.js reset-lifetime  <username|all>');
  console.log('  railway run node backend/admin.js reset-all       <username|all>');
  process.exit(0);
}

COMMANDS[command](target)
  .then(() => pool.end())
  .catch(err => { console.error(err.message); process.exit(1); });
