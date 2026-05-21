-- 允许匿名用户提交文章
DROP POLICY IF EXISTS "Members can create articles" ON articles;

CREATE POLICY "Allow anonymous users to create articles" ON articles
  FOR INSERT WITH CHECK (true);

-- 允许匿名用户查看公开文章
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;

CREATE POLICY "Public articles viewable by everyone" ON articles
  FOR SELECT USING (
    status = 'published' AND visibility = 'public'
  );
