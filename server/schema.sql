CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id TEXT NOT NULL UNIQUE,
  email TEXT,
  github_username TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS knowledge_branches (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES knowledge_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  slug TEXT NOT NULL CHECK (length(trim(slug)) > 0),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS branches_parent_slug ON knowledge_branches(COALESCE(parent_id, ''), slug);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  cover_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  author_id TEXT NOT NULL REFERENCES users(id),
  reject_reason TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  kb_enabled INTEGER NOT NULL DEFAULT 0,
  kb_branch_id TEXT REFERENCES knowledge_branches(id) ON DELETE SET NULL,
  kb_sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS articles_status_created ON articles(status, visibility, created_at);
CREATE INDEX IF NOT EXISTS articles_author ON articles(author_id, created_at);
CREATE TABLE IF NOT EXISTS article_likes (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY(article_id, user_id)
);
CREATE TABLE IF NOT EXISTS article_favorites (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY(article_id, user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS comments_article ON comments(article_id, created_at);
CREATE TABLE IF NOT EXISTS profile_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS knowledge_branch_requests (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id),
  requested_path TEXT NOT NULL CHECK (length(trim(requested_path)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS internal_resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  category TEXT,
  version TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  UNIQUE(bucket, path)
);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS likes_insert AFTER INSERT ON article_likes BEGIN
  UPDATE articles SET likes_count = likes_count + 1 WHERE id = NEW.article_id;
END;
CREATE TRIGGER IF NOT EXISTS likes_delete AFTER DELETE ON article_likes BEGIN
  UPDATE articles SET likes_count = MAX(0, likes_count - 1) WHERE id = OLD.article_id;
END;
CREATE TRIGGER IF NOT EXISTS comments_insert AFTER INSERT ON comments BEGIN
  UPDATE articles SET comments_count = comments_count + 1 WHERE id = NEW.article_id;
END;
CREATE TRIGGER IF NOT EXISTS comments_delete AFTER DELETE ON comments BEGIN
  UPDATE articles SET comments_count = MAX(0, comments_count - 1) WHERE id = OLD.article_id;
END;
