-- 修复管理员权限问题
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 先禁用 RLS 进行测试（可选，方便调试）
-- ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 2. 删除可能冲突的策略
DROP POLICY IF EXISTS "Anyone can create articles" ON articles;
DROP POLICY IF EXISTS "Public articles viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Authors can update own articles" ON articles;
DROP POLICY IF EXISTS "Admins can update all articles" ON articles;
DROP POLICY IF EXISTS "Authors can delete own articles" ON articles;
DROP POLICY IF EXISTS "Admins can delete all articles" ON articles;
DROP POLICY IF EXISTS "Users can view own articles" ON articles;
DROP POLICY IF EXISTS "Members can view internal articles" ON articles;
DROP POLICY IF EXISTS "Allow anonymous users to create articles" ON articles;
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Members can create articles" ON articles;

-- 3. 创建简单且宽松的策略（适合开发/测试）
-- 允许所有人查看所有文章
CREATE POLICY "Everyone can view all articles" ON articles
  FOR SELECT USING (true);

-- 允许所有人创建文章
CREATE POLICY "Everyone can create articles" ON articles
  FOR INSERT WITH CHECK (true);

-- 允许所有人更新文章
CREATE POLICY "Everyone can update articles" ON articles
  FOR UPDATE USING (true);

-- 允许所有人删除文章
CREATE POLICY "Everyone can delete articles" ON articles
  FOR DELETE USING (true);

-- 4. 验证策略
SELECT * FROM pg_policies WHERE tablename = 'articles';

-- 5. 查看当前文章（如果有）
SELECT id, title, status, created_at FROM articles ORDER BY created_at DESC;
