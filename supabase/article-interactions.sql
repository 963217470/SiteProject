-- ============================================================
-- 文章互动功能：点赞、收藏、评论
-- ============================================================
-- 用途：
--   1. 确保点赞、评论、收藏表存在。
--   2. 为收藏表配置 RLS 策略。
--   3. 补充常用索引，提升文章详情页互动查询速度。
--
-- 使用方式：
--   在 Supabase SQL Editor 中执行本文件。
-- ============================================================

-- 1. 点赞表
CREATE TABLE IF NOT EXISTS article_likes (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. 收藏表
CREATE TABLE IF NOT EXISTS article_favorites (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, user_id)
);

ALTER TABLE article_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own article favorites" ON article_favorites;
DROP POLICY IF EXISTS "Users can create own article favorites" ON article_favorites;
DROP POLICY IF EXISTS "Users can delete own article favorites" ON article_favorites;

CREATE POLICY "Users can view own article favorites"
ON article_favorites
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own article favorites"
ON article_favorites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own article favorites"
ON article_favorites
FOR DELETE
USING (auth.uid() = user_id);

-- 4. 互动查询索引
CREATE INDEX IF NOT EXISTS idx_article_likes_article_user
ON article_likes(article_id, user_id);

CREATE INDEX IF NOT EXISTS idx_comments_article_created
ON comments(article_id, created_at);

CREATE INDEX IF NOT EXISTS idx_article_favorites_user_created
ON article_favorites(user_id, created_at DESC);

-- 5. 验证结果
SELECT 'article interactions are ready' AS status;
