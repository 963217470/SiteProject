-- ============================================================
-- 查看用户与角色
-- ============================================================
-- 用途：
--   1. 查看 auth.users 中的所有认证用户。
--   2. 查看 profiles 中的用户资料和角色。
--   3. 必要时创建 profiles 表。
-- ============================================================

-- 1. 查看所有认证用户
SELECT
  id AS user_id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- 2. 确保 profiles 表存在
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. 查看 profiles 中的用户角色
SELECT
  p.id AS profile_id,
  p.username,
  p.full_name,
  p.role,
  p.created_at,
  p.updated_at,
  u.email,
  u.raw_user_meta_data
FROM profiles AS p
LEFT JOIN auth.users AS u ON u.id = p.id
ORDER BY p.created_at DESC;

-- 4. 可选：查看当前 RLS 策略
SELECT *
FROM pg_policies
WHERE tablename IN ('profiles', 'articles')
ORDER BY tablename, policyname;
