CREATE TABLE IF NOT EXISTS knowledge_positions (
  node_id TEXT PRIMARY KEY,
  x REAL NOT NULL CHECK (x BETWEEN -1000000 AND 1000000),
  y REAL NOT NULL CHECK (y BETWEEN -1000000 AND 1000000),
  pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
CREATE TRIGGER knowledge_branch_position_delete AFTER DELETE ON knowledge_branches BEGIN
  DELETE FROM knowledge_positions WHERE node_id='b:'||OLD.id;
END;
CREATE TRIGGER knowledge_article_position_delete AFTER DELETE ON articles BEGIN
  DELETE FROM knowledge_positions WHERE node_id='a:'||OLD.id;
END;
CREATE TRIGGER knowledge_article_position_detach AFTER UPDATE OF kb_enabled ON articles WHEN NEW.kb_enabled=0 BEGIN
  DELETE FROM knowledge_positions WHERE node_id='a:'||NEW.id;
END;
DROP TRIGGER task_branch_created;
CREATE TRIGGER task_branch_created AFTER INSERT ON knowledge_branches
WHEN NEW.created_by IS NOT NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=NEW.created_by AND role='admin') BEGIN
  INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) VALUES('branch',NEW.id,NEW.created_by);
END;
