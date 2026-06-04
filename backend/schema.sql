CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  discord_id   VARCHAR(32) UNIQUE NOT NULL,
  username     VARCHAR(255) NOT NULL,
  avatar       VARCHAR(255),
  nuts_stash   INTEGER NOT NULL DEFAULT 0,
  pref_view    VARCHAR(10) NOT NULL DEFAULT 'cards',
  pref_accent  VARCHAR(10) NOT NULL DEFAULT '#8fb6d6',
  pref_density VARCHAR(10) NOT NULL DEFAULT 'regular',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hunt_id     INTEGER NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'todo',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, hunt_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hunt_data   JSONB NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lodestone_cache (
  cache_key  VARCHAR(255) PRIMARY KEY,
  data       JSONB        NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_jobs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  job_abbr   VARCHAR(5) NOT NULL,
  level      INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_abbr)
);

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
);

-- Admin tables (added by migrate-admin.js)

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ai_queries (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  query_text  TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  cached      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key         VARCHAR(100) PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('ENABLE_AI_PUBLIC',   false, 'Enable AI assistant for logged-in users'),
  ('ENABLE_AI_GUESTS',   false, 'Enable AI assistant for guests (not logged in)'),
  ('ENABLE_SUBMISSIONS', false, 'Allow community hunt submissions')
ON CONFLICT (key) DO NOTHING;

-- AI search cache (added by migrate-ai.js) — 60s identical-query cache for /api/ai/search.
-- AI usage logging reuses the ai_queries table above.

CREATE TABLE IF NOT EXISTS user_searches (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  query_norm  TEXT NOT NULL,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_searches_lookup
  ON user_searches (query_norm, created_at DESC);
