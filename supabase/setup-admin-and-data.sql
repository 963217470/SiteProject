-- ============================================================
-- 管理员设置与测试数据
-- ============================================================
-- 用途：
--   1. 查看已有 Supabase 用户。
--   2. 手动设置管理员。
--   3. 可选地插入一篇测试文章。
-- ============================================================

-- 1. 查看所有已登录用户，找到你的 user_id
SELECT
  id AS user_id,
  email,
  raw_user_meta_data->>'user_name' AS github_username,
  raw_user_meta_data->>'full_name' AS full_name,
  raw_user_meta_data->>'avatar_url' AS avatar_url,
  last_sign_in_at
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST;

-- 2. 设置管理员
-- 将 USER_ID_HERE 替换为真实 UUID 后，取消注释并执行。
/*
INSERT INTO profiles (id, username, full_name, avatar_url, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'user_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url',
  'admin'
FROM auth.users
WHERE id = 'USER_ID_HERE'
ON CONFLICT (id) DO UPDATE
SET
  role = 'admin',
  updated_at = NOW();
*/

-- 3. 可选：添加测试文章
-- 将 USER_ID_HERE 替换为真实 UUID 后，取消注释并执行。
/*
INSERT INTO articles (title, summary, content, status, visibility, author_id)
VALUES (
  '欢迎来到知识库',
  '这是第一篇测试文章。',
  '# 欢迎

欢迎来到知识库。

这是一篇用于验证文章系统的测试内容。',
  'published',
  'public',
  'USER_ID_HERE'
);
*/

-- 4. 验证管理员
SELECT
  p.id,
  p.role,
  p.username,
  p.full_name,
  u.email
FROM profiles AS p
LEFT JOIN auth.users AS u ON u.id = p.id
WHERE p.role = 'admin'
ORDER BY p.updated_at DESC;

-- 5. 查看文章
SELECT *
FROM articles
ORDER BY created_at DESC;
