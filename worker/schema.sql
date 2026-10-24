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

-- Whispers: the short public updates the ghosts post (written by Gemini on a timer, see worker/api.js).
CREATE TABLE IF NOT EXISTS whispers (
  n           INTEGER PRIMARY KEY AUTOINCREMENT,
  ghost       TEXT NOT NULL,               -- the character's number (characters.json)
  text_en     TEXT NOT NULL,
  text_id     TEXT,                        -- Indonesian version (may be missing)
  created_at  INTEGER NOT NULL,
  link_url    TEXT,                        -- what the whisper points to: an Indonesian article, a trending topic or a video
  link_title  TEXT,
  link_source TEXT,                        -- the site or channel
  thumb_url   TEXT                         -- its picture (https only)
);
CREATE INDEX IF NOT EXISTS whispers_time ON whispers(created_at DESC);

-- Comments on whispers: visitors' comments (no sign-in) and the ghost's reply under each. They disappear with their whisper.
CREATE TABLE IF NOT EXISTS comments (
  n            INTEGER PRIMARY KEY AUTOINCREMENT,
  whisper_n    INTEGER NOT NULL,
  kind         TEXT NOT NULL,              -- 'user' or 'ghost'
  author       TEXT,                       -- the visitor's nickname (user comments)
  ghost        TEXT,                       -- the character's number (ghost replies)
  reply_to     INTEGER,                    -- the user comment a ghost reply answers
  body         TEXT NOT NULL,
  device_hash  TEXT,                       -- SHA-256 of a random id kept in the visitor's browser (user comments)
  created_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0  -- 1: the visitor deleted it; the row and text stay, but the page only shows "deleted"
);
CREATE INDEX IF NOT EXISTS comments_whisper ON comments(whisper_n, created_at);
CREATE INDEX IF NOT EXISTS comments_device ON comments(device_hash, created_at);

-- Loves: one heart per browser per whisper (the browser is its random id, kept here only as a hash). Removed with the whisper.
CREATE TABLE IF NOT EXISTS loves (
  whisper_n    INTEGER NOT NULL,
  device_hash  TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (whisper_n, device_hash)
);
