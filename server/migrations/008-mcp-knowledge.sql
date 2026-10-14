ALTER TABLE mcp_tokens ADD COLUMN allow_knowledge_write INTEGER NOT NULL DEFAULT 0 CHECK (allow_knowledge_write IN (0,1));
ALTER TABLE knowledge_branch_requests ADD COLUMN requested_description TEXT NOT NULL DEFAULT '' CHECK (length(requested_description)<=2000);
CREATE TABLE mcp_node_creations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  branch_id TEXT REFERENCES knowledge_branches(id) ON DELETE CASCADE,
  request_id TEXT REFERENCES knowledge_branch_requests(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,request_key),
  CHECK ((branch_id IS NOT NULL) + (request_id IS NOT NULL) = 1)
);
