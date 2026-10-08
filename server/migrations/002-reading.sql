CREATE TABLE IF NOT EXISTS reading_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  last_read_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS reading_history_user_time ON reading_history(user_id, last_read_at);
CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  last_seen INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reading_clock (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_tick INTEGER NOT NULL
);
