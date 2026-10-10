CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('game','tool')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  extraction_code TEXT NOT NULL DEFAULT '',
  cover_id TEXT REFERENCES files(id),
  assets TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(assets)),
  status TEXT NOT NULL CHECK(status IN ('draft','pending','published','rejected','archived')),
  review_note TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX catalog_status ON catalog_items(status,updated_at);
CREATE TABLE catalog_downloads (
  item_id TEXT NOT NULL REFERENCES catalog_items(id),
  visitor TEXT NOT NULL,
  target TEXT NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY(item_id,visitor,target)
);
