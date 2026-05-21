-- 修复文章表的 RLS 策略
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 确保 RLS 已启用
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 2. 删除现有的策略
DROP POLICY IF EXISTS "Members can create articles" ON articles;
DROP POLICY IF EXISTS "Allow anonymous users to create articles" ON articles;
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Public articles viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Authors can update own articles" ON articles;
DROP POLICY IF EXISTS "Admins can update all articles" ON articles;

-- 3. 创建新策略

-- 允许所有人查看已发布的公开文章
CREATE POLICY "Public articles viewable by everyone" ON articles
  FOR SELECT USING (
    status = 'published' AND visibility = 'public'
  );

-- 允许任何人提交文章（包括未登录用户）
CREATE POLICY "Anyone can create articles" ON articles
  FOR INSERT WITH CHECK (true);

-- 允许作者更新自己的文章
CREATE POLICY "Authors can update own articles" ON articles
  FOR UPDATE USING (auth.uid() = author_id);

-- 允许管理员更新所有文章
CREATE POLICY "Admins can update all articles" ON articles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 允许作者删除自己的文章
CREATE POLICY "Authors can delete own articles" ON articles
  FOR DELETE USING (auth.uid() = author_id);

-- 允许管理员删除所有文章
CREATE POLICY "Admins can delete all articles" ON articles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 允许登录用户查看自己的文章（草稿、待审核等）
CREATE POLICY "Users can view own articles" ON articles
  FOR SELECT USING (auth.uid() = author_id);

-- 允许登录用户查看内部文章
CREATE POLICY "Members can view internal articles" ON articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 显示当前策略
SELECT * FROM pg_policies WHERE tablename = 'articles';
