-- ============================================================
-- 修复 articles 表 RLS 策略
-- ============================================================
-- 用途：
--   为知识库文章表重新建立一套较完整的行级安全策略。
--
-- 策略摘要：
--   - 任何人可以查看已发布的公开文章。
--   - 任何人可以提交文章。
--   - 作者可以查看、更新、删除自己的文章。
--   - member/admin 可以查看内部文章。
--   - admin 可以查看所有文章。
--   - admin 可以更新、删除所有文章。
-- ============================================================

-- 1. 开启 RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 2. 清理旧策略
DROP POLICY IF EXISTS "Members can create articles" ON articles;
DROP POLICY IF EXISTS "Allow anonymous users to create articles" ON articles;
DROP POLICY IF EXISTS "Anyone can create articles" ON articles;
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Public articles viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Authors can update own articles" ON articles;
DROP POLICY IF EXISTS "Admins can update all articles" ON articles;
DROP POLICY IF EXISTS "Authors can delete own articles" ON articles;
DROP POLICY IF EXISTS "Admins can delete all articles" ON articles;
DROP POLICY IF EXISTS "Users can view own articles" ON articles;
DROP POLICY IF EXISTS "Members can view internal articles" ON articles;
DROP POLICY IF EXISTS "Admins can view all articles" ON articles;

-- 3. 读取策略
CREATE POLICY "Public articles viewable by everyone"
ON articles
FOR SELECT
USING (
  status = 'published'
  AND visibility = 'public'
);

CREATE POLICY "Users can view own articles"
ON articles
FOR SELECT
USING (auth.uid() = author_id);

CREATE POLICY "Members can view internal articles"
ON articles
FOR SELECT
USING (
  visibility = 'internal'
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('member', 'admin')
  )
);

CREATE POLICY "Admins can view all articles"
ON articles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 4. 写入策略
CREATE POLICY "Anyone can create articles"
ON articles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authors can update own articles"
ON articles
FOR UPDATE
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can update all articles"
ON articles
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

-- 5. 删除策略
CREATE POLICY "Authors can delete own articles"
ON articles
FOR DELETE
USING (auth.uid() = author_id);

CREATE POLICY "Admins can delete all articles"
ON articles
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 6. 查看当前策略
SELECT *
FROM pg_policies
WHERE tablename = 'articles'
ORDER BY policyname;
