-- ======================================
-- 查看所有用户并设置管理员
-- ======================================

-- 1. 查看所有已认证的用户
SELECT 
  id AS user_id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- 2. 查看profiles表中的所有用户（含角色）
SELECT 
  p.id AS profile_id,
  p.username,
  p.full_name,
  p.role,
  p.created_at,
  u.email,
  u.raw_user_meta_data
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;

-- 3. 如果profiles表不存在，创建它
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 确保启用RLS（可选，暂时禁用让审核功能能用）
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 5. 为所有新用户自动创建profile的触发器（可选）
-- （如果之前没创建的话）
