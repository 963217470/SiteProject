CREATE TABLE knowledge_connections (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(source,target),
  CHECK(source < target)
);
CREATE INDEX knowledge_connections_target ON knowledge_connections(target);

-- Snapshot legacy directory edges once; subsequent moves never rewrite connections.
INSERT OR IGNORE INTO knowledge_connections(source,target,created_by)
SELECT min(coalesce('b:'||parent_id,'root'),'b:'||id),max(coalesce('b:'||parent_id,'root'),'b:'||id),created_by
FROM knowledge_branches WHERE parent_id IS NULL OR parent_id<>id;
INSERT OR IGNORE INTO knowledge_connections(source,target,created_by)
SELECT min(coalesce('b:'||kb_branch_id,'root'),'a:'||id),max(coalesce('b:'||kb_branch_id,'root'),'a:'||id),author_id
FROM articles WHERE kb_enabled=1;

-- Old editors and MCP retain a useful initial connection, not a live parent binding.
CREATE TRIGGER knowledge_branch_initial_connection AFTER INSERT ON knowledge_branches BEGIN
  INSERT OR IGNORE INTO knowledge_connections(source,target,created_by)
  VALUES(min(coalesce('b:'||NEW.parent_id,'root'),'b:'||NEW.id),max(coalesce('b:'||NEW.parent_id,'root'),'b:'||NEW.id),NEW.created_by);
END;
CREATE TRIGGER knowledge_article_initial_connection AFTER INSERT ON articles WHEN NEW.kb_enabled=1 BEGIN
  INSERT OR IGNORE INTO knowledge_connections(source,target,created_by)
  VALUES(min(coalesce('b:'||NEW.kb_branch_id,'root'),'a:'||NEW.id),max(coalesce('b:'||NEW.kb_branch_id,'root'),'a:'||NEW.id),NEW.author_id);
END;
CREATE TRIGGER knowledge_article_join_connection AFTER UPDATE OF kb_enabled ON articles WHEN OLD.kb_enabled=0 AND NEW.kb_enabled=1 BEGIN
  INSERT OR IGNORE INTO knowledge_connections(source,target,created_by)
  VALUES(min(coalesce('b:'||NEW.kb_branch_id,'root'),'a:'||NEW.id),max(coalesce('b:'||NEW.kb_branch_id,'root'),'a:'||NEW.id),NEW.author_id);
END;
CREATE TRIGGER knowledge_branch_connections_delete AFTER DELETE ON knowledge_branches BEGIN
  DELETE FROM knowledge_connections WHERE source='b:'||OLD.id OR target='b:'||OLD.id;
END;
CREATE TRIGGER knowledge_article_connections_delete AFTER DELETE ON articles BEGIN
  DELETE FROM knowledge_connections WHERE source='a:'||OLD.id OR target='a:'||OLD.id;
END;
CREATE TRIGGER knowledge_article_connections_detach AFTER UPDATE OF kb_enabled ON articles WHEN NEW.kb_enabled=0 BEGIN
  DELETE FROM knowledge_connections WHERE source='a:'||NEW.id OR target='a:'||NEW.id;
END;
