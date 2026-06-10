const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Without this handler, an error on an idle pooled connection (e.g. Postgres
// restart/failover on Railway) emits an unhandled 'error' event and crashes
// the whole process. The pool discards the broken client on its own; queries
// in flight on it still reject and are handled per-route.
pool.on('error', (err) => {
  console.error('[db] idle client error (connection dropped, pool will recover):', err.message);
});

module.exports = pool;
