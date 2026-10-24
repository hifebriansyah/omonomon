-- D1 schema for the API Worker (worker/api.js). Safe to run again: every statement is IF NOT EXISTS.
-- Applied by tools/setup_api.py.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,            -- random id, never the Google id
  google_sub  TEXT NOT NULL UNIQUE,        -- Google's stable account id
  email       TEXT,                        -- from Google, only to know who the account belongs to
  name        TEXT,                        -- display name from Google (shown on the Me page)
  picture     TEXT,                        -- link to the Google profile photo (only googleusercontent.com links are kept)
  created_at  INTEGER NOT NULL,            -- ms since 1970
  last_login  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,            -- SHA-256 of the session token (the token itself is never stored)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS progress (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,               -- JSON: candles, plays, bond per ghost, best score per game
  updated_at  INTEGER NOT NULL
);
