'use strict';
const { fetchCharacter } = require('./lodestone');

/**
 * Pull fresh character data from Lodestone for one user and persist it.
 * Clears the 1-hour Lodestone cache first so we always get live data.
 *
 * Returns { name, jobCount } on success; throws on Lodestone error.
 */
async function refreshUserJobs(pool, userId, lodestoneId) {
  // Force a fresh scrape by removing the cached entry
  await pool.query(
    'DELETE FROM lodestone_cache WHERE cache_key = $1',
    [`char:${lodestoneId}`]
  );

  const char = await fetchCharacter(lodestoneId);
  if (!char) throw new Error('Character not found on Lodestone');

  // Persist updated identity fields
  await pool.query(
    `UPDATE users SET portrait_url = $2, world = $3, dc = $4 WHERE id = $1`,
    [userId, char.portrait, char.server, char.dc]
  );

  // Upsert every job level
  const jobs = Object.entries(char.jobs || {});
  for (const [job_abbr, level] of jobs) {
    await pool.query(
      `INSERT INTO user_jobs (user_id, job_abbr, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, job_abbr) DO UPDATE SET level = $3, updated_at = NOW()`,
      [userId, job_abbr, level]
    );
  }

  return { name: char.name, jobCount: jobs.length };
}

module.exports = { refreshUserJobs };
