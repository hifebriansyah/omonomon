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
  thumb_url   TEXT,                        -- the source's own picture (https only), kept as it was
  anime_image TEXT                         -- key in the R2 bucket of the picture redrawn by tools/remake_image.py (NULL: not redrawn yet)
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

-- Weekly best score per player and game (the leaderboard). The week is the Monday it started, as YYYY-MM-DD (UTC).
-- Scores come from the browser, so the Worker only keeps ones that are plausible (see SCORE_LIMITS in worker/api.js).
CREATE TABLE IF NOT EXISTS scores (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game        TEXT NOT NULL,
  week        TEXT NOT NULL,
  score       INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, game, week)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores(game, week, score DESC);

-- Finished runs: one row per run token, so a token can be used for one score only. Old rows are removed by the timer.
CREATE TABLE IF NOT EXISTS runs (
  nonce       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

-- Riddle answers judged by Gemini (Teka-Teki Gaib): one row per judged answer, for the daily caps per browser and in total.
CREATE TABLE IF NOT EXISTS riddle_log (
  device_hash TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS riddle_log_time ON riddle_log(created_at);

-- Web Push subscribers (opt-in). The browser's endpoint is the address a push is sent to; the page can only read a notification's
-- text back by the endpoint's hash, so the text is parked in `pending`. At most one push a day per subscriber.
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint_hash TEXT PRIMARY KEY,
  endpoint      TEXT NOT NULL,
  user_id       TEXT,                    -- set when the player was signed in (needed for streak reminders)
  lang          TEXT NOT NULL DEFAULT 'id',
  created_at    INTEGER NOT NULL,
  last_sent     INTEGER NOT NULL DEFAULT 0,
  last_streak   TEXT NOT NULL DEFAULT '',  -- the Jakarta date of the last streak reminder
  pending       TEXT
);
