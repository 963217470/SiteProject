-- 更智能的设置 Ce1este 为管理员的脚本
-- 请在 Supabase SQL Editor 中执行此脚本

-- 步骤1：禁用 articles 表的 RLS（先让审核功能能用）
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 步骤2：创建 profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 步骤3：先查看所有登录用户，方便找到您自己！
SELECT 
  id,
  email,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 步骤4：自动设置最近登录的用户为管理员（如果要设置其他用户，替换下面的方法）
-- 方式A：设置最后登录的用户为管理员（推荐，最简单）
INSERT INTO profiles (id, role, username, full_name, avatar_url)
SELECT 
  id, 
  'admin',
  COALESCE(raw_user_meta_data->>'user_name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 步骤5：显示结果
SELECT '设置成功！以下是当前的管理员：';
SELECT
  p.id,
  p.role,
  p.username,
  p.full_name,
  u.email,
  u.raw_user_meta_data->>'avatar_url' as avatar
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';

-- 如果上面的方式设置错了用户，可以手动指定：
-- 方式B：按邮箱设置（替换为您的邮箱）
-- INSERT INTO profiles (id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 方式C：按 GitHub 用户名设置
-- INSERT INTO profiles (id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- WHERE raw_user_meta_data->>'user_name' = 'Ce1este'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
