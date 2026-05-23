-- ============================================================
-- 知识库树状分支
-- ============================================================
-- 用途：
--   1. 创建可嵌套的知识库分支表。
--   2. 让文章可以选择投入某个知识库分支。
--   3. 配置 RLS 与 REST API 权限。
--
-- 使用方式：
--   在 Supabase SQL Editor 中执行本文件。
-- ============================================================

-- 1. 知识库分支表
CREATE TABLE IF NOT EXISTS knowledge_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES knowledge_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_branches_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT knowledge_branches_slug_not_blank CHECK (length(trim(slug)) > 0),
  CONSTRAINT knowledge_branches_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_branches_parent_slug
ON knowledge_branches(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS idx_knowledge_branches_parent_sort
ON knowledge_branches(parent_id, sort_order, name);

-- 2. 给文章补充知识库字段
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS kb_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS kb_branch_id UUID REFERENCES knowledge_branches(id) ON DELETE SET NULL;

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS kb_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_articles_kb_branch_status_sort
ON articles(kb_branch_id, status, kb_enabled, kb_sort_order, created_at DESC);

-- 3. 普通用户的新分支申请
CREATE TABLE IF NOT EXISTS knowledge_branch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_branch_requests_path_not_blank CHECK (length(trim(requested_path)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_branch_requests_status_created
ON knowledge_branch_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_branch_requests_requester_created
ON knowledge_branch_requests(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_branch_requests_article
ON knowledge_branch_requests(article_id);

-- 4. 开启 RLS
ALTER TABLE knowledge_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_branch_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view knowledge branches" ON knowledge_branches;
DROP POLICY IF EXISTS "Admins can create knowledge branches" ON knowledge_branches;
DROP POLICY IF EXISTS "Admins can update knowledge branches" ON knowledge_branches;
DROP POLICY IF EXISTS "Admins can delete knowledge branches" ON knowledge_branches;

CREATE POLICY "Anyone can view knowledge branches"
ON knowledge_branches
FOR SELECT
USING (true);

CREATE POLICY "Admins can create knowledge branches"
ON knowledge_branches
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update knowledge branches"
ON knowledge_branches
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete knowledge branches"
ON knowledge_branches
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can create own branch requests" ON knowledge_branch_requests;
DROP POLICY IF EXISTS "Users can view own branch requests" ON knowledge_branch_requests;
DROP POLICY IF EXISTS "Admins can view all branch requests" ON knowledge_branch_requests;
DROP POLICY IF EXISTS "Admins can update branch requests" ON knowledge_branch_requests;

CREATE POLICY "Users can create own branch requests"
ON knowledge_branch_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own branch requests"
ON knowledge_branch_requests
FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all branch requests"
ON knowledge_branch_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update branch requests"
ON knowledge_branch_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 5. REST API 权限
GRANT SELECT ON knowledge_branches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON knowledge_branches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON knowledge_branch_requests TO authenticated;
GRANT SELECT ON articles TO anon, authenticated;
GRANT UPDATE(kb_enabled, kb_branch_id, kb_sort_order, updated_at) ON articles TO authenticated;

-- 6. 可选：初始化示例分支
INSERT INTO knowledge_branches (name, slug, sort_order)
VALUES
  ('00-认识层', '00-awareness', 0),
  ('01-共通基础层', '01-common-foundation', 10),
  ('02-方向学习', '02-direction-learning', 20),
  ('03-就业准备', '03-career-prep', 30),
  ('04-综合', '04-comprehensive', 40)
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_branches (parent_id, name, slug, sort_order)
SELECT parent.id, child.name, child.slug, child.sort_order
FROM knowledge_branches AS parent
CROSS JOIN (
  VALUES
    ('策划', 'planning', 0),
    ('程序', 'programming', 10),
    ('技术美术', 'technical-art', 20),
    ('美术', 'art', 30),
    ('支持岗位', 'support-roles', 40)
) AS child(name, slug, sort_order)
WHERE parent.slug = '02-direction-learning'
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_branches (parent_id, name, slug, sort_order)
SELECT parent.id, child.name, child.slug, child.sort_order
FROM knowledge_branches AS parent
CROSS JOIN (
  VALUES
    ('游戏开发学习框架', 'game-dev-learning-framework', 0),
    ('策划程序协作', 'design-programming-collab', 10),
    ('策划美术协作', 'design-art-collab', 20),
    ('会话上下文快照', 'context-snapshots', 30),
    ('继续工作入口', 'work-entry', 40),
    ('项目管理', 'project-management', 50),
    ('知识库输入原则', 'kb-ingest-principles', 60),
    ('AIGC工具集', 'aigc-toolkit', 70)
) AS child(name, slug, sort_order)
WHERE parent.slug = '04-comprehensive'
ON CONFLICT DO NOTHING;

-- 7. 验证结果
SELECT 'knowledge base schema is ready' AS status;
