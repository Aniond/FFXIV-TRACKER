/**
 * jobs.js — scheduled background work (daily Lodestone refresh +
 * lodestone_cache purge). Called once from index.js at boot.
 */
const cron = require('node-cron');
const pool = require('./db');
const { refreshUserJobs } = require('./refresh');

function startJobs() {
  // Daily Lodestone refresh — 04:00 UTC every day
  cron.schedule('0 4 * * *', async () => {
    console.log('[cron] Lodestone daily refresh started');
    try {
      // Purge expired cache rows — nothing else ever deletes them, and every
      // unique anonymous search inserts one.
      const purged = await pool.query('DELETE FROM lodestone_cache WHERE expires_at < NOW()');
      console.log(`[cron] purged ${purged.rowCount} expired lodestone_cache rows`);
      const users = await pool.query(
        'SELECT id, username, lodestone_id FROM users WHERE lodestone_id IS NOT NULL'
      );
      for (const user of users.rows) {
        try {
          const result = await refreshUserJobs(pool, user.id, user.lodestone_id);
          console.log(`[cron] ${user.username}: ${result.jobCount} jobs refreshed`);
        } catch (err) {
          console.error(`[cron] ${user.username} failed:`, err.message);
        }
        // Brief pause between users to be polite to Lodestone
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log('[cron] Lodestone daily refresh complete');
    } catch (err) {
      console.error('[cron] Fatal error:', err.message);
    }
  });

}

module.exports = { startJobs };
