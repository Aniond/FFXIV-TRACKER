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
