-- 专门设置 Ce1este 用户为管理员的脚本
-- 请在 Supabase SQL Editor 中执行此脚本

-- 步骤1：创建 profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 步骤2：禁用 articles 表的 RLS（最简单的方法）
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 步骤3：查找并设置 Ce1este 用户为管理员
-- 首先查询 Ce1este 用户的信息
DO $$
DECLARE
  ce1este_user RECORD;
BEGIN
  -- 查找 Ce1este 用户
  SELECT id INTO ce1este_user
  FROM auth.users
  WHERE
    email ILIKE '%ce1este%'
    OR raw_user_meta_data->>'user_name' ILIKE '%ce1este%'
    OR raw_user_meta_data->>'full_name' ILIKE '%ce1este%'
  LIMIT 1;

  -- 如果找到用户
  IF ce1este_user.id IS NOT NULL THEN
    -- 更新 profiles 表
    INSERT INTO profiles (id, role)
    VALUES (ce1este_user.id, 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    RAISE NOTICE '已将用户 % 设置为管理员', ce1este_user.id;
  ELSE
    RAISE NOTICE '未找到 Ce1este 用户，请手动查询用户ID';
  END IF;
END $$;

-- 步骤4：显示当前所有管理员
SELECT
  p.id,
  p.role,
  u.email,
  u.raw_user_meta_data->>'user_name' as github_username
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';

-- 步骤5：显示所有用户（如果需要手动设置）
-- SELECT id, email, raw_user_meta_data FROM auth.users;
