CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  discord_id  VARCHAR(32) UNIQUE NOT NULL,
  username    VARCHAR(255) NOT NULL,
  avatar      VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
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
