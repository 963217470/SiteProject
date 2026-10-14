CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS mcp_tokens_user ON mcp_tokens(user_id);
CREATE TABLE IF NOT EXISTS mcp_draft_imports (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_key TEXT NOT NULL,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, import_key)
);
